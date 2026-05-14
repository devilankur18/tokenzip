import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSmartFileReadTools } from '../../tools/smart-file-read.js';
import { TokenBudgetManager } from '../../token-budget.js';
import { fileCache } from '../../../utils/file-cache.js';

describe('smart_file_read (Unit)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([])
    };
    budget = new TokenBudgetManager(4000);
    const tools = createSmartFileReadTools(mockStore as any, '/repo', budget);
    tool = tools.find(t => t.name === 'smart_file_read');
    vi.clearAllMocks();
  });

  it('1. Success - full read for small file', async () => {
    vi.spyOn(fileCache, 'getLines').mockReturnValue(['line 1', 'line 2']);
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1', content_hash: 'abc', parse_status: 'done' }]) // file lookup
      .mockResolvedValueOnce([]) // annotations lookup (strategy)
      .mockResolvedValueOnce([]) // symbols lookup (strategy)
      .mockResolvedValueOnce([]) // annotations lookup (injectCortex)
      .mockResolvedValueOnce([]); // file hash lookup (injectCortex)
    
    const result = await tool.handler({ path: 'test.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.content).toContain('line 1');
  });

  it('2. Strategy selection - skeleton for large file (auto)', async () => {
    vi.spyOn(fileCache, 'getLines').mockReturnValue(Array(500).fill('line'));
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1', parse_status: 'done' }]) // file
      .mockResolvedValueOnce([]) // annotations (test skeleton)
      .mockResolvedValueOnce([ // symbols (test skeleton)
        { name: 'func1', startLine: 1, endLine: 5, kind: 'function' }
      ])
      .mockResolvedValueOnce([]) // annotations (execute final)
      .mockResolvedValueOnce([ // symbols (execute final)
        { name: 'func1', startLine: 1, endLine: 5, kind: 'function' }
      ])
      .mockResolvedValueOnce([]) // injectCortex annotations
      .mockResolvedValueOnce([]); // injectCortex hash
    
    const result = await tool.handler({ path: 'large.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.mode_used).toBe('skeleton');
  });

  it('3. Specific range read', async () => {
    const spy = vi.spyOn(fileCache, 'getRange').mockReturnValue(['range line']);
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1', parse_status: 'done' }]) // file
      .mockResolvedValueOnce([]) // injectCortex annotations
      .mockResolvedValueOnce([]); // injectCortex hash
    
    await tool.handler({ path: 'test.js', range: { start: 10, end: 11 } });
    expect(spy).toHaveBeenCalled();
  });

  it('4. File not found', async () => {
    mockStore.query.mockResolvedValueOnce([]);
    const result = await tool.handler({ path: 'ghost.js' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('5. Cortex integration - injects notes', async () => {
    vi.spyOn(fileCache, 'getLines').mockReturnValue(['line']);
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1', parse_status: 'done' }]) // file
      .mockResolvedValueOnce([]) // annotations (strategy)
      .mockResolvedValueOnce([]) // symbols (strategy)
      .mockResolvedValueOnce([{ title: 'Hint', summary: 'S', category: 'gotcha', priority: 'high', confidence: 0.9 }]) // annotations (injectCortex)
      .mockResolvedValueOnce([{ content_hash: 'abc' }]); // file hash (injectCortex)
    
    const result = await tool.handler({ path: 'test.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data._cortex.notes[0]).toContain('[HIGH·gotcha] Hint');
  });

  it('6. Error from file system', async () => {
    vi.spyOn(fileCache, 'getLines').mockImplementation(() => { throw new Error('FS Error'); });
    mockStore.query.mockResolvedValueOnce([{ id: 'f1', parse_status: 'done' }]);
    const result = await tool.handler({ path: 'err.js', mode: 'interface_only' });
    expect(result.isError).toBe(true);
  });

  it('7. Strategy selection - interface_only (explicit)', async () => {
    vi.spyOn(fileCache, 'getLines').mockReturnValue(Array(100).fill('line'));
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1', parse_status: 'done' }])
      .mockResolvedValueOnce([]) // annotations
      .mockResolvedValueOnce([
        { name: 'Class1', kind: 'class', startLine: 1, endLine: 100 }
      ]);
    
    const result = await tool.handler({ path: 'test.js', mode: 'interface_only' });
    const data = JSON.parse(result.content[0].text);
    expect(data.mode_used).toBe('interface_only');
  });

  it('8. Truncation enforcement', async () => {
    const spy = vi.spyOn(budget, 'truncate');
    vi.spyOn(fileCache, 'getLines').mockReturnValue(['line']);
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1', parse_status: 'done' }])
      .mockResolvedValueOnce([]) // annotations
      .mockResolvedValueOnce([]) // symbols
      .mockResolvedValueOnce([]) // injectCortex
      .mockResolvedValueOnce([]); // injectCortex
    
    await tool.handler({ path: 't.js' });
    expect(spy).toHaveBeenCalled();
  });

  it('9. Tool description check', async () => {
    expect(tool.description).toContain('semantic');
  });

  it('10. Response is valid JSON', async () => {
    vi.spyOn(fileCache, 'getLines').mockReturnValue(['line']);
    mockStore.query
      .mockResolvedValueOnce([{ id: 'f1', parse_status: 'done' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    
    const result = await tool.handler({ path: 't.js' });
    expect(result.content[0].text).toMatch(/\{/);
  });
});
