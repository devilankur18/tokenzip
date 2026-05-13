import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { SurrealStore } from '../../storage/surreal/store.js';
import { TokenBudgetManager } from '../token-budget.js';

const TEST_REPO_URL = 'https://github.com/expressjs/express.git';
const TEST_REPO_COMMIT = 'f873ac23124ffcff8c040b4bd257b32c29828d53';
const TEST_REPO_PATH = path.resolve(process.cwd(), 'test-bench-repo');
const CLI_PATH = path.resolve(process.cwd(), 'dist/cli/index.js');

export async function setupIntegrationTest() {
  // 1. Ensure test repo exists and is at the right commit
  if (!fs.existsSync(TEST_REPO_PATH)) {
    console.log(`Cloning ${TEST_REPO_URL}...`);
    execSync(`git clone ${TEST_REPO_URL} ${TEST_REPO_PATH}`, { stdio: 'inherit' });
  }
  
  console.log(`Checking out commit ${TEST_REPO_COMMIT}...`);
  execSync(`git checkout ${TEST_REPO_COMMIT}`, { cwd: TEST_REPO_PATH, stdio: 'inherit' });

  // 2. Index the repo if not already indexed
  const dbPath = path.join(TEST_REPO_PATH, '.tokenzip/db');
  if (!fs.existsSync(dbPath)) {
    console.log('Indexing test repo...');
    execSync(`node ${CLI_PATH} init --cwd ${TEST_REPO_PATH}`, { stdio: 'inherit' });
    execSync(`node ${CLI_PATH} reset --parse --cwd ${TEST_REPO_PATH}`, { stdio: 'inherit' });
  }

  // 3. Initialize store
  const store = new SurrealStore(`surrealkv://${dbPath}`);
  await store.initialize();
  
  return {
    store,
    repoPath: TEST_REPO_PATH,
    budget: new TokenBudgetManager(8000)
  };
}
