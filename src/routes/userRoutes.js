const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middleware/auth')
const { createUser, getUsers, updateUserRole, loginUser, getOnlyUser } = require('../controllers/userController');

// Os métodos e Rotas dos usuários
router.post('/', createUser);
router.get('/user/:id', verifyJWT , getOnlyUser);
router.post('/login', loginUser);
router.get('/',verifyJWT, getUsers);
router.put('/:id', updateUserRole);

//Exportar as rotas para app.js
module.exports = router;