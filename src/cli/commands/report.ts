import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';
import { calculateAllMetrics, executeStrategy } from '../../mcp/tools/smart-file-read.js';
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

      const concurrency = 50;
      const chunks = [];
      for (let i = 0; i < files.length; i += concurrency) {
        chunks.push(files.slice(i, i + concurrency));
      }

      console.log(`\nFound ${files.length} files. Processing in chunks of ${concurrency}...`);

      for (const chunk of chunks) {
        // Fetch all symbols for the chunk to minimize DB roundtrips
        const fileIds = chunk.map((f: any) => f.id);
        const allSymbols = await store.query<any>('SELECT * FROM symbol WHERE fileId IN $fileIds ORDER BY startLine ASC', { fileIds });
        
        // console.log(`Chunk: ${chunk.length} files, ${allSymbols.length} symbols fetched.`);

        // Fetch all calls for these symbols in one go
        const allSymIds = allSymbols.map(s => s.id);
        const allCalls = await store.query<any>('SELECT in, metadata.targetName as target FROM calls WHERE in IN $allSymIds', { allSymIds });

        // Group symbols by fileId
        const symbolMap = new Map<string, any[]>();
        for (const sym of allSymbols) {
          const fid = sym.fileId.toString();
          if (!symbolMap.has(fid)) symbolMap.set(fid, []);
          symbolMap.get(fid)!.push(sym);
        }

        // Group calls by symbolId
        const callsMap = new Map<string, string[]>();
        for (const call of allCalls) {
          const inId = call.in.toString();
          if (!callsMap.has(inId)) callsMap.set(inId, []);
          if (call.target) callsMap.get(inId)!.push(call.target);
        }

        await Promise.all(chunk.map(async (file: any) => {
          const absPath = path.resolve(repoPath, file.path);
          if (!fs.existsSync(absPath)) return;

          try {
            const content = fs.readFileSync(absPath, 'utf8');
            const naiveTokens = budget.estimate(content);
            const folder = path.dirname(file.path);
            const fileIdStr = file.id.toString();
            const fileSymbols = symbolMap.get(fileIdStr) || [];
            
            // Execute strategies with pre-fetched symbols
            const [iRes, sRes, dRes] = await Promise.all([
              executeStrategy('interface_only', file.path, absPath, file.id, store, undefined, budget, 4000, false, fileSymbols),
              executeStrategy('skeleton', file.path, absPath, file.id, store, undefined, budget, 4000, false, fileSymbols),
              // We'll calculate dependency tokens manually here to use pre-fetched calls
              (async () => {
                const callGraph: string[] = [];
                for (const sym of fileSymbols) {
                  if (!["function", "method", "class"].includes(sym.kind)) continue;
                  const targets = callsMap.get(sym.id.toString());
                  if (targets && targets.length > 0) {
                    const uniqueTargets = [...new Set(targets)].slice(0, 5).join(', ');
                    callGraph.push(`// ${sym.kind} '${sym.name}' calls: ${uniqueTargets}`);
                  }
                }
                const lines = content.split('\n');
                const imports = lines.filter(l => l.trim().startsWith('import') || l.trim().startsWith('require('));
                const exports = lines.filter(l => l.trim().startsWith('export '));
                const dContent = ['// --- IMPORTS ---', ...imports, '', '// --- CALL GRAPH ---', ...callGraph, '', '// --- EXPORTS ---', ...exports].join('\n');
                return { content: dContent };
              })()
            ]);

            metrics.push({
              path: file.path,
              folder: folder === '.' ? '/' : folder,
              naiveTokens,
              interfaceTokens: budget.estimate(iRes.content),
              skeletonTokens: budget.estimate(sRes.content),
              dependencyTokens: budget.estimate(dRes.content),
              interfaceSaving: naiveTokens > 0 ? Math.floor(((naiveTokens - budget.estimate(iRes.content)) / naiveTokens) * 100) : 0,
              skeletonSaving: naiveTokens > 0 ? Math.floor(((naiveTokens - budget.estimate(sRes.content)) / naiveTokens) * 100) : 0
            });
          } catch (e: any) {
            // Skip problematic files in report
          } finally {
            processed++;
            if (processed % 50 === 0 || processed === files.length) {
              process.stdout.write(`\r   Progress: ${processed}/${files.length} files...`);
            }
          }
        }));
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
