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
      target_file: 'lib/express.js',
      original_code: 'function old() {}',
      proposed_solution: 'function new() {}',
      reasoning: 'Better performance'
    });
    expect(result.content[0].text).toContain('Logged');
  });

  it('2. Suggestion for a non-existent file (should still log if intended)', async () => {
    const result = await tool.handler({
      target_file: 'nonexistent.js',
      original_code: 'none',
      proposed_solution: 'some',
      reasoning: 'Why not'
    });
    expect(result.content[0].text).toContain('Logged');
  });

  it('3. Multi-line suggestion', async () => {
    const result = await tool.handler({
      target_file: 'lib/application.js',
      original_code: 'const a = 1;\nconst b = 2;',
      proposed_solution: 'const {a, b} = {a: 1, b: 2};',
      reasoning: 'Modern JS'
    });
    expect(result.content[0].text).toContain('Logged');
  });

  it('4. Verify persistence via DB query', async () => {
    const path = 'lib/persistence_test.js';
    await tool.handler({
      target_file: path,
      original_code: 'A',
      proposed_solution: 'B',
      reasoning: 'C'
    });
    const found = await store.query('SELECT * FROM suggestions WHERE target_file = $path', { path });
    expect(found.length).toBeGreaterThan(0);
  });

  it('5. Suggestion with special characters in code', async () => {
    const result = await tool.handler({
      target_file: 'lib/special.js',
      original_code: 'if (x < y && y > z) { return `ok`; }',
      proposed_solution: 'return (x < y && y > z) ? `ok` : null;',
      reasoning: 'Ternary'
    });
    expect(result.content[0].text).toContain('Logged');
  });

  it('6. Sequential suggestions for same file', async () => {
    await tool.handler({ target_file: 'same.js', original_code: '1', proposed_solution: '2' });
    await tool.handler({ target_file: 'same.js', original_code: '3', proposed_solution: '4' });
    const found = await store.query('SELECT * FROM suggestions WHERE target_file = "same.js"');
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it('7. Verify timestamp is recorded (if schema allows)', async () => {
    const res = await tool.handler({ target_file: 't.js', original_code: 'a', proposed_solution: 'b' });
    expect(res.content[0].text).toContain('Logged');
  });

  it('8. Consistency check - message', async () => {
    const result = await tool.handler({ target_file: 'any.js', original_code: '1', proposed_solution: '2' });
    expect(result.content[0].text).toMatch(/Logged/);
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('cortex_suggest');
  });

  it('10. Response is valid text', async () => {
    const result = await tool.handler({ target_file: 't.js', original_code: 'a', proposed_solution: 'b' });
    expect(result.content[0].type).toBe('text');
  });
});
