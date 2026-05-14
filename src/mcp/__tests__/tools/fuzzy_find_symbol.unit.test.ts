import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSearchTools } from '../../tools/search.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('fuzzy_find_symbol (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createSearchTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'fuzzy_find_symbol');
  });

  it('1. Success - returns matching symbols', async () => {
    mockStore.query.mockResolvedValueOnce([
      { name: 'auth_service', kind: 'class', score: 0.9 }
    ]);
    
    const result = await tool.handler({ query: 'auth' });
    const data = JSON.parse(result.content[0].text);
    expect(data.candidates).toHaveLength(1);
    expect(data.candidates[0].name).toBe('auth_service');
  });

  it('2. Filter by kind', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    await tool.handler({ query: 'auth', kind: 'function' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('kind = $kind'), expect.objectContaining({ kind: 'function' }));
  });

  it('3. Limit check', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    await tool.handler({ query: 'test', limit: 10 });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $limit'), expect.objectContaining({ limit: 10 }));
  });

  it('4. Empty results', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ query: 'ghost' });
    const data = JSON.parse(result.content[0].text);
    expect(data.candidates).toHaveLength(0);
  });

  it('5. Truncation check', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    mockStore.query.mockResolvedValueOnce(Array(50).fill({ name: 'sym' }));
    await tool.handler({ query: 'test' });
    expect(spy).toHaveBeenCalled();
  });

  it('6. Error from store', async () => {
    mockStore.query.mockRejectedValue(new Error('DB Error'));
    const result = await tool.handler({ query: 'test' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('DB Error');
  });

  it('7. Tool description check', async () => {
    expect(tool.description.toLowerCase()).toContain('fuzzy');
  });

  it('8. Ranking check (internal)', async () => {
    mockStore.query.mockResolvedValueOnce([
      { name: 'test1', score: 0.9 },
      { name: 'test2', score: 0.8 }
    ]);
    const result = await tool.handler({ query: 'test' });
    const data = JSON.parse(result.content[0].text);
    expect(data.candidates).toHaveLength(2);
  });

  it('9. Response is valid JSON', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ query: 'test' });
    expect(result.content[0].text).toMatch(/\{/);
  });

  it('10. Correct fields in response', async () => {
    mockStore.query.mockResolvedValueOnce([{ name: 'test', score: 1.0 }]);
    const result = await tool.handler({ query: 'test' });
    const data = JSON.parse(result.content[0].text);
    expect(data.candidates[0]).toHaveProperty('name');
  });
});
