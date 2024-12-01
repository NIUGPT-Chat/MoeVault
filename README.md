# MoeVault 萌典阁

一个简洁优雅的图片管理和分享平台。支持多用户系统、图片上传、标签管理、评论互动等功能。

## 项目结构

```
moevault/
├── public/          # 静态资源
│   ├── css/        # 样式文件
│   │   └── style.css
│   ├── js/         # 客户端脚本
│   │   └── main.js
│   ├── images/     # 静态图片
│   └── avatars/    # 用户头像
├── tools/          # 开发工具
│   ├── migrations/ # 数据库迁移文件
│   │   ├── add_comment_reply.sql
│   │   └── add_comment_likes.sql
│   ├── migrate-db.js
│   └── nodemon.json
├── uploads/        # 上传文件存储
├── database.js     # 数据库配置
├── server.js       # 主服务器文件
├── start-dev.sh    # 开发环境启动脚本
└── package.json
```

## 功能特点

### 用户系统
- 📧 邮箱验证注册 - 安全可靠的注册流程
- 🔐 账号登录 - JWT 认证保护
- 👤 自定义头像 - 支持上传个性化头像
- 🔄 会话管理 - 自动登录与安全退出

### 图片管理
- 📤 拖拽上传 - 便捷的文件上传方式
- ✏️ 自定义图片名称 - 灵活的图片命名
- 🏷️ 标签系统 - 支持多标签分类
- 📂 分类管理 - 多维度整理图片
- ❤️ 点赞功能 - 互动评价系统
- 🔍 评论系统 - 用户交流互动
- 🔍 图片预览 - 优雅的预览体验
- ⬇️ 一键下载 - 快速获取图片

### 搜索功能
- 🔎 名称搜索 - 快速定位图片
- 🏷️ 标签搜索 - 多维度检索
- 📊 智能排序 - 支持时间/热度排序

## 开发环境

### 系统要求
- Node.js >= 14
- npm >= 6

### 技术栈
- 前端：HTML5, CSS3, JavaScript
- 后端：Node.js, Express
- 数据库：SQLite3
- 认证：JWT
- 文件处理：Multer, Sharp
- 邮件服务：Nodemailer

## 快速开始

1. 克隆项目:
```bash
git clone https://github.com/yourusername/moevault.git
cd moevault
```

2. 使用开发环境启动脚本:
```bash
chmod +x start-dev.sh  # 添加执行权限
./start-dev.sh        # 启动开发环境
```

或者手动启动：

```bash
# 安装依赖
npm install

# 初始化数据库
npm run migrate

# 启动开发服务器
npm run dev
```

3. 配置环境变量:
```bash
# 创建 .env 文件并配置以下信息
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-password
JWT_SECRET=your-jwt-secret
```

4. 访问应用:
打开浏览器访问 `http://localhost:3000`

## 开发指南

### 可用的 npm 命令
- `npm start` - 生产模式启动
- `npm run dev` - 开发模式启动（支持热重载）
- `npm run dev:debug` - 调试模式启动
- `npm run dev:quiet` - 安静模式启动（减少日志输出）
- `npm run migrate` - 执行数据库迁移

### 数据库迁移
添加新的迁移文件到 `tools/migrations` 目录，然后运行：
```bash
npm run migrate
```

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 许可证

本项目采用 MIT 许可证。详情请见 [LICENSE](LICENSE) 文件。

## 联系方式

- 项目作者: [Your Name]
- Email: [your-email@example.com]
- 项目主页: [https://github.com/yourusername/moevault]

## 致谢

感谢所有为本项目做出贡献的开发者。
