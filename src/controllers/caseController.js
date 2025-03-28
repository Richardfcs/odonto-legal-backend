const Case = require('../models/case');

// Criação da função de criar caso / Cadastrar caso
// para exportar para userRoutes
exports.createCase = async (req, res) => {
    try {
        const { nameCase, Description, status, location, involved, category, createdAt, updateAt } = req.body;
        const cases = new Case({ nameCase, Description, status, location, involved, category, createdAt, updateAt });
        await cases.save();
        res.status(201);
        res.json(cases)
        console.log(`Caso criado com sucesso! Novo Caso: ${cases[nameCase]}!`)
    } catch (err) {
        res.status(400).json({ error: err.message });
        console.log('Erro ao criar o Caso, tente novamente e verifique se preencheu todos os campos')
    }
};

// Listar todos os usuários
// para exportar para userRoutes
exports.getCases = async (req, res) => {
    try {
        const cases = await Case.find();
        res.status(200).json(cases);
        console.log("Todos os casos listados!")
    } catch (err) {
        res.status(400).json({ error: err.message });
        console.log("erro ao listar todos os casos")
    }
};