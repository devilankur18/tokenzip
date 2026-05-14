import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createNavigationTools } from '../../tools/navigation.js';

describe('get_call_hierarchy (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createNavigationTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'get_call_hierarchy');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Find callers for "createApplication"', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    // express() calls createApplication
    expect(data.calls).toBeDefined();
  });

  it('2. Find callers for internal method "init"', async () => {
    const result = await tool.handler({ symbol_name: 'init' });
    const data = JSON.parse(result.content[0].text);
    expect(data.calls.length).toBeGreaterThan(0);
  });

  it('3. Error on non-existent symbol', async () => {
    const result = await tool.handler({ symbol_name: 'GhostFunctionXYZ' });
    expect(result.content[0].text).toContain('not found');
  });

  it('4. Find callers for "handle"', async () => {
    const result = await tool.handler({ symbol_name: 'handle' });
    const data = JSON.parse(result.content[0].text);
    expect(data.calls.length).toBeGreaterThan(0);
  });

  it('5. Verify caller fields: name, filePath, kind', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    if (data.calls.length > 0) {
        const first = data.calls[0];
        expect(first.name).toBeDefined();
        expect(first.filePath).toBeDefined();
        expect(first.kind).toBeDefined();
    }
  });

  it('6. Handle overloaded names', async () => {
    // 'init' is common
    const result = await tool.handler({ symbol_name: 'init' });
    const data = JSON.parse(result.content[0].text);
    expect(data.calls.length).toBeGreaterThan(0);
  });

  it('7. Performance check', async () => {
    const start = Date.now();
    await tool.handler({ symbol_name: 'createApplication' });
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('8. Consistency check', async () => {
    const res1 = await tool.handler({ symbol_name: 'createApplication' });
    const res2 = await tool.handler({ symbol_name: 'createApplication' });
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('get_call_hierarchy');
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
