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
        required: true
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
<<<<<<< HEAD
        type: Number,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'perito', 'assistente'], // Roles definidos
        required: true,
        default: 'assistente' // Role padrão para novos usuários, pode ser ajustado
    },
=======
         type: Number,
          required: true 
        },
        role: {
            type: String, 
            enum: ['admin', 'perito', 'assistente'], // Roles definidos
            required : true,
            default: 'assistente' // Role padrão para novos usuários, pode ser ajustado
        },
>>>>>>> f3dd4b019edb03701dc9fcf9309fa9d6f6caf2be
    createdAt: {
        type: Date,
        default: Date.now
    }
    //profile: { type: String, enum: ['admin', 'user'], required: true }
});

// Middleware para criptografar senha antes de salvar
userSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const User = mongoose.model('User', userSchema);

//Exportar user para userController
module.exports = User;