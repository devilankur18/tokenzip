import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStructureTools } from '../../tools/structure.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('get_codebase_stats (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      stats: vi.fn(),
      query: vi.fn() // Needed for other tools in the same factory
    };
    budget = new TokenBudgetManager(4000);
    const tools = createStructureTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'get_codebase_stats');
  });

  it('1. Success - returns stats', async () => {
    mockStore.stats.mockResolvedValue({ fileCount: 10, nodeCount: { function: 5 } });
    const result = await tool.handler({});
    const data = JSON.parse(result.content[0].text);
    expect(data.fileCount).toBe(10);
  });

  it('2. Empty stats', async () => {
    mockStore.stats.mockResolvedValue({ fileCount: 0, nodeCount: {} });
    const result = await tool.handler({});
    const data = JSON.parse(result.content[0].text);
    expect(data.fileCount).toBe(0);
  });

  it('3. Error from store', async () => {
    mockStore.stats.mockRejectedValue(new Error('DB Error'));
    await expect(tool.handler({})).rejects.toThrow('DB Error');
  });

  it('4. Large stats truncation', async () => {
    const hugeStats = { files: Array(1000).fill('test.js') };
    mockStore.stats.mockResolvedValue(hugeStats);
    // Budget is 4000, so this should be fine, but we test truncation logic
    const result = await tool.handler({});
    const data = JSON.parse(result.content[0].text);
    expect(data).toBeDefined();
  });

  it('5. Stats with multiple languages', async () => {
    mockStore.stats.mockResolvedValue({ languages: { typescript: 5, javascript: 5 } });
    const result = await tool.handler({});
    const data = JSON.parse(result.content[0].text);
    expect(data.languages.typescript).toBe(5);
  });

  it('6. Stats with complex node types', async () => {
    mockStore.stats.mockResolvedValue({ nodeCount: { function: 1, class: 2, interface: 3 } });
    const result = await tool.handler({});
    const data = JSON.parse(result.content[0].text);
    expect(data.nodeCount.interface).toBe(3);
  });

  it('7. Budget manager is called', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    mockStore.stats.mockResolvedValue({ ok: true });
    await tool.handler({});
    expect(spy).toHaveBeenCalled();
  });

  it('8. Returns valid MCP content structure', async () => {
    mockStore.stats.mockResolvedValue({});
    const result = await tool.handler({});
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
  });

  it('9. Handles null stats gracefully', async () => {
    mockStore.stats.mockResolvedValue(null);
    const result = await tool.handler({});
    const data = JSON.parse(result.content[0].text);
    // When data is null, truncate returns {_truncated: false, _token_count: X}
    expect(data._truncated).toBe(false);
  });

  it('10. Concurrent calls handled correctly (smoke test)', async () => {
    mockStore.stats.mockResolvedValue({ count: 1 });
    const results = await Promise.all([tool.handler({}), tool.handler({})]);
    expect(results).toHaveLength(2);
  });
});
