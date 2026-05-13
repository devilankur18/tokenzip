import { test } from 'vitest';
import { SurrealStore } from '../src/storage/surreal/store.js';
import { registerTools } from '../src/mcp/tools/registry.js';
import { TokenBudgetManager } from '../src/mcp/token-budget.js';
import path from 'path';

test('demo get_context_bundle', { timeout: 30000 }, async () => {
  const repoPath = process.cwd();
  const dbPath = path.join(repoPath, '.tokenzip/db');
  
  const store = new SurrealStore(dbPath);
  await store.initialize();
  
  const budget = new TokenBudgetManager();
  const tools = registerTools(store, repoPath, budget);
  
  const tool = tools.find(t => t.name === 'get_context_bundle');
  if (tool) {
    console.log(`\n=== Testing get_context_bundle ===`);
    const result = await tool.handler({ symbol_name: 'interfaceOnlyStrategy' });
    console.log('Output:');
    console.log(result.content[0].text);
  }
  
  await store.close();
});
