// Arquivo: controllers/reportController.js

// Importa os módulos necessários
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');

// Importa os modelos Mongoose
const Report = require('../models/report');
const Case = require('../models/case');
const User = require('../models/user');
const AuditLog = require('../models/auditlog'); // Modelo para logs de auditoria

// --- Função Auxiliar para Salvar Logs de Auditoria ---
// Salva o log de forma assíncrona sem bloquear a resposta principal.
const saveAuditLog = (userId, action, targetModel, targetId, details) => {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        console.warn(`AUDIT LOG: Tentativa de salvar log sem userId válido para ação ${action} em ${targetModel}:${targetId}`);
        return; // Não loga sem um usuário válido
    }
    if (!targetId) {
         console.warn(`AUDIT LOG: Tentativa de salvar log sem targetId para ação ${action} em ${targetModel} por ${userId}`);
         return; // Não loga sem um alvo
    }

    const log = new AuditLog({
        userId,
        action,
        targetModel,
        targetId: String(targetId), // Converte para String para acomodar IDs ou emails
        details
    });

    // Salva o log e captura erros potenciais no salvamento do log
    log.save().catch(err => {
        console.error(`AUDIT LOG FAIL: Falha ao salvar log (Ação: ${action}, User: ${userId}, Target: ${targetId}):`, err.message);
    });
};


// --- Configuração das Fontes do PDFMake para Node.js ---
// Garanta que os arquivos .ttf estejam no caminho correto do seu projeto backend.
// O caminho abaixo assume que seu controller está em `src/controllers` e as fontes em `public/fonts` na raiz do projeto.
const fontsDirectory = path.join(__dirname, '..', '..', 'public', 'fonts');

try {
    // Carrega os arquivos .ttf e os adiciona ao VFS (Virtual File System) do pdfMake
    pdfMake.vfs = {
        ...pdfFonts.pdfMakevfs, // Inclui fontes padrão VFS
        'Roboto-Regular.ttf': fs.readFileSync(path.join(fontsDirectory, 'Roboto-Regular.ttf')),
        'Roboto-Medium.ttf': fs.readFileSync(path.join(fontsDirectory, 'Roboto-Medium.ttf')),
        'Roboto-Italic.ttf': fs.readFileSync(path.join(fontsDirectory, 'Roboto-Italic.ttf')),
        'Roboto-MediumItalic.ttf': fs.readFileSync(path.join(fontsDirectory, 'Roboto-MediumItalic.ttf'))
    };
    // Define o mapeamento do nome da fonte para os arquivos carregados
    pdfMake.fonts = {
        Roboto: {
            normal: 'Roboto-Regular.ttf',
            bold: 'Roboto-Medium.ttf',
            italics: 'Roboto-Italic.ttf',
            bolditalics: 'Roboto-MediumItalic.ttf'
        }
    };
    console.log('Arquivos de fonte Roboto carregados para pdfMake do diretório:', fontsDirectory);
} catch (fontError) {
    console.error('Erro ao carregar arquivos de fonte para pdfMake:', fontError);
    console.warn('Laudo será gerado com a fonte padrão genérica.');
    pdfMake.vfs = pdfFonts.pdfMakevfs; // Usa apenas as fontes padrão VFS
    pdfMake.fonts = {}; // Usa a fonte padrão do pdfMake
}


