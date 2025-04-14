const express = require('express');
const router = express.Router();
const { verifyJWT, authorize } = require('../middleware/auth');
const { createUser, getUsers, updateUserRole, updateUser, loginUser, getOnlyUser, deleteUser, getUserWithCases } = require('../controllers/userController');

// Os métodos e Rotas dos usuários
router.post('/', verifyJWT, authorize(['admin']), createUser);
router.get('/:id', verifyJWT, getOnlyUser);
router.post('/login', loginUser);
router.get('/', verifyJWT, getUsers);
router.put('/', verifyJWT, authorize(['admin']), updateUser);
router.put('/:id', verifyJWT, authorize(['admin']), updateUserRole);
router.delete('/:id', verifyJWT, authorize(['admin']), deleteUser);
router.get('/cases/:id', verifyJWT, getUserWithCases);

//Exportar as rotas para app.js
module.exports = router;