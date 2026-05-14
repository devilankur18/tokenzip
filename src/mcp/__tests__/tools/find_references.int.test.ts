import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createSymbolTools } from '../../tools/symbol.js';

describe('find_references (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createSymbolTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'find_references');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Find references for "createApplication"', async () => {
    const result = await tool.handler({ name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    // express.js uses createApplication
    expect(data.references.length).toBeGreaterThan(0);
  });

  it('2. Find references for "Router" (many)', async () => {
    const result = await tool.handler({ name: 'Router' });
    const data = JSON.parse(result.content[0].text);
    expect(data.references.length).toBeGreaterThan(5);
  });

  it('3. Filter by file_path for "app"', async () => {
    const result = await tool.handler({ 
      name: 'app', 
      file_path: 'lib/express.js' 
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.references.every((r: any) => r.filePath === 'lib/express.js')).toBe(true);
  });

  it('4. Find references for internal method "handle"', async () => {
    const result = await tool.handler({ name: 'handle' });
    const data = JSON.parse(result.content[0].text);
    expect(data.references.length).toBeGreaterThan(0);
  });

  it('5. Error on non-existent symbol', async () => {
    const result = await tool.handler({ name: 'GhostSymbolRef' });
    expect(result.content[0].text).toContain('not found');
  });

  it('6. Verify reference context presence', async () => {
    const result = await tool.handler({ name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.references.some((r: any) => r.context)).toBe(true);
  });

  it('7. Verify line numbers in references', async () => {
    const result = await tool.handler({ name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.references[0].startLine).toBeGreaterThan(0);
  });

  it('8. Consistency check', async () => {
    const res1 = await tool.handler({ name: 'Router' });
    const res2 = await tool.handler({ name: 'Router' });
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('find_references');
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ name: 'application' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
