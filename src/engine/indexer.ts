import fs from 'fs';
import path from 'path';
import { IStore } from '../storage/interface.js';
import { ExtractorRegistry } from '../extractor/registry.js';
import { contentHash } from '../utils/hash.js';
import { Parser, Language } from 'web-tree-sitter';
import { StringRecordId } from 'surrealdb';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.tokenzip']);

export class Indexer {
  private store: IStore;
  private registry: ExtractorRegistry;
  private repoPath: string;

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
      const fileId = `file:${relativePath}`;

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

      parsed++;
    }

    console.log(`✅ Indexing complete. Parsed ${parsed} files.`);
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
}
