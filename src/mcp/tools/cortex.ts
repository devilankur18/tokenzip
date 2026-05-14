import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { RecordId, StringRecordId } from 'surrealdb';
import path from 'path';
import { fileCache } from '../../utils/file-cache.js';

export async function injectCortex(filePath: string, store: IStore, budget: TokenBudgetManager): Promise<any> {
  try {
    // Upward traversal for paths
    const paths: string[] = [filePath];
    let currentPath = filePath;
    while (currentPath.includes('/')) {
      currentPath = path.dirname(currentPath);
      if (currentPath !== '.' && currentPath !== '/') {
        paths.push(currentPath);
      }
    }

    // Only high confidence/critical notes for auto-recall
    const query = `
      SELECT 
        category, title, summary, priority, confidence, target_hash
      FROM annotation 
      WHERE is_active = true 
        AND confidence >= 0.8
        AND count(->scoped_to->(file, module, repository)[WHERE path IN $paths OR type = 'repository']) > 0
      ORDER BY priority DESC, confidence DESC
      LIMIT 5
    `;

    const notes = await store.query<any>(query, { paths });
    if (notes.length === 0) return undefined;

    // Check for staleness against current file
    const fileRes = await store.query<any>('SELECT content_hash FROM file WHERE path = $path LIMIT 1', { path: filePath });
    const currentHash = fileRes[0]?.content_hash;

    const formattedNotes = notes.map((n: any) => {
      let prefix = `[${n.priority.toUpperCase()}·${n.category}]`;
      if (n.target_hash && currentHash && n.target_hash !== currentHash) {
        prefix += ' [⚠️ STALE]';
      }
      return `${prefix} ${n.title}: ${n.summary}`;
    });

    return {
      notes: formattedNotes.slice(0, 3), // Max 3 for auto-recall
      more_available: notes.length > 3
    };
  } catch (err) {
    return undefined;
  }
}

