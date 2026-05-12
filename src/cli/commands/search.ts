import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';

export const searchCommand = new Command('search')
  .description('Search for symbols by name across the indexed codebase')
  .argument('<query>', 'Symbol name or partial name to search (case-insensitive)')
  .option('--limit <n>', 'Maximum number of results', '10')
  .addHelpText('after', `
Examples:
  $ tokenzip search useEffect              # Find all 'useEffect' usages
  $ tokenzip search handleAuth             # Partial match on any symbol
  $ tokenzip search db --limit 5          # Limit results

Output fields:
  SYMBOL      Symbol name
  KIND        function | class | method | variable | interface
  LOC         file:startLine-endLine
  SIG         First line of the function/class signature
  CALL_STACK_IN   Who calls this symbol
  CALL_STACK_OUT  What this symbol calls
  GIT_HISTORY     Recent commits touching this file
`)
  .action(async (query, options, command) => {
    const globalOptions = command.parent.opts();
    const { dbPath } = resolveDbPath(globalOptions.cwd);
    const store = new SurrealStore(dbPath);
    await store.initialize();

    try {
      const limit = parseInt(options.limit, 10);

      // Step 1: find matching symbols with file path + callers + callees
      const q = `
        SELECT 
          id, name, kind, signature, startLine, endLine, 
          fileId, isExported, docstring,
          (SELECT path FROM file WHERE id = $parent.fileId)[0].path AS filePath,
          (
            SELECT in.name AS name, 
                   (SELECT path FROM file WHERE id = $parent.in.fileId)[0].path AS file 
            FROM calls WHERE out = $parent.id
          ) AS callers,
          (
            SELECT out.name AS name,
                   (SELECT path FROM file WHERE id = $parent.out.fileId)[0].path AS file 
            FROM calls WHERE in = $parent.id
          ) AS callees
        FROM symbol 
        WHERE string::lowercase(name) CONTAINS string::lowercase($query)
        LIMIT $limit;
      `;

      const results = await store.query<any>(q, { query, limit });

      if (results.length === 0) {
        console.log(`No symbols found matching: "${query}"`);
        await store.close();
        return;
      }

      for (const sym of results) {
        // Step 2: fetch git history for this file separately (simpler query)
        const historyQ = `
          SELECT out.short_hash AS hash, out.message AS message, out.author AS author, out.date AS date
          FROM modified_in 
          WHERE in = $fileId
          ORDER BY date DESC
          LIMIT 5;
        `;
        const history = await store.query<any>(historyQ, { fileId: sym.fileId });

        // Format output
        const loc = `${sym.filePath ?? sym.fileId}:${sym.startLine}-${sym.endLine}`;
        const sig = sym.signature?.split('\n')[0] ?? '—';

        console.log(`SYMBOL: ${sym.name}`);
        console.log(`KIND: ${sym.kind}`);
        console.log(`LOC: ${loc}`);
        console.log(`SIG: ${sig}`);

        console.log(`CALL_STACK_IN (Callers):`);
        const callers = sym.callers?.filter((c: any) => c.name) ?? [];
        if (callers.length > 0) {
          callers.forEach((c: any) => console.log(`  - ${c.name} [${c.file ?? '?'}]`));
        } else {
          console.log(`  - None`);
        }

        console.log(`CALL_STACK_OUT (Internal Dependencies):`);
        const callees = sym.callees?.filter((c: any) => c.name) ?? [];
        if (callees.length > 0) {
          callees.forEach((c: any) => console.log(`  - ${c.name} [${c.file ?? '?'}]`));
        } else {
          console.log(`  - None`);
        }

        console.log(`DOCS_WORKFLOWS:`);
        console.log(`  - None`);

        console.log(`GIT_HISTORY:`);
        if (history && history.length > 0) {
          history.forEach((h: any) => {
            const shortHash = h.hash ?? '???????';
            const msg = (h.message ?? '').split('\n')[0];
            const author = h.author ?? '';
            console.log(`  - ${shortHash} ${msg} (${author})`);
          });
        } else {
          console.log(`  - None`);
        }

        console.log('---');
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      await store.close();
    }
  });
