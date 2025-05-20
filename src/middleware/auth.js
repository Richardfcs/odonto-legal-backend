const jwt = require('jsonwebtoken');
const Case = require('../models/case');
const mongoose = require("mongoose");

// Middleware para verificar o token JWT
exports.verifyJWT = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer <token>"

    if (!token) {
        return res.status(401).json({ auth: false, message: 'Token não fornecido.' });
    }

    jwt.verify(token, process.env.SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ auth: false, message: 'Token inválido ou expirado.' });
        }

        req.userId = decoded.id; // ID do usuário autenticado
        req.userRole = decoded.role; // Role do usuário (admin, perito, assistente)
        next();
    });
};

// Middleware para verificar roles (ex: apenas admin pode acessar)
exports.authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.userRole)) {
            return res.status(403).json({
                error: "Acesso negado. Permissões necessárias: " + allowedRoles.join(', ')
            });
        }
        next();
    };
};

exports.checkTeamAccess = async (req, res, next) => {
    try {
        // Determina qual parâmetro de rota usar para o caseId
        const caseIdFromParams = req.params.caseId || req.params.id;
        const caseIdFromBody = req.body.caseId; 
        
        const caseIdToUse = caseIdFromParams || caseIdFromBody; 

        const userId = req.userId; // Definido pelo verifyJWT
        const userRole = req.userRole; // Definido pelo verifyJWT

        // 1. Validar se os IDs necessários estão presentes e válidos
        if (!userId) {
            // Este erro não deveria acontecer se verifyJWT estiver antes na cadeia de middleware
            return res.status(401).json({ error: "Autenticação de usuário falhou ou ID do usuário não encontrado." });
        }
        if (!caseIdToUse) {
            return res.status(400).json({ error: "ID do caso não fornecido nos parâmetros da rota." });
        }
        if (!mongoose.Types.ObjectId.isValid(caseIdToUse)) {
            return res.status(400).json({ error: "Formato do ID do caso é inválido." });
        }

        // 2. Buscar o caso no banco de dados
        // Selecionar explicitamente os campos necessários pode ser uma boa prática
        const caso = await Case.findById(caseIdToUse).select('responsibleExpert team');

        // 3. Verificar se o caso foi encontrado
        if (!caso) {
            return res.status(404).json({ error: `Caso com ID '${caseIdToUse}' não encontrado.` });
        }

        // 4. Lógica de verificação de permissão
        const isAdmin = userRole === 'admin';
        if (isAdmin) {
            return next();
        }

        let isResponsible = false;
        // VERIFICAÇÃO ADICIONADA: Checar se responsibleExpert existe antes de .toString()
        if (caso.responsibleExpert && caso.responsibleExpert.toString() === userId.toString()) {
            isResponsible = true;
        }

        let isTeamMember = false;
        // VERIFICAÇÃO ADICIONADA: Checar se team existe e é um array antes de .some()
        if (caso.team && Array.isArray(caso.team) && caso.team.some(memberId =>
            memberId && memberId.toString() === userId.toString() // Checa se memberId não é null/undefined
        )) {
            isTeamMember = true;
        }

        if (isTeamMember || isResponsible) {
            return next();
        }

        // Se nenhuma das condições acima for atendida, o acesso é negado
        return res.status(403).json({ error: "Acesso negado. Você não tem permissão para interagir com este caso." });

    } catch (error) {
        console.error("Erro no checkTeamAccess:", error);
        return res.status(500).json({ error: "Erro interno do servidor ao verificar permissões do caso." });
    }
};