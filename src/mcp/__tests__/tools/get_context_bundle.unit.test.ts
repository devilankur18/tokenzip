import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContextTools } from '../../tools/context.js';
import { TokenBudgetManager } from '../../token-budget.js';
import { readCodeRange } from '../../../utils/code-reader.js';

vi.mock('../../../utils/code-reader.js', () => ({
  readCodeRange: vi.fn(() => 'code content')
}));

describe('get_context_bundle (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn()
    };
    budget = new TokenBudgetManager(4000);
    const tools = createContextTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'get_context_bundle');
  });

  it('1. Success - returns target and dependencies', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1', name: 'foo', kind: 'function', filePath: 'test.js', startLine: 1, endLine: 5 }])
      .mockResolvedValueOnce([{ name: 'bar', kind: 'function', signature: 'bar()', filePath: 'dep.js' }]);
    
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.target.name).toBe('foo');
    expect(data.dependencies[0].name).toBe('bar');
  });

  it('2. Multiple symbols found - uses first candidate', async () => {
    mockStore.query
      .mockResolvedValueOnce([
        { id: 's1', name: 'foo', filePath: 'a.js' },
        { id: 's2', name: 'foo', filePath: 'b.js' }
      ])
      .mockResolvedValueOnce([]);
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.target.filePath).toBe('a.js');
  });

  it('3. Symbol not found', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ symbol_name: 'Ghost' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Symbol not found');
  });

  it('4. Symbol with no dependencies', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1', name: 'foo', filePath: 'test.js' }])
      .mockResolvedValueOnce([]);
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data.dependencies).toHaveLength(0);
  });

  it('5. Error from store', async () => {
    mockStore.query.mockRejectedValue(new Error('DB Error'));
    const result = await tool.handler({ symbol_name: 'foo' });
    expect(result.isError).toBe(true);
  });

  it('6. Truncation check', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1', name: 'foo', filePath: 'test.js' }])
      .mockResolvedValueOnce([]);
    await tool.handler({ symbol_name: 'foo' });
    expect(spy).toHaveBeenCalled();
  });

  it('7. Verify call to readCodeRange', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1', name: 'foo', filePath: 'test.js', startLine: 1, endLine: 5 }])
      .mockResolvedValueOnce([]);
    await tool.handler({ symbol_name: 'foo' });
    expect(readCodeRange).toHaveBeenCalled();
  });

  it('8. Verify bundle fields: target, dependencies', async () => {
    mockStore.query
      .mockResolvedValueOnce([{ id: 's1', name: 'foo', filePath: 'test.js' }])
      .mockResolvedValueOnce([]);
    const result = await tool.handler({ symbol_name: 'foo' });
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty('target');
    expect(data).toHaveProperty('dependencies');
  });

  it('9. Tool description check', async () => {
    expect(tool.description).toContain('signatures');
  });

  it('10. Response is valid JSON', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 's1', name: 'f', filePath: 't.js' }]).mockResolvedValueOnce([]);
    const result = await tool.handler({ symbol_name: 'foo' });
    expect(result.content[0].text).toMatch(/\{/);
  });
});
