import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { resolveDbPath } from '../resolve-db.js';

export const initCommand = new Command('init')
  .description('Initialize TokenZip in the current directory')
  .action(() => {
    const cwd = process.cwd();
    const tokenzipDir = path.join(cwd, '.tokenzip');
    
    if (!fs.existsSync(tokenzipDir)) {
      fs.mkdirSync(tokenzipDir, { recursive: true });
      console.log('Created .tokenzip directory');
    }

    // Write a .gitignore to exclude the db from version control
    const gitignorePath = path.join(tokenzipDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, 'db/\n');
      console.log('Created .tokenzip/.gitignore');
    }
    
    console.log('✅ TokenZip initialized! Run `tokenzip parse` to index your codebase.');
  });
