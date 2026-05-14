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
    const result = await tool.handler({ file_path: 'lib/express.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols.length).toBeGreaterThan(0);
    expect(data.symbols.some((s: any) => s.name === 'createApplication')).toBe(true);
  });

  it('2. Get symbols for lib/application.js (many symbols)', async () => {
    const result = await tool.handler({ file_path: 'lib/application.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols.length).toBeGreaterThan(0);
  });

  it('3. Error on non-existent file', async () => {
    const result = await tool.handler({ file_path: 'GhostFileXYZ.js' });
    expect(result.content[0].text).toContain('not found');
  });

  it('4. Tool metadata check', async () => {
    expect(tool.name).toBe('get_file_symbols');
  });

  it('5. Response is valid JSON', async () => {
    const result = await tool.handler({ file_path: 'lib/express.js' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
