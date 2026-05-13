import { SurrealStore } from '../src/storage/surreal/store.js';
import { createStructureTools } from '../src/mcp/tools/structure.js';
import { TokenBudgetManager } from '../src/mcp/token-budget.js';
import path from 'path';

async function test() {
  const repoPath = process.cwd();
  const dbPath = path.join(repoPath, '.tokenzip/db');
  
  const store = new SurrealStore(dbPath);
  await store.initialize();
  
  const budget = new TokenBudgetManager(2000); // Small budget to trigger truncation
  const tools = createStructureTools(store, repoPath, budget);
  const queryTool = tools.find(t => t.name === 'query_repo_structure')!;
  
  console.log('\n--- Testing Depth 1 ---');
  const res1 = await queryTool.handler({ depth: 1 });
  console.log(res1.content[0].text);
  
  console.log('\n--- Testing Depth 2 ---');
  const res2 = await queryTool.handler({ depth: 2 });
  console.log(res2.content[0].text);
  
  console.log('\n--- Testing Depth 3 (Should be larger) ---');
  const res3 = await queryTool.handler({ depth: 3 });
  console.log(res3.content[0].text);
  
  await store.close();
}

test().catch(console.error);
