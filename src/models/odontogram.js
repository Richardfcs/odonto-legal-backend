const mongoose = require('mongoose');

// Subdocumento para representar o estado de um dente individual
const toothStateSchema = new mongoose.Schema({
    fdiNumber: { // Notação FDI (ex: "11", "12", ..., "48")
        type: String,
        required: true,
        // Adicionar validação para o formato FDI se desejar (ex: regex)
    },
    status: { // Status geral do dente
        type: String,
        enum: [
            'presente_higido', // Presente e saudável
            'presente_cariado',
            'presente_restaurado',
            'presente_trat_endodontico', // Tratamento endodôntico (canal)
            'presente_com_protese_fixa', // Coroa, pilar de ponte
            'ausente_extraido', // Extraído (com alvéolo cicatrizado)
            'ausente_nao_erupcionado', // Não irrompido (ex: siso incluso)
            'ausente_agenesia', // Agênese (nunca se formou)
            'fraturado',
            'desgaste_acentuado',
            'mobilidade_patologica',
            'extrusao', // Extruído
            'intrusao', // Intruído
            'giroversao', // Girovertido
            'implante', // Dente é um implante
            'outro',
            'nao_examinado'
        ],
        required: true,
        default: 'nao_examinado'
    },
    // Detalhes adicionais baseados no status
    restorations: [{ // Se 'presente_restaurado' ou como observação geral
        surface: { type: String, enum: ['O', 'M', 'D', 'V', 'L', 'P', 'I', 'MOD', 'OD', 'MO', 'etc'] }, // Oclusal, Mesial, Distal, Vestibular, Lingual/Palatina, Incisal
        material: { type: String, enum: ['amalgama', 'resina_composta', 'ionomero_de_vidro', 'ouro', 'porcelana', 'metaloceramica', 'outro'] },
        description: String // Ex: "Restauração extensa"
    }],
    caries: [{ // Se 'presente_cariado'
        surface: { type: String, enum: ['O', 'M', 'D', 'V', 'L', 'P', 'I', 'MOD', 'OD', 'MO', 'etc'] },
        activity: { type: String, enum: ['ativa', 'inativa', 'suspeita'], default: 'ativa' },
        depth: { type: String, enum: ['esmalte', 'dentina_superficial', 'dentina_profunda', 'proxima_a_polpa'], default: 'esmalte' },
        description: String // Ex: "Cárie profunda com exposição pulpar"
    }],
    prosthetics: [{ // Se 'presente_com_protese_fixa' ou relacionado a ausências
        type: { type: String, enum: ['coroa_unitaria', 'pilar_de_ponte', 'elemento_de_ponte_pontico', 'protese_parcial_fixa', 'protese_parcial_removivel', 'protese_total', 'implante_suportado'] },
        material: String, // Ex: "Metalocerâmica", "Zircônia", "Acrílico"
        description: String // Ex: "Ponte de 3 elementos (15-P-17)"
    }],
    endodonticTreatment: { // Se 'presente_trat_endodontico'
        status: { type: String, enum: ['completo', 'incompleto', 'retratamento_necessario', 'lesao_periapical_associada'] },
        date: Date, // Data aproximada do tratamento, se conhecida
        description: String
    },
    fractureDetails: { // Se 'fraturado'
        type: { type: String, enum: ['coroa', 'raiz', 'coroa_raiz'] },
        description: String // Ex: "Fratura oblíqua da coroa", "Fratura vertical da raiz"
    },
    // Adicionar mais campos conforme necessário:
    // - Anomalias de desenvolvimento (forma, número, tamanho, posição)
    // - Lesões periapicais
    // - Doença periodontal (bolsas, recessão)
    // - Desgastes (atrito, abrasão, erosão, abfração)
    observations: String // Observações gerais específicas para este dente
}, { _id: false }); // _id: false para subdocumentos se não precisar consultá-los individualmente de forma complexa

const odontogramSchema = new mongoose.Schema({
    victim: { // Ligação com a Vítima
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Victim',
        required: true,
    },
    case: { // Ligação com o Caso (para facilitar consultas e integridade)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Case',
        required: true,
        index: true
    },
    odontogramType: { // Tipo de odontograma
        type: String,
        enum: ['post_mortem', 'ante_mortem_registro', 'comparativo'],
        required: true,
        default: 'post_mortem'
    },
    examinationDate: { // Data em que o exame odontológico foi realizado
        type: Date,
        default: Date.now
    },
    examiner: { // Perito que realizou o exame
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    teeth: [toothStateSchema], // Array contendo o estado de cada um dos 32 dentes permanentes (ou 20 decíduos)
    generalObservations: String, // Observações gerais sobre a arcada dentária ou o exame
    summaryForIdentification: String, // Um resumo das características chave para identificação

    // Campos para comparação (se for do tipo 'comparativo' ou para auxiliar)
    anteMortemDataSources: [String], // Ex: "Ficha clínica Dr. Silva", "Radiografias Hospital X"
    pointsOfCorrespondence: [{
        postMortemFeature: String, // Descrição da característica post-mortem
        anteMortemFeature: String, // Descrição da característica ante-mortem correspondente
        toothFDI: String,          // Dente(s) envolvido(s)
        certaintyLevel: { type: String, enum: ['alta', 'media', 'baixa'] }
    }],
    discrepancies: [{
        postMortemFeature: String,
        anteMortemFeature: String,
        toothFDI: String,
        explanation: String // Possível explicação para a discrepância
    }],
    identificationConclusion: {
        status: { type: String, enum: ['identificacao_positiva', 'identificacao_provavel', 'dados_insuficientes', 'exclusao', 'pendente'] },
        justification: String,
        identifiedAs: { type: mongoose.Schema.Types.ObjectId, ref: 'Victim' } // Se a identificação positiva linkar a um registro de vítima 'identificada'
    },
    odontogramImageBase64: { type: String }, // Novo campo
    odontogramImageNotes: String,

    // Metadados
    createdBy: { // Redundante se examiner for sempre quem cria, mas útil para auditoria de registro
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, {
    timestamps: true // Adiciona createdAt e updatedAt
});

// --- HOOKS ---

// Hook para garantir que, ao salvar um odontograma, o ID dele seja referenciado na Vítima
odontogramSchema.post('save', async function (doc, next) {
    if (doc && doc.victim && doc.odontogramType === 'post_mortem') { // Apenas para o principal post-mortem
        try {
            const Victim = mongoose.model('Victim');
            await Victim.findByIdAndUpdate(doc.victim, { odontogramPostMortem: doc._id });
        } catch (error) {
            console.error("Erro no hook post-save (Odontogram) para atualizar Victim:", error);
        }
    }
    next();
});

// Hook para limpar a referência na Vítima se o odontograma for deletado
odontogramSchema.post('findOneAndDelete', async function (doc, next) {
    if (doc && doc.victim && doc.odontogramType === 'post_mortem') {
        try {
            const Victim = mongoose.model('Victim');
            // Encontra a vítima e remove a referência ao odontograma (seta para null)
            await Victim.updateOne({ _id: doc.victim, odontogramPostMortem: doc._id }, { $unset: { odontogramPostMortem: "" } });
        } catch (error) {
            console.error("Erro no hook post-findOneAndDelete (Odontogram) para atualizar Victim:", error);
        }
    }
    next();
});

// --- ÍNDICES ---

const Odontogram = mongoose.model('Odontogram', odontogramSchema);
module.exports = Odontogram;