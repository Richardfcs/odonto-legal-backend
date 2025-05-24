// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const Case = require('../models/case');
const User = require('../models/user');
const Evidence = require('../models/evidence');
const Report = require('../models/report');
const Victim = require('../models/victim');
const { Parser } = require('json2csv');
const moment = require('moment-timezone');
const { verifyJWT, authorize } = require('../middleware/auth');


const {
    startOfToday,
    subWeeks,
    subMonths,
    subYears,
    startOfDay,
    endOfDay
} = require('date-fns');

// Helper de filtro de datas reformulado
const createDateFilter = (period, customStart, customEnd) => {
    const filter = {};
    const now = new Date();

    if (period === 'custom' && customStart && customEnd) {
        filter.createdAt = {
            $gte: new Date(customStart),
            $lte: new Date(customEnd)
        };
    } else {
        switch (period) {
            case 'today':
                filter.createdAt = {
                    $gte: startOfToday(),
                    $lte: now
                };
                break;
            case 'last-week':
                filter.createdAt = {
                    $gte: subWeeks(startOfToday(), 1),
                    $lte: now
                };
                break;
            case 'last-month':
                filter.createdAt = {
                    $gte: subMonths(startOfToday(), 1),
                    $lte: now
                };
                break;
            case 'last-year':
                filter.createdAt = {
                    $gte: subYears(startOfToday(), 1),
                    $lte: now
                };
                break;
            default:
                break;
        }
    }

    return Object.keys(filter).length > 0 ? filter : null;
};

