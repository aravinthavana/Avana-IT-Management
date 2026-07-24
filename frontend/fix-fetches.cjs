const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if(file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./components').concat(walk('./contexts'));
let modifiedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // We want to add `credentials: 'include'` to any fetch options object that doesn't have it.
    // A reliable way is to find `headers: getHeaders()` or `headers: getHeaders(),` and append `credentials: 'include',`.
    // First, let's just do a naive replace:
    // headers: getHeaders() \n => headers: getHeaders(), \n credentials: 'include' \n
    
    let changed = false;
    
    // Regex explanation: look for `headers: getHeaders()` followed optionally by `,`, 
    // but ONLY if `credentials: 'include'` is NOT in the same object. 
    // Actually, it's easier to just replace all `headers: getHeaders()` without `credentials` right after.
    
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('headers: getHeaders()')) {
            // Check if this line or the next few lines have credentials
            let hasCredentials = false;
            for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 3); j++) {
                if (lines[j].includes('credentials:')) {
                    hasCredentials = true;
                    break;
                }
            }
            
            if (!hasCredentials) {
                // Add credentials right after headers
                lines[i] = lines[i].replace(/headers:\s*getHeaders\(\)\s*,?/, "headers: getHeaders(),\n                                credentials: 'include',");
                changed = true;
            }
        }
        
        // Also check for raw fetches that might not use getHeaders but need credentials?
        // Actually, if it hits our API, it needs both credentials and getHeaders for CSRF.
        // What about AssetDetailView line 36? Let's check it.
        // It has `const res = await fetch(..., { method: 'PUT', headers: getHeaders(), ... })`.
    }
    
    if (changed) {
        fs.writeFileSync(file, lines.join('\n'), 'utf8');
        console.log(`Modified ${file}`);
        modifiedCount++;
    }
});

console.log(`Finished modifying ${modifiedCount} files.`);
