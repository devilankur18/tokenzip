import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStructureTools } from '../../tools/structure.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('get_code_overview (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createStructureTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'get_code_overview');
  });

  const setupMocks = () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'repo:1', name: 'test-repo', type: 'repository' }]) // repos
      .mockResolvedValueOnce([{ count: 10 }]) // stats
      .mockResolvedValueOnce([ // edges (contains)
        { out: 'repo:1', in: 'file:1' }
      ])
      .mockResolvedValueOnce([ // nodes ($ids)
        { id: 'repo:1', name: 'root', type: 'repository', path: '' },
        { id: 'file:1', name: 'README.md', type: 'file', path: 'README.md' }
      ])
      .mockResolvedValueOnce([]); // cortex notes
  };

  it('1. Success - returns hierarchical overview', async () => {
    setupMocks();
    const result = await tool.handler({});
    // Default format is tree now
    expect(result.content[0].text).toContain('root');
    expect(result.content[0].text).toContain('README.md');
  });

  it('2. JSON format', async () => {
    setupMocks();
    const result = await tool.handler({ format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure.name).toBe('root');
  });

  it('3. Adaptive mode toggle', async () => {
    setupMocks();
    await tool.handler({ adaptive: false });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('4. Focus on path', async () => {
    setupMocks();
    const result = await tool.handler({ path: 'README.md' });
    expect(result.content[0].text).toContain('README.md');
  });

  it('5. Depth check', async () => {
    setupMocks();
    await tool.handler({ depth: 0 });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('6. Error handling - invalid path', async () => {
    setupMocks();
    const result = await tool.handler({ path: 'ghost' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('7. Error from DB', async () => {
    mockStore.query.mockRejectedValue(new Error('DB Error'));
    const result = await tool.handler({});
    expect(result.isError).toBe(true);
  });

  it('8. Truncation check', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    setupMocks();
    await tool.handler({ format: 'json' });
    expect(spy).toHaveBeenCalled();
  });

  it('9. Tool description check', async () => {
    expect(tool.description).toContain('overview');
  });

  it('10. Markdown format', async () => {
    setupMocks();
    const result = await tool.handler({ format: 'markdown' });
    expect(result.content[0].text).toContain('**root**');
    expect(result.content[0].text).toContain('- ');
  });
});
