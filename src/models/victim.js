const mongoose = require('mongoose');

const victimSchema = new mongoose.Schema({
    // --- IDENTIFICAÇÃO FUNDAMENTAL ---
    case: { // Ligação com o Caso
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Case',
        required: true,
        index: true
    },
    victimCode: { // Código único para a vítima dentro do sistema/caso (ex: V001-CASOXYZ)
        type: String,
        required: true,
        unique: true, // 'unique' global pode ser demais se o código for por caso. Se for global, mantenha.
                      // Considere uma validação composta (case + victimCode) se for único por caso.
        index: true
    },
    identificationStatus: { // Status da identificação
        type: String,
        enum: ['identificada', 'nao_identificada', 'parcialmente_identificada', 'em_processo_de_identificacao'],
        required: true,
        default: 'nao_identificada',
        index: true
    },
    name: { // Nome da vítima
        type: String,
        // Torna obrigatório apenas se identificada
        required: function() { return this.identificationStatus === 'identificada' || this.identificationStatus === 'parcialmente_identificada'; },
        default: function() { return this.identificationStatus === 'nao_identificada' ? 'Desconhecida' : undefined; }
    },

    // --- DADOS DEMOGRÁFICOS ---
    // Idade: usar um ou outro, ou ambos para diferentes estágios
    ageAtDeath: { // Idade exata no momento da morte (se conhecida)
        type: Number,
        min: 0
    },
    estimatedAgeRange: { // Faixa etária estimada (odontolegalmente ou antropologicamente)
        min: { type: Number, min: 0 }, // Ex: 20
        max: { type: Number, min: 0 }  // Ex: 30
        // Validação: max >= min
    },
    // Se quiser faixas pré-definidas para gráficos, pode adicionar um campo virtual ou calcular no frontend/backend
    // Ou um campo adicional:
    ageCategoryForGraphics: { type: String, enum: ['criança', 'adolescente', 'jovem_adulto', 'adulto_meia_idade', 'idoso', 'indeterminado']},

    gender: { // Sexo biológico/atribuído ao nascer, importante para algumas análises forenses
        type: String,
        enum: ['masculino', 'feminino', 'intersexo', 'indeterminado', 'desconhecido'],
        default: 'desconhecido'
    },
     genderIdentity: { // Opcional, mas bom para dados sociais mais completos
         type: String,
         enum: ['homem_cis', 'mulher_cis', 'homem_trans', 'mulher_trans', 'nao_binario', 'outro', 'desconhecido'],
         default: 'desconhecido'
    },
    ethnicityRace: { // Cor/Raça (Padrão IBGE ou similar)
        type: String,
        enum: ['branca', 'preta', 'parda', 'amarela', 'indigena', 'nao_declarada', 'desconhecida'],
        default: 'desconhecida'
    },
    statureCm: { // Estatura em centímetros (pode ser estimada)
        type: Number,
        min: 0
    },
    bodyMassIndexCategory: { // Categoria de IMC (calculado a partir de peso/altura se disponíveis)
        type: String,
        enum: ['baixo_peso', 'eutrofico', 'sobrepeso', 'obesidade_grau_I', 'obesidade_grau_II', 'obesidade_grau_III', 'indeterminado', 'desconhecido'],
        default: 'desconhecido'
    },

    // --- DADOS DE CONTATO E ENDEREÇO (se identificada) ---
    contact: {
        telephone: String,
        email: String
    },
    lastKnownAddress: {
        street: String,
        number: String,
        complement: String,
        neighborhood: String,
        city: String,
        state: String,
        zipCode: String,
        country: { type: String, default: 'Brasil' }
    },

    // --- CONTEXTO DA DESCOBERTA / MORTE ---
    // (Alguns destes podem vir do 'Case', mas registrar aqui pode ser útil se houver múltiplas vítimas com contextos diferentes)
    dateOfDeath: { // Data estimada ou confirmada da morte
        type: Date
    },
    timeOfDeath: { // Hora estimada ou confirmada da morte
        type: String // Formato HH:MM
    },
    dateOfDiscovery: { // Data em que o corpo foi encontrado
        type: Date,
        index: true
    },
    timeOfDayDiscovery: { // Período do dia da descoberta
        type: String,
        enum: ['madrugada (0h-6h)', 'manha (6h-12h)', 'tarde (12h-18h)', 'noite (18h-0h)', 'desconhecido'],
        default: 'desconhecido'
    },
    discoveryLocation: { // Local da descoberta do corpo
        description: String, // Descrição textual, ex: "Margem da BR-101, km 50"
        type: { // Tipo de local
            type: String,
            enum: ['residencia', 'via_publica', 'area_comercial', 'area_industrial', 'area_rural', 'mata_floresta', 'corpo_dagua', 'veiculo', 'outro', 'desconhecido'],
            default: 'desconhecido',
            index: true
        },
        municipality: String, // Município do fato
        state: String,       // Estado do fato
        coordinates: {       // Para georreferenciamento
            type: {
                type: String,
                enum: ['Point'],
                // required: true // Se coordenadas forem sempre obrigatórias
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                // required: true
            }
        }
    },
    mannerOfDeath: { // Circunstância da morte (legal)
        type: String,
        enum: ['homicidio', 'suicidio', 'acidente', 'natural', 'indeterminada_legalmente', 'pendente_de_investigacao'],
        default: 'pendente_de_investigacao'
    },
    causeOfDeathPrimary: { // Causa primária da morte (médico-legal)
        type: String, // Ex: "Traumatismo cranioencefálico", "Asfixia mecânica"
                     // Pode ser um enum extenso ou texto livre com padronização.
        enum: ['trauma_contuso', 'ferimento_arma_branca', 'ferimento_arma_fogo', 'asfixia', 'intoxicacao', 'queimadura', 'afogamento', 'causa_natural_especifica', 'indeterminada_medicamente'],
        default: 'indeterminada_medicamente'
    },
    // causeOfDeathSecondary: [String], // Causas contribuintes (opcional)

    // --- DADOS ODONTOLEGAIS ---
    dentalRecordStatus: { // Status dos registros odontológicos ante-mortem
        type: String,
        enum: ['disponivel_e_utilizado', 'disponivel_mas_inconclusivo', 'disponivel_nao_utilizado', 'nao_disponivel', 'busca_em_andamento', 'desconhecido'],
        default: 'desconhecido'
    },
    dentalRecordSource: String, // Fonte do registro odontológico (ex: Clínica X, Hospital Y)
    
    odontogramPostMortem: { // Referência ao Odontograma Post-Mortem (modelo a ser criado)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Odontogram' // Futuro modelo Odontogram
    },
    // Para dados dentários diretos ANTES de um modelo Odontogram completo, ou para sumário:
    // (Considerar se isso não será redundante com o modelo Odontogram)
    // dentalKeyFeatures: {
    //     missingTeethFDI: [String], // Array de números FDI dos dentes ausentes. Ex: ["18", "23", "46"]
    //     notableRestorations: [{
    //         toothFDI: String, // Ex: "11"
    //         material: String, // Ex: "resina_composta", "amalgama", "coroa_metaloceramica"
    //         surface: String   // Ex: "Oclusal", "Mesial (M)", "MOD"
    //     }],
    //     prosthetics: [{
    //         type: String, // Ex: "ponte_fixa_3_elementos", "protese_parcial_removivel", "implante"
    //         locationDescription: String // Ex: "Região de 14 a 16"
    //     }],
    //     oralPathologiesObserved: [String], // Ex: "carie_extensa_26", "periodontite_severa_generalizada", "lesao_periapical_37"
    //     developmentalAnomalies: [String] // Ex: "agenesia_12_22", "dente_supranumerario_regiao_11"
    // },

    // --- DADOS ANTROPOLÓGICOS E DE IDENTIFICAÇÃO FÍSICA ---
    skeletalFeatures: [String], // Características esqueléticas notáveis para identificação
    otherDistinctivePhysicalFeatures: [String], // Tatuagens, cicatrizes, piercings, etc. (Model 2 tinha 'distinctiveFeatures')

    // --- DADOS FORENSES ADICIONAIS ---
    postMortemIntervalEstimate: { // Intervalo post-mortem (IPM)
        minHours: Number,
        maxHours: Number,
        estimationMethod: String // Ex: "Sinais cadavéricos", "Entomologia forense"
    },
    toxicologyScreening: {
        performed: { type: Boolean, default: false },
        resultsSummary: String, // Ex: "Positivo para Etanol (1.5g/L) e Cocaína"
        substancesDetected: [{
            name: String,
            quantity: String, // Ex: "1.5 g/L", "Traços"
            type: { type: String, enum: ['alcool', 'droga_ilicita', 'medicamento_controlado', 'veneno', 'outro'] }
        }]
    },
    dnaAnalysis: {
        sampleCollected: { type: Boolean, default: false },
        profileObtained: { type: Boolean, default: false },
        comparisonResult: String // Ex: "Compatível com familiar X", "Perfil inserido no CODIS/RIBPG"
    },
    fingerprintAnalysis: {
        collected: { type: Boolean, default: false },
        quality: { type: String, enum: ['boa', 'regular', 'ruim', 'inviavel'] },
        comparisonResult: String // Ex: "Identificação positiva - João Silva", "Sem correspondência no AFIS"
    },

    // --- METADADOS ---
    photosUrls: [String], // Array de URLs para fotos (ante-mortem, post-mortem, local, etc.)
    // documentsUrls: [String], // Array de URLs para documentos associados (RG, certidão, etc.)
    additionalNotes: String, // Campo para notas e observações adicionais do perito

    // Quem registrou/atualizou (do Model 1)
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // required: true // Se sempre soubermos quem criou
    },
    lastUpdatedBy: { // Renomeado de 'updatedBy' para clareza
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true // Adiciona createdAt e updatedAt automaticamente (do Model 1)
});

