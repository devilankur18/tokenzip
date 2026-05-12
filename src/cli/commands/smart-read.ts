import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';
import { executeStrategy } from '../../mcp/tools/smart-file-read.js';
import { TokenBudgetManager } from '../../index.js';
import path from 'path';

export const smartReadCommand = new Command('smart-read')
  .description('Read a file using a smart projection strategy (interface, skeleton, etc.)')
  .argument('<file_paths...>', 'Relative paths to one or more files')
  .option('-m, --mode <mode>', 'Projection mode: interface_only, skeleton, dependency_only, implementation_of', 'skeleton')
  .option('-s, --symbol <name>', 'Target symbol name (required for implementation_of)')
  .option('-t, --tokens <count>', 'Token budget per file', '8000')
  .option('--docs', 'Include JSDoc/comments in output', false)
  .action(async (filePaths, options, command) => {
    const globalOptions = command.parent.opts();
    const { dbPath, repoPath } = resolveDbPath(globalOptions.cwd);
    const store = new SurrealStore(dbPath);
    await store.initialize();

    try {
      const budget = new TokenBudgetManager();
      const maxTokens = parseInt(options.tokens);
      const fs = await import('fs');

      for (const filePath of filePaths) {
        // Find the fileId in DB
        const allFiles = await store.query<any>('SELECT id, path FROM file');
        const targetFile = allFiles.find((f: any) => f.path === filePath || f.path.endsWith(filePath));
        
        if (!targetFile) {
          console.error(`Error: File "${filePath}" not found in database.`);
          continue;
        }

        const fileId = targetFile.id;
        const absPath = path.resolve(repoPath, targetFile.path);

        console.log(`\n--- SMART READ: ${targetFile.path} (mode: ${options.mode}) ---`);
        
        const result = await executeStrategy(
          options.mode as any,
          targetFile.path,
          absPath,
          fileId,
          store,
          options.symbol || null,
          budget,
          maxTokens,
          options.docs
        );

        console.log(result.content);
        
        const originalContent = fs.readFileSync(absPath, 'utf8');
        const naiveTok = budget.estimate(originalContent);
        const usedTok = result.tokensUsed ?? 0;
        const saving = naiveTok > 0 ? Math.max(0, Math.floor(((naiveTok - usedTok) / naiveTok) * 100)) : 0;
        
        console.log(`--- END ${targetFile.path} (Tokens used: ${usedTok}/${naiveTok}, ${saving}% saving) ---`);
      }

    } catch (err) {
      console.error('Smart-read failed:', err);
    } finally {
      await store.close();
      process.exit(0);
    }
  });
