const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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

  //profile: { type: String, enum: ['admin', 'user'], required: true }
});

const Case = mongoose.model("Case", caseSchema);

//Exportar user para userController
module.exports = Case;
