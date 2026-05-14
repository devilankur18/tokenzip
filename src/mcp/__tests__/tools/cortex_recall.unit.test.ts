import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCortexTools } from '../../tools/cortex.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('cortex_recall (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([])
    };
    budget = new TokenBudgetManager(4000);
    const tools = createCortexTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'cortex_recall');
  });

  it('1. Success - returns stored notes', async () => {
    mockStore.query
      .mockResolvedValueOnce([{
        id: 'ann:1',
        category: 'guideline',
        title: 'Title',
        summary: 'Summary',
        priority: 'normal'
      }]) // notes lookup
      .mockResolvedValueOnce([]); // update access count
    
    const result = await tool.handler({ target: 'src/main.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes).toHaveLength(1);
    expect(data.notes[0].title).toBe('Title');
  });

  it('2. Filter by categories', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    await tool.handler({ target: 'src/main.js', categories: ['guideline'] });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('category IN $categories'), expect.objectContaining({ categories: ['guideline'] }));
  });

  it('3. Inheritance - checks parent paths', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    await tool.handler({ target: 'src/auth/login.js' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('path IN $paths'), expect.objectContaining({
      paths: expect.arrayContaining(['src/auth/login.js', 'src/auth', 'src'])
    }));
  });

  it('4. Staleness check', async () => {
    mockStore.query
      .mockResolvedValueOnce([{
        id: 'ann:1',
        title: 'T',
        target_hash: 'old'
      }]) // note
      .mockResolvedValueOnce([{ content_hash: 'new' }]) // current file hash
      .mockResolvedValueOnce([]); // update count
    
    const result = await tool.handler({ target: 'src/main.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes[0].title).toContain('STALE');
  });

  it('5. Error from store', async () => {
    mockStore.query.mockRejectedValue(new Error('DB Error'));
    const result = await tool.handler({ target: 'src/main.js' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('DB Error');
  });

  it('6. Truncation check', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    mockStore.query.mockResolvedValueOnce([{ id: 'a:1', title: 'T' }]);
    await tool.handler({ target: 't.js' });
    expect(spy).toHaveBeenCalled();
  });

  it('7. No notes found', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ target: 'unknown.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes).toHaveLength(0);
  });

  it('8. Verify note fields', async () => {
    mockStore.query.mockResolvedValueOnce([{
      id: 'a:1',
      title: 'T',
      summary: 'S',
      priority: 'high',
      category: 'G'
    }]);
    const result = await tool.handler({ target: 't.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes[0]).toHaveProperty('priority');
  });

  it('9. Tool description check', async () => {
    expect(tool.description).toContain('notes');
  });

  it('10. Response is valid JSON', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ target: 't.js' });
    expect(result.content[0].text).toMatch(/\{/);
  });
});