// --- Função Auxiliar para Salvar PDF no Disco ---
// Salva o buffer do PDF e retorna a URL pública.
const salvarPDFNoStorage = async (buffer, filename, req) => {
    try {
        // Caminho onde os relatórios serão salvos (ex: seu_projeto_backend/uploads/reports)
        const uploadDirectory = path.join(__dirname, '..', 'uploads', 'reports'); // Ajuste se necessário

        // Garante que o diretório de upload existe
        if (!fs.existsSync(uploadDirectory)) {
            fs.mkdirSync(uploadDirectory, { recursive: true });
        }

        // Caminho completo do arquivo
        const filePath = path.join(uploadDirectory, filename);
        // Escreve o buffer do PDF no arquivo
        fs.writeFileSync(filePath, buffer);

        // Retorna a URL pública acessível (deve corresponder à configuração de arquivos estáticos do Express)
        const publicUrl = `${req.protocol}://${req.get('host')}/uploads/reports/${encodeURIComponent(filename)}`;
        console.log(`PDF salvo em: ${filePath}, acessível via URL: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error('Erro ao salvar PDF no storage:', error);
        throw new Error(`Erro ao salvar arquivo PDF no servidor: ${error.message}`);
    }
};


// --- Controller Principal: Gerar Laudo Pericial ---
exports.generateReport = async (req, res) => {
    let newReportId = null; // Para usar no log de falha
    const performingUserId = req.userId; // Usuário que está gerando o laudo (do token JWT)
    const { caseId, content } = req.body; // ID do caso e conteúdo do laudo

    try {
        // Validação dos inputs
        if (!caseId || !content) {
            return res.status(400).json({ error: "Dados incompletos. Forneça caseId e content." });
        }
        if (!mongoose.Types.ObjectId.isValid(caseId)) {
             return res.status(400).json({ error: "ID de caso inválido." });
        }
        if (!performingUserId || !mongoose.Types.ObjectId.isValid(performingUserId)) {
             return res.status(401).json({ error: "Usuário autenticado inválido." });
        }

        // Busca dados do Caso e populações necessárias
        const caso = await Case.findById(caseId)
            .populate({
                path: 'evidences',
                populate: { path: 'collectedBy', select: 'name role' }
            })
            .populate('responsibleExpert', 'name role');

        // Busca dados do Usuário que está gerando o laudo
        const user = await User.findById(performingUserId);

        if (!caso || !user) {
            return res.status(404).json({ error: !caso ? "Caso não encontrado." : "Usuário assinante não encontrado." });
        }

        // Construção do conteúdo do documento PDF
        const documentContent = [
            // Conteúdo detalhado do laudo (cabeçalho, info caso, evidências, assinatura)
            // Mantenha a lógica detalhada de construção que funcionou anteriormente aqui
            { text: 'LAUDO PERICIAL ODONTOFORENSE', style: 'header' },
            { text: `Caso nº: ${caso._id.toString()}`, alignment: 'center', margin: [0, 0, 0, 5], fontSize: 10 },
            { text: `Nome do Caso: ${caso.nameCase || 'Não informado'}`, alignment: 'center', margin: [0, 0, 0, 15], fontSize: 14, bold: true },
            { text: `Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, alignment: 'right', margin: [0, 0, 0, 20], fontSize: 10 },
            { canvas: [ { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#cccccc' } ], margin: [0, 0, 0, 20] },

            { text: '1. INFORMAÇÕES GERAIS DO CASO', style: 'subheader' },
             {
                 columns: [
                     { width: 'auto', text: [{ text: 'Status:', bold: true }, ` ${caso.status || 'Não informado'}`] },
                     { width: '*', text: [{ text: 'Local:', bold: true }, ` ${caso.location || 'Não informado'}`] }
                 ], columnGap: 20, margin: [0, 5, 0, 5]
             },
             {
                 columns: [
                     { width: 'auto', text: [{ text: 'Data do Caso:', bold: true }, ` ${caso.dateCase ? new Date(caso.dateCase).toLocaleDateString('pt-BR') : 'Não informada'}`] },
                     { width: '*', text: [{ text: 'Hora do Caso:', bold: true }, ` ${caso.hourCase || 'Não informada'}`] }
                 ], columnGap: 20, margin: [0, 5, 0, 5]
             },
             { text: [{ text: 'Categoria:', bold: true }, ` ${caso.category || 'Não informada'}`], margin: [0, 5, 0, 15] },
             { text: [{ text: 'Perito(s) Responsável(is) pelo Caso:', bold: true }, ` ${caso.responsibleExpert?.name || 'Não informado'} (${caso.responsibleExpert?.role || 'Função não definida'})`], margin: [0, 5, 0, 15] },

            { text: '2. DESCRIÇÃO DO CASO', style: 'subheader' },
             { text: caso.Description || 'Descrição não fornecida para este caso.', margin: [0, 5, 0, 20] },

            { text: '3. CONSIDERAÇÕES PERICIAIS / ANÁLISE', style: 'subheader' },
             { text: content || 'Nenhum conteúdo de laudo fornecido.', margin: [0, 5, 0, 20] },

            { text: '4. EVIDÊNCIAS VINCULADAS', style: 'subheader' },
        ];

        // Loop para adicionar evidências
        if (caso.evidences && caso.evidences.length > 0) {
            caso.evidences.forEach((ev, index) => {
                documentContent.push({ text: `Evidência ${index + 1}: ${ev.title || 'Sem Título'}`, style: 'evidenceTitle' });
                documentContent.push({
                     columns: [
                         { width: 'auto', text: [{ text: 'Tipo:', bold: true }, ` ${ev.evidenceType || 'Desconhecido'}`] },
                         { width: '*', text: [{ text: 'Coletado por:', bold: true }, ` ${ev.collectedBy?.name || 'Não informado'} (${ev.collectedBy?.role || ''})`] }
                     ], columnGap: 20, margin: [0, 2, 0, 5]
                 });
                if (ev.category) { documentContent.push({ text: [{ text: 'Categoria:', bold: true }, ` ${ev.category}`], margin: [0, 2, 0, 5] }); }
                if (ev.description) { documentContent.push({ text: [{ text: 'Descrição:', bold: true }], margin: [0, 5, 0, 2] }); documentContent.push({ text: ev.description, margin: [0, 0, 0, 5] }); }
                if (ev.data) {
                    documentContent.push({ text: [{ text: 'Dados da Evidência:', bold: true }], margin: [0, 5, 0, 2] });
                    if (ev.evidenceType === 'image' && typeof ev.data === 'string' && ev.data.startsWith('data:image')) {
                        try { documentContent.push({ image: ev.data, width: 400, alignment: 'center', margin: [0, 5, 0, 15] }); }
                        catch (imageError) { console.error(`Erro ao adicionar imagem ${ev._id}:`, imageError); documentContent.push({ text: `[Erro ao carregar imagem]`, color: 'red', margin: [0, 5, 0, 15] }); }
                    } else { documentContent.push({ text: typeof ev.data === 'object' ? JSON.stringify(ev.data, null, 2) : String(ev.data), margin: [0, 0, 0, 15] }); }
                }
                if (index < caso.evidences.length - 1) { documentContent.push({ text: '', margin: [0, 0, 0, 10] }); documentContent.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#eeeeee' }], margin: [0, 0, 0, 10] }); }
            });
        } else { documentContent.push({ text: 'Nenhuma evidência vinculada a este caso pericial.', margin: [0, 10, 0, 0], italics: true }); }

        // Seção de assinatura
        documentContent.push({ text: '', pageBreak: caso.evidences.length > 4 ? 'before' : undefined, margin: [0, 40, 0, 0] });
        documentContent.push({ text: 'Assinatura do Perito Responsável pelo Laudo', style: 'subheader', alignment: 'center' });
        documentContent.push({ text: '\n\n\n________________________________________', alignment: 'center', margin: [0, 20, 0, 5] });
        documentContent.push({ text: `${user.name || 'Nome não informado'} (${user.role || 'Função não definida'})`, alignment: 'center' });

        // Definição dos estilos
        const pdfStyles = {
             header: { fontSize: 28, bold: true, alignment: 'center', margin: [0, 0, 0, 10], color: '#1c3a66' },
             subheader: { fontSize: 16, bold: true, color: '#2c3e50', margin: [0, 15, 0, 8] },
             label: { fontSize: 12, bold: true, margin: [0, 0, 0, 2] },
             evidenceTitle: { fontSize: 14, bold: true, margin: [0, 10, 0, 5], decoration: 'underline' }
        };

        // Definição geral do documento
        const docDefinition = {
            content: documentContent,
            styles: pdfStyles,
            defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.3 },
            pageMargins: [ 40, 40, 40, 40 ],
            footer: function(currentPage, pageCount) { return { text: `Página ${currentPage} de ${pageCount}`, alignment: 'center', margin: [0, 20, 0, 0], fontSize: 9 }; }
        };

        // Geração do documento PDF
        const pdfDoc = pdfMake.createPdf(docDefinition);

        // Obtenção do buffer do PDF
        const pdfBuffer = await new Promise((resolve, reject) => {
             pdfDoc.getBuffer((buffer) => buffer ? resolve(buffer) : reject(new Error("Erro ao obter buffer do PDF.")));
        });

        // Salvamento do PDF no disco
        const filename = `laudo-caso-${caso.nameCase.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}-${Date.now()}.pdf`;
        const pdfUrl = await salvarPDFNoStorage(pdfBuffer, filename, req);

        // Criação do registro do Laudo no banco de dados
        const newReport = new Report({
            caseId: caso._id,
            content,
            signedBy: user._id,
            pdfUrl,
            status: 'finalizado',
        });
        await newReport.save();
        newReportId = newReport._id; // Guarda ID para log

        // --- LOG de Auditoria ---
        saveAuditLog(performingUserId, 'CREATE_REPORT', 'Report', newReportId, { caseId: caso._id, caseName: caso.nameCase, pdfUrl: pdfUrl });

        // Resposta de Sucesso para o frontend
        res.status(201).json({
            message: "Laudo gerado com sucesso!",
            reportId: newReportId,
            pdfUrl: pdfUrl,
        });
        console.log(`Laudo gerado (ID: ${newReportId}) para o caso "${caso.nameCase}" por Usuário ID: ${performingUserId}`);

    } catch (err) {
        // Tratamento de Erros e Log de Falha
        console.error('Erro no generateReport:', err);
        saveAuditLog(performingUserId, 'CREATE_REPORT_FAILED', 'Report', newReportId || caseId, { caseId: caseId, error: err.message, inputContentLength: content?.length || 0 });
        res.status(500).json({
            error: "Erro interno do servidor ao gerar o laudo.",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined,
            message: "Não foi possível gerar o laudo. Tente novamente mais tarde."
        });
    }
};