import { Command } from 'commander';
import fs from 'fs';
import path from 'path';

export const initCommand = new Command('init')
  .description('Initialize TokenZip in the current directory')
  .action(() => {
    const cwd = process.cwd();
    const tokenzipDir = path.join(cwd, '.tokenzip');
    
    if (!fs.existsSync(tokenzipDir)) {
      fs.mkdirSync(tokenzipDir);
      console.log('Created .tokenzip directory');
    }
    
    console.log('TokenZip initialized successfully!');
  });
