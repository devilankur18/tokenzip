import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createFetchMetadataTools } from '../../tools/fetch-metadata.js';

describe('fetch_symbol_metadata (Integration)', () => {
  let store: any;
  let repoPath: string;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    repoPath = setup.repoPath;
    budget = setup.budget;
    const tools = createFetchMetadataTools(store, budget);
    tool = tools[0];
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  async function getSymbolId(name: string): Promise<string> {
    const res = await store.query('SELECT id FROM symbol WHERE name = $name LIMIT 1', { name });
    return res[0]?.id?.toString();
  }

  it('1. Fetch metadata for "createApplication"', async () => {
    const id = await getSymbolId('createApplication');
    expect(id).toBeDefined();
    const result = await tool.handler({ ids: [id] });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols).toHaveLength(1);
    expect(data.symbols[0].name).toBe('createApplication');
  });

  it('2. Fetch multiple IDs', async () => {
    const id1 = await getSymbolId('createApplication');
    const id2 = await getSymbolId('Router');
    const result = await tool.handler({ ids: [id1, id2].filter(Boolean) });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols.length).toBeGreaterThanOrEqual(1);
  });

  it('3. Error on empty IDs', async () => {
    const result = await tool.handler({ ids: [] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No IDs provided');
  });

  it('4. Non-existent ID', async () => {
    const result = await tool.handler({ ids: ['symbol:ghost_123'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols).toHaveLength(0);
  });

  it('5. Verify result fields', async () => {
    const id = await getSymbolId('createApplication');
    const result = await tool.handler({ ids: [id] });
    const data = JSON.parse(result.content[0].text);
    const sym = data.symbols[0];
    expect(sym.name).toBeDefined();
    expect(sym.kind).toBeDefined();
  });

  it('6. Tool metadata check', async () => {
    expect(tool.name).toBe('fetch_symbol_metadata');
  });

  it('7. Response is valid JSON', async () => {
    const id = await getSymbolId('app');
    const result = await tool.handler({ ids: [id].filter(Boolean) });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
