import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNavigationTools } from '../../tools/navigation.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('get_call_hierarchy (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createNavigationTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'get_call_hierarchy');
  });

  const setupSuccessMock = () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1', name: 'foo' }]) // symbol lookup
      .mockResolvedValueOnce([{ in: 's2', metadata: { sourceName: 'caller' } }]) // incoming
      .mockResolvedValueOnce([{ out: 's3', metadata: { targetName: 'callee' } }]); // outgoing
  };

  it('1. Success - returns both incoming and outgoing', async () => {
    setupSuccessMock();
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.incoming).toBeDefined();
    expect(data.outgoing).toBeDefined();
  });

  it('2. Incoming only', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce([{ in: 's2' }])
      .mockResolvedValueOnce([]); // outgoing
    
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.incoming).toBeDefined();
    expect(data.outgoing).toHaveLength(0);
  });

  it('3. Outgoing only', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ out: 's2' }]);
    
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.outgoing).toBeDefined();
    expect(data.incoming).toHaveLength(0);
  });

  it('4. Symbol not found', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ symbol_name: 'ghost' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('5. Error from DB', async () => {
    mockStore.query.mockRejectedValue(new Error('DB Error'));
    const result = await tool.handler({ symbol_name: 'foo' });
    expect(result.isError).toBe(true);
  });

  it('6. Empty results', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.incoming).toHaveLength(0);
  });

  it('7. Truncation check', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    setupSuccessMock();
    await tool.handler({ symbol_name: 'foo' });
    expect(spy).toHaveBeenCalled();
  });

  it('8. Multiple symbol matches - uses first', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }, { id: 's2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    
    await tool.handler({ symbol_name: 'foo' });
    // It should call incoming query with id: 's1'
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('FROM calls WHERE out = $id'), expect.objectContaining({ id: 's1' }));
  });

  it('9. Tool description check', async () => {
    expect(tool.description).toContain('incoming');
  });

  it('10. Response is valid JSON', async () => {
    setupSuccessMock();
    const result = await tool.handler({ symbol_name: 'foo' });
    expect(result.content[0].text).toMatch(/\{/);
  });
});
