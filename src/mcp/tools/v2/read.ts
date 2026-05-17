import { IStore } from '../../../storage/interface.js';
import { TokenBudgetManager } from '../../token-budget.js';
import { executeStrategy } from '../smart-file-read.js';
import { injectCortex } from '../cortex.js';
import path from 'path';

export function createReadTool(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return {
    name: 'code_read',
    description: 'Read code semantically. Supports skeleton (structure only), interface (API only), or implementation (full logic) modes.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to root.' },
        mode: { 
          type: 'string', 
          enum: ['skeleton', 'interface', 'implementation'], 
          default: 'skeleton',
          description: 'Reading mode. Skeleton hides bodies to save tokens.'
        },
        symbol: { type: 'string', description: 'Required for implementation mode. The symbol name to read.' }
      },
      required: ['path']
    },
    handler: async (args: any) => {
      try {
        const { path: filePath, mode = 'skeleton', symbol } = args;
        const absPath = path.resolve(repoPath, filePath);

        // 1. Resolve fileId and check status
        const fileRes = await store.query<any>('SELECT id, parse_status FROM file WHERE path = $path LIMIT 1', { path: filePath });
        if (fileRes.length === 0) {
          throw new Error(`File not found in index: ${filePath}. Ensure the path is correct and indexed.`);
        }

        const fileNode = fileRes[0];
        const fileId = fileNode.id;

        // Map mode names if they differ from smart-file-read strategies
        const strategyMode = mode === 'implementation' ? 'implementation_of' : 
                            mode === 'interface' ? 'interface_only' : 'skeleton';

        // Reuse the proven execution strategy from V1
        const result = await executeStrategy(
          strategyMode,
          filePath,
          absPath,
          fileId,
          store,
          symbol,
          budget,
          4000 // default max tokens
        );

        const response: any = budget.truncate({
          content: result.content,
          mode_used: mode,
          symbol_count: result.symbol_count
        });

        // Inject Cortex insights
        const cortex = await injectCortex(filePath, store, budget);
        if (cortex) {
          response._insights = cortex.notes;
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
