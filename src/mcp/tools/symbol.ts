import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { createQuery } from '../../query/builder.js';

export function createSymbolTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'query_symbol',
      description: 'Lookup a symbol by name to get its definition, file location, and signature.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol_name: { type: 'string' }
        },
        required: ['symbol_name'],
      },
      handler: async (args: any) => {
        const symbols = await store.query('SELECT *, (SELECT path FROM file WHERE id = $parent.fileId)[0].path as filePath FROM symbol WHERE name = $name', { name: args.symbol_name });
        
        const response = budget.truncate({ symbols });
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      },
    },
    {
      name: 'find_references',
      description: 'Find all symbols that call, reference, extend, or implement a specific symbol.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol_name: { type: 'string', description: 'Name of the symbol to find references for' }
        },
        required: ['symbol_name'],
      },
      handler: async (args: any) => {
        // Find the target symbols first
        const targets = await store.query<any>('SELECT id FROM symbol WHERE name = $name', { name: args.symbol_name });
        if (targets.length === 0) {
          return { content: [{ type: 'text', text: `Symbol not found: ${args.symbol_name}` }], isError: true };
        }
        
        const targetIds = targets.map(t => t.id);
        
        // Find symbols that have ANY of these relations to our targets
        const callers = await store.query(`
          SELECT *, 
                 (SELECT path FROM file WHERE id = $parent.fileId)[0].path as filePath,
                 (SELECT type FROM ANY WHERE out IN $targets AND in = $parent.id)[0].type as relationType
          FROM symbol 
          WHERE id IN (
            SELECT in FROM calls WHERE out IN $targets
            UNION
            SELECT in FROM inherits WHERE out IN $targets
            UNION
            SELECT in FROM implements WHERE out IN $targets
            UNION
            SELECT in FROM references WHERE out IN $targets
          )
        `, { targets: targetIds });
        
        const response = budget.truncate({ 
          symbol: args.symbol_name, 
          referenceCount: callers.length,
          references: callers 
        });
        
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      },
    },
    {
      name: 'get_dependencies',
      description: 'Get the import dependencies for a specific file.',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Relative path to the file' }
        },
        required: ['file_path'],
      },
      handler: async (args: any) => {
        const fileRes = await store.query<any>('SELECT id FROM file WHERE path = $path LIMIT 1', { path: args.file_path });
        if (fileRes.length === 0) {
          return { content: [{ type: 'text', text: `File not found: ${args.file_path}` }], isError: true };
        }
        
        const fileId = fileRes[0].id;
        // Find all modules/files imported by this file
        const imports = await store.query('SELECT out.* as target FROM imports WHERE in = $fileId', { fileId });
        
        const response = budget.truncate({ file: args.file_path, dependencies: imports });
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      },
    }
  ];
}
