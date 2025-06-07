// controllers/odontogramController.js
const mongoose = require('mongoose');
const Odontogram = require('../models/odontogram');
const Victim = require('../models/victim');
const Case = require('../models/case');
const User = require('../models/user');
const AuditLog = require('../models/auditlog'); // Importa o MODELO AuditLog

// --- FUNÇÃO AUXILIAR PARA SALVAR LOGS DE AUDITORIA (definida localmente) ---
const saveAuditLog = (userId, action, targetModel, targetId, details = {}) => {
    try {
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            console.warn(`AUDIT_LOG_SKIP (OdontogramCtrl): UserID inválido ou ausente para ação '${action}' em '${targetModel}:${targetId}'. UserID: ${userId}`);
            return;
        }
        if (!targetId) {
            console.warn(`AUDIT_LOG_SKIP (OdontogramCtrl): TargetID ausente para ação '${action}' em '${targetModel}' por User '${userId}'.`);
            return;
        }
        if (!action || !targetModel) {
            console.warn(`AUDIT_LOG_SKIP (OdontogramCtrl): Ação ou TargetModel ausente.`);
            return;
        }

        const logEntry = new AuditLog({ // Usa o MODELO AuditLog importado
            userId,
            action,
            targetModel,
            targetId: String(targetId),
            details,
            timestamp: new Date()
        });

        logEntry.save().catch(err => {
            console.error(`AUDIT_LOG_ERROR (OdontogramCtrl): Falha ao salvar log: Action: ${action}, User: ${userId}, Target: ${targetId}`, err.message);
        });

    } catch (error) {
        console.error('AUDIT_LOG_UNEXPECTED_ERROR (OdontogramCtrl): Erro inesperado na função saveAuditLog:', error.message);
    }
};
// --- FIM DA FUNÇÃO AUXILIAR ---


// --- FUNÇÃO AUXILIAR DE PERMISSÃO ---
async function checkOdontogramPermission(victimId, performingUserId, performingUserRole, action = 'view') {
    if (!victimId || !mongoose.Types.ObjectId.isValid(victimId)) {
        return { authorized: false, message: "ID de vítima inválido.", status: 400 };
    }
    if (!performingUserId || !mongoose.Types.ObjectId.isValid(performingUserId)) {
        return { authorized: false, message: "ID de usuário performante inválido.", status: 401 };
    }

    const victim = await Victim.findById(victimId).select('case');
    if (!victim) {
        return { authorized: false, message: "Vítima não encontrada.", status: 404 };
    }

    // É crucial que victim.case seja um ObjectId válido aqui. Se não for, o findById falhará.
    if (!victim.case || !mongoose.Types.ObjectId.isValid(victim.case)) {
        return { authorized: false, message: "Vítima não está associada a um caso válido.", status: 500 };
    }

    const caso = await Case.findById(victim.case).select('responsibleExpert team');
    if (!caso) {
        return { authorized: false, message: "Caso associado à vítima não encontrado.", status: 404 };
    }

    const isAdmin = performingUserRole === 'admin';
    const isResponsibleExpert = caso.responsibleExpert && caso.responsibleExpert.toString() === performingUserId.toString();
    const isTeamMember = caso.team && caso.team.some(memberId => memberId && memberId.toString() === performingUserId.toString());

    if (action === 'view' && (isAdmin || isResponsibleExpert || isTeamMember)) {
        return { authorized: true, victim, case: caso };
    }

    if (['create', 'edit', 'delete'].includes(action)) {
        if (isAdmin || isResponsibleExpert) {
            return { authorized: true, victim, case: caso };
        }
        if (isTeamMember) {
            const performingUser = await User.findById(performingUserId).select('role');
            if (performingUser && performingUser.role === 'perito') {
                return { authorized: true, victim, case: caso };
            }
        }
    }
    return { authorized: false, message: "Acesso negado. Você não tem permissão para esta ação no odontograma.", status: 403 };
}

