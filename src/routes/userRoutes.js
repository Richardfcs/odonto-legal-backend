const express = require('express');
const router = express.Router();
const { createUser, getUsers } = require('../controllers/userController');

// Os métodos e Rotas dos usuários
router.post('/', createUser);
router.get('/', getUsers);

//Exportar as rotas para app.js
module.exports = router;