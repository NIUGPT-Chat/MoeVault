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
}

module.exports = db;