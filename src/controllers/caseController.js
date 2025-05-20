const User = require('../models/user'); // Garanta que esta linha está presente
const Case = require('../models/case');
const Evidence = require('../models/evidence');
const mongoose = require('mongoose');
const AuditLog = require('../models/auditlog');
const axios = require('axios'); // Importar Axios

// caseController.js

// Função auxiliar para salvar logs (copiada ou importada de utils/auditLogger.js)
const saveAuditLog = (userId, action, targetModel, targetId, details) => {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) { // Verifica se userId é válido
        console.warn(`Tentativa de salvar log sem userId válido para ação ${action} em ${targetModel}:${targetId}`);
        // Pode-se logar com um usuário 'sistema' ou não logar
        return; // Vamos optar por não logar se não houver userId válido
    }
    if (!targetId) {
        console.warn(`Tentativa de salvar log sem targetId para ação ${action} em ${targetModel} por ${userId}`);
        return;
    }

    const log = new AuditLog({
        userId,
        action,
        targetModel,
        targetId: String(targetId), // Garante que targetId seja string
        details
    });

    log.save().catch(err => {
        console.error(`Falha ao salvar AuditLog (Ação: ${action}, User: ${userId}, Target: ${targetId}):`, err.message);
    });
};

// --- Funções do Controller com Logs ---

// Criação da função de criar caso / Cadastrar caso
exports.createCase = async (req, res) => {
    let newCase = null; // Para ter acesso ao ID em caso de erro
    const performingUserId = req.userId; // ID do usuário logado

    try {
        const responsibleExpert = performingUserId; // O criador é o responsável inicial

        // Validação do perito (opcional, já que o token foi validado, mas seguro)
        // const perito = await User.findById(responsibleExpert);
        // if (!perito) { return res.status(404).json({ error: "Perito não encontrado." }); }

        const { nameCase, Description, status, location, category, dateCase, hourCase, team } = req.body;

        if (!nameCase || !status || !location || !category) {
            return res.status(400).json({ error: "Campos obrigatórios faltando: nameCase, status, location, category." });
        }

        const caseInstance = new Case({
            nameCase, Description, status, location, category, dateCase, hourCase,
            responsibleExpert,
            team: team || []
        });

        newCase = await caseInstance.save(); // Salva o caso

        // 1. Adiciona ao responsável (garantido não duplicar)
        await User.findByIdAndUpdate(
            responsibleExpert,
            { $addToSet: { cases: newCase._id } } // Usa $addToSet
        );

        // 2. Adiciona à equipe (garantido não duplicar, mesmo que o responsável esteja aqui)
        if (team && team.length > 0) {
            await User.updateMany(
                { _id: { $in: team } },
                { $addToSet: { cases: newCase._id } }
            );
        }

        // --- LOG de Auditoria ---
        saveAuditLog(performingUserId, 'CREATE_CASE', 'Case', newCase._id, { caseName: newCase.nameCase });

        res.status(201).json({ message: "Caso criado com sucesso!", case: newCase });
        console.log(`Caso "${newCase.nameCase}" criado por Usuário ID: ${performingUserId}`);

    } catch (err) {
        console.error("Erro no createCase:", err.message);
        // --- LOG de Falha ---
        saveAuditLog(performingUserId, 'CREATE_CASE_FAILED', 'Case', newCase?._id || 'unknown', { error: err.message, input: req.body });
        res.status(400).json({ error: "Erro ao criar caso.", details: err.message });
    }
};

// Listar todos os casos
exports.getCases = async (req, res) => {
    // Leitura - Log opcional
    try {
        const cases = await Case.find()
            .populate('responsibleExpert', 'name email role')
            .populate('team', 'name');
        // Evidences geralmente são buscadas em outra rota, mas se precisar aqui, adicione: .populate('evidences');
        res.status(200).json(cases);
        // Opcional: Log de leitura
        // saveAuditLog(req.userId, 'VIEW_CASE_LIST', 'Case', 'all'); // Exemplo
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar casos.", details: err.message });
    }
};

