import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { RecordId } from 'surrealdb';

export function createNavigationTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'find_implementations',
      description: 'Find all implementations of a specific interface, class, or abstract member.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol_name: { type: 'string', description: 'Name of the interface or class.' }
        },
        required: ['symbol_name']
      },
      handler: async (args: any) => {
        try {
          const { symbol_name } = args;
          
          const targets = await store.query<any>('SELECT id FROM symbol WHERE name = $name', { name: symbol_name }) || [];
          if (targets.length === 0) {
            return { content: [{ type: 'text', text: `Symbol not found: ${symbol_name}` }], isError: true };
          }
          
          const targetIds = targets.map(t => t.id);
          
          const implementations = await store.query(`
            SELECT *, fileId.path as filePath
            FROM symbol 
            WHERE id IN (SELECT VALUE in FROM implements, inherits WHERE out IN $targets)
          `, { targets: targetIds }) || [];

          const response = budget.truncate({ 
            symbol: symbol_name,
            implementationCount: implementations.length,
            implementations 
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
      name: 'get_call_hierarchy',
      description: 'Retrieve both incoming (callers) and outgoing (callees) for a specific symbol.',
      inputSchema: {
        type: 'object',
        properties: {
          symbol_name: { type: 'string' },
          symbol_id: { type: 'string' }
        },
        required: ['symbol_name']
      },
      handler: async (args: any) => {
        try {
          const { symbol_name, symbol_id } = args;
          
          let targetId;
          let actualName = symbol_name;

          if (symbol_id) {
            if (typeof symbol_id === 'string' && symbol_id.includes(':')) {
              const [table, ...rest] = symbol_id.split(':');
              targetId = new RecordId(table, rest.join(':'));
            } else {
              targetId = symbol_id;
            }
          } else {
            const symbols = await store.query<any>('SELECT id, name FROM symbol WHERE name = $name LIMIT 1', { name: symbol_name }) || [];
            if (symbols.length === 0) {
              return { content: [{ type: 'text', text: `Symbol not found: ${symbol_name}` }], isError: true };
            }
            targetId = symbols[0].id;
            actualName = symbols[0].name;
          }

          const [incoming, outgoing] = await Promise.all([
            store.query(`
              SELECT in.name as name, in.kind as kind, in.fileId.path as filePath, in.id as id
              FROM calls WHERE out = $id
            `, { id: targetId }).then(r => r || []),
            store.query(`
              SELECT out.name as name, out.kind as kind, out.fileId.path as filePath, out.id as id
              FROM calls WHERE in = $id
            `, { id: targetId }).then(r => r || [])
          ]);

          const response = budget.truncate({ 
            symbol: actualName,
            incoming,
            outgoing 
          });

          return {
            content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
          };
        } catch (err: any) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
      }
    },
  ];
}

