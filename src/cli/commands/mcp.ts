import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';
import { registerTools } from '../../mcp/tools/registry.js';
import { TokenBudgetManager } from '../../mcp/token-budget.js';

export const mcpCommand = new Command('mcp')
  .description('Directly test MCP tools from the CLI')
  .argument('<tool>', 'Tool name (e.g., query_symbol, get_file_symbols)')
  .argument('[args...]', 'Arguments for the tool in key=value format (e.g., symbol_name=myFunc)')
  .option('--budget <tokens>', 'Token budget for the response', '8000')
  .addHelpText('after', `
Available Tools:
  query_repo_structure    Get file/module overview
  get_codebase_stats     Get high-level repository stats
  get_file_symbols       List symbols in a file (args: file_path=...)
  query_symbol           Lookup symbol definition (args: symbol_name=...)
  find_references        Find callers of a symbol (args: symbol_name=...)
  get_dependencies       Get import graph for a file (args: file_path=...)
  smart_file_read        Read semantic file projections (args: path=..., mode=...)

Examples:
  $ tokenzip mcp get_codebase_stats
  $ tokenzip mcp query_symbol symbol_name=createApp
  $ tokenzip mcp get_file_symbols file_path=src/index.ts
  $ tokenzip mcp find_references symbol_name=Indexer
  $ tokenzip mcp smart_file_read path=src/index.ts mode=skeleton
`)
  .action(async (toolName, argsArray, options, command) => {
    const globalOptions = command.parent.opts();
    const { dbPath, repoPath } = resolveDbPath(globalOptions.cwd);
    const store = new SurrealStore(dbPath);
    await store.initialize();

    try {
      const budget = new TokenBudgetManager(parseInt(options.budget, 10));
      const tools = registerTools(store, repoPath, budget);
      
      const tool = tools.find((t: any) => t.name === toolName);
      if (!tool) {
        console.error(`Error: Tool "${toolName}" not found.`);
        console.log('\nAvailable tools:');
        tools.forEach((t: any) => console.log(`  - ${t.name}`));
        await store.close();
        process.exit(1);
      }

      // Parse key=value arguments
      const args: any = {};
      if (argsArray) {
        argsArray.forEach((arg: string) => {
          const [key, ...rest] = arg.split('=');
          const value = rest.join('=');
          if (key && value) {
            args[key] = value;
          }
        });
      }

      console.log(`\n🚀 Invoking tool: ${toolName}`);
      if (Object.keys(args).length > 0) {
        console.log(`📦 Arguments: ${JSON.stringify(args, null, 2)}`);
      }
      console.log('---');

      const result = await tool.handler(args);
      
      if (result.isError) {
        console.error('❌ Tool execution failed:');
      }

      if (result.content && result.content[0]) {
        console.log(result.content[0].text);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }

    } catch (err) {
      console.error('Execution failed:', err);
    } finally {
      await store.close();
    }
  });
