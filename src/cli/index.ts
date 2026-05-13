#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { initCommand } from './commands/init.js';
import { parseCommand } from './commands/parse.js';
import { serveCommand } from './commands/serve.js';
import { resetCommand } from './commands/reset.js';
import { searchCommand } from './commands/search.js';
import { readSymbolCommand } from './commands/read-symbol.js';
import { smartReadCommand } from './commands/smart-read.js';
import { mcpCommand } from './commands/mcp.js';
import { reportCommand } from './commands/report.js';
import { doctorCommand } from './commands/doctor.js';
import { debugCommand } from './commands/debug.js';
import { statsCommand } from './commands/stats.js';

const program = new Command();

program
  .name('tokenzip')
  .description(
    'TokenZip v2 — Transform any codebase into a queryable knowledge graph.\n' +
    'Search symbols, trace call stacks, and expose your repo to AI copilots via MCP.\n\n' +
    'Quick start:\n' +
    '  tokenzip init      Initialize in current directory\n' +
    '  tokenzip parse     Index the codebase\n' +
    '  tokenzip search    Search for any symbol\n' +
    '  tokenzip mcp       Directly test MCP tools\n' +
    '  tokenzip serve     Start the MCP server for AI copilots'
  )
  .version('2.0.0')
  .option('--cwd <dir>', 'Working directory', process.env.TOKENZIP_CWD || process.cwd())
  .hook('preAction', (thisCommand) => {
    const cwd = thisCommand.opts().cwd;
    console.error(`📂 Working Directory: ${path.resolve(cwd)}`);
  });

program.addCommand(initCommand);
program.addCommand(parseCommand);
program.addCommand(serveCommand);
program.addCommand(resetCommand);
program.addCommand(searchCommand);
program.addCommand(readSymbolCommand);
program.addCommand(smartReadCommand);
program.addCommand(mcpCommand);
program.addCommand(doctorCommand);
program.addCommand(reportCommand);
program.addCommand(debugCommand);
program.addCommand(statsCommand);

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});

