import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createCortexTools } from '../../tools/cortex.js';

describe('cortex_recall (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;
  let saveTool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createCortexTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'cortex_recall');
    saveTool = tools.find(t => t.name === 'cortex_save');

    // Setup notes for recall
    await saveTool.handler({
      category: 'guideline',
      title: 'Recall Test',
      summary: 'Testing recall on express.js',
      scope: 'file',
      targets: ['lib/express.js']
    });
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Recall notes for lib/express.js', async () => {
    const result = await tool.handler({ target: 'lib/express.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.length).toBeGreaterThan(0);
    expect(data.notes[0].title).toContain('Recall Test');
  });

  it('2. Inheritance recall: recall for file in lib should get module-level notes', async () => {
    await saveTool.handler({
      category: 'architecture',
      title: 'Lib Architecture',
      summary: 'Module level note',
      scope: 'module',
      targets: ['lib']
    });

    const result = await tool.handler({ target: 'lib/express.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.some((n: any) => n.title === 'Lib Architecture')).toBe(true);
  });

  it('3. Filter by category', async () => {
    const result = await tool.handler({ 
      target: 'lib/express.js',
      categories: ['guideline']
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.every((n: any) => n.category === 'guideline')).toBe(true);
  });

  it('4. Tool metadata check', async () => {
    expect(tool.name).toBe('cortex_recall');
  });

  it('5. Response is valid JSON', async () => {
    const result = await tool.handler({ target: 'lib/express.js' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
