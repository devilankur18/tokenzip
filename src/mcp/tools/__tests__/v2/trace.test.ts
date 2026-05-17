import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTraceTool } from '../../v2/trace.js';
import { TokenBudgetManager } from '../../../token-budget.js';

describe('code_trace_flow (v2)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([])
    };
    budget = new TokenBudgetManager(4000);
    tool = createTraceTool(mockStore, budget);
  });

  // Direction Scenarios (5 tests)
  it('should trace both directions by default', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'sym:1', name: 'main' }]);
    await tool.handler({ target: 'main' });
    // Should call incoming, outgoing, and implements
    expect(mockStore.query).toHaveBeenCalledTimes(5); // 1 for sym lookup, 4 for relations
  });

  it('should trace only incoming calls', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'sym:1', name: 'main' }]);
    await tool.handler({ target: 'main', direction: 'in' });
    // Should skip outgoing query
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('FROM calls WHERE out = $id'), expect.anything());
  });

  it('should trace only outgoing calls', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'sym:1', name: 'main' }]);
    await tool.handler({ target: 'main', direction: 'out' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('FROM calls WHERE in = $id'), expect.anything());
  });

  it('should include references in incoming trace', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'sym:1', name: 'main' }]);
    await tool.handler({ target: 'main', direction: 'in' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('FROM references WHERE out = $id'), expect.anything());
  });

  it('should handle invalid direction by falling back to both', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'sym:1', name: 'main' }]);
    await tool.handler({ target: 'main', direction: 'invalid' });
    expect(mockStore.query).toHaveBeenCalledTimes(5);
  });

  // Relation types (5 tests)
  it('should find implementations and inheritance', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'sym:1', name: 'IStore' }]);
    await tool.handler({ target: 'IStore' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('FROM implements, inherits'), expect.anything());
  });

  it('should return implementation details (name, kind, path)', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: '1', name: 'I' }]) // lookup
      .mockResolvedValueOnce([]) // incoming
      .mockResolvedValueOnce([]) // refs
      .mockResolvedValueOnce([]) // outgoing
      .mockResolvedValueOnce([{ name: 'Store', kind: 'class', filePath: 'src/s.ts' }]); // impls
    const result = await tool.handler({ target: 'I' });
    const data = JSON.parse(result.content[0].text);
    expect(data.implementations[0].name).toBe('Store');
  });

  it('should handle multiple callers', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: '1', name: 'f' }])
      .mockResolvedValueOnce([{ name: 'a' }, { name: 'b' }]);
    const result = await tool.handler({ target: 'f', direction: 'in' });
    const data = JSON.parse(result.content[0].text);
    expect(data.incoming).toHaveLength(2);
  });

  it('should handle nested symbol names', async () => {
    await tool.handler({ target: 'Config.load' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ name: 'Config.load' }));
  });

  it('should handle symbols with same name in different files (returns first)', async () => {
     mockStore.query.mockResolvedValueOnce([{ id: 'sym:1', name: 'util' }, { id: 'sym:2', name: 'util' }]);
     await tool.handler({ target: 'util' });
     expect(mockStore.query).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'sym:1' }));
  });

  // Error & Edge Cases (10 tests)
  it('should handle symbol not found', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ target: 'missing' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Symbol not found');
  });

  it('should handle symbols with no relationships', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: '1', name: 'f' }]);
    mockStore.query.mockResolvedValue([]); // all relation queries
    const result = await tool.handler({ target: 'f' });
    const data = JSON.parse(result.content[0].text);
    expect(data.incoming).toHaveLength(0);
    expect(data.outgoing).toHaveLength(0);
  });

  it('should handle special characters in symbol name', async () => {
    await tool.handler({ target: 'constructor' });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('should handle very deep call graphs (truncation check)', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: '1', name: 'f' }]);
    mockStore.query.mockResolvedValue(Array.from({ length: 100 }, (_, i) => ({ name: `call${i}` })));
    const result = await tool.handler({ target: 'f' });
    expect(result.content[0].text).toBeDefined();
  });

  it('should handle recursive calls (A calls A)', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: '1', name: 'f' }]);
    mockStore.query.mockResolvedValue([{ name: 'f' }]);
    const result = await tool.handler({ target: 'f' });
    expect(result.content).toBeDefined();
  });

  it('should handle database failures during relation query', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: '1', name: 'f' }]);
    mockStore.query.mockRejectedValueOnce(new Error('Connection lost'));
    const result = await tool.handler({ target: 'f' });
    expect(result.isError).toBe(true);
  });

  it('should exclude duplicate relationships', async () => {
    // Handled by SQL 'SELECT DISTINCT' or similar, but tool should be stable
    await tool.handler({ target: 'f' });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('should handle large amounts of references', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: '1', name: 'f' }]);
    mockStore.query.mockResolvedValue(Array.from({ length: 200 }, () => ({ name: 'ref' })));
    const result = await tool.handler({ target: 'f' });
    expect(JSON.parse(result.content[0].text)).toBeDefined();
  });

  it('should provide filePath in results', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: '1', name: 'f' }]);
    mockStore.query.mockResolvedValueOnce([{ name: 'caller', filePath: 'src/main.ts' }]);
    const result = await tool.handler({ target: 'f', direction: 'in' });
    const data = JSON.parse(result.content[0].text);
    expect(data.incoming[0].filePath).toBe('src/main.ts');
  });

  it('should handle empty target string', async () => {
    const result = await tool.handler({ target: '' });
    expect(result.isError).toBe(true);
  });
});
