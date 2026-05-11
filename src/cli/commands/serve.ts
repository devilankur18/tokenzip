import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { createMcpServer } from '../../mcp/server.js';
import path from 'path';

export const serveCommand = new Command('serve')
  .description('Start the TokenZip MCP Server')
  .option('--cwd <dir>', 'Working directory', process.cwd())
  .action(async (options) => {
    const repoPath = path.resolve(options.cwd);
    const dbPath = path.join(repoPath, '.tokenzip/db');

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
