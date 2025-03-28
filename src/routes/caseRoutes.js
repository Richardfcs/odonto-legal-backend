const express = require('express');
const router = express.Router();
const { createCase, getCases } = require('../controllers/caseController');

// Os métodos e Rotas dos casos
router.post('/', createCase);
router.get('/', getCases);

module.exports = router;