// Obter um caso por ID
exports.getCaseById = async (req, res) => {
    // Leitura - Log opcional
    try {
        const caseId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(caseId)) {
            return res.status(400).json({ msg: "ID de caso inválido." });
        }

        const caso = await Case.findById(caseId)
            .populate('responsibleExpert', 'name role')
            .populate('team', 'name role');
        // Evidências são buscadas em /api/evidence/:caseId, não precisa popular aqui geralmente

        if (!caso) {
            return res.status(404).json({ msg: "Caso não encontrado." });
        }

        // Opcional: Log de leitura de detalhes
        // saveAuditLog(req.userId, 'VIEW_CASE_DETAILS', 'Case', caso._id);

        res.status(200).json(caso);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar caso.", details: error.message });
    }
};

// Atualizar um caso
exports.updateCase = async (req, res) => {
    const caseId = req.params.id;
    const performingUserId = req.userId;
    const performingUserRole = req.userRole;

    try {
        // Validação do ID
        if (!mongoose.Types.ObjectId.isValid(caseId)) {
            return res.status(400).json({ msg: "ID de caso inválido." });
        }

        // Busca o caso para verificar permissão e dados antigos
        const caso = await Case.findById(caseId);
        if (!caso) {
            return res.status(404).json({ error: "Caso não encontrado." });
        }

        // Atualiza o caso com os dados do corpo da requisição
        const updatedCase = await Case.findByIdAndUpdate(
            caseId,
            { ...req.body, updateAt: Date.now() }, // Inclui updateAt
            { new: true, runValidators: true } // Retorna o novo doc e roda validadores
        );

        // --- LOG de Auditoria ---
        saveAuditLog(performingUserId, 'UPDATE_CASE', 'Case', updatedCase._id, { changes: req.body /*, previous: previousData */ });

        res.status(200).json({ message: "Caso atualizado com sucesso!", case: updatedCase });
        console.log(`Caso "${updatedCase.nameCase}" atualizado por Usuário ID: ${performingUserId}`);

    } catch (error) {
        console.error("Erro no updateCase:", error.message);
        // --- LOG de Falha ---
        saveAuditLog(performingUserId, 'UPDATE_CASE_FAILED', 'Case', caseId, { error: error.message, input: req.body });
        res.status(500).json({ error: "Erro ao atualizar caso.", details: error.message });
    }
};

// Deletar um caso
exports.deleteCase = async (req, res) => {
    const caseId = req.params.id;
    const performingUserId = req.userId;
    let deletedCaseName = 'unknown'; // Para o log

    try {
        // Validação do ID
        if (!mongoose.Types.ObjectId.isValid(caseId)) {
            return res.status(400).json({ msg: "ID de caso inválido." });
        }

        // Encontra e deleta o caso
        const caso = await Case.findByIdAndDelete(caseId);
        if (!caso) return res.status(404).json({ error: "Caso não encontrado." });

        deletedCaseName = caso.nameCase; // Guarda nome para o log

        // Opcional: Remover referências deste caso nos usuários associados
        await User.updateMany(
            { _id: { $in: [caso.responsibleExpert, ...(caso.team || [])] } },
            { $pull: { cases: caso._id } }
        );
        // Opcional: Deletar evidências associadas? Depende da regra de negócio.
        // await Evidence.deleteMany({ caseId: caso._id });

        // --- LOG de Auditoria ---
        saveAuditLog(performingUserId, 'DELETE_CASE', 'Case', caso._id, { deletedCaseName: deletedCaseName });

        res.status(200).json({ message: "Caso excluído com sucesso." });
        console.log(`Caso "${deletedCaseName}" (_id: ${caso._id}) excluído por Usuário ID: ${performingUserId}`);

    } catch (error) {
        console.error("Erro no deleteCase:", error.message);
        // --- LOG de Falha ---
        saveAuditLog(performingUserId, 'DELETE_CASE_FAILED', 'Case', caseId, { error: error.message });
        res.status(500).json({ error: "Erro ao excluir caso.", details: error.message });
    }
};

// --- Funções de Filtro (Leitura - Logs Opcionais) ---

