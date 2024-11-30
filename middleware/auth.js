const jwt = require('jsonwebtoken');

const JWT_SECRET = 'moevault-super-secret-2024'; // 在实际生产环境中应该使用环境变量

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: '无效的认证令牌' });
    }
}

module.exports = {
    authMiddleware,
    JWT_SECRET
};