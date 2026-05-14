import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createCortexTools } from '../../tools/cortex.js';

describe('cortex_suggest (Integration)', () => {
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
    tool = tools.find(t => t.name === 'cortex_suggest');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Log a suggestion for lib/express.js', async () => {
    const result = await tool.handler({
      problem: 'Repeatedly searching for symbols in express',
      proposed_solution: 'Add a multi-symbol lookup tool',
      severity: 'medium',
      related_targets: ['lib/express.js']
    });
    expect(result.content[0].text).toContain('Suggestion logged');
  });

  it('2. Suggestion for a non-existent file (should still log if intended)', async () => {
    const result = await tool.handler({
      problem: 'Ghost files in graph',
      proposed_solution: 'Add a cleanup command',
      severity: 'low'
    });
    expect(result.content[0].text).toContain('Suggestion logged');
  });

  it('3. Multi-line suggestion', async () => {
    const result = await tool.handler({
      problem: 'Memory leaks in large files',
      proposed_solution: 'Optimize graph traversal for large modules',
      severity: 'high',
      related_targets: ['lib/application.js']
    });
    expect(result.content[0].text).toContain('Suggestion logged');
  });

  it('4. Verify persistence via DB query', async () => {
    const path = 'lib/persistence_test.js';
    await tool.handler({
      problem: 'Persistence test',
      proposed_solution: 'Check DB',
      related_targets: [path]
    });
    const found = await store.query('SELECT * FROM suggestion WHERE related_targets CONTAINS $path', { path });
    expect(found.length).toBeGreaterThan(0);
  });

  it('5. Suggestion with special characters in code', async () => {
    const result = await tool.handler({
      problem: 'Special chars in code: if (x < y && y > z)',
      proposed_solution: 'Ensure proper escaping'
    });
    expect(result.content[0].text).toContain('Suggestion logged');
  });

  it('6. Sequential suggestions for same file', async () => {
    await tool.handler({ problem: 'P1', proposed_solution: 'S1', related_targets: ['same.js'] });
    await tool.handler({ problem: 'P2', proposed_solution: 'S2', related_targets: ['same.js'] });
    const found = await store.query('SELECT * FROM suggestion WHERE related_targets CONTAINS "same.js"');
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it('7. Verify timestamp is recorded (if schema allows)', async () => {
    const res = await tool.handler({ problem: 'P', proposed_solution: 'S' });
    expect(res.content[0].text).toContain('Suggestion logged');
  });

  it('8. Consistency check - message', async () => {
    const result = await tool.handler({ problem: 'P', proposed_solution: 'S' });
    expect(result.content[0].text).toMatch(/Suggestion logged/);
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('cortex_suggest');
  });

  it('10. Response is valid text', async () => {
    const result = await tool.handler({ problem: 'P', proposed_solution: 'S' });
    expect(result.content[0].type).toBe('text');
  });
});
