import { Command } from 'commander';
import fs from 'fs';
import path from 'path';

import { SurrealStore } from '../../storage/surreal/store.js';
import { Indexer } from '../../engine/indexer.js';

export const resetCommand = new Command('reset')
  .description('Reset the TokenZip database and remove all indexed data')
  .option('--parse', 'Automatically parse the codebase after resetting')
  .action(async (options) => {
    const repoPath = process.cwd();
    const dbPath = repoPath.endsWith('.tokenzip') ? path.join(repoPath, 'db') : path.join(repoPath, '.tokenzip/db');
    
    console.log('Resetting TokenZip database...');
    
    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { recursive: true, force: true });
      console.log('✅ Database successfully removed.');
    } else {
      console.log('Database not found. Nothing to reset.');
    }

    if (options.parse) {
      console.log('\\n🚀 Regenerating database...');
      const store = new SurrealStore(dbPath);
      await store.initialize();
      await store.migrate();
      const indexer = new Indexer(store, repoPath);
      await indexer.indexCodebase();
      await store.close();
    }
  });
