import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createSymbolTools } from '../../tools/symbol.js';

describe('query_symbol (Integration)', () => {
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
    tool = tools.find(t => t.name === 'query_symbol');
  }, 60000);

  afterAll(async () => {
  });

  it('1. Query for "createApplication"', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols.length).toBeGreaterThan(0);
    expect(data.symbols[0].name).toBe('createApplication');
  });

  it('2. Query for "app" (might have multiple results)', async () => {
    const result = await tool.handler({ symbol_name: 'app' });
    const data = JSON.parse(result.content[0].text);
    // If multiple results, current implementation returns error with candidates
    if (result.isError) {
      expect(data.candidates.length).toBeGreaterThan(0);
    } else {
      expect(data.symbols.length).toBeGreaterThan(0);
    }
  });

  it('3. Query for "init"', async () => {
    const result = await tool.handler({ symbol_name: 'app.init' });
    const data = JSON.parse(result.content[0].text);
    if (result.isError) {
      expect(data.candidates.length).toBeGreaterThan(0);
    } else {
      expect(data.symbols.length).toBeGreaterThan(0);
    }
  });

  it('4. Error on non-existent symbol', async () => {
    const result = await tool.handler({ symbol_name: 'GhostSymbol' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols).toHaveLength(0);
  });

  it('5. Verify symbol kinds in results', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols[0].kind).toBe('function');
  });

  it('6. Verify line numbers', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols[0].startLine).toBeGreaterThan(0);
  });

  it('7. Consistency check', async () => {
    const res1 = await tool.handler({ symbol_name: 'createApplication' });
    const res2 = await tool.handler({ symbol_name: 'createApplication' });
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('8. Tool metadata check', async () => {
    expect(tool.name).toBe('query_symbol');
  });

  it('9. Response is valid JSON', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
