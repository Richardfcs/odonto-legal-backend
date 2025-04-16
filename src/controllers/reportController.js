const fs = require('fs');
const path = require('path');
const Report = require('../models/report');
const Case = require('../models/case');
const User = require('../models/user');
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');

// Configuração das fontes do PDFMake
pdfMakevfs = {
    ...pdfFonts.pdfMakevfs,
    Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
    }
};

// Função para salvar o PDF localmente
const salvarPDFNoStorage = async (buffer, filename, req) => { // Adicione req como parâmetro
    try {
        const uploadPath = path.join(__dirname, '..', 'uploads', 'reports');

        // Garante que o diretório existe
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        const filePath = path.join(uploadPath, filename);
        fs.writeFileSync(filePath, buffer);

        // Retorna a URL completa acessível
        return `${req.protocol}://${req.get('host')}/uploads/reports/${filename}`;
    } catch (error) {
        console.error('Erro ao salvar PDF:', error);
        throw error;
    }
};

exports.generateReport = async (req, res) => {
    try {
        const { caseId, content } = req.body;
        const signedBy = req.userId;

        // Validação básica
        if (!caseId || !content) {
            return res.status(400).json({ error: "Dados incompletos. Forneça caseId e conteúdo." });
        }

        // Busca os dados necessários
        const caso = await Case.findById(caseId).populate('evidences');
        const user = await User.findById(signedBy);

        if (!caso) {
            return res.status(404).json({ error: "Caso não encontrado." });
        }

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        // Construção do documento PDF
        const docDefinition = {
            content: [
                { text: 'Laudo Pericial', style: 'header' },
                { text: `Caso: ${caso.nameCase}`, style: 'subheader' },
                { text: `Responsável: ${user.name} (${user.role})` },
                { text: `Data: ${new Date().toLocaleDateString('pt-BR')}` },
                { text: 'Descrição do Laudo:', style: 'subheader' },
                { text: content, margin: [0, 5, 0, 15] },
                { text: 'Evidências Vinculadas:', style: 'subheader' },
                ...caso.evidences.map(ev => ({
                    text: `• ${ev.title} (${ev.evidenceType})`,
                    margin: [15, 2, 0, 2]
                }))
            ],
            styles: {
                header: {
                    fontSize: 22,
                    bold: true,
                    alignment: 'center',
                    margin: [0, 0, 0, 20]
                },
                subheader: {
                    fontSize: 16,
                    bold: true,
                    color: '#2c3e50',
                    margin: [0, 10, 0, 5]
                }
            },
            defaultStyle: {
                font: 'Roboto',
                fontSize: 12,
                lineHeight: 1.4
            }
        };

        // Geração do PDF
        const pdfDoc = pdfMake.createPdf(docDefinition);
        const pdfBuffer = await new Promise((resolve, reject) => {
            pdfDoc.getBuffer((buffer) => {
                try {
                    resolve(buffer);
                } catch (error) {
                    reject(error);
                }
            });
        });

        // Salvar o PDF
        const pdfUrl = await salvarPDFNoStorage(pdfBuffer, `laudo-${caseId}-${Date.now()}.pdf`, req); // Passe o req

        // Criar registro no banco de dados
        const newReport = new Report({
            caseId,
            content,
            signedBy,
            pdfUrl,
            status: 'finalizado',
            generatedAt: new Date()
        });

        await newReport.save();

        // Resposta com dados do laudo e URL do PDF
        res.status(201).json({
            message: "Laudo gerado com sucesso!",
            reportId: newReport._id,
            pdfUrl: pdfUrl,
            downloadLink: `${req.protocol}://${req.get('host')}/api/reports/download/${newReport._id}`
        });

    } catch (err) {
        console.error('Erro no generateReport:', err);
        res.status(500).json({
            error: "Erro interno no servidor ao gerar laudo.",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};