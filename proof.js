import { SurrealStore, Indexer, executeStrategy, TokenBudgetManager } from './dist/index.js';
import path from 'path';

const repoPath = path.resolve('/tmp/express-bench');
console.log(`🚀 Loading lib/application.js in-memory for proof...`);

const store = new SurrealStore('mem://');
await store.initialize();
await store.migrate();

const indexer = new Indexer(store, repoPath);
await indexer.indexCodebase();

const allFiles = await store.query('SELECT id, path FROM file');
const target = allFiles.find(f => f.path.endsWith('lib/application.js'));

if (target) {
  const result = await executeStrategy(
    'interface_only',
    target.path,
    path.join(repoPath, target.path),
    target.id,
    store,
    null,
    new TokenBudgetManager(),
    8000
  );
  console.log('\n--- SUCCESS: PROOF OF OUTPUT ---');
  console.log(result.content.substring(0, 500) + '...');
  console.log('--- END PROOF ---');
} else {
  console.log('File not found in memory-index.');
}
await store.close();
