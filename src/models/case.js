const mongoose = require("mongoose");
const User = require('../models/user'); // Garanta que esta linha está presente

// criando uma tabela no banco de dados para o caso
const caseSchema = new mongoose.Schema({
  nameCase: {
    type: String,
    required: true,
  },
  Description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["em andamento", "finalizado", "arquivado"],
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  dateCase: {
    type: Date
  },
  hourCase: {
    type: String
  },
  responsibleExpert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  team: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  category: {
    type: String,
    enum: ["acidente", "identificação de vítima", "exame criminal", "outros"],
    required: true,
  },
  evidences: [{ // Array de referências a 'Evidence'
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evidence'
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },

});

caseSchema.pre('deleteOne', async function (next) {
  const caseId = this.getQuery()._id;
  await Evidence.deleteMany({ caseId: caseId }); // Remove evidências vinculadas
  next();
});

caseSchema.pre('deleteOne', async function (next) {
  const caseId = this.getQuery()._id;
  // Remove o caso dos usuários vinculados
  await User.updateMany(
    { cases: caseId },
    { $pull: { cases: caseId } }
  );
  next();
});

caseSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

caseSchema.post('save', async function (doc) {
  const responsibleExpert = doc.responsibleExpert;
  const team = doc.team;

  // Atualiza o perito responsável
  await User.findByIdAndUpdate(
    responsibleExpert,
    { $addToSet: { cases: doc._id } } // Evita duplicatas
  );

  // Atualiza a equipe
  if (team && team.length > 0) {
    await User.updateMany(
      { _id: { $in: team } },
      { $addToSet: { cases: doc._id } }
    );
  }
});

caseSchema.index({ createdAt: 1 });
caseSchema.index({ status: 1 });
caseSchema.index({ category: 1 });

const Case = mongoose.model("Case", caseSchema);

//Exportar o caso para caseController
module.exports = Case;
