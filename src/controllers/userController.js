const User = require('../models/user');

// Criação da função de criar usuário / Cadastrar usuário
// para exportar para userRoutes
exports.createUser = async (req, res) => {
    try {
        const { name, email, telephone, password, cro, createdAt } = req.body;
        const user = new User({ name, email, telephone, password, cro, createdAt });
        await user.save();
        res.status(201);
        res.json(user)
        console.log(`Usuário criado com sucesso! Novo usuário: ${user[name]}!`)
    } catch (err) {
        res.status(400).json({ error: err.message });
        console.log('Erro ao criar o usuário, tente novamente e verifique se preencheu todos os campos')
    }
};

// Listar todos os usuários
// para exportar para userRoutes
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
        console.log("Todos os usuários listados!")
    } catch (err) {
        res.status(400).json({ error: err.message });
        console.log("erro ao listar todos os usuários")
    }
};