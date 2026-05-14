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
    tool = tools.find(t => t.name === 'smart_file_read');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Read skeleton of lib/express.js', async () => {
    const result = await tool.handler({ path: 'lib/express.js', mode: 'skeleton' });
    const data = JSON.parse(result.content[0].text);
    expect(data.content).toBeDefined();
    expect(data.mode_used).toBe('skeleton');
    expect(data.symbol_count).toBeGreaterThan(0);
  });

  it('2. Read interface_only of lib/application.js', async () => {
    const result = await tool.handler({ path: 'lib/application.js', mode: 'interface_only' });
    const data = JSON.parse(result.content[0].text);
    expect(data.mode_used).toBe('interface_only');
    expect(data.content).toContain('app.init');
  });

  it('3. Read specific implementation (implementation_of)', async () => {
    const result = await tool.handler({ 
      path: 'lib/express.js', 
      mode: 'implementation_of',
      target_symbol: 'createApplication'
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.mode_used).toBe('implementation_of');
    expect(data.content).toContain('function createApplication');
  });

  it('4. Read range', async () => {
    const result = await tool.handler({ 
      path: 'lib/express.js', 
      range: { start: 1, end: 10 }
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.mode_used).toBe('range');
    expect(data.content.split('\n').length).toBeLessThanOrEqual(10);
  });

  it('5. Error on non-existent file', async () => {
    const result = await tool.handler({ path: 'ghost.js' });
    expect(result.content[0].text).toContain('not found');
  });

  it('6. Tool metadata check', async () => {
    expect(tool.name).toBe('smart_file_read');
  });

  it('7. Verify Cortex injection', async () => {
    // Save a note first
    const { createCortexTools } = await import('../../tools/cortex.js');
    const cTools = createCortexTools(store, repoPath, budget);
    const saveTool = cTools.find(t => t.name === 'cortex_save');
    await saveTool.handler({
      category: 'guideline',
      title: 'Auto Recall Test',
      summary: 'Testing auto recall in smart_file_read',
      scope: 'file',
      targets: ['lib/express.js']
    });

    const result = await tool.handler({ path: 'lib/express.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data._cortex).toBeDefined();
    expect(data._cortex.notes[0]).toContain('Auto Recall Test');
  });
});
