import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { createQuery } from '../../query/builder.js';
import { readCodeRange } from '../../utils/code-reader.js';
import path from 'path';

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
        try {
          const symbols = await store.query<any>('SELECT *, (SELECT path FROM file WHERE id = $parent.fileId)[0].path as filePath FROM symbol WHERE name = $name', { name: args.symbol_name }) || [];
          
          if (symbols.length > 1) {
            const candidates = symbols.map(s => ({
              id: s.id,
              kind: s.kind,
              filePath: s.filePath,
              signature: s.signature
            }));
            return {
              content: [{ 
                type: 'text', 
                text: JSON.stringify({
                  error: `Multiple symbols found for '${args.symbol_name}'.`,
                  message: "Please specify symbol_id in your next call.",
                  candidates
                }, null, 2)
              }],
              isError: true
            };
          }

          const response = budget.truncate({ symbols });
          return {
            content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          };
        } catch (err: any) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
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
        try {
          const { normalizePath } = await import('../../utils/path-utils.js');
          const normalizedPath = normalizePath(args.file_path);
          const fileRes = await store.query<any>('SELECT id FROM file WHERE path = $path LIMIT 1', { path: normalizedPath }) || [];
          if (fileRes.length === 0) {
            return { content: [{ type: 'text', text: `File not found: ${args.file_path}` }], isError: true };
          }
          
          const fileId = fileRes[0].id;
          // Find all modules/files imported by this file
          const imports = await store.query('SELECT out as target FROM imports WHERE in = $fileId FETCH target', { fileId }) || [];
          const dependencies = imports.map((i: any) => i.target).sort((a: any, b: any) => (a.path || a.name || '').localeCompare(b.path || b.name || ''));
          
          const response = budget.truncate({ file: normalizedPath, dependencies });
          return {
            content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          };
        } catch (err: any) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
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
        try {
          // Find the target symbols first
          const targets = await store.query<any>('SELECT id FROM symbol WHERE name = $name', { name: args.symbol_name }) || [];
          if (targets.length === 0) {
            return { content: [{ type: 'text', text: `Symbol not found: ${args.symbol_name}` }], isError: true };
          }
          
          const targetIds = targets.map(t => t.id);
          
          // Find symbols that have ANY of these relations to our targets
          const [r1, r2, r3, r4] = await Promise.all([
            store.query<any>('SELECT VALUE in FROM calls WHERE out IN $targets', { targets: targetIds }).then(r => r || []),
            store.query<any>('SELECT VALUE in FROM inherits WHERE out IN $targets', { targets: targetIds }).then(r => r || []),
            store.query<any>('SELECT VALUE in FROM implements WHERE out IN $targets', { targets: targetIds }).then(r => r || []),
            store.query<any>('SELECT VALUE in FROM references WHERE out IN $targets', { targets: targetIds }).then(r => r || [])
          ]);
          
          const allIds = Array.from(new Set([...r1, ...r2, ...r3, ...r4]));
          
          const callers = await store.query(`
            SELECT *, (SELECT path FROM file WHERE id = $parent.fileId)[0].path as filePath
            FROM symbol
            WHERE id IN $ids
          `, { ids: allIds }) || [];
          
          callers.sort((a: any, b: any) => (a.filePath || '').localeCompare(b.filePath || '') || a.startLine - b.startLine);
          
          const response = budget.truncate({ 
            symbol: args.symbol_name, 
            referenceCount: callers.length,
            references: callers 
          });
          
          return {
            content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          };
        } catch (err: any) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
      },
    },
    {
      name: 'read_symbol',
      description: 'Get the full source code for a specific symbol.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol_name: { type: 'string' },
          symbol_id: { type: 'string', description: 'Optional ID if multiple symbols have the same name' }
        },
        required: ['symbol_name'],
      },
      handler: async (args: any) => {
        try {
          let q = `
            SELECT 
              id, name, kind, startLine, endLine, 
              (SELECT path FROM file WHERE id = $parent.fileId)[0].path AS filePath
            FROM symbol 
            WHERE name = $name
          `;
          
          if (args.symbol_id) {
            q += ' AND id = $id';
          }
          
          const results = await store.query<any>(q, { name: args.symbol_name, id: args.symbol_id }) || [];

          if (results.length === 0) {
            return { content: [{ type: 'text', text: `Symbol not found: ${args.symbol_name}` }], isError: true };
          }

          if (results.length > 1 && !args.symbol_id) {
            const options = results.map(s => `${s.id} (${s.kind} in ${s.filePath})`).join('\n');
            return { content: [{ type: 'text', text: `Multiple symbols found. Please specify symbol_id:\n${options}` }], isError: true };
          }

          const sym = results[0];
          const absolutePath = path.resolve(repoPath, sym.filePath);
          
          try {
            const code = readCodeRange(absolutePath, { 
              startLine: sym.startLine, 
              endLine: sym.endLine 
            });
            
            const response = budget.truncate({
              id: sym.id,
              name: sym.name,
              filePath: sym.filePath,
              range: { start: sym.startLine, end: sym.endLine },
              code
            });

            return {
              content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
            };
          } catch (err: any) {
            return { content: [{ type: 'text', text: `Error reading file: ${err.message}` }], isError: true };
          }
        } catch (err: any) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
      },
    }
  ];
}
