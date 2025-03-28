const mongoose = require('mongoose');
require('dotenv').config();

// criar o modulo para conectar ao BD para ir ao app.js 
const connectDB = async () => {
    //Tentando conectar ao banco de dados
    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Conectado! : ${mongoose.connection.host}`);
    } 
    // o Catch não funciona por mais que a conexão esteja errada (às vezes)
    catch (err) {
        console.error(`Erro ao Conectar ao MongoDB: ${err.message}`);
    }
};

// exportar o módulo para o app.js
module.exports = connectDB;