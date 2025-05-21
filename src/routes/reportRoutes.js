const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middleware/auth');
const { generateReport, generateEvidenceReport } = require('../controllers/reportController');
const path = require('path');
const fs = require('fs');

router.post('/', verifyJWT, generateReport);

router.get('/download/:reportId', async (req, res) => {
    try {
        // Valida se o ID é um ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(req.params.reportId)) {
             return res.status(400).send('ID de laudo inválido.');
        }

        const report = await Report.findById(req.params.reportId);
        if (!report) {
            return res.status(404).send('Registro de laudo não encontrado.');
        }

        // Extrai o nome do arquivo da URL salva no DB (ex: /uploads/reports/nome.pdf -> nome.pdf)
        const filename = path.basename(report.pdfUrl); // Use path.basename por segurança
        const filePath = path.join(__dirname, '..', 'uploads', 'reports', filename); // Caminho no servidor

        // Verifica se o arquivo existe no disco
        if (!fs.existsSync(filePath)) {
            console.error(`Arquivo PDF não encontrado no disco para o laudo ${report._id}: ${filePath}`);
            return res.status(404).send('Arquivo PDF não encontrado no storage.');
        }

        // Usa res.download para enviar o arquivo com um nome de download amigável
        res.download(filePath, `laudo-${report.caseId}.pdf`, (err) => {
            if (err) {
                console.error('Erro ao enviar arquivo para download:', err);
                // Se o download falhar por algum motivo após o find, tenta enviar um erro genérico
                if (!res.headersSent) {
                    res.status(500).send('Erro interno do servidor ao processar o download.');
                }
            }
        });
    } catch (error) {
        console.error('Erro na rota de download do laudo:', error);
        res.status(500).send('Erro interno do servidor ao buscar laudo para download.');
    }
});

router.post('/evidence', verifyJWT, generateEvidenceReport)


module.exports = router;