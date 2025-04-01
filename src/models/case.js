const mongoose = require("mongoose");

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
    enum: ["em andamento", "fechado", "arquivado"],
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  // involved: [
  //   {
  //     type: mongoose.Schema.Types.ObjectId,
  //     ref: "User",
  //   },
  // ],
  category: {
    type: String,
    enum: ["crime", "acidente", "perícia", "outra"],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updateAt: {
    type: Date,
    default: Date.now,
  },

});

const Case = mongoose.model("Case", caseSchema);

//Exportar o caso para caseController
module.exports = Case;
