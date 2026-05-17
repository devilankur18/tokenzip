import { IStore } from '../../../storage/interface.js';
import { TokenBudgetManager } from '../../token-budget.js';

export function createSearchTool(store: IStore, budget: TokenBudgetManager) {
  return {
    name: 'code_search',
    description: 'Unified semantic and text search across the codebase. Find symbols, classes, or specific logic by name or description.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or symbol name.' },
        kind: { type: 'string', enum: ['function', 'class', 'interface', 'variable'], description: 'Filter by symbol kind.' },
        path_filter: { type: 'string', description: 'Filter by directory or file pattern.' },
        limit: { type: 'number', default: 20 }
      },
      required: ['query']
    },
    handler: async (args: any) => {
      try {
        const { query, kind, path_filter, limit = 20 } = args;
        if (!query) throw new Error('Query parameter is required.');
        
        let q = `
          SELECT 
            id, name, kind, docstring, signature,
            fileId.path as filePath
          FROM symbol 
          WHERE (string::lowercase(name || "") CONTAINS string::lowercase($q) 
             OR string::lowercase(docstring || "") CONTAINS string::lowercase($q))
        `;
        
        const vars: any = { q: query, limit };

        if (kind) {
          q += ' AND kind = $kind';
          vars.kind = kind;
        }
        
        if (path_filter) {
          q += ' AND fileId.path CONTAINS $path_filter';
          vars.path_filter = path_filter;
        }

        q += ' LIMIT $limit';

        const results = await store.query<any>(q, vars) || [];

        const response = budget.truncate({ 
          query,
          matchCount: results.length,
          matches: results.map((r: any) => ({
            id: r.id,
            name: r.name,
            kind: r.kind,
            filePath: r.filePath,
            signature: r.signature
          }))
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: err.message }], isError: true };
      }
    }
  };
}
