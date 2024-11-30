// services/emailService.js

const nodemailer = require('nodemailer');

// 创建邮件传输器
const transporter = nodemailer.createTransport({
    host: 'smtp.163.com',
    port: 465,
    secure: true,   // 使用SSL
    auth: {
        user: '13588943348@163.com',    // 你的163邮箱
        pass: 'CLUCMZxu9PL3MRF3'        // 你的163邮箱授权码
    }
});

class EmailService {
    static async sendVerificationEmail(email, code) {
        const mailOptions = {
            from: {
                name: 'MoeVault 萌典阁',
                address: '13588943348@163.com'  // 必须与认证用户相同
            },
            to: email,
            subject: 'MoeVault - 邮箱验证码',
            html: `
                <div style="background-color: #f7f7f7; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; text-align: center; margin-bottom: 20px;">欢迎注册 MoeVault</h2>
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
                            <p style="font-size: 16px; color: #666;">您的验证码是:</p>
                            <h1 style="color: #3498db; letter-spacing: 5px; margin: 10px 0;">${code}</h1>
                        </div>
                        <p style="color: #666; margin: 20px 0;">验证码有效期为5分钟，请尽快完成验证。</p>
                        <p style="color: #999; font-size: 14px;">如果这不是您的操作，请忽略此邮件。</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="color: #999; font-size: 12px; text-align: center;">本邮件由系统自动发送，请勿直接回复</p>
                    </div>
                </div>
            `
        };

        try {
            console.log('Sending email with options:', {
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject
            });
            
            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId);
            return true;
        } catch (error) {
            console.error('发送邮件失败:', error);
            throw new Error('发送验证邮件失败: ' + error.message);
        }
    }
}

// 验证邮件配置
transporter.verify(function (error, success) {
    if (error) {
        console.error('邮件服务配置错误:', error);
    } else {
        console.log('邮件服务器连接成功，准备就绪');
    }
});

module.exports = EmailService;