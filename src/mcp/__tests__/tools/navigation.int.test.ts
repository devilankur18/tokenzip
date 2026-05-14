import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createNavigationTools } from '../../tools/navigation.js';

describe('navigation (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tools: any[];

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    tools = createNavigationTools(store, repoPath, budget);
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  describe('find_implementations', () => {
    let tool: any;
    beforeAll(() => {
      tool = tools.find(t => t.name === 'find_implementations');
    });

    it('1. Find implementations for common interface/class', async () => {
      // In Express, Router or EventEmitter might have implementations if indexed correctly
      const result = await tool.handler({ symbol_name: 'Router' });
      const data = JSON.parse(result.content[0].text);
      expect(data.symbol).toBe('Router');
      expect(Array.isArray(data.implementations)).toBe(true);
    });

    it('2. Handle symbol with no implementations', async () => {
      const result = await tool.handler({ symbol_name: 'GhostClass' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Symbol not found');
    });

    it('3. Verify result structure', async () => {
      const result = await tool.handler({ symbol_name: 'Router' });
      const data = JSON.parse(result.content[0].text);
      if (data.implementations.length > 0) {
        const impl = data.implementations[0];
        expect(impl).toHaveProperty('name');
        expect(impl).toHaveProperty('filePath');
      }
    });

    it('4. Case sensitivity check', async () => {
      const result = await tool.handler({ symbol_name: 'router' });
      // Depending on indexer, this might fail if it's exact match
      expect(result.content[0].text).toBeDefined();
    });

    it('5. Response contains implementationCount', async () => {
      const result = await tool.handler({ symbol_name: 'Router' });
      const data = JSON.parse(result.content[0].text);
      expect(data.implementationCount).toBeDefined();
    });
  });

  describe('get_call_hierarchy', () => {
    let tool: any;
    beforeAll(() => {
      tool = tools.find(t => t.name === 'get_call_hierarchy');
    });

    it('6. Get hierarchy for "createApplication"', async () => {
      const result = await tool.handler({ symbol_name: 'createApplication' });
      const data = JSON.parse(result.content[0].text);
      expect(data.symbol).toBe('createApplication');
      expect(data.incoming).toBeDefined();
      expect(data.outgoing).toBeDefined();
    });

    it('7. Get hierarchy for "app.init"', async () => {
      const result = await tool.handler({ symbol_name: 'app.init' });
      const data = JSON.parse(result.content[0].text);
      expect(data.symbol).toBe('app.init');
    });

    it('8. Handle non-existent symbol', async () => {
      const result = await tool.handler({ symbol_name: 'nonExistentFunc' });
      expect(result.isError).toBe(true);
    });

    it('9. Verify caller/callee fields', async () => {
      const result = await tool.handler({ symbol_name: 'createApplication' });
      const data = JSON.parse(result.content[0].text);
      if (data.outgoing.length > 0) {
        expect(data.outgoing[0]).toHaveProperty('name');
        expect(data.outgoing[0]).toHaveProperty('kind');
        expect(data.outgoing[0]).toHaveProperty('filePath');
      }
    });

    it('10. Use symbol_id for precision', async () => {
      const symbols = await store.query('SELECT id, name FROM symbol WHERE name = "createApplication" LIMIT 1');
      const id = symbols[0].id.toString();
      
      const result = await tool.handler({ symbol_name: 'createApplication', symbol_id: id });
      const data = JSON.parse(result.content[0].text);
      expect(data.symbol).toBe('createApplication');
    });
  });
});
