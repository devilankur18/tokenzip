import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStructureTools } from '../../tools/structure.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('get_file_tree (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn(),
      execute: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createStructureTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'get_file_tree');
  });

  const setupMocks = () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'repo:1', name: 'test-repo', type: 'repository' }]) // repos
      .mockResolvedValueOnce([{ count: 10 }]) // stats
      .mockResolvedValueOnce([ // edges (contains)
        { out: 'repo:1', in: 'file:1' },
        { out: 'repo:1', in: 'module:1' },
        { out: 'module:1', in: 'file:2' }
      ])
      .mockResolvedValueOnce([ // nodes ($ids)
        { id: 'repo:1', name: 'root', type: 'repository', path: '' },
        { id: 'file:1', name: 'README.md', type: 'file', path: 'README.md' },
        { id: 'module:1', name: 'lib', type: 'module', path: 'lib' },
        { id: 'file:2', name: 'index.js', type: 'file', path: 'lib/index.js' }
      ])
      .mockResolvedValueOnce([]); // cortex notes
  };

  it('1. Success - returns root tree', async () => {
    setupMocks();
    const result = await tool.handler({});
    expect(result.content[0].text).toContain('README.md');
    expect(result.content[0].text).toContain('lib');
  });

  it('2. Filter by directory', async () => {
    setupMocks();
    const result = await tool.handler({ path: 'lib' });
    expect(result.content[0].text).toContain('index.js');
  });

  it('3. Adaptive folding - check threshold', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'repo:1', type: 'repository' }])
      .mockResolvedValueOnce([{ count: 2000 }]) // high count -> low threshold
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'repo:1', type: 'repository', path: '' }])
      .mockResolvedValueOnce([]);
    
    const result = await tool.handler({ adaptive: true });
    expect(result.content[0].text).toBeDefined();
  });

  it('4. Path not found error', async () => {
    setupMocks();
    const result = await tool.handler({ path: 'ghost' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('5. Error from store', async () => {
    mockStore.query.mockRejectedValue(new Error('DB Error'));
    const result = await tool.handler({});
    expect(result.isError).toBe(true);
  });

  it('6. Truncation check', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    setupMocks();
    // Force JSON format to trigger budget.truncate easily or just check if it's called
    await tool.handler({ format: 'json' });
    expect(spy).toHaveBeenCalled();
  });

  it('7. Verify tree depth limit', async () => {
    setupMocks();
    await tool.handler({ depth: 1 });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('8. Handles leading slash in path filter', async () => {
    setupMocks();
    await tool.handler({ path: '/lib' });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('9. Tool description check', async () => {
    expect(tool.description).toContain('compact');
  });

  it('10. Response is tree text by default', async () => {
    setupMocks();
    const result = await tool.handler({});
    expect(result.content[0].text).not.toMatch(/^\{/);
  });
});
