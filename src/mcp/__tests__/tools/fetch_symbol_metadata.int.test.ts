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
    const tools = createFetchMetadataTools(store, repoPath, budget);
    tool = tools[0];
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Fetch metadata for "createApplication"', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata).toHaveLength(1);
    expect(data.metadata[0].kind).toBe('function');
  });

  it('2. Fetch metadata for "Router"', async () => {
    const result = await tool.handler({ symbol_name: 'Router' });
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata.length).toBeGreaterThan(0);
  });

  it('3. Filter by file_path for "app"', async () => {
    const result = await tool.handler({ 
      symbol_name: 'app', 
      file_path: 'lib/express.js' 
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata).toHaveLength(1);
  });

  it('4. Search for common symbol name "handle"', async () => {
    const result = await tool.handler({ symbol_name: 'handle' });
    const data = JSON.parse(result.content[0].text);
    // Express has multiple 'handle' methods
    expect(data.metadata.length).toBeGreaterThan(1);
  });

  it('5. Non-existent symbol', async () => {
    const result = await tool.handler({ symbol_name: 'GhostSymbolX' });
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata).toHaveLength(0);
  });

  it('6. Verify JSDoc presence for "application"', async () => {
    const result = await tool.handler({ symbol_name: 'app' });
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata.some((m: any) => m.docstring)).toBe(true);
  });

  it('7. Verify signature for "createApplication"', async () => {
    const result = await tool.handler({ symbol_name: 'createApplication' });
    const data = JSON.parse(result.content[0].text);
    expect(data.metadata[0].signature).toContain('function createApplication');
  });

  it('8. Consistency across calls', async () => {
    const res1 = await tool.handler({ symbol_name: 'Router' });
    const res2 = await tool.handler({ symbol_name: 'Router' });
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('9. Tool description check', async () => {
    expect(tool.description).toContain('signatures');
  });

  it('10. Response format is valid JSON', async () => {
    const result = await tool.handler({ symbol_name: 'app' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