// --- CRIAR UM NOVO ODONTOGRAMA ---
exports.createOdontogram = async (req, res) => {
    const performingUserId = req.userId;
    const performingUserRole = req.userRole;
    const {
        victim: victimId,
        odontogramType,
        examinationDate,
        teeth,
        generalObservations,
        summaryForIdentification,
        anteMortemDataSources,
        pointsOfCorrespondence,
        discrepancies,
        identificationConclusion,
        odontogramImageUrl, // Adicionado
        odontogramImageNotes // Adicionado
    } = req.body;

    let newOdontogramDoc = null; // Renomeado para evitar conflito com o modelo Odontogram
    let casoIdForLog = null;

    try {
        if (!victimId || !mongoose.Types.ObjectId.isValid(victimId)) {
            return res.status(400).json({ error: "ID de vítima inválido ou ausente." });
        }
        if (!odontogramType) {
            return res.status(400).json({ error: "Tipo de odontograma é obrigatório." });
        }
        if (!Array.isArray(teeth)) { // Validação básica, pode ser mais detalhada
            return res.status(400).json({ error: "Dados dos dentes (teeth) devem ser um array." });
        }

        const permCheck = await checkOdontogramPermission(victimId, performingUserId, performingUserRole, 'create');
        if (!permCheck.authorized) {
            return res.status(permCheck.status).json({ error: permCheck.message });
        }
        const { victim, case: casoDocument } = permCheck; // case é uma palavra reservada
        casoIdForLog = casoDocument._id;

        if (odontogramType === 'post_mortem') {
            const existingPostMortem = await Odontogram.findOne({ victim: victimId, odontogramType: 'post_mortem' });
            if (existingPostMortem) {
                return res.status(400).json({ error: "Já existe um odontograma post-mortem registrado para esta vítima. Considere editá-lo." });
            }
        }

        const odontogramData = {
            victim: victimId,
            case: casoDocument._id,
            odontogramType,
            examinationDate: examinationDate || Date.now(),
            examiner: performingUserId,
            teeth,
            generalObservations,
            summaryForIdentification,
            anteMortemDataSources,
            pointsOfCorrespondence,
            discrepancies,
            identificationConclusion,
            odontogramImageUrl,
            odontogramImageNotes,
            createdBy: performingUserId
        };

        Object.keys(odontogramData).forEach(key => odontogramData[key] === undefined && delete odontogramData[key]);

        const odontogramInstance = new Odontogram(odontogramData); // Renomeado para odontogramInstance
        newOdontogramDoc = await odontogramInstance.save();

        saveAuditLog(performingUserId, 'CREATE_ODONTOGRAM', 'Odontogram', newOdontogramDoc._id, { victimId, caseId: casoIdForLog, type: odontogramType });

        const populatedOdontogram = await Odontogram.findById(newOdontogramDoc._id)
            .populate('victim', 'name victimCode')
            .populate('case', 'nameCase')
            .populate('examiner', 'name');

        res.status(201).json({ message: "Odontograma criado com sucesso!", odontogram: populatedOdontogram });

    } catch (error) {
        console.error("Erro ao criar odontograma:", error);
        saveAuditLog(performingUserId, 'CREATE_ODONTOGRAM_FAILED', 'Odontogram', newOdontogramDoc?._id || victimId, {
            error: error.message,
            input: req.body, // Cuidado com dados sensíveis
            caseIdAttempt: casoIdForLog
        });
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: "Erro de validação", details: error.message });
        }
        if (error.code === 11000) {
            return res.status(400).json({ error: "Erro de duplicidade. Verifique se um odontograma deste tipo já existe para a vítima." });
        }
        res.status(500).json({ error: "Erro interno do servidor ao criar odontograma." });
    }
};

// --- OBTER ODONTOGRAMA(S) DE UMA VÍTIMA ---
exports.getOdontogramsByVictim = async (req, res) => {
    const { victimId } = req.params;

    try {
        const odontograms = await Odontogram.find({ victim: victimId })
            .populate('examiner', 'name role') // Adicionado role
            .populate('case', 'nameCase')
            .sort({ examinationDate: -1, createdAt: -1 });

        if (!odontograms || odontograms.length === 0) {
            return res.status(200).json({ message: "Nenhum odontograma encontrado para esta vítima.", odontograms: [] });
        }
        res.status(200).json(odontograms);
    } catch (error) {
        console.error("Erro ao obter odontogramas por vítima:", error);
        res.status(500).json({ error: "Erro interno do servidor ao obter odontogramas." });
    }
};

// --- OBTER UM ODONTOGRAMA ESPECÍFICO PELO SEU ID ---
exports.getOdontogramById = async (req, res) => {
    const { odontogramId } = req.params;

    try {
        if (!mongoose.Types.ObjectId.isValid(odontogramId)) {
            return res.status(400).json({ error: "ID de odontograma inválido." });
        }

        const odontogram = await Odontogram.findById(odontogramId)
            .populate('victim', 'name victimCode case') // Inclui case no populate da vítima
            .populate('case', 'nameCase') // Popula o caso diretamente do odontograma também
            .populate('examiner', 'name role')
            .populate('createdBy', 'name')
            .populate('lastUpdatedBy', 'name');

        if (!odontogram) {
            return res.status(404).json({ error: "Odontograma não encontrado." });
        }
        if (!odontogram.victim || !odontogram.victim._id) { // Checagem adicional
            return res.status(404).json({ error: "Odontograma encontrado, mas vítima associada não existe ou está corrompida." });
        }

        res.status(200).json(odontogram);
    } catch (error) {
        console.error("Erro ao obter odontograma por ID:", error);
        res.status(500).json({ error: "Erro interno do servidor ao obter odontograma." });
    }
};

