const mongoose = require('mongoose');
const Evidence = require('../models/evidence');
const Case = require('../models/case');

exports.createEvidence = async (req, res) => {
    try {
        // const caso = await Case.findById(caseId);
        // if (!caso) return res.status(404).json({ error: "Caso não encontrado." });
        // 1. Extrair dados da requisição (body)
        const { caseId, evidenceType, title, description, data, category } = req.body;

        // 2. Validação básica dos dados (campos obrigatórios - você pode adicionar mais validações)
        if (!caseId || !evidenceType || !title || !data) {
            return res.status(400).json({ msg: "Campos obrigatórios ausentes: caseId, evidenceType, title, data" });
        }

        // 3. Criar uma nova instância de Evidence com os dados da requisição
        const newEvidence = new Evidence({
            caseId,
            evidenceType,
            title,
            description,
            data,
            category, // Categoria é opcional no body, pode ser undefined
            collectedBy: req.userId // collectedBy: req.userId // Se quiser registrar quem criou, descomente e use req.userId do middleware de autenticação
        });

        // 4. Salvar a nova evidência no banco de dados
        const savedEvidence = await newEvidence.save();

        await Case.findByIdAndUpdate(
            caseId,
            { $push: { evidences: savedEvidence._id } }
        );

        // 5. Responder com sucesso (código 201 - Created) e a evidência criada
        res.status(201).json({ msg: "Evidência criada com sucesso!", evidence: savedEvidence });

    } catch (error) {
        console.error("Erro ao criar evidência:", error); // Log do erro para debug no servidor
        res.status(500).json({ msg: "Erro ao criar evidência.", error: error.message }); // Responder com erro 500 e mensagem genérica para o cliente
    }
};

exports.getAllEvidences = async (req, res) => {
    try {
        // 1. Buscar todas as evidências no banco de dados
        const evidences = await Evidence.find({}); // Retorna todas as evidências

        // 2. Responder com sucesso (código 200 - OK) e a lista de evidências
        res.status(200).json({ msg: "Evidências encontradas com sucesso!", evidences: evidences });

    } catch (error) {
        console.error("Erro ao buscar todas as evidências:", error);
        res.status(500).json({ msg: "Erro ao buscar evidências.", error: error.message });
    }
};

exports.getEvidencesByCaseId = async (req, res) => {
    try {
        // 1. Extrair o caseId dos parâmetros da rota (URL)
        const caseId = req.params.caseId;
        console.log("Valor de caseId recebido na rota:", caseId);

        // 2. Validação básica do caseId (opcional, mas recomendável - verificar se é um ObjectId válido)
        if (!mongoose.Types.ObjectId.isValid(caseId)) {
            return res.status(400).json({ msg: "ID de caso inválido." });
        }

        // 3. Buscar evidências no banco de dados FILTRANDO por caseId
        const evidences = await Evidence.find({ caseId: caseId }); // Filtra evidências pelo caseId

        // 4. Verificar se evidências foram encontradas para o caseId
        if (!evidences || evidences.length === 0) {
            return res.status(404).json({ msg: "Nenhuma evidência encontrada para o ID de caso fornecido." });
        }

        // 5. Responder com sucesso (código 200 - OK) e a lista de evidências
        res.status(200).json({ msg: "Evidências do caso encontradas com sucesso!", evidences: evidences });

    } catch (error) {
        console.error("Erro ao buscar evidências por caseId:", error);
        res.status(500).json({ msg: "Erro ao buscar evidências do caso.", error: error.message });
    }
};

exports.deleteEvidence = async (req, res) => {
    try {
        const evidence = await Evidence.findByIdAndDelete(req.params.id);
        if (!evidence) return res.status(404).json({ error: "Evidência não encontrada." });
        await Case.findByIdAndUpdate(
            evidence.caseId,
            { $pull: { evidences: evidence._id } }
        );
        res.status(200).json({ message: "Evidência excluída com sucesso." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateEvidence = async (req, res) => {
    try {
        const updatedEvidence = await Evidence.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.status(200).json(updatedEvidence);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};