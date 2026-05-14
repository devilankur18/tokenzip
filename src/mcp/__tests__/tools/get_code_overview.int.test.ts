import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createStructureTools } from '../../tools/structure.js';

describe('get_code_overview (Integration)', () => {
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
    tool = tools.find(t => t.name === 'get_code_overview');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Get full codebase overview', async () => {
    const result = await tool.handler({ format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure).toBeDefined();
    expect(data.structure.children.length).toBeGreaterThan(0);
  });

  it('2. Get overview of "lib" directory', async () => {
    const result = await tool.handler({ path: 'lib', format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure.name).toBe('lib');
    expect(data.structure.children.length).toBeGreaterThan(0);
  });

  it('3. Depth 1 overview (top level)', async () => {
    const result = await tool.handler({ depth: 1, format: 'json' });
    const data = JSON.parse(result.content[0].text);
    // Depth 1 means only immediate children of root
    expect(data.structure.children.every((c: any) => !c.children || c.children.length === 0)).toBe(true);
  });

  it('4. Depth 0 overview (just root)', async () => {
    const result = await tool.handler({ depth: 0, format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure.children || []).toHaveLength(0);
  });

  it('5. Verify symbols are excluded in compact mode', async () => {
    const result = await tool.handler({ path: 'lib/express.js', format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect((data.structure.children || []).every((c: any) => c.type !== 'symbol')).toBe(true);
  });

  it('6. Verbose mode check', async () => {
    const result = await tool.handler({ verbose: true, format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure.id).toBeDefined();
  });

  it('7. Adaptive mode - verify structure', async () => {
    const result = await tool.handler({ depth: 5, adaptive: true, format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure).toBeDefined();
  });

  it('8. Error on non-existent path', async () => {
    const result = await tool.handler({ path: 'missing/path' });
    expect(result.isError).toBe(true);
  });

  it('9. Verify alias handler', async () => {
    const tools = createStructureTools(store, repoPath, budget);
    const alias = tools.find(t => t.name === 'get_code_overview');
    const res = await alias.handler({ format: 'json' });
    expect(res.content).toBeDefined();
  });

  it('10. Response contains truncation metadata', async () => {
    const result = await tool.handler({ format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data._token_count).toBeDefined();
  });
});
