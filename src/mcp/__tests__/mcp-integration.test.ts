import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from './test-setup.js';
import { registerTools } from '../tools/registry.js';

describe('MCP Integration Tests (Express.js Bench)', () => {
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
  }, 60000); // 1 minute timeout for setup

  afterAll(async () => {
    if (store) await store.close();
  });

  const runTool = async (name: string, args: any) => {
    const tool = tools.find(t => t.name === name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return await tool.handler(args);
  };

  it('get_codebase_stats should return correct stats for express', async () => {
    const result = await runTool('get_codebase_stats', {});
    const data = JSON.parse(result.content[0].text);
    
    // We check for general presence, not exact numbers to allow for minor parser changes
    expect(data.nodeCount).toBeDefined();
    expect(data.nodeCount.symbol).toBeGreaterThan(500);
    expect(data.nodeCount.file).toBeGreaterThan(50);
  });

  it('smart_file_read (skeleton) lib/express.js', async () => {
    const result = await runTool('smart_file_read', { 
      path: 'lib/express.js' 
    });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.mode_used).toBe('skeleton');
    expect(data.content).toContain('exports = module.exports = createApplication');
    expect(data).toMatchSnapshot();
  });

  it('query_symbol "express"', async () => {
    const result = await runTool('query_symbol', { 
      symbol_name: 'express' 
    });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.symbols).toHaveLength(1);
    expect(data.symbols[0].filePath).toBe('lib/express.js');
    expect(data).toMatchSnapshot();
  });

  it('get_file_tree (root)', async () => {
    const result = await runTool('get_file_tree', { 
      format: 'json'
    });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.structure).toBeDefined();
    expect(data.structure.name).toBe('express');
    expect(data).toMatchSnapshot();
  });

  it('get_code_overview (lib directory)', async () => {
    const result = await runTool('get_code_overview', { 
      path: 'lib',
      format: 'json',
      depth: 1
    });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.structure.name).toBe('lib');
    expect(data.structure.children).toBeDefined();
    expect(data).toMatchSnapshot();
  });

  it('fetch_symbol_metadata for known symbol', async () => {
    // First find the symbol ID for 'express'
    const symRes = await runTool('query_symbol', { symbol_name: 'express' });
    const symId = JSON.parse(symRes.content[0].text).symbols[0].id;
    
    const result = await runTool('fetch_symbol_metadata', { 
      ids: [symId] 
    });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.symbols).toHaveLength(1);
    expect(data.symbols[0].name).toBe('express');
    expect(data).toMatchSnapshot();
  });
});
