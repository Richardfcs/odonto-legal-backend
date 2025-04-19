// routes/auditLogRoutes.js

const express = require('express');
const router = express.Router();
const { verifyJWT, authorize } = require('../middleware/auth'); // Importa os middlewares
const { getAuditLogs } = require('../controllers/auditlogController'); // Importa o controller

// Rota GET para listar os logs de auditoria
// Protegida por JWT e autorizada apenas para 'admin'
router.get('/', verifyJWT, authorize(['admin']), getAuditLogs);

// Opcional: Rota para buscar um log específico por ID
// router.get('/:id', verifyJWT, authorize(['admin']), getAuditLogById);

module.exports = router;