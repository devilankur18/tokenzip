import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from './test-setup.js';
import { registerTools } from '../tools/registry.js';

describe('MCP Enrichment Tests (Express.js Bench)', () => {
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

  it('inspect_targets (file and symbol)', async () => {
    const result = await runTool('inspect_targets', { 
      targets: ['lib/express.js', 'createApplication'] 
    });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.results).toHaveLength(2);
    expect(data.results[0].type).toBe('file');
    expect(data.results[0].path).toBe('lib/express.js');
    expect(data.results[1].type).toBe('symbol');
    expect(data.results[1].name).toBe('createApplication');
    expect(data).toMatchSnapshot();
  });

  it('get_file_symbols for lib/express.js', async () => {
    const result = await runTool('get_file_symbols', { 
      file_path: 'lib/express.js' 
    });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.file).toBe('lib/express.js');
    expect(data.symbols).toBeDefined();
    expect(data.symbols.length).toBeGreaterThan(0);
    expect(data).toMatchSnapshot();
  });

  it('find_implementations for "Router"', async () => {
    // Note: Router in Express is a function that returns an object, 
    // but let's see if we have any inheritance/implementation edges.
    // Actually, in JS it might be sparse. Let's try to find something that might have implementations.
    const result = await runTool('find_implementations', { 
      symbol_name: 'Router' 
    });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.symbol).toBe('Router');
    expect(data.implementations).toBeDefined();
  });

  it('get_call_hierarchy for "createApplication"', async () => {
    const result = await runTool('get_call_hierarchy', { 
      symbol_name: 'createApplication' 
    });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.symbol).toBe('createApplication');
    expect(data.incoming).toBeDefined();
    expect(data.outgoing).toBeDefined();
    expect(data).toMatchSnapshot();
  });

  it('get_context_bundle for "createApplication"', async () => {
    const result = await runTool('get_context_bundle', { 
      symbol_name: 'createApplication' 
    });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.target).toBeDefined();
    expect(data.target.name).toBe('createApplication');
    expect(data.target.code).toContain('function createApplication');
    expect(data.dependencies).toBeDefined();
    expect(data).toMatchSnapshot();
  });

  describe('Cortex Tools', () => {
    it('cortex_save and cortex_recall', async () => {
      // 1. Save a note
      const saveRes = await runTool('cortex_save', {
        category: 'architecture',
        title: 'Test Architecture Note',
        summary: 'This is a test note for lib/express.js',
        scope: 'file',
        targets: ['lib/express.js'],
        priority: 'important'
      });
      
      expect(saveRes.isError).toBeUndefined();
      expect(saveRes.content[0].text).toContain('Successfully saved note');

      // 2. Recall the note
      const recallRes = await runTool('cortex_recall', {
        target: 'lib/express.js'
      });
      const recallData = JSON.parse(recallRes.content[0].text);
      
      expect(recallData.notes).toBeDefined();
      expect(recallData.notes.some((n: any) => n.title === 'Test Architecture Note')).toBe(true);

      // 3. Search for the note
      const searchRes = await runTool('cortex_search', {
        query: 'Test Architecture'
      });
      const searchData = JSON.parse(searchRes.content[0].text);
      expect(searchData.results.some((n: any) => n.title === 'Test Architecture Note')).toBe(true);
    });

    it('cortex_traverse for lib/', async () => {
      const result = await runTool('cortex_traverse', {
        target: 'lib'
      });
      const data = JSON.parse(result.content[0].text);
      
      expect(data.recommended_read_order).toBeDefined();
      expect(data.recommended_read_order.length).toBeGreaterThan(0);
    });

    it('cortex_suggest', async () => {
      const result = await runTool('cortex_suggest', {
        problem: 'Too many tokens used for large files',
        proposed_solution: 'Implement dynamic chunking',
        severity: 'high'
      });
      expect(result.content[0].text).toContain('Suggestion logged');
    });
  });
});
