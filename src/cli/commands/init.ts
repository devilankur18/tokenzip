import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';

const { resolve } = path;

export const initCommand = new Command('init')
  .description('Initialize TokenZip in the current directory')
  .option('--cwd <dir>', 'Directory to initialize', process.cwd())
  .action(async (options) => {
    const cwd = resolve(options.cwd);
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

    // Initialize repository record in DB
    const { dbPath } = resolveDbPath(cwd);
    const store = new SurrealStore(dbPath);
    try {
      await store.initialize();
      await store.migrate();
      
      const repoId = `repository:${path.basename(cwd).replace(/\W/g, '_')}`;
      await store.createNode({
        id: repoId,
        type: 'repository',
        name: path.basename(cwd),
        root: cwd,
      } as any);
      
      console.log(`✅ TokenZip initialized for repository: ${path.basename(cwd)}`);
      console.log('Run `tokenzip parse` to index your codebase.');
    } catch (err) {
      console.error('Failed to initialize database records:', err);
    } finally {
      await store.close();
    }
  });
