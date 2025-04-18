const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  signedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pdfUrl: {
    type: String,
    required: true
  },
  // Campos adicionais para controle
  status: {
    type: String,
    enum: ['rascunho', 'assinado', 'finalizado'],
    default: 'rascunho'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Atualiza updatedAt antes de salvar
reportSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Report = mongoose.model('Report', reportSchema);
module.exports = Report;