// Importa os módulos necessários
const fs = require('fs'); // Para ler arquivos (fontes) e verificar/criar pastas
const path = require('path'); // Para lidar com caminhos de arquivos
const Report = require('../models/report'); // Modelo Mongoose para Laudos
const Case = require('../models/case'); // Modelo Mongoose para Casos Periciais
const User = require('../models/user'); // Modelo Mongoose para Usuários (Peritos/Coletores)
const pdfMake = require('pdfmake/build/pdfmake'); // pdfMake para Node.js
const pdfFonts = require('pdfmake/build/vfs_fonts'); // Fontes padrão VFS para pdfMake
const mongoose = require('mongoose'); // Para validação de ObjectId

// --- Configuração das Fontes do PDFMake para Node.js ---
// É CRUCIAL que estes caminhos estejam corretos e os arquivos .ttf existam.
// Ajuste o caminho base ('../public/fonts') conforme a sua estrutura de pastas.
// Se o seu controller está em `src/controllers` e a pasta `public` está na raiz do backend,
// o caminho correto para a pasta `public/fonts` é subir DOIS níveis (`../..`) a partir de `__dirname`.
const fontsDirectory = path.join(__dirname, '..', '..', 'public', 'fonts'); // Exemplo de caminho: `seu_projeto_backend/public/fonts`

try {
    // Carrega os arquivos .ttf das fontes do sistema de arquivos e os adiciona ao VFS (Virtual File System) do pdfMake
    pdfMake.vfs = {
        ...pdfFonts.pdfMakevfs, // Inclui as fontes padrão VFS do pdfFonts
        'Roboto-Regular.ttf': fs.readFileSync(path.join(fontsDirectory, 'Roboto-Regular.ttf')),
        'Roboto-Medium.ttf': fs.readFileSync(path.join(fontsDirectory, 'Roboto-Medium.ttf')), // Ou 'Roboto-Bold.ttf' se você copiou este arquivo
        'Roboto-Italic.ttf': fs.readFileSync(path.join(fontsDirectory, 'Roboto-Italic.ttf')),
        'Roboto-MediumItalic.ttf': fs.readFileSync(path.join(fontsDirectory, 'Roboto-MediumItalic.ttf')) // Ou 'Roboto-BoldItalic.ttf'
    };
    // Define o mapeamento do nome da fonte ('Roboto') para os arquivos carregados no VFS
    pdfMake.fonts = {
        Roboto: {
            normal: 'Roboto-Regular.ttf',
            bold: 'Roboto-Medium.ttf', // Use o nome do arquivo real que você carregou para o bold
            italics: 'Roboto-Italic.ttf',
            bolditalics: 'Roboto-MediumItalic.ttf' // Use o nome do arquivo real para o bolditalics
        }
    };
    console.log('Arquivos de fonte Roboto carregados com sucesso do diretório:', fontsDirectory);
} catch (fontError) {
    console.error('Erro ao carregar arquivos de fonte para pdfMake:', fontError);
    console.warn('O laudo será gerado com a fonte padrão genérica (provavelmente Helvetica ou similar).');
    // Em caso de erro (arquivos não encontrados, permissão negada, etc.), configuramos para usar a fonte padrão do pdfMake
    pdfMake.vfs = pdfFonts.pdfMakevfs; // Garante que pelo menos as fontes padrão VFS estejam disponíveis
    pdfMake.fonts = {}; // Define o objeto fonts vazio para usar a fonte padrão do pdfMake
}


