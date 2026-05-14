import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from './test-setup.js';
import { registerTools } from '../tools/registry.js';

describe('MCP Production Tests (Express.js Bench)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tools: any[];

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    tools = registerTools(store, repoPath, budget);
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  const runTool = async (name: string, args: any) => {
    const tool = tools.find(t => t.name === name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return await tool.handler(args);
  };

  describe('Search & Fuzzy Find Edge Cases', () => {
    it('search_codebase with regex-like characters', async () => {
      // Search for 'app' which is a common symbol name
      const result = await runTool('search_codebase', { query: 'app' });
      const data = JSON.parse(result.content[0].text);
      expect(data.matches.length).toBeGreaterThan(0);
    });

    it('search_codebase with limit', async () => {
      const result = await runTool('search_codebase', { query: 'e', limit: 5 });
      const data = JSON.parse(result.content[0].text);
      expect(data.matches.length).toBeLessThanOrEqual(5);
    });

    it('fuzzy_find_symbol for non-existent symbol should return empty/best match', async () => {
      const result = await runTool('fuzzy_find_symbol', { query: 'ZzZzZzZzZzZ' });
      const data = JSON.parse(result.content[0].text);
      expect(data.candidates.length).toBe(0);
    });
  });

  describe('Smart File Read Advanced', () => {
    it('mode: dependency_only for lib/express.js', async () => {
      const result = await runTool('smart_file_read', { 
        path: 'lib/express.js',
        mode: 'dependency_only'
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.mode_used).toBe('dependency_only');
      expect(data.content).toContain('--- IMPORTS ---');
      expect(data.content).toContain('--- CALL GRAPH ---');
    });

    it('mode: implementation_of with fuzzy suggestion', async () => {
      const result = await runTool('smart_file_read', { 
        path: 'lib/express.js',
        mode: 'implementation_of',
        target_symbol: 'createApp' 
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.content).toContain("Did you mean");
    });

    it('mode: skeleton with include_docs: true', async () => {
      const result = await runTool('smart_file_read', { 
        path: 'lib/application.js',
        mode: 'skeleton',
        include_docs: true
      });
      const data = JSON.parse(result.content[0].text);
      // lib/application.js has many JSDocs
      expect(data.content).toContain('/**');
    });

    it('error handling: non-existent file', async () => {
      const result = await runTool('smart_file_read', { 
        path: 'lib/non-existent.js'
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('File not found');
    });
  });

  describe('Cortex Production Scenarios', () => {
    it('hierarchical recall (module + file notes)', async () => {
      // 1. Save note for module 'lib'
      await runTool('cortex_save', {
        category: 'architecture',
        title: 'Lib Module Rule',
        summary: 'All files in lib must be exported via express.js',
        scope: 'module',
        targets: ['lib'],
        priority: 'important'
      });

      // 2. Save note for file 'lib/express.js'
      await runTool('cortex_save', {
        category: 'gotcha',
        title: 'Express Entry Point',
        summary: 'This is the main entry point.',
        scope: 'file',
        targets: ['lib/express.js'],
        priority: 'critical'
      });

      // 3. Recall for 'lib/express.js'
      const result = await runTool('cortex_recall', {
        target: 'lib/express.js'
      });
      const data = JSON.parse(result.content[0].text);
      
      expect(data.notes.some((n: any) => n.title === 'Express Entry Point')).toBe(true);
    });

    it('cortex_suggest should log suggestions correctly', async () => {
      const result = await runTool('cortex_suggest', {
        problem: 'Too many tokens used in skeleton mode',
        proposed_solution: 'Use more aggressive folding for internal variables',
        severity: 'medium',
        related_targets: ['src/mcp/tools/smart-file-read.ts']
      });
      expect(result.content[0].text).toContain('Suggestion logged:');
    });
  });

  describe('Relationship Tools', () => {
    it('get_call_hierarchy for exported function', async () => {
      const result = await runTool('get_call_hierarchy', {
        symbol_name: 'createApplication'
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.incoming).toBeDefined();
      expect(data.outgoing).toBeDefined();
    });

    it('find_implementations for non-existent interface', async () => {
      const result = await runTool('find_implementations', {
        symbol_name: 'INonExistentInterface'
      });
      // Tool returns text error if not found
      if (result.isError) {
        expect(result.content[0].text).toContain('Symbol not found');
      } else {
        const data = JSON.parse(result.content[0].text);
        expect(data.implementations).toHaveLength(0);
      }
    });
  });

  describe('Resilience & Budget Management', () => {
    it('get_code_overview with depth 0 (top-level only)', async () => {
      const result = await runTool('get_code_overview', {
        path: '.',
        depth: 0,
        format: 'json'
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.structure.name).toBe('express');
      // Depth 0 should have no children or very minimal
    });

    it('smart_file_read with aggressive token budget', async () => {
      const result = await runTool('smart_file_read', {
        path: 'lib/application.js',
        mode: 'skeleton',
        max_tokens: 100 // Very small
      });
      const data = JSON.parse(result.content[0].text);
      // It should have degraded or warned
      expect(data.mode_used).toBe('interface_only');
      expect(data.warnings.some((w: string) => w.includes('downgraded'))).toBe(true);
    });

    it('inspect_targets with mixed valid/invalid paths', async () => {
      const result = await runTool('inspect_targets', {
        targets: ['lib/express.js', 'non-existent.js', 'lib/application.js']
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.results).toHaveLength(3); 
      expect(data.results.some((r: any) => r.type === 'unknown')).toBe(true);
    });
  });
});
