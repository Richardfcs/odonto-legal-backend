const express = require('express');
const router = express.Router();
const { createCase, getCases, getCasesByCategory } = require('../controllers/caseController');

// Os métodos e Rotas dos casos
router.post('/', createCase);
router.get('/', getCases);
router.get('/fcat', getCasesByCategory);

module.exports = router;