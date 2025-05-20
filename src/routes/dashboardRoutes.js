// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const Case = require('../models/case');
const User = require('../models/user');
const Evidence = require('../models/evidence');
const Report = require('../models/report')
const { Parser } = require('json2csv');
const moment = require('moment');

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
router.get('/main-stats', async (req, res) => {
    try {
        const dateFilter = createDateFilter(
            req.query.period,
            req.query.startDate,
            req.query.endDate
        );

        const [cases, users, evidences, reports] = await Promise.all([
            Case.countDocuments(dateFilter).exec(),
            User.countDocuments(dateFilter).exec(),
            Evidence.countDocuments(dateFilter).exec(),
            Report.countDocuments(dateFilter).exec()
        ]);

        res.json({
            totals: {
                cases: cases || 0,
                users: users || 0,
                evidences: evidences || 0,
                reports: reports || 0
            },
            averages: {
                casesPerUser: users > 0 ? (cases / users).toFixed(2) : 0,
                evidencesPerCase: cases > 0 ? (evidences / cases).toFixed(2) : 0
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
router.get('/case-stats', async (req, res) => {
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
router.get('/users-stats', async (req, res) => {
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
router.get('/cases-timeline', async (req, res) => {
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

router.get('/recent-activity', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        
        const [cases, evidences, reports] = await Promise.all([
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

router.get('/location-stats', async (req, res) => {
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

module.exports = router;
