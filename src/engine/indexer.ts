import fs from 'fs';
import path from 'path';
import { IStore } from '../storage/interface.js';
import { SurrealStore } from '../storage/surreal/store.js';
import { GitExtractor } from '../extractor/git.js';
import { ExtractorRegistry } from '../extractor/registry.js';
import { contentHash } from '../utils/hash.js';
import { Parser, Language } from 'web-tree-sitter';
import { StringRecordId } from 'surrealdb';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.tokenzip']);

import { EdgeIR } from '../extractor/types.js';

export class Indexer {
  private store: IStore;
  private registry: ExtractorRegistry;
  private repoPath: string;
  private unresolvedEdges: EdgeIR[] = [];

  constructor(store: IStore, repoPath: string) {
    this.store = store;
    this.registry = new ExtractorRegistry();
    this.repoPath = repoPath;
  }

  async indexCodebase(): Promise<void> {
    await Parser.init();
    // Try to find WASM either in local node_modules or in .tokenzip/node_modules
    let wasmPath = path.resolve(this.repoPath, 'node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm');
    if (!fs.existsSync(wasmPath)) {
      wasmPath = path.resolve(this.repoPath, '.tokenzip/node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm');
    }
    let Lang: Language;
    try {
      Lang = await Language.load(wasmPath);
    } catch (e) {
      console.error('Failed to load WASM at', wasmPath);
      return;
    }

    const parser = new Parser();
    parser.setLanguage(Lang);

    const allFiles = this.getAllFiles(this.repoPath);
    console.log(`🚀 Indexing ${allFiles.length} files...\n`);

    let parsed = 0;
    for (const filePath of allFiles) {
      if (!this.registry.supportsFile(filePath)) continue;

      const relativePath = path.relative(this.repoPath, filePath);
      const code = fs.readFileSync(filePath, 'utf8');
      const hash = contentHash(code);
      const fileId = `file:${relativePath.replace(/\W/g, '_')}`;

      // Check if file is already parsed and unmodified
      const existing = await this.store.getNode(fileId);
      if (existing && existing.content_hash === hash) {
        continue; // Unmodified
      }

      let tree;
      try {
        tree = parser.parse(code);
      } catch (e) {
        console.warn(`Failed to parse ${relativePath}`);
        continue;
      }

      const extractor = this.registry.getExtractor(filePath);
      if (!extractor || !tree) continue;

      const ctx = {
        filePath,
        relativePath,
        content: code,
        contentHash: hash,
        tree,
        language: extractor.language,
        moduleId: null, // Basic for now
      };

      const result = extractor.extract(ctx);

      // Clean old symbols and edges
      await this.store.query('DELETE symbol WHERE file_id = $fileId', { fileId });
      // Remove file
      await this.store.deleteNode(fileId);

      // Create file node
      await this.store.createNode({
        id: fileId,
        type: 'file',
        path: relativePath,
        content_hash: hash,
        size_bytes: Buffer.byteLength(code),
        language: extractor.language,
        ext: path.extname(filePath),
        line_count: code.split('\\n').length,
        parse_status: result.parseErrors.length === 0 ? 'parsed' : 'partial',
        last_parsed: new Date(),
      });

      // Insert new symbols
      for (const symbol of result.symbols) {
        await this.store.createNode({
          ...symbol,
          type: 'symbol',
          fileId: new StringRecordId(fileId),
        });
      }

      for (const edge of result.edges) {
        this.unresolvedEdges.push(edge);
      }

      parsed++;
    }

    console.log(`✅ Indexing complete. Parsed ${parsed} files.`);

    // Git metadata extraction
    if (this.store instanceof SurrealStore) {
      const git = new GitExtractor(this.repoPath);
      await git.extractHistory(this.store);
    }
    
    if (this.unresolvedEdges.length > 0) {
      console.log(`\n🔄 Resolving ${this.unresolvedEdges.length} edges...`);
      await this.resolveEdges();
      console.log(`✅ Edge resolution complete.`);
    }
  }

  private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        if (!IGNORE_DIRS.has(file)) this.getAllFiles(fullPath, arrayOfFiles);
      } else {
        arrayOfFiles.push(fullPath);
      }
    });
    return arrayOfFiles;
  }

  private async resolveEdges(): Promise<void> {
    for (const edge of this.unresolvedEdges) {
      if (edge.type === 'calls') {
        const targetName = edge.metadata?.targetName as string;
        if (!targetName) continue;
        
        // Exact name match
        const q = `SELECT * FROM symbol WHERE name = $targetName LIMIT 5`;
        const matches = await this.store.query<any>(q, { targetName });
        
        for (const target of matches) {
          await this.store.createEdge({
            type: 'calls',
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
