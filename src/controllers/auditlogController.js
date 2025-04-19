const AuditLog = require('../models/auditlog'); // Importa o modelo AuditLog
const mongoose = require('mongoose');       // Para validação de ObjectId

// Função para listar TODOS os logs de auditoria com paginação e filtros básicos
exports.getAuditLogs = async (req, res) => {
    try {
        // --- Paginação ---
        // Obtém a página e o limite da query string, com valores padrão
        const page = parseInt(req.query.page) || 1;        // Página atual, padrão 1
        const limit = parseInt(req.query.limit) || 50;       // Itens por página, padrão 50
        const skip = (page - 1) * limit;                   // Quantos documentos pular

        // --- Filtros (Exemplos - podem ser expandidos) ---
        const filters = {};
        if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
            filters.userId = req.query.userId; // Filtra por usuário específico
        }
        if (req.query.action) {
            filters.action = req.query.action; // Filtra por tipo de ação
        }
        if (req.query.targetModel) {
             filters.targetModel = req.query.targetModel; // Filtra por modelo alvo
        }
         // Opcional: Filtro por Data (exemplo: logs das últimas 24h)
         // if (req.query.since === '24h') {
         //     filters.timestamp = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
         // }

        // --- Contagem Total (para paginação) ---
        // Conta o número total de documentos que correspondem aos filtros (antes de aplicar skip/limit)
        const totalLogs = await AuditLog.countDocuments(filters);

        // --- Busca os Logs com Filtros, População, Ordenação e Paginação ---
        const logs = await AuditLog.find(filters) // Aplica os filtros
            .populate('userId', 'name email role') // Popula o usuário que realizou a ação (seleciona campos úteis)
            .sort({ timestamp: -1 })              // Ordena pelos mais recentes primeiro
            .skip(skip)                            // Pula os documentos das páginas anteriores
            .limit(limit);                         // Limita o número de documentos retornados

        // --- Calcula Informações de Paginação ---
        const totalPages = Math.ceil(totalLogs / limit);

        // --- Resposta ---
        res.status(200).json({
            message: "Logs de auditoria recuperados com sucesso.",
            totalLogs: totalLogs,       // Total de logs encontrados com os filtros
            totalPages: totalPages,     // Número total de páginas
            currentPage: page,          // Página atual retornada
            logsPerPage: limit,         // Limite de logs por página usado
            auditLogs: logs             // O array de documentos de log para a página atual
        });

    } catch (error) {
        // --- Tratamento de Erro ---
        console.error("Erro ao buscar logs de auditoria:", error);
        res.status(500).json({
            message: "Erro interno do servidor ao buscar logs de auditoria.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
