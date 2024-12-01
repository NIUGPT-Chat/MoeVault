const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('database.sqlite');

// 读取并执行迁移SQL
const migrations = [
    'add_comment_reply.sql',
    'add_comment_likes.sql'
];

db.serialize(() => {
    migrations.forEach(migrationFile => {
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations', migrationFile),
            'utf8'
        );

        db.exec(migrationSQL, (err) => {
            if (err) {
                console.error(`执行迁移 ${migrationFile} 失败:`, err);
                process.exit(1);
            }
            console.log(`迁移 ${migrationFile} 成功！`);
        });
    });

    db.close(() => {
        console.log('所有迁移完成！');
    });
}); 