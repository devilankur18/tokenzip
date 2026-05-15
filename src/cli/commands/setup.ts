import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { SurrealStore } from '../../storage/surreal/store.js';
import { Indexer } from '../../engine/indexer.js';
import { resolveDbPath } from '../resolve-db.js';

const { resolve } = path;

export const setupCommand = new Command('setup')
  .description('One-step setup: Initialize and index the repository')
  .option('--full', 'Full re-index')
  .action(async (options, command) => {
    const globalOptions = command.parent.opts();
    const cwd = resolve(globalOptions.cwd);
    const tokenzipDir = path.join(cwd, '.tokenzip');
    
    console.log(`\n🛠️  Setting up TokenZip for: ${cwd}`);

    // --- INIT LOGIC ---
    if (!fs.existsSync(tokenzipDir)) {
      fs.mkdirSync(tokenzipDir, { recursive: true });
      console.log('✅ Created .tokenzip directory');
    }

    const gitignorePath = path.join(tokenzipDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, 'db/\n');
      console.log('✅ Created .tokenzip/.gitignore');
    }

    const repoPath = cwd;
    const dbPath = path.join(tokenzipDir, 'db');
    const store = new SurrealStore(dbPath);
    
    try {
      await store.initialize();
      await store.migrate();
      
      const repoId = `repository:${path.basename(cwd).replace(/\W/g, '_')}`;
      await store.createNode({
        id: repoId,
        type: 'repository',
        name: path.basename(cwd),
        root: cwd,
      } as any);
      
      console.log(`✅ Repository initialized in database.`);

      // --- PARSE LOGIC ---
      console.log(`🚀 Starting index...`);
      if (options.full) {
        console.log('🧹 Mode: Full re-index');
        await store.clear();
      }

      const indexer = new Indexer(store, repoPath);
      await indexer.indexCodebase();

      console.log('\n✨ Setup complete! Your codebase is now indexed.');
      console.log('Next steps:');
      console.log('  1. Run `tokenzip serve` to start the MCP server.');
      console.log('  2. Connect your AI assistant (Claude, Cursor, etc.) to the server.');
      
    } catch (err) {
      console.error('❌ Setup failed:', err);
    } finally {
      await store.close();
      process.exit(0);
    }
  });