// Função auxiliar para salvar o buffer do PDF no sistema de arquivos local
// e retornar a URL pública para acesso.
const salvarPDFNoStorage = async (buffer, filename, req) => {
    try {
        // Define o caminho completo onde os relatórios serão salvos (ex: seu_projeto_backend/uploads/reports)
        // Assumindo que a pasta 'uploads' está na raiz do backend, ao lado da pasta 'src'
        const uploadDirectory = path.join(__dirname, '..', 'uploads', 'reports'); // Ajuste este caminho se a pasta 'uploads' estiver em outro lugar

        // Verifica se o diretório de upload existe; se não, tenta criá-lo recursivamente
        if (!fs.existsSync(uploadDirectory)) {
            console.log(`Criando diretório de upload: ${uploadDirectory}`);
            fs.mkdirSync(uploadDirectory, { recursive: true });
        }

        // Define o caminho completo para o arquivo PDF dentro do diretório de upload
        const filePath = path.join(uploadDirectory, filename);
        // Escreve o buffer (dados binários) do PDF no arquivo especificado
        fs.writeFileSync(filePath, buffer);

        // Constrói e retorna a URL pública para que o frontend possa acessar o arquivo estático
        // A URL '/uploads/reports/' deve corresponder ao caminho configurado no middleware `express.static` no seu servidor principal
        const publicUrl = `${req.protocol}://${req.get('host')}/uploads/reports/${encodeURIComponent(filename)}`; // Usa encodeURIComponent no nome do arquivo para URLs seguras
        console.log(`PDF salvo em: ${filePath}, acessível via URL: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error('Erro ao salvar PDF no storage:', error);
        // Lança um novo erro com uma mensagem mais clara
        throw new Error(`Erro ao salvar arquivo PDF no servidor: ${error.message}`);
    }
};

// --- Controller Principal: Gerar Laudo Pericial ---
// Esta função é acionada por uma requisição POST (ex: POST /api/report)
// Requer body: { caseId: string, content: string }
// Requer autenticação JWT (middleware `verifyJWT`) para obter `req.userId`
// Requer autorização (middleware `authorize`) para roles como 'perito' ou 'admin'
exports.generateReport = async (req, res) => {
    try {
        // 1. Extrair dados da requisição
        const { caseId, content } = req.body;
        // Assume que o ID do usuário logado é adicionado à requisição pelo middleware de autenticação (ex: verifyJWT)
        const signedBy = req.userId;

        // 2. Validação básica dos inputs e do usuário assinante
        if (!caseId || !content) {
            return res.status(400).json({ error: "Dados incompletos. É necessário fornecer o ID do caso (caseId) e o conteúdo do laudo (content)." });
        }
        // Valida se os IDs fornecidos/obtidos são ObjectIds válidos do MongoDB
        if (!mongoose.Types.ObjectId.isValid(caseId)) {
             return res.status(400).json({ error: "ID de caso inválido." });
        }
        if (!signedBy || !mongoose.Types.ObjectId.isValid(signedBy)) {
             // Isso indica um problema no middleware de autenticação ou token inválido/ausente
             return res.status(401).json({ error: "Usuário autenticado inválido ou não fornecido. Faça login novamente." });
        }


        // 3. Busca os dados necessários do banco de dados (Caso, Evidências Populadas, Usuários Populados)
        const caso = await Case.findById(caseId)
            .populate({ // Popula o array de referências 'evidences'
                path: 'evidences',
                populate: { // Dentro de cada objeto de evidência populado, popula a referência 'collectedBy'
                    path: 'collectedBy',
                    select: 'name role' // Seleciona apenas os campos 'name' e 'role' do modelo User
                }
            })
             .populate('responsibleExpert', 'name role'); // Popula a referência 'responsibleExpert' no objeto Case
             // Se você precisar da equipe no laudo, adicione .populate('team', 'name role') aqui


        // Busca os dados completos do usuário que está gerando/assinando o laudo
        const user = await User.findById(signedBy);

        // 4. Verifica se os documentos foram encontrados
        if (!caso) {
            return res.status(404).json({ error: "Caso pericial não encontrado com o ID fornecido." });
        }
        if (!user) {
             // Este erro só deve ocorrer se o ID do usuário no token for válido mas não existir no banco
            return res.status(404).json({ error: "Usuário assinante não encontrado no sistema." });
        }

        // 5. --- Construção do Objeto de Definição do Documento PDF (docDefinition) usando pdfMake ---
        // Este objeto descreve o conteúdo, estilos e configurações do PDF

        const documentContent = [
            // Seção 1: Cabeçalho Principal
            { text: 'LAUDO PERICIAL ODONTOFORENSE', style: 'header' },
             { text: `Caso nº: ${caso._id.toString()}`, alignment: 'center', margin: [0, 0, 0, 5], fontSize: 10 }, // ID do Caso
            { text: `Nome do Caso: ${caso.nameCase || 'Não informado'}`, alignment: 'center', margin: [0, 0, 0, 15], fontSize: 14, bold: true },
            { text: `Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, alignment: 'right', margin: [0, 0, 0, 20], fontSize: 10 },
            { canvas: [ { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#cccccc' } ], margin: [0, 0, 0, 20] }, // Linha separadora

            // Seção 2: Informações Gerais do Caso
            { text: '1. INFORMAÇÕES GERAIS DO CASO', style: 'subheader' },
            {
                columns: [
                    { width: 'auto', text: [{ text: 'Status:', bold: true }, ` ${caso.status || 'Não informado'}`] },
                    { width: '*', text: [{ text: 'Local:', bold: true }, ` ${caso.location || 'Não informado'}`] }
                ],
                columnGap: 20, // Espaçamento entre colunas
                margin: [0, 5, 0, 5] // Margem [esquerda, topo, direita, base]
            },
             {
                 columns: [
                    { width: 'auto', text: [{ text: 'Data do Caso:', bold: true }, ` ${caso.dateCase ? new Date(caso.dateCase).toLocaleDateString('pt-BR') : 'Não informada'}`] },
                    { width: '*', text: [{ text: 'Hora do Caso:', bold: true }, ` ${caso.hourCase || 'Não informada'}`] }
                 ],
                 columnGap: 20,
                 margin: [0, 5, 0, 5]
            },
            { text: [{ text: 'Categoria:', bold: true }, ` ${caso.category || 'Não informada'}`], margin: [0, 5, 0, 15] },
            { text: [{ text: 'Perito(s) Responsável(is) pelo Caso:', bold: true }, ` ${caso.responsibleExpert?.name || 'Não informado'} (${caso.responsibleExpert?.role || 'Função não definida'})`], margin: [0, 5, 0, 15] },
             // Opcional: Adicionar equipe aqui se populado (exemplo)
            // { text: [{ text: 'Equipe:', bold: true }, caso.team && caso.team.length > 0 ? caso.team.map(member => member.name).join(', ') : 'Não informada'], margin: [0, 5, 0, 15] },


            // Seção 3: Descrição do Caso (a descrição original salva no Case)
            { text: '2. DESCRIÇÃO DO CASO', style: 'subheader' },
            { text: caso.Description || 'Descrição não fornecida para este caso.', margin: [0, 5, 0, 20] },


            // Seção 4: Conteúdo do Laudo (Texto Livre digitado pelo Perito agora)
            { text: '3. CONSIDERAÇÕES PERICIAIS / ANÁLISE', style: 'subheader' },
            { text: content || 'Nenhum conteúdo de laudo fornecido.', margin: [0, 5, 0, 20] },


            // Seção 5: Evidências Vinculadas
            { text: '4. EVIDÊNCIAS VINCULADAS', style: 'subheader' },
        ];

        // Adiciona cada evidência individualmente ao array de conteúdo do documento
        if (caso.evidences && caso.evidences.length > 0) {
            caso.evidences.forEach((ev, index) => {
                // Título da evidência
                documentContent.push({ text: `Evidência ${index + 1}: ${ev.title || 'Sem Título'}`, style: 'evidenceTitle' });

                // Tipo e Coletor em colunas
                documentContent.push({
                     columns: [
                         { width: 'auto', text: [{ text: 'Tipo:', bold: true }, ` ${ev.evidenceType || 'Desconhecido'}`] },
                         // Acessa o nome populado de collectedBy
                         { width: '*', text: [{ text: 'Coletado por:', bold: true }, ` ${ev.collectedBy?.name || 'Não informado'} (${ev.collectedBy?.role || ''})`] }
                     ],
                     columnGap: 20,
                     margin: [0, 2, 0, 5]
                 });

                // Categoria (se existir)
                if (ev.category) {
                    documentContent.push({ text: [{ text: 'Categoria:', bold: true }], margin: [0, 2, 0, 5] });
                    documentContent.push({ text: ev.category, margin: [0, 0, 0, 5] });
                }

                // Descrição (se existir)
                if (ev.description) {
                    documentContent.push({ text: [{ text: 'Descrição:', bold: true }], margin: [0, 5, 0, 2] });
                    documentContent.push({ text: ev.description, margin: [0, 0, 0, 5] });
                }

                // Dados da Evidência (Texto, Imagem, etc.)
                if (ev.data) {
                    documentContent.push({ text: [{ text: 'Dados da Evidência:', bold: true }], margin: [0, 5, 0, 2] });
                    if (ev.evidenceType === 'image' && typeof ev.data === 'string' && ev.data.startsWith('data:image')) {
                        // Se for uma imagem Base64, adiciona como elemento de imagem no PDF
                        try {
                             documentContent.push({
                                image: ev.data, // String Base64 da imagem
                                width: 400, // Define a largura da imagem no PDF (ajuste conforme necessário)
                                alignment: 'center', // Centraliza a imagem
                                margin: [0, 5, 0, 15] // Margem após a imagem
                             });
                        } catch (imageError) {
                            // Captura erros ao tentar adicionar a imagem (ex: Base64 inválido)
                            console.error(`Erro ao adicionar imagem da evidência ${ev._id} ao PDF:`, imageError);
                             documentContent.push({ text: `[Erro ao carregar imagem: ${imageError.message}]`, color: 'red', margin: [0, 5, 0, 15] });
                        }
                    } else {
                         // Se não for imagem, trata como texto (converte objetos JSON para string formatada)
                         documentContent.push({
                            text: typeof ev.data === 'object' ? JSON.stringify(ev.data, null, 2) : String(ev.data),
                            margin: [0, 0, 0, 15],
                            // Opcional: estilizar dados brutos com fonte monoespaçada
                            // font: 'Courier',
                            // fontSize: 10
                         });
                    }
                }

                // Adiciona um separador visual entre as evidências, exceto após a última
                 if (index < caso.evidences.length - 1) {
                     documentContent.push({ text: '', margin: [0, 0, 0, 10] }); // Espaço em branco
                     documentContent.push({ canvas: [ { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#eeeeee' } ], margin: [0, 0, 0, 10] }); // Linha fina
                 }
            });
        } else {
            // Mensagem a ser exibida se não houver evidências vinculadas
            documentContent.push({ text: 'Nenhuma evidência vinculada a este caso pericial.', margin: [0, 10, 0, 0], italics: true });
        }

        // Seção 6: Assinatura do Perito
        // Adiciona uma quebra de página antes da assinatura se houver muitas evidências para evitar que fique "colada"
         documentContent.push({ text: '', pageBreak: caso.evidences.length > 4 ? 'before' : undefined, margin: [0, 40, 0, 0] }); // pageBreak opcional
         documentContent.push({ text: 'Assinatura do Perito Responsável pelo Laudo', style: 'subheader', alignment: 'center' });
         documentContent.push({ text: '\n\n\n________________________________________', alignment: 'center', margin: [0, 20, 0, 5] }); // Linha para assinatura
         // Exibe o nome e a função do usuário que gerou o laudo
         documentContent.push({ text: `${user.name || 'Nome não informado'} (${user.role || 'Função não definida'})`, alignment: 'center' });
         // Opcional: Adicionar CRO/Matrícula do perito se o modelo User tiver este campo
         // if(user.cro) {
         //    documentContent.push({ text: `CRO/Registro: ${user.cro}`, alignment: 'center' });
         // }


        // 6. --- Definição dos Estilos do Documento PDF (pdfStyles) ---
        const pdfStyles = {
            header: { // Estilo para o título principal "LAUDO PERICIAL..."
                fontSize: 28,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 10], // [esquerda, topo, direita, base]
                color: '#1c3a66' // Cor para o cabeçalho
            },
            subheader: { // Estilo para títulos de seção (Ex: "1. INFORMAÇÕES GERAIS...")
                fontSize: 16,
                bold: true,
                color: '#2c3e50', // Cor para subtítulos
                margin: [0, 15, 0, 8]
            },
            label: { // Estilo para rótulos como "Status:", "Local:", etc.
                fontSize: 12,
                bold: true,
                margin: [0, 0, 0, 2]
            },
            evidenceTitle: { // Estilo para o título de cada evidência
                fontSize: 14,
                bold: true,
                margin: [0, 10, 0, 5],
                decoration: 'underline' // Sublinha o título
            },
            // Adicione outros estilos conforme necessário (ex: para tabelas, listas, etc.)
        };

        // 7. --- Configuração Geral do Documento PDF (docDefinition) ---
        const docDefinition = {
            content: documentContent, // O array de conteúdo construído acima
            styles: pdfStyles, // Os estilos definidos acima
            defaultStyle: { // Estilo aplicado a todo o documento por padrão
                font: 'Roboto', // Usa a fonte 'Roboto' configurada no pdfMake.fonts
                fontSize: 11,
                lineHeight: 1.3 // Altura da linha
            },
            // Margens padrão da página [esquerda, topo, direita, base]
            pageMargins: [ 40, 40, 40, 40 ],
            // Opcional: Rodapé dinâmico com número da página
            footer: function(currentPage, pageCount) {
                 return { text: `Página ${currentPage} de ${pageCount}`, alignment: 'center', margin: [0, 20, 0, 0], fontSize: 9 };
            }
        };

        // 8. Geração do Documento PDF usando pdfMake.createPdf()
        const pdfDoc = pdfMake.createPdf(docDefinition);

        // 9. Obtém o buffer binário do PDF gerado
        const pdfBuffer = await new Promise((resolve, reject) => {
             // O método getBuffer aceita um callback que é chamado com o buffer quando pronto
             pdfDoc.getBuffer((buffer, pages) => {
                 if (buffer) {
                     resolve(buffer); // Resolve a Promise com o buffer
                 } else {
                     // Embora getBuffer raramente falhe assim, é um fallback
                     reject(new Error("Erro interno ao obter o buffer do PDF."));
                 }
             });
             // Não é necessário chamar pdfDoc.end() com getBuffer
        });

        // 10. Salva o buffer do PDF no sistema de arquivos local
        // Gera um nome de arquivo amigável e único
        const filename = `laudo-caso-${caso.nameCase.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}-${Date.now()}.pdf`; // Remove caracteres inválidos para nome de arquivo
        const pdfUrl = await salvarPDFNoStorage(pdfBuffer, filename, req); // Salva e obtém a URL pública

        // 11. Cria um registro no banco de dados para o laudo gerado
        const newReport = new Report({
            caseId: caso._id, // Linka o laudo ao caso
            content: content, // Salva o conteúdo textual do laudo
            signedBy: user._id, // Linka o laudo ao usuário que o gerou/assinou
            pdfUrl: pdfUrl, // Salva a URL onde o PDF pode ser acessado
            status: 'finalizado', // Define o status inicial do laudo
            // createdAt e updatedAt são definidos automaticamente pelo schema
        });

        await newReport.save(); // Salva o registro no DB

        // 12. Responde ao frontend com sucesso e a URL do PDF gerado
        res.status(201).json({
            message: "Laudo gerado com sucesso!",
            reportId: newReport._id, // Opcional: retorna o ID do registro do laudo
            pdfUrl: pdfUrl, // A URL pública para acessar o PDF
            // Opcional: Incluir um link de download usando a rota backend específica, se existir
            // downloadLink: `${req.protocol}://${req.get('host')}/api/reports/download/${newReport._id}`
        });

    } catch (err) {
        // Captura e lida com quaisquer erros que ocorreram no processo
        console.error('Erro no generateReport:', err); // Loga o erro completo no console do servidor
        // Envia uma resposta de erro para o cliente
        res.status(500).json({
            error: "Erro interno no servidor ao gerar o laudo.",
            // Inclui detalhes do erro apenas em ambiente de desenvolvimento para não expor informações sensíveis em produção
            details: process.env.NODE_ENV === 'development' ? err.message : undefined,
            message: "Não foi possível gerar o laudo. Por favor, tente novamente mais tarde ou contate o suporte." // Mensagem amigável para o cliente
        });
    }
};