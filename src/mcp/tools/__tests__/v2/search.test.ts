import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSearchTool } from '../../v2/search.js';
import { TokenBudgetManager } from '../../../token-budget.js';

describe('code_search (v2)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([])
    };
    budget = new TokenBudgetManager(4000);
    tool = createSearchTool(mockStore, budget);
  });

  // Query variations (5 tests)
  it('should search for text in names and docstrings', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'sym:1', name: 'calculate', kind: 'function' }]);
    const result = await tool.handler({ query: 'calc' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matchCount).toBe(1);
    expect(data.matches[0].name).toBe('calculate');
  });

  it('should be case-insensitive (via SQL logic)', async () => {
    await tool.handler({ query: 'CALC' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('string::lowercase'), expect.anything());
  });

  it('should handle empty search results', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ query: 'nothing' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matchCount).toBe(0);
  });

  it('should require a query parameter', async () => {
    const result = await tool.handler({});
    expect(result.isError).toBe(true);
  });

  it('should respect the limit parameter', async () => {
    await tool.handler({ query: 'test', limit: 5 });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $limit'), expect.objectContaining({ limit: 5 }));
  });

  // Filters (5 tests)
  it('should filter by kind: function', async () => {
    await tool.handler({ query: 'test', kind: 'function' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('AND kind = $kind'), expect.objectContaining({ kind: 'function' }));
  });

  it('should filter by kind: class', async () => {
    await tool.handler({ query: 'test', kind: 'class' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('AND kind = $kind'), expect.objectContaining({ kind: 'class' }));
  });

  it('should filter by path pattern', async () => {
    await tool.handler({ query: 'test', path_filter: 'src/' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('AND fileId.path CONTAINS $path_filter'), expect.objectContaining({ path_filter: 'src/' }));
  });

  it('should combine multiple filters', async () => {
    await tool.handler({ query: 'test', kind: 'function', path_filter: 'src/' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('AND kind = $kind'), expect.anything());
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('AND fileId.path CONTAINS $path_filter'), expect.anything());
  });

  it('should handle invalid kind filter gracefully', async () => {
    await tool.handler({ query: 'test', kind: 'unknown' });
    expect(mockStore.query).toHaveBeenCalled();
  });

  // Edge cases (10 tests)
  it('should handle special characters in query', async () => {
    await tool.handler({ query: 'calc_total$' });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('should handle numeric queries', async () => {
    await tool.handler({ query: '404' });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('should handle very long queries', async () => {
    await tool.handler({ query: 'a'.repeat(100) });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('should truncate results to fit budget', async () => {
    const largeResults = Array.from({ length: 50 }, (_, i) => ({ id: `sym:${i}`, name: `sym${i}` }));
    mockStore.query.mockResolvedValue(largeResults);
    const result = await tool.handler({ query: 'test' });
    expect(result.content[0].text).toBeDefined();
  });

  it('should return signature if available', async () => {
    mockStore.query.mockResolvedValue([{ id: '1', name: 'f', signature: 'function f()' }]);
    const result = await tool.handler({ query: 'f' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches[0].signature).toBe('function f()');
  });

  it('should return filePath for matches', async () => {
    mockStore.query.mockResolvedValue([{ id: '1', name: 'f', filePath: 'src/app.ts' }]);
    const result = await tool.handler({ query: 'f' });
    const data = JSON.parse(result.content[0].text);
    expect(data.matches[0].filePath).toBe('src/app.ts');
  });

  it('should handle SQL injection attempts (sanitized by SurrealDB driver)', async () => {
    await tool.handler({ query: "'; DROP TABLE symbol; --" });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('should handle null docstrings in search results', async () => {
    mockStore.query.mockResolvedValue([{ id: '1', name: 'f', docstring: null }]);
    const result = await tool.handler({ query: 'f' });
    expect(result.isError).toBeUndefined();
  });

  it('should handle empty path_filter string', async () => {
    await tool.handler({ query: 'test', path_filter: '' });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    mockStore.query.mockRejectedValue(new Error('DB Timeout'));
    const result = await tool.handler({ query: 'test' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('DB Timeout');
  });
});
