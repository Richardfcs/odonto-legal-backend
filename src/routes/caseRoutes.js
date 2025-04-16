const express = require('express');
const router = express.Router();
const { createCase, getCases, getCaseById, updateCase, deleteCase, getCasesByName, getCasesByStatus, getCasesByData, getCasesByDataCase, getCasesByCategory } = require('../controllers/caseController');
const { verifyJWT, authorize } = require('../middleware/auth');

// métodos de filtro (tem que vir antes de /:id sempre)
router.get('/fname', verifyJWT, getCasesByName);
router.get('/fstatus', verifyJWT, getCasesByStatus);
router.get('/fdata', verifyJWT, getCasesByData);
router.get('/fcat', getCasesByCategory);
router.get('/fdatacase', verifyJWT, getCasesByDataCase);

// Os métodos e Rotas dos casos
router.post('/', verifyJWT, authorize(['admin', 'perito']), createCase);
router.get('/', verifyJWT, getCases);
router.get('/:id', verifyJWT, getCaseById);
router.put('/:id', verifyJWT, authorize(['admin', 'perito']), updateCase);
router.delete('/:id', verifyJWT, authorize(['admin']), deleteCase);

module.exports = router;