# MoeVault 萌典阁

一个简洁优雅的图片管理和分享平台。

## 功能特点

### 用户系统
- 📧 邮箱验证注册 - 安全可靠的注册流程
- 🔐 账号登录 - JWT 认证保护
- 👤 自定义头像 - 支持上传个性化头像

### 图片管理
- 📤 拖拽上传 - 便捷的文件上传方式
- ✏️ 自定义图片名称 - 灵活的图片命名
- 🏷️ 标签系统 - 支持多标签分类
- 📂 分类管理 - 多维度整理图片
- ❤️ 点赞功能 - 互动评价系统
- 🔍 图片预览 - 优雅的预览体验
- ⬇️ 一键下载 - 快速获取图片

### 搜索功能
- 🔎 名称搜索 - 快速定位图片
- 🏷️ 标签搜索 - 多维度检索
- 📊 智能排序 - 支持时间/热度排序

## 技术栈

- 前端: HTML5, CSS3, JavaScript
- 后端: Node.js, Express
- 数据库: SQLite3
- 认证: JWT
- 文件处理: Multer, Sharp
- 邮件服务: Nodemailer

## 快速开始

1. 克隆项目:
```bash
git clone https://github.com/yourusername/moevault.git
cd moevault
```

2. 安装依赖:
```bash
npm install
```

3. 配置环境变量:
```bash
# 创建 .env 文件并配置以下信息
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-password
JWT_SECRET=your-jwt-secret
```

4. 启动服务:
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

5. 访问应用:
打开浏览器访问 `http://localhost:3000`

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 许可证

本项目采用 MIT 许可证。
