const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const app = express();
const port = 3000;

// 首先配置所有中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 使用绝对路径配置静态文件服务
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 添加请求日志中间件
app.use((req, res, next) => {
    console.log('收到请求:', {
        method: req.method,
        path: req.path,
        body: req.body
    });
    next();
});

const { authMiddleware } = require('./middleware/auth');

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 确保头像目录存在
const avatarsDir = path.join(__dirname, 'public/avatars');
if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
}

// 配置 multer 存储
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const customName = req.body.customName || file.originalname;
        const ext = path.extname(file.originalname);
        const timestamp = Date.now();
        cb(null, `${timestamp}-${customName}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('只允许上传图片文件！'), false);
        }
        cb(null, true);
    }
});

// 数据库文件操作
const DB_FILE = path.join(__dirname, 'db.json');

function readDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('读取数据库出错:', error);
    }
    return { images: [] };
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('写入数据库出错:', error);
    }
}

// 配置路由
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// API 路由
// 上传图片
app.post('/api/upload', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        // 从数据库获取最新的用户信息
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, username, avatar FROM users WHERE id = ?',
                [req.user.userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        const dbJson = readDB();
        const imageInfo = {
            id: Date.now().toString(),
            filename: file.filename,
            originalname: req.body.customName || file.originalname,
            path: '/uploads/' + file.filename,
            category: 'recent',
            uploadDate: new Date().toISOString(),
            likes: 0,
            tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
            uploader: {
                id: user.id,
                username: user.username,
                avatar: user.avatar || '/images/default-avatar.png'
            }
        };
        
        if (!dbJson.images) {
            dbJson.images = [];
        }
        dbJson.images.unshift(imageInfo);
        writeDB(dbJson);
        
        res.json(imageInfo);
    } catch (error) {
        console.error('上传错误:', error);
        res.status(500).json({ error: '上传失败: ' + error.message });
    }
});

// 获取图片列表
app.get('/api/images', (req, res) => {
    try {
        const { sort = 'date', search = '', category = 'all' } = req.query;
        const db = readDB();
        let images = [...db.images];

        // 分类筛选
        if (category !== 'all') {
            images = images.filter(img => img.category === category);
        }

        // 搜索功能
        if (search) {
            const searchLower = search.toLowerCase();
            images = images.filter(img => 
                img.originalname.toLowerCase().includes(searchLower) ||
                (img.tags && img.tags.some(tag => tag.toLowerCase().includes(searchLower)))
            );
        }

        // 排序
        switch (sort) {
            case 'likes':
                images.sort((a, b) => (b.likes || 0) - (a.likes || 0));
                break;
            case 'date':
            default:
                images.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        }

        res.json(images);
    } catch (error) {
        console.error('获取图片列表错误:', error);
        res.status(500).json({ error: '获取图片列表失败' });
    }
});

// 点赞状态检查API
app.get('/api/images/:id/like', authMiddleware, (req, res) => {
    try {
        const userId = req.user.userId; // 从认证中间件获取用户ID
        
        const db = readDB();
        const likes = db.likes || [];
        const isLiked = likes.some(like => 
            like.userId === userId && like.imageId === req.params.id
        );

        res.json({ isLiked });
    } catch (error) {
        console.error('获取点赞状态错误:', error);
        res.status(500).json({ error: '获取点赞状态失败' });
    }
});

// 点赞
app.post('/api/images/:id/like', authMiddleware, (req, res) => {
    try {
        const userId = req.user.userId; // 从认证中间件获取用户ID

        const db = readDB();
        const image = db.images.find(img => img.id === req.params.id);
        
        if (!image) {
            return res.status(404).json({ error: '图片不存在' });
        }

        // 初始化likes数组如果不存在
        if (!db.likes) {
            db.likes = [];
        }

        // 检查是否已经点赞
        const existingLikeIndex = db.likes.findIndex(like => 
            like.userId === userId && like.imageId === req.params.id
        );

        let isLiked = false;

        if (existingLikeIndex === -1) {
            // 添加点赞
            db.likes.push({
                userId,
                imageId: req.params.id,
                createdAt: new Date().toISOString()
            });
            image.likes = (image.likes || 0) + 1;
            isLiked = true;
        } else {
            // 取消点赞
            db.likes.splice(existingLikeIndex, 1);
            image.likes = Math.max((image.likes || 0) - 1, 0);
            isLiked = false;
        }

        writeDB(db);
        
        res.json({ 
            likes: image.likes,
            isLiked 
        });
    } catch (error) {
        console.error('点赞错误:', error);
        res.status(500).json({ error: '点赞失败: ' + error.message });
    }
});

// 删除图片
app.delete('/api/images/:id', (req, res) => {
    try {
        const db = readDB();
        const image = db.images.find(img => img.id === req.params.id);
        
        if (!image) {
            return res.status(404).json({ error: '图片不存在' });
        }

        // 删除文件
        const filePath = path.join(__dirname, 'uploads', image.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // 从数据库中删除
        db.images = db.images.filter(img => img.id !== req.params.id);
        writeDB(db);
        
        res.json({ message: '删除成功' });
    } catch (error) {
        console.error('删除错误:', error);
        res.status(500).json({ error: '删除失败: ' + error.message });
    }
});

// 更新图片分类
app.put('/api/images/:id/category', (req, res) => {
    try {
        const { category } = req.body;
        if (!category) {
            return res.status(400).json({ error: '缺少category参数' });
        }

        const db = readDB();
        const image = db.images.find(img => img.id === req.params.id);
        
        if (!image) {
            return res.status(404).json({ error: '图片不存在' });
        }

        image.category = category;
        writeDB(db);
        
        res.json(image);
    } catch (error) {
        console.error('更新分类错误:', error);
        res.status(500).json({ error: '更新分类失败: ' + error.message });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ error: err.message || '服务器内部错误' });
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
});
