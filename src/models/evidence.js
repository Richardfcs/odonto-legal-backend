const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
    caseId: {  // Relacionamento com o Caso Pericial
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Case',
        required: true
    },
    evidenceType: { // Tipo da Evidência (Texto, Imagem, Odontograma, etc.)
        type: String,
        required: true,
        enum: ['text_description', 'image', 'odontogram', 'other'] // Tipos de evidência suportados (extensível)
    },
    title: { // Título da Evidência (Ex: "Descrição da Fratura", "Radiografia Panorâmica", "Odontograma Inicial")
        type: String,
        required: true
    },
    description: { // Descrição Detalhada da Evidência (Opcional)
        type: String
    },
    data: { // Campo para armazenar os dados da evidência (conteúdo) - tipo 'Mixed' para flexibilidade
        type: mongoose.Schema.Types.Mixed // Permite armazenar diferentes tipos de dados (String, Objeto JSON, URL, etc.)
    },

    category: { // Categoria da Evidência (Achados Periciais, Dados Ante-mortem, etc.) - Opcional inicialmente
        type: String,
        enum: ["achados_periciais", "dados_ante_mortem", "dados_post_mortem", "outros"] // Categorias (extensível) - Opcional para começar
    },
    collectedBy: { // Perito ou Assistente que coletou/registrou a evidência (opcional, para auditoria)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Evidence = mongoose.model('Evidence', evidenceSchema);
module.exports = Evidence;