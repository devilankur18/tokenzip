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

    // Setup traversal hints
    await saveTool.handler({
      category: 'architecture',
      title: 'Bootstrap Flow',
      summary: 'Start with lib/express.js to see main export.',
      scope: 'global',
      priority: 'important'
    });
    await saveTool.handler({
      category: 'architecture',
      title: 'App Init',
      summary: 'Check lazy loading in lib/application.js',
      scope: 'file',
      targets: ['lib/application.js']
    });
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Get traversal plan for root', async () => {
    const result = await tool.handler({ paths: [] });
    const data = JSON.parse(result.content[0].text);
    expect(data.plan.some((h: any) => h.title === 'Bootstrap Flow')).toBe(true);
  });

  it('2. Get traversal plan for lib/application.js', async () => {
    const result = await tool.handler({ paths: ['lib/application.js'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.plan.some((h: any) => h.title === 'App Init')).toBe(true);
    expect(data.plan.some((h: any) => h.title === 'Bootstrap Flow')).toBe(true);
  });

  it('3. Filter plan by category "architecture"', async () => {
    const result = await tool.handler({ paths: ['lib/application.js'], categories: ['architecture'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.plan.every((h: any) => h.category === 'architecture')).toBe(true);
  });

  it('4. Sequential traversal steps check', async () => {
    await saveTool.handler({
      category: 'architecture',
      title: 'Step 2',
      summary: '...',
      scope: 'file',
      targets: ['lib/request.js']
    });
    const result = await tool.handler({ paths: ['lib/application.js', 'lib/request.js'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.plan.length).toBeGreaterThanOrEqual(3); // Global + App + Request
  });

  it('5. Verify plan fields: title, summary, scope, priority', async () => {
    const result = await tool.handler({ paths: ['lib/application.js'] });
    const data = JSON.parse(result.content[0].text);
    const hint = data.plan[0];
    expect(hint.title).toBeDefined();
    expect(hint.summary).toBeDefined();
    expect(hint.scope).toBeDefined();
    expect(hint.priority).toBeDefined();
  });

  it('6. Handle non-existent path hints (global only)', async () => {
    const result = await tool.handler({ paths: ['ghost.js'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.plan.every((h: any) => h.scope === 'global')).toBe(true);
  });

  it('7. Verify result is valid JSON', async () => {
    const result = await tool.handler({ paths: ['lib/application.js'] });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });

  it('8. Consistency across calls', async () => {
    const res1 = await tool.handler({ paths: ['lib/application.js'] });
    const res2 = await tool.handler({ paths: ['lib/application.js'] });
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('cortex_traverse');
  });

  it('10. Response contains token count', async () => {
    const result = await tool.handler({ paths: ['lib/application.js'] });
    const data = JSON.parse(result.content[0].text);
    expect(data._token_count).toBeGreaterThan(0);
  });
});
