import { IStore } from '../../../storage/interface.js';
import { TokenBudgetManager } from '../../token-budget.js';

export function createTraceTool(store: IStore, budget: TokenBudgetManager) {
  return {
    name: 'code_trace_flow',
    description: 'Trace the execution flow and dependencies of a symbol. Shows who calls it, what it calls, and its implementations.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Symbol name or ID.' },
        direction: { type: 'string', enum: ['in', 'out', 'both'], default: 'both', description: 'Trace incoming (callers), outgoing (callees), or both.' }
      },
      required: ['target']
    },
    handler: async (args: any) => {
      try {
        let { target, direction = 'both' } = args;
        if (!['in', 'out', 'both'].includes(direction)) {
          direction = 'both';
        }
        
        const symbols = await store.query<any>('SELECT id, name FROM symbol WHERE name = $name LIMIT 1', { name: target }) || [];
        if (symbols.length === 0) {
          return { content: [{ type: 'text', text: `Symbol not found: ${target}` }], isError: true };
        }
        const targetId = symbols[0].id;

        const results: any = { 
          symbol: target,
          incoming: [],
          references: [],
          outgoing: [],
          implementations: []
        };

        if (direction === 'in' || direction === 'both') {
          results.incoming = await store.query(`
            SELECT in.name as name, in.kind as kind, in.fileId.path as filePath
            FROM calls WHERE out = $id
          `, { id: targetId }).then(r => Array.isArray(r) ? r : []);
          
          results.references = await store.query(`
            SELECT in.name as name, in.kind as kind, in.fileId.path as filePath
            FROM references WHERE out = $id
          `, { id: targetId }).then(r => Array.isArray(r) ? r : []);
        }

        if (direction === 'out' || direction === 'both') {
          results.outgoing = await store.query(`
            SELECT out.name as name, out.kind as kind, out.fileId.path as filePath
            FROM calls WHERE in = $id
          `, { id: targetId }).then(r => Array.isArray(r) ? r : []);
        }

        // Always check for implementations/inheritance
        results.implementations = await store.query(`
          SELECT in.name as name, in.kind as kind, in.fileId.path as filePath
          FROM implements, inherits WHERE out = $id
        `, { id: targetId }).then(r => Array.isArray(r) ? r : []);

        const response = budget.truncate(results);
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: err.message }], isError: true };
      }
    }
  };
}
