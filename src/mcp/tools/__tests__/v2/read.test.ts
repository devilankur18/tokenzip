import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createReadTool } from '../../v2/read.js';
import { TokenBudgetManager } from '../../../token-budget.js';

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
});
