// controllers/victimController.js

const mongoose = require('mongoose');
const Victim = require('../models/victim'); // Ajuste o caminho se necessário
const Case = require('../models/case');     // Ajuste o caminho se necessário
const User = require('../models/user');     // Ajuste o caminho se necessário
const AuditLog = require('../models/auditlog'); // Se você usar logs de auditoria

// Função auxiliar para logs (se você tiver uma centralizada)
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

// --- CRIAR UMA NOVA VÍTIMA ---
exports.createVictim = async (req, res) => {
    const performingUserId = req.userId; // ID do usuário logado (do token JWT)
    const performingUserRole = req.userRole; // Role do usuário logado

    // O caseId pode vir do corpo da requisição ou, se a rota for aninhada como /api/cases/:caseId/victims,
    // viria de req.params.caseId. Vamos assumir que virá do corpo por enquanto.
    const {
        case: caseId, // Renomeando para caseId para clareza na desestruturação
        victimCode,
        identificationStatus,
        name,
        ageAtDeath,
        estimatedAgeRange, // { min, max }
        gender,
        ethnicityRace,
        statureCm,
        bodyMassIndexCategory,
        contact, // { telephone, email }
        lastKnownAddress, // { street, number, ... }
        dateOfDeath,
        timeOfDeath,
        dateOfDiscovery,
        timeOfDayDiscovery,
        discoveryLocation, // { description, type, municipality, state, coordinates: { type: 'Point', coordinates: [lon, lat] }}
        mannerOfDeath,
        causeOfDeathPrimary,
        dentalRecordStatus,
        dentalRecordSource,
        // odontogramPostMortem, // Será adicionado/linkado em outra operação
        skeletalFeatures,
        otherDistinctivePhysicalFeatures,
        postMortemIntervalEstimate, // { minHours, maxHours, estimationMethod }
        toxicologyScreening, // { performed, resultsSummary, substancesDetected: [{ name, quantity, type }] }
        dnaAnalysis, // { sampleCollected, profileObtained, comparisonResult }
        fingerprintAnalysis, // { collected, quality, comparisonResult }
        photosUrls,
        additionalNotes
    } = req.body;

    let newVictim = null; // Para log de falha

    try {
        // 1. Validações Essenciais
        if (!caseId || !mongoose.Types.ObjectId.isValid(caseId)) {
            return res.status(400).json({ error: "ID do caso associado é inválido ou ausente." });
        }
        if (!victimCode || victimCode.trim() === '') {
            return res.status(400).json({ error: "Código da vítima é obrigatório." });
        }
        if (!identificationStatus) {
            return res.status(400).json({ error: "Status de identificação é obrigatório." });
        }

        // Validação de nome se identificada
        if ((identificationStatus === 'identificada' || identificationStatus === 'parcialmente_identificada') && (!name || name.trim() === '')) {
            return res.status(400).json({ error: "Nome é obrigatório para vítimas identificadas ou parcialmente identificadas." });
        }

        // 2. Verificar se o Caso existe
        const existingCase = await Case.findById(caseId);
        if (!existingCase) {
            return res.status(404).json({ error: `Caso com ID '${caseId}' não encontrado.` });
        }

        // 3. Autorização: Quem pode adicionar uma vítima a um caso?
        // Exemplo: ADM, Perito Responsável pelo caso, ou Membro da Equipe do caso.
        // (Esta lógica pode estar em um middleware como `checkTeamAccess` ou ser replicada/adaptada aqui)
        const isAdmin = performingUserRole === 'admin';
        const isResponsibleExpert = existingCase.responsibleExpert && existingCase.responsibleExpert.toString() === performingUserId.toString();
        const isTeamMember = existingCase.team && existingCase.team.map(memberId => memberId.toString()).includes(performingUserId.toString());

        if (!(isAdmin || isResponsibleExpert || isTeamMember)) {
            return res.status(403).json({ error: "Acesso negado. Você não tem permissão para adicionar vítimas a este caso." });
        }

        // 4. Verificar se já existe uma vítima com o mesmo victimCode NESTE caso (se o código não for globalmente único)
        // Se victimCode for globalmente único, o índice do Mongoose cuidará disso, mas uma checagem prévia é boa.
        // Se for único por caso:
        const existingVictimWithCodeInCase = await Victim.findOne({ case: caseId, victimCode: victimCode });
        if (existingVictimWithCodeInCase) {
            return res.status(400).json({ error: `Já existe uma vítima com o código '${victimCode}' neste caso.` });
        }
        // Se victimCode for globalmente único e tiver índice unique: true, o save() falhará se duplicado.

        // 5. Preparar os dados da Vítima
        const victimData = {
            case: caseId,
            victimCode,
            identificationStatus,
            name: (identificationStatus === 'identificada' || identificationStatus === 'parcialmente_identificada') ? name : (identificationStatus === 'nao_identificada' ? 'Desconhecida' : name), // Garante o default se não fornecido e não identificada
            ageAtDeath,
            estimatedAgeRange,
            gender,
            ethnicityRace,
            statureCm,
            bodyMassIndexCategory,
            contact,
            lastKnownAddress,
            dateOfDeath,
            timeOfDeath,
            dateOfDiscovery,
            timeOfDayDiscovery,
            discoveryLocation,
            mannerOfDeath,
            causeOfDeathPrimary,
            dentalRecordStatus,
            dentalRecordSource,
            skeletalFeatures,
            otherDistinctivePhysicalFeatures,
            postMortemIntervalEstimate,
            toxicologyScreening,
            dnaAnalysis,
            fingerprintAnalysis,
            photosUrls,
            additionalNotes,
            createdBy: performingUserId
        };

        // Remover campos undefined para que os defaults do schema funcionem corretamente
        Object.keys(victimData).forEach(key => victimData[key] === undefined && delete victimData[key]);


        // 6. Criar e Salvar a Vítima
        const victim = new Victim(victimData);
        newVictim = await victim.save(); // O hook post('save') no modelo Victim cuidará de adicionar a vítima ao caso

        // Log de Auditoria
        saveAuditLog(performingUserId, 'CREATE_VICTIM', 'Victim', newVictim._id, { victimCode: newVictim.victimCode, caseId: newVictim.case });

        // 7. Responder com a vítima criada (populada, se necessário)
        // Para a resposta, podemos popular o campo 'case' se for útil para o frontend
        const populatedVictim = await Victim.findById(newVictim._id)
            .populate('case', 'nameCase') // Popula o nome do caso, por exemplo
            .populate('createdBy', 'name'); // Popula o nome de quem criou

        res.status(201).json({ message: "Vítima registrada com sucesso!", victim: populatedVictim });

    } catch (error) {
        console.error("Erro ao criar vítima:", error);
        // Log de Auditoria de Falha
        const details = { error: error.message, input: req.body };
        if (newVictim) details.attemptedVictimId = newVictim._id;
        saveAuditLog(performingUserId, 'CREATE_VICTIM_FAILED', 'Victim', newVictim?._id || victimCode || 'unknown', details);

        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: "Erro de validação", details: error.message });
        }
        // Se o erro for de 'unique' index violation para victimCode (se globalmente único)
        if (error.code === 11000 && error.keyPattern && error.keyPattern.victimCode) {
            return res.status(400).json({ error: `Código de vítima '${victimCode}' já existe no sistema.` });
        }
        res.status(500).json({ error: "Erro interno do servidor ao registrar a vítima." });
    }
};

