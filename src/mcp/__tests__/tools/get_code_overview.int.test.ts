import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createStructureTools } from '../../tools/structure.js';

describe('get_code_overview (Integration)', () => {
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
    tool = tools.find(t => t.name === 'get_code_overview');
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Get full codebase overview in tree format', async () => {
    const result = await tool.handler({ format: 'tree' });
    expect(result.content[0].text).toContain('🏠'); // Root icon
    expect(result.content[0].text).toContain('lib');
  });

  it('2. Get overview in JSON format', async () => {
    const result = await tool.handler({ format: 'json' });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure).toBeDefined();
    expect(data.structure.type).toBe('repository');
  });

  it('3. Focus on "lib/application.js" file', async () => {
    const result = await tool.handler({ path: 'lib/application.js', format: 'json', verbose: true });
    const data = JSON.parse(result.content[0].text);
    expect(data.structure.path).toBe('lib/application.js');
  });

  it('4. Depth control', async () => {
    const result = await tool.handler({ depth: 1, format: 'json' });
    const data = JSON.parse(result.content[0].text);
    // Immediate children should have no children themselves at depth 1
    const childrenWithChildren = data.structure.children.filter((c: any) => c.children && c.children.length > 0);
    expect(childrenWithChildren.length).toBe(0);
  });

  it('5. Error on non-existent path', async () => {
    const result = await tool.handler({ path: 'non/existent/path' });
    expect(result.isError).toBe(true);
  });

  it('6. Tool metadata check', async () => {
    expect(tool.name).toBe('get_code_overview');
  });
});
