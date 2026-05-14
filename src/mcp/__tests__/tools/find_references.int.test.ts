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
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    // express.js exports createApplication, so it might be referenced somewhere in mock
    expect(data.references).toBeDefined();
  });

  it('2. Find references for internal method "app.init"', async () => {
    const result = await tool.handler({ symbol_name: 'app.init' });
    const data = JSON.parse(result.content[0].text);
    expect(data.references).toBeDefined();
  });

  it('3. Error on non-existent symbol', async () => {
    const result = await tool.handler({ symbol_name: 'GhostFunctionXYZ' });
    expect(result.content[0].text).toContain('not found');
  });

  it('4. Tool metadata check', async () => {
    expect(tool.name).toBe('find_references');
  });

  it('5. Response is valid JSON', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
