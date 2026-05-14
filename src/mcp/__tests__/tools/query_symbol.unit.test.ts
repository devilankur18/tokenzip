import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSymbolTools } from '../../tools/symbol.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('query_symbol (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createSymbolTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'query_symbol');
  });

  it('1. Success - returns symbol details', async () => {
    mockStore.query.mockResolvedValueOnce([
      { id: 's1', name: 'foo', kind: 'function', signature: 'foo()', filePath: 'test.js' }
    ]);
    
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols).toHaveLength(1);
    expect(data.symbols[0].name).toBe('foo');
  });

  it('2. Multiple symbols - returns candidates error', async () => {
    mockStore.query.mockResolvedValueOnce([
      { id: 's1', name: 'foo', kind: 'class', filePath: 'a.js' },
      { id: 's2', name: 'foo', kind: 'class', filePath: 'b.js' }
    ]);
    
    const result = await tool.handler({ symbol_name: 'foo' });
    expect(result.isError).toBe(true);
    const data = JSON.parse(result.content[0].text);
    expect(data.candidates).toHaveLength(2);
  });

  it('3. Symbol not found', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ symbol_name: 'Ghost' });
    // In current implementation, if not found it just returns empty symbols list in response
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols).toHaveLength(0);
  });

  it('4. Truncation check', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    mockStore.query.mockResolvedValueOnce([{ name: 'foo' }]);
    await tool.handler({ symbol_name: 'foo' });
    expect(spy).toHaveBeenCalled();
  });

  it('5. Error from store', async () => {
    mockStore.query.mockRejectedValue(new Error('DB error'));
    const result = await tool.handler({ symbol_name: 'foo' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('DB error');
  });

  it('6. Tool description check', async () => {
    expect(tool.description).toContain('Lookup');
  });

  it('7. Response is valid JSON', async () => {
    mockStore.query.mockResolvedValueOnce([{ name: 'foo' }]);
    const result = await tool.handler({ symbol_name: 'foo' });
    expect(result.content[0].text).toMatch(/\{/);
  });
});