// --- LISTAR TODAS AS VÍTIMAS (com paginação opcional) ---
exports.getVictims = async (req, res) => {
    const performingUserId = req.userId;
    const performingUserRole = req.userRole;

    // Autorização: Exemplo - Apenas ADM pode ver todas as vítimas de todos os casos
    if (performingUserRole !== 'admin') {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores podem listar todas as vítimas." });
    }

    try {
        const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;
        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { [sortBy]: order === 'asc' ? 1 : -1 },
            populate: [
                { path: 'case', select: 'nameCase victimCode' }, // Adicionar victimCode do caso se houver
                { path: 'createdBy', select: 'name' }
            ]
        };

        // Victim.paginate é um método do mongoose-paginate-v2 (se você o usa)
        // Se não, use find(), skip(), limit()
        // const result = await Victim.paginate({}, options);
        // res.status(200).json(result);

        // Sem mongoose-paginate-v2:
        const victims = await Victim.find({})
            .populate('case', 'nameCase') // Popula com o nome do caso
            .populate('createdBy', 'name')   // Popula com o nome de quem criou
            .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
            .skip((options.page - 1) * options.limit)
            .limit(options.limit);

        const totalVictims = await Victim.countDocuments({});

        res.status(200).json({
            victims,
            totalPages: Math.ceil(totalVictims / options.limit),
            currentPage: options.page,
            totalVictims
        });

    } catch (error) {
        console.error("Erro ao listar vítimas:", error);
        res.status(500).json({ error: "Erro interno do servidor ao listar vítimas." });
    }
};

