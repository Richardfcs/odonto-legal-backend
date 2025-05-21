const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  caseId: { // Referência ao caso que este laudo pertence
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  reportType: { // Novo campo para diferenciar os tipos de laudo
    type: String,
    enum: ['case_general', 'evidence_specific'],
    default: 'case_general' // Laudo geral do caso por padrão
  },
  relatedEvidences: [{ // Novo campo para IDs de evidências (para laudos de evidência)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evidence'
  }],
  content: { // O conteúdo de texto livre do laudo (digitado pelo perito)
    type: String,
    required: true
  },
  signedBy: { // Referência ao usuário que gerou/assinou o laudo
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pdfUrl: { // URL onde o PDF gerado está salvo (para acesso direto)
    type: String,
    required: true
  },
  status: { // Status do laudo (rascunho, assinado, finalizado)
    type: String,
    enum: ['rascunho', 'assinado', 'finalizado'],
    default: 'finalizado' // Pode começar como 'finalizado' se for gerado final
  },
  createdAt: { // Data de criação do registro do laudo
    type: Date,
    default: Date.now,
  },
  updatedAt: { // Data da última atualização (mantido pelo middleware)
    type: Date,
    default: Date.now,
  },
});

// Middleware para atualizar `updatedAt` automaticamente
reportSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Report = mongoose.model('Report', reportSchema);
module.exports = Report;