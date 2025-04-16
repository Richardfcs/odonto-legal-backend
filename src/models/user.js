const mongoose = require('mongoose')
const bcrypt = require('bcryptjs');

// criando uma tabela no banco de dados para o usuário 
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/
    },
    telephone: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    cro: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'perito', 'assistente'], // Roles definidos
        required: true,
        default: 'assistente' // Role padrão para novos usuários, pode ser ajustado
    },
    photo: {
        type: String
    },
    cases: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Case' // Referência aos casos do usuário
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updateAt: {
        type: Date,
        default: Date.now,
    },
});

// Middleware para criptografar senha antes de salvar
userSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const User = mongoose.model('User', userSchema);

//Exportar user para userController
module.exports = User;