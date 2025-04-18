const User = require('../models/user');
const Case = require('../models/case');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Importar bcrypt
const mongoose = require('mongoose'); // Para validação de ObjectId

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
      const { name, email, telephone, cro, photo } = req.body;
      const currentUserId = req.userId;
      const currentUserRole = req.userRole;
  
      // 1. Verifica existência do usuário
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }
  
      // 2. Autorização: só o próprio usuário ou admin pode editar
      if (currentUserId !== user.id && currentUserRole !== 'admin') {
        return res.status(403).json({ error: 'Acesso não autorizado.' });
      }
  
      // 3. Validação de e-mail único, se for alterado
      if (email && email !== user.email) {
        const emailTaken = await User.findOne({ email });
        if (emailTaken) {
          return res.status(400).json({ error: 'E-mail já está em uso.' });
        }
      }
  
      // 4. Monta o objeto de updates somente com campos permitidos
      const updates = {};
      if (name)      updates.name      = name;
      if (email)     updates.email     = email;
      if (telephone) updates.telephone = telephone;
      if (cro)       updates.cro       = cro;
      if (photo)     updates.photo     = photo;
      updates.updateAt = Date.now();
  
      // 5. Executa o update
      const updatedUser = await User.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password'); // remove a senha da resposta
  
      return res.status(200).json({
        message: 'Usuário atualizado com sucesso!',
        user: updatedUser
      });
    } catch (err) {
      console.error('Erro ao atualizar usuário:', err);
      return res.status(500).json({
        error: 'Erro interno ao atualizar usuário.',
        details: err.message
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
};// Importar mongoose se não estiver

// ... (suas outras funções de controller: createUser, getUsers, loginUser, getOnlyUser, updateUser, updateUserRole, deleteUser, getUserWithCases) ...

// --- Nova Função para Filtrar Usuários por Nome ---
// Rota esperada: GET /api/user/fname?name={name}
exports.getUsersByName = async (req, res) => {
    try {
        const { name } = req.query; // Obtém o termo de busca do query parameter 'name'

        // 1. Validação: Verifica se o termo de busca foi fornecido
        if (!name || name.trim() === '') {
            // Se nenhum nome for fornecido, talvez você queira retornar todos os usuários
            // ou um erro 400. Dependendo da UX, retornar todos pode ser mais útil.
             // Vamos retornar um 400 indicando que o nome é obrigatório para esta rota de filtro
            return res.status(400).json({ error: "Nome para pesquisa não fornecido." });

             // --- Alternativa (retornar todos os usuários se a busca for vazia): ---
             // const allUsers = await User.find().select('-password'); // Exclui a senha
             // return res.status(200).json(allUsers);
             // --- Fim Alternativa ---
        }

        // 2. Busca usuários no banco de dados usando um Regular Expression
        // { name: { $regex: name, $options: 'i' } } busca documentos onde o campo 'name'
        // contém o termo de busca (`$regex`), ignorando maiúsculas/minúsculas (`$options: 'i'`).
        const users = await User.find({ name: { $regex: name, $options: 'i' } })
                                 .select('-password'); // Exclui o campo de senha da resposta por segurança

        // 3. Verifica se algum usuário foi encontrado
        if (users.length === 0) {
            // Retorna 200 com um array vazio e uma mensagem indicando que nada foi encontrado
            // Isso é mais amigável para o frontend do que um 404 para "não encontrado" na busca
            return res.status(200).json({ message: "Nenhum funcionário encontrado com esse nome.", users: [] });
        }

        // 4. Responde com a lista de usuários encontrados
        res.status(200).json(users); // Retorna o array de usuários encontrados
        console.log(`Usuários encontrados com o nome: "${name}"`);

    } catch (err) {
        // 5. Tratamento de erros
        console.error('Erro ao filtrar usuários por nome:', err);
        res.status(500).json({
            error: "Erro interno do servidor ao buscar funcionários por nome.",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined // Detalhes do erro apenas em dev
        });
    }
};

exports.getMe = async (req, res) => {
    try {
        const userId = req.userId; // Obtém o ID do usuário a partir do token (definido pelo middleware verifyJWT)

        // 1. Validação básica do userId
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
             // Isso indica que o middleware de autenticação não funcionou como esperado ou o token é inválido
            return res.status(401).json({ message: "Usuário autenticado inválido ou não fornecido." });
        }

        // 2. Busca o usuário no banco de dados
        // Podemos reutilizar a lógica de popular casos aqui se quisermos exibi-los no perfil.
        // Reutilizando a lógica de `getUserWithCases` para incluir casos (opcional)
        const user = await User.findById(userId)
            .populate('cases', 'nameCase status dateCase category')
            .select('-password'); // Exclui o campo de senha da resposta por segurança

        // 3. Verifica se o usuário foi encontrado (deve ser encontrado se o token for válido)
        if (!user) {
            // Este caso é raro se o middleware verifyJWT funciona, mas é um bom check
            return res.status(404).json({ message: "Seu perfil de usuário não foi encontrado no sistema." });
        }

        // 4. Responde com os dados do usuário (excluindo a senha)
        res.status(200).json(user);
        console.log(`Perfil do usuário ${user.name} (_id: ${user._id}) acessado.`);

    } catch (error) {
        // 5. Tratamento de erros
        console.error('Erro ao obter dados do usuário logado:', error);
        res.status(500).json({
            message: "Erro interno do servidor ao buscar seu perfil.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};