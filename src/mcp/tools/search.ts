import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';

export function createSearchTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'search_codebase',
      description: 'Performs a text search across the indexed codebase using the search index.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The text string to search for.' },
          limit: { type: 'number', default: 20, description: 'Maximum number of matches to return.' }
        },
        required: ['query']
      },
      handler: async (args: any) => {
        const { query, limit = 20 } = args;
        
        // Search in symbols and files
        const results = await store.query(`
          SELECT 
            id, name, kind, docstring, 
            (SELECT path FROM file WHERE id = $parent.fileId)[0].path as filePath
          FROM symbol 
          WHERE name CONTAINS $q OR docstring CONTAINS $q
          LIMIT $limit
        `, { q: query, limit });

        const response = budget.truncate({ 
          query,
          matchCount: results.length,
          matches: results 
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      }
    },
    {
      name: 'fuzzy_find_symbol',
      description: 'Search for symbols using fuzzy matching across the entire repository.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Partial or fuzzy name of the symbol.' },
          kind: { type: 'string', description: 'Optional filter (function, class, etc.).' },
          limit: { type: 'number', default: 10 }
        },
        required: ['query']
      },
      handler: async (args: any) => {
        const { query, kind, limit = 10 } = args;
        
        let q = 'SELECT id, name, kind, (SELECT path FROM file WHERE id = $parent.fileId)[0].path as filePath FROM symbol WHERE name CONTAINS $q';
        if (kind) {
          q += ' AND kind = $kind';
        }
        q += ' LIMIT $limit';

        const results = await store.query(q, { q: query, kind, limit });
        
        const response = budget.truncate({ 
          query,
          candidates: results 
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      }
    }
  ];
}
