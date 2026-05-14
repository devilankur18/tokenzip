import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNavigationTools } from '../../tools/navigation.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('find_implementations (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createNavigationTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'find_implementations');
  });

  it('1. Success - returns implementations', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1', name: 'Auth' }]) // symbol lookup
      .mockResolvedValueOnce([{ id: 's2', name: 'LDAPAuth' }]); // implementations lookup
    
    const result = await tool.handler({ symbol_name: 'Auth' });
    const data = JSON.parse(result.content[0].text);
    expect(data.implementations).toHaveLength(1);
    expect(data.implementations[0].name).toBe('LDAPAuth');
  });

  it('2. Symbol not found', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ symbol_name: 'ghost' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Symbol not found');
  });

  it('3. No implementations found', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce([]);
    
    const result = await tool.handler({ symbol_name: 'Auth' });
    const data = JSON.parse(result.content[0].text);
    expect(data.implementations).toHaveLength(0);
  });

  it('4. Handles large result truncation', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce(Array(50).fill({ name: 'impl' }));
    
    await tool.handler({ symbol_name: 'Auth' });
    expect(spy).toHaveBeenCalled();
  });

  it('5. Error handling - store error', async () => {
    mockStore.query.mockRejectedValue(new Error('DB error'));
    const result = await tool.handler({ symbol_name: 'Auth' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('DB error');
  });

  it('6. Tool description check', async () => {
    expect(tool.description).toContain('implementations');
  });

  it('7. Multi-match - uses all symbols', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }, { id: 's2' }])
      .mockResolvedValueOnce([]);
    
    await tool.handler({ symbol_name: 'Auth' });
    // The query should contain IN $targets and targets should be ['s1', 's2']
    expect(mockStore.query).toHaveBeenNthCalledWith(2, expect.stringContaining('IN $targets'), expect.objectContaining({ targets: ['s1', 's2'] }));
  });

  it('8. Response is valid JSON', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce([]);
    const result = await tool.handler({ symbol_name: 'Auth' });
    expect(result.content[0].text).toMatch(/\{/);
  });
});
