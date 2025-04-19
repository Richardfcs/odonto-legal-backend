// userController.js

const User = require('../models/user');
const Case = require('../models/case');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const AuditLog = require('../models/auditlog'); // <<<--- IMPORTAR O MODELO AuditLog

// Função auxiliar para salvar logs (para evitar repetição)
// Esta função salva o log e NÃO espera a conclusão (para não atrasar a resposta principal)
// mas captura e loga erros no salvamento do próprio log.
const saveAuditLog = (userId, action, targetModel, targetId, details) => {
    if (!userId) {
        console.warn(`Tentativa de salvar log sem userId para ação ${action} em ${targetModel}:${targetId}`);
        // Decide o que fazer: não logar, logar com userId null, etc.
        // Vamos logar com um ID genérico ou nulo para rastrear a tentativa
        // userId = mongoose.Types.ObjectId(); // Ou algum placeholder
        // return; // Ou simplesmente não logue se não tiver usuário
    }
    if (!targetId) {
         console.warn(`Tentativa de salvar log sem targetId para ação ${action} em ${targetModel} por ${userId}`);
         return; // Não faz sentido logar sem um alvo
    }

    const log = new AuditLog({
        userId,
        action,
        targetModel,
        targetId,
        details
    });

    log.save().catch(err => {
        // Loga o erro se falhar ao salvar o AuditLog, mas não quebra a requisição principal
        console.error(`Falha ao salvar AuditLog (Ação: ${action}, User: ${userId}, Target: ${targetId}):`, err.message);
    });
};

// Criação da função de criar usuário / Cadastrar usuário
exports.createUser = async (req, res) => {
    let newUser = null; // Variável para guardar o usuário criado
    const performingUserId = req.userId; // Usuário que está criando (geralmente admin)

    try {
        const { name, email, telephone, password, cro, photo } = req.body;

        if (!name || !email || !telephone || !password || !cro) {
            return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { cro }] });
        if (existingUser) {
            return res.status(400).json({ error: "E-mail ou CRO já cadastrado." });
        }

        const user = new User({
            name, email, telephone, password, cro, photo,
            role: req.body.role || 'assistente'
        });

        newUser = await user.save(); // Salva o usuário

        // --- LOG de Auditoria ---
        // Quem criou (performingUserId), qual ação, qual modelo, qual ID foi criado
        saveAuditLog(performingUserId, 'CREATE_USER', 'User', newUser._id, { createdUserEmail: newUser.email });

        res.status(201).json({
            message: "Usuário criado com sucesso!",
            user: { /* ... dados do usuário ... */ }
        });
        console.log(`Usuário criado: ${newUser.name} por Usuário ID: ${performingUserId}`);

    } catch (err) {
        console.error('Erro ao criar usuário:', err.message);
         // --- LOG de Falha ---
         saveAuditLog(performingUserId, 'CREATE_USER_FAILED', 'User', newUser?._id || req.body.email || 'unknown', { error: err.message, input: req.body });
        res.status(400).json({ /* ... resposta de erro ... */ });
    }
};

// Listar todos os usuários
exports.getUsers = async (req, res) => {
    // Geralmente, operações de leitura pura (GET sem parâmetros) não precisam de log de auditoria
    // a menos que haja um requisito específico de rastrear quem viu a lista.
    // Se necessário, um log pode ser adicionado aqui.
    try {
        const users = await User.find().select('-password'); // Exclui a senha
        res.status(200).json(users);
        console.log(`Usuário ID: ${req.userId} listou todos os usuários.`); // Log simples no console
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar usuários.", details: err.message });
    }
};

// Login do usuário
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    let targetUserId = null; // Guardar o ID do usuário que tentou logar

    try {
        const user = await User.findOne({ email: email });
        if (user) targetUserId = user._id; // Guarda o ID se o usuário existe

        if (!user) {
            // --- LOG de Falha ---
            saveAuditLog(targetUserId || email, 'LOGIN_FAIL', 'User', targetUserId || email, { reason: 'User not found', emailAttempt: email });
            return res.status(404).json({ msg: "Usuário não encontrado!" });
        }

        const checkPassword = await bcrypt.compare(password, user.password);
        if (!checkPassword) {
             // --- LOG de Falha ---
             saveAuditLog(targetUserId, 'LOGIN_FAIL', 'User', targetUserId, { reason: 'Invalid password', emailAttempt: email });
            return res.status(422).json({ msg: "Senha inválida" });
        }

        const secret = process.env.SECRET;
        const token = jwt.sign( { id: user._id, role: user.role }, secret, { expiresIn: '1h' });

         // --- LOG de Sucesso ---
         saveAuditLog(targetUserId, 'LOGIN_SUCCESS', 'User', targetUserId, { email: user.email });

        console.log("Token JWT Gerado:", token);
        return res.status(200).json({ msg: "Autenticação realizada com sucesso!", token, role: user.role });
    } catch (error) {
        console.error("Erro durante o login:", error);
         // --- LOG de Falha Genérico ---
         saveAuditLog(targetUserId || email, 'LOGIN_FAIL', 'User', targetUserId || email, { reason: 'Server error', error: error.message, emailAttempt: email });
        return res.status(500).json({ msg: "Erro interno no servidor.", error: error.message });
    }
};