// Função para filtrar casos por nome
// Example: GET http://localhost:3000/api/case/fname?nameCase=Acidente
exports.getCasesByName = async (req, res) => {
    try {
        const { nameCase } = req.query;
        if (!nameCase) {
            return res.status(400).json({ error: "Nome do caso não fornecido" });
        }

        const cases = await Case.find({ nameCase: { $regex: nameCase, $options: 'i' } })
            .populate('responsibleExpert', 'name email role') // Popula apenas nome, email e role
            .populate('team', 'name')
            .populate('evidences');
        if (cases.length === 0) {
            return res.status(404).json({ message: "Nenhum caso encontrado com esse nome" });
        }

        res.status(200).json(cases);
        console.log(`Casos encontrados com o nome: ${nameCase}`);
    } catch (err) {
        res.status(400).json({ error: err.message });
        console.log("Erro ao filtrar casos por nome");
    }
};

// Função para filtrar casos por status
// Example: http://localhost:3000/api/case/fstatus?status=em%20andamento
exports.getCasesByStatus = async (req, res) => {
    try {
        const { status } = req.query;
        if (!status) {
            return res.status(400).json({ error: "Status não fornecido" });
        }

        const cases = await Case.find({ status })
            .populate('responsibleExpert', 'name email role') // Popula apenas nome, email e role
            .populate('team', 'name')
            .populate('evidences');
        if (cases.length === 0) {
            return res.status(404).json({ message: "Nenhum caso encontrado com esse status" });
        }

        res.status(200).json(cases);
        console.log(`Casos encontrados com status: ${status}`);
    } catch (err) {
        res.status(400).json({ error: err.message });
        console.log("Erro ao filtrar casos por status");
    }
};

// filtrar casos por data
// Exemplo: http://localhost:3000/api/case/fdata?startDate=2024-01-01&endDate=2024-12-31&order=oldest
exports.getCasesByData = async (req, res) => {
    try {
        const { startDate, endDate, order } = req.query;

        const filter = {};

        // Filtro por intervalo de datas (createdAt)
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                filter.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.createdAt.$lte = new Date(endDate);
            }
        }

        // Ordenação por data (padrão: mais novo primeiro, se order = 'oldest', muda pra mais antigo)
        const sortOption = order === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

        const cases = await Case.find(filter).sort(sortOption)
            .populate('responsibleExpert', 'name email role') // Popula apenas nome, email e role
            .populate('team', 'name')
            .populate('evidences');

        if (cases.length === 0) {
            return res.status(404).json({ message: "Nenhum caso encontrado no intervalo de datas fornecido." });
        }

        res.status(200).json(cases);
    } catch (err) {
        console.error("Erro ao buscar casos:", err);
        res.status(500).json({ message: "Erro interno do servidor.", error: err.message });
    }
};

// filtrar casos por data do Caso
// Exemplo: http://localhost:3000/api/case/fdata?startDate=2024-01-01&endDate=2024-12-31&order=oldest
exports.getCasesByDataCase = async (req, res) => {
    try {
        const { startDate, order } = req.query;

        const filter = {};

        // Filtro por intervalo de datas (createdAt)
        if (startDate) {
            filter.dateCase = {};
            if (startDate) {
                filter.dateCase.$gte = new Date(startDate);
            }
            // if (endDate) {
            //   filter.dateCase.$lte = new Date(endDate);
            // }
        }

        // Ordenação por data (padrão: mais novo primeiro, se order = 'oldest', muda pra mais antigo)
        const sortOption = order === "oldest" ? { dateCase: 1 } : { dateCase: -1 };

        const cases = await Case.find(filter).sort(sortOption)
            .populate('responsibleExpert', 'name email role') // Popula apenas nome, email e role
            .populate('team', 'name')
            .populate('evidences');

        if (cases.length === 0) {
            return res.status(404).json({ message: "Nenhum caso encontrado no intervalo de datas fornecido." });
        }

        res.status(200).json(cases);
    } catch (err) {
        console.error("Erro ao buscar casos:", err);
        res.status(500).json({ message: "Erro interno do servidor.", error: err.message });
    }
};

