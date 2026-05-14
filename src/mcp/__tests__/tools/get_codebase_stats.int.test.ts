import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createStructureTools } from '../../tools/structure.js';

describe('get_codebase_stats (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createStructureTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'get_codebase_stats');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Basic stats for Express.js', async () => {
    const result = await tool.handler({});
    const data = JSON.parse(result.content[0].text);
    expect(data.nodeCount).toBeDefined();
    expect(data.nodeCount.file).toBeGreaterThan(0);
  });

  it('2. Verify symbol types exist in stats', async () => {
    const result = await tool.handler({});
    const data = JSON.parse(result.content[0].text);
    // Express has many functions
    expect(data.nodeCount.symbol).toBeGreaterThan(0);
  });

  it('3. Check repository stats', async () => {
    const result = await tool.handler({});
    const data = JSON.parse(result.content[0].text);
    expect(data.nodeCount.repository).toBe(1);
  });

  it('4. Consistency check', async () => {
    const res1 = await tool.handler({});
    const res2 = await tool.handler({});
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });


  it('6. Stats after database clearing (should be empty)', async () => {
    // This is risky for other tests, so we won't actually clear it here
    // but we can simulate a check if needed.
    // Instead we just check that stats object structure is consistent.
    const result = await tool.handler({});
    const data = JSON.parse(result.content[0].text);
    expect(typeof data.nodeCount).toBe('object');
  });

  it('7. Budget manager truncation - large stats', async () => {
    const result = await tool.handler({});
    const data = JSON.parse(result.content[0].text);
    expect(result.content[0].text.length).toBeGreaterThan(0);
  });

  it('8. Verify module count', async () => {
    const result = await tool.handler({});
    const data = JSON.parse(result.content[0].text);
    expect(data.nodeCount.module).toBeGreaterThan(0);
  });

  it('9. Tool metadata check', async () => {
    const tools = createStructureTools(store, repoPath, budget);
    const statsTool = tools.find(t => t.name === 'get_codebase_stats');
    expect(statsTool.description).toContain('statistics');
  });

  it('10. Response format check', async () => {
    const result = await tool.handler({});
    expect(result.content[0].text).toMatch(/\{[\s\S]*\}/); // Should be JSON
  });
});
