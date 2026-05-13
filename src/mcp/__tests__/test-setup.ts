import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { SurrealStore } from '../../storage/surreal/store.js';
import { Indexer } from '../../engine/indexer.js';
import { TokenBudgetManager } from '../token-budget.js';

const TEST_REPO_URL = 'https://github.com/expressjs/express.git';
const TEST_REPO_COMMIT = 'master';
const TEST_BENCH_ROOT = path.resolve(process.cwd(), '.test-bench');
const TEST_REPO_PATH = path.join(TEST_BENCH_ROOT, 'express');

export async function setupIntegrationTest() {
  if (!fs.existsSync(TEST_BENCH_ROOT)) {
    fs.mkdirSync(TEST_BENCH_ROOT, { recursive: true });
  }

  // 1. Ensure test repo exists
  if (!fs.existsSync(TEST_REPO_PATH)) {
    console.log(`Cloning ${TEST_REPO_URL} into ${TEST_REPO_PATH}...`);
    execSync(`git clone ${TEST_REPO_URL} ${TEST_REPO_PATH}`, { stdio: 'pipe' });
  }

  // 2. Initialize store and index if needed
  const dbPath = path.join(TEST_REPO_PATH, '.tokenzip/db');
  // Use a fixed port for tests to avoid collisions but keep it consistent
  const testPort = 40000;
  const store = new SurrealStore(dbPath, testPort);
  await store.initialize();
  await store.migrate();

  const stats = await store.stats();
  const symbolCount = Object.values(stats.nodeCount).reduce((a, b) => a + b, 0);

  if (symbolCount < 100) {
    console.log('Indexing test repo (this may take a minute)...');
    const indexer = new Indexer(store, TEST_REPO_PATH, { concurrency: 4 });
    await indexer.indexCodebase();
    console.log('Indexing complete.');
  }

  return {
    store,
    repoPath: TEST_REPO_PATH,
    budget: new TokenBudgetManager(8000)
  };
}
