import express from 'express';
import cors from 'cors';
import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import { SurrealStore, Indexer, createSmartFileReadTools, createStructureTools, TokenBudgetManager } from '../../dist/index.js';

const app = express();
app.use(cors());
app.use(express.json());

const REPOS_DIR = path.resolve('./repos');
const DB_DIR = path.resolve('./dbs');

await fs.mkdir(REPOS_DIR, { recursive: true });
await fs.mkdir(DB_DIR, { recursive: true });

const budget = new TokenBudgetManager();
const sessions = new Map<string, { store: SurrealStore, repoPath: string, tools: any[] }>();

app.post('/api/index', async (req, res) => {
  const { githubUrl } = req.body;
  if (!githubUrl) return res.status(400).json({ error: 'GitHub URL is required' });

  try {
    const repoName = githubUrl.split('/').pop().replace('.git', '');
    const repoPath = path.join(REPOS_DIR, repoName);
    const dbPath = path.join(DB_DIR, repoName);

    // 1. Clone repo if not exists
    if (!(await fs.access(repoPath).then(() => true).catch(() => false))) {
      console.log(`Cloning ${githubUrl}...`);
      await simpleGit().clone(githubUrl, repoPath);
    }

    // 2. Initialize Store
    const store = new SurrealStore(dbPath);
    await store.initialize();
    await store.migrate();

    // 3. Index Codebase
    console.log(`Indexing ${repoName}...`);
    const indexer = new Indexer(store, repoPath);
    await indexer.indexCodebase();

    const tools = [
      ...createSmartFileReadTools(store, repoPath, budget),
      ...createStructureTools(store, repoPath, budget)
    ];

    sessions.set(repoName, { store, repoPath, tools });

    res.json({ message: 'Indexed successfully', repoName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tools/:repoName/:toolName', async (req, res) => {
  const { repoName, toolName } = req.params;
  const args = req.body;
  const session = sessions.get(repoName);

  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    let result;
    const { store, repoPath } = session;

    // Mocking the tool execution environment
    // In a real scenario, we'd call the tools via the MCP server interface
    // Here we call them directly for the demo's simplicity
    
    if (toolName === 'file_read') {
      const absPath = path.resolve(repoPath, args.path);
      const content = await fs.readFile(absPath, 'utf-8');
      result = { content: [{ type: 'text', text: content }] };
    } else {
      const tool = session.tools.find(t => t.name === toolName);
      if (!tool) return res.status(404).json({ error: `Tool ${toolName} not found` });
      result = await tool.handler(args);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`TokenZip Demo Backend running on port ${PORT}`);
});
