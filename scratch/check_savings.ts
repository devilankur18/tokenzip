import { SurrealStore } from '../src/storage/surreal/store.js';
import { registerTools } from '../src/mcp/tools/registry.js';
import { TokenBudgetManager } from '../src/mcp/token-budget.js';
import path from 'path';

async function check() {
  const repoPath = process.cwd();
  const dbPath = path.join(repoPath, '.tokenzip/db');
  
  const store = new SurrealStore(dbPath);
  await store.initialize();
  await store.migrate();
  
  const budget = new TokenBudgetManager();
  const tools = registerTools(store, repoPath, budget);
  
  const analyticsTool = tools.find(t => t.name === 'get_token_savings');
  if (analyticsTool) {
    const result = await analyticsTool.handler({});
    console.log(result.content[0].text);
  }
  
  await store.close();
}

check();
