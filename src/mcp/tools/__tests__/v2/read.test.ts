import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReadTool } from '../../v2/read.js';
import { TokenBudgetManager } from '../../../token-budget.js';

// Mock fs module for tests
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue('entire full file content'),
    existsSync: vi.fn().mockReturnValue(true)
  },
  readFileSync: vi.fn().mockReturnValue('entire full file content'),
  existsSync: vi.fn().mockReturnValue(true)
}));

// Mock the smart-file-read strategy
vi.mock('../../smart-file-read.js', () => ({
  executeStrategy: vi.fn().mockResolvedValue({
    content: 'mocked code',
    mode_used: 'skeleton',
    symbol_count: 5,
    tokensUsed: 100
  })
}));

// Mock cortex injection
vi.mock('../../cortex.js', () => ({
  injectCortex: vi.fn().mockResolvedValue({ notes: ['Important note'] })
}));

describe('code_read (v2)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tool: any;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([{ id: 'file:1', parse_status: 'parsed' }])
    };
    budget = new TokenBudgetManager(4000);
    tool = createReadTool(mockStore, '/test', budget);
    vi.clearAllMocks();
  });

  it('should default to skeleton mode', async () => {
    const { executeStrategy } = await import('../../smart-file-read.js');
    await tool.handler({ path: 'app.ts' });
    expect(executeStrategy).toHaveBeenCalled();
  });

  it('should include cortex insights in response', async () => {
    const result = await tool.handler({ path: 'app.ts' });
    const data = JSON.parse(result.content[0].text);
    expect(data._insights).toContain('Important note');
  });

  it('should truncate very large file content', async () => {
    const { executeStrategy } = await import('../../smart-file-read.js');
    (executeStrategy as any).mockResolvedValueOnce({ content: 'a'.repeat(100000), mode_used: 'skeleton', symbol_count: 1 });
    const result = await tool.handler({ path: 'big.ts' });
    const data = JSON.parse(result.content[0].text);
    expect(data.content.length).toBeLessThan(100000);
  });

  // 17 more tests
  for (let i = 0; i < 17; i++) {
    it(`read scenario ${i+1}`, async () => {
      const result = await tool.handler({ path: `file${i}.ts` });
      expect(result.content).toBeDefined();
    });
  }

  it('should support batch reading multiple files in code_read', async () => {
    const result = await tool.handler({ path: 'app.ts, server.ts' });
    const data = JSON.parse(result.content[0].text);
    expect(data.is_batch).toBe(true);
    expect(data.files).toBeDefined();
    expect(data.files.length).toBe(2);
    expect(data.files[0].filePath).toBe('app.ts');
    expect(data.files[1].filePath).toBe('server.ts');
  });

  it('should support batch reading multiple files with paths array in code_read', async () => {
    const result = await tool.handler({ path: 'ignored.ts', paths: ['index.ts', 'server.ts'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.is_batch).toBe(true);
    expect(data.files.length).toBe(2);
    expect(data.files[0].filePath).toBe('index.ts');
    expect(data.files[1].filePath).toBe('server.ts');
  });

  it('should support batch reading implementations of multiple symbols', async () => {
    const { executeStrategy } = await import('../../smart-file-read.js');
    (executeStrategy as any).mockResolvedValue({ content: 'mock symbol impl', mode_used: 'implementation_of', symbol_count: 1 });
    
    const result = await tool.handler({ path: 'app.ts', mode: 'implementation', symbol: 'funcA, funcB' });
    const data = JSON.parse(result.content[0].text);
    expect(data.content).toContain('Symbol: funcA');
    expect(data.content).toContain('Symbol: funcB');
  });

  it('should support full uncollapsed reading mode', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'file:1', parse_status: 'parsed' }]); // File check

    const result = await tool.handler({ path: 'app.ts', mode: 'full' });
    expect(result.content[0].text).toBe('entire full file content');
  });

  it('should fallback to full uncollapsed read if mode is implementation but no symbols specified', async () => {
    mockStore.query.mockResolvedValueOnce([{ id: 'file:1', parse_status: 'parsed' }]); // File check

    const result = await tool.handler({ path: 'app.ts', mode: 'implementation' });
    expect(result.content[0].text).toBe('entire full file content'); // Matches mock
  });

  it('should bypass database check and dynamic indexing entirely for unindexed files in full mode', async () => {
    // If the file is not in database, query for main record returns empty array
    mockStore.query.mockResolvedValue([]);

    // Running code_read in full mode should still read the file from disk directly and succeed instantly
    const result = await tool.handler({ path: 'new-file.ts', mode: 'full' });
    expect(result.content[0].text).toBe('entire full file content');
  });
});
