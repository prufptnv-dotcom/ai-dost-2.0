const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/app.db');
db.exec('DELETE FROM collab_docs');
console.log('Successfully wiped poisoned collab docs.');
