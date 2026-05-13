import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { SurrealStore } from '../../storage/surreal/store.js';
import { Indexer } from '../../engine/indexer.js';
import { TokenBudgetManager } from '../../mcp/token-budget.js';

const BENCH_REPO_URL = 'https://github.com/expressjs/express.git';
const BENCH_ROOT = path.resolve(process.cwd(), '.bench');
const BENCH_REPO_PATH = path.join(BENCH_ROOT, 'express');

export interface BenchSetupOptions {
  forceIndex?: boolean;
  concurrency?: number;
}

/**
 * Ensures the Express.js benchmark repository is cloned and indexed.
 * Used by both integration tests and benchmark scripts.
 */
export async function setupBenchRepo(options: BenchSetupOptions = {}) {
  const { forceIndex = false, concurrency = 4 } = options;

  if (!fs.existsSync(BENCH_ROOT)) {
    fs.mkdirSync(BENCH_ROOT, { recursive: true });
  }

  // 1. Clone if missing
  if (!fs.existsSync(BENCH_REPO_PATH)) {
    console.log(`\x1b[34m📦 Cloning ${BENCH_REPO_URL} into ${BENCH_REPO_PATH}...\x1b[0m`);
    execSync(`git clone --depth=1 ${BENCH_REPO_URL} ${BENCH_REPO_PATH}`, { stdio: 'inherit' });
  }

  // 2. Initialize store
  const dbPath = path.join(BENCH_REPO_PATH, '.tokenzip/db');
  const store = new SurrealStore(dbPath);
  const isOwner = await store.initialize();
  
  if (isOwner) {
    await store.migrate();
  }

  // 3. Check if indexing is needed
  let stats = await store.stats();
  let symbolCount = Object.values(stats.nodeCount).reduce((a, b) => a + b, 0);

  if (symbolCount < 100 || forceIndex) {
    if (isOwner) {
      if (forceIndex) {
        console.log('\x1b[33m\u1F504 Force re-indexing benchmark repo...\x1b[0m');
        await store.clear();
      } else {
        console.log('\x1b[34m\u23F1  Indexing benchmark repo for the first time...\x1b[0m');
      }
      
      const indexer = new Indexer(store, BENCH_REPO_PATH, { concurrency });
      await indexer.indexCodebase();
      console.log('\x1b[32m\u2705 Indexing complete.\x1b[0m');
    } else {
      // Wait for owner to finish indexing
      console.log('\x1b[34m\u23F1  Waiting for indexing to complete...\x1b[0m');
      let retries = 0;
      while (retries < 60) {
        await new Promise(r => setTimeout(r, 2000));
        stats = await store.stats();
        symbolCount = Object.values(stats.nodeCount).reduce((a, b) => a + b, 0);
        if (symbolCount >= 100) break;
        retries++;
      }
    }
  }

  return {
    store,
    repoPath: BENCH_REPO_PATH,
    budget: new TokenBudgetManager(8000)
  };
}
