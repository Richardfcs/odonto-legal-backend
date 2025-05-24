// routes/victimRoutes.js
const express = require('express');
const router = express.Router();
const { createVictim, getVictims, getVictimById, updateVictim, deleteVictim } = require('../controllers/victimController'); // Ajuste o caminho
const { verifyJWT } = require('../middleware/auth'); // Autenticação básica
// Se precisar de checkTeamAccess ou similar para o caso:
// const { checkTeamAccess } = require('../middleware/auth');

// Rota para criar uma nova vítima
// A autorização fina (quem pode criar vítima PARA UM CASO ESPECÍFICO) está dentro do controller
// ou poderia ser um middleware que verifica o acesso ao 'caseId' enviado no body.
// Por simplicidade, apenas 'verifyJWT' aqui, e o controller lida com a permissão baseada no caso.
// Se a rota fosse POST /api/cases/:caseId/victims, então 'checkTeamAccess' seria ideal aqui.
router.post('/', verifyJWT, createVictim);

// Rota para listar todas as vítimas (geralmente para ADM)
router.get('/', verifyJWT, getVictims);

// Rota para obter uma vítima específica por ID
router.get('/:victimId', verifyJWT, getVictimById);

// Rota para atualizar uma vítima por ID
router.put('/:victimId', verifyJWT, updateVictim);

// Rota para deletar uma vítima por ID
router.delete('/:victimId', verifyJWT, deleteVictim);

module.exports = router;