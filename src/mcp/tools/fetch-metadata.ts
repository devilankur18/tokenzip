import { IStore } from '../../storage/interface.js';
import { StringRecordId } from 'surrealdb';
import { TokenBudgetManager } from '../token-budget.js';

export function createFetchMetadataTools(store: IStore, budget: TokenBudgetManager) {
  return [
    {
      name: 'fetch_symbol_metadata',
      description: "Fetches documentation and metadata for a list of symbol IDs. Use this when you need detailed context for symbols discovered via 'smart_file_read'.",
      inputSchema: {
        type: 'object',
        properties: {
          ids: { 
            type: 'array', 
            items: { type: 'string' },
            description: "List of symbol IDs (e.g., ['symbol:abc_req_get_method_63'])" 
          }
        },
        required: ['ids']
      },
      handler: async (args: any) => {
        const { ids } = args;
        if (!ids || ids.length === 0) {
          return { content: [{ type: 'text', text: 'No IDs provided' }], isError: true };
        }

        const results: any[] = [];
        for (const id of ids) {
          const recordId = typeof id === 'string' ? new StringRecordId(id) : id;
          const symbolRes = await store.query<any>('SELECT name, kind, docstring, metadata FROM symbol WHERE id = $id LIMIT 1', { id: recordId });
          if (symbolRes.length > 0) {
            results.push(symbolRes[0]);
          }
        }

        const response = budget.truncate({
          count: results.length,
          symbols: results
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
        };
      }
    }
  ];
}
