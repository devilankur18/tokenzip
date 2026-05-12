import fs from 'fs';
import path from 'path';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.tokenzip']);

function isIgnored(filePath, repoPath, ignorePatterns) {
    const relativePath = path.relative(repoPath, filePath);
    if (!relativePath) return false;

    const parts = relativePath.split(path.sep);
    
    if (parts.some(part => IGNORE_DIRS.has(part))) return true;

    for (const pattern of ignorePatterns) {
      const p = pattern.startsWith('/') ? pattern.slice(1) : pattern;
      
      if (pattern.endsWith('/')) {
        const dirPattern = p.slice(0, -1);
        if (parts.includes(dirPattern)) return true;
        if (relativePath.startsWith(p)) return true;
      }
      
      if (parts.includes(p)) return true;

      if (p.includes('*')) {
        const regexStr = p
          .replace(/\./g, '\\.')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '.');
        
        const regex = new RegExp(`(^|/)${regexStr}($|/)`);
        if (regex.test(relativePath)) return true;
      } else {
        if (relativePath === p || relativePath.startsWith(p + path.sep)) return true;
      }
    }

    return false;
}

const repoPath = '/tmp/openclaw-bench';
const gitignorePath = path.join(repoPath, '.gitignore');
let ignorePatterns = [];
if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    ignorePatterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
}
ignorePatterns.push(...Array.from(IGNORE_DIRS));

function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (isIgnored(fullPath, repoPath, ignorePatterns)) {
            // console.log('Ignored:', fullPath);
            return;
        }
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            getAllFiles(fullPath, arrayOfFiles);
        } else {
            if (/\.(ts|js|tsx|jsx|mts|cts|mjs|cjs)$/.test(fullPath)) {
                arrayOfFiles.push(fullPath);
            }
        }
    });
    return arrayOfFiles;
}

console.log('Scanning...');
const allFiles = getAllFiles(repoPath);
console.log('Found:', allFiles.length);

// Let's see some ignored directories
const topLevel = fs.readdirSync(repoPath);
for (const f of topLevel) {
    const full = path.join(repoPath, f);
    if (isIgnored(full, repoPath, ignorePatterns)) {
        console.log('Top-level Ignored:', f);
    }
}
