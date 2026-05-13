import { test } from 'vitest';
import { SurrealStore } from '../src/storage/surreal/store.js';
import { registerTools } from '../src/mcp/tools/registry.js';
import { TokenBudgetManager } from '../src/mcp/token-budget.js';
import path from 'path';

test('demo new tools', { timeout: 30000 }, async () => {
  const repoPath = process.cwd();
  const dbPath = path.join(repoPath, '.tokenzip/db');
  
  const store = new SurrealStore(dbPath);
  await store.initialize();
  
  const budget = new TokenBudgetManager();
  const tools = registerTools(store, repoPath, budget);
  
  const testCalls = [
    { name: 'fuzzy_find_symbol', args: { query: 'Smart' } },
    { name: 'search_codebase', args: { query: 'TokenBudgetManager' } },
    { name: 'find_implementations', args: { symbol_name: 'IStore' } },
    { name: 'get_call_hierarchy', args: { symbol_name: 'executeStrategy' } },
    { name: 'smart_file_read', args: { path: 'src/mcp/tools/smart-file-read.ts', mode: 'skeleton' } }
  ];
  
  for (const call of testCalls) {
    const tool = tools.find(t => t.name === call.name);
    if (tool) {
      console.log(`\n=== Testing ${call.name} ===`);
      console.log(`Args: ${JSON.stringify(call.args)}`);
      const result = await tool.handler(call.args);
      console.log('Output:');
      console.log(result.content[0].text);
    }
  }
  
  await store.close();
});
