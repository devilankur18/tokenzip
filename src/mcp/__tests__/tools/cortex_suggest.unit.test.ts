import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCortexTools } from '../../tools/cortex.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('cortex_suggest (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn(),
      execute: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createCortexTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'cortex_suggest');
  });

  it('1. Success - logs suggestion', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'suggestion:1' }]);
    const result = await tool.handler({
      problem: 'too many tokens',
      proposed_solution: 'compress more'
    });
    expect(result.content[0].text).toContain('Suggestion logged: suggestion:1');
  });

  it('2. Suggestion with related targets', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'suggestion:1' }]) // CREATE
      .mockResolvedValueOnce([{ id: 'file:1' }]) // SELECT target
      .mockResolvedValueOnce([]); // RELATE
    
    const result = await tool.handler({
      problem: 'err',
      proposed_solution: 'fix',
      related_targets: ['src/main.js']
    });
    expect(mockStore.query).toHaveBeenCalledTimes(3);
  });

  it('3. Severity level check', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 's:1' }]);
    await tool.handler({
      problem: 'p',
      proposed_solution: 's',
      severity: 'high'
    });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('CREATE'), expect.objectContaining({
      data: expect.objectContaining({ severity: 'high' })
    }));
  });

  it('4. Store error handling', async () => {
    mockStore.query.mockRejectedValue(new Error('DB Fail'));
    const result = await tool.handler({
      problem: 'p',
      proposed_solution: 's'
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('DB Fail');
  });

  it('5. Tool description check', async () => {
    expect(tool.description).toContain('improvement');
  });
});
