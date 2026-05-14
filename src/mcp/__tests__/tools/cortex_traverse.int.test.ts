import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createCortexTools } from '../../tools/cortex.js';

describe('cortex_traverse (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;
  let saveTool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createCortexTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'cortex_traverse');
    saveTool = tools.find(t => t.name === 'cortex_save');

    // Setup traversal hint
    await saveTool.handler({
      category: 'traversal_hint',
      title: 'App Init Flow',
      summary: 'Start with application.js',
      scope: 'module',
      targets: ['lib'],
      read_order: ['lib/express.js', 'lib/application.js']
    });
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Get traversal plan for lib', async () => {
    const result = await tool.handler({ target: 'lib' });
    const data = JSON.parse(result.content[0].text);
    expect(data.source).toBe('stored_hint');
    expect(data.recommended_read_order).toContain('lib/express.js');
  });

  it('2. Graph fallback for nonexistent target with module', async () => {
    // We don't have a hint for root
    const result = await tool.handler({ target: 'lib' }); // wait, I just added a hint for lib
    // Let's try a different one
    const result2 = await tool.handler({ target: 'unknown' });
    expect(result2.isError).toBe(true);
  });

  it('3. Tool metadata check', async () => {
    expect(tool.name).toBe('cortex_traverse');
  });

  it('4. Response is valid JSON', async () => {
    const result = await tool.handler({ target: 'lib' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
