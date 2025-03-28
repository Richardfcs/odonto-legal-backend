const express = require('express');
const router = express.Router();
const { createUser, getUsers, loginUser, getOnlyUser } = require('../controllers/userController');
const { checkToken } = require('../middleware/auth')
const { createUser, getUsers, updateUserRole } = require('../controllers/userController');

// Os métodos e Rotas dos usuários
router.post('/', createUser);
router.get('/user/:id', getOnlyUser, checkToken);
router.post('/login', loginUser);
router.get('/', getUsers);
router.put('/:id', updateUserRole);

//Exportar as rotas para app.js
module.exports = router;
