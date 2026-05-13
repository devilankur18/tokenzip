import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { createQuery } from '../../query/builder.js';
import { RecordId } from 'surrealdb';
import { SurrealStore } from '../../storage/surreal/store.js';

export function createStructureTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'query_repo_structure',
      description: 'Get a hierarchical overview of the repository (Modules -> Files -> Symbols).',
      inputSchema: {
        type: 'object',
        properties: {
          depth: { type: 'number', default: 2, description: 'Depth of the hierarchy to explore' }
        },
        required: [],
      },
      handler: async (args: any) => {
        const depth = args.depth ?? 2;

        const repos = await store.query<any>(`SELECT id, name, type, path FROM repository LIMIT 1`);
        if (repos.length === 0) {
          return { content: [{ type: 'text', text: 'Repository not initialized. Run `tokenzip init` and `tokenzip parse` first.' }], isError: true };
        }
        
        const rootId = repos[0].id.toString();
        
        // Fetch all contains edges (the graph is small enough to do this in one shot)
        const allEdges = await store.query<any[]>(`SELECT * FROM contains`) || [];
        
        // Collect all unique node IDs involved in the structure
        const nodeIds = new Set<string>();
        nodeIds.add(rootId);
        for (const edge of allEdges) {
          if (edge.out) nodeIds.add(edge.out.toString());
          if (edge.in) nodeIds.add(edge.in.toString());
        }

        // Fetch all nodes
        const idsAsRecords = Array.from(nodeIds).map(id => {
          if (id.includes(':')) {
            const [table, ...rest] = id.split(':');
            return new RecordId(table, rest.join(':'));
          }
          return id;
        });

        const allNodes = (await store.query<any[]>(`SELECT * FROM $ids`, { ids: idsAsRecords })) || [];
        
        // Build the tree in memory
        const nodeMap = new Map<string, any>();
        for (const node of allNodes) {
          if (!node || !node.id) continue;
          const id = node.id.toString();
          nodeMap.set(id, {
            id: id,
            name: node.name,
            type: node.type,
            path: node.path,
            kind: node.kind,
            children: []
          });
        }

        // Build parent-child relationships semantically
        const typeRank: Record<string, number> = {
          'repository': 1,
          'module': 2,
          'file': 3,
          'symbol': 4
        };

        for (const edge of allEdges) {
          if (!edge.out || !edge.in) continue;
          const fromId = edge.out.toString();
          const toId = edge.in.toString();
          const fromNode = nodeMap.get(fromId);
          const toNode = nodeMap.get(toId);
          
          if (fromNode && toNode) {
            const fromRank = typeRank[fromNode.type] || 99;
            const toRank = typeRank[toNode.type] || 99;
            
            if (fromRank < toRank) {
              // Check if toNode is a direct child (depth limit logic)
              // For now, we'll build the whole tree and prune later if needed, 
              // or just keep it since budget manager handles truncation.
              if (!fromNode.children.some((c: any) => c.id === toNode.id)) {
                fromNode.children.push(toNode);
              }
            } else if (toRank < fromRank) {
              if (!toNode.children.some((c: any) => c.id === fromNode.id)) {
                toNode.children.push(fromNode);
              }
            }
          }
        }

        const tree = nodeMap.get(rootId);
        
        // Apply depth limit to the built tree
        const pruneToDepth = (node: any, currentDepth: number) => {
          if (currentDepth >= depth) {
            node.children = [];
            return;
          }
          for (const child of node.children) {
            pruneToDepth(child, currentDepth + 1);
          }
        };
        
        if (tree) pruneToDepth(tree, 0);

        const response = budget.truncate({ structure: tree });
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      },
    },
    {
      name: 'get_codebase_stats',
      description: 'Get high-level statistics about the codebase (file count, symbol count, etc.).',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        const stats = await store.stats();
        return {
          content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
        };
      },
    },
    {
      name: 'get_file_symbols',
      description: 'List all symbols (functions, classes, etc.) in a specific file.',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Relative path to the file' }
        },
        required: ['file_path'],
      },
      handler: async (args: any) => {
        // Find file node first to get its ID
        const fileRes = await store.query<any>('SELECT id FROM file WHERE path = $path LIMIT 1', { path: args.file_path });
        if (fileRes.length === 0) {
          return {
            content: [{ type: 'text', text: `File not found: ${args.file_path}` }],
            isError: true
          };
        }
        
        const fileId = fileRes[0].id;
        const symbols = await store.query('SELECT * FROM symbol WHERE fileId = $fileId', { fileId });
        
        const response = budget.truncate({ file: args.file_path, symbols });
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      },
    }
  ];
}
