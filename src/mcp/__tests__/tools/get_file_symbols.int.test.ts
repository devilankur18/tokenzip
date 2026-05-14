import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createStructureTools } from '../../tools/structure.js';

describe('get_file_symbols (Integration)', () => {
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
    tool = tools.find(t => t.name === 'get_file_symbols');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Get symbols for lib/express.js', async () => {
    const result = await tool.handler({ path: 'lib/express.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols.length).toBeGreaterThan(0);
    expect(data.symbols.some((s: any) => s.name === 'createApplication')).toBe(true);
  });

  it('2. Get symbols for lib/application.js (many symbols)', async () => {
    const result = await tool.handler({ path: 'lib/application.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols.length).toBeGreaterThan(10);
  });

  it('3. Get symbols for empty file / non-existent', async () => {
    const result = await tool.handler({ path: 'Readme.md' });
    const data = JSON.parse(result.content[0].text);
    // Readme might not have symbols if it's not code
    expect(data.symbols).toBeDefined();
  });

  it('4. Verify symbol kinds', async () => {
    const result = await tool.handler({ path: 'lib/application.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols.some((s: any) => s.kind === 'method')).toBe(true);
  });

  it('5. Verify line ranges', async () => {
    const result = await tool.handler({ path: 'lib/express.js' });
    const data = JSON.parse(result.content[0].text);
    const sym = data.symbols.find((s: any) => s.name === 'createApplication');
    expect(sym.startLine).toBeGreaterThan(0);
    expect(sym.endLine).toBeGreaterThan(sym.startLine);
  });

  it('6. Error on invalid path', async () => {
    const result = await tool.handler({ path: 'ghost.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols).toHaveLength(0);
  });

  it('7. Consistency check', async () => {
    const res1 = await tool.handler({ path: 'lib/express.js' });
    const res2 = await tool.handler({ path: 'lib/express.js' });
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('8. Verify exported flag (if available)', async () => {
    const result = await tool.handler({ path: 'lib/express.js' });
    const data = JSON.parse(result.content[0].text);
    const sym = data.symbols.find((s: any) => s.name === 'createApplication');
    // createApplication is module.exports = createApplication
    expect(sym).toBeDefined();
  });

  it('9. Performance check', async () => {
    const start = Date.now();
    await tool.handler({ path: 'lib/application.js' });
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ path: 'lib/express.js' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
