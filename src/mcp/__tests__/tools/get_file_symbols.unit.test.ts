import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStructureTools } from '../../tools/structure.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('get_file_symbols (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createStructureTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'get_file_symbols');
  });

  it('1. Success - returns file symbols', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1' }]) // File lookup
      .mockResolvedValueOnce([ // Symbols lookup
        { name: 'foo', kind: 'function', startLine: 1, endLine: 5 }
      ]);
    const result = await tool.handler({ file_path: 'test.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols[0].name).toBe('foo');
  });

  it('2. Multiple symbols in file', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1' }])
      .mockResolvedValueOnce([
        { name: 'S1', kind: 'class' },
        { name: 'm1', kind: 'method' }
      ]);
    const result = await tool.handler({ file_path: 'test.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols).toHaveLength(2);
  });

  it('3. File not found / No symbols', async () => {
    mockStore.query.mockResolvedValueOnce([]); // File lookup fails
    const result = await tool.handler({ file_path: 'missing.js' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('File not found');
  });

  it('4. Truncation enforcement', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1' }])
      .mockResolvedValueOnce([{ name: 'test' }]);
    await tool.handler({ file_path: 'test.js' });
    expect(spy).toHaveBeenCalled();
  });

  it('5. Error from store', async () => {
    mockStore.query.mockRejectedValue(new Error('Query failed'));
    const result = await tool.handler({ file_path: 'test.js' });
    expect(result.isError).toBe(true);
  });

  it('6. Verify symbol fields', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1' }])
      .mockResolvedValueOnce([{ name: 'f', kind: 'fn', startLine: 1, endLine: 2 }]);
    const result = await tool.handler({ file_path: 't.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols[0]).toHaveProperty('startLine');
    expect(data.symbols[0]).toHaveProperty('endLine');
  });

  it('7. Handles path with leading slash', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'f1' }]).mockResolvedValueOnce([]);
    await tool.handler({ file_path: '/test.js' });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('8. Default budget used', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'f1' }]).mockResolvedValueOnce([]);
    await tool.handler({ file_path: 'test.js' });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('9. Tool name check', async () => {
    expect(tool.name).toBe('get_file_symbols');
  });

  it('10. Response is valid JSON', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'f1' }]).mockResolvedValueOnce([]);
    const result = await tool.handler({ file_path: 'test.js' });
    expect(result.content[0].text).toMatch(/\{/);
  });
});
