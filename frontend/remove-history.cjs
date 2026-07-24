const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            if (fullPath.includes('AppContext.tsx')) continue; // skip definition

            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Split into lines
            const lines = content.split('\n');
            const newLines = lines.filter(line => !line.includes('logAssetHistory('));
            
            if (lines.length !== newLines.length) {
                modified = true;
                content = newLines.join('\n');
                
                // Optional: remove logAssetHistory from destructuring
                content = content.replace(/,\s*logAssetHistory\b/g, '');
                content = content.replace(/\blogAssetHistory\s*,\s*/g, '');
                
                fs.writeFileSync(fullPath, content);
                console.log(`Modified ${fullPath}`);
            }
        }
    }
}

processDir(path.join(__dirname, 'components'));
console.log('Done.');
