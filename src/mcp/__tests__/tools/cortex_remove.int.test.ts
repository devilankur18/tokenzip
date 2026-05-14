import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createCortexTools } from '../../tools/cortex.js';

describe('cortex_remove (Integration)', () => {
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
    tool = tools.find(t => t.name === 'cortex_remove');
    saveTool = tools.find(t => t.name === 'cortex_save');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Remove a previously saved note', async () => {
    const title = 'Removal Test Note';
    await saveTool.handler({
      category: 'architecture',
      title,
      summary: 'S',
      scope: 'global'
    });
    // Verify exists
    let found = await store.query('SELECT * FROM cortex WHERE title = $title', { title });
    expect(found.length).toBe(1);

    const result = await tool.handler({ title });
    expect(result.content[0].text).toContain('Removed');

    // Verify gone
    found = await store.query('SELECT * FROM cortex WHERE title = $title', { title });
    expect(found.length).toBe(0);
  });

  it('2. Remove non-existent note (idempotent)', async () => {
    const result = await tool.handler({ title: 'GhostNoteX' });
    expect(result.content[0].text).toContain('Removed');
  });

  it('3. Remove note with special characters', async () => {
    const title = 'Note! with @ characters #';
    await saveTool.handler({
      category: 'architecture',
      title,
      summary: 'S',
      scope: 'global'
    });
    const result = await tool.handler({ title });
    expect(result.content[0].text).toContain('Removed');
  });

  it('4. Sequential removals', async () => {
    await saveTool.handler({ title: 'N1', summary: 'S', scope: 'global', category: 'architecture' });
    await saveTool.handler({ title: 'N2', summary: 'S', scope: 'global', category: 'architecture' });
    await tool.handler({ title: 'N1' });
    await tool.handler({ title: 'N2' });
    const found = await store.query('SELECT * FROM cortex WHERE title IN ["N1", "N2"]');
    expect(found.length).toBe(0);
  });

  it('5. Verify error handling for DB issues', async () => {
    // We can't easily trigger a DB error here without mocking, but we check tool resilience
    const result = await tool.handler({ title: 'Test' });
    expect(result.isError).toBeUndefined();
  });

  it('6. Remove file-specific note', async () => {
    const title = 'File Note to Remove';
    await saveTool.handler({
      category: 'gotcha',
      title,
      summary: 'S',
      scope: 'file',
      targets: ['lib/express.js']
    });
    await tool.handler({ title });
    const found = await store.query('SELECT * FROM cortex WHERE title = $title', { title });
    expect(found.length).toBe(0);
  });

  it('7. Remove module-level note', async () => {
    const title = 'Module Note to Remove';
    await saveTool.handler({
      category: 'architecture',
      title,
      summary: 'S',
      scope: 'module',
      targets: ['lib/router']
    });
    await tool.handler({ title });
    const found = await store.query('SELECT * FROM cortex WHERE title = $title', { title });
    expect(found.length).toBe(0);
  });

  it('8. Consistency check - message', async () => {
    const result = await tool.handler({ title: 'Any' });
    expect(result.content[0].text).toMatch(/Removed/);
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('cortex_remove');
  });

  it('10. Response is valid text', async () => {
    const result = await tool.handler({ title: 'T' });
    expect(result.content[0].type).toBe('text');
  });
});
