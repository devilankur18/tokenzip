import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { Indexer } from '../../engine/indexer.js';
import path from 'path';

export const parseCommand = new Command('parse')
  .description('Parse the codebase and index it into the graph database')
  .option('--full', 'Perform a full parse instead of incremental')
  .action(async (options) => {
    console.log('Starting parse command...');
    const repoPath = process.cwd();
    const dbPath = repoPath.endsWith('.tokenzip') ? path.join(repoPath, 'db') : path.join(repoPath, '.tokenzip/db');

    const store = new SurrealStore(dbPath);
    await store.initialize();
    
    if (options.full) {
      console.log('Clearing old graph for full parse...');
      await store.clear();
    } else {
      await store.migrate();
    }

    const indexer = new Indexer(store, repoPath);
    await indexer.indexCodebase();

    await store.close();
    console.log('Parse complete!');
  });
