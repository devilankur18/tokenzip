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

  async function getAnnotationId(title: string): Promise<string> {
    const res = await store.query('SELECT id FROM annotation WHERE title = $title LIMIT 1', { title });
    return res[0]?.id?.toString();
  }

  it('1. Remove a previously saved note', async () => {
    const title = 'Removal Test Note';
    await saveTool.handler({
      category: 'architecture',
      title,
      summary: 'S',
      scope: 'codebase',
      targets: ['*']
    });
    
    const id = await getAnnotationId(title);
    expect(id).toBeDefined();

    const result = await tool.handler({ id, reason: 'Test removal' });
    expect(result.content[0].text).toContain('archived');

    // Verify inactive
    const found = await store.query('SELECT * FROM annotation WHERE id = $id AND is_active = true', { id });
    expect(found.length).toBe(0);
  });

  it('2. Error on missing ID', async () => {
    const result = await tool.handler({ id: '' });
    expect(result.isError).toBe(true);
  });

  it('3. Tool metadata check', async () => {
    expect(tool.name).toBe('cortex_remove');
  });

  it('4. Response is valid text', async () => {
    const result = await tool.handler({ id: 'annotation:ghost' });
    expect(result.content[0].type).toBe('text');
  });
});
