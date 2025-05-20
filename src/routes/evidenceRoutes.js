const express = require('express');
const router = express.Router();
const { verifyJWT, authorize, checkTeamAccess } = require('../middleware/auth');
const { createEvidence, getAllEvidences, getEvidencesByCaseId, updateEvidence, deleteEvidence } = require('../controllers/evidenceController');

// Os métodos e Rotas das evidências
router.post('/:caseId', verifyJWT, checkTeamAccess, createEvidence);
router.get('/', verifyJWT, getAllEvidences);
router.get('/:caseId', verifyJWT, getEvidencesByCaseId);
router.put('/:id', verifyJWT, checkTeamAccess, updateEvidence)
router.delete('/:id', verifyJWT, checkTeamAccess, deleteEvidence)

module.exports = router;