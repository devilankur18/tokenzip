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

  it('1. Get call hierarchy for "createApplication"', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbol).toBe('createApplication');
    expect(data.incoming).toBeDefined();
    expect(data.outgoing).toBeDefined();
  });

  it('2. Get call hierarchy for internal "app.init"', async () => {
    const result = await tool.handler({ symbol_name: 'app.init' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbol).toBeDefined();
  });

  it('3. Error on non-existent symbol', async () => {
    const result = await tool.handler({ symbol_name: 'GhostFunction' });
    expect(result.content[0].text).toContain('not found');
  });

  it('4. Tool metadata check', async () => {
    expect(tool.name).toBe('get_call_hierarchy');
  });

  it('5. Response is valid JSON', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
