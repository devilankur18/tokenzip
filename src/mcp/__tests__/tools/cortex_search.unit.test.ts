import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCortexTools } from '../../tools/cortex.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('cortex_search (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createCortexTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'cortex_search');
  });

  it('1. Success - returns matching notes', async () => {
    mockStore.query.mockResolvedValueOnce([
      { title: 'Auth guidelines', category: 'guideline' }
    ]);
    
    const result = await tool.handler({ query: 'auth' });
    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].title).toBe('Auth guidelines');
  });

  it('2. Filter by category', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    await tool.handler({ category: 'guideline' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('category = $category'), expect.objectContaining({ category: 'guideline' }));
  });

  it('3. Filter by tags', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    await tool.handler({ tags: ['security', 'api'] });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('tags CONTAINSALL $tags'), expect.objectContaining({ tags: ['security', 'api'] }));
  });

  it('4. Combined search', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    await tool.handler({ query: 'auth', category: 'guideline', limit: 10 });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('category = $category'), expect.objectContaining({ category: 'guideline', query: 'auth', limit: 10 }));
  });

  it('5. Empty results', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ query: 'ghost' });
    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(0);
  });

  it('6. Error handling - store failure', async () => {
    mockStore.query.mockRejectedValue(new Error('Search failed'));
    const result = await tool.handler({ query: 'fail' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Search failed');
  });

  it('7. Tool description check', async () => {
    expect(tool.description).toContain('keyword');
  });

  it('8. Response is valid JSON', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ query: 's' });
    expect(result.content[0].text).toMatch(/\{/);
  });

  it('9. Verify result fields: title, summary, category', async () => {
    mockStore.query.mockResolvedValueOnce([{ title: 'T', summary: 'S', category: 'C' }]);
    const result = await tool.handler({ query: 's' });
    const data = JSON.parse(result.content[0].text);
    expect(data.results[0]).toHaveProperty('title');
    expect(data.results[0]).toHaveProperty('category');
  });
});
