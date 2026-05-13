import { Command } from 'commander';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';
import { GitUtils } from '../../utils/git-utils.js';

export const statsCommand = new Command('stats')
  .description('Show statistics about the knowledge graph')
  .action(async (options, command) => {
    const globalOptions = command.parent.opts();
    const { dbPath, repoPath } = resolveDbPath(globalOptions.cwd);

    const store = new SurrealStore(dbPath);
    await store.initialize();
    
    const repoName = GitUtils.getRepoName(repoPath);
    console.log(`\n📊 TokenZip Statistics: ${repoName}`);
    const stats = await store.stats();

    console.log('\n--- Nodes ---');
    const nodes = Object.entries(stats.nodeCount).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of nodes) {
      console.log(`${type.padEnd(15)}: ${count.toLocaleString()}`);
    }

    console.log('\n--- Edges (Relationships) ---');
    const edges = Object.entries(stats.edgeCount).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of edges) {
      console.log(`${type.padEnd(15)}: ${count.toLocaleString()}`);
    }

    const totalNodes = Object.values(stats.nodeCount).reduce((a, b) => a + b, 0);
    const totalEdges = Object.values(stats.edgeCount).reduce((a, b) => a + b, 0);
    
    console.log('\n--- Summary ---');
    console.log(`Total Nodes    : ${totalNodes.toLocaleString()}`);
    console.log(`Total Edges    : ${totalEdges.toLocaleString()}`);

    await store.close();
    process.exit(0);
  });
