import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';

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
        const { symbol_name } = args;
        
        const targets = await store.query<any>('SELECT id FROM symbol WHERE name = $name', { name: symbol_name });
        if (targets.length === 0) {
          return { content: [{ type: 'text', text: `Symbol not found: ${symbol_name}` }], isError: true };
        }
        
        const targetIds = targets.map(t => t.id);
        
        const implementations = await store.query(`
          SELECT *, (SELECT path FROM file WHERE id = $parent.fileId)[0].path as filePath
          FROM symbol 
          WHERE id IN (SELECT VALUE in FROM implements, inherits WHERE out IN $targets)
        `, { targets: targetIds });

        const response = budget.truncate({ 
          symbol: symbol_name,
          implementationCount: implementations.length,
          implementations 
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
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
        const { symbol_name, symbol_id } = args;
        
        let q = 'SELECT id, name FROM symbol WHERE name = $name';
        if (symbol_id) q += ' AND id = $id';
        
        const targets = await store.query<any>(q, { name: symbol_name, id: symbol_id });
        if (targets.length === 0) {
          return { content: [{ type: 'text', text: `Symbol not found: ${symbol_name}` }], isError: true };
        }

        const targetId = targets[0].id;

        const [incoming, outgoing] = await Promise.all([
          store.query(`
            SELECT in.name as name, in.kind as kind, (SELECT path FROM file WHERE id = in.fileId)[0].path as filePath, in.id as id
            FROM calls WHERE out = $id
          `, { id: targetId }),
          store.query(`
            SELECT out.name as name, out.kind as kind, (SELECT path FROM file WHERE id = out.fileId)[0].path as filePath, out.id as id
            FROM calls WHERE in = $id
          `, { id: targetId })
        ]);

        const response = budget.truncate({ 
          symbol: targets[0].name,
          incoming,
          outgoing 
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      }
    },
    {
      name: 'get_file_tree',
      description: 'Returns a compact file tree of the repository.',
      inputSchema: {
        type: 'object',
        properties: {
          depth: { type: 'number', default: 2 }
        }
      },
      handler: async (args: any) => {
        const { depth = 2 } = args;
        
        // This is a simplified version that just lists all files
        // A real tree would be recursive, but SurrealDB can handle it
        const files = await store.query('SELECT path, size_bytes, language FROM file LIMIT 1000');
        
        const response = budget.truncate({ 
          fileCount: files.length,
          files 
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      }
    }
  ];
}
