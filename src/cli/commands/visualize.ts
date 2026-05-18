import { Command } from 'commander';
import path from 'path';
import { SurrealStore } from '../../storage/surreal/store.js';
import { resolveDbPath } from '../resolve-db.js';
import { spawn } from 'child_process';
import fs from 'fs';
import { startDemoServer } from '../../server/demo.js';

export const visualizeCommand = new Command('visualize')
  .alias('viz')
  .description('Launch the interactive graph visualizer')
  .action(async () => {
    const cwd = process.cwd();
    const { dbPath } = resolveDbPath(cwd);
    
    console.log('🔍 Resolving knowledge graph...');
    const store = new SurrealStore(dbPath);
    
    try {
      await store.initialize();
      await store.migrate();
      
      // Get the port from the server.port file
      const parent = path.dirname(dbPath);
      const portPath = path.resolve(parent, 'server.port');
      const dbPort = fs.readFileSync(portPath, 'utf8').trim();
      
      console.log(`✅ Knowledge graph active on port ${dbPort}`);
      
      // Fetch current repo info for demo mode
      const repos = await store.query<any>('SELECT name, root FROM repository LIMIT 1') || [];
      const currentRepo = repos[0];
      
      console.log('🚀 Starting Demo API...');
      startDemoServer(6001, currentRepo ? {
        name: currentRepo.name,
        path: currentRepo.root,
        store: store
      } : undefined).catch(err => {
        console.error('⚠️ Failed to start Demo API:', err.message);
      });
      
      // Resolve viz directory
      const currentDir = path.dirname(new URL(import.meta.url).pathname);
      let vizDir = path.resolve(currentDir, '../../../viz');
      if (!fs.existsSync(vizDir)) {
        vizDir = path.resolve(currentDir, '../../viz');
      }

      console.log('🚀 Starting visualizer UI...');
      
      const vite = spawn('npm', ['run', 'dev', '--', '--port', '5173'], {
        cwd: vizDir,
        stdio: 'inherit',
        shell: true
      });

      const url = `http://localhost:5173?port=${dbPort}`;
      
      setTimeout(() => {
        console.log(`\n✨ Visualizer is ready at: ${url}`);
        // Try to open the browser
        const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        spawn(openCmd, [url], { shell: true });
      }, 3000);

      process.on('SIGINT', () => {
        vite.kill();
        store.close();
        process.exit();
      });

    } catch (err) {
      console.error('❌ Failed to launch visualizer:', err);
      process.exit(1);
    }
  });
