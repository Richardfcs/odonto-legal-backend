const express = require('express'); // para abrir o servidor
const cors = require('cors'); // para não ter erros na hora das requisições
const bodyParser = require('body-parser'); // para limitar requisições extensas
const morgan = require('morgan'); // para testar as requisições
const connectDB = require('./db/database'); // para conectar ao banco de dados
const userRoutes = require('./routes/userRoutes'); // para pegar todas as rotas
const caseRoutes = require('./routes/caseRoutes'); // para pegar todos os casos
const evidenceRoutes = require('./routes/evidenceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditLogRoutes = require('./routes/auditlogRoutes');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // para usar as variáveis que ficam no .env
const helmet = require('helmet');

// Criando o servidor com o express
const app = express();

// Conectar com o banco de dados (depois colocar um process.env.MONGO_URI)
connectDB();

// Middleware (interceptador de dados)
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); //Colocando um limite de dados de 50mb
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true })) // Para dados enviados via URL
app.use(express.static('public'));
app.use(helmet());

// para ter o Logger (opicional) que aparece o método, url, dia hora, status etc...
app.use(morgan(':method :url :response-time :date[web] :status :res[content-length]'));

// Criando a porta do Servidor
const PORT = process.env.PORT || 3000;

// Recebendo o retorno se o server está rodando

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const uploadsDir = path.join(__dirname, 'uploads');
const reportsDir = path.join(uploadsDir, 'reports');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
}

// usando a rota
app.use('/api/user', userRoutes);
app.use('/api/case', caseRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/auditlog', auditLogRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));