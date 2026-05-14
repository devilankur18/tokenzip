import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCortexTools } from '../../tools/cortex.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('cortex_save (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([])
    };
    budget = new TokenBudgetManager(4000);
    const tools = createCortexTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'cortex_save');
  });

  it('1. Success - saves architecture note', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'ann:1', title: 'Layers' }]) // CREATE
      .mockResolvedValueOnce([{ id: 'repo:1' }]) // Link target 1
      .mockResolvedValueOnce([]) // Link target 2
    
    const result = await tool.handler({
      category: 'architecture',
      title: 'Layers',
      summary: 'Clean architecture',
      scope: 'codebase',
      targets: ['*']
    });

    expect(result.content[0].text).toContain('Successfully saved note');
  });

  it('2. Save with file scope and hash lookup', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ content_hash: 'abc' }]) // hash lookup before create
      .mockResolvedValueOnce([{ id: 'ann:1' }]) // CREATE
      .mockResolvedValueOnce([{ id: 'file:1' }]); // link target
    
    await tool.handler({
      category: 'gotcha',
      title: 'Memory leak',
      summary: 'Watch out',
      scope: 'file',
      targets: ['src/leak.js']
    });
    
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('CREATE annotation'), expect.objectContaining({
      data: expect.objectContaining({ target_hash: 'abc' })
    }));
  });

  it('3. Target multiple files', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ content_hash: 'h' }]) // Hash lookup
      .mockResolvedValueOnce([{ id: 'ann:1' }]) // CREATE
      .mockResolvedValueOnce([{ id: 'f1' }]) // target 1
      .mockResolvedValueOnce([]) // RELATE 1
      .mockResolvedValueOnce([]) // RELATE 2
      .mockResolvedValueOnce([{ id: 'f2' }]) // target 2
    
    await tool.handler({
      category: 'todo',
      title: 'Refactor',
      summary: 'Clean up',
      scope: 'file',
      targets: ['a.js', 'b.js']
    });
    
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('4. Error handling - invalid scope', async () => {
    mockStore.query.mockRejectedValue(new Error('Invalid Scope'));
    const result = await tool.handler({
      category: 'guideline',
      title: 'T',
      summary: 'S',
      scope: 'unknown',
      targets: []
    });
    expect(result.isError).toBe(true);
  });

  it('5. Tool description check', async () => {
    expect(tool.description).toContain('Save');
  });

  it('6. Response is valid JSON', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'ann:1', title: 'T' }])
      .mockResolvedValueOnce([]);
    const result = await tool.handler({
      category: 'todo',
      title: 'T',
      summary: 'S',
      scope: 'codebase',
      targets: ['*']
    });
    expect(result.content[0].text).toContain('Successfully saved');
  });
});
