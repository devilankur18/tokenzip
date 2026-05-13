import fs from 'fs';
import path from 'path';
import { IStore } from '../storage/interface.js';
import { TokenBudgetManager } from '../mcp/token-budget.js';
import { FileMetric } from './report-generator.js';
import { executeStrategy } from '../mcp/tools/smart-file-read.js';
import { fileCache } from '../utils/file-cache.js';

export interface ReportOptions {
  directory?: string;
  types?: string[];
  regex?: string;
  concurrency?: number;
}

export class ReportIndexer {
  private store: IStore;
  private repoPath: string;
  private options: ReportOptions;
  private budget: TokenBudgetManager;

  constructor(store: IStore, repoPath: string, options: ReportOptions = {}) {
    this.store = store;
    this.repoPath = repoPath;
    this.options = options;
    this.budget = new TokenBudgetManager();
  }

  async getMetrics(): Promise<FileMetric[]> {
    console.log('🔍 Fetching files from database...');
    
    // Initial query to get all files
    let query = 'SELECT id, path FROM file';
    const files = await this.store.query<any>(query);

    if (files.length === 0) {
      return [];
    }

    // Apply filters in memory for simplicity and flexibility
    let filteredFiles = files;

    if (this.options.directory) {
      const dir = this.options.directory.replace(/\\/g, '/');
      filteredFiles = filteredFiles.filter((f: any) => 
        f.path.startsWith(dir)
      );
    }

    if (this.options.types && this.options.types.length > 0) {
      const types = this.options.types.map(t => t.startsWith('.') ? t : `.${t}`);
      filteredFiles = filteredFiles.filter((f: any) => 
        types.some(type => f.path.endsWith(type))
      );
    }

    if (this.options.regex) {
      const re = new RegExp(this.options.regex);
      filteredFiles = filteredFiles.filter((f: any) => re.test(f.path));
    }

    if (filteredFiles.length === 0) {
      return [];
    }

    console.log(`📊 Processing ${filteredFiles.length} files...`);

    const metrics: FileMetric[] = [];
    let processedCount = 0;
    const batchSize = this.options.concurrency || 50;
    
    // Process in parallel batches with a limit
    const chunks = [];
    for (let i = 0; i < filteredFiles.length; i += batchSize) {
      chunks.push(filteredFiles.slice(i, i + batchSize));
    }

    // Process up to 5 chunks in parallel (total concurrency = 5 * batchSize)
    const chunkConcurrency = 5;
    for (let i = 0; i < chunks.length; i += chunkConcurrency) {
      const chunkBatch = chunks.slice(i, i + chunkConcurrency);
      
      await Promise.all(chunkBatch.map(async (chunk) => {
        const fileIds = chunk.map((f: any) => f.id);
        
        // Optimized query: fetch symbols and their outgoing call targets in one pass
        // Using graph traversal (->calls) and metadata access
        const allSymbols = await this.store.query<any>(
          'SELECT *, ->calls.metadata.targetName AS callTargets FROM symbol WHERE fileId IN $fileIds ORDER BY startLine ASC', 
          { fileIds }
        );
        
        // Group symbols by fileId
        const symbolMap = new Map<string, any[]>();
        for (const sym of allSymbols) {
          const fid = sym.fileId.toString();
          if (!symbolMap.has(fid)) symbolMap.set(fid, []);
          symbolMap.get(fid)!.push(sym);
        }

        await Promise.all(chunk.map(async (file: any) => {
          const absPath = path.resolve(this.repoPath, file.path);
          
          try {
            // Use fileCache for ALL reads to avoid redundant disk I/O
            const lines = fileCache.getLines(absPath);
            const content = lines.join('\n');
            const naiveTokens = this.budget.estimate(content);
            const folder = path.dirname(file.path);
            const fileIdStr = file.id.toString();
            const fileSymbols = symbolMap.get(fileIdStr) || [];
            
            // Execute strategies with pre-fetched symbols
            const [iRes, sRes] = await Promise.all([
              executeStrategy('interface_only', file.path, absPath, file.id, this.store, undefined, this.budget, 4000, false, fileSymbols),
              executeStrategy('skeleton', file.path, absPath, file.id, this.store, undefined, this.budget, 4000, false, fileSymbols),
            ]);

            // Dependency tokens calculation (using pre-fetched callTargets)
            const callGraph: string[] = [];
            for (const sym of fileSymbols) {
              if (!["function", "method", "class"].includes(sym.kind)) continue;
              
              // callTargets is an array of target names from the ->calls relation
              const targets = (sym.callTargets || []).filter(Boolean);
              if (targets.length > 0) {
                const uniqueTargets = [...new Set(targets)].slice(0, 5).join(', ');
                callGraph.push(`// ${sym.kind} '${sym.name}' calls: ${uniqueTargets}`);
              }
            }
            
            const importLines = lines.filter(l => l.trim().startsWith('import') || l.trim().startsWith('require('));
            const exportLines = lines.filter(l => l.trim().startsWith('export '));
            const dContent = [
              '// --- IMPORTS ---', 
              ...importLines, 
              '', 
              '// --- CALL GRAPH ---', 
              ...callGraph, 
              '', 
              '// --- EXPORTS ---', 
              ...exportLines
            ].join('\n');

            metrics.push({
              path: file.path,
              folder: folder === '.' ? '/' : folder,
              naiveTokens,
              interfaceTokens: this.budget.estimate(iRes.content),
              skeletonTokens: this.budget.estimate(sRes.content),
              dependencyTokens: this.budget.estimate(dContent),
              interfaceSaving: naiveTokens > 0 ? Math.floor(((naiveTokens - this.budget.estimate(iRes.content)) / naiveTokens) * 100) : 0,
              skeletonSaving: naiveTokens > 0 ? Math.floor(((naiveTokens - this.budget.estimate(sRes.content)) / naiveTokens) * 100) : 0
            });
          } catch (e: any) {
            if (processedCount === 0) {
              console.error(`\n❌ Error processing ${file.path}: ${e.message}`);
            }
          } finally {
            processedCount++;
            if (processedCount % 50 === 0 || processedCount === filteredFiles.length) {
              process.stdout.write(`\r   Progress: ${processedCount}/${filteredFiles.length} files...`);
            }
          }
        }));
      }));
    }

    process.stdout.write('\n');
    return metrics;
  }
}
