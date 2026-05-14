import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSearchTools } from '../../tools/search.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('search_codebase (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createSearchTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'search_codebase');
  });

  it('1. Success - returns search results', async () => {
    mockStore.query.mockResolvedValueOnce([
      { path: 'test.js', score: 0.9, name: 'foo' }
    ]);
    
    const result = await tool.handler({ query: 'test' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0].name).toBe('foo');
  });

  it('2. Limit check', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    await tool.handler({ query: 'test', limit: 10 });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $limit'), expect.objectContaining({ limit: 10 }));
  });

  it('3. Empty results', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ query: 'nothing' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches).toHaveLength(0);
  });

  it('4. Error from store', async () => {
    mockStore.query.mockRejectedValue(new Error('Search failed'));
    const result = await tool.handler({ query: 'test' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Search failed');
  });

  it('5. Truncation check', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    mockStore.query.mockResolvedValueOnce(Array(50).fill({ path: 't.js' }));
    await tool.handler({ query: 'test' });
    expect(spy).toHaveBeenCalled();
  });

  it('6. Response is valid JSON', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ query: 'test' });
    expect(result.content[0].text).toMatch(/\{/);
  });

  it('7. Tool description check', async () => {
    expect(tool.description).toContain('text search');
  });

  it('8. Correct fields in response', async () => {
    mockStore.query.mockResolvedValueOnce([{ name: 'test', kind: 'function' }]);
    const result = await tool.handler({ query: 'test' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches[0]).toHaveProperty('name');
  });
});
