const User = require('../models/user'); // Garanta que esta linha está presente
const Case = require('../models/case');

// Criação da função de criar caso / Cadastrar caso
// para exportar para userRoutes
exports.createCase = async (req, res) => {
    try {
        // 1. O responsável é o usuário autenticado
        const responsibleExpert = req.userId;

        // 2. Valide se o perito existe
        const perito = await User.findById(responsibleExpert);
        if (!perito) {
            return res.status(404).json({ error: "Perito não encontrado." });
        }

        // 3. Extraia campos OBRIGATÓRIOS do body
        const { 
            nameCase, 
            Description, 
            status, 
            location,
            dateCase,
            hourCase, 
            category, 
            team 
        } = req.body;

        // 4. Valide campos obrigatórios
        if (!nameCase || !status || !location || !category) {
            return res.status(400).json({ 
                error: "Campos obrigatórios faltando: nameCase, status, location, category." 
            });
        }

        // 5. Crie o caso
        const newCase = new Case({
            nameCase,
            Description,
            status,
            location,
            category,
            dateCase,
            hourCase,
            responsibleExpert, // Usa o ID do usuário logado
            team: team || []   // Se não houver equipe, define como array vazio
        });

        await newCase.save();

        // 6. Atualize os usuários vinculados (perito e equipe)
        await User.findByIdAndUpdate(
            responsibleExpert,
            { $push: { cases: newCase._id } }
        );

        if (team && team.length > 0) {
            await User.updateMany(
                { _id: { $in: team } },
                { $push: { cases: newCase._id } }
            );
        }

        // 7. Retorne resposta
        res.status(201).json({
            message: "Caso criado com sucesso!",
            case: newCase
        });

    } catch (err) {
        console.error("Erro no createCase:", err.message);
        res.status(400).json({ 
            error: "Erro ao criar caso.",
            details: err.message 
        });
    }
};

// Listar todos os usuários
// para exportar para userRoutes
exports.getCases = async (req, res) => {
    try {
        const cases = await Case.find()
            .populate('responsibleExpert', 'name email role') // Popula apenas nome, email e role
            .populate('team', 'name')
            .populate('evidences');
        res.status(200).json(cases);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getCaseById = async (req, res) => {
    try {
        const caso = await Case.findById(req.params.id)
            .populate('evidences', 'title evidenceType'); // Popula as evidências vinculadas

        if (!caso) {
            return res.status(404).json({ msg: "Caso não encontrado." });
        }
        res.status(200).json(caso);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateCase = async (req, res) => {
    try {
        const caso = await Case.findById(req.params.id);

        // Verifica se o usuário é admin OU perito responsável pelo caso
        if (req.userRole !== 'admin' && caso.responsibleExpert.toString() !== req.userId) {
            return res.status(403).json({ error: "Acesso não autorizado." });
        }
        const updatedCase = await Case.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        ).populate('evidences');
        res.status(200).json(updatedCase);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteCase = async (req, res) => {
    try {
        const caso = await Case.findByIdAndDelete(req.params.id);
        if (!caso) return res.status(404).json({ error: "Caso não encontrado." });
        res.status(200).json({ message: "Caso excluído com sucesso." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Função para filtrar casos por nome
// Example: GET http://localhost:3000/api/case/fname?nameCase=Acidente
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
// Example: http://localhost:3000/api/case/fstatus?status=em%20andamento
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

// filtrar casos por data
// Exemplo: http://localhost:3000/api/case/fdata?startDate=2024-01-01&endDate=2024-12-31&order=oldest
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

  // filtrar casos por data do Caso
// Exemplo: http://localhost:3000/api/case/fdata?startDate=2024-01-01&endDate=2024-12-31&order=oldest
exports.getCasesByDataCase = async (req, res) => {
    try {
      const { startDate, order } = req.query;
  
      const filter = {};
  
      // Filtro por intervalo de datas (createdAt)
      if (startDate) {
        filter.dateCase = {};
        if (startDate) {
          filter.dateCase.$gte = new Date(startDate);
        }
        // if (endDate) {
        //   filter.dateCase.$lte = new Date(endDate);
        // }
      }
  
      // Ordenação por data (padrão: mais novo primeiro, se order = 'oldest', muda pra mais antigo)
      const sortOption = order === "oldest" ? { dateCase: 1 } : { dateCase: -1 };
  
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

  // Função para filtrar casos por categoria
  // Example: GET http://localhost:3000/api/case/fcat?category=acidente
  exports.getCasesByCategory = async (req, res) => {
    try {
      
      const { category } = req.query;
  
      
      const casosFiltrados = await Case.find({ category });
  
      
      if (casosFiltrados.length === 0) {
        return res.status(404).json({ message: "Nenhum caso encontrado para essa categoria." });
      }
  
      
      return res.status(200).json(casosFiltrados);
    } catch (error) {
      console.error("Erro ao filtrar casos por categoria:", error);
      return res.status(500).json({ message: "Erro interno no servidor." });
    }
  };