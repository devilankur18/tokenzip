import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSymbolTools } from '../../tools/symbol.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('find_references (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createSymbolTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'find_references');
  });

  it('1. Success - returns references from all relation types', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }]) // target lookup
      .mockResolvedValueOnce(['c1']) // r1 (calls)
      .mockResolvedValueOnce(['c2']) // r2 (inherits)
      .mockResolvedValueOnce(['c3']) // r3 (implements)
      .mockResolvedValueOnce(['c4']) // r4 (references)
      .mockResolvedValueOnce([ // details lookup
        { id: 'c1', name: 'call1' },
        { id: 'c2', name: 'call2' },
        { id: 'c3', name: 'call3' },
        { id: 'c4', name: 'call4' }
      ]);
    
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.references).toHaveLength(4);
  });

  it('2. Symbol not found', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ symbol_name: 'ghost' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('3. No references found', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.references).toHaveLength(0);
  });

  it('4. Handles large result list truncation', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce(['r1'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'r1' }]);
    
    await tool.handler({ symbol_name: 'foo' });
    expect(spy).toHaveBeenCalled();
  });

  it('5. Error Handling - store failure', async () => {
    mockStore.query.mockRejectedValue(new Error('Store Error'));
    const result = await tool.handler({ symbol_name: 'foo' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Store Error');
  });

  it('6. Deduplication of references', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce(['c1']) // r1
      .mockResolvedValueOnce(['c1']) // r2 (duplicate)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'c1', name: 'call1' }]);
    
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.references).toHaveLength(1);
  });

  it('7. Handles multiple symbol targets', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }, { id: 's2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    
    await tool.handler({ symbol_name: 'foo' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('IN $targets'), expect.objectContaining({ targets: ['s1', 's2'] }));
  });

  it('8. Sorting of results', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce(['c1', 'c2'])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'c1', filePath: 'b.js', startLine: 10 },
        { id: 'c2', filePath: 'a.js', startLine: 5 }
      ]);
    
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.references[0].filePath).toBe('a.js');
  });

  it('9. Tool description check', async () => {
    expect(tool.description).toContain('reference');
  });

  it('10. Response is valid JSON', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const result = await tool.handler({ symbol_name: 'foo' });
    expect(result.content[0].text).toMatch(/\{/);
  });
});