// Função para filtrar casos por categoria
// Example: GET http://localhost:3000/api/case/fcat?category=acidente
exports.getCasesByCategory = async (req, res) => {
    try {

        const { category } = req.query;


        const casosFiltrados = await Case.find({ category })
            .populate('responsibleExpert', 'name email role') // Popula apenas nome, email e role
            .populate('team', 'name')
            .populate('evidences');


        if (casosFiltrados.length === 0) {
            return res.status(404).json({ message: "Nenhum caso encontrado para essa categoria." });
        }


        return res.status(200).json(casosFiltrados);
    } catch (error) {
        console.error("Erro ao filtrar casos por categoria:", error);
        return res.status(500).json({ message: "Erro interno no servidor." });
    }
};

// Função para análise com IA via OpenRouter
exports.analyzeCaseWithAI = async (req, res) => {
    const { caseId } = req.params;
    const { action, evidenceIds } = req.body;
    const performingUserId = req.userId;

    // --- Declare inputText AQUI, fora do try ---
    let inputText = ''; // Inicializa como string vazia

    try {
        // Validação básica
        if (!mongoose.Types.ObjectId.isValid(caseId)) {
            return res.status(400).json({ error: "ID de caso inválido." });
        }
        const validActions = ['summarize', 'compare', 'hypothesize', 'check_inconsistencies'];
        if (!action || !validActions.includes(action)) {
            return res.status(400).json({ error: "Ação de análise inválida ou não fornecida." });
        }
        // ... (outras validações como a de 'compare' com evidenceIds) ...
        if (action === 'compare' && (!Array.isArray(evidenceIds) || evidenceIds.length !== 2)) {
            return res.status(400).json({ error: "Para comparar, forneça exatamente dois IDs de evidência no array 'evidenceIds'." });
        }

        // 1. Buscar dados do Caso e Evidências Relevantes
        const caso = await Case.findById(caseId).select('nameCase Description');
        if (!caso) {
            return res.status(404).json({ error: "Caso não encontrado." });
        }

        let relevantEvidences = [];
        const queryFilter = { caseId: caseId };
        if (action === 'compare' || (Array.isArray(evidenceIds) && evidenceIds.length > 0)) {
            queryFilter._id = { $in: evidenceIds.map(id => new mongoose.Types.ObjectId(id)) };
        }
        queryFilter.evidenceType = { $in: ['text_description'] }; // Apenas textuais
        relevantEvidences = await Evidence.find(queryFilter).select('title description data evidenceType');

        // Verificações de evidências encontradas (mantidas)
        if (action === 'compare' && relevantEvidences.length !== 2) {
            return res.status(404).json({ error: "Uma ou ambas as evidências especificadas para comparação não foram encontradas ou não são textuais." });
        }
        if (relevantEvidences.length === 0 && action !== 'compare') {
            return res.status(404).json({ error: "Nenhuma evidência textual encontrada neste caso para análise." });
        }


        // 2. Preparar o Texto para a IA (AGORA ATRIBUI VALOR À VARIÁVEL JÁ DECLARADA)
        inputText = `Análise do Caso: ${caso.nameCase}\nDescrição do Caso: ${caso.Description}\n\nEvidências:\n`;
        relevantEvidences.forEach((ev, index) => {
            inputText += `--- Evidência ${index + 1} ---\n`;
            inputText += `Título: ${ev.title || 'Sem Título'}\n`;
            if (ev.description) inputText += `Descrição: ${ev.description}\n`;
            if (ev.evidenceType !== 'image' && ev.data) {
                inputText += `Dados: ${typeof ev.data === 'object' ? JSON.stringify(ev.data) : String(ev.data)}\n`;
            }
            inputText += `\n`;
        });

        // 3. Engenharia de Prompt (mantida)
        let prompt = "";
        switch (action) {
            case 'summarize':
                prompt = `Você é um assistente de análise forense. Resuma os pontos-chave e os achados mais relevantes presentes no texto do caso e das evidências fornecidas abaixo. Seja conciso e objetivo, focando apenas na informação presente:\n\n${inputText}`;
                break;
            case 'compare':
                // A inputText já contém as duas evidências selecionadas
                prompt = `Você é um assistente de análise forense. Compare as duas evidências fornecidas abaixo. Destaque as principais semelhanças e diferenças factuais relevantes para uma investigação forense. NÃO faça suposições além do texto:\n\n${inputText}`;
                break;
            case 'hypothesize':
                prompt = `Você é um assistente de análise forense. Com base *estritamente* nas informações textuais do caso e evidências fornecidas abaixo, gere 2-3 hipóteses iniciais *plausíveis* sobre [PONTO CHAVE DO CASO - EX: a sequência dos eventos / a causa da lesão]. Justifique brevemente cada hipótese com base no texto fornecido. Deixe claro que são apenas hipóteses iniciais:\n\n${inputText}`;
                // NOTA: "[PONTO CHAVE DO CASO...]" idealmente viria do frontend ou seria mais genérico.
                break;
            case 'check_inconsistencies':
                prompt = `Você é um assistente de análise forense. Revise cuidadosamente as informações do caso e as descrições/dados das evidências fornecidas abaixo. Liste quaisquer *potenciais* inconsistências factuais, contradições ou pontos que pareçam conflitantes entre as diferentes partes do texto. Seja específico sobre quais informações podem estar em conflito:\n\n${inputText}`;
                break;
        }
        // 4. Chamar a API OpenRouter (mantida)
        const openRouterApiKey = process.env.OPENROUTER_API_KEY;
        if (!openRouterApiKey) {
            throw new Error("Chave de API OpenRouter não configurada no backend.");
        }

        console.log(`Enviando prompt para OpenRouter (modelo: deepseek/deepseek-chat) - Ação: ${action}`);

        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: "deepseek/deepseek-chat",
            messages: [{ role: "user", content: prompt }]
        }, {
            headers: {
                'Authorization': `Bearer ${openRouterApiKey}`,
                'Content-Type': 'application/json'
                // Outros headers opcionais
            }
        });

        // 5. Extrair a resposta da IA (mantida)
        const aiResponse = response.data?.choices?.[0]?.message?.content?.trim();
        if (!aiResponse) {
            console.error("Resposta inesperada da API OpenRouter:", response.data);
            throw new Error("Não foi possível obter uma resposta válida da IA.");
        }

        // --- Opcional: Log de Auditoria da Análise (mantido) ---
        saveAuditLog(performingUserId, `AI_ANALYSIS_${action.toUpperCase()}`, 'Case', caseId, { promptLength: prompt.length, responseLength: aiResponse.length, evidenceIdsUsed: relevantEvidences.map(e => e._id) });

        // 6. Retornar a resposta para o frontend (mantida)
        res.status(200).json({ analysis: aiResponse });

    } catch (error) {
        console.error(`Erro ao analisar caso ${caseId} com IA (Ação: ${action}):`, error.response?.data || error.message);

        // --- Log de Falha (AGORA PODE ACESSAR inputText) ---
        // A variável inputText existe aqui (pode ser string vazia ou parcialmente/totalmente construída)
        saveAuditLog(performingUserId, `AI_ANALYSIS_${action.toUpperCase()}_FAILED`, 'Case', caseId, { error: error.message, inputLength: inputText?.length || 0 });

        res.status(500).json({
            error: "Erro ao processar análise com IA.",
            details: error.response?.data?.error?.message || error.message
        });
    }
};

