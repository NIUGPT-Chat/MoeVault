-- 先备份原表
CREATE TABLE comments_backup AS SELECT * FROM comments;

-- 删除原表
DROP TABLE comments;

-- 创建新表结构
CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    parent_id TEXT DEFAULT NULL,
    reply_to TEXT DEFAULT NULL,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- 恢复原数据
INSERT INTO comments (id, image_id, user_id, content, created_at, updated_at)
SELECT id, image_id, user_id, content, created_at, created_at
FROM comments_backup;

-- 删除备份表
DROP TABLE comments_backup; 