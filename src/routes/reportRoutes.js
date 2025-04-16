const express = require('express');
const router = express.Router();
const { verifyJWT, authorize } = require('../middleware/auth');
const { generateReport } = require('../controllers/reportController');
const path = require('path');
const fs = require('fs');

router.post('/', verifyJWT, authorize(['perito', 'admin']), generateReport);

router.get('/view/:filename', (req, res) => {
    try {
        const filePath = path.join(__dirname, '..', 'uploads', 'reports', req.params.filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).send('Arquivo não encontrado');
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.sendFile(filePath);
    } catch (error) {
        res.status(500).send('Erro ao carregar o PDF');
    }
});

router.get('/download/:id', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).send('Laudo não encontrado');
        }

        const filename = report.pdfUrl.split('/').pop();
        const filePath = path.join(__dirname, '..', 'uploads', 'reports', filename);

        res.download(filePath, `laudo-${report.caseId}.pdf`);
    } catch (error) {
        res.status(500).send('Erro no download');
    }
});

module.exports = router;