import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';
import { ReportIndexer } from '../../engine/report-indexer.js';
import { ReportGenerator } from '../../engine/report-generator.js';
import path from 'path';
import fs from 'fs';

export const reportCommand = new Command('report')
  .description('Generate a token efficiency report (Markdown and CSV)')
  .option('-o, --output <file>', 'Markdown output file', 'report.md')
  .option('-c, --csv <file>', 'CSV output file', 'report.csv')
  .option('-d, --dir <path>', 'Filter by directory')
  .option('-t, --types <extensions>', 'Filter by file types (comma-separated)', (val) => val.split(','))
  .option('-r, --regex <pattern>', 'Filter by regex pattern')
  .option('--concurrency <number>', 'Number of parallel workers', (val) => parseInt(val))
  .action(async (options, command) => {
    const globalOptions = command.parent.opts();
    const { dbPath, repoPath } = resolveDbPath(globalOptions.cwd);
    const store = new SurrealStore(dbPath);
    await store.initialize();
    await store.migrate();

    try {
      console.log('📊 Generating Token Efficiency Report...');
      
      const reportIndexer = new ReportIndexer(store, repoPath, {
        directory: options.dir,
        types: options.types,
        regex: options.regex,
        concurrency: options.concurrency
      });

      const metrics = await reportIndexer.getMetrics();
      
      if (metrics.length === 0) {
        console.error('No files matched the filters or found in database.');
        return;
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
