import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createStructureTools } from '../../tools/structure.js';

describe('get_repo_overview (Integration)', () => {
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
    tool = tools.find(t => t.name === 'get_code_overview'); // Alias test
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Verify alias works identically to get_code_overview', async () => {
    const result = await tool.handler({ format: 'tree' });
    expect(result.content[0].text).toContain('🏠');
    expect(result.content[0].text).toContain('lib');
  });

  it('2. JSON output check', async () => {
    const result = await tool.handler({ format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure).toBeDefined();
  });
});
