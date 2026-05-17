import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';
import { registerTools } from '../../mcp/tools/registry.js';
import { TokenBudgetManager } from '../../mcp/token-budget.js';

export const mcpCommand = new Command('mcp')
  .description('Directly test MCP tools from the CLI')
  .argument('<tool>', 'Tool name (e.g., code_snapshot, query_symbol)')
  .argument('[args...]', 'Arguments for the tool (e.g., path=src or --mode=skeleton)')
  .option('--budget <tokens>', 'Token budget for the response', '8000')
  .allowUnknownOption()
  .addHelpText('after', `
Available Tools (Recall Kit V2):
  code_snapshot          Get semantic repository map (path=...)
  code_search            Unified semantic search (query=...)
  code_read              Read semantic projections (path=..., mode=...)
  code_trace_flow        Trace execution flow (target=...)
  code_insight           Manage persistent memory (action=...)

Legacy Tools (for comparison):
  get_code_overview      Get semantic repository map
  get_file_tree          Get hierarchical file tree
  query_symbol           Lookup symbol definition
  find_references        Find callers of a symbol
  smart_file_read        Read semantic file projections

Examples:
  $ tokenzip mcp code_snapshot path=src
  $ tokenzip mcp code_search query=createApp
  $ tokenzip mcp code_read path=src/index.ts mode=skeleton
`)
  .action(async (toolName, argsArray, options, command) => {
    const globalOptions = command.parent.opts();
    const { dbPath, repoPath } = resolveDbPath(globalOptions.cwd);
    const store = new SurrealStore(dbPath);
    await store.initialize();

    try {
      const budget = new TokenBudgetManager(parseInt(options.budget, 10));
      // Include legacy tools for comparison in the CLI
      const tools = registerTools(store, repoPath, budget, true);
      
      const tool = tools.find((t: any) => t.name === toolName);
      if (!tool) {
        console.error(`Error: Tool "${toolName}" not found.`);
        console.log('\nAvailable tools:');
        tools.forEach((t: any) => console.log(`  - ${t.name}`));
        await store.close();
        process.exit(1);
      }

      // Parse arguments: handle JSON string OR key=value/--key=value
      const args: any = {};
      
      const rawArgs = process.argv.slice(process.argv.indexOf(toolName) + 1);
      
      // Try parsing as single JSON object first
      if (rawArgs.length === 1 && rawArgs[0].startsWith('{')) {
        try {
          Object.assign(args, JSON.parse(rawArgs[0]));
        } catch (err) {
          console.error('Warning: Failed to parse argument as JSON, falling back to key=value parsing.');
        }
      }

      if (Object.keys(args).length === 0) {
        for (let i = 0; i < rawArgs.length; i++) {
          const arg = rawArgs[i];
          
          if (arg.includes('=')) {
            const cleanArg = arg.startsWith('--') ? arg.slice(2) : arg;
            const [key, ...rest] = cleanArg.split('=');
            args[key] = rest.join('=');
          } else if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const nextArg = rawArgs[i + 1];
            if (nextArg && !nextArg.startsWith('--')) {
              args[key] = nextArg;
              i++;
            } else {
              args[key] = "true";
            }
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
