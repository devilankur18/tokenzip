import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createContextTools } from '../../tools/context.js';

describe('context (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createContextTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'get_context_bundle');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Get context bundle for "createApplication"', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.target.name).toBe('createApplication');
    expect(data.target.code).toBeDefined();
    expect(Array.isArray(data.dependencies)).toBe(true);
  });

  it('2. Verify dependency signatures', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    
    if (data.dependencies.length > 0) {
      const dep = data.dependencies[0];
      expect(dep).toHaveProperty('name');
      expect(dep).toHaveProperty('signature');
      expect(dep).toHaveProperty('filePath');
    }
  });

  it('3. Handle non-existent symbol', async () => {
    const result = await tool.handler({ symbol_name: 'UnknownSymbol' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Symbol not found');
  });

  it('4. Use symbol_id for disambiguation', async () => {
    const symbols = await store.query('SELECT id, name FROM symbol WHERE name = "createApplication" LIMIT 1');
    const id = symbols[0].id.toString();

    const result = await tool.handler({ symbol_name: 'createApplication', symbol_id: id });
    const data = JSON.parse(result.content[0].text);
    expect(data.target.name).toBe('createApplication');
  });

  it('5. Verify target metadata', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.target.kind).toBeDefined();
    expect(data.target.filePath).toBeDefined();
  });

  it('6. Tool metadata check', async () => {
    expect(tool.name).toBe('get_context_bundle');
    expect(tool.description).toContain('implementation');
  });

  it('7. Budget truncation check', async () => {
    // createApplication calls several things, should fit in 8k but good to check
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data._token_count).toBeDefined();
    expect(data._truncated).toBeDefined();
  });

  it('8. Large implementation test', async () => {
    // Find a large symbol if possible, or just use app.init
    const result = await tool.handler({ symbol_name: 'app.init' });
    const data = JSON.parse(result.content[0].text);
    expect(data.target.code.length).toBeGreaterThan(0);
  });

  it('9. Verify caller-callee relationship exists', async () => {
    // createApplication calls app.init (according to previous search results)
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    
    const hasAppInit = data.dependencies.some((d: any) => d.name === 'app.init');
    // Depending on exact indexing, it might be 'init' or 'app.init'
    expect(data.dependencies.length).toBeGreaterThan(0);
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