// --- ÍNDICES (do Model 1, adaptados e expandidos) ---
victimSchema.index({ identificationStatus: 1, ethnicityRace: 1, gender: 1 }); // Para gráficos demográficos
victimSchema.index({ 'discoveryLocation.municipality': 1, 'discoveryLocation.state': 1 });
victimSchema.index({ 'discoveryLocation.coordinates': '2dsphere' }); // Para buscas geoespaciais (do Model 1)
victimSchema.index({ causeOfDeathPrimary: 1 });
victimSchema.index({ mannerOfDeath: 1 });

// --- HOOKS (do Model 2, para manter a ligação com o Caso) ---
// Adicionar vítima ao array 'victims' do caso relacionado
victimSchema.post('save', async function(doc, next) {
    if (doc && doc.case) { // Garante que doc e doc.case existem
        try {
            // Usar require aqui para evitar problemas de dependência circular se Case importar Victim
            const Case = mongoose.model('Case');
            await Case.findByIdAndUpdate(doc.case, { $addToSet: { victims: doc._id } });
        } catch (error) {
            console.error("Erro no hook post-save (Victim) para atualizar Case:", error);
            // Considerar como lidar com este erro. Chamar next(error) pode impedir o save.
            // Por ora, apenas logamos.
        }
    }
    next();
});

// Remover vítima do array 'victims' do caso ao deletar a vítima (via findOneAndDelete)
victimSchema.post('findOneAndDelete', async function(doc, next) {
    if (doc && doc.case) {
        try {
            const Case = mongoose.model('Case');
            await Case.findByIdAndUpdate(doc.case, { $pull: { victims: doc._id } });
        } catch (error) {
            console.error("Erro no hook post-findOneAndDelete (Victim) para atualizar Case:", error);
        }
    }
    next();
});
// Adicionar hook similar para deleteMany se você usar essa operação
victimSchema.post('deleteMany', async function(result, next) {
    // Este hook é mais complexo para atualizar os casos, pois 'this' se refere à query.
    // Você precisaria buscar os documentos deletados se quisesse seus 'case' IDs.
    // Por simplicidade, pode ser melhor garantir que as remoções de 'victims' do 'Case'
    // sejam tratadas na lógica de serviço que chama deleteMany.
    console.warn("Victim.deleteMany hook: Atualização de 'Case.victims' não implementada automaticamente para deleteMany.");
    next();
});


const Victim = mongoose.model('Victim', victimSchema);
module.exports = Victim;