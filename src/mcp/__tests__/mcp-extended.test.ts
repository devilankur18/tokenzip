import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from './test-setup.js';
import { registerTools } from '../tools/registry.js';

describe('MCP Extended Tool Tests (Express.js Bench)', () => {
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

  describe('Structure & Discovery Tools', () => {
    it('inspect_targets should fetch multiple targets', async () => {
      const result = await runTool('inspect_targets', {
        targets: ['lib/express.js', 'createApplication']
      });
      const data = JSON.parse(result.content[0].text);
      
      expect(data.results).toHaveLength(2);
      expect(data.results[0].type).toBe('file');
      expect(data.results[0].path).toBe('lib/express.js');
      expect(data.results[1].type).toBe('symbol');
      expect(data.results[1].name).toBe('createApplication');
    });

    it('get_file_symbols should list symbols in a file', async () => {
      const result = await runTool('get_file_symbols', {
        file_path: 'lib/express.js'
      });
      const data = JSON.parse(result.content[0].text);
      
      expect(data.file).toBe('lib/express.js');
      expect(data.symbols.length).toBeGreaterThan(0);
      expect(data.symbols.some((s: any) => s.name === 'createApplication')).toBe(true);
    });
  });

  describe('Navigation & Context Tools', () => {
    it('find_implementations for "EventEmitter"', async () => {
      // In Express, many things might implement or inherit from EventEmitter
      const result = await runTool('find_implementations', {
        symbol_name: 'EventEmitter'
      });
      const data = JSON.parse(result.content[0].text);
      
      expect(data.symbol).toBe('EventEmitter');
      // We don't strictly expect implementations in express bench unless it's indexed
      // but the tool should at least run.
    });

    it('get_call_hierarchy for "createApplication"', async () => {
      const result = await runTool('get_call_hierarchy', {
        symbol_name: 'createApplication'
      });
      const data = JSON.parse(result.content[0].text);
      
      expect(data.symbol).toBe('createApplication');
      expect(data.incoming).toBeDefined();
      expect(data.outgoing).toBeDefined();
    });

    it('get_context_bundle for "createApplication"', async () => {
      const result = await runTool('get_context_bundle', {
        symbol_name: 'createApplication'
      });
      const data = JSON.parse(result.content[0].text);
      
      expect(data.target.name).toBe('createApplication');
      expect(data.target.code).toBeDefined();
      expect(data.dependencies).toBeDefined();
    });
  });

  describe('Cortex Memory Tools', () => {
    it('cortex_save should store a note', async () => {
      const result = await runTool('cortex_save', {
        category: 'architecture',
        title: 'Express Entry Point',
        summary: 'lib/express.js is the main entry point for the framework.',
        scope: 'file',
        targets: ['lib/express.js'],
        priority: 'critical'
      });
      
      expect(result.content[0].text).toContain('Successfully saved note');
    });

    it('cortex_recall should retrieve stored notes', async () => {
      // Save another one first
      await runTool('cortex_save', {
        category: 'guideline',
        title: 'Use createApplication',
        summary: 'Always use createApplication to initialize the app.',
        scope: 'codebase',
        targets: ['*']
      });

      const result = await runTool('cortex_recall', {
        target: 'lib/express.js'
      });
      const data = JSON.parse(result.content[0].text);
      
      expect(data.notes.length).toBeGreaterThan(0);
      expect(data.notes.some((n: any) => n.title.includes('Express Entry Point'))).toBe(true);
      expect(data.notes.some((n: any) => n.title.includes('Use createApplication'))).toBe(true);
    });

    it('cortex_search should find notes by query', async () => {
      const result = await runTool('cortex_search', {
        query: 'Express Entry'
      });
      const data = JSON.parse(result.content[0].text);
      
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results[0].title).toBe('Express Entry Point');
    });

    it('cortex_traverse should provide reading order', async () => {
      // Save a hint first
      await runTool('cortex_save', {
        category: 'traversal_hint',
        title: 'How to read lib',
        summary: 'Read express.js then request.js',
        scope: 'module',
        targets: ['lib'],
        read_order: ['lib/express.js', 'lib/request.js']
      });

      const result = await runTool('cortex_traverse', {
        target: 'lib'
      });
      const data = JSON.parse(result.content[0].text);
      
      expect(data.source).toBe('stored_hint');
      expect(data.recommended_read_order).toContain('lib/express.js');
    });
  });
});
