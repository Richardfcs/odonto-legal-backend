const User = require('../models/user');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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

<<<<<<< HEAD
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    // check if user exists
    const user = await User.findOne({ email: email });

    if (!user) {
        console.log("Usuário não encontrado!");
        return res.status(404).json({ msg: "Usuário não encontrado!" });
    }

    // check if password match
    //const checkPassword = await bcrypt.compare(password, user.password);

    if (!password) {
        return res.status(422).json({ msg: "Senha inválida" });
    }
    try {
        const secret = process.env.SECRET;

        const token = jwt.sign(
            {
                id: user._id,
            },
            secret
        );

        res.status(200).json({ msg: "Autenticação realizada com sucesso!", token });
    } catch (error) {
        res.status(500).json({ msg: error });
    };
};

exports.getOnlyUser = async (req, res) => {
    try{
        const id = req.params.id;

        // check if user exists
        const user = await User.findById(id, "-password");
    
        if (!user) {
            return res.status(404).json({ msg: "Usuário não encontrado!" });
        }
    
        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ msg: error });
    };
}
=======
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
>>>>>>> f3dd4b019edb03701dc9fcf9309fa9d6f6caf2be