// Obter um usuário específico
exports.getOnlyUser = async (req, res) => {
    // Leitura de um único registro específico - geralmente não precisa de log de auditoria,
    // a menos que o acesso a perfis de usuário seja sensível.
    try {
        const user = await User.findById(req.params.id)
            .populate('cases', 'nameCase status')
            .select('-password');

        if (!user) return res.status(404).json({ msg: "Usuário não encontrado!" });

        // Opcional: Logar quem viu qual perfil
        // saveAuditLog(req.userId, 'VIEW_USER_PROFILE', 'User', user._id);

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
}

// Atualizar dados básicos do usuário
exports.updateUser = async (req, res) => {
    const targetUserId = req.params.id;
    const performingUserId = req.userId;

    try {
      const { name, email, telephone, cro, photo } = req.body;
      const currentUserRole = req.userRole;

      const userToUpdate = await User.findById(targetUserId);
      if (!userToUpdate) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      // Autorização: admin ou o próprio usuário
      // Nota: A lógica de autorização deve preferencialmente estar no middleware 'authorize' se possível,
      // mas uma verificação dupla aqui é aceitável para lógica específica.
      if (performingUserId !== targetUserId && currentUserRole !== 'admin') {
        return res.status(403).json({ error: 'Acesso não autorizado.' });
      }

      // Validação de e-mail único
      if (email && email !== userToUpdate.email) {
        const emailTaken = await User.findOne({ email: email });
        if (emailTaken) {
          return res.status(400).json({ error: 'E-mail já está em uso.' });
        }
      }

      // Objeto de updates (apenas campos permitidos e fornecidos)
      const updates = {};
      const originalData = {}; // Opcional: para logar dados antigos
      if (name && name !== userToUpdate.name) { updates.name = name; originalData.name = userToUpdate.name; }
      if (email && email !== userToUpdate.email) { updates.email = email; originalData.email = userToUpdate.email; }
      if (telephone && telephone !== userToUpdate.telephone) { updates.telephone = telephone; originalData.telephone = userToUpdate.telephone; }
      if (cro && cro !== userToUpdate.cro) { updates.cro = cro; originalData.cro = userToUpdate.cro; }
      if (photo !== undefined && photo !== userToUpdate.photo) { updates.photo = photo; /* Não logamos foto base64 inteira */ }
      updates.updateAt = Date.now();

       // Se não houver campos a atualizar (exceto updateAt)
      if (Object.keys(updates).length <= 1) {
           return res.status(200).json({ message: 'Nenhuma alteração detectada.', user: userToUpdate.select('-password') });
      }

      // Executa o update
      const updatedUser = await User.findByIdAndUpdate(
        targetUserId,
        { $set: updates },
        { new: true, runValidators: true } // Retorna o documento atualizado e roda validadores
      ).select('-password'); // Exclui a senha da resposta

      // --- LOG de Auditoria ---
      saveAuditLog(performingUserId, 'UPDATE_USER', 'User', updatedUser._id, { changes: updates, previous: originalData });

      return res.status(200).json({
        message: 'Usuário atualizado com sucesso!',
        user: updatedUser
      });
    } catch (err) {
      console.error('Erro ao atualizar usuário:', err);
       // --- LOG de Falha ---
       saveAuditLog(performingUserId, 'UPDATE_USER_FAILED', 'User', targetUserId, { error: err.message, input: req.body });
      return res.status(500).json({ /* ... resposta de erro ... */ });
    }
  };

// Atualizar a role do usuário
exports.updateUserRole = async (req, res) => {
    // A rota usa PATCH :id, então pegamos o ID dos parâmetros
    const targetUserId = req.params.id;
    const { role } = req.body; // Pega a nova role do corpo da requisição
    const performingUserId = req.userId; // Usuário que está fazendo a alteração (admin)

    try {
        const validRoles = ['admin', 'perito', 'assistente'];
        if (!role || !validRoles.includes(role)) { // Verifica se a role foi enviada e é válida
            return res.status(400).json({ message: 'Nova role inválida ou não fornecida. Roles permitidas: admin, perito, assistente.' });
        }

        // Busca o usuário para verificar a role antiga
        const userToUpdate = await User.findById(targetUserId);
        if (!userToUpdate) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        const oldRole = userToUpdate.role; // Guarda a role antiga para o log

        // Verifica se a role realmente mudou
        if (oldRole === role) {
             return res.status(200).json({ message: 'A role fornecida é a mesma role atual do usuário.', user: userToUpdate.select('-password') });
        }

        // Atualiza apenas o campo "role" do usuário
        const updatedUser = await User.findByIdAndUpdate(
            targetUserId,
            { role: role, updateAt: Date.now() }, // Atualiza role e timestamp
            { new: true, runValidators: true } // Retorna o documento atualizado
        ).select('-password'); // Exclui a senha


        // --- LOG de Auditoria ---
        saveAuditLog(performingUserId, 'UPDATE_USER_ROLE', 'User', updatedUser._id, { newRole: updatedUser.role, previousRole: oldRole });


        return res.status(200).json({ message: 'Role atualizada com sucesso.', user: updatedUser });
    } catch (error) {
        console.error('Erro ao atualizar a role do usuário:', error);
         // --- LOG de Falha ---
         saveAuditLog(performingUserId, 'UPDATE_USER_ROLE_FAILED', 'User', targetUserId, { error: error.message, requestedRole: role });
        return res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

// Deletar usuário
exports.deleteUser = async (req, res) => {
    const targetUserId = req.params.id;
    const performingUserId = req.userId;
    let deletedUserName = 'unknown'; // Para o log

    try {
        // Encontra e deleta o usuário
        const user = await User.findByIdAndDelete(targetUserId);
        if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

        deletedUserName = user.name; // Guarda o nome para o log

        // Opcional: Remover o usuário de casos vinculados (sua lógica existente)
        await Case.updateMany(
            { $or: [{ responsibleExpert: user._id }, { team: user._id }] },
            { $pull: { responsibleExpert: user._id, team: user._id } }
        );

         // --- LOG de Auditoria ---
         saveAuditLog(performingUserId, 'DELETE_USER', 'User', user._id, { deletedUserName: deletedUserName, deletedUserEmail: user.email });

        res.status(200).json({ message: "Usuário excluído com sucesso." });
        console.log(`Usuário "${deletedUserName}" (_id: ${user._id}) excluído por Usuário ID: ${performingUserId}`);
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
         // --- LOG de Falha ---
         saveAuditLog(performingUserId, 'DELETE_USER_FAILED', 'User', targetUserId, { error: error.message, deletedUserNameAttempt: deletedUserName });
        res.status(500).json({ error: "Erro ao excluir usuário.", details: error.message });
    }
};

// Obter usuário com casos populados
exports.getUserWithCases = async (req, res) => {
    // Leitura - geralmente não precisa de log de auditoria
    try {
        const user = await User.findById(req.params.id)
            .populate({
                path: 'cases',
                select: 'nameCase status responsibleExpert',
                populate: { path: 'responsibleExpert', select: 'name role' }
            })
            .select('-password');

        if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Obter lista de casos do usuário logado
exports.getMyCasesList = async (req, res) => {
    // Leitura - geralmente não precisa de log de auditoria
    try {
        const userId = req.userId;
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
             return res.status(401).json({ message: "Usuário autenticado inválido ou não fornecido." });
        }
        const myCases = await Case.find({ $or: [{ responsibleExpert: userId }, { team: userId }] })
            .populate('responsibleExpert', 'name role')
            .select('nameCase Description status location dateCase hourCase category');

        res.status(200).json(myCases);
    } catch (error) {
        console.error('Erro ao obter lista de casos do usuário logado:', error);
        res.status(500).json({ /* ... resposta de erro ... */ });
    }
};

// Obter usuário logado (perfil)
exports.getMe = async (req, res) => {
     // Leitura - geralmente não precisa de log de auditoria
    try {
        const userId = req.userId;
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(401).json({ message: "Usuário autenticado inválido ou não fornecido." });
        }
        const user = await User.findById(userId)
            .populate('cases', 'nameCase status dateCase category')
            .select('-password');
        if (!user) {
            return res.status(404).json({ message: "Seu perfil de usuário não foi encontrado no sistema." });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error('Erro ao obter dados do usuário logado:', error);
        res.status(500).json({ /* ... resposta de erro ... */ });
    }
};

// Filtrar usuários por nome
exports.getUsersByName = async (req, res) => {
     // Leitura - geralmente não precisa de log de auditoria
    try {
        const { name } = req.query;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: "Nome para pesquisa não fornecido." });
        }
        const users = await User.find({ name: { $regex: name, $options: 'i' } })
                                 .select('-password');
        if (users.length === 0) {
            return res.status(200).json({ message: "Nenhum funcionário encontrado com esse nome.", users: [] });
        }
        res.status(200).json(users);
    } catch (err) {
        console.error('Erro ao filtrar usuários por nome:', err);
        res.status(500).json({ /* ... resposta de erro ... */ });
    }
};