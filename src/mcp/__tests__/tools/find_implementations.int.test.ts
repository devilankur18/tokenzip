import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createNavigationTools } from '../../tools/navigation.js';

describe('find_implementations (Integration)', () => {
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
    tool = tools.find(t => t.name === 'find_implementations');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Find implementations for "Router"', async () => {
    const result = await tool.handler({ symbol_name: 'Router' });
    const data = JSON.parse(result.content[0].text);
    expect(data.implementations).toBeDefined();
    // In our mock, 'MyRouter' implements 'Router'
    expect(data.implementations.some((i: any) => i.name === 'MyRouter')).toBe(true);
  });

  it('2. Error on non-existent symbol', async () => {
    const result = await tool.handler({ symbol_name: 'GhostInterface' });
    expect(result.content[0].text).toContain('not found');
  });

  it('3. Tool metadata check', async () => {
    expect(tool.name).toBe('find_implementations');
  });

  it('4. Response is valid JSON', async () => {
    const result = await tool.handler({ symbol_name: 'Router' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
