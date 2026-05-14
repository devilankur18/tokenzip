import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createSearchTools } from '../../tools/search.js';

describe('search_codebase (Integration)', () => {
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
    tool = tools.find(t => t.name === 'search_codebase');
  }, 60000);

  afterAll(async () => {
  });

  it('1. Search for "application"', async () => {
    const result = await tool.handler({ query: 'application' });
    if (result.isError) throw new Error(`RESULT ERROR: ${result.content[0].text}`);
    const data = JSON.parse(result.content[0].text);
    expect(data.matches.length).toBeGreaterThan(0);
    expect(data.matches.some((m: any) => m.name.toLowerCase().includes('application'))).toBe(true);
  });

  it('2. Search for "Router" with limit 5', async () => {
    const result = await tool.handler({ query: 'Router', limit: 5 });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches.length).toBeLessThanOrEqual(5);
  });

  it('3. Filter by language "javascript" (or typescript depending on indexer)', async () => {
    const result = await tool.handler({ query: 'app' });
    const data = JSON.parse(result.content[0].text);
    if (data.matches.length > 0) {
      const lang = data.matches[0].language;
      const resFiltered = await tool.handler({ query: 'app', language: lang });
      const dataFiltered = JSON.parse(resFiltered.content[0].text);
      expect(dataFiltered.matches.length).toBeGreaterThan(0);
      expect(dataFiltered.matches.every((m: any) => m.language === lang)).toBe(true);
    }
  });

  it('4. Filter by path_pattern "lib/"', async () => {
    const result = await tool.handler({ query: 'handle', path_pattern: 'lib/' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches.every((m: any) => m.filePath.startsWith('lib/'))).toBe(true);
  });

  it('5. Case insensitive search check', async () => {
    const res1 = await tool.handler({ query: 'APPLICATION' });
    const res2 = await tool.handler({ query: 'application' });
    expect(JSON.parse(res1.content[0].text).matches.length).toBe(JSON.parse(res2.content[0].text).matches.length);
    expect(JSON.parse(res1.content[0].text).matches.length).toBeGreaterThan(0);
  });

  it('6. Empty results for weird string', async () => {
    const result = await tool.handler({ query: 'ZXYWVU_NOT_FOUND' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches).toHaveLength(0);
  });

  it('7. Search for common term "module"', async () => {
    const result = await tool.handler({ query: 'module' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches.length).toBeGreaterThan(1);
  });

  it('8. Verify result fields', async () => {
    const result = await tool.handler({ query: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    if (data.matches.length > 0) {
       const first = data.matches[0];
       expect(first.name).toBeDefined();
       expect(first.kind).toBeDefined();
       expect(first.filePath).toBeDefined();
    }
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('search_codebase');
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ query: 'e', limit: 10 });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
