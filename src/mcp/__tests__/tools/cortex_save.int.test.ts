import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createCortexTools } from '../../tools/cortex.js';

describe('cortex_save (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createCortexTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'cortex_save');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Save a global architectural guideline', async () => {
    const result = await tool.handler({
      category: 'architecture',
      title: 'Global Style Guide',
      summary: 'Use functional components everywhere.',
      scope: 'global',
      priority: 'important'
    });
    expect(result.content[0].text).toContain('Saved');
  });

  it('2. Save a file-specific gotcha', async () => {
    const result = await tool.handler({
      category: 'gotcha',
      title: 'Large Payload Risk',
      summary: 'This file handles large JSON buffers, watch memory.',
      scope: 'file',
      targets: ['lib/application.js'],
      priority: 'critical'
    });
    expect(result.content[0].text).toContain('Saved');
  });

  it('3. Save a module-level rule', async () => {
    const result = await tool.handler({
      category: 'architecture',
      title: 'Middleware Strictness',
      summary: 'All middleware must call next().',
      scope: 'module',
      targets: ['lib/router'],
      priority: 'important'
    });
    expect(result.content[0].text).toContain('Saved');
  });

  it('4. Update an existing note', async () => {
    // Save first
    await tool.handler({
      category: 'architecture',
      title: 'Update Test',
      summary: 'Version 1',
      scope: 'global'
    });
    // Update
    const result = await tool.handler({
      category: 'architecture',
      title: 'Update Test',
      summary: 'Version 2',
      scope: 'global'
    });
    expect(result.content[0].text).toContain('Saved');
  });

  it('5. Save multiple targets at once', async () => {
    const result = await tool.handler({
      category: 'gotcha',
      title: 'Shared Dependency',
      summary: 'Both files depend on a singleton.',
      scope: 'file',
      targets: ['lib/request.js', 'lib/response.js']
    });
    expect(result.content[0].text).toContain('Saved');
  });

  it('6. Verify persistence via query (smoke)', async () => {
    await tool.handler({
      category: 'architecture',
      title: 'Persistent Note',
      summary: 'Check if this exists.',
      scope: 'global'
    });
    const found = await store.query('SELECT * FROM cortex WHERE title = "Persistent Note"');
    expect(found.length).toBeGreaterThan(0);
  });

  it('7. Error on empty targets for file scope', async () => {
    const result = await tool.handler({
      category: 'architecture',
      title: 'Fail',
      summary: 'S',
      scope: 'file',
      targets: []
    });
    expect(result.isError).toBe(true);
  });

  it('8. Save with custom priority "low"', async () => {
    const result = await tool.handler({
      category: 'architecture',
      title: 'Low Priority Note',
      summary: 'S',
      scope: 'global',
      priority: 'low'
    });
    expect(result.content[0].text).toContain('Saved');
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('cortex_save');
  });

  it('10. Response message consistency', async () => {
    const result = await tool.handler({
      category: 'architecture',
      title: 'Msg Check',
      summary: 'S',
      scope: 'global'
    });
    expect(typeof result.content[0].text).toBe('string');
  });
});
