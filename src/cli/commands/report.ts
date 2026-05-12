import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';
import { executeStrategy } from '../../mcp/tools/smart-file-read.js';
import { TokenBudgetManager } from '../../mcp/token-budget.js';
import { ReportGenerator, FileMetric } from '../../engine/report-generator.js';
import path from 'path';
import fs from 'fs';

export const reportCommand = new Command('report')
  .description('Generate a token efficiency report (Markdown and CSV)')
  .option('-o, --output <file>', 'Markdown output file', 'report.md')
  .option('-c, --csv <file>', 'CSV output file', 'report.csv')
  .action(async (options, command) => {
    const globalOptions = command.parent.opts();
    const { dbPath, repoPath } = resolveDbPath(globalOptions.cwd);
    const store = new SurrealStore(dbPath);
    await store.initialize();

    try {
      console.log('📊 Generating Token Efficiency Report...');
      
      const files = await store.query<any>('SELECT id, path FROM file');
      if (files.length === 0) {
        console.error('No files found in database. Run "tokenzip parse" first.');
        return;
      }

      const budget = new TokenBudgetManager();
      const metrics: FileMetric[] = [];
      let processed = 0;

      for (const file of files) {
        const absPath = path.resolve(repoPath, file.path);
        if (!fs.existsSync(absPath)) continue;

        const content = fs.readFileSync(absPath, 'utf8');
        const naiveTokens = budget.estimate(content);
        const folder = path.dirname(file.path);

        // Execute strategies
        const [interfaceRes, skeletonRes, dependencyRes] = await Promise.all([
          executeStrategy('interface_only', file.path, absPath, file.id, store, undefined, budget, 10000, false),
          executeStrategy('skeleton', file.path, absPath, file.id, store, undefined, budget, 10000, false),
          executeStrategy('dependency_only', file.path, absPath, file.id, store, undefined, budget, 10000, false)
        ]);

        const iUsed = interfaceRes.tokensUsed || 0;
        const sUsed = skeletonRes.tokensUsed || 0;
        const dUsed = dependencyRes.tokensUsed || 0;

        metrics.push({
          path: file.path,
          folder: folder === '.' ? '/' : folder,
          naiveTokens,
          interfaceTokens: iUsed,
          skeletonTokens: sUsed,
          dependencyTokens: dUsed,
          interfaceSaving: naiveTokens > 0 ? Math.floor(((naiveTokens - iUsed) / naiveTokens) * 100) : 0,
          skeletonSaving: naiveTokens > 0 ? Math.floor(((naiveTokens - sUsed) / naiveTokens) * 100) : 0
        });

        processed++;
        if (processed % 10 === 0 || processed === files.length) {
          process.stdout.write(`\r   Progress: ${processed}/${files.length} files...`);
        }
      }

      console.log('\n✨ Analysis complete. Generating files...');

      const generator = new ReportGenerator(path.basename(repoPath));
      const md = generator.generateMarkdown(metrics);
      const csv = generator.generateCSV(metrics);

      const outDir = path.join(repoPath, '.tokenzip');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const mdPath = path.resolve(outDir, options.output);
      const csvPath = path.resolve(outDir, options.csv);

      fs.writeFileSync(mdPath, md);
      fs.writeFileSync(csvPath, csv);

      console.log(`\n✅ Report generated:`);
      console.log(`   Markdown: ${mdPath}`);
      console.log(`   CSV:      ${csvPath}`);

    } catch (err) {
      console.error('\nReport generation failed:', err);
    } finally {
      await store.close();
      process.exit(0);
    }
  });
