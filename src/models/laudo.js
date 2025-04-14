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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Laudo = mongoose.model('Laudo', laudoSchema);
module.exports = Laudo;