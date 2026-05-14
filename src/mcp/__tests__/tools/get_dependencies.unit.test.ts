import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSymbolTools } from '../../tools/symbol.js';
import { TokenBudgetManager } from '../../token-budget.js';

describe('get_dependencies (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createSymbolTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'get_dependencies');
  });

  it('1. Success - returns dependencies', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1', path: 'test.js' }]) // File
      .mockResolvedValueOnce([ // Dependencies (imports)
        { target: { path: 'dep.js', kind: 'import' } }
      ]);
    
    const result = await tool.handler({ file_path: 'test.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.dependencies[0].path).toBe('dep.js');
  });

  it('2. Multiple dependencies', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1' }])
      .mockResolvedValueOnce([
        { target: { path: 'a.js' } }, 
        { target: { path: 'b.js' } }
      ]);
    const result = await tool.handler({ file_path: 'test.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.dependencies).toHaveLength(2);
  });

  it('3. File not found', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ file_path: 'ghost.js' });
    expect(result.content[0].text).toContain('not found');
  });

  it('4. No dependencies found', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1' }])
      .mockResolvedValueOnce([]);
    const result = await tool.handler({ file_path: 'isolated.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.dependencies).toHaveLength(0);
  });

  it('5. Error from store', async () => {
    mockStore.query.mockRejectedValue(new Error('DB Error'));
    const result = await tool.handler({ file_path: 'test.js' });
    expect(result.isError).toBe(true);
  });

  it('6. Truncation check', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1' }])
      .mockResolvedValueOnce([]);
    await tool.handler({ file_path: 'test.js' });
    expect(spy).toHaveBeenCalled();
  });

  it('7. Verify dependency fields', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1' }])
      .mockResolvedValueOnce([{ target: { path: 'd.js', type: 'internal' } }]);
    const result = await tool.handler({ file_path: 't.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.dependencies[0]).toHaveProperty('path');
  });

  it('8. Handles leading slash in path', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'f1' }]).mockResolvedValueOnce([]);
    await tool.handler({ file_path: '/test.js' });
    expect(mockStore.query).toHaveBeenCalled();
  });

  it('9. Tool description check', async () => {
    expect(tool.description).toContain('dependencies');
  });

  it('10. Response is valid JSON', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'f1' }]).mockResolvedValueOnce([]);
    const result = await tool.handler({ file_path: 't.js' });
    expect(result.content[0].text).toMatch(/\{/);
  });
});
