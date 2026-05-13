import { SurrealStore } from '../src/storage/surreal/store.js';
import path from 'path';

async function debug() {
  const repoPath = process.cwd();
  const dbPath = path.join(repoPath, '.tokenzip/db');
  
  const store = new SurrealStore(dbPath);
  await store.initialize();
  
  console.log('\n--- Checking Repository Node ---');
  const repo = await store.query('SELECT * FROM repository LIMIT 1');
  console.log(JSON.stringify(repo, null, 2));
  
  if (repo.length > 0) {
    const repoId = repo[0].id;
    console.log(`\n--- Checking Children of ${repoId} ---`);
    const children = await store.query('SELECT * FROM type::record($id)->contains->ANY', { id: repoId });
    console.log(`Found ${children.length} children.`);
    if (children.length > 0) {
      console.log('First child:', JSON.stringify(children[0], null, 2));
    }
  }
  
  await store.close();
}

debug().catch(console.error);
