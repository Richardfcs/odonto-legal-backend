// middleware/auth.js
const jwt = require('jsonwebtoken');

exports.verifyJWT = (req, res, next) => {
    const token = req.headers['token'];
    if (!token) {
        return res.status(401).json({ auth: false, message: 'Token não fornecido.' });
    }

    jwt.verify(token, process.env.SECRET, (decoded) => {
        if (!token) {
            return res.status(500).json({ auth: false, message: 'Falha ao autenticar o token.' });
        }

        req.userId = decoded.id; // <--- Informação importante: salva o ID do usuário no 'req'
        next(); // <--- Chama 'next()' para permitir que a requisição continue para o controller
    });
};