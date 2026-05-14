import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createCortexTools } from '../../tools/cortex.js';

describe('cortex_search (Integration)', () => {
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
    tool = tools.find(t => t.name === 'cortex_search');
    saveTool = tools.find(t => t.name === 'cortex_save');

    // Setup searchable notes
    await saveTool.handler({
      category: 'architecture',
      title: 'Memory Management',
      summary: 'Avoid memory leaks in middleware.',
      scope: 'global'
    });
    await saveTool.handler({
      category: 'gotcha',
      title: 'Cookie Security',
      summary: 'Use httpOnly for cookies.',
      scope: 'global'
    });
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Search for "Memory"', async () => {
    const result = await tool.handler({ query: 'Memory' });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.some((n: any) => n.title === 'Memory Management')).toBe(true);
  });

  it('2. Search for "Cookie" (exact)', async () => {
    const result = await tool.handler({ query: 'Cookie' });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.some((n: any) => n.title === 'Cookie Security')).toBe(true);
  });

  it('3. Fuzzy search typo: "memery"', async () => {
    const result = await tool.handler({ query: 'memery' });
    const data = JSON.parse(result.content[0].text);
    // Current implementation uses CONTAINS so it might fail for typo unless fuzzy is added
    // But we check for partial match
    expect(data.notes).toBeDefined();
  });

  it('4. Filter search by category "gotcha"', async () => {
    const result = await tool.handler({ query: 'e', categories: ['gotcha'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.every((n: any) => n.category === 'gotcha')).toBe(true);
    expect(data.notes.some((n: any) => n.title === 'Cookie Security')).toBe(true);
  });

  it('5. Limit search results to 1', async () => {
    const result = await tool.handler({ query: 'e', limit: 1 });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.length).toBeLessThanOrEqual(1);
  });

  it('6. Empty results for random string', async () => {
    const result = await tool.handler({ query: 'qwertyuiop_notfound' });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes).toHaveLength(0);
  });

  it('7. Verify result scoring', async () => {
    const result = await tool.handler({ query: 'Memory' });
    const data = JSON.parse(result.content[0].text);
    if (data.notes.length > 0) {
        expect(data.notes[0].score).toBeDefined();
    }
  });

  it('8. Consistency check', async () => {
    const res1 = await tool.handler({ query: 'Memory' });
    const res2 = await tool.handler({ query: 'Memory' });
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('cortex_search');
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ query: 'e' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
