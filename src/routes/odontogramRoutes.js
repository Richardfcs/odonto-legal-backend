// routes/odontogramRoutes.js
const express = require('express');
const router = express.Router();
const odontogramController = require('../controllers/odontogramController');
const { verifyJWT } = require('../middleware/auth'); // Assumindo que todas as rotas são protegidas

// Criar um novo odontograma
// O victimId virá no corpo da requisição
router.post('/', verifyJWT, odontogramController.createOdontogram);

// Obter todos os odontogramas de uma vítima específica
router.get('/victim/:victimId', verifyJWT, odontogramController.getOdontogramsByVictim);

// Obter um odontograma específico pelo seu ID
router.get('/:odontogramId', verifyJWT, odontogramController.getOdontogramById);

// Atualizar um odontograma
router.put('/:odontogramId', verifyJWT, odontogramController.updateOdontogram);

// Deletar um odontograma
router.delete('/:odontogramId', verifyJWT, odontogramController.deleteOdontogram);

module.exports = router;