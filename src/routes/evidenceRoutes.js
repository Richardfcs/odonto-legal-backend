const express = require('express');
const router = express.Router();
const { verifyJWT, authorize } = require('../middleware/auth');
const { createEvidence, getAllEvidences, getEvidencesByCaseId, updateEvidence, deleteEvidence } = require('../controllers/evidenceController');

// Os métodos e Rotas das evidências
router.post('/', verifyJWT, authorize(['admin', 'perito']), createEvidence);
router.get('/', verifyJWT, getAllEvidences);
router.get('/:caseId', verifyJWT, authorize(['admin', 'perito']), getEvidencesByCaseId);
router.put('/:id', verifyJWT, authorize(['admin', 'perito']), updateEvidence)
router.delete('/:id', verifyJWT, authorize(['admin', 'perito']), deleteEvidence)

module.exports = router;