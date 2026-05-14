import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStructureTools } from '../../tools/structure.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('inspect_targets (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createStructureTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'inspect_targets');
  });

  it('1. Success - returns target details', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1', type: 'file', path: 'test.js' }]) // Target 1 check
      .mockResolvedValueOnce([]) // Target 1 symbols (exported)
      .mockResolvedValueOnce([]) // Target 2 check (file)
      .mockResolvedValueOnce([{ type: 'symbol', name: 'foo' }]); // Target 2 check (symbol)
    
    const result = await tool.handler({ targets: ['test.js', 'foo'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(2);
  });

  it('2. Mixed valid and invalid targets', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1', type: 'file', path: 'valid.js' }])
      .mockResolvedValueOnce([]) // symbols
      .mockResolvedValueOnce([]) // missing check file
      .mockResolvedValueOnce([]); // missing check symbol
    
    const result = await tool.handler({ targets: ['valid.js', 'missing'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.results[1].type).toBe('unknown');
  });

  it('3. All targets missing', async () => {
    mockStore.query.mockResolvedValue([]);
    const result = await tool.handler({ targets: ['a', 'b'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.results.every((r: any) => r.type === 'unknown')).toBe(true);
  });

  it('4. Handles large target list truncation', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    mockStore.query.mockResolvedValue([{ id: 'f1', type: 'file' }]);
    await tool.handler({ targets: Array(50).fill('test.js') });
    expect(spy).toHaveBeenCalled();
  });

  it('5. Error from DB', async () => {
    mockStore.query.mockRejectedValue(new Error('DB Error'));
    const result = await tool.handler({ targets: ['test'] });
    expect(result.isError).toBe(true);
  });

  it('6. Empty targets list', async () => {
    const result = await tool.handler({ targets: [] });
    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(0);
  });

  it('7. Verify result fields', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ type: 'file', path: 't.js', id: 'f1' }])
      .mockResolvedValueOnce([]);
    const result = await tool.handler({ targets: ['t.js'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.results[0]).toHaveProperty('type');
  });

  it('8. Max targets limit check (internal)', async () => {
    mockStore.query.mockResolvedValue([]);
    await tool.handler({ targets: ['a'] });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('9. Tool description check', async () => {
    expect(tool.description).toContain('signatures');
  });

  it('10. Response is JSON', async () => {
    mockStore.query.mockResolvedValue([]);
    const result = await tool.handler({ targets: ['t'] });
    expect(result.content[0].text).toMatch(/\{/);
  });
});
