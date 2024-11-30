// routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../database');
const EmailService = require('../services/emailService');
const VerificationUtils = require('../utils/verificationUtils');
const { JWT_SECRET } = require('../middleware/auth'); // 修改这里的引用路径
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// 配置头像上传
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/avatars'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${Date.now()}${ext}`);
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('只允许上传图片文件！'), false);
        }
        cb(null, true);
    }
});

// 发送验证码
router.post('/send-verification', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: '请提供邮箱地址' });
        }

        const code = VerificationUtils.generateVerificationCode();
        await VerificationUtils.saveVerificationCode(email, code);
        await EmailService.sendVerificationEmail(email, code);
        
        res.json({ 
            success: true, 
            message: '验证码已发送' 
        });
    } catch (error) {
        console.error('发送验证码失败:', error);
        res.status(500).json({ 
            error: '发送验证码失败',
            message: error.message 
        });
    }
});

// 注册
router.post('/register', avatarUpload.single('avatar'), [
    body('username').trim().isLength({ min: 3 }).withMessage('用户名至少需要3个字符'),
    body('email').trim().isEmail().withMessage('请提供有效的邮箱地址'),
    body('password').isLength({ min: 6 }).withMessage('密码至少需要6个字符'),
    body('code').trim().isLength({ min: 6, max: 6 }).withMessage('请提供6位验证码')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, code } = req.body;

        // 验证验证码
        const verificationRecord = await VerificationUtils.verifyCode(email, code);
        if (!verificationRecord) {
            return res.status(400).json({ error: '验证码无效或已过期' });
        }

        // 检查用户名和邮箱是否已存在
        const existingUser = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE username = ? OR email = ?',
                [username, email],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (existingUser) {
            return res.status(400).json({
                error: existingUser.username === username ? 
                    '用户名已被使用' : '邮箱已被注册'
            });
        }

        let avatarPath = '/images/default-avatar.png';
        if (req.file) {
            // 处理头像图片
            const processedFileName = `avatar-${Date.now()}.png`;
            const processedFilePath = path.join(__dirname, '../public/avatars', processedFileName);
            
            await sharp(req.file.path)
                .resize(200, 200, {
                    fit: 'cover',
                    position: 'center'
                })
                .toFormat('png')
                .toFile(processedFilePath);

            // 删除原始上传文件
            fs.unlinkSync(req.file.path);
            
            avatarPath = `/avatars/${processedFileName}`;
        }

        // 创建新用户
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = Date.now().toString();

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, username, email, password, email_verified, avatar) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, username, email, hashedPassword, 1, avatarPath],
                err => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // 标记验证码为已使用
        await VerificationUtils.markCodeAsUsed(verificationRecord.id);

        // 生成 JWT
        const token = jwt.sign({ userId, username }, JWT_SECRET, {
            expiresIn: '24h'
        });

        res.json({
            token,
            user: {
                id: userId,
                username,
                email,
                avatar: avatarPath
            }
        });

    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ error: '注册失败，请稍后重试' });
    }
});

// 登录路由保持不变
router.post('/login', [
    body('username').trim().not().isEmpty(),
    body('password').not().isEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        // 查找用户
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE username = ? OR email = ?',
                [username, username],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!user) {
            return res.status(400).json({ error: '用户不存在' });
        }

        // 检查密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: '密码错误' });
        }

        // 生成 JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 更新最后登录时间
        db.run(
            'UPDATE users SET last_login = datetime("now") WHERE id = ?',
            [user.id]
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

router.post('/test-email', async (req, res) => {
    try {
        await EmailService.sendVerificationEmail('test@example.com', '123456');
        res.json({ success: true, message: '测试邮件发送成功' });
    } catch (error) {
        console.error('测试邮件发送失败:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
