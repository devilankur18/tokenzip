import { IStore } from '../../../storage/interface.js';
import { TokenBudgetManager } from '../../token-budget.js';
import { RecordId } from 'surrealdb';
import path from 'path';

// 1. REMEMBER INSTRUCTION
export function createRememberTool(store: IStore) {
  return {
    name: 'remember_instruction',
    description: 'Save a persistent development guideline, architecture note, gotcha, or todo for a specific file, module (directory), or global codebase. Scope inheritance will make it visible to descendants.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'File or folder path relative to repo root (use "*" or root path for codebase scope).' },
        title: { type: 'string', description: 'Short, descriptive title of the instruction.' },
        summary: { type: 'string', description: 'Dense 1-3 sentence summary of the rule/knowledge.' },
        category: {
          type: 'string',
          enum: ['guideline', 'architecture', 'gotcha', 'todo'],
          default: 'guideline',
          description: 'Category of instruction.'
        },
        scope: {
          type: 'string',
          enum: ['file', 'module', 'codebase'],
          default: 'file',
          description: 'Inheritance scope: file (strict), module (recursive directory), codebase (global).'
        },
        details: { type: 'string', description: 'Optional extended context or code examples.' }
      },
      required: ['target', 'title', 'summary', 'category', 'scope']
    },
    handler: async (args: any) => {
      try {
        const { target, title, summary, category = 'guideline', scope = 'file', details } = args;

        if (!target || !title || !summary) {
          throw new Error('Missing target, title, or summary.');
        }

        // 1. Get current content hash if target is a file
        let targetHash: string | undefined;
        if (scope === 'file') {
          const fileRes = await store.query<any>('SELECT content_hash FROM file WHERE path = $path LIMIT 1', { path: target }) || [];
          if (fileRes.length > 0) targetHash = fileRes[0].content_hash;
        }

        // 2. Create the annotation node
        const annotationData: any = {
          category,
          title,
          summary,
          details,
          source: 'developer',
          confidence: 1.0,
          priority: category === 'gotcha' ? 'important' : 'normal',
          target_hash: targetHash,
          is_active: true
        };

        // Clean up undefined/nulls
        for (const key of Object.keys(annotationData)) {
          if (annotationData[key] === undefined || annotationData[key] === null) {
            delete annotationData[key];
          }
        }

        const [annotation] = await store.query<any>('CREATE annotation CONTENT $data', { data: annotationData });

        if (!annotation) {
          throw new Error('Failed to create annotation record.');
        }

        // 3. Link to target
        let targetId: string | undefined;
        if (scope === 'codebase') {
          const repos = await store.query<any>('SELECT id FROM repository LIMIT 1') || [];
          if (repos.length > 0) targetId = repos[0].id;
        } else if (scope === 'module') {
          const modRes = await store.query<any>('SELECT id FROM module WHERE path = $path LIMIT 1', { path: target }) || [];
          targetId = modRes[0]?.id;
        } else if (scope === 'file') {
          const fileRes = await store.query<any>('SELECT id FROM file WHERE path = $path LIMIT 1', { path: target }) || [];
          targetId = fileRes[0]?.id;
        }

        if (targetId) {
          await store.query(
            'RELATE $ann->scoped_to->$target SET scope_type = $scope',
            { ann: annotation.id, target: targetId, scope }
          );
          await store.query(
            'RELATE $target->tagged_with->$ann',
            { ann: annotation.id, target: targetId }
          );
        } else {
          // Fallback: if node not in graph yet, link to codebase repository
          const repos = await store.query<any>('SELECT id FROM repository LIMIT 1') || [];
          if (repos.length > 0) {
            await store.query(
              'RELATE $ann->scoped_to->$target SET scope_type = "codebase"',
              { ann: annotation.id, target: repos[0].id }
            );
          }
        }

        return {
          content: [{
            type: 'text',
            text: `Successfully saved rule: ${annotation.id.toString()}\nScope: ${scope}\nTarget: ${target}`
          }]
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error saving instruction: ${err.message}` }], isError: true };
      }
    }
  };
}

// 2. RECALL INSTRUCTION
export function createRecallTool(store: IStore, budget: TokenBudgetManager) {
  return {
    name: 'recall_instruction',
    description: 'Retrieve active guidelines, gotchas, architecture notes, and instructions relevant to a given target path. Automatically inherits global and parent-folder instructions.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'File or folder path relative to repo root to recall instructions for.' },
        category: { type: 'string', enum: ['guideline', 'architecture', 'gotcha', 'todo'], description: 'Optional category filter.' }
      },
      required: ['target']
    },
    handler: async (args: any) => {
      try {
        const { target, category } = args;

        if (!target) {
          throw new Error('Missing target parameter for recall.');
        }

        // Resolve ancestors path
        const paths: string[] = [target];
        let currentPath = target;
        while (currentPath.includes('/')) {
          currentPath = path.dirname(currentPath);
          if (currentPath !== '.' && currentPath !== '/') {
            paths.push(currentPath);
          }
        }

        let query = `
          SELECT 
            id, category, title, summary, details, priority, confidence, source, tags, target_hash
          FROM annotation 
          WHERE is_active = true 
            AND count(->scoped_to->(file, module, repository)[WHERE path IN $paths OR type = 'repository']) > 0
        `;

        if (category) {
          query += ' AND category = $category';
        }

        query += ' ORDER BY priority DESC, confidence DESC';

        const notes = await store.query<any>(query, { paths, category }) || [];

        const processedNotes = [];
        for (const note of notes) {
          let stalenessNote = '';
          if (note.target_hash) {
            const fileRes = await store.query<any>('SELECT content_hash FROM file WHERE path = $target LIMIT 1', { target }) || [];
            if (fileRes.length > 0 && fileRes[0].content_hash !== note.target_hash) {
              stalenessNote = ' [⚠️ STALE]';
            }
          }

          processedNotes.push({
            id: note.id.toString(),
            category: note.category,
            title: note.title + stalenessNote,
            summary: note.summary,
            details: note.details,
            priority: note.priority,
            tags: note.tags || []
          });

          // Update access count in background
          store.query('UPDATE $id SET access_count += 1, last_accessed = time::now()', { id: note.id }).catch(() => {});
        }

        const response = budget.truncate({ target, instructions: processedNotes });

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error recalling instructions: ${err.message}` }], isError: true };
      }
    }
  };
}

