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
    expect(data.matches.length).toBeGreaterThan(0);
    expect(data.matches[0].name).toBe('createApplication');
  });

  it('2. Fuzzy match for "app" (partial)', async () => {
    const result = await tool.handler({ query: 'app' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches.length).toBeGreaterThan(0);
  });

  it('3. Fuzzy match for "Router" with limit 3', async () => {
    const result = await tool.handler({ query: 'Router', limit: 3 });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches.length).toBeLessThanOrEqual(3);
  });

  it('4. Filter by language "javascript"', async () => {
    const result = await tool.handler({ query: 'app', language: 'javascript' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches.length).toBeGreaterThan(0);
  });

  it('5. Typos handling: "creataAplication"', async () => {
    const result = await tool.handler({ query: 'creataAplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches.some((m: any) => m.name === 'createApplication')).toBe(true);
  });

  it('6. Scoring check (exact should be first)', async () => {
    const result = await tool.handler({ query: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches[0].name).toBe('createApplication');
    expect(data.matches[0].score).toBeGreaterThan(0.9);
  });

  it('7. Empty results for random string', async () => {
    const result = await tool.handler({ query: 'qazwsxedcrfvtgb' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches).toHaveLength(0);
  });

  it('8. Search for "handle" (multiple results)', async () => {
    const result = await tool.handler({ query: 'handle' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches.length).toBeGreaterThan(1);
  });

  it('9. Verify result fields: score, kind, filePath', async () => {
    const result = await tool.handler({ query: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    const first = data.matches[0];
    expect(first.score).toBeDefined();
    expect(first.kind).toBeDefined();
    expect(first.filePath).toBeDefined();
  });

  it('10. Performance check (fast enough)', async () => {
    const start = Date.now();
    await tool.handler({ query: 'app' });
    const end = Date.now();
    expect(end - start).toBeLessThan(1000); // Should be sub-second
  });
});
