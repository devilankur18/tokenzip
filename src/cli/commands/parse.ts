import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { Indexer } from '../../engine/indexer.js';
import { resolveDbPath } from '../resolve-db.js';

export const parseCommand = new Command('parse')
  .description('Parse the codebase and build the knowledge graph database')
  .option('--full', 'Full re-index (clears existing data and re-parses all files)')
  .addHelpText('after', `
Examples:
  $ tokenzip parse           # Incremental — only re-indexes changed files
  $ tokenzip parse --full    # Full wipe and re-index from scratch
`)
  .action(async (options, command) => {
    const globalOptions = command.parent.opts();
    const { dbPath, repoPath } = resolveDbPath(globalOptions.cwd);

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
    process.exit(0);
  });
