const User = require('../models/user');
const Case = require('../models/case');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Importar bcrypt

// Criação da função de criar usuário / Cadastrar usuário
// para exportar para userRoutes
exports.createUser = async (req, res) => {
    try {
        // 1. Extrair campos do corpo da requisição
        const { name, email, telephone, password, cro, photo } = req.body;

        // 2. Validação de campos obrigatórios
        if (!name || !email || !telephone || !password || !cro) {
            return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
        }

        // 3. Verificar se e-mail ou CRO já existem
        const existingUser = await User.findOne({ $or: [{ email }, { cro }] });
        if (existingUser) {
            return res.status(400).json({ error: "E-mail ou CRO já cadastrado." });
        }

        // 4. Criar novo usuário
        const user = new User({
            name,
            email,
            telephone,
            password,
            cro,
            photo,
            role: req.body.role || 'assistente' // Define role padrão se não for fornecido
        });

        // 5. Salvar usuário (o middleware pré-save já criptografa a senha)
        await user.save();

        // 6. Resposta de sucesso (sem enviar a senha)
        res.status(201).json({
            message: "Usuário criado com sucesso!",
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                cro: user.cro
            }
        });

        console.log(`Usuário criado com sucesso! Novo usuário: ${user.name}`);

    } catch (err) {
        // 7. Tratamento de erros
        console.error('Erro ao criar usuário:', err.message);
        res.status(400).json({
            error: "Erro ao criar usuário. Verifique os dados e tente novamente.",
            details: err.message
        });
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

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    try { // Envolver o código principal em try...catch para capturar erros iniciais
        // Verificar se o usuário existe
        const user = await User.findOne({ email: email });

        if (!user) {
            console.log("Usuário não encontrado!");
            return res.status(404).json({ msg: "Usuário não encontrado!" }); // <--- ADICIONE 'return'
        }

        // Verificar se a senha coincide usando bcrypt.compare()
        const checkPassword = await bcrypt.compare(password, user.password); // Comparar a senha fornecida com o hash armazenado

        if (!checkPassword) { // Verificar o resultado booleano de bcrypt.compare()
            return res.status(422).json({ msg: "Senha inválida" }); // <--- ADICIONE 'return'
        }

        const secret = process.env.SECRET;

        const token = jwt.sign(
            {
                id: user._id,
                role: user.role // Adicione a role do usuário
            },
            secret,
            { expiresIn: '1h' }
        );
        console.log("Valor de process.env.SECRET:", secret);
        console.log("Token JWT Gerado:", token);
        return res.status(200).json({ msg: "Autenticação realizada com sucesso!", token }); // <--- ADICIONE 'return'
    } catch (error) {
        console.error("Erro durante o login:", error); // Log do erro para debug
        return res.status(500).json({ msg: "Erro interno no servidor.", error: error.message }); // <--- ADICIONE 'return' e envie mensagem de erro mais informativa
    }
};

exports.getOnlyUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('cases', 'nameCase status'); // Popula os casos do usuário

        if (!user) return res.status(404).json({ msg: "Usuário não encontrado!" });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
}
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const currentUser = req.userId; // ID do usuário autenticado
        const currentUserRole = req.userRole; // Role do usuário autenticado

        // Verifica se o usuário existe
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        // Autorização: apenas o próprio usuário ou admin pode editar
        if (currentUser !== id && currentUserRole !== 'admin') {
            return res.status(403).json({ error: "Acesso não autorizado." });
        }

        // Validação de e-mail único (se estiver atualizando o e-mail)
        if (updates.email && updates.email !== user.email) {
            const existingUser = await User.findOne({ email: updates.email });
            if (existingUser) {
                return res.status(400).json({ error: "E-mail já está em uso." });
            }
        }

        // Criptografa a nova senha (se estiver atualizando)
        if (updates.password) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(updates.password, salt);
        }

        // Atualiza o usuário
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true } // Retorna o documento atualizado e valida os campos
        ).select('-password'); // Remove a senha da resposta

        res.status(200).json({
            message: "Usuário atualizado com sucesso!",
            user: updatedUser
        });

    } catch (error) {
        res.status(500).json({
            error: "Erro ao atualizar usuário.",
            details: error.message
        });
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
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
        // Remova o usuário dos casos vinculados
        await Case.updateMany(
            { $or: [{ responsibleExpert: user._id }, { team: user._id }] },
            { $pull: { responsibleExpert: user._id, team: user._id } }
        );
        res.status(200).json({ message: "Usuário excluído com sucesso." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getUserWithCases = async (req, res) => {
    try {
        const user = await User.findById(req.params.id) // Usando req.params.id
            .populate({
                path: 'cases',
                select: 'nameCase status responsibleExpert',
                populate: {
                    path: 'responsibleExpert',
                    select: 'name role'
                }
            });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};