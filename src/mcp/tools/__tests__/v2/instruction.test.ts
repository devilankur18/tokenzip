import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createRememberTool, 
  createRecallTool, 
  createForgetTool, 
  createSearchTool 
} from '../../v2/instruction.js';
import { TokenBudgetManager } from '../../../token-budget.js';

describe('RecallKit Granular Instruction Tools (V2)', () => {
  let mockStore: any;
  let budget: TokenBudgetManager;

  beforeEach(() => {
    mockStore = {
      query: vi.fn().mockResolvedValue([])
    };
    budget = new TokenBudgetManager(4000);
  });

  describe('remember_instruction', () => {
    let tool: any;

    beforeEach(() => {
      tool = createRememberTool(mockStore);
    });

    it('should save a standard guideline note successfully', async () => {
      mockStore.query
        .mockResolvedValueOnce([]) // for file select (content hash) if any
        .mockResolvedValueOnce([{ id: 'annotation:new' }]) // for CREATE annotation
        .mockResolvedValueOnce([{ id: 'file:target' }]) // for SELECT target ID
        .mockResolvedValueOnce([]) // for RELATE 1
        .mockResolvedValueOnce([]); // for RELATE 2

      const result = await tool.handler({
        target: 'src/main.ts',
        title: 'Avoid Global State',
        summary: 'Never store state in global module variables.',
        category: 'guideline',
        scope: 'file'
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('annotation:new');
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE annotation'),
        expect.anything()
      );
    });

    it('should require target, title, and summary parameters', async () => {
      const result = await tool.handler({
        target: 'src/main.ts'
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing target, title, or summary');
    });

    it('should fall back to repository scope if target ID is not found', async () => {
      mockStore.query
        .mockResolvedValueOnce([{ id: 'annotation:fallback' }]) // CREATE
        .mockResolvedValueOnce([]) // SELECT target module/file (none)
        .mockResolvedValueOnce([{ id: 'repository:root' }]) // SELECT repo
        .mockResolvedValueOnce([]); // RELATE

      const result = await tool.handler({
        target: 'non-existent-dir',
        title: 'Architecture Spec',
        summary: 'Global spec details.',
        category: 'architecture',
        scope: 'module'
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('annotation:fallback');
    });
  });

  describe('recall_instruction', () => {
    let tool: any;

    beforeEach(() => {
      tool = createRecallTool(mockStore, budget);
    });

    it('should recall active inherited guidelines for a path', async () => {
      mockStore.query.mockResolvedValueOnce([
        {
          id: 'annotation:1',
          category: 'guideline',
          title: 'Import rule',
          summary: 'Use absolute paths',
          details: '',
          priority: 'normal',
          confidence: 1.0,
          tags: []
        }
      ]);

      const result = await tool.handler({ target: 'src/mcp/server.ts' });
      expect(result.isError).toBeUndefined();
      
      const data = JSON.parse(result.content[0].text);
      expect(data.target).toBe('src/mcp/server.ts');
      expect(data.instructions).toHaveLength(1);
      expect(data.instructions[0].id).toBe('annotation:1');
    });

    it('should flag stale file-scoped notes with warning tags', async () => {
      mockStore.query
        .mockResolvedValueOnce([
          {
            id: 'annotation:stale',
            category: 'gotcha',
            title: 'Use custom port',
            summary: 'Surreal DB requires port 8000',
            details: '',
            priority: 'important',
            confidence: 1.0,
            tags: [],
            target_hash: 'old-file-hash'
          }
        ])
        .mockResolvedValueOnce([{ content_hash: 'new-file-hash' }]); // content hash check for staleness

      const result = await tool.handler({ target: 'src/config.ts' });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0].text);
      expect(data.instructions[0].title).toContain('[⚠️ STALE]');
    });

    it('should require target parameter', async () => {
      const result = await tool.handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing target parameter');
    });
  });

  describe('forget_instruction', () => {
    let tool: any;

    beforeEach(() => {
      tool = createForgetTool(mockStore);
    });

    it('should archive a note successfully by ID', async () => {
      const result = await tool.handler({
        id: 'annotation:123',
        reason: 'Superseded'
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Successfully archived instruction: annotation:123');
      expect(mockStore.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE type::record($id) SET is_active = false'),
        expect.objectContaining({ id: 'annotation:123', reason: 'Superseded' })
      );
    });

    it('should require ID parameter', async () => {
      const result = await tool.handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing record ID');
    });
  });

  describe('search_instruction', () => {
    let tool: any;

    beforeEach(() => {
      tool = createSearchTool(mockStore, budget);
    });

    it('should query active notes matching keyword', async () => {
      mockStore.query.mockResolvedValueOnce([
        {
          id: 'annotation:query_match',
          category: 'guideline',
          title: 'Database connection',
          summary: 'Use port 6001',
          priority: 'normal',
          tags: []
        }
      ]);

      const result = await tool.handler({ query: 'Database' });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0].text);
      expect(data.query).toBe('Database');
      expect(data.results).toHaveLength(1);
      expect(data.results[0].id).toBe('annotation:query_match');
    });

    it('should require query parameter', async () => {
      const result = await tool.handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing search query');
    });
  });
});
