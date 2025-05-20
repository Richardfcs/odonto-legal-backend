const express = require('express');
const router = express.Router();
const { createCase, getCases, getCaseById, updateCase, deleteCase, getCasesByName, getCasesByStatus, getCasesByData, getCasesByDataCase, getCasesByCategory, addToTeam, removeTeamMemberFromCase, analyzeCaseWithAI } = require('../controllers/caseController');
const { verifyJWT, authorize, checkTeamAccess } = require('../middleware/auth');

// métodos de filtro (tem que vir antes de /:id sempre)
router.get('/fname', verifyJWT, getCasesByName);
router.get('/fstatus', verifyJWT, getCasesByStatus);
router.get('/fdata', verifyJWT, getCasesByData);
router.get('/fcat', verifyJWT, getCasesByCategory);
router.get('/fdatacase', verifyJWT, getCasesByDataCase);

// Os métodos e Rotas dos casos
router.post('/', verifyJWT, authorize(['admin', 'perito']), createCase);
router.get('/', verifyJWT, getCases);
router.get('/:id', verifyJWT, getCaseById);
router.put('/:id', verifyJWT, authorize(['admin', 'perito']), checkTeamAccess, updateCase);
router.delete('/:id', verifyJWT, authorize(['admin', 'perito']), checkTeamAccess, deleteCase);
router.post('/:caseId/team/:userId', verifyJWT, authorize(['admin', 'perito']), addToTeam);
router.delete('/:caseId/team/:userId', verifyJWT, authorize(['admin', 'perito']), removeTeamMemberFromCase);
// Rota para análise com IA (POST porque envia dados no corpo)
router.post('/:caseId/analyze', verifyJWT, checkTeamAccess, analyzeCaseWithAI); // Protegida e autorizada

module.exports = router;