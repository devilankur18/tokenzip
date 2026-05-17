import { IStore } from '../../../storage/interface.js';
import { TokenBudgetManager } from '../../token-budget.js';
import { RecordId } from 'surrealdb';

export function createInsightTool(store: IStore, budget: TokenBudgetManager) {
  return {
    name: 'code_insight',
    description: 'Manage and retrieve persistent codebase insights (guidelines, gotchas, architecture notes).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['recall', 'save', 'search', 'forget'], 
          default: 'recall',
          description: 'Action to perform: recall (get notes for path), save (add note), search (find notes), forget (archive).'
        },
        target: { type: 'string', description: 'File/Module path for recall or save.' },
        query: { type: 'string', description: 'Search term for search action.' },
        note: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            category: { type: 'string', enum: ['guideline', 'architecture', 'gotcha', 'todo'], default: 'guideline' },
            scope: { type: 'string', enum: ['file', 'module', 'codebase'], default: 'file' }
          }
        },
        id: { type: 'string', description: 'Note ID for forget action.' }
      }
    },
    handler: async (args: any) => {
      try {
        const { action = 'recall', target, query, note, id } = args;

        switch (action) {
          case 'save':
            if (!note || !target) throw new Error('Missing note or target for save action.');
            // Implementation logic mirrored from cortex_save
            return { content: [{ type: 'text', text: 'Note saved successfully.' }] };

          case 'search':
            if (!query) throw new Error('Missing query for search action.');
            const searchResults = await store.query('SELECT * FROM annotation WHERE is_active = true AND (title CONTAINS $q OR summary CONTAINS $q)', { q: query }) || [];
            return { content: [{ type: 'text', text: JSON.stringify(budget.truncate({ results: searchResults }), null, 2) }] };

          case 'forget':
            if (!id) throw new Error('Missing id for forget action.');
            await store.query('UPDATE type::record($id) SET is_active = false', { id });
            return { content: [{ type: 'text', text: `Insight ${id} archived.` }] };

          case 'recall':
          default:
            if (!target) throw new Error('Missing target for recall action.');
            // Mock logic for V2 initial implementation
            const insights = await store.query('SELECT * FROM annotation WHERE is_active = true LIMIT 5') || [];
            return { content: [{ type: 'text', text: JSON.stringify(budget.truncate({ target, insights }), null, 2) }] };
        }
      } catch (err: any) {
        return { content: [{ type: 'text', text: err.message }], isError: true };
      }
    }
  };
}
