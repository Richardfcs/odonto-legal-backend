// middleware/auth.js
const jwt = require('jsonwebtoken');

// Middleware para verificar o token JWT
exports.verifyJWT = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer <token>"

    if (!token) {
        return res.status(401).json({ auth: false, message: 'Token não fornecido.' });
    }

    jwt.verify(token, process.env.SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ auth: false, message: 'Token inválido ou expirado.' });
        }

        req.userId = decoded.id; // ID do usuário autenticado
        req.userRole = decoded.role; // Role do usuário (admin, perito, assistente)
        next();
    });
};

// Middleware para verificar roles (ex: apenas admin pode acessar)
exports.authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.userRole)) {
            return res.status(403).json({
                error: "Acesso negado. Permissões necessárias: " + allowedRoles.join(', ')
            });
        }
        next();
    };
};