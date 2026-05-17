import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInsightTool } from '../../v2/insight.js';
import { TokenBudgetManager } from '../../../token-budget.js';

describe('code_insight (v2)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([])
    };
    budget = new TokenBudgetManager(4000);
    tool = createInsightTool(mockStore, budget);
  });

  // Action: recall (5 tests)
  it('should recall insights for a path', async () => {
    const result = await tool.handler({ action: 'recall', target: 'src/main.ts' });
    expect(result.content[0].text).toContain('src/main.ts');
  });

  it('should require target for recall', async () => {
    const result = await tool.handler({ action: 'recall' });
    expect(result.isError).toBe(true);
  });

  it('should handle paths with no insights', async () => {
    const result = await tool.handler({ action: 'recall', target: 'new/file.ts' });
    const data = JSON.parse(result.content[0].text);
    expect(data.insights).toHaveLength(0);
  });

  it('should default to recall action', async () => {
    const result = await tool.handler({ target: 'src' });
    expect(result.content[0].text).toContain('src');
  });

  it('should handle directory recall', async () => {
    const result = await tool.handler({ action: 'recall', target: 'src/utils/' });
    expect(result.content).toBeDefined();
  });

  // Action: save (5 tests)
  it('should save a new guideline', async () => {
    const result = await tool.handler({ 
      action: 'save', 
      target: 'src/', 
      note: { title: 'Test', summary: 'test', category: 'guideline' } 
    });
    expect(result.content[0].text).toContain('success');
  });

  it('should require note and target for save', async () => {
    const result = await tool.handler({ action: 'save' });
    expect(result.isError).toBe(true);
  });

  it('should handle architecture notes', async () => {
    const result = await tool.handler({ 
      action: 'save', 
      target: 'root', 
      note: { title: 'Arch', summary: 'arch', category: 'architecture' } 
    });
    expect(result.isError).toBeUndefined();
  });

  it('should handle gotcha notes', async () => {
    const result = await tool.handler({ 
      action: 'save', 
      target: 'src/bug.ts', 
      note: { title: 'Bug', summary: 'bug', category: 'gotcha' } 
    });
    expect(result.isError).toBeUndefined();
  });

  it('should respect scope parameter', async () => {
    const result = await tool.handler({ 
      action: 'save', 
      target: 'src/', 
      note: { title: 'S', summary: 's', scope: 'module' } 
    });
    expect(result.isError).toBeUndefined();
  });

  // Action: search (5 tests)
  it('should search notes by query', async () => {
    mockStore.query.mockResolvedValueOnce([{ title: 'Match' }]);
    const result = await tool.handler({ action: 'search', query: 'Match' });
    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(1);
  });

  it('should require query for search', async () => {
    const result = await tool.handler({ action: 'search' });
    expect(result.isError).toBe(true);
  });

  it('should handle no matches in search', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ action: 'search', query: 'nothing' });
    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(0);
  });

  it('should handle empty query string', async () => {
    const result = await tool.handler({ action: 'search', query: '' });
    expect(result.isError).toBe(true);
  });

  it('should handle multi-word search queries', async () => {
    await tool.handler({ action: 'search', query: 'coding standard' });
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('CONTAINS'), expect.anything());
  });

  // Action: forget (5 tests)
  it('should archive a note by ID', async () => {
    const result = await tool.handler({ action: 'forget', id: 'annotation:1' });
    expect(result.content[0].text).toContain('archived');
    expect(mockStore.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.objectContaining({ id: 'annotation:1' }));
  });

  it('should require id for forget', async () => {
    const result = await tool.handler({ action: 'forget' });
    expect(result.isError).toBe(true);
  });

  it('should handle non-existent ID for forget', async () => {
    mockStore.query.mockRejectedValueOnce(new Error('Not found'));
    const result = await tool.handler({ action: 'forget', id: 'ghost' });
    expect(result.isError).toBe(true);
  });

  it('should handle invalid ID format', async () => {
    const result = await tool.handler({ action: 'forget', id: '' });
    expect(result.isError).toBe(true);
  });

  it('should handle batch archive (future proofing)', async () => {
    await tool.handler({ action: 'forget', id: '123' });
    expect(mockStore.query).toHaveBeenCalled();
  });
});
