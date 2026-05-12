import { SurrealStore } from '../dist/storage/surreal/store.js';
import { resolveDbPath } from '../dist/cli/resolve-db.js';

async function check() {
  const { dbPath } = resolveDbPath('/tmp/express-bench');
  console.log('Checking DB at:', dbPath);
  const store = new SurrealStore(dbPath);
  await store.initialize();
  
  const stats = await store.stats();
  console.log('Stats:', JSON.stringify(stats, null, 2));
  
  const symbols = await store.query('SELECT name FROM symbol LIMIT 10');
  console.log('Sample symbols:', symbols);
  
  await store.close();
}

check().catch(console.error);
