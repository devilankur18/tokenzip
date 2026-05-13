import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTools } from '../tools/registry.js';
import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue('export function test() {}'),
    statSync: vi.fn().mockReturnValue({ isFile: () => true }),
  }
}));

describe('MCP Tool Output Format Consistency', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;
  let tools: any[];

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockImplementation(async (q: string) => {
        const query = q.toLowerCase();
        if (query.includes('symbol')) return [{ id: 'symbol:1', name: 'myFunc', kind: 'function', startLine: 1, endLine: 10, filePath: 'src/index.ts' }];
        if (query.includes('file')) return [{ id: 'file:1', path: 'src/index.ts', language: 'typescript' }];
        if (query.includes('repository')) return [{ id: 'repo:1', name: 'test-repo', type: 'repository' }];
        if (query.includes('contains')) return [];
        return [];
      }),
      stats: vi.fn().mockResolvedValue({ nodeCount: {}, edgeCount: {} }),
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    budget = new TokenBudgetManager(8000);
    tools = registerTools(mockStore as unknown as IStore, '/mock/repo', budget);
  });

  it('should have all expected tools registered', () => {
    const names = tools.map(t => t.name);
    expect(names).toContain('get_code_overview');
    expect(names).toContain('smart_file_read');
    expect(names).toContain('query_symbol');
    expect(names).toContain('get_token_savings');
  });

  const jsonTools = [
    'get_codebase_stats',
    'get_file_symbols',
    'inspect_targets',
    'search_codebase',
    'fuzzy_find_symbol',
    'query_symbol',
    'find_references',
    'get_dependencies',
    'read_symbol',
    'get_context_bundle',
    'fetch_symbol_metadata'
  ];

  jsonTools.forEach(toolName => {
    it(`tool "${toolName}" should return structured JSON content`, async () => {
      const tool = tools.find(t => t.name === toolName);
      expect(tool).toBeDefined();

      const args = toolName === 'inspect_targets' ? { targets: ['src/index.ts'] } :
                   toolName === 'fetch_symbol_metadata' ? { ids: ['symbol:1'] } :
                   { symbol_name: 'test', file_path: 'src/index.ts', query: 'test' };

      const result = await tool.handler(args);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      // Verify it's valid JSON
      const data = JSON.parse(result.content[0].text);
      expect(data).toBeDefined();
      
      // Verify truncation metadata
      expect(data).toHaveProperty('_token_count');
      expect(data).toHaveProperty('_truncated');
    });
  });

  it('smart_file_read should return structured JSON content with metadata', async () => {
    const tool = tools.find(t => t.name === 'smart_file_read');
    
    const result = await tool.handler({ path: 'src/index.ts' });
    const data = JSON.parse(result.content[0].text);
    
    expect(data).toHaveProperty('content');
    expect(data).toHaveProperty('mode_used');
    expect(data).toHaveProperty('symbol_count');
    expect(data).toHaveProperty('_token_count');
  });

  it('get_token_savings should support detailed JSON format', async () => {
    const tool = tools.find(t => t.name === 'get_token_savings');
    const result = await tool.handler({ format: 'detailed' });
    
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty('callCount');
    expect(data).toHaveProperty('totalSaved');
  });

  it('get_token_savings should return plain text for summary format', async () => {
    const tool = tools.find(t => t.name === 'get_token_savings');
    const result = await tool.handler({ format: 'summary' });
    
    expect(result.content[0].text).toContain('TokenZip ROI Dashboard');
  });
});
