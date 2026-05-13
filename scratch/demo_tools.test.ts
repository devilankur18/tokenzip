import { test } from 'vitest';
import { setupIntegrationTest } from '../src/mcp/__tests__/test-setup.js';
import { registerTools } from '../src/mcp/tools/registry.js';
import { TokenBudgetManager } from '../src/mcp/token-budget.js';

test('demo new tools', { timeout: 30000 }, async () => {
  const { store, repoPath } = await setupIntegrationTest();
  
  const budget = new TokenBudgetManager();
  const tools = registerTools(store, repoPath, budget);
  
  const testCalls = [
    { name: 'fuzzy_find_symbol', args: { query: 'Router' } },
    { name: 'search_codebase', args: { query: 'createApplication' } },
    { name: 'find_implementations', args: { symbol_name: 'EventEmitter' } },
    { name: 'get_call_hierarchy', args: { symbol_name: 'init' } },
    { name: 'smart_file_read', args: { path: 'lib/application.js', mode: 'skeleton' } }
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
