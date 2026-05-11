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
        const q = createQuery(store, repoPath).symbol(args.symbol_name);
        const symbols = await q.toArray();
        const response = budget.truncate({ symbols });
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      },
    }
  ];
}