// 3. FORGET INSTRUCTION
export function createForgetTool(store: IStore) {
  return {
    name: 'forget_instruction',
    description: 'Archive/remove an instruction by its Record ID so it is no longer retrieved.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The annotation Record ID to archive (e.g. "annotation:xyz").' },
        reason: { type: 'string', description: 'Optional reason for archiving/forgetting.' }
      },
      required: ['id']
    },
    handler: async (args: any) => {
      try {
        const { id, reason } = args;
        if (!id) {
          throw new Error('Missing record ID.');
        }

        await store.query('UPDATE type::record($id) SET is_active = false, removal_reason = $reason', { id, reason });
        
        return {
          content: [{ type: 'text', text: `Successfully archived instruction: ${id}` }]
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error archiving instruction: ${err.message}` }], isError: true };
      }
    }
  };
}

// 4. SEARCH INSTRUCTION
export function createSearchTool(store: IStore, budget: TokenBudgetManager) {
  return {
    name: 'search_instruction',
    description: 'Perform global keyword search over all active persistent instructions in the codebase by title or summary.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords to match against instruction title or summary.' },
        category: { type: 'string', enum: ['guideline', 'architecture', 'gotcha', 'todo'], description: 'Optional category filter.' }
      },
      required: ['query']
    },
    handler: async (args: any) => {
      try {
        const { query, category } = args;
        if (!query) {
          throw new Error('Missing search query.');
        }

        let q = 'SELECT id, category, title, summary, details, priority, tags FROM annotation WHERE is_active = true AND (title CONTAINS $query OR summary CONTAINS $query OR details CONTAINS $query)';
        const vars: any = { query };

        if (category) {
          q += ' AND category = $category';
          vars.category = category;
        }

        const results = await store.query<any>(q, vars) || [];
        const serialized = results.map((r: any) => ({
          ...r,
          id: r.id.toString()
        }));

        const response = budget.truncate({ query, results: serialized });

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error searching instructions: ${err.message}` }], isError: true };
      }
    }
  };
}
