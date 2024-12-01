const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('数据库连接失败:', err);
    } else {
        console.log('数据库连接成功');
        initDatabase();
    }
});

function initDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email_verified BOOLEAN DEFAULT 0,
            role TEXT DEFAULT 'user',
            avatar TEXT DEFAULT '/images/default-avatar.png',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            status TEXT DEFAULT 'pending'
        )
    `, (err) => {
        if (err) {
            console.error('创建用户表失败:', err);
        } else {
            console.log('用户表创建成功或已存在');
        }
    });
        // 创建验证码表
    db.run(`
        CREATE TABLE IF NOT EXISTS verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            type TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            used BOOLEAN DEFAULT 0
        )
    `, (err) => {
        if (err) {
            console.error('创建验证码表失败:', err);
        } else {
            console.log('验证码表创建成功或已存在');
        }
    });
    // 添加点赞记录表
    db.run(`
        CREATE TABLE IF NOT EXISTS likes (
            user_id TEXT NOT NULL,
            image_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, image_id)
        )
    `);
    // 创建评论表
    db.run(`
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            image_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (image_id) REFERENCES images(id)
        )
    `, (err) => {
        if (err) {
            console.error('创建评论表失败:', err);
        } else {
            console.log('评论表创建成功或已存在');
        }
    });
    // 创建图片表
    db.run(`
        CREATE TABLE IF NOT EXISTS images (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            originalname TEXT NOT NULL,
            path TEXT NOT NULL,
            category TEXT DEFAULT 'recent',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            likes INTEGER DEFAULT 0,
            tags TEXT,
            uploader_id TEXT NOT NULL,
            FOREIGN KEY (uploader_id) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('创建图片表失败:', err);
        } else {
            console.log('图片表创建成功或已存在');
        }
    });
}

module.exports = db;