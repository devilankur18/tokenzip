import { Command } from 'commander';
import fs from 'fs';
import { SurrealStore } from '../../storage/surreal/store.js';
import { Indexer } from '../../engine/indexer.js';
import { resolveDbPath } from '../resolve-db.js';

export const resetCommand = new Command('reset')
  .description('Remove the TokenZip database (wipes all indexed data)')
  .option('--parse', 'Automatically re-index after resetting')
  .addHelpText('after', `
Examples:
  $ tokenzip reset             # Wipe the database only
  $ tokenzip reset --parse     # Wipe + rebuild in one step
`)
  .action(async (options) => {
    const { dbPath, repoPath } = resolveDbPath(process.cwd());
    
    console.log('Resetting TokenZip database...');
    
    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { recursive: true, force: true });
      console.log('✅ Database successfully removed.');
    } else {
      console.log('Database not found. Nothing to reset.');
    }

    if (options.parse) {
      console.log('\n🚀 Regenerating database...');
      const store = new SurrealStore(dbPath);
      await store.initialize();
      await store.migrate();
      const indexer = new Indexer(store, repoPath);
      await indexer.indexCodebase();
      await store.close();
    }
  });
