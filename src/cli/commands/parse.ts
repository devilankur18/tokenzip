import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { Indexer } from '../../engine/indexer.js';
import { resolveDbPath } from '../resolve-db.js';

export const parseCommand = new Command('parse')
  .description('Parse the codebase and build the knowledge graph database')
  .option('--full', 'Full re-index (clears existing data and re-parses all files)')
  .option('-c, --concurrency <number>', 'Number of parallel workers (defaults to CPU cores - 1)', (val) => parseInt(val))
  .addHelpText('after', `
Examples:
  $ tokenzip parse           # Incremental — only re-indexes changed files
  $ tokenzip parse --full    # Full wipe and re-index from scratch
  $ tokenzip parse -c 4      # Use 4 parallel workers
`)
  .action(async (options, command) => {
    const globalOptions = command.parent.opts();
    const { dbPath, repoPath } = resolveDbPath(globalOptions.cwd);

    const store = new SurrealStore(dbPath);
    await store.initialize();
    
    console.log(`\n🚀 TokenZip indexing: ${repoPath}`);
    if (options.full) {
      console.log('🧹 Mode: Full re-index (clears existing data)');
      await store.clear();
    } else {
      console.log('🔄 Mode: Incremental index');
      await store.migrate();
    }

    const indexer = new Indexer(store, repoPath, options.concurrency);
    await indexer.indexCodebase();

    await store.close();
    console.log('Parse complete!');
    process.exit(0);
  });
