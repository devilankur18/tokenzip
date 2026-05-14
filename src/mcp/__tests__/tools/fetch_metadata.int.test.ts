import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createFetchMetadataTools } from '../../tools/fetch-metadata.js';

describe('fetch_metadata (Integration)', () => {
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
    tool = tools.find(t => t.name === 'fetch_symbol_metadata');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Fetch metadata for valid symbol IDs', async () => {
    // First find some IDs
    const symbols = await store.query('SELECT id, name FROM symbol WHERE name = "createApplication" LIMIT 1');
    const id = symbols[0].id.toString();

    const result = await tool.handler({ ids: [id] });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.symbols).toHaveLength(1);
    expect(data.symbols[0].name).toBe('createApplication');
    expect(data.symbols[0].kind).toBeDefined();
  });

  it('2. Fetch metadata for multiple IDs', async () => {
    const symbols = await store.query('SELECT id, name FROM symbol LIMIT 2');
    const ids = symbols.map((s: any) => s.id.toString());

    const result = await tool.handler({ ids });
    const data = JSON.parse(result.content[0].text);
    
    expect(data.symbols.length).toBeLessThanOrEqual(2);
    if (data.symbols.length > 0) {
      expect(data.symbols[0].name).toBeDefined();
    }
  });

  it('3. Handle non-existent ID', async () => {
    const result = await tool.handler({ ids: ['symbol:nonexistent_123'] });
    const data = JSON.parse(result.content[0].text);
    expect(data.symbols).toHaveLength(0);
    expect(data.count).toBe(0);
  });

  it('4. Handle empty ID list', async () => {
    const result = await tool.handler({ ids: [] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No IDs provided');
  });

  it('5. Verify result fields', async () => {
    const symbols = await store.query('SELECT id FROM symbol LIMIT 1');
    const id = symbols[0].id.toString();

    const result = await tool.handler({ ids: [id] });
    const data = JSON.parse(result.content[0].text);
    
    const sym = data.symbols[0];
    expect(sym).toHaveProperty('name');
    expect(sym).toHaveProperty('kind');
    // docstring and metadata might be null but field should exist if queried
  });

  it('6. Tool metadata check', async () => {
    expect(tool.name).toBe('fetch_symbol_metadata');
    expect(tool.description).toContain('documentation');
  });

  it('7. Budget truncation check', async () => {
    // Fetch many symbols to trigger budget (though metadata is small)
    const symbols = await store.query('SELECT id FROM symbol LIMIT 100');
    const ids = symbols.map((s: any) => s.id.toString());
    
    const result = await tool.handler({ ids });
    const data = JSON.parse(result.content[0].text);
    expect(data._token_count).toBeDefined();
  });

  it('8. Handle invalid ID format', async () => {
    // SurrealDB might throw on invalid RecordId format if it doesn't match table:id
    const result = await tool.handler({ ids: ['invalid-id'] });
    // Based on implementation, it might throw or just fail query
    expect(result.content).toBeDefined();
  });

  it('9. Verify count matches results', async () => {
    const symbols = await store.query('SELECT id FROM symbol LIMIT 3');
    const ids = symbols.map((s: any) => s.id.toString());

    const result = await tool.handler({ ids });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(data.symbols.length);
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ ids: [] }); // Error case
    expect(result.content[0].text).toBeDefined();
    
    const symbols = await store.query('SELECT id FROM symbol LIMIT 1');
    const validResult = await tool.handler({ ids: [symbols[0].id.toString()] });
    expect(() => JSON.parse(validResult.content[0].text)).not.toThrow();
  });
});
