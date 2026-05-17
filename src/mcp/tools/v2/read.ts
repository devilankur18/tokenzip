import { IStore } from '../../../storage/interface.js';
import { TokenBudgetManager } from '../../token-budget.js';
import { executeStrategy } from '../smart-file-read.js';
import { injectCortex } from '../cortex.js';
import path from 'path';
import fs from 'fs';

export function createReadTool(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return {
    name: 'code_read',
    description: 'Read code semantically. Supports skeleton (structure only), interface (API only), or implementation (full logic) modes. Supports batch files and batch symbol lookups.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path or comma-separated file paths relative to root.' },
        paths: { 
          type: 'array', 
          items: { type: 'string' }, 
          description: 'Optional array of file paths for batch reading.' 
        },
        mode: { 
          type: 'string', 
          enum: ['skeleton', 'interface', 'implementation', 'full'], 
          default: 'skeleton',
          description: 'Reading mode. skeleton hides bodies, interface extracts public APIs, implementation reads specific symbols, full reads the complete file uncollapsed.'
        },
        symbol: { type: 'string', description: 'Symbol name or comma-separated symbol names to read implementations of.' },
        symbols: { 
          type: 'array', 
          items: { type: 'string' }, 
          description: 'Optional array of symbol names to read implementations of.' 
        }
      },
      required: ['path']
    },
    handler: async (args: any) => {
      try {
        const { path: filePath, paths, mode = 'skeleton', symbol, symbols } = args;

        // Parse file paths
        let filePaths: string[] = [];
        if (Array.isArray(paths)) {
          filePaths = paths;
        } else if (typeof filePath === 'string') {
          filePaths = filePath.split(',').map(p => p.trim()).filter(Boolean);
        } else if (filePath) {
          filePaths = [filePath];
        }

        // Parse symbol names
        let symbolList: string[] = [];
        if (Array.isArray(symbols)) {
          symbolList = symbols;
        } else if (typeof symbol === 'string') {
          symbolList = symbol.split(',').map(s => s.trim()).filter(Boolean);
        } else if (symbol) {
          symbolList = [symbol];
        }

        const filesResults = [];
        let totalSymbolsCount = 0;

        for (const fPath of filePaths) {
          const absPath = path.resolve(repoPath, fPath);

          // 1. Resolve fileId and check status
          let fileRes = await store.query<any>('SELECT id, parse_status FROM file WHERE path = $path LIMIT 1', { path: fPath });
          
          if (fileRes.length === 0) {
            // Trigger dynamic on-the-fly indexing for newly added files!
            try {
              const { Indexer } = await import('../../../engine/indexer.js');
              const indexer = new Indexer(store, repoPath);
              await indexer.indexCodebase();
              fileRes = await store.query<any>('SELECT id, parse_status FROM file WHERE path = $path LIMIT 1', { path: fPath });
            } catch (e) {
              console.error(`Dynamic on-the-fly indexing failed:`, e);
            }
          }

          if (fileRes.length === 0) {
            // Fallback: if the file physically exists on the disk, perform direct raw read
            if (fs.existsSync(absPath)) {
              try {
                const rawContent = fs.readFileSync(absPath, 'utf8');
                filesResults.push({
                  filePath: fPath,
                  content: rawContent,
                  symbol_count: 0
                });
                continue;
              } catch (e: any) {
                console.error(`Direct disk fallback read failed for ${fPath}:`, e.message);
              }
            }
            continue; // Skip file if not found in index and not readable on disk
          }

          const fileNode = fileRes[0];
          const fileId = fileNode.id;

          const isFullFile = mode === 'full' || (mode === 'implementation' && symbolList.length === 0);
          const strategyMode = mode === 'implementation' ? 'implementation_of' : 
                              mode === 'interface' ? 'interface_only' : 'skeleton';

          let fileContent = '';
          let fileSymbolCount = 0;

          if (isFullFile) {
            // Full uncollapsed reading mode!
            try {
              fileContent = fs.readFileSync(absPath, 'utf8');
              const countRes = await store.query<any>('SELECT count() FROM symbol WHERE fileId = $fileId', { fileId });
              fileSymbolCount = countRes[0]?.count || 0;
            } catch (e: any) {
              fileContent = `Error reading full file: ${e.message}`;
            }
          } else if (strategyMode === 'implementation_of') {
            if (symbolList.length > 1) {
              // Batch read multiple symbols inside this file!
              const symbolContents = [];
              for (const sym of symbolList) {
                try {
                  const res = await executeStrategy(
                    strategyMode,
                    fPath,
                    absPath,
                    fileId,
                    store,
                    sym,
                    budget,
                    4000
                  );
                  symbolContents.push(`// ==========================================\n// Symbol: ${sym}\n// ==========================================\n${res.content}`);
                  fileSymbolCount += res.symbol_count;
                } catch (e: any) {
                  symbolContents.push(`// Symbol: ${sym} - error: ${e.message}`);
                }
              }
              fileContent = symbolContents.join('\n\n');
            } else {
              // Single symbol inside this file
              const targetSym = symbolList[0] || symbol;
              const res = await executeStrategy(
                strategyMode,
                fPath,
                absPath,
                fileId,
                store,
                targetSym,
                budget,
                4000
              );
              fileContent = res.content;
              fileSymbolCount = res.symbol_count;
            }
          } else {
            // Skeleton or Interface mode
            const res = await executeStrategy(
              strategyMode,
              fPath,
              absPath,
              fileId,
              store,
              undefined,
              budget,
              4000
            );
            fileContent = res.content;
            fileSymbolCount = res.symbol_count;
          }

          filesResults.push({
            filePath: fPath,
            content: fileContent,
            symbol_count: fileSymbolCount
          });
          totalSymbolsCount += fileSymbolCount;
        }

        if (filesResults.length === 0) {
          throw new Error(`None of the specified files were found in index: ${filePaths.join(', ')}`);
        }

        // Return a single file response or a batch response
        const isFullFileMode = mode === 'full' || (mode === 'implementation' && symbolList.length === 0);

        if (isFullFileMode) {
          if (filesResults.length === 1) {
            // Full file mode output is returned EXACTLY as same raw file_read: no wrappers, no compression!
            return {
              content: [{ type: 'text', text: filesResults[0].content }]
            };
          } else {
            // Batch full file mode returns raw file contents in simple structural JSON representation, with NO truncation!
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  is_batch: true,
                  files: filesResults.map(f => ({
                    filePath: f.filePath,
                    content: f.content
                  })),
                  mode_used: 'full',
                  symbol_count: totalSymbolsCount
                }, null, 2)
              }]
            };
          }
        }

        let response: any;
        if (filesResults.length === 1) {
          const singleFile = filesResults[0];
          response = budget.truncate({
            content: singleFile.content,
            mode_used: mode,
            symbol_count: singleFile.symbol_count
          });

          // Inject Cortex insights
          const cortex = await injectCortex(singleFile.filePath, store, budget);
          if (cortex) {
            response._insights = cortex.notes;
          }
        } else {
          // Batch response representing multiple files
          response = budget.truncate({
            is_batch: true,
            files: filesResults,
            mode_used: mode,
            symbol_count: totalSymbolsCount
          });

          // Combine Cortex insights for all files
          const allInsights: string[] = [];
          for (const f of filesResults) {
            const cortex = await injectCortex(f.filePath, store, budget);
            if (cortex?.notes) {
              allInsights.push(...cortex.notes);
            }
          }
          if (allInsights.length > 0) {
            response._insights = [...new Set(allInsights)];
          }
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: err.message }], isError: true };
      }
    }
  };
}
