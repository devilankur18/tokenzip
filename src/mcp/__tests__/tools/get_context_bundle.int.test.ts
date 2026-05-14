import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createContextTools } from '../../tools/context.js';

describe('get_context_bundle (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createContextTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'get_context_bundle');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Get context for "createApplication"', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.target).toBeDefined();
    expect(data.target.name).toBe('createApplication');
    expect(data.dependencies).toBeDefined();
  });

  it('2. Error on non-existent target', async () => {
    const result = await tool.handler({ symbol_name: 'GhostTarget' });
    expect(result.content[0].text).toContain('not found');
  });

  it('3. Context for internal method "app.handle"', async () => {
    const result = await tool.handler({ symbol_name: 'app.handle' });
    const data = JSON.parse(result.content[0].text);
    expect(data.target).toBeDefined();
  });

  it('4. Tool metadata check', async () => {
    expect(tool.name).toBe('get_context_bundle');
  });

  it('5. Response is valid JSON', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
