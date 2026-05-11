import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { createQuery } from '../../query/builder.js';

export function createStructureTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'query_repo_structure',
      description: 'Get an overview of the repository files and modules.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        const q = createQuery(store, repoPath).files();
        const files = await q.toArray();
        const response = budget.truncate({ files });
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      },
    }
  ];
}
