const Case = require('../models/case');

// Criação da função de criar caso / Cadastrar caso
// para exportar para userRoutes
exports.createCase = async (req, res) => {
    try {
        const { nameCase, Description, status, location, involved, category, createdAt, updateAt } = req.body;
        const cases = new Case({ nameCase, Description, status, location, involved, category, createdAt, updateAt });
        await cases.save();
        res.status(201);
        res.json(cases)
        console.log(`Caso criado com sucesso! Novo Caso: ${cases[nameCase]}!`)
    } catch (err) {
        res.status(400).json({ error: err.message });
        console.log('Erro ao criar o Caso, tente novamente e verifique se preencheu todos os campos')
    }
};

// Listar todos os usuários
// para exportar para userRoutes
exports.getCases = async (req, res) => {
    try {
        const cases = await Case.find();
        res.status(200).json(cases);
        console.log("Todos os casos listados!")
    } catch (err) {
        res.status(400).json({ error: err.message });
        console.log("erro ao listar todos os casos")
    }
};

// Função para filtrar casos por nome
exports.getCasesByName = async (req, res) => {
    try {
        const { nameCase } = req.query;
        if (!nameCase) {
            return res.status(400).json({ error: "Nome do caso não fornecido" });
        }

        const cases = await Case.find({ nameCase: { $regex: nameCase, $options: 'i' } });
        if (cases.length === 0) {
            return res.status(404).json({ message: "Nenhum caso encontrado com esse nome" });
        }

        res.status(200).json(cases);
        console.log(`Casos encontrados com o nome: ${nameCase}`);
    } catch (err) {
        res.status(400).json({ error: err.message });
        console.log("Erro ao filtrar casos por nome");
    }
};

// Função para filtrar casos por status
exports.getCasesByStatus = async (req, res) => {
    try {
        const { status } = req.query;
        if (!status) {
            return res.status(400).json({ error: "Status não fornecido" });
        }

        const cases = await Case.find({ status });
        if (cases.length === 0) {
            return res.status(404).json({ message: "Nenhum caso encontrado com esse status" });
        }

        res.status(200).json(cases);
        console.log(`Casos encontrados com status: ${status}`);
    } catch (err) {
        res.status(400).json({ error: err.message });
        console.log("Erro ao filtrar casos por status");
    }
};

exports.getCasesByData = async (req, res) => {
    try {
      const { startDate, endDate, order } = req.query;
  
      const filter = {};
  
      // Filtro por intervalo de datas (createdAt)
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.createdAt.$lte = new Date(endDate);
        }
      }
  
      // Ordenação por data (padrão: mais novo primeiro, se order = 'oldest', muda pra mais antigo)
      const sortOption = order === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
  
      const cases = await Case.find(filter).sort(sortOption);
  
      if (cases.length === 0) {
        return res.status(404).json({ message: "Nenhum caso encontrado no intervalo de datas fornecido." });
      }
  
      res.status(200).json(cases);
    } catch (err) {
      console.error("Erro ao buscar casos:", err);
      res.status(500).json({ message: "Erro interno do servidor.", error: err.message });
    }
  };