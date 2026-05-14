import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createSmartFileReadTools } from '../../tools/smart-file-read.js';

describe('smart_file_read (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createSmartFileReadTools(store, repoPath, budget);
    tool = tools[0];
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Read lib/express.js in auto mode', async () => {
    const result = await tool.handler({ path: 'lib/express.js', mode: 'auto' });
    const data = JSON.parse(result.content[0].text);
    expect(data.mode_used).toBe('skeleton');
    expect(data.content).toContain('exports = module.exports = createApplication');
  });

  it('2. Read lib/application.js in skeleton mode', async () => {
    const result = await tool.handler({ path: 'lib/application.js', mode: 'skeleton' });
    const data = JSON.parse(result.content[0].text);
    expect(data.mode_used).toBe('skeleton');
    expect(data.content).toContain('app.init = function init() {');
    expect(data.content).toContain('/* [body] */');
  });

  it('3. Read lib/request.js in interface_only mode', async () => {
    const result = await tool.handler({ path: 'lib/request.js', mode: 'interface_only' });
    const data = JSON.parse(result.content[0].text);
    expect(data.mode_used).toBe('interface_only');
    expect(data.content).toContain('req.get =');
    expect(data.content).not.toContain('this.header(name)');
  });

  it('4. Read lib/express.js in dependency_only mode', async () => {
    const result = await tool.handler({ path: 'lib/express.js', mode: 'dependency_only' });
    const data = JSON.parse(result.content[0].text);
    expect(data.mode_used).toBe('dependency_only');
    expect(data.content).toContain('--- IMPORTS ---');
    expect(data.content).toContain('--- CALL GRAPH ---');
  });

  it('5. Get implementation of "createApplication" in lib/express.js', async () => {
    const result = await tool.handler({ 
      path: 'lib/express.js', 
      mode: 'implementation_of', 
      target_symbol: 'createApplication' 
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.mode_used).toBe('implementation_of');
    expect(data.content).toContain('function createApplication() {');
    expect(data.content).toContain('return app');
  });

  it('6. Get implementation of nested method "app.handle" in lib/application.js', async () => {
    const result = await tool.handler({ 
      path: 'lib/application.js', 
      mode: 'implementation_of', 
      target_symbol: 'handle' 
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.content).toContain('app.handle = function handle(req, res, callback) {');
  });

  it('7. Truncation test with very low budget', async () => {
    const result = await tool.handler({ 
      path: 'lib/application.js', 
      mode: 'skeleton', 
      max_tokens: 200 
    });
    const data = JSON.parse(result.content[0].text);
    // Should have downgraded to interface_only or truncated
    expect(data.mode_used).toBe('interface_only');
    expect(data.warnings.length).toBeGreaterThan(0);
  });

  it('8. Include JSDocs in lib/application.js', async () => {
    const result = await tool.handler({ 
      path: 'lib/application.js', 
      mode: 'interface_only', 
      include_docs: true 
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.content).toContain('/**');
    expect(data.content).toContain('@private');
  });

  it('9. Error on non-existent file', async () => {
    const result = await tool.handler({ path: 'lib/ghost.js' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('File not found');
  });

  it('10. Verify Cortex injection in smart_file_read', async () => {
    // First save a note for lib/express.js
    const setup = await setupIntegrationTest();
    const cortexTools = (await import('../../tools/cortex.js')).createCortexTools(setup.store, setup.repoPath, setup.budget);
    const saveTool = cortexTools.find(t => t.name === 'cortex_save');
    await saveTool.handler({
      category: 'architecture',
      title: 'Express Entry Note',
      summary: 'Main entry point of express.',
      scope: 'file',
      targets: ['lib/express.js'],
      priority: 'important'
    });

    const result = await tool.handler({ path: 'lib/express.js', mode: 'interface_only' });
    const data = JSON.parse(result.content[0].text);
    expect(data._cortex).toBeDefined();
    expect(data._cortex.notes.some((n: string) => n.includes('Express Entry Note'))).toBe(true);
  });
});