exports.addToTeam = async (req, res) => {
    const { caseId, userId } = req.params;
    const performingUserId = req.userId;

    try {
        // Validações básicas
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "ID de usuário inválido" });
        }

        const caso = await Case.findById(caseId);
        const userToAdd = await User.findById(userId);
        const performingUser = await User.findById(performingUserId);

        // Verifica existência
        if (!caso || !userToAdd || !performingUser) {
            return res.status(404).json({ error: "Recurso não encontrado" });
        }

        // Autorização: Só admin ou perito responsável
        const isAdmin = performingUser.role === 'admin';
        const isResponsible = caso.responsibleExpert.toString() === performingUserId;

        if (!isAdmin && !isResponsible) {
            return res.status(403).json({ error: "Acesso não autorizado" });
        }

        // Verifica se o usuário é assistente ou perito
        if (!['assistente', 'perito'].includes(userToAdd.role)) {
            return res.status(400).json({ error: "Usuário deve ser assistente ou perito" });
        }

        // Evita duplicatas
        if (caso.team.includes(userId)) {
            return res.status(400).json({ error: "Usuário já está no team" });
        }

        // Adiciona ao team e atualiza casos do usuário
        caso.team.push(userId);
        await caso.save();

        await User.findByIdAndUpdate(userId, {
            $addToSet: { cases: caso._id }
        });

        const updatedCase = await Case.findById(caseId) // Busca o caso novamente pelo ID
            .populate('responsibleExpert', 'name role') // Popula o responsável
            .populate('team', 'name role');             // Popula a equipe

        // Log de Auditoria (EXEMPLO)
        saveAuditLog(performingUserId, 'ADD_TEAM_MEMBER', 'Case', caso._id, { addedUserId: userId, addedUserName: userToAdd.name, caseName: caso.nameCase });

        res.status(200).json({ message: `Usuário ${userToAdd.name} adicionado à equipe com sucesso.`, case: updatedCase });
    } catch (error) {
        console.error("Erro ao adicionar ao team:", error);
        saveAuditLog(performingUserId, 'ADD_TEAM_MEMBER_FAILED', 'Case', caso._id, { error: error.message });
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};

