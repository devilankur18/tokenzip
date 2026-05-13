import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { readCodeRange } from '../../utils/code-reader.js';
import path from 'path';

export function createContextTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'get_context_bundle',
      description: "Fetches a symbol's full implementation plus signatures of all symbols it calls directly.",
      inputSchema: {
        type: 'object',
        properties: {
          symbol_name: { type: 'string' },
          symbol_id: { type: 'string' }
        },
        required: ['symbol_name']
      },
      handler: async (args: any) => {
        const { symbol_name, symbol_id } = args;
        
        let q = `
          SELECT 
            *, 
            (SELECT path FROM file WHERE id = $parent.fileId)[0].path as filePath 
          FROM symbol 
          WHERE name = $name
        `;
        if (symbol_id) q += ' AND id = $id';
        
        const results = await store.query<any>(q, { name: symbol_name, id: symbol_id });
        if (results.length === 0) {
          return { content: [{ type: 'text', text: `Symbol not found: ${symbol_name}` }], isError: true };
        }

        const sym = results[0];
        const absPath = path.resolve(repoPath, sym.filePath);
        
        // 1. Get the code for the target symbol
        const code = readCodeRange(absPath, { startLine: sym.startLine, endLine: sym.endLine });

        // 2. Get signatures of everything it calls
        const callees = await store.query<any>(`
          SELECT 
            out.name as name, out.signature as signature, out.kind as kind, 
            (SELECT path FROM file WHERE id = out.fileId)[0].path as filePath
          FROM calls WHERE in = $id
        `, { id: sym.id });

        const response = budget.truncate({
          target: {
            name: sym.name,
            kind: sym.kind,
            filePath: sym.filePath,
            code
          },
          dependencies: callees.map(c => ({
            name: c.name,
            kind: c.kind,
            filePath: c.filePath,
            signature: c.signature || `${c.kind} ${c.name} { /* ... */ }`
          }))
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      }
    }
  ];
}
