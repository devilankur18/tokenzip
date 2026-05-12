import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';
import path from 'path';
import fs from 'fs';

export const debugCommand = new Command('debug')
  .description('Debug indexing health and symbol extraction for a specific file')
  .argument('<file_path>', 'Relative path to the file')
  .action(async (filePath, options, command) => {
    const globalOptions = command.parent.opts();
    const { dbPath, repoPath } = resolveDbPath(globalOptions.cwd);
    const store = new SurrealStore(dbPath);
    await store.initialize();

    try {
      const allFiles = await store.query<any>('SELECT * FROM file WHERE path = $path OR string::ends_with(path, $path)', { path: filePath });
      const targetFile = allFiles[0];

      if (!targetFile) {
        console.error(`❌ Error: File "${filePath}" not found in database. Run "tokenzip parse" first.`);
        return;
      }

      console.log(`\n🔍 Debugging: ${targetFile.path}`);
      console.log(`| Property | Value |`);
      console.log(`| :--- | :--- |`);
      console.log(`| **Language** | ${targetFile.language} |`);
      console.log(`| **Size** | ${targetFile.size_bytes} bytes |`);
      console.log(`| **Lines** | ${targetFile.line_count} |`);
      console.log(`| **Parse Status** | ${targetFile.parse_status} |`);

      const symbols = await store.query<any>('SELECT * FROM symbol WHERE fileId = $fileId ORDER BY startLine ASC', { fileId: targetFile.id });
      
      console.log(`\n📊 Symbol Breakdown (${symbols.length} symbols found):`);
      if (symbols.length === 0) {
        console.warn('⚠️  NO SYMBOLS FOUND. The extractor may have failed or this file type is not supported.');
      } else {
        const kindCounts: Record<string, number> = {};
        let coveredLinesCount = 0;
        const coveredLines = new Set<number>();

        for (const sym of symbols) {
          kindCounts[sym.kind] = (kindCounts[sym.kind] || 0) + 1;
          for (let i = sym.startLine; i <= sym.endLine; i++) {
            coveredLines.add(i);
          }
        }

        console.log(`| Kind | Count |`);
        console.log(`| :--- | :--- |`);
        Object.entries(kindCounts).forEach(([kind, count]) => {
          console.log(`| ${kind} | ${count} |`);
        });

        const coverage = Math.round((coveredLines.size / targetFile.line_count) * 100);
        console.log(`\n**Structural Coverage**: ${coverage}% of lines are part of a symbol.`);
        
        if (coverage < 30 && targetFile.line_count > 50) {
          console.warn('⚠️  Low Coverage: Most of this file is outside of known functions/classes. This might be why savings are low.');
        }

        // Find large gaps
        const absPath = path.resolve(repoPath, targetFile.path);
        if (fs.existsSync(absPath)) {
          const content = fs.readFileSync(absPath, 'utf8');
          const lines = content.split('\n');
          const gaps: { start: number, end: number, length: number }[] = [];
          let currentGap: { start: number, end: number, length: number } | null = null;

          for (let i = 1; i <= lines.length; i++) {
            if (!coveredLines.has(i)) {
              if (!currentGap) currentGap = { start: i, end: i, length: 1 };
              else {
                currentGap.end = i;
                currentGap.length++;
              }
            } else {
              if (currentGap) {
                if (currentGap.length > 5) gaps.push(currentGap);
                currentGap = null;
              }
            }
          }
          if (currentGap && currentGap.length > 5) gaps.push(currentGap);

          if (gaps.length > 0) {
            console.log('\n🕵️  Largest Uncovered Blocks (potential optimization targets):');
            gaps.sort((a, b) => b.length - a.length).slice(0, 5).forEach(gap => {
              const preview = lines.slice(gap.start - 1, gap.start + 2).map(l => `  > ${l.trim().slice(0, 80)}`).join('\n');
              console.log(`- Lines ${gap.start}-${gap.end} (${gap.length} lines):\n${preview}\n  ...`);
            });
          }
        }
      }

    } catch (err) {
      console.error('Debug failed:', err);
    } finally {
      await store.close();
      process.exit(0);
    }
  });