// --- OBTER UMA VÍTIMA ESPECÍFICA PELO ID ---
exports.getVictimById = async (req, res) => {
    const { victimId } = req.params;
    const performingUserId = req.userId;
    const performingUserRole = req.userRole;

    try {
        if (!mongoose.Types.ObjectId.isValid(victimId)) {
            return res.status(400).json({ error: "ID de vítima inválido." });
        }

        const victim = await Victim.findById(victimId)
            .populate('case', 'nameCase responsibleExpert team') // Popula dados do caso para checagem de permissão
            .populate('createdBy', 'name')
            .populate('lastUpdatedBy', 'name')

        if (!victim) {
            return res.status(404).json({ error: "Vítima não encontrada." });
        }

        // Autorização para ver detalhes da vítima:
        // ADM, Perito Responsável pelo caso da vítima, ou Membro da Equipe do caso da vítima

        // Remove a população completa do caso se não for necessário na resposta final,
        // ou re-popule apenas com os campos desejados.
        // Para este exemplo, retornamos a vítima como foi populada.
        res.status(200).json(victim);

    } catch (error) {
        console.error("Erro ao obter vítima por ID:", error);
        res.status(500).json({ error: "Erro interno do servidor ao obter vítima." });
    }
};

// --- ATUALIZAR UMA VÍTIMA ---
exports.updateVictim = async (req, res) => {
    const { victimId } = req.params;
    const updateData = req.body;
    const performingUserId = req.userId;
    const performingUserRole = req.userRole;

    try {
        if (!mongoose.Types.ObjectId.isValid(victimId)) {
            return res.status(400).json({ error: "ID de vítima inválido." });
        }

        // Não permitir alteração do 'case' ou 'victimCode' por esta rota (geralmente)
        delete updateData.case;
        delete updateData.victimCode;
        delete updateData.createdBy; // Não pode ser alterado
        delete updateData.createdAt; // Não pode ser alterado

        // Adicionar quem atualizou
        updateData.lastUpdatedBy = performingUserId;
        // updatedAt será atualizado pelo hook pre('save') ou pelo timestamps:true

        const victimToUpdate = await Victim.findById(victimId).populate('case', 'responsibleExpert team');
        if (!victimToUpdate) {
            return res.status(404).json({ error: "Vítima não encontrada para atualização." });
        }

        // Autorização para atualizar (similar a getVictimById)
        const isAdmin = performingUserRole === 'admin';
        let hasCaseAccess = false;
        if (victimToUpdate.case) {
            const caseData = victimToUpdate.case;
            const isResponsibleExpert = caseData.responsibleExpert && caseData.responsibleExpert.toString() === performingUserId.toString();
            const isTeamMember = caseData.team && caseData.team.map(memberId => memberId.toString()).includes(performingUserId.toString());
            if (isResponsibleExpert || isTeamMember) {
                hasCaseAccess = true;
            }
        }

        if (!(isAdmin || hasCaseAccess)) {
            return res.status(403).json({ error: "Acesso negado. Você não tem permissão para atualizar esta vítima." });
        }

        // Validação de nome se o status for 'identificada' e o nome estiver sendo alterado para vazio
        if (updateData.identificationStatus === 'identificada' || (victimToUpdate.identificationStatus === 'identificada' && updateData.identificationStatus === undefined)) {
            if (updateData.name !== undefined && (updateData.name === null || updateData.name.trim() === '')) {
                 return res.status(400).json({ error: "Nome é obrigatório para vítimas identificadas." });
            }
        }


        const updatedVictim = await Victim.findByIdAndUpdate(
            victimId,
            { $set: updateData },
            { new: true, runValidators: true } // Retorna o documento atualizado e roda validadores do schema
        ).populate('case', 'nameCase').populate('createdBy', 'name').populate('lastUpdatedBy', 'name');

        saveAuditLog(performingUserId, 'UPDATE_VICTIM', 'Victim', updatedVictim._id, { changes: updateData, victimCode: updatedVictim.victimCode });

        res.status(200).json({ message: "Vítima atualizada com sucesso!", victim: updatedVictim });

    } catch (error) {
        console.error("Erro ao atualizar vítima:", error);
        saveAuditLog(performingUserId, 'UPDATE_VICTIM_FAILED', 'Victim', victimId, { error: error.message, input: updateData });
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: "Erro de validação", details: error.message });
        }
        res.status(500).json({ error: "Erro interno do servidor ao atualizar vítima." });
    }
};

