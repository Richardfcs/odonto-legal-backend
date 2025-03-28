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

exports.updateUserRole = async (req, res) => {
    try {
      const { _id, role } = req.body;
  
      // Validação básica: verifica se a role informada é válida
      const validRoles = ['admin', 'perito', 'assistente'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Role inválida. Role permitida: admin, perito ou assistente.' });
      }
  
      // Atualiza apenas o campo "role" do usuário
      const user = await User.findByIdAndUpdate(
        _id,
        { role },
        { new: true }  // retorna o documento atualizado
      );
  
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }
  
      return res.status(200).json({ message: 'Role atualizada com sucesso.', user });
    } catch (error) {
      console.error('Erro ao atualizar a role do usuário:', error);
      return res.status(500).json({ message: 'Erro interno do servidor.' });
    }
  };