export function createCortexTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'cortex_save',
      description: 'Save a structured note (guideline, architecture note, gotcha, etc.) to the code graph. Notes are persistent across sessions and scoped to specific files, modules, or the entire codebase.',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['guideline', 'architecture', 'gotcha', 'traversal_hint', 'workflow', 'todo'],
            description: 'The type of knowledge being saved.'
          },
          title: { type: 'string', description: 'Short, descriptive title.' },
          summary: { type: 'string', description: 'Dense 1-3 sentence summary of the core knowledge.' },
          details: { type: 'string', description: 'Optional extended context or implementation details.' },
          scope: {
            type: 'string',
            enum: ['codebase', 'module', 'file', 'symbol'],
            description: 'The logical scope of this note.'
          },
          targets: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of paths or symbol names this note applies to. For codebase scope, use ["*"].'
          },
          tags: { type: 'array', items: { type: 'string' } },
          priority: {
            type: 'string',
            enum: ['critical', 'important', 'normal', 'low'],
            default: 'normal'
          },
          confidence: { type: 'number', minimum: 0, maximum: 1, default: 1.0 },
          source: {
            type: 'string',
            enum: ['developer', 'agent', 'traversal'],
            default: 'agent'
          },
          supersedes: { type: 'string', description: 'ID of a previous note this replaces.' },
          read_order: { type: 'array', items: { type: 'string' }, description: 'Used for traversal_hint category.' },
          skip_paths: { type: 'array', items: { type: 'string' }, description: 'Used for traversal_hint category.' }
        },
        required: ['category', 'title', 'summary', 'scope', 'targets']
      },
      handler: async (args: any) => {
        try {
          // 1. Get current content hash if targets include files
          let targetHash: string | undefined;
          if (args.scope === 'file' && args.targets.length > 0) {
            const fileRes = await store.query<any>('SELECT content_hash FROM file WHERE path = $path LIMIT 1', { path: args.targets[0] });
            if (fileRes.length > 0) targetHash = fileRes[0].content_hash;
          }

          // 2. Create the annotation node
          const annotationData: any = {
            category: args.category,
            title: args.title,
            summary: args.summary,
            details: args.details,
            source: args.source,
            confidence: args.confidence,
            tags: args.tags || [],
            priority: args.priority,
            target_hash: targetHash,
            read_order: args.read_order || [],
            skip_paths: args.skip_paths || [],
            supersedes: args.supersedes ? new RecordId('annotation', args.supersedes) : undefined,
            is_active: true
          };

          // Clean up undefined/nulls to let SurrealDB defaults kick in
          for (const key of Object.keys(annotationData)) {
            if (annotationData[key] === undefined || annotationData[key] === null) {
              delete annotationData[key];
            }
          }

          const [annotation] = await store.query<any>('CREATE annotation CONTENT $data', { data: annotationData });

          // 3. Link to targets
          for (const target of args.targets) {
            let targetId: string | undefined;

            if (args.scope === 'codebase') {
              const repos = await store.query<any>('SELECT id FROM repository LIMIT 1');
              if (repos.length > 0) targetId = repos[0].id;
            } else if (args.scope === 'module') {
              const modRes = await store.query<any>('SELECT id FROM module WHERE path = $path LIMIT 1', { path: target });
              targetId = modRes[0]?.id;
            } else if (args.scope === 'file') {
              const fileRes = await store.query<any>('SELECT id, content_hash FROM file WHERE path = $path LIMIT 1', { path: target });
              targetId = fileRes[0]?.id;
              if (fileRes[0]?.content_hash) targetHash = fileRes[0].content_hash;
            } else if (args.scope === 'symbol') {
              const symRes = await store.query<any>('SELECT id FROM symbol WHERE name = $name LIMIT 1', { name: target });
              targetId = symRes[0]?.id;
            }

            if (targetId) {
              await store.query(
                'RELATE $ann->scoped_to->$target SET scope_type = $scope',
                { ann: annotation.id, target: targetId, scope: args.scope }
              );
              await store.query(
                'RELATE $target->tagged_with->$ann',
                { ann: annotation.id, target: targetId }
              );
            }
          }

          if (args.supersedes) {
            await store.query('UPDATE annotation SET is_active = false WHERE id = $id', { id: new RecordId('annotation', args.supersedes) });
          }

          return {
            content: [{ type: 'text', text: `Successfully saved note: ${annotation.id}\nTitle: ${annotation.title}` }]
          };
        } catch (err: any) {
          return { content: [{ type: 'text', text: `Error saving note: ${err.message}` }], isError: true };
        }
      }
    },
    {
      name: 'cortex_recall',
      description: 'Retrieve relevant notes for a specific file or module path. Uses scope inheritance to find guidelines and architecture knowledge from parent modules or the whole codebase.',
      inputSchema: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'File path or module path to recall knowledge for.' },
          categories: { type: 'array', items: { type: 'string' }, description: 'Filter by note category.' },
          max_tokens: { type: 'number', default: 2000, description: 'Token budget for the recall response.' }
        },
        required: ['target']
      },
      handler: async (args: any) => {
        try {
          const { target, categories, max_tokens = 2000 } = args;

          // 1. Resolve target IDs and parent paths for inheritance
          const paths: string[] = [target];
          let currentPath = target;
          while (currentPath.includes('/')) {
            currentPath = path.dirname(currentPath);
            if (currentPath !== '.' && currentPath !== '/') {
              paths.push(currentPath);
            }
          }

          // 2. Query for annotations linked to these paths or codebase-wide
          const query = `
            SELECT 
              id, category, title, summary, details, priority, confidence, source, tags, target_hash
            FROM annotation 
            WHERE is_active = true 
              AND count(->scoped_to->(file, module, repository)[WHERE path IN $paths OR type = 'repository']) > 0
              ${categories ? 'AND category IN $categories' : ''}
            ORDER BY priority DESC, confidence DESC
          `;

          const notes = await store.query<any>(query, { paths, categories });

          // 3. Process staleness and update access count
          const processedNotes = [];
          for (const note of notes) {
            let stalenessNote = '';
            if (note.target_hash) {
              const fileRes = await store.query<any>('SELECT content_hash FROM file WHERE path = $target LIMIT 1', { target });
              if (fileRes.length > 0 && fileRes[0].content_hash !== note.target_hash) {
                stalenessNote = ' [⚠️ STALE]';
              }
            }

            processedNotes.push({
              id: note.id,
              category: note.category,
              title: note.title + stalenessNote,
              summary: note.summary,
              details: note.details,
              priority: note.priority,
              confidence: note.confidence,
              tags: note.tags
            });

            // Update access count in background
            store.query('UPDATE $id SET access_count += 1, last_accessed = time::now()', { id: note.id }).catch(() => {});
          }

          const response = budget.truncate({ target, notes: processedNotes }, max_tokens);

          return {
            content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
          };
        } catch (err: any) {
          return { content: [{ type: 'text', text: `Error recalling notes: ${err.message}` }], isError: true };
        }
      }
    },
    {
      name: 'cortex_search',
      description: 'Search for notes across the entire codebase by keyword, tag, or category.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search for in titles and summaries.' },
          category: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number', default: 20 }
        }
      },
      handler: async (args: any) => {
        try {
          const { query, category, tags, limit = 20 } = args;
          let q = 'SELECT * FROM annotation WHERE is_active = true';
          const vars: any = { limit };

          if (query) {
            q += ' AND (title CONTAINS $query OR summary CONTAINS $query)';
            vars.query = query;
          }
          if (category) {
            q += ' AND category = $category';
            vars.category = category;
          }
          if (tags && tags.length > 0) {
            q += ' AND tags CONTAINSALL $tags';
            vars.tags = tags;
          }

          q += ' LIMIT $limit';

          const results = await store.query<any>(q, vars);
          const response = budget.truncate({ query, results });

          return {
            content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
          };
        } catch (err: any) {
          return { content: [{ type: 'text', text: `Error searching notes: ${err.message}` }], isError: true };
        }
      }
    },
    {
      name: 'cortex_remove',
      description: 'Archive a note that is no longer relevant or has been superseded.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The ID of the note to remove.' },
          reason: { type: 'string', description: 'Reason for removal.' }
        },
        required: ['id']
      },
      handler: async (args: any) => {
        try {
          await store.query('UPDATE type::record($id) SET is_active = false, removal_reason = $reason', { id: args.id, reason: args.reason });
          return { content: [{ type: 'text', text: `Note ${args.id} archived.` }] };
        } catch (err: any) {
          return { content: [{ type: 'text', text: `Error removing note: ${err.message}` }], isError: true };
        }
      }
    },
    {
      name: 'cortex_suggest',
      description: 'Log an improvement suggestion for the tool developer (e.g., missing tool, repetitive task).',
      inputSchema: {
        type: 'object',
        properties: {
          problem: { type: 'string' },
          proposed_solution: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
          related_targets: { type: 'array', items: { type: 'string' } }
        },
        required: ['problem', 'proposed_solution']
      },
      handler: async (args: any) => {
        try {
          const suggestionData: any = {
            problem: args.problem,
            proposed: args.proposed_solution,
            severity: args.severity,
            related_targets: args.related_targets || [],
            status: 'new'
          };

          for (const key of Object.keys(suggestionData)) {
            if (suggestionData[key] === undefined || suggestionData[key] === null) {
              delete suggestionData[key];
            }
          }

          const [suggestion] = await store.query<any>('CREATE suggestion CONTENT $data', {
            data: suggestionData
          });

          // Link to related targets if possible
          if (args.related_targets) {
            for (const target of args.related_targets) {
              // Try to find target ID
              const res = await store.query<any>('SELECT id FROM file, module, symbol, repository WHERE path = $target OR name = $target LIMIT 1', { target });
              if (res.length > 0) {
                await store.query('RELATE $sug->relates_to->$target', { sug: suggestion.id, target: res[0].id });
              }
            }
          }

          return { content: [{ type: 'text', text: `Suggestion logged: ${suggestion.id}` }] };
        } catch (err: any) {
          return { content: [{ type: 'text', text: `Error logging suggestion: ${err.message}` }], isError: true };
        }
      }
    },
    {
      name: 'cortex_traverse',
      description: 'Get an optimized file reading order for understanding a module or feature area. Combines stored traversal hints with dependency graph analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Module path or feature area (e.g., "src/auth/").' },
          purpose: {
            type: 'string',
            enum: ['understand', 'implement_feature', 'fix_bug', 'refactor'],
            default: 'understand'
          }
        },
        required: ['target']
      },
      handler: async (args: any) => {
        try {
          const { target, purpose } = args;

          // 1. Check for stored traversal hints
          const hintQuery = `
            SELECT id, title, summary, read_order, skip_paths, access_count
            FROM annotation
            WHERE is_active = true 
              AND category = 'traversal_hint'
              AND count(->scoped_to->(module, repository)[WHERE path = $target OR type = 'repository']) > 0
            ORDER BY access_count DESC
            LIMIT 1
          `;
          const hints = await store.query<any>(hintQuery, { target });

          if (hints.length > 0) {
            const hint = hints[0];
            store.query('UPDATE $id SET access_count += 1, last_accessed = time::now()', { id: hint.id }).catch(() => {});
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  source: 'stored_hint',
                  title: hint.title,
                  summary: hint.summary,
                  recommended_read_order: hint.read_order,
                  suggested_skip_paths: hint.skip_paths
                }, null, 2)
              }]
            };
          }

          // 2. Graph fallback: Find entry points and 1st level deps
          const modRes = await store.query<any>('SELECT id FROM module WHERE path = $target LIMIT 1', { target });
          if (modRes.length === 0) {
             return { content: [{ type: 'text', text: `Module ${target} not found.` }], isError: true };
          }
          const moduleId = modRes[0].id;

          const filesQuery = `
            SELECT path, (SELECT count() FROM <-imports WHERE out.type = 'file' AND in.id = $parent.id) as incoming_deps
            FROM file
            WHERE module_id = $moduleId
            ORDER BY incoming_deps ASC
            LIMIT 10
          `;
          const files = await store.query<any>(filesQuery, { moduleId });

          const plan = {
            source: 'graph_analysis',
            purpose,
            recommended_read_order: files.filter((f: any) => f.incoming_deps === 0 || f.path.includes('index')).map((f: any) => f.path),
            on_demand: files.filter((f: any) => f.incoming_deps > 0 && !f.path.includes('index')).map((f: any) => f.path),
            note: 'No stored traversal hint found. Plan generated from dependency graph analysis.'
          };

          return {
            content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }]
          };
        } catch (err: any) {
          return { content: [{ type: 'text', text: `Error generating traversal plan: ${err.message}` }], isError: true };
        }
      }
    }
  ];
}
