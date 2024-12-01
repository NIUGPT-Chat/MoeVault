-- 添加评论点赞表
CREATE TABLE IF NOT EXISTS comment_likes (
    id TEXT PRIMARY KEY,
    comment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(comment_id, user_id)
);

-- 在评论表中添加点赞数字段
ALTER TABLE comments ADD COLUMN likes INTEGER DEFAULT 0; 