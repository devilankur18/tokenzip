import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';
import { readCodeRange } from '../../utils/code-reader.js';
import path from 'path';

export const readSymbolCommand = new Command('read-symbol')
  .description('Fetch the full source code for a specific symbol')
  .argument('<symbol_name>', 'Name of the symbol to read')
  .option('--id <id>', 'Specific symbol ID if multiple matches exist')
  .action(async (symbolName, options, command) => {
    const globalOptions = command.parent.opts();
    const { dbPath, cwd } = resolveDbPath(globalOptions.cwd);
    const store = new SurrealStore(dbPath);
    await store.initialize();

    try {
      let q = `
        SELECT 
          id, name, kind, startLine, endLine, 
          (SELECT path FROM file WHERE id = $parent.fileId)[0].path AS filePath
        FROM symbol 
        WHERE name = $name
      `;
      
      if (options.id) {
        q += ' AND id = $id';
      }
      
      const results = await store.query<any>(q, { name: symbolName, id: options.id });

      if (results.length === 0) {
        console.log(`No symbol found matching: "${symbolName}"${options.id ? ` with ID ${options.id}` : ''}`);
        return;
      }

      if (results.length > 1 && !options.id) {
        console.log(`Multiple symbols found with name "${symbolName}". Use --id to specify:`);
        results.forEach(s => console.log(`  - ${s.id} (${s.kind} in ${s.filePath})`));
        return;
      }

      const sym = results[0];
      const absolutePath = path.resolve(cwd, sym.filePath);
      
      try {
        const code = readCodeRange(absolutePath, { 
          startLine: sym.startLine, 
          endLine: sym.endLine 
        });
        
        console.log(`--- SOURCE: ${sym.filePath}:${sym.startLine}-${sym.endLine} ---`);
        console.log(code);
        console.log(`--- END SOURCE ---`);
      } catch (err: any) {
        console.error(`Failed to read source: ${err.message}`);
      }

    } catch (err) {
      console.error('Read-symbol failed:', err);
    } finally {
      await store.close();
    }
  });
