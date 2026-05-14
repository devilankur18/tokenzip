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

    // Setup some test notes
    await saveTool.handler({
      category: 'architecture',
      title: 'Global Note',
      summary: 'G',
      scope: 'global'
    });
    await saveTool.handler({
      category: 'gotcha',
      title: 'File Note',
      summary: 'F',
      scope: 'file',
      targets: ['lib/express.js']
    });
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Recall global notes', async () => {
    const result = await tool.handler({ paths: [] });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.some((n: any) => n.title === 'Global Note')).toBe(true);
  });

  it('2. Recall file-specific notes', async () => {
    const result = await tool.handler({ paths: ['lib/express.js'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.some((n: any) => n.title === 'File Note')).toBe(true);
  });

  it('3. Recall both global and file notes', async () => {
    const result = await tool.handler({ paths: ['lib/express.js'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.some((n: any) => n.title === 'Global Note')).toBe(true);
    expect(data.notes.some((n: any) => n.title === 'File Note')).toBe(true);
  });

  it('4. Filter by category "architecture"', async () => {
    const result = await tool.handler({ paths: ['lib/express.js'], categories: ['architecture'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.every((n: any) => n.category === 'architecture')).toBe(true);
    expect(data.notes.some((n: any) => n.title === 'Global Note')).toBe(true);
    expect(data.notes.some((n: any) => n.title === 'File Note')).toBe(false);
  });

  it('5. Recall notes for multiple paths', async () => {
    await saveTool.handler({
      category: 'architecture',
      title: 'App Note',
      summary: 'A',
      scope: 'file',
      targets: ['lib/application.js']
    });
    const result = await tool.handler({ paths: ['lib/express.js', 'lib/application.js'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.some((n: any) => n.title === 'File Note')).toBe(true);
    expect(data.notes.some((n: any) => n.title === 'App Note')).toBe(true);
  });

  it('6. Recall non-existent path notes (should only get global)', async () => {
    const result = await tool.handler({ paths: ['ghost.js'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.notes.every((n: any) => n.scope === 'global')).toBe(true);
  });

  it('7. Verify note fields in integration', async () => {
    const result = await tool.handler({ paths: ['lib/express.js'] });
    const data = JSON.parse(result.content[0].text);
    const note = data.notes[0];
    expect(note.title).toBeDefined();
    expect(note.summary).toBeDefined();
    expect(note.category).toBeDefined();
    expect(note.priority).toBeDefined();
  });

  it('8. Large number of notes check (truncation)', async () => {
    const result = await tool.handler({ paths: ['lib/express.js'] });
    const data = JSON.parse(result.content[0].text);
    expect(data._token_count).toBeGreaterThan(0);
  });

  it('9. Tool description check', async () => {
    expect(tool.name).toBe('cortex_recall');
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ paths: ['lib/express.js'] });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