// --- ATUALIZAR UM ODONTOGRAMA ---
exports.updateOdontogram = async (req, res) => {
    const { odontogramId } = req.params;
    const updateData = req.body;
    const performingUserId = req.userId;
    const performingUserRole = req.userRole;

    try {
        if (!mongoose.Types.ObjectId.isValid(odontogramId)) {
            return res.status(400).json({ error: "ID de odontograma inválido." });
        }

        delete updateData.victim; delete updateData.case; delete updateData.examiner;
        delete updateData.createdBy; delete updateData.createdAt;
        updateData.lastUpdatedBy = performingUserId;

        const odontogramToUpdate = await Odontogram.findById(odontogramId).select('victim');
        if (!odontogramToUpdate) {
            return res.status(404).json({ error: "Odontograma não encontrado para atualização." });
        }
        if (!odontogramToUpdate.victim) {
            return res.status(404).json({ error: "Odontograma não possui vítima associada para verificação de permissão." });
        }

        const permCheck = await checkOdontogramPermission(odontogramToUpdate.victim, performingUserId, performingUserRole, 'edit');
        if (!permCheck.authorized) {
            return res.status(permCheck.status).json({ error: permCheck.message });
        }

        if (updateData.teeth && !Array.isArray(updateData.teeth)) {
            return res.status(400).json({ error: "Dados dos dentes (teeth) devem ser um array." });
        }
        // Se odontogramType estiver sendo atualizado e o novo tipo for post_mortem,
        // verificar se já existe um para a vítima (a menos que seja este mesmo odontograma)
        if (updateData.odontogramType === 'post_mortem' && odontogramToUpdate.odontogramType !== 'post_mortem') {
            const existingPostMortem = await Odontogram.findOne({
                victim: odontogramToUpdate.victim,
                odontogramType: 'post_mortem',
                _id: { $ne: odontogramId } // Exclui o odontograma atual da verificação
            });
            if (existingPostMortem) {
                return res.status(400).json({ error: "Já existe outro odontograma post-mortem para esta vítima." });
            }
        }


        const updatedOdontogram = await Odontogram.findByIdAndUpdate(
            odontogramId,
            { $set: updateData },
            { new: true, runValidators: true }
        )
            .populate('victim', 'name victimCode')
            .populate('case', 'nameCase')
            .populate('examiner', 'name role')
            .populate('lastUpdatedBy', 'name');

        saveAuditLog(performingUserId, 'UPDATE_ODONTOGRAM', 'Odontogram', updatedOdontogram._id, { victimId: updatedOdontogram.victim._id, changes: Object.keys(updateData) });

        res.status(200).json({ message: "Odontograma atualizado com sucesso!", odontogram: updatedOdontogram });

    } catch (error) {
        console.error("Erro ao atualizar odontograma:", error);
        saveAuditLog(performingUserId, 'UPDATE_ODONTOGRAM_FAILED', 'Odontogram', odontogramId, { error: error.message, input: Object.keys(updateData) });
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: "Erro de validação", details: error.message });
        }
        res.status(500).json({ error: "Erro interno do servidor ao atualizar odontograma." });
    }
};

// --- DELETAR UM ODONTOGRAMA ---
exports.deleteOdontogram = async (req, res) => {
    const { odontogramId } = req.params;
    const performingUserId = req.userId;
    const performingUserRole = req.userRole;

    try {
        if (!mongoose.Types.ObjectId.isValid(odontogramId)) {
            return res.status(400).json({ error: "ID de odontograma inválido." });
        }

        const odontogramToDelete = await Odontogram.findById(odontogramId).select('victim case');
        if (!odontogramToDelete) {
            return res.status(404).json({ error: "Odontograma não encontrado para exclusão." });
        }
        if (!odontogramToDelete.victim) {
            return res.status(404).json({ error: "Odontograma não possui vítima associada para verificação de permissão." });
        }

        const permCheck = await checkOdontogramPermission(odontogramToDelete.victim, performingUserId, performingUserRole, 'delete');
        if (!permCheck.authorized) {
            return res.status(permCheck.status).json({ error: permCheck.message });
        }

        // O hook post('findOneAndDelete') no modelo Odontogram cuidará de limpar a referência na Vítima
        const deletedOdontogram = await Odontogram.findByIdAndDelete(odontogramId);

        saveAuditLog(performingUserId, 'DELETE_ODONTOGRAM', 'Odontogram', deletedOdontogram._id, { victimId: deletedOdontogram.victim, caseId: deletedOdontogram.case, type: deletedOdontogram.odontogramType });

        res.status(200).json({ message: "Odontograma excluído com sucesso." });

    } catch (error) {
        console.error("Erro ao deletar odontograma:", error);
        saveAuditLog(performingUserId, 'DELETE_ODONTOGRAM_FAILED', 'Odontogram', odontogramId, { error: error.message });
        res.status(500).json({ error: "Erro interno do servidor ao deletar odontograma." });
    }
};