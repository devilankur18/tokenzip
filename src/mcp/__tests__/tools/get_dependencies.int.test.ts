import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createSymbolTools } from '../../tools/symbol.js';

describe('get_dependencies (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createSymbolTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'get_dependencies');
  }, 60000);

  afterAll(async () => {
    // We don't close the store here because it's memoized/shared
  });

  it('1. Get dependencies for lib/express.js', async () => {
    const result = await tool.handler({ file_path: 'lib/express.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.dependencies.length).toBeGreaterThan(0);
    // Check for application.js dependency (either by path or name)
    expect(data.dependencies.some((d: any) => 
      (d.path && d.path.includes('application')) || 
      (d.name && d.name.includes('application'))
    )).toBe(true);
  });

  it('2. Get dependencies for lib/application.js', async () => {
    const result = await tool.handler({ file_path: 'lib/application.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.dependencies.length).toBeGreaterThan(5);
  });

  it('3. Error on non-existent file', async () => {
    const result = await tool.handler({ file_path: 'ghost.js' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('4. Dependencies for a deeply nested file', async () => {
    // Use a file that we know exists in the bench
    const result = await tool.handler({ file_path: 'lib/view.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.dependencies.length).toBeGreaterThan(0);
  });

  it('5. Verify dependency types', async () => {
    const result = await tool.handler({ file_path: 'lib/express.js' });
    const data = JSON.parse(result.content[0].text);
    expect(data.dependencies.length).toBeGreaterThan(0);
    expect(data.dependencies[0]).toHaveProperty('type');
  });

  it('6. Handle path normalization', async () => {
    const res1 = await tool.handler({ file_path: './lib/express.js' });
    const res2 = await tool.handler({ file_path: 'lib/express.js' });
    expect(res1.isError).toBeUndefined();
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('7. Performance check', async () => {
    const start = Date.now();
    await tool.handler({ file_path: 'lib/application.js' });
    expect(Date.now() - start).toBeLessThan(1000); // Increased timeout for integration
  });

  it('8. Consistency check', async () => {
    const res1 = await tool.handler({ file_path: 'lib/express.js' });
    const res2 = await tool.handler({ file_path: 'lib/express.js' });
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('get_dependencies');
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ file_path: 'lib/express.js' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
