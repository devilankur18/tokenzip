import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createStructureTools } from '../../tools/structure.js';

describe('get_file_tree (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createStructureTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'get_file_tree');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Get root file tree', async () => {
    const result = await tool.handler({ format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure).toBeDefined();
    expect(data.structure.children.length).toBeGreaterThan(0);
  });

  it('2. Get "lib" directory tree', async () => {
    const result = await tool.handler({ path: 'lib', format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure.name).toBe('lib');
    expect(data.structure.children.some((c: any) => c.name === 'express.js')).toBe(true);
  });

  it('3. Depth 1 check (flat)', async () => {
    const result = await tool.handler({ path: 'lib', depth: 1, format: 'json' });
    const data = JSON.parse(result.content[0].text);
    // Depth 1 means only immediate children
    expect(data.structure.children.every((c: any) => !c.children || c.children.length === 0)).toBe(true);
  });

  it('4. Depth 2 check (nested)', async () => {
    const result = await tool.handler({ path: '.', depth: 2, format: 'json' });
    const data = JSON.parse(result.content[0].text);
    const lib = data.structure.children.find((c: any) => c.name === 'lib');
    expect(lib).toBeDefined();
    expect(lib.children.length).toBeGreaterThan(0);
  });

  it('5. Error on non-existent directory', async () => {
    const result = await tool.handler({ path: 'ghost_dir' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('6. Handle file as path (should return the file itself)', async () => {
    const result = await tool.handler({ path: 'lib/express.js', format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure.name).toBe('express.js');
    expect(data.structure.type).toBe('file');
  });

  it('7. Verify types (file vs module)', async () => {
    const result = await tool.handler({ format: 'json' });
    const data = JSON.parse(result.content[0].text);
    const lib = data.structure.children.find((c: any) => c.name === 'lib');
    expect(lib.type).toBe('module');
  });

  it('8. Large depth check (smoke)', async () => {
    const result = await tool.handler({ depth: 5, format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure.children).toBeDefined();
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('get_file_tree');
    expect(tool.description).toContain('repository');
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ format: 'json' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
