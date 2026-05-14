import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createSearchTools } from '../../tools/search.js';

describe('fuzzy_find_symbol (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createSearchTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'fuzzy_find_symbol');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Fuzzy match for "createApplication"', async () => {
    const result = await tool.handler({ query: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.candidates.length).toBeGreaterThan(0);
    expect(data.candidates.some((c: any) => c.name === 'createApplication')).toBe(true);
  });

  it('2. Fuzzy match for "app" (partial)', async () => {
    const result = await tool.handler({ query: 'app' });
    const data = JSON.parse(result.content[0].text);
    expect(data.candidates.length).toBeGreaterThan(0);
  });

  it('3. Fuzzy match for "Router" with limit 3', async () => {
    const result = await tool.handler({ query: 'Router', limit: 3 });
    const data = JSON.parse(result.content[0].text);
    expect(data.candidates.length).toBeLessThanOrEqual(3);
  });

  it('4. Filter by kind "class"', async () => {
    const result = await tool.handler({ query: 'Router', kind: 'class' });
    const data = JSON.parse(result.content[0].text);
    expect(data.candidates.every((c: any) => c.kind === 'class')).toBe(true);
  });

  it('5. Tool metadata check', async () => {
    expect(tool.name).toBe('fuzzy_find_symbol');
  });

  it('6. Response is valid JSON', async () => {
    const result = await tool.handler({ query: 'app' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
