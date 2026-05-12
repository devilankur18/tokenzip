import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { createQuery } from '../../query/builder.js';

export function createStructureTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'query_repo_structure',
      description: 'Get a hierarchical overview of the repository (Modules -> Files -> Symbols).',
      inputSchema: {
        type: 'object',
        properties: {
          depth: { type: 'number', default: 2, description: 'Depth of the hierarchy to explore' }
        },
        required: [],
      },
      handler: async (args: any) => {
        const depth = args.depth ?? 2;
        
        // Find root repository
        const repos = await store.query('SELECT id, name FROM repository LIMIT 1');
        if (repos.length === 0) {
          return { content: [{ type: 'text', text: 'Repository not initialized. Run `tokenzip init` first.' }], isError: true };
        }
        
        const rootId = repos[0].id;
        
        // Fetch hierarchical structure using contains relations
        const structure = await store.query(`
          SELECT 
            id, name, type, path,
            (SELECT id, name, type, path FROM ->contains LIMIT 50) as children
          FROM type::record($rootId)
        `, { rootId });
        
        const response = budget.truncate({ structure: structure[0] });
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
