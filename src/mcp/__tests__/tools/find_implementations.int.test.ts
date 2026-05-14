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
    // Router is implemented in lib/router/index.js
    expect(data.implementations).toBeDefined();
  });

  it('2. Find implementations for "EventEmitter"', async () => {
    // EventEmitter is a node builtin, might not be in index as implementation target
    const result = await tool.handler({ symbol_name: 'EventEmitter' });
    const data = JSON.parse(result.content[0].text);
    expect(data.implementations).toBeDefined();
  });

  it('3. Error on non-existent symbol', async () => {
    const result = await tool.handler({ symbol_name: 'GhostInterface' });
    expect(result.content[0].text).toContain('not found');
  });

  it('4. Find implementations for "Application"', async () => {
    const result = await tool.handler({ symbol_name: 'Application' });
    const data = JSON.parse(result.content[0].text);
    expect(data.implementations).toBeDefined();
  });

  it('5. Verify result fields: name, filePath, startLine', async () => {
    const result = await tool.handler({ symbol_name: 'Router' });
    const data = JSON.parse(result.content[0].text);
    if (data.implementations.length > 0) {
        const first = data.implementations[0];
        expect(first.name).toBeDefined();
        expect(first.filePath).toBeDefined();
        expect(first.startLine).toBeDefined();
    }
  });

  it('6. Handle complex names with dots (if any)', async () => {
    const result = await tool.handler({ symbol_name: 'express.Router' });
    const data = JSON.parse(result.content[0].text);
    expect(data.implementations).toBeDefined();
  });

  it('7. Performance check for common interface', async () => {
    const start = Date.now();
    await tool.handler({ symbol_name: 'EventEmitter' });
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('8. Consistency check', async () => {
    const res1 = await tool.handler({ symbol_name: 'Router' });
    const res2 = await tool.handler({ symbol_name: 'Router' });
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('find_implementations');
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ symbol_name: 'Router' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
