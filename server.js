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

        const userId = req.user.userId;
        const tags = req.body.tags ? JSON.stringify(req.body.tags.split(',').map(tag => tag.trim())) : '[]';

        // 保存图片信息到数据库
        const imageId = Date.now().toString();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO images (id, filename, originalname, path, tags, uploader_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    imageId,
                    file.filename,
                    req.body.customName || file.originalname,
                    '/uploads/' + file.filename,
                    tags,
                    userId
                ],
                err => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // 获取完整的图片信息（包括上传者信息）
        const imageInfo = await new Promise((resolve, reject) => {
            db.get(
                `SELECT i.*, u.username, u.avatar
                 FROM images i
                 JOIN users u ON i.uploader_id = u.id
                 WHERE i.id = ?`,
                [imageId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        // 格式化返回数据
        const response = {
            id: imageInfo.id,
            filename: imageInfo.filename,
            originalname: imageInfo.originalname,
            path: imageInfo.path,
            category: imageInfo.category,
            uploadDate: imageInfo.upload_date,
            likes: imageInfo.likes,
            tags: JSON.parse(imageInfo.tags),
            uploader: {
                id: imageInfo.uploader_id,
                username: imageInfo.username,
                avatar: imageInfo.avatar || '/images/default-avatar.png'
            }
        };

        res.json(response);
    } catch (error) {
        console.error('上传错误:', error);
        res.status(500).json({ error: '上传失败: ' + error.message });
    }
});

// 获取图片列表
app.get('/api/images', async (req, res) => {
    try {
        const { sort = 'date', search = '', category = 'all' } = req.query;

        let query = `
            SELECT i.*, u.username, u.avatar
            FROM images i
            JOIN users u ON i.uploader_id = u.id
            WHERE 1=1
        `;

        const params = [];

        if (category !== 'all') {
            query += ` AND i.category = ?`;
            params.push(category);
        }

        if (search) {
            query += ` AND (i.originalname LIKE ? OR i.tags LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += sort === 'likes' ? 
            ` ORDER BY i.likes DESC` : 
            ` ORDER BY i.created_at DESC`;

        const images = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 格式化返回数据
        const formattedImages = images.map(img => ({
            id: img.id,
            filename: img.filename,
            originalname: img.originalname,
            path: img.path,
            category: img.category,
            uploadDate: img.created_at,
            likes: img.likes,
            tags: JSON.parse(img.tags || '[]'),
            uploader: {
                id: img.uploader_id,
                username: img.username,
                avatar: img.avatar || '/images/default-avatar.png'
            }
        }));

        res.json(formattedImages);
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
app.post('/api/images/:id/like', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const imageId = req.params.id;

        // 检查图片是否存在
        const image = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM images WHERE id = ?', [imageId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!image) {
            return res.status(404).json({ error: '图片不存在' });
        }

        // 检查是否已经点赞
        const like = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM likes WHERE user_id = ? AND image_id = ?',
                [userId, imageId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (like) {
            // 取消点赞
            await new Promise((resolve, reject) => {
                db.run(
                    'DELETE FROM likes WHERE user_id = ? AND image_id = ?',
                    [userId, imageId],
                    err => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE images SET likes = likes - 1 WHERE id = ?',
                    [imageId],
                    err => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            res.json({ likes: image.likes - 1, isLiked: false });
        } else {
            // 添加点赞
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO likes (user_id, image_id) VALUES (?, ?)',
                    [userId, imageId],
                    err => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE images SET likes = likes + 1 WHERE id = ?',
                    [imageId],
                    err => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            res.json({ likes: image.likes + 1, isLiked: true });
        }
    } catch (error) {
        console.error('点赞错误:', error);
        res.status(500).json({ error: '点赞失败: ' + error.message });
    }
});

// 删除图片
app.delete('/api/images/:id', authMiddleware, async (req, res) => {
    try {
        const imageId = req.params.id;
        const userId = req.user.userId;

        // 检查图片是否存在并且是否是上传
        const image = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM images WHERE id = ? AND uploader_id = ?',
                [imageId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!image) {
            return res.status(404).json({ error: '图片不存在或无权删除' });
        }

        // 删除文件
        const filePath = path.join(__dirname, 'uploads', image.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // 删除数据库记录
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM images WHERE id = ?', [imageId], err => {
                if (err) reject(err);
                else resolve();
            });
        });

        // 删除相关的点赞记录
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM likes WHERE image_id = ?', [imageId], err => {
                if (err) reject(err);
                else resolve();
            });
        });

        // 删除相关的评论
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM comments WHERE image_id = ?', [imageId], err => {
                if (err) reject(err);
                else resolve();
            });
        });

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

// 添加评论
app.post('/api/images/:id/comments', authMiddleware, async (req, res) => {
    try {
        const { content, parentId, replyTo } = req.body;
        if (!content) {
            return res.status(400).json({ error: '评论内容不能为空' });
        }

        const imageId = req.params.id;
        const userId = req.user.userId;

        // 检查图片是否存在
        const image = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM images WHERE id = ?', [imageId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!image) {
            return res.status(404).json({ error: '图片不存在' });
        }

        // 获取用户信息
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id, username, avatar FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // 创建评论
        const commentId = Date.now().toString();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO comments (id, image_id, user_id, content, parent_id, reply_to) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [commentId, imageId, userId, content, parentId || null, replyTo || null],
                err => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // 如果是回复，更新父评论的回复数
        if (parentId) {
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE comments SET reply_count = reply_count + 1 WHERE id = ?',
                    [parentId],
                    err => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        // 返回完整的评论信息
        const newComment = await new Promise((resolve, reject) => {
            db.get(`
                SELECT c.*, u.username, u.avatar
                FROM comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.id = ?
            `, [commentId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // 格式化返回数据
        const comment = {
            id: newComment.id,
            imageId,
            content: newComment.content,
            createdAt: newComment.created_at,
            replyTo: newComment.reply_to,
            reply_count: newComment.reply_count || 0,
            user: {
                id: newComment.user_id,
                username: newComment.username,
                avatar: newComment.avatar || '/images/default-avatar.png'
            }
        };

        res.json(comment);
    } catch (error) {
        console.error('添加评论失败:', error);
        res.status(500).json({ error: '添加评论失败' });
    }
});

// 获取评论列表
app.get('/api/images/:id/comments', async (req, res) => {
    try {
        const imageId = req.params.id;
        const userId = req.user?.userId; // 获取当前用户ID（如果已登录）

        const comments = await new Promise((resolve, reject) => {
            db.all(`
                SELECT c.*, u.username, u.avatar,
                       CASE WHEN cl.user_id IS NOT NULL THEN 1 ELSE 0 END as is_liked
                FROM comments c
                JOIN users u ON c.user_id = u.id
                LEFT JOIN comment_likes cl ON c.id = cl.comment_id AND cl.user_id = ?
                WHERE c.image_id = ? AND c.parent_id IS NULL
                ORDER BY c.created_at DESC
            `, [userId || '', imageId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 格式化评论数据
        const formattedComments = comments.map(comment => ({
            id: comment.id,
            imageId: comment.image_id,
            content: comment.content,
            createdAt: comment.created_at,
            replyTo: comment.reply_to,
            reply_count: comment.reply_count || 0,
            likes: comment.likes || 0,
            isLiked: comment.is_liked === 1,
            user: {
                id: comment.user_id,
                username: comment.username,
                avatar: comment.avatar || '/images/default-avatar.png'
            }
        }));

        res.json(formattedComments);
    } catch (error) {
        console.error('获取评论失败:', error);
        res.status(500).json({ error: '获取评论失败' });
    }
});

// 修改删除评论接口
app.delete('/api/comments/:id', authMiddleware, async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.user.userId;

        // 获取评论信息（包括父评论ID）
        const comment = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM comments WHERE id = ? AND user_id = ?',
                [commentId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!comment) {
            return res.status(404).json({ error: '评论不存在或无权删除' });
        }

        // 如果是回复，更新父评论的回复计数
        if (comment.parent_id) {
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE comments SET reply_count = reply_count - 1 WHERE id = ?',
                    [comment.parent_id],
                    err => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        // 删除评论
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM comments WHERE id = ?', [commentId], err => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ 
            message: '评论已删除',
            parentId: comment.parent_id
        });
    } catch (error) {
        console.error('删除评论失败:', error);
        res.status(500).json({ error: '删除评论失败' });
    }
});

// 添加编辑评论接口
app.put('/api/comments/:id', authMiddleware, async (req, res) => {
    try {
        const { content } = req.body;
        const commentId = req.params.id;
        const userId = req.user.userId;

        if (!content) {
            return res.status(400).json({ error: '评论内容不能为空' });
        }

        // 检查评论是否存在且是否为评论作者
        const comment = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM comments WHERE id = ? AND user_id = ?',
                [commentId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!comment) {
            return res.status(404).json({ error: '评论不存在或无权编辑' });
        }

        // 更新评论
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [content, commentId],
                err => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ message: '评论已更新' });
    } catch (error) {
        console.error('更新评论失败:', error);
        res.status(500).json({ error: '更新评论失败' });
    }
});

// 获取评论回复
app.get('/api/comments/:id/replies', async (req, res) => {
    try {
        const parentId = req.params.id;
        
        const replies = await new Promise((resolve, reject) => {
            db.all(`
                SELECT c.*, u.username, u.avatar
                FROM comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.parent_id = ?
                ORDER BY c.created_at ASC
            `, [parentId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const formattedReplies = replies.map(reply => ({
            id: reply.id,
            content: reply.content,
            createdAt: reply.created_at,
            replyTo: reply.reply_to,
            user: {
                id: reply.user_id,
                username: reply.username,
                avatar: reply.avatar || '/images/default-avatar.png'
            }
        }));

        res.json(formattedReplies);
    } catch (error) {
        console.error('获取回复失败:', error);
        res.status(500).json({ error: '获取回复失败' });
    }
});

// 修改评论点赞接口
app.post('/api/comments/:id/like', authMiddleware, async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.user.userId;

        // 检查评论是否存在
        const comment = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM comments WHERE id = ?', [commentId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!comment) {
            return res.status(404).json({ error: '评论不存在' });
        }

        // 检查是否已经点赞
        const like = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM comment_likes WHERE user_id = ? AND comment_id = ?',
                [userId, commentId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (like) {
            // 取消点赞
            await new Promise((resolve, reject) => {
                db.run(
                    'DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?',
                    [userId, commentId],
                    err => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE comments SET likes = likes - 1 WHERE id = ?',
                    [commentId],
                    err => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            // 获取更新后的点赞数
            const updatedComment = await new Promise((resolve, reject) => {
                db.get('SELECT likes FROM comments WHERE id = ?', [commentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            res.json({ likes: updatedComment.likes, isLiked: false });
        } else {
            // 添加点赞
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO comment_likes (id, user_id, comment_id) VALUES (?, ?, ?)',
                    [Date.now().toString(), userId, commentId],
                    err => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE comments SET likes = likes + 1 WHERE id = ?',
                    [commentId],
                    err => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            // 获取更新后的点赞数
            const updatedComment = await new Promise((resolve, reject) => {
                db.get('SELECT likes FROM comments WHERE id = ?', [commentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            res.json({ likes: updatedComment.likes, isLiked: true });
        }
    } catch (error) {
        console.error('评论点赞失败:', error);
        res.status(500).json({ error: '评论点赞失败' });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ 
        error: process.env.NODE_ENV === 'development' 
            ? err.message 
            : '服务器内部错误' 
    });
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
});
