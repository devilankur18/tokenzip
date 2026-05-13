import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';
import { registerTools } from '../../mcp/tools/registry.js';
import { TokenBudgetManager } from '../../mcp/token-budget.js';

export const mcpCommand = new Command('mcp')
  .description('Directly test MCP tools from the CLI')
  .argument('<tool>', 'Tool name (e.g., query_symbol, get_file_symbols)')
  .argument('[args...]', 'Arguments for the tool (e.g., symbol_name=myFunc or --path=src)')
  .option('--budget <tokens>', 'Token budget for the response', '8000')
  .allowUnknownOption()
  .addHelpText('after', `
Available Tools:
  get_code_overview      Get semantic repository map
  get_file_tree          Get hierarchical file tree
  get_codebase_stats     Get high-level repository stats
  query_symbol           Lookup symbol definition (args: symbol_name=...)
  find_references        Find callers of a symbol (args: symbol_name=...)
  smart_file_read        Read semantic file projections (args: path=..., mode=...)

Examples:
  $ tokenzip mcp get_code_overview --path=src --depth=2
  $ tokenzip mcp query_symbol symbol_name=createApp
  $ tokenzip mcp smart_file_read --path=src/index.ts --mode=skeleton
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

      // Parse arguments: handle both key=value and --key=value
      const args: any = {};
      
      // Get all raw arguments from process.argv after the tool name
      const rawArgs = process.argv.slice(process.argv.indexOf(toolName) + 1);
      
      for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i];
        
        if (arg.includes('=')) {
          // Handles key=value and --key=value
          const cleanArg = arg.startsWith('--') ? arg.slice(2) : arg;
          const [key, ...rest] = cleanArg.split('=');
          args[key] = rest.join('=');
        } else if (arg.startsWith('--')) {
          // Handles --key value
          const key = arg.slice(2);
          const nextArg = rawArgs[i + 1];
          if (nextArg && !nextArg.startsWith('--')) {
            args[key] = nextArg;
            i++; // skip next
          } else {
            args[key] = "true"; // boolean flag
          }
        }
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