// Rota principal de estatísticas
router.get('/main-stats', verifyJWT, authorize(['admin']), async (req, res) => {
    try {
        const dateFilter = createDateFilter(
            req.query.period,
            req.query.startDate,
            req.query.endDate
        );

        const [cases, victims, users, evidences, reports] = await Promise.all([
            Case.countDocuments(dateFilter).exec(),
            Victim.countDocuments(dateFilter || {}).exec(),
            User.countDocuments(dateFilter).exec(),
            Evidence.countDocuments(dateFilter).exec(),
            Report.countDocuments(dateFilter).exec()
        ]);

        res.json({
            totals: {
                cases: cases || 0,
                victims: victims || 0,
                users: users || 0,
                evidences: evidences || 0,
                reports: reports || 0,
            },
            averages: {
                casesPerUser: users > 0 ? (cases / users).toFixed(2) : 0,
                evidencesPerCase: cases > 0 ? (evidences / cases).toFixed(2) : 0,
                victimsPerCase: cases > 0 ? (victims / cases).toFixed(2) : 0 // Média de vítimas por caso
            }
        });

    } catch (error) {
        console.error('Erro em /main-stats:', error);
        res.status(500).json({
            error: 'Erro ao carregar estatísticas principais',
            details: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Estatísticas de casos aprimoradas
router.get('/case-stats', verifyJWT, authorize(['admin']), async (req, res) => {
    try {
        const { type = 'status', period } = req.query;
        const dateFilter = createDateFilter(period);

        const groupBy = type === 'status' ? '$status' : '$category';

        const stats = await Case.aggregate([
            { $match: dateFilter || {} },
            {
                $group: {
                    _id: groupBy,
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    name: "$_id",
                    count: 1,
                    _id: 0
                }
            }
        ]);

        // Preencher valores zerados
        const allOptions = type === 'status'
            ? ["em andamento", "finalizado", "arquivado"]
            : ["acidente", "identificação de vítima", "exame criminal", "outros"];

        const completeStats = allOptions.map(opt => ({
            name: opt,
            count: stats.find(s => s.name === opt)?.count || 0
        }));

        res.json({
            type,
            stats: completeStats,
            total: completeStats.reduce((acc, cur) => acc + cur.count, 0)
        });

    } catch (error) {
        console.error('Erro em /case-stats:', error);
        res.status(500).json({
            error: 'Erro ao carregar estatísticas',
            details: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Estatísticas de usuários com dados de atividade
router.get('/users-stats', verifyJWT, authorize(['admin']), async (req, res) => {
    try {
        const { role, period } = req.query;
        const dateFilter = createDateFilter(period);

        const match = {
            ...dateFilter,
            role: role ? { $eq: role } : { $exists: true }
        };

        const stats = await User.aggregate([
            { $match: match },
            {
                $facet: {
                    totalCount: [{ $count: "total" }],
                    roles: [
                        { $group: { _id: "$role", count: { $sum: 1 } } }
                    ]
                }
            },
            {
                $project: {
                    total: { $ifNull: [{ $arrayElemAt: ["$totalCount.total", 0] }, 0] },
                    roles: {
                        $map: {
                            input: "$roles",
                            as: "r",
                            in: {
                                role: "$$r._id",
                                count: "$$r.count"
                            }
                        }
                    }
                }
            }
        ]);

        res.json(stats[0]);

    } catch (error) {
        console.error('Erro em /users-stats:', error);
        res.status(500).json({
            error: 'Erro ao carregar estatísticas de usuários',
            details: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Timeline de casos com timezone
router.get('/cases-timeline', verifyJWT, authorize(['admin']), async (req, res) => {
    try {
        const dateFilter = createDateFilter(
            req.query.period,
            req.query.startDate,
            req.query.endDate
        );

        const pipeline = [
            { $match: dateFilter || {} },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$createdAt",
                            timezone: "America/Sao_Paulo"
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ];

        const timeline = await Case.aggregate(pipeline);
        res.json(timeline);

    } catch (error) {
        console.error('Erro em /cases-timeline:', error);
        res.status(500).json({
            error: 'Erro ao carregar timeline',
            details: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Atividades recentes feitos na aplicação
router.get('/recent-activity', verifyJWT, authorize(['admin']), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;

        const [cases, evidences, reports, victims] = await Promise.all([
            Case.find()
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean(),
            Evidence.find()
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean(),
            Report.find()
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate('caseId', 'nameCase')
                .lean(),
            Victim.find()
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate('case', 'nameCase victimCode') // Popula informações do caso
                .lean()
        ]);

        res.json({
            cases: cases.map(c => ({
                ...c,
                createdAt: c.createdAt,
                nameCase: c.nameCase
            })),
            evidences: evidences.map(e => ({
                ...e,
                createdAt: e.createdAt,
                title: e.title
            })),
            reports: reports.map(r => ({
                ...r,
                createdAt: r.createdAt,
                caseId: r.caseId?.nameCase || 'N/A'
            })),
            victims: victims.map(v => ({
                ...v,
                createdAt: v.createdAt,
                caseInfo: v.case ? {
                    name: v.case.nameCase,
                    code: v.case.victimCode
                } : 'Não vinculado',
                status: v.identificationStatus || 'Não identificado'
            }))
        });

    } catch (error) {
        console.error('Erro em /recent-activity:', error);
        res.status(500).json({
            error: 'Erro ao carregar atividades recentes',
            details: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Estatisticas das Localizações de casos
router.get('/location-stats', verifyJWT, authorize(['admin']), async (req, res) => {
    try {
        const dateFilter = createDateFilter(req.query.period);

        const result = await Case.aggregate([
            { $match: dateFilter || {} },
            {
                $group: {
                    _id: "$location",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            {
                $group: {
                    _id: null,
                    locations: { $push: "$$ROOT" },
                    uniqueCount: { $sum: 1 },
                    topLocation: { $first: "$$ROOT" }
                }
            },
            {
                $project: {
                    _id: 0,
                    locations: 1,
                    uniqueCount: 1,
                    topLocation: {
                        name: "$topLocation._id",
                        count: "$topLocation.count"
                    }
                }
            }
        ]);

        res.json(result[0] || {
            locations: [],
            uniqueCount: 0,
            topLocation: null
        });

    } catch (error) {
        console.error('Erro em /location-stats:', error);
        res.status(500).json({
            error: 'Erro ao carregar dados geográficos',
            details: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Estatísticas de Vítimas por Status de Identificação, Gênero, Etnia, etc.
router.get('/victim-demographics-stats', verifyJWT, authorize(['admin']), async (req, res) => {
    try {
        const { period, groupBy = 'identificationStatus' } = req.query; // groupBy pode ser 'gender', 'ethnicityRace', etc.
        const dateFilter = createDateFilter(period, req.query.startDate, req.query.endDate, 'dateOfDiscovery'); // Filtrar pela data de descoberta da vítima

        const validGroupBys = ['identificationStatus', 'gender', 'ethnicityRace', 'mannerOfDeath', 'causeOfDeathPrimary', 'discoveryLocation.type', 'timeOfDayDiscovery', 'bodyMassIndexCategory'];
        if (!validGroupBys.includes(groupBy)) {
            return res.status(400).json({ error: "Parâmetro 'groupBy' inválido." });
        }

        const stats = await Victim.aggregate([
            { $match: dateFilter || {} }, // Aplicar filtro de data
            {
                $group: {
                    _id: `$${groupBy}`, // Agrupa pelo campo especificado
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    name: "$_id", // Renomeia _id para name para consistência com charts
                    count: 1,
                    _id: 0
                }
            },
            { $sort: { name: 1 } } // Ordena para melhor visualização
        ]);

        // Para preencher com zeros, você precisaria dos enums do modelo Victim
        // Exemplo para identificationStatus:
        let completeStats = stats;
        if (groupBy === 'identificationStatus') {
            const allOptions = Victim.schema.path('identificationStatus').enumValues;
            completeStats = allOptions.map(opt => ({
                name: opt || 'Não Especificado', // Lidar com _id null se houver
                count: stats.find(s => s.name === opt)?.count || 0
            }));
        }
        // Adicionar lógica similar para outros 'groupBy' se precisar de preenchimento com zeros

        res.json({
            type: groupBy,
            stats: completeStats,
            total: completeStats.reduce((acc, cur) => acc + cur.count, 0)
        });

    } catch (error) {
        console.error(`Erro em /victim-demographics-stats (groupBy: ${req.query.groupBy}):`, error);
        res.status(500).json({
            error: 'Erro ao carregar estatísticas demográficas de vítimas',
            details: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// Estatísticas de Vítimas por Faixa Etária (usando estimatedAgeRange)
router.get('/victim-age-stats', verifyJWT, authorize(['admin']), async (req, res) => {
    try {
        const { period } = req.query;
        const dateFilter = createDateFilter(period, req.query.startDate, req.query.endDate, 'dateOfDiscovery');

        // Definir as faixas etárias para agregação
        const ageBuckets = [
            { min: 0, max: 17, label: "0-17 (Menor)" },
            { min: 18, max: 29, label: "18-29" },
            { min: 30, max: 39, label: "30-39" },
            { min: 40, max: 49, label: "40-49" },
            { min: 50, max: 59, label: "50-59" },
            { min: 60, max: Infinity, label: "60+" },
            { min: null, max: null, label: "Idade Desconhecida/Não Estimada" } // Para quem não tem ageAtDeath nem estimatedAgeRange.min
        ];

        const stats = await Victim.aggregate([
            { $match: dateFilter || {} },
            {
                $project: {
                    // Usar ageAtDeath se disponível, senão a média do estimatedAgeRange
                    // Ou uma lógica mais sofisticada para categorizar baseado no range
                    effectiveAge: {
                        $cond: {
                            if: { $gt: ["$ageAtDeath", null] },
                            then: "$ageAtDeath",
                            else: { // Se ageAtDeath é null, tenta usar o meio do estimatedAgeRange
                                $cond: {
                                    if: { $and: [{ $gt: ["$estimatedAgeRange.min", null] }, { $gt: ["$estimatedAgeRange.max", null] }] },
                                    then: { $divide: [{ $add: ["$estimatedAgeRange.min", "$estimatedAgeRange.max"] }, 2] },
                                    else: null // Se não tem nem ageAtDeath nem estimatedAgeRange completo
                                }
                            }
                        }
                    }
                }
            },
            {
                $bucket: {
                    groupBy: "$effectiveAge",
                    boundaries: [0, 18, 30, 40, 50, 60], // Limites inferiores das faixas (0-17, 18-29, etc.)
                    default: "Idade Desconhecida/Não Estimada", // Onde colocar os nulos ou fora das faixas
                    output: {
                        count: { $sum: 1 }
                    }
                }
            },
            {
                $project: {
                    name: { // Mapear _id (limite inferior) para a label da faixa
                        $switch: {
                            branches: ageBuckets.filter(b => b.min !== null).map(b => ({
                                case: { $eq: ["$_id", b.min] },
                                then: b.label
                            })),
                            default: "$_id" // Para o bucket 'default' (Idade Desconhecida)
                        }
                    },
                    count: 1,
                    _id: 0
                }
            }
        ]);

        // Garantir que todas as faixas definidas em ageBuckets apareçam, mesmo com contagem 0
        const completeStats = ageBuckets.map(bucket => {
            const foundStat = stats.find(s => s.name === bucket.label);
            return {
                name: bucket.label,
                count: foundStat ? foundStat.count : 0
            };
        });


        res.json({
            type: 'ageDistribution',
            stats: completeStats,
            total: completeStats.reduce((acc, cur) => acc + cur.count, 0)
        });

    } catch (error) {
        console.error('Erro em /victim-age-stats:', error);
        res.status(500).json({ /* ... seu tratamento de erro ... */ });
    }
});

// Timeline de Vítimas (baseado na data de descoberta)
router.get('/victims-timeline', verifyJWT, authorize(['admin']), async (req, res) => {
    try {
        const dateFilter = createDateFilter(
            req.query.period,
            req.query.startDate,
            req.query.endDate,
            'dateOfDiscovery' // Usar data de descoberta da vítima
        );

        const pipeline = [
            { $match: dateFilter || {} },
            { $match: { dateOfDiscovery: { $ne: null } } }, // Considerar apenas vítimas com data de descoberta
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d", // Agrupar por dia
                            date: "$dateOfDiscovery",
                            timezone: "America/Sao_Paulo" // Ajuste o timezone conforme necessário
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } } // Ordenar por data
        ];

        const timeline = await Victim.aggregate(pipeline);
        res.json(timeline);

    } catch (error) {
        console.error('Erro em /victims-timeline:', error);
        res.status(500).json({ /* ... seu tratamento de erro ... */ });
    }
});

// ---- AREA DE EXPORTAÇÃO CSV ---

// Exportação de Casos com Filtros
router.get('/export/cases', async (req, res) => {
    try {
        const { period, status, category } = req.query;
        const dateFilter = createDateFilter(period);

        const query = {
            ...dateFilter,
            ...(status && status !== 'all' && { status }),
            ...(category && category !== 'all' && { category })
        };

        const cases = await Case.find(query)
            .populate('responsibleExpert', 'name')
            .lean();

        const fields = [
            { label: 'Nome do Caso', value: 'nameCase' },
            { label: 'Descrição', value: 'Description' },
            { label: 'Status', value: 'status' },
            { label: 'Categoria', value: 'category' },
            { label: 'Localização', value: 'location' },
            { label: 'Responsável', value: 'responsibleExpert.name' },
            { label: 'Data Criação', value: 'createdAt' }
        ];

        const parser = new Parser({ fields, delimiter: ';' });
        const csv = parser.parse(cases);
        const filename = `casos-${moment().format('YYYYMMDD-HHmmss')}.csv`;
        console.log("Backend generated filename:", filename);
        res.header('Content-Type', 'text/csv');
        res.attachment(filename);
        res.send(csv);

    } catch (error) {
        console.error('Erro na exportação de casos:', error);
        res.status(500).attachment('erro-exportacao.csv').send('Erro na geração do arquivo');
    }
});

// Exportação de Usuários com Filtros
router.get('/export/users', async (req, res) => {
    try {
        const { period, role } = req.query;
        const dateFilter = createDateFilter(period);

        const query = {
            ...dateFilter,
            ...(role && role !== 'all' && { role })
        };

        const users = await User.find(query).lean();

        const fields = [
            { label: 'Nome', value: 'name' },
            { label: 'Email', value: 'email' },
            { label: 'Telefone', value: 'telephone' },
            { label: 'CRO', value: 'cro' },
            { label: 'Função', value: 'role' },
            { label: 'Último Login', value: 'lastLogin' },
            { label: 'Data Cadastro', value: 'createdAt' }
        ];

        const parser = new Parser({ fields, delimiter: ';' });
        const csv = parser.parse(users);

        const filename = `usuarios-${moment().format('YYYYMMDD-HHmmss')}.csv`;
        res.header('Content-Type', 'text/csv');
        res.attachment(filename);
        res.send(csv);

    } catch (error) {
        console.error('Erro na exportação de usuários:', error);
        res.status(500).attachment('erro-exportacao.csv').send('Erro na geração do arquivo');
    }
});

// Exportação de Evidências
router.get('/export/evidences', async (req, res) => {
    try {
        const evidences = await Evidence.find()
            .populate('caseId', 'nameCase')
            .lean();

        const fields = [
            { label: 'Título', value: 'title' },
            { label: 'Caso Relacionado', value: 'caseId.nameCase' },
            { label: 'Tipo', value: 'evidenceType' },
            { label: 'Categoria', value: 'category' },
            { label: 'Registrado Por', value: 'collectedBy' },
            { label: 'Data Criação', value: 'createdAt' }
        ];

        const parser = new Parser({ fields, delimiter: ';' });
        const csv = parser.parse(evidences);

        res.header('Content-Type', 'text/csv');
        res.attachment(`evidencias-${Date.now()}.csv`);
        res.send(csv);

    } catch (error) {
        console.error('Erro na exportação de evidências:', error);
        res.status(500).send('Erro na exportação');
    }
});

// --- EXPORTAÇÃO CSV PARA VÍTIMAS ---
router.get('/export/victims', async (req, res) => {
    try {
        const { period, identificationStatus, gender, municipality } = req.query;
        // Usar 'dateOfDiscovery' ou 'createdAt' para o filtro de período, dependendo do que faz mais sentido
        const dateFilter = createDateFilter(period, req.query.startDate, req.query.endDate, 'dateOfDiscovery');

        const query = {
            ...(dateFilter || {}), // Aplicar filtro de data se existir
            ...(identificationStatus && identificationStatus !== 'all' && { identificationStatus }),
            ...(gender && gender !== 'all' && { gender }),
            ...(municipality && { 'discoveryLocation.municipality': { $regex: municipality, $options: 'i' } })
        };

        const victims = await Victim.find(query)
            .populate('case', 'nameCase victimCode') // Adicionar victimCode do caso se existir no modelo Case
            .populate('createdBy', 'name')
            .lean(); // .lean() para objetos JS puros, melhor para json2csv

        if (victims.length === 0) {
            return res.status(404).send('Nenhuma vítima encontrada para os critérios de exportação.');
        }

        const fields = [
            // Identificação Básica
            { label: 'Código Vítima', value: 'victimCode' },
            { label: 'Caso (Nome)', value: 'case.nameCase' },
            // { label: 'Caso (Código)', value: 'case.victimCode' }, // Se o modelo Case tiver victimCode
            { label: 'Status Identificação', value: 'identificationStatus' },
            { label: 'Nome', value: 'name' },
            // Demografia
            { label: 'Idade Registrada', value: 'ageAtDeath' },
            { label: 'Idade Estimada (Min)', value: 'estimatedAgeRange.min' },
            { label: 'Idade Estimada (Max)', value: 'estimatedAgeRange.max' },
            { label: 'Gênero', value: 'gender' },
            { label: 'Etnia/Raça', value: 'ethnicityRace' },
            { label: 'Estatura (cm)', value: 'statureCm' },
            { label: 'Categoria IMC', value: 'bodyMassIndexCategory' },
            // Contexto Descoberta/Morte
            { label: 'Data da Descoberta', value: row => row.dateOfDiscovery ? moment(row.dateOfDiscovery).tz("America/Sao_Paulo").format('DD/MM/YYYY') : '' },
            { label: 'Período Descoberta', value: 'timeOfDayDiscovery' },
            { label: 'Local Descoberta (Tipo)', value: 'discoveryLocation.type' },
            { label: 'Local Descoberta (Descrição)', value: 'discoveryLocation.description' },
            { label: 'Município Descoberta', value: 'discoveryLocation.municipality' },
            { label: 'Estado Descoberta', value: 'discoveryLocation.state' },
            { label: 'Latitude', value: row => row.discoveryLocation?.coordinates?.coordinates?.[1] || '' },
            { label: 'Longitude', value: row => row.discoveryLocation?.coordinates?.coordinates?.[0] || '' },
            { label: 'Circunstância Morte', value: 'mannerOfDeath' },
            { label: 'Causa Primária Morte', value: 'causeOfDeathPrimary' },
            // Dados Odontolegais e Identificação
            { label: 'Registro Dental (Status)', value: 'dentalRecordStatus' },
            { label: 'Registro Dental (Fonte)', value: 'dentalRecordSource' },
            // { label: 'ID Odontograma Post-Mortem', value: 'odontogramPostMortem' }, // Apenas o ID
            // Dados Forenses Adicionais
            { label: 'IPM Estimado (Min Horas)', value: 'postMortemIntervalEstimate.minHours' },
            { label: 'IPM Estimado (Max Horas)', value: 'postMortemIntervalEstimate.maxHours' },
            { label: 'IPM Método', value: 'postMortemIntervalEstimate.estimationMethod' },
            { label: 'Toxicologia (Realizada)', value: 'toxicologyScreening.performed' },
            { label: 'Toxicologia (Sumário)', value: 'toxicologyScreening.resultsSummary' },
            { label: 'DNA (Coletada)', value: 'dnaAnalysis.sampleCollected' },
            { label: 'DNA (Perfil Obtido)', value: 'dnaAnalysis.profileObtained' },
            { label: 'DNA (Resultado Comparação)', value: 'dnaAnalysis.comparisonResult' },
            // Metadados
            { label: 'Notas Adicionais', value: 'additionalNotes' },
            { label: 'Registrado Por', value: 'createdBy.name' },
            { label: 'Data de Registro no Sistema', value: row => moment(row.createdAt).tz("America/Sao_Paulo").format('DD/MM/YYYY HH:mm') }
        ];

        // Remover campos que podem não existir para evitar erros no json2csv se forem estritamente string
        const cleanedVictims = victims.map(v => {
            const cleanV = { ...v };
            if (cleanV.estimatedAgeRange === undefined) cleanV.estimatedAgeRange = {};
            if (cleanV.discoveryLocation === undefined) cleanV.discoveryLocation = { coordinates: {} };
            if (cleanV.discoveryLocation.coordinates === undefined) cleanV.discoveryLocation.coordinates = {};
            if (cleanV.postMortemIntervalEstimate === undefined) cleanV.postMortemIntervalEstimate = {};
            if (cleanV.toxicologyScreening === undefined) cleanV.toxicologyScreening = {};
            if (cleanV.dnaAnalysis === undefined) cleanV.dnaAnalysis = {};
            if (cleanV.case === undefined) cleanV.case = {}; // Para case.nameCase
            if (cleanV.createdBy === undefined) cleanV.createdBy = {}; // Para createdBy.name
            return cleanV;
        });


        const parser = new Parser({ fields, delimiter: ';', header: true, excelStrings: true }); // Adicionado excelStrings
        const csv = parser.parse(cleanedVictims);
        const filename = `vitimas-${moment().format('YYYYMMDD-HHmmss')}.csv`;

        res.header('Content-Type', 'text/csv; charset=utf-8'); // Adicionado charset
        res.attachment(filename);
        res.send(Buffer.from(csv, 'utf-8')); // Enviar como buffer com codificação correta

    } catch (error) {
        console.error('Erro na exportação de vítimas:', error);
        res.status(500).type('text/plain').send('Erro na geração do arquivo CSV de vítimas.');
    }
});

module.exports = router;
