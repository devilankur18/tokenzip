import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCortexTools } from '../../tools/cortex.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('cortex_traverse (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([]) // Default return empty array promise
    };
    budget = new TokenBudgetManager(4000);
    const tools = createCortexTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'cortex_traverse');
  });

  it('1. Success - returns stored traversal hint', async () => {
    mockStore.query
      .mockResolvedValueOnce([{
        id: 'ann:1',
        title: 'How to understand auth',
        summary: 'Read these files',
        read_order: ['a.js', 'b.js'],
        skip_paths: ['test.js']
      }]) // hint lookup
      .mockResolvedValueOnce([]); // update access count
    
    const result = await tool.handler({ target: 'src/auth' });
    const data = JSON.parse(result.content[0].text);
    expect(data.source).toBe('stored_hint');
    expect(data.recommended_read_order).toEqual(['a.js', 'b.js']);
  });

  it('2. Fallback - returns graph analysis plan', async () => {
    mockStore.query
      .mockResolvedValueOnce([]) // No hint
      .mockResolvedValueOnce([{ id: 'mod:1' }]) // Module found
      .mockResolvedValueOnce([ // Files
        { path: 'src/auth/index.js', incoming_deps: 0 },
        { path: 'src/auth/service.js', incoming_deps: 5 }
      ]);
    
    const result = await tool.handler({ target: 'src/auth' });
    const data = JSON.parse(result.content[0].text);
    expect(data.source).toBe('graph_analysis');
    expect(data.recommended_read_order).toContain('src/auth/index.js');
  });

  it('3. Module not found', async () => {
    mockStore.query
      .mockResolvedValueOnce([]) // No hint
      .mockResolvedValueOnce([]); // Module not found
    
    const result = await tool.handler({ target: 'ghost' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('4. Error from store', async () => {
    mockStore.query.mockRejectedValue(new Error('DB Error'));
    const result = await tool.handler({ target: 'src/auth' });
    expect(result.isError).toBe(true);
  });

  it('5. Tool description check', async () => {
    expect(tool.description).toContain('order');
  });

  it('6. Response is valid JSON', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ title: 'T', read_order: [], id: 'hint:1' }])
      .mockResolvedValueOnce([]);
    const result = await tool.handler({ target: 'src/auth' });
    expect(result.content[0].text).toMatch(/\{/);
  });
});
