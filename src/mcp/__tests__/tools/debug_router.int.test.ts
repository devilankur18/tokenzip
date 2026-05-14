import { setupIntegrationTest } from '../src/mcp/__tests__/test-setup.js';
import { createStructureTools } from '../src/mcp/tools/structure.js';

async function main() {
  const setup = await setupIntegrationTest();
  const tools = createStructureTools(setup.store, setup.repoPath, setup.budget);
  const tool = tools.find(t => t.name === 'get_file_symbols');
  const result = await tool.handler({ file_path: 'lib/router.js' });
  console.log('RESULT:', result.content[0].text);
  await setup.store.close();
}

main().catch(console.error);
