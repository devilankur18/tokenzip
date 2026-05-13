import { test } from 'vitest';
import { setupIntegrationTest } from '../src/mcp/__tests__/test-setup.js';
import { registerTools } from '../src/mcp/tools/registry.js';
import { TokenBudgetManager } from '../src/mcp/token-budget.js';

test('demo get_context_bundle', { timeout: 30000 }, async () => {
  const { store, repoPath } = await setupIntegrationTest();
  
  const budget = new TokenBudgetManager();
  const tools = registerTools(store, repoPath, budget);
  
  const tool = tools.find(t => t.name === 'get_context_bundle');
  if (tool) {
    console.log(`\n=== Testing get_context_bundle ===`);
    const result = await tool.handler({ symbol_name: 'createApplication' });
    console.log('Output:');
    console.log(result.content[0].text);
  }
  
  await store.close();
});
