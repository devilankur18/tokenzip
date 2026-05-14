import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFetchMetadataTools } from '../../tools/fetch-metadata.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('fetch_symbol_metadata (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createFetchMetadataTools(mockStore as any, budget);
    tool = tools.find(t => t.name === 'fetch_symbol_metadata');
  });

  it('1. Success - returns metadata for symbol IDs', async () => {
    mockStore.query.mockResolvedValueOnce([
      { name: 'foo', kind: 'function', docstring: 'test' }
    ]);
    
    const result = await tool.handler({ ids: ['symbol:1'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols).toHaveLength(1);
    expect(data.symbols[0].name).toBe('foo');
  });

  it('2. Multiple IDs', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ name: 's1' }])
      .mockResolvedValueOnce([{ name: 's2' }]);
    
    const result = await tool.handler({ ids: ['id1', 'id2'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols).toHaveLength(2);
  });

  it('3. Some IDs not found', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ name: 's1' }])
      .mockResolvedValueOnce([]); // not found
    
    const result = await tool.handler({ ids: ['id1', 'id2'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols).toHaveLength(1);
  });

  it('4. Empty IDs list error', async () => {
    const result = await tool.handler({ ids: [] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No IDs');
  });

  it('5. Error from store', async () => {
    mockStore.query.mockRejectedValue(new Error('DB Error'));
    const result = await tool.handler({ ids: ['id1'] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('DB Error');
  });

  it('6. Truncation enforcement', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    mockStore.query.mockResolvedValueOnce([{ name: 'foo' }]);
    await tool.handler({ ids: ['id1'] });
    expect(spy).toHaveBeenCalled();
  });

  it('7. Tool description check', async () => {
    expect(tool.description).toContain('Fetches');
  });

  it('8. Metadata is included if available', async () => {
    mockStore.query.mockResolvedValueOnce([{ name: 'foo', metadata: { x: 1 } }]);
    const result = await tool.handler({ ids: ['id1'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols[0].metadata.x).toBe(1);
  });

  it('9. Docstring is included if available', async () => {
    mockStore.query.mockResolvedValueOnce([{ name: 'foo', docstring: 'hello' }]);
    const result = await tool.handler({ ids: ['id1'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols[0].docstring).toBe('hello');
  });

  it('10. Response is valid JSON', async () => {
    mockStore.query.mockResolvedValueOnce([{ name: 'foo' }]);
    const result = await tool.handler({ ids: ['id1'] });
    expect(result.content[0].text).toMatch(/\{/);
  });
});
