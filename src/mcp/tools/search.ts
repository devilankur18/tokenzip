import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';

export function createSearchTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'search_codebase',
      description: 'Performs a text search across the indexed codebase using the search index. Supports filtering by language and path.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The text string to search for.' },
          language: { type: 'string', description: 'Filter by programming language.' },
          path_pattern: { type: 'string', description: 'Filter by file path pattern (e.g., "src/auth/").' },
          limit: { type: 'number', default: 20, description: 'Maximum number of matches to return.' }
        },
        required: ['query']
      },
      handler: async (args: any) => {
        try {
          const { query, language, path_pattern, limit = 20 } = args;
          
          let q = `
            SELECT 
              id, name, kind, docstring, 
              fileId.path as filePath,
              fileId.language as lang
            FROM symbol 
            WHERE (string::lowercase(name || "") CONTAINS string::lowercase($q) OR string::lowercase(docstring || "") CONTAINS string::lowercase($q))
          `;
          
          const vars: any = { q: query, limit };

          if (language) {
            q += ' AND fileId.language = $language';
            vars.language = language;
          }
          
          if (path_pattern) {
            q += ' AND fileId.path CONTAINS $path_pattern';
            vars.path_pattern = path_pattern;
          }

          q += ' LIMIT $limit';

          const results = await store.query<any>(q, vars);

          const response = budget.truncate({ 
            query,
            matchCount: results.length,
            matches: results.map((r: any) => ({
              id: r.id,
              name: r.name,
              kind: r.kind,
              filePath: r.filePath,
              language: r.lang
            }))
          });

          return {
            content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          };
        } catch (err: any) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
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
        try {
          const { query, kind, limit = 10 } = args;
          
          let q = 'SELECT id, name, kind, fileId.path as filePath FROM symbol WHERE name CONTAINS $q';
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
        } catch (err: any) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
      }
    }
  ];
}
