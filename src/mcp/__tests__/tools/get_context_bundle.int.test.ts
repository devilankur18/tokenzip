import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createContextTools } from '../../tools/context.js';

describe('get_context_bundle (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createContextTools(store, repoPath, budget);
    tool = tools.find(t => t.name === 'get_context_bundle');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Get context for "createApplication"', async () => {
    const result = await tool.handler({ target: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols.length).toBeGreaterThan(0);
    expect(data.references.length).toBeGreaterThan(0);
  });

  it('2. Get context for "Router" with depth 2', async () => {
    const result = await tool.handler({ target: 'Router', depth: 2 });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols.length).toBeGreaterThan(1);
  });

  it('3. Error on non-existent target', async () => {
    const result = await tool.handler({ target: 'GhostTarget' });
    expect(result.content[0].text).toContain('not found');
  });

  it('4. Context for internal method "init"', async () => {
    const result = await tool.handler({ target: 'init' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols.length).toBeGreaterThan(0);
  });

  it('5. Verify result fields: symbols, references, _token_count', async () => {
    const result = await tool.handler({ target: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols).toBeDefined();
    expect(data.references).toBeDefined();
    expect(data._token_count).toBeGreaterThan(0);
  });

  it('6. Verify symbol metadata in bundle', async () => {
    const result = await tool.handler({ target: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    const first = data.symbols[0];
    expect(first.name).toBeDefined();
    expect(first.kind).toBeDefined();
  });

  it('7. Large context check (smoke test)', async () => {
    const result = await tool.handler({ target: 'Router', depth: 3 });
    const data = JSON.parse(result.content[0].text);
    expect(data._truncated).toBeDefined();
  });

  it('8. Consistency across calls', async () => {
    const res1 = await tool.handler({ target: 'createApplication' });
    const res2 = await tool.handler({ target: 'createApplication' });
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('get_context_bundle');
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ target: 'express' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
