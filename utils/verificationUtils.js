const db = require('../database');

class VerificationUtils {
    static generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    static async saveVerificationCode(email, code, type = 'register') {
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟后过期
        
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO verification_codes (email, code, type, expires_at) 
                 VALUES (?, ?, ?, ?)`,
                [email, code, type, expiresAt.toISOString()],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    static async verifyCode(email, code, type = 'register') {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM verification_codes 
                 WHERE email = ? AND code = ? AND type = ? 
                 AND used = 0 AND expires_at > datetime('now') 
                 ORDER BY created_at DESC LIMIT 1`,
                [email, code, type],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    static async markCodeAsUsed(id) {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE verification_codes SET used = 1 WHERE id = ?',
                [id],
                err => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    static async isEmailVerified(email) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT email_verified FROM users WHERE email = ?',
                [email],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.email_verified === 1);
                }
            );
        });
    }
}

module.exports = VerificationUtils;