// --- DELETAR UMA VÍTIMA ---
exports.deleteVictim = async (req, res) => {
    const { victimId } = req.params;
    const performingUserId = req.userId;
    const performingUserRole = req.userRole;

    try {
        if (!mongoose.Types.ObjectId.isValid(victimId)) {
            return res.status(400).json({ error: "ID de vítima inválido." });
        }

        const victimToDelete = await Victim.findById(victimId).populate('case', 'responsibleExpert team');
        if (!victimToDelete) {
            return res.status(404).json({ error: "Vítima não encontrada para exclusão." });
        }

        // Autorização para deletar (similar a getVictimById/updateVictim)
        // Geralmente mais restrito, ex: só ADM ou Perito Responsável pelo caso.
        const isAdmin = performingUserRole === 'admin';
        let isResponsibleExpertForCase = false;
        if (victimToDelete.case && victimToDelete.case.responsibleExpert) {
             isResponsibleExpertForCase = victimToDelete.case.responsibleExpert.toString() === performingUserId.toString();
        }

        if (!(isAdmin || isResponsibleExpertForCase)) {
            return res.status(403).json({ error: "Acesso negado. Apenas ADM ou o Perito Responsável pelo caso podem excluir vítimas." });
        }

        // A remoção do ID da vítima do array 'victims' do caso será tratada pelo hook post('findOneAndDelete') no modelo Victim.
        const deletedVictim = await Victim.findByIdAndDelete(victimId);

        saveAuditLog(performingUserId, 'DELETE_VICTIM', 'Victim', deletedVictim._id, { victimCode: deletedVictim.victimCode, caseId: deletedVictim.case });

        res.status(200).json({ message: `Vítima '${deletedVictim.name || deletedVictim.victimCode}' excluída com sucesso.` });

    } catch (error) {
        console.error("Erro ao deletar vítima:", error);
        saveAuditLog(performingUserId, 'DELETE_VICTIM_FAILED', 'Victim', victimId, { error: error.message });
        res.status(500).json({ error: "Erro interno do servidor ao deletar vítima." });
    }
};

// --- LISTAR VÍTIMAS DE UM CASO ESPECÍFICO ---
exports.getVictimsByCase = async (req, res) => {
    const { caseId } = req.params; // caseId vem dos parâmetros da rota
    const performingUserId = req.userId;
    const performingUserRole = req.userRole;

    try {
        if (!mongoose.Types.ObjectId.isValid(caseId)) {
            return res.status(400).json({ error: "ID de caso inválido." });
        }

        const caso = await Case.findById(caseId).select('responsibleExpert team'); // Apenas para permissão
        if (!caso) {
            return res.status(404).json({ error: "Caso não encontrado." });
        }

        // Autorização para ver vítimas deste caso (ADM, Responsável pelo caso, Membro da equipe do caso)

        // Busca as vítimas do caso especificado
        const victims = await Victim.find({ case: caseId })
            .populate('createdBy', 'name')
            .populate('lastUpdatedBy', 'name')
            // .populate('odontogramPostMortem'); // Se relevante
            .sort({ createdAt: 'desc' }); // Ou por victimCode, etc.

        if (victims.length === 0) {
            return res.status(200).json({ message: "Nenhuma vítima encontrada para este caso.", victims: [] });
        }

        res.status(200).json(victims);

    } catch (error) {
        console.error("Erro ao listar vítimas por caso:", error);
        res.status(500).json({ error: "Erro interno do servidor ao listar vítimas do caso." });
    }
};