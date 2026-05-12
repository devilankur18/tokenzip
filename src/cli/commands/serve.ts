import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { createMcpServer } from '../../mcp/server.js';
import { resolveDbPath } from '../resolve-db.js';

export const serveCommand = new Command('serve')
  .description('Start the TokenZip MCP server (exposes the graph to AI copilots)')
  .addHelpText('after', `
Examples:
  $ tokenzip serve                          # Serve the current directory
  $ tokenzip serve --cwd /path/to/repo      # Serve a specific repo

AI Copilot config (Claude Desktop):
  {
    "mcpServers": {
      "tokenzip": {
        "command": "tokenzip",
        "args": ["serve", "--cwd", "/path/to/repo"]
      }
    }
  }
`)
  .action(async (options) => {
    const { dbPath, repoPath } = resolveDbPath(options.cwd);
    const store = new SurrealStore(dbPath);
    await store.initialize();
    
    // We assume parse has already run or at least db schema exists.
    // So we don't clear/migrate here by default, or maybe just migrate to be safe.
    await store.migrate();

    const server = await createMcpServer(store, repoPath);
    console.error(`TokenZip MCP Server running on stdio for ${repoPath}`);

    process.on('SIGINT', async () => {
      await server.close();
      await store.close();
      process.exit(0);
    });
  });
