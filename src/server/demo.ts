import express from 'express';
import cors from 'cors';
import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import { SurrealStore } from '../storage/surreal/store.js';
import { Indexer } from '../engine/indexer.js';
import { registerTools } from '../mcp/tools/registry.js';
import { TokenBudgetManager } from '../mcp/token-budget.js';

export async function startDemoServer(
  port: number = 6001, 
  defaultSession?: { name: string, path: string, store: SurrealStore }
) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const REPOS_DIR = path.resolve(process.cwd(), '.tokenzip/demo/repos');
  const DB_DIR = path.resolve(process.cwd(), '.tokenzip/demo/dbs');

  await fs.mkdir(REPOS_DIR, { recursive: true });
  await fs.mkdir(DB_DIR, { recursive: true });

  const budget = new TokenBudgetManager();
  const sessions = new Map<string, { store: SurrealStore, repoPath: string, tools: any[] }>();

  if (defaultSession) {
    const { name, path: repoPath, store } = defaultSession;
    const tools = registerTools(store, repoPath, budget, true);
    sessions.set(name, { store, repoPath, tools });
    console.log(`[Demo] Auto-registered local repo: ${name}`);
  }

  app.post('/api/index', async (req, res) => {
    const { githubUrl } = req.body;
    if (!githubUrl) return res.status(400).json({ error: 'GitHub URL is required' });

    try {
      const repoName = githubUrl.split('/').pop().replace('.git', '');
      const repoPath = path.join(REPOS_DIR, repoName);
      const dbPath = path.join(DB_DIR, repoName);

      if (!(await fs.access(repoPath).then(() => true).catch(() => false))) {
        console.log(`[Demo] Cloning ${githubUrl}...`);
        await simpleGit().clone(githubUrl, repoPath);
      }

      const store = new SurrealStore(dbPath);
      await store.initialize();
      await store.migrate();

      console.log(`[Demo] Indexing ${repoName}...`);
      const indexer = new Indexer(store, repoPath);
      await indexer.indexCodebase();

      const tools = registerTools(store, repoPath, budget, true);

      sessions.set(repoName, { store, repoPath, tools });

      res.json({ message: 'Indexed successfully', repoName });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tool', async (req, res) => {
    const { repoName, toolName, args } = req.body;
    const session = sessions.get(repoName);

    console.log(`[Demo] Request: ${toolName} for ${repoName}`, args);

    if (!session) {
      console.error(`[Demo] Session NOT FOUND for ${repoName}`);
      return res.status(404).json({ error: 'Session not found' });
    }

    try {
      let result;
      const { store, repoPath } = session;

      if (toolName === 'file_read') {
        const absPath = path.resolve(repoPath, args.path);
        console.log(`[Demo] Reading file: ${absPath}`);
        const content = await fs.readFile(absPath, 'utf-8');
        result = { content: [{ type: 'text', text: content }] };
      } else {
        const tool = session.tools.find(t => (t as any).name === toolName);
        if (!tool) {
          console.error(`[Demo] Tool ${toolName} NOT FOUND`);
          return res.status(404).json({ error: `Tool ${toolName} not found` });
        }
        const rawResult = await tool.handler(args);
        
        // Normalize to MCP format if needed
        if (rawResult && typeof rawResult === 'object' && !Array.isArray(rawResult.content)) {
          // If it has a .content field that is a string, wrap it. 
          // Otherwise stringify the whole thing.
          const text = typeof rawResult.content === 'string' ? rawResult.content : JSON.stringify(rawResult, null, 2);
          result = { 
            content: [{ type: 'text', text }],
            _metadata: rawResult // Keep original data for UI if needed
          };
        } else {
          result = rawResult;
        }
      }

      res.json(result);
    } catch (err: any) {
      console.error(`[Demo] Error executing ${toolName}:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`🚀 TokenZip Demo API active on port ${port}`);
      resolve();
    });
  });
}
