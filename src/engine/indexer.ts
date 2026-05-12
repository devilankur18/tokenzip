import fs from 'fs';
import path from 'path';
import { IStore } from '../storage/interface.js';
import { SurrealStore } from '../storage/surreal/store.js';
import { GitExtractor } from '../extractor/git.js';
import { ExtractorRegistry } from '../extractor/registry.js';
import { contentHash } from '../utils/hash.js';
import { Parser, Language } from 'web-tree-sitter';
import { StringRecordId } from 'surrealdb';

import { EdgeIR } from '../extractor/types.js';
import { Worker } from 'node:worker_threads';
import os from 'node:os';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.tokenzip']);

export class Indexer {
  private store: IStore;
  private registry: ExtractorRegistry;
  private repoPath: string;
  private unresolvedEdges: EdgeIR[] = [];
  private ignorePatterns: string[] = [];
  private concurrency: number;

  constructor(store: IStore, repoPath: string, concurrency?: number) {
    this.store = store;
    this.registry = new ExtractorRegistry();
    this.repoPath = repoPath;
    this.concurrency = concurrency || Math.max(1, os.cpus().length - 1);
    this.loadGitIgnore();
  }

  private loadGitIgnore(): void {
    const gitignorePath = path.join(this.repoPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      this.ignorePatterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    }
    // Always ignore standard things
    this.ignorePatterns.push(...Array.from(IGNORE_DIRS));
  }

  private isIgnored(filePath: string): boolean {
    const relativePath = path.relative(this.repoPath, filePath);
    if (!relativePath) return false;

    const parts = relativePath.split(path.sep);
    
    // Quick check for standard ignored dirs
    if (parts.some(part => IGNORE_DIRS.has(part))) return true;

    for (const pattern of this.ignorePatterns) {
      // Normalize pattern
      const p = pattern.startsWith('/') ? pattern.slice(1) : pattern;
      
      // Handle directory-only patterns (ending in /)
      if (pattern.endsWith('/')) {
        const dirPattern = p.slice(0, -1);
        if (parts.includes(dirPattern)) return true;
        if (relativePath.startsWith(p)) return true;
      }
      
      // Simple exact match for any path segment
      if (parts.includes(p)) return true;

      // Handle simple globs like *.log or build/*
      if (p.includes('*')) {
        const regexStr = p
          .replace(/\./g, '\\.')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '.');
        
        const regex = new RegExp(`(^|/)${regexStr}($|/)`);
        if (regex.test(relativePath)) return true;
      } else {
        // Path prefix match (e.g. "dist" matches "dist/main.js")
        if (relativePath === p || relativePath.startsWith(p + path.sep)) return true;
      }
    }

