const fs = require('fs');
const content = fs.readFileSync('src/utils/projectDisk.ts', 'utf-8');
console.log(content.slice(0, 500));
