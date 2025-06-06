const mongoose = require('mongoose');
const Evidence = require('../models/evidence');
const Case = require('../models/case');
const AuditLog = require('../models/auditlog');

const saveAuditLog = (userId, action, targetModel, targetId, details) => {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) { // Verifica se userId é válido
        console.warn(`Tentativa de salvar log sem userId válido para ação ${action} em ${targetModel}:${targetId}`);
        return; // Não loga se não houver userId válido
    }
    if (!targetId) {
         console.warn(`Tentativa de salvar log sem targetId para ação ${action} em ${targetModel} por ${userId}`);
         return; // Não loga sem um alvo
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

// Criação de Evidência
exports.createEvidence = async (req, res) => {
    let newEvidence = null; // Para acesso no catch
    const performingUserId = req.userId; // Usuário que está criando a evidência

    try {
        const { caseId } = req.params;
        const { evidenceType, title, description, data, category, location } = req.body;

        if (location) {
            if (!location.type || location.type !== 'Point' || !location.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
                return res.status(400).json({ error: "Formato de localização inválido. Deve ser um objeto com 'type: Point' e 'coordinates: [longitude, latitude]'." });
            }
        }

        // Validação do CaseId
        if (!caseId || !mongoose.Types.ObjectId.isValid(caseId)) {
            return res.status(400).json({ msg: "ID de caso inválido ou ausente." });
        }
        // Valida outros campos obrigatórios
        if (!evidenceType || !title || !data) {
            return res.status(400).json({ msg: "Campos obrigatórios ausentes: evidenceType, title, data" });
        }
        // Valida se o caso existe (importante!)
        const caso = await Case.findById(caseId);
        if (!caso) return res.status(404).json({ error: "Caso associado não encontrado." });


        const evidenceInstance = new Evidence({
            caseId, evidenceType, title, description, data, category, location,
            collectedBy: performingUserId // ID do usuário logado
        });

        newEvidence = await evidenceInstance.save(); // Salva a evidência

        // Adiciona a referência da evidência ao array no documento Case
        await Case.findByIdAndUpdate(
            caseId,
            { $push: { evidences: newEvidence._id } }
        );

        const populatedEvidence = await Evidence.findById(newEvidence._id).populate('collectedBy', 'name');

        // --- LOG de Auditoria ---
        const logDetails = {
            evidenceTitle: newEvidence.title,
            evidenceType: newEvidence.evidenceType,
            caseId: newEvidence.caseId
        };
        if (newEvidence.evidenceType === 'image') {
            logDetails.data = '[Image Data (Base64 Skipped)]'; // Placeholder
        } else {
             logDetails.data = typeof data === 'string' && data.length > 200 ? data.substring(0, 200) + '...' : data;
        }
        saveAuditLog(performingUserId, 'CREATE_EVIDENCE', 'Evidence', newEvidence._id, logDetails);
        // --- Fim LOG ---

        res.status(201).json({ msg: "Evidência criada com sucesso!", evidence: populatedEvidence });
    } catch (error) {
        // --- LOG de Falha  ---
        const failureDetails = {
            error: error.message,
            caseId: caseId,
            evidenceType: evidenceType,
            evidenceTitle: title
       };
       saveAuditLog(performingUserId, 'CREATE_EVIDENCE_FAILED', 'Evidence', newEvidence?._id || title || 'unknown', failureDetails);
       res.status(500).json({ msg: "Erro ao criar evidência.", error: error.message });
}};

// Listar todas as evidências (GERAL - não por caso)
exports.getAllEvidences = async (req, res) => {
    // Leitura - Log opcional
    try {
        const evidences = await Evidence.find({})
            .populate('collectedBy', 'name');
        res.status(200).json({ msg: "Evidências encontradas com sucesso!", evidences: evidences });
        // saveAuditLog(req.userId, 'VIEW_ALL_EVIDENCE', 'Evidence', 'all'); // Exemplo
    } catch (error) {
        console.error("Erro ao buscar todas as evidências:", error);
        res.status(500).json({ msg: "Erro ao buscar evidências.", error: error.message });
    }
};

// Listar evidências por ID do Caso
exports.getEvidencesByCaseId = async (req, res) => {
     // Leitura - Log opcional
    try {
        const caseId = req.params.caseId;
        if (!mongoose.Types.ObjectId.isValid(caseId)) {
            return res.status(400).json({ msg: "ID de caso inválido." });
        }

        const evidences = await Evidence.find({ caseId: caseId })
            .populate('collectedBy', 'name');

        // Retorna 200 com array vazio se não encontrar, o frontend lida com isso
        // if (!evidences || evidences.length === 0) {
        //     return res.status(200).json({ msg: "Nenhuma evidência encontrada para o ID de caso fornecido.", evidences: [] });
        // }

        // saveAuditLog(req.userId, 'VIEW_CASE_EVIDENCE', 'Evidence', caseId); // Exemplo

        res.status(200).json({ msg: "Evidências do caso encontradas com sucesso!", evidences: evidences });

    } catch (error) {
        console.error("Erro ao buscar evidências por caseId:", error);
        res.status(500).json({ msg: "Erro ao buscar evidências do caso.", error: error.message });
    }
};

// Deletar uma evidência
exports.deleteEvidence = async (req, res) => {
    const evidenceId = req.params.id;
    const performingUserId = req.userId;
    let deletedEvidenceTitle = 'unknown';
    let associatedCaseId = null;

    try {
         // Validação do ID
         if (!mongoose.Types.ObjectId.isValid(evidenceId)) {
              return res.status(400).json({ msg: "ID de evidência inválido." });
         }

        // Encontra e deleta a evidência
        const evidence = await Evidence.findByIdAndDelete(evidenceId);
        if (!evidence) return res.status(404).json({ error: "Evidência não encontrada." });

        // Guarda dados para o log
        deletedEvidenceTitle = evidence.title;
        associatedCaseId = evidence.caseId;

        // Remove a referência da evidência do caso associado
        await Case.findByIdAndUpdate(
            associatedCaseId,
            { $pull: { evidences: evidence._id } }
        );

        // --- LOG de Auditoria ---
        saveAuditLog(performingUserId, 'DELETE_EVIDENCE', 'Evidence', evidence._id, { deletedEvidenceTitle: deletedEvidenceTitle, caseId: associatedCaseId });

        res.status(200).json({ message: "Evidência excluída com sucesso." });
        console.log(`Evidência "${deletedEvidenceTitle}" (_id: ${evidence._id}) excluída por Usuário ID: ${performingUserId} do Caso ID: ${associatedCaseId}`);

    } catch (error) {
        console.error("Erro ao excluir evidência:", error.message);
        // --- LOG de Falha ---
        saveAuditLog(performingUserId, 'DELETE_EVIDENCE_FAILED', 'Evidence', evidenceId, { error: error.message, caseId: associatedCaseId });
        res.status(500).json({ error: "Erro ao excluir evidência.", details: error.message });
    }
};

// Atualizar uma evidência
exports.updateEvidence = async (req, res) => {
    const evidenceId = req.params.id;
    const performingUserId = req.userId;

    try {
        // Validação do ID
        if (!mongoose.Types.ObjectId.isValid(evidenceId)) {
             return res.status(400).json({ msg: "ID de evidência inválido." });
        }

        // Opcional: Buscar dados antigos para log, e verificar existência
        // const oldEvidence = await Evidence.findById(evidenceId).lean();
        // if (!oldEvidence) return res.status(404).json({ error: "Evidência não encontrada." });

        // Atualiza a evidência com os dados do corpo da requisição
        const updatedEvidence = await Evidence.findByIdAndUpdate(
            evidenceId,
            { ...req.body, updatedAt: Date.now() }, // Inclui updatedAt
            { new: true, runValidators: true } // Retorna o novo doc e roda validadores
        )
        .populate('collectedBy', 'name'); // Popula o coletor na resposta

        // Verifica se a atualização retornou um documento (se o ID existia)
         if (!updatedEvidence) {
             return res.status(404).json({ error: "Evidência não encontrada para atualização." });
         }

        // --- LOG de Auditoria  ---
    //     const logDetails = {
    //         caseId: updatedEvidence.caseId,
    //         changes: { ...updateData } 
    //    };
    //    if (logDetails.changes.data && updatedEvidence.evidenceType === 'image' && typeof logDetails.changes.data === 'string' && logDetails.changes.data.startsWith('data:image')) {
    //         logDetails.changes.data = '[Image Data (Base64 Skipped)]';
    //    } else if (logDetails.changes.data && typeof logDetails.changes.data === 'string' && logDetails.changes.data.length > 200) {
    //          logDetails.changes.data = logDetails.changes.data.substring(0, 200) + '...';
    //    }

       saveAuditLog(performingUserId, 'UPDATE_EVIDENCE', 'Evidence', updatedEvidence._id);
       // --- Fim LOG ---

       res.status(200).json(updatedEvidence);
        console.log(`Evidência "${updatedEvidence.title}" atualizada por Usuário ID: ${performingUserId}`);

    } catch (error) {
        console.error("Erro ao atualizar evidência:", error.message);
         // --- LOG de Falha ---
         const failureDetails = {
              error: error.message,
              inputChanges: { ...updateData }
         };
         if (failureDetails.inputChanges.data && typeof failureDetails.inputChanges.data === 'string' && failureDetails.inputChanges.data.startsWith('data:image')) {
              failureDetails.inputChanges.data = '[Image Data Attempted (Base64 Skipped)]';
         }
        saveAuditLog(performingUserId, 'UPDATE_EVIDENCE_FAILED', 'Evidence', evidenceId, failureDetails);
        res.status(500).json({ error: "Erro ao atualizar evidência.", details: error.message });
    }
};