    return false;
  }

  private async saveResult(msg: any, repoId: string): Promise<void> {
    const { filePath, hash, result, codeLength, lineCount, language, ext } = msg;
    const relativePath = path.relative(this.repoPath, filePath);
    const fileId = `file:${relativePath.replace(/\W/g, '_')}`;

    // Identify/Create Module
    const dirName = path.dirname(relativePath);
    let moduleId: string | null = null;
    if (dirName !== '.') {
      moduleId = `module:${dirName.replace(/\W/g, '_')}`;
      await this.store.createNode({
        id: moduleId,
        type: 'module',
        name: path.basename(dirName),
        path: dirName,
      } as any);
      await this.store.createEdge({ type: 'contains', from: repoId, to: moduleId } as any);
    }

    // Check if file is already parsed and unmodified
    const existing = await this.store.getNode(fileId);
    if (existing && existing.content_hash === hash) {
      return; // Unmodified
    }

    const publicSymbols = result.symbols.filter((s: any) => {
      if (s.isInternal && s.kind === 'variable') return false;
      return true;
    });

    // Clean old symbols and edges
    await this.store.query('DELETE symbol WHERE fileId = $fileId', { fileId: new StringRecordId(fileId) });
    await this.store.deleteNode(fileId);

    // Create file node
    await this.store.createNode({
      id: fileId,
      type: 'file',
      path: relativePath,
      content_hash: hash,
      size_bytes: codeLength,
      language: language,
      ext: ext,
      line_count: lineCount,
      parse_status: result.parseErrors.length === 0 ? 'parsed' : 'partial',
      last_parsed: new Date(),
      module_id: moduleId ? new StringRecordId(moduleId) : null,
    } as any);

    // Link Repo/Module -> File
    await this.store.createEdge({
      type: 'contains',
      from: moduleId ?? repoId,
      to: fileId
    } as any);

    // Insert new symbols
    for (const symbol of publicSymbols) {
      const fullSymbol = {
        ...symbol,
        type: 'symbol',
        fileId: new StringRecordId(fileId)
      } as any;
      delete fullSymbol.isInternal;

      await this.store.createNode(fullSymbol);
      
      await this.store.createEdge({
        type: 'contains',
        from: fileId,
        to: symbol.id
      } as any);
    }

    for (const edge of result.edges) {
      this.unresolvedEdges.push(edge);
    }
  }

  async indexCodebase(): Promise<void> {
    await Parser.init();
    // WASM grammar is part of the tokenzip package — resolve relative to this file's location.
    // This works whether tokenzip is installed globally, locally, or run directly from source.
    const selfDir = path.dirname(new URL(import.meta.url).pathname);
    const candidates = [
      // Case 1: In dist/ (standard layout)
      path.resolve(selfDir, '../node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm'),
      // Case 2: In dist/cli/ (nested bundle)
      path.resolve(selfDir, '../../node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm'),
      // Fallback: in the target repo's own node_modules
      path.resolve(this.repoPath, 'node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm'),
      // Legacy: inside .tokenzip/node_modules
      path.resolve(this.repoPath, '.tokenzip/node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm'),
    ];
    const wasmPath = candidates.find(p => fs.existsSync(p)) ?? candidates[0];
    let Lang: Language;
    try {
      Lang = await Language.load(wasmPath);
    } catch (e) {
      console.error(`Failed to load WASM. Tried:\n  ${candidates.join('\n  ')}`);
      return;
    }

    const parser = new Parser();
    parser.setLanguage(Lang);

    console.log('\n📦 Initializing Repository...');
    const repoName = path.basename(this.repoPath);
    const repoId = `repository:${repoName.replace(/\W/g, '_')}`;
    await this.store.createNode({
      id: repoId,
      type: 'repository',
      name: repoName,
      root: this.repoPath,
    } as any);

    process.stdout.write('🔍 Scanning files... ');
    const allFiles = this.getAllFiles(this.repoPath);
    process.stdout.write(`found ${allFiles.length} files.\n`);

    if (allFiles.length === 0) {
      console.log('⚠️  No files found to index. Check your directory or .gitignore patterns.');
      return;
    }

    console.log(`\n🚀 Indexing ${allFiles.length} files using ${this.concurrency} cores...`);

    let parsed = 0;
    let skipped = 0;
    let startTime = Date.now();

    // Initialize worker pool
    const workers: Worker[] = [];
    const workerCandidates = [
      path.resolve(selfDir, 'worker.js'),               // Same dir (e.g. in dist/engine/)
      path.resolve(selfDir, 'engine/worker.js'),        // Nested (e.g. in dist/)
      path.resolve(selfDir, '../engine/worker.js'),     // Parent then nested (e.g. in dist/cli/)
      path.resolve(selfDir, '../worker.js'),            // Parent (e.g. in dist/cli/)
    ];
    const workerScript = workerCandidates.find(p => fs.existsSync(p));

    if (!workerScript) {
      throw new Error(`Could not find worker.js. Tried:\n  ${workerCandidates.join('\n  ')}`);
    }
    
    for (let i = 0; i < this.concurrency; i++) {
      const worker = new Worker(workerScript);
      worker.postMessage({ type: 'init', wasmPath });
      workers.push(worker);
    }

    // Wait for all workers to be ready
    await Promise.all(workers.map(w => new Promise(resolve => {
      w.once('message', (msg) => {
        if (msg.type === 'ready') resolve(true);
        else throw new Error(`Worker failed to initialize: ${msg.error}`);
      });
    })));

    // Task queue
    const queue = [...allFiles];
    let active = 0;
    let dbQueue: Promise<any> = Promise.resolve();

    const processQueue = () => new Promise<void>((resolve, reject) => {
      const next = async (worker: Worker) => {
        if (queue.length === 0) {
          if (active === 0) {
            // Wait for final DB writes to complete
            dbQueue.then(() => resolve()).catch(reject);
          }
          return;
        }

        const filePath = queue.shift()!;
        active++;
        
        const relativePath = path.relative(this.repoPath, filePath);
        const percent = Math.round(((allFiles.length - queue.length) / allFiles.length) * 100);
        process.stdout.write(`\r   [${percent}%] Processing: ${relativePath.padEnd(60).slice(0, 60)}...`);

        worker.postMessage({ type: 'extract', filePath, relativePath });
        
        worker.once('message', async (msg) => {
          active--;
          if (msg.type === 'result') {
            // Queue the DB write but don't block the worker
            dbQueue = dbQueue.then(async () => {
              try {
                await this.saveResult(msg, repoId);
                parsed++;
              } catch (e) {
                console.error(`\n❌ Error saving ${msg.filePath}: ${e}`);
              }
            });
          } else if (msg.type === 'skipped') {
            skipped++;
          } else if (msg.type === 'error') {
            console.error(`\n❌ Error processing ${msg.filePath}: ${msg.error}`);
          }
          next(worker);
        });
      };

      workers.forEach(w => next(w));
    });

    await processQueue();
    
    // Clean up workers
    await Promise.all(workers.map(w => w.terminate()));

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r✅ Indexing complete! Parsed ${parsed} files, skipped ${skipped} in ${duration}s.\n`);

    // Git metadata extraction
    if (this.store instanceof SurrealStore) {
      process.stdout.write('📜 Extracting Git history... ');
      try {
        const git = new GitExtractor(this.repoPath);
        await git.extractHistory(this.store);
        console.log('done.');
      } catch (e) {
        console.log('skipped (not a git repo).');
      }
    }
    
    if (this.unresolvedEdges.length > 0) {
      process.stdout.write(`\n🔄 Resolving ${this.unresolvedEdges.length} edges... `);
      await this.resolveEdges();
      console.log('done.');
    }

    console.log('\n✨ Codebase Knowledge Graph is ready!');
  }

  private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    try {
      const files = fs.readdirSync(dirPath);
      files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        
        // Skip if this file or directory is ignored
        if (this.isIgnored(fullPath)) return;

        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            this.getAllFiles(fullPath, arrayOfFiles);
          } else {
            // Only add files that are supported by at least one extractor
            if (this.registry.supportsFile(fullPath)) {
              arrayOfFiles.push(fullPath);
            }
          }
        } catch (e) {
          // Skip individual files/dirs with permission issues
        }
      });
    } catch (e) {
      console.warn(`⚠️  Skipping inaccessible directory: ${dirPath}`);
    }
    return arrayOfFiles;
  }

  private async resolveEdges(): Promise<void> {
    for (const edge of this.unresolvedEdges) {
      if (edge.type === 'calls' || edge.type === 'inherits' || edge.type === 'implements') {
        const targetName = edge.metadata?.targetName as string;
        if (!targetName) continue;
        
        // Exact name match
        const q = `SELECT * FROM symbol WHERE name = $targetName LIMIT 5`;
        const matches = await this.store.query<any>(q, { targetName });
        
        for (const target of matches) {
          await this.store.createEdge({
            type: edge.type,
            from: edge.from,
            to: target.id,
          } as any);
        }
      } else if (edge.type === 'imports') {
        const source = edge.metadata?.source as string;
        if (!source) continue;
        
        if (source.startsWith('.')) {
          // Relative path
          const fromFileId = edge.from.replace('file:', '');
          const dir = path.dirname(fromFileId);
          const resolvedPath = path.join(dir, source);
          
          const q = `SELECT id FROM file WHERE path CONTAINS $resolvedPath LIMIT 1`;
          const matches = await this.store.query<any>(q, { resolvedPath });
          
          for (const match of matches) {
            await this.store.createEdge({
              type: 'imports',
              from: edge.from,
              to: match.id,
            } as any);
          }
        } else {
          // Module/Package
          const modId = `module:${source.replace(/\W/g, '_')}`;
          await this.store.updateNode(modId, {
            id: modId,
            type: 'module',
            name: source,
          } as any);
          
          await this.store.createEdge({
            type: 'imports',
            from: edge.from,
            to: modId,
          } as any);
        }
      }
    }
    this.unresolvedEdges = [];
  }
}