exports.removeTeamMemberFromCase = async (req, res) => {
    const { caseId, userId } = req.params;
    const performingUserId = req.userId; // Do token JWT

    try {
        // Validações básicas dos IDs
        if (!mongoose.Types.ObjectId.isValid(caseId)) {
            return res.status(400).json({ error: "ID de caso inválido" });
        }
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: "ID de usuário a ser removido é inválido" });
        }
        if (!mongoose.Types.ObjectId.isValid(performingUserId)) {
            return res.status(401).json({ error: "ID do usuário performante inválido." });
        }

        const caso = await Case.findById(caseId);
        const userToRemoveInfo = await User.findById(userId).select('name'); // Para log ou mensagem

        // Verifica existência do caso
        if (!caso) {
            return res.status(404).json({ error: "Caso não encontrado" });
        }
        // O userToRemoveInfo pode ser null se o ID for válido mas o usuário não existir mais.
        // A lógica de remoção da equipe ainda pode prosseguir.

        // Autorização: Só admin ou perito responsável pelo caso
        const isAdmin = req.userRole === 'admin';
        const isResponsible = caso.responsibleExpert && (caso.responsibleExpert.toString() === performingUserId.toString());

        if (!isAdmin && !isResponsible) {
            return res.status(403).json({ error: "Acesso não autorizado. Apenas ADM ou o Perito Responsável podem remover membros." });
        }

        // Verifica se o usuário a ser removido está realmente na equipe
        const initialTeamLength = caso.team.length;
        caso.team = caso.team.filter(memberId => memberId.toString() !== userId.toString());

        if (caso.team.length === initialTeamLength) {
            return res.status(404).json({ error: "Usuário não encontrado na equipe deste caso." });
        }

        // Remove a referência do caso do array 'cases' do usuário removido
        // Isso é importante para manter a consistência nos dados do usuário
        await User.findByIdAndUpdate(userId, {
            $pull: { cases: caso._id }
        });

        await caso.save(); // Salva o caso com a equipe atualizada

        // Retorna o caso atualizado e populado para o frontend
        const updatedCase = await Case.findById(caseId)
            .populate('responsibleExpert', 'name role')
            .populate('team', 'name role');

        // Log de Auditoria (EXEMPLO)
        const removedUserName = userToRemoveInfo ? userToRemoveInfo.name : userId;
        saveAuditLog(performingUserId, 'REMOVE_TEAM_MEMBER', 'Case', caso._id, { removedUserId: userId, removedUserName: removedUserName, caseName: caso.nameCase });

        res.status(200).json({ message: `Usuário ${userToRemoveInfo ? userToRemoveInfo.name : 'ID ' + userId} removido da equipe com sucesso.`, case: updatedCase });

    } catch (error) {
        console.error("Erro ao remover membro da equipe:", error);
        // Log de Auditoria de Falha (EXEMPLO)
        saveAuditLog(performingUserId, 'REMOVE_TEAM_MEMBER_FAILED', 'Case', caseId, { error: error.message });
        res.status(500).json({ error: "Erro interno do servidor ao remover membro da equipe." });
    }
};