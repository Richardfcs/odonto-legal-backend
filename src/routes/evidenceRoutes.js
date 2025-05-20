const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middleware/auth');
const { createEvidence, getAllEvidences, getEvidencesByCaseId, updateEvidence, deleteEvidence } = require('../controllers/evidenceController');

// Os métodos e Rotas das evidências
router.post('/:caseId', verifyJWT, createEvidence);
router.get('/', verifyJWT, getAllEvidences);
router.get('/:caseId', verifyJWT, getEvidencesByCaseId);
router.put('/:id', verifyJWT, updateEvidence)
router.delete('/:id', verifyJWT, deleteEvidence)

module.exports = router;