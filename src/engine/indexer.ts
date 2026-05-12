import fs from 'fs';
import path from 'path';
import { IStore } from '../storage/interface.js';
import { SurrealStore } from '../storage/surreal/store.js';
import { GitExtractor } from '../extractor/git.js';
import { ExtractorRegistry } from '../extractor/registry.js';
import { contentHash } from '../utils/hash.js';
import { Parser, Language } from 'web-tree-sitter';
import { EdgeIR } from '../extractor/types.js';
import { Worker } from 'node:worker_threads';
import os from 'node:os';
import { RecordId, StringRecordId } from 'surrealdb';

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
    
    // 1. Quick check for standard hardcoded ignored dirs
    if (parts.some(part => IGNORE_DIRS.has(part))) return true;

    // 2. Check against .gitignore patterns
    for (const pattern of this.ignorePatterns) {
      const isRootRelative = pattern.startsWith('/');
      const p = isRootRelative ? pattern.slice(1) : pattern;
      const cleanPattern = pattern.endsWith('/') ? p.slice(0, -1) : p;
      
      // Handle simple non-glob patterns
      if (!cleanPattern.includes('*')) {
        if (isRootRelative) {
          // Must match from the root
          if (relativePath === cleanPattern || relativePath.startsWith(cleanPattern + path.sep)) return true;
        } else {
          // Matches any part of the path
          if (parts.includes(cleanPattern)) return true;
        }
      }

      // Handle globs
      if (cleanPattern.includes('*') || cleanPattern.includes('?')) {
        const regexStr = cleanPattern
          .replace(/\./g, '\\.')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '.');
        
        const regex = new RegExp(isRootRelative ? `^${regexStr}($|/)` : `(^|/)${regexStr}($|/)`);
        if (regex.test(relativePath)) return true;
      }
    }

    return false;
  }

  private toRecordId(id: string): RecordId {
    const [table, ...rest] = id.split(':');
    return new RecordId(table, rest.join(':'));
  }

  private createdModules = new Set<string>();

  private async saveResult(msg: any, repoId: string): Promise<void> {
    const { filePath, hash, result, codeLength, lineCount, language, ext } = msg;
    const relativePath = path.relative(this.repoPath, filePath);
    const fileIdStr = `file:${relativePath.replace(/\W/g, '_')}`;
    const fileId = this.toRecordId(fileIdStr);
    const repoRid = this.toRecordId(repoId);

    // Identify/Create Module
    const dirName = path.dirname(relativePath);
    let moduleId: RecordId | null = null;
    
    if (dirName !== '.') {
      const moduleIdStr = `module:${dirName.replace(/\W/g, '_')}`;
      moduleId = this.toRecordId(moduleIdStr);
      
      if (!this.createdModules.has(moduleIdStr)) {
        await this.store.query(`
          UPSERT $id CONTENT {
            type: 'module',
            name: $name,
            path: $path,
          };
          RELATE $repoRid->contains->$id SET last_updated = time::now();
        `, {
          id: moduleId,
          name: path.basename(dirName),
          path: dirName,
          repoRid
        });
        this.createdModules.add(moduleIdStr);
      }
    }

    // Check if file is already parsed and unmodified
    const existing = await this.store.getNode(fileIdStr);
    if (existing && existing.content_hash === hash) {
      return; // Unmodified
    }

    const publicSymbols = result.symbols.filter((s: any) => {
      if (s.isInternal && s.kind === 'variable') return false;
      return true;
    });

    // Build one big query for the file and its symbols
    let batchQuery = 'BEGIN TRANSACTION;\n';
    
    // Delete old symbols
    batchQuery += `DELETE symbol WHERE fileId = $fileId;\n`;

    const parseStatus = result.parseErrors.length === 0 ? 'parsed' : 'partial';
    const fileData: any = {
      type: 'file',
      path: relativePath,
      content_hash: hash,
      size_bytes: codeLength,
      language: language,
      ext: ext,
      line_count: lineCount,
      parse_status: parseStatus,
      last_parsed: new Date(),
    };
    if (moduleId) {
      fileData.module_id = moduleId;
    }

    // Create file node
    batchQuery += `
      UPSERT $fileId CONTENT $fileData;
      RELATE $parentRepoOrModule->contains->$fileId SET last_updated = time::now();
    `;

    // Insert new symbols
    const vars: any = {
      fileId,
      fileData,
      parentRepoOrModule: moduleId || repoRid,
    };

    for (let i = 0; i < publicSymbols.length; i++) {
      const sym = publicSymbols[i];
      const symVarName = `sym${i}`;
      const symId = this.toRecordId(sym.id);
      
      vars[symVarName] = {
        name: sym.name,
        kind: sym.kind,
        signature: sym.signature,
        startLine: sym.startLine,
        endLine: sym.endLine,
        startCol: sym.startCol,
        endCol: sym.endCol,
        isExported: sym.isExported,
        modifiers: sym.modifiers,
        metadata: sym.metadata,
        type: 'symbol',
        fileId: fileId
      };

      batchQuery += `UPSERT $${symVarName}_id CONTENT $${symVarName};\n`;
      vars[`${symVarName}_id`] = symId;
      batchQuery += `RELATE $fileId->contains->$${symVarName}_id;\n`;
    }

    batchQuery += 'COMMIT TRANSACTION;';

    if (this.store instanceof SurrealStore) {
      try {
        await this.store.batch(batchQuery, vars);
      } catch (e: any) {
        // Silently fail or log to a dedicated logger in production
        // console.error(`❌ Error saving ${filePath}: ${e.message}`);
      }
    } else {
      await this.store.createNode({ id: fileIdStr, ...vars } as any);
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
    const total = this.unresolvedEdges.length;
    if (total === 0) return;

    process.stdout.write(`\n🔄 Resolving ${total} edges... `);
    
    // 1. Fetch all files to speed up relative import resolution
    const allFiles = await this.store.query<any>('SELECT id, path FROM file');
    const fileByPathMap = new Map<string, string>();
    for (const f of allFiles) {
      fileByPathMap.set(f.path, f.id.toString());
    }

    const CHUNK_SIZE = 1000;
    let processed = 0;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = this.unresolvedEdges.slice(i, i + CHUNK_SIZE);
      const batchVars: Record<string, any> = {};
      let batchQuery = 'BEGIN TRANSACTION;\n';
      
      // 2. Pre-fetch 'from' file paths (actually we have them in fileByPathMap now, 
      // but we need to map ID -> Path for resolution)
      const idToPathMap = new Map<string, string>();
      for (const [p, id] of fileByPathMap.entries()) {
        idToPathMap.set(id, p);
      }

      // 3. Pre-fetch symbols for calls/inherits/implements in this chunk
      const targetNames = [...new Set(chunk
        .filter(e => ['calls', 'inherits', 'implements'].includes(e.type))
        .map(e => e.metadata?.targetName as string)
        .filter(Boolean))];
      
      let symbolMap = new Map<string, any[]>();
      if (targetNames.length > 0) {
        const symbols = await this.store.query<any>('SELECT id, name FROM symbol WHERE name IN $targetNames', { targetNames });
        for (const sym of symbols) {
          if (!symbolMap.has(sym.name)) symbolMap.set(sym.name, []);
          symbolMap.get(sym.name)!.push(sym);
        }
      }

      // 4. Resolve and build RELATE statements
      for (let j = 0; j < chunk.length; j++) {
        const edge = chunk[j];
        const fromIdStr = this.toRecordId(edge.from).toString();

        if (['calls', 'inherits', 'implements'].includes(edge.type)) {
          const targetName = edge.metadata?.targetName as string;
          const matches = symbolMap.get(targetName) || [];
          
          for (let k = 0; k < Math.min(matches.length, 5); k++) {
            const target = matches[k];
            const varName = `e_${j}_${k}`;
            batchQuery += `RELATE $${varName}_from->${edge.type}->$${varName}_to;\n`;
            batchVars[`${varName}_from`] = this.toRecordId(edge.from);
            batchVars[`${varName}_to`] = target.id;
          }
        } else if (edge.type === 'imports') {
          const source = edge.metadata?.source as string;
          if (!source) continue;

          if (source.startsWith('.')) {
            const fromPath = idToPathMap.get(fromIdStr);
            if (!fromPath) continue;

            const dir = path.dirname(fromPath);
            const resolvedPath = path.join(dir, source);
            
            // Try different extensions
            const candidates = [
                resolvedPath,
                resolvedPath + '.ts',
                resolvedPath + '.tsx',
                resolvedPath + '.js',
                resolvedPath + '.jsx',
                path.join(resolvedPath, 'index.ts'),
                path.join(resolvedPath, 'index.js'),
            ];
            
            let targetId: string | null = null;
            for (const cand of candidates) {
                const normalized = cand.replace(/\\/g, '/');
                if (fileByPathMap.has(normalized)) {
                    targetId = fileByPathMap.get(normalized)!;
                    break;
                }
            }

            if (targetId) {
              const varName = `imp_${j}`;
              batchQuery += `RELATE $${varName}_from->imports->$${varName}_to;\n`;
              batchVars[`${varName}_from`] = this.toRecordId(edge.from);
              batchVars[`${varName}_to`] = this.toRecordId(targetId);
            }
          } else {
            const modIdStr = `module:${source.replace(/\W/g, '_')}`;
            const modId = this.toRecordId(modIdStr);
            
            const varName = `mod_${j}`;
            batchQuery += `
              UPSERT $${varName}_mod CONTENT { type: 'module', name: $${varName}_name };
              RELATE $${varName}_from->imports->$${varName}_mod;
            `;
            batchVars[`${varName}_mod`] = modId;
            batchVars[`${varName}_name`] = source;
            batchVars[`${varName}_from`] = this.toRecordId(edge.from);
          }
        }
      }

      batchQuery += 'COMMIT TRANSACTION;';
      if (batchQuery !== 'BEGIN TRANSACTION;\nCOMMIT TRANSACTION;') {
        await this.store.batch(batchQuery, batchVars);
      }

      processed += chunk.length;
      if (i % (CHUNK_SIZE * 5) === 0 || processed === total) {
        const pct = Math.round((processed / total) * 100);
        process.stdout.write(`\r🔄 Resolving ${total} edges... [${pct}%]`);
      }
    }

    process.stdout.write(' done.\n');
    this.unresolvedEdges = [];
  }
}
