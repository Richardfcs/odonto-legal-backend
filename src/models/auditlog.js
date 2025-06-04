const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // Usuário que realizou a ação
    action: { // Ação realizada
        type: String,
        required: true,
        enum: [
            // ---- Ações de Usuário ----
            'CREATE_USER',              // Criação bem-sucedida de um usuário
            'UPDATE_USER',              // Atualização bem-sucedida dos dados de um usuário (exceto role)
            'DELETE_USER',              // Exclusão bem-sucedida de um usuário
            'UPDATE_USER_ROLE',         // Atualização bem-sucedida da role de um usuário
            'LOGIN_SUCCESS',            // Login bem-sucedido
            // Ações de Falha (Usuário)
            'CREATE_USER_FAILED',       // Tentativa falha de criar usuário
            'UPDATE_USER_FAILED',       // Tentativa falha de atualizar dados do usuário
            'DELETE_USER_FAILED',       // Tentativa falha de excluir usuário
            'UPDATE_USER_ROLE_FAILED',  // Tentativa falha de atualizar role
            'LOGIN_FAIL',               // Tentativa falha de login (usuário/senha errados ou erro)

            // ---- Ações de Caso ----
            'CREATE_CASE',              // Criação bem-sucedida de um caso
            'UPDATE_CASE',              // Atualização bem-sucedida de um caso
            'DELETE_CASE',              // Exclusão bem-sucedida de um caso
            'ADD_TEAM_MEMBER',
            'REMOVE_TEAM_MEMBER',
            // Ações de Falha (Caso)
            'CREATE_CASE_FAILED',       // Tentativa falha de criar caso
            'UPDATE_CASE_FAILED',       // Tentativa falha de atualizar caso
            'DELETE_CASE_FAILED',       // Tentativa falha de excluir caso
            'ADD_TEAM_MEMBER_FAILED',
            'REMOVE_TEAM_MEMBER_FAILED',

            // ---- Ações de Vítima ----
            'CREATE_VICTIM',
            'UPDATE_VICTIM',
            'DELETE_VICTIM',
            // ---- Ações de Falha (Vítima) ----
            'CREATE_VICTIM_FAILED',
            'UPDATE_VICTIM_FAILED',
            'DELETE_VICTIM_FAILED',

            // ---- Ações de Evidência ----
            'CREATE_EVIDENCE',          // Criação bem-sucedida de uma evidência
            'UPDATE_EVIDENCE',          // Atualização bem-sucedida de uma evidência
            'DELETE_EVIDENCE',          // Exclusão bem-sucedida de uma evidência
            // Ações de Falha (Evidência)
            'CREATE_EVIDENCE_FAILED',   // Tentativa falha de criar evidência
            'UPDATE_EVIDENCE_FAILED',   // Tentativa falha de atualizar evidência
            'DELETE_EVIDENCE_FAILED',   // Tentativa falha de excluir evidência

            // ---- Ações de Odontograma ---
            'CREATE_ODONTOGRAM',
            'UPDATE_ODONTOGRAM',
            'DELETE_ODONTOGRAM',

            // Ações de Falha (Odontograma)
            'CREATE_ODONTOGRAM_FAILED',
            'UPDATE_ODONTOGRAM_FAILED',
            'DELETE_ODONTOGRAM_FAILED',

            // ---- Ações de Laudo (Report) ----
            'CREATE_REPORT',            // Geração bem-sucedida de um laudo (PDF e registro DB)
            'DELETE_REPORT',            // Exclusão bem-sucedida de um laudo (registro DB e opcionalmente PDF)
            'CREATE_EVIDENCE_REPORT',
            // Ações de Falha (Laudo)
            'CREATE_REPORT_FAILED',     // Tentativa falha de gerar laudo
            'DELETE_REPORT_FAILED',     // Tentativa falha de excluir laudo
            'CREATE_EVIDENCE_REPORT_FAILED',

            // ---- Ações de Análise com IA ----
            'AI_ANALYSIS_SUMMARIZE',
            'AI_ANALYSIS_COMPARE',
            'AI_ANALYSIS_HYPOTHESIZE',
            'AI_ANALYSIS_CHECK_INCONSISTENCIES',
            // Ações de Falha (IA)
            'AI_ANALYSIS_SUMMARIZE_FAILED',
            'AI_ANALYSIS_COMPARE_FAILED',
            'AI_ANALYSIS_HYPOTHESIZE_FAILED',
            'AI_ANALYSIS_CHECK_INCONSISTENCIES_FAILED',

            // ---- Ações de Leitura (Opcionais - Use com Moderação) ----
            'VIEW_CASE_LIST',           // Visualizou a lista geral de casos (Banco de Casos)
            'VIEW_MY_CASE_LIST',        // Visualizou a lista dos próprios casos (Home Perito/Assistente)
            'VIEW_CASE_DETAILS',        // Visualizou os detalhes de um caso específico
            'VIEW_USER_LIST',           // Visualizou a lista de funcionários (Gerenciar Funcionários)
            'VIEW_USER_PROFILE',        // Visualizou o perfil de um usuário específico (Gerenciar Permissões ou Meu Perfil)
            'VIEW_AUDIT_LOGS',          // Visualizou a lista de logs de auditoria
            'DOWNLOAD_REPORT'           // Download bem-sucedido de um laudo PDF
        ]
    },
    targetModel: { // Modelo do documento alvo da ação
        type: String,
        required: true,
        enum: [
            'User',         // Ação relacionada a um Usuário
            'Case',         // Ação relacionada a um Caso
            'Evidence',     // Ação relacionada a uma Evidência
            'Report',       // Ação relacionada a um Laudo
            'Auth',         // Ação relacionada a Autenticação (Login)
            'System',       // Ação geral do sistema ou leitura de listas (sem ID específico)
            'AI',            // Ação relacionada à funcionalidade de IA
            'Victim',
            'Odontogram'
            ]
    },
    targetId: { // ID do documento alvo (ou identificador relevante como email/nome/ação)
        type: String, // Usar String para flexibilidade (pode ser ObjectId, email, 'all', 'login_attempt', etc.)
        required: true,
        index: true
    },
    timestamp: { // Data e hora da ação
        type: Date,
        default: Date.now
    },
    details: { // Detalhes adicionais (opcional)
        type: mongoose.Schema.Types.Mixed // Ex: campos alterados, erro, IP, etc.
    }
});

// Índices para otimizar consultas nos logs
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ targetModel: 1, targetId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);