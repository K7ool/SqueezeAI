const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace("import { INITIAL_PROJECT } from './utils/projectDisk';", "import { createDefaultProject } from './utils/projectDisk';");
content = content.replace("useState<RobloxProject>(INITIAL_PROJECT);", "useState<RobloxProject>(createDefaultProject());");
fs.writeFileSync('src/App.tsx', content);
