import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';
import { GitUtils } from '../../utils/git-utils.js';

export const cortexCommand = new Command('cortex')
  .description('Manage Context Memory (Cortex) annotations and knowledge');

cortexCommand.command('status')
  .description('List and verify Context Memory annotations, highlighting any stale notes')
  .action(async (options, command) => {
    const globalOptions = command.parent?.parent?.opts() || command.parent?.opts() || {};
    const cwd = globalOptions.cwd || process.cwd();
    const { dbPath, repoPath } = resolveDbPath(cwd);

    const store = new SurrealStore(dbPath);
    await store.initialize();
    
    const repoName = GitUtils.getRepoName(repoPath);
    console.log(`\n🧠 Cortex Memory Status: ${repoName}`);

    try {
      const res = await store.db.query<any[][]>(`
        SELECT id, title, category, priority, target_hash,
        (SELECT VALUE in FROM <-tagged_with) as nodes
        FROM annotation
        WHERE is_active = true
        ORDER BY priority DESC
      `);
      
      const annotations = res[0] || [];
      
      if (annotations.length === 0) {
        console.log('\nNo Context Memory found. Add some notes via the visualizer or cortex_save MCP tool.');
        await store.close();
        process.exit(0);
      }
      
      let staleCount = 0;
      
      for (const ann of annotations) {
         const nodeIds = ann.nodes || [];
         let isStale = false;
         for (const n of nodeIds) {
            if (n && n.toString().startsWith('file:')) {
               const fileRes = await store.db.query<any[][]>(`SELECT content_hash FROM type::record($id)`, { id: n });
               const fileHash = fileRes[0]?.[0]?.content_hash;
               if (fileHash && fileHash !== ann.target_hash) {
                  isStale = true;
                  staleCount++;
                  break;
               }
            }
         }
         
         const statusBadge = isStale ? '⚠️  [STALE]' : '✅ [VERIFIED]';
         console.log(`\n${statusBadge} ${ann.title} (${ann.priority}) - ${ann.category}`);
         console.log(`   ID: ${ann.id}`);
         if (isStale) {
            console.log(`   Action: The underlying file has changed. Use visualizer to update or review.`);
         }
      }
      
      if (staleCount > 0) {
        console.log(`\nFound ${staleCount} stale annotations that may need review.`);
      } else {
        console.log(`\nAll annotations are up to date!`);
      }
    } catch (err: any) {
      console.error('Failed to retrieve Cortex status:', err.message);
    }

    await store.close();
    process.exit(0);
  });
