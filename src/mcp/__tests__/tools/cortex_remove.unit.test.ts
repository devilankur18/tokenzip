import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCortexTools } from '../../tools/cortex.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('cortex_remove (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([])
    };
    budget = new TokenBudgetManager(4000);
    const tools = createCortexTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'cortex_remove');
  });

  it('1. Success - archives note by ID', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ id: 'annotation:123' });
    expect(result.content[0].text).toContain('archived');
  });

  it('2. Missing ID error', async () => {
    // Handler doesn't explicitly check for ID presence before query, but StringRecordId might throw
    // Actually, let's see if it handles it
    const result = await tool.handler({});
    expect(result.isError).toBe(true);
  });

  it('3. Error from DB', async () => {
    mockStore.query.mockRejectedValue(new Error('Update failed'));
    const result = await tool.handler({ id: 'ann:1' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Update failed');
  });

  it('4. Tool description check', async () => {
    expect(tool.description).toContain('Archive');
  });

  it('5. Verify query arguments', async () => {
    await tool.handler({ id: 'ann:1' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.objectContaining({ id: expect.anything() }));
  });
});
