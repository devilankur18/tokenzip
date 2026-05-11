import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { parseCommand } from './commands/parse.js';
import { serveCommand } from './commands/serve.js';
import { resetCommand } from './commands/reset.js';

const program = new Command();

program
  .name('tokenzip')
  .description('TokenZip v2 - Your codebase as a queryable graph')
  .version('1.0.0');

program.addCommand(initCommand);
program.addCommand(parseCommand);
program.addCommand(serveCommand);
program.addCommand(resetCommand);

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});
