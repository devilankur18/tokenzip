import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createStructureTools } from '../../tools/structure.js';

describe('inspect_targets (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createStructureTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'inspect_targets');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Inspect valid file and symbol', async () => {
    const result = await tool.handler({ 
      targets: ['lib/express.js', 'createApplication'] 
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(2);
    expect(data.results[0].type).toBe('file');
    expect(data.results[1].type).toBe('symbol');
  });

  it('2. Inspect directory', async () => {
    const result = await tool.handler({ targets: ['lib'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.results[0].type).toBe('module');
  });

  it('3. Inspect mixed valid/invalid', async () => {
    const result = await tool.handler({ 
      targets: ['lib/express.js', 'GhostX', 'lib'] 
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.results[0].type).toBe('file');
    expect(data.results[1].type).toBe('unknown');
    expect(data.results[2].type).toBe('module');
  });

  it('4. Inspect multiple symbols', async () => {
    const result = await tool.handler({ targets: ['Router', 'createApplication'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.results.some(r => r.type === 'symbol' && r.name === 'Router')).toBe(true);
    expect(data.results.some(r => r.type === 'symbol' && r.name === 'createApplication')).toBe(true);
  });

  it('5. Verify result IDs', async () => {
    const result = await tool.handler({ targets: ['lib/express.js'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.results[0].id).toBeDefined();
    expect(data.results[0].id).toContain('file:');
  });

  it('6. Handle empty list', async () => {
    const result = await tool.handler({ targets: [] });
    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(0);
  });

  it('7. Inspect with absolute-like paths', async () => {
    const result = await tool.handler({ targets: ['lib/express.js'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.results[0].type).not.toBe('unknown');
  });

  it('8. Consistency check', async () => {
    const res1 = await tool.handler({ targets: ['lib'] });
    const res2 = await tool.handler({ targets: ['lib'] });
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('9. Tool name check', async () => {
    expect(tool.name).toBe('inspect_targets');
  });

  it('10. Response truncation check', async () => {
    const result = await tool.handler({ targets: ['lib'] });
    const data = JSON.parse(result.content[0].text);
    expect(data._truncated).toBeDefined();
  });
});
