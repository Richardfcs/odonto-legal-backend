const express = require('express');
const router = express.Router();
const { createCase, getCases, getCasesByName, getCasesByStatus, getCasesByData } = require('../controllers/caseController');

// Os métodos e Rotas dos casos
router.post('/', createCase);
router.get('/', getCases);
router.get('/fname', getCasesByName);
router.get('/fstatus', getCasesByStatus);
router.get('/fdata', getCasesByData)

module.exports = router;