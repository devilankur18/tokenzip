import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { createQuery } from '../../query/builder.js';

export function createStructureTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'query_repo_structure',
      description: 'Get an overview of the repository files and modules.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        // Fetch files and modules
        const files = await store.query('SELECT * FROM file LIMIT 1000');
        const modules = await store.query('SELECT * FROM module LIMIT 100');
        
        const response = budget.truncate({ modules, files });
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      },
    },
    {
      name: 'get_codebase_stats',
      description: 'Get high-level statistics about the codebase (file count, symbol count, etc.).',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        const stats = await store.stats();
        return {
          content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
        };
      },
    },
    {
      name: 'get_file_symbols',
      description: 'List all symbols (functions, classes, etc.) in a specific file.',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Relative path to the file' }
        },
        required: ['file_path'],
      },
      handler: async (args: any) => {
        // Find file node first to get its ID
        const fileRes = await store.query<any>('SELECT id FROM file WHERE path = $path LIMIT 1', { path: args.file_path });
        if (fileRes.length === 0) {
          return {
            content: [{ type: 'text', text: `File not found: ${args.file_path}` }],
            isError: true
          };
        }
        
        const fileId = fileRes[0].id;
        const symbols = await store.query('SELECT * FROM symbol WHERE fileId = $fileId', { fileId });
        
        const response = budget.truncate({ file: args.file_path, symbols });
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      },
    }
  ];
}
