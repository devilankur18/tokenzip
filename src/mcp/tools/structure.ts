import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { createQuery } from '../../query/builder.js';
import { RecordId } from 'surrealdb';
import { SurrealStore } from '../../storage/surreal/store.js';

function getIcon(type: string, kind?: string): string {
  if (type === 'repository') return '🏠';
  if (type === 'package' || type === 'module_root') return '📦';
  if (type === 'module') return '📂';
  if (type === 'file') return '📄';
  if (type === 'symbol') {
    switch (kind) {
      case 'function':
      case 'method':
        return '𝑓';
      case 'class':
        return '🏛️';
      case 'interface':
      case 'type':
        return '🔷';
      case 'variable':
      case 'const':
      case 'let':
        return '𝑥';
      default:
        return '💎';
    }
  }
  return '📁';
}

function formatTree(node: any, prefix: string = '', isLast: boolean = true, isRoot: boolean = true): string {
  const icon = getIcon(node.type, node.kind);
  let label = node.name || (node.type === 'repository' ? 'root' : 'unknown');
  
  // Add annotations for files (exported symbols)
  if (node.type === 'file' && node.exportedSymbols && node.exportedSymbols.length > 0) {
    const exports = node.exportedSymbols.map((s: any) => `${getIcon(s.type, s.kind)} ${s.name}`).join(', ');
    label += ` [${exports}]`;
  }

  // Add annotations for summarized directories
  if (node.filesSummarized && node.stats) {
    label += ` (contains ${node.stats.files} files)`;
  }


  let line = '';
  if (isRoot) {
    line = `${icon} ${label}\n`;
  } else {
    line = `${prefix}${isLast ? '└── ' : '├── '}${icon} ${label}\n`;
  }
  
  let result = line;
  // We no longer return early here because we want to show sub-directories even if files are summarized


  const newPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
  
  const sortedChildren = [...node.children].sort((a, b) => {
    const typeOrder: Record<string, number> = { 'package': 1, 'module_root': 1, 'module': 2, 'file': 3, 'symbol': 4 };
    const aOrder = typeOrder[a.type] || 99;
    const bOrder = typeOrder[b.type] || 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.name || '').localeCompare(b.name || '');
  });

  for (let i = 0; i < sortedChildren.length; i++) {
    const child = sortedChildren[i];
    const lastChild = i === sortedChildren.length - 1;
    result += formatTree(child, newPrefix, lastChild, false);
  }
  
  return result;
}

function formatMarkdown(node: any, depth: number = 0): string {
  const icon = getIcon(node.type, node.kind);
  let label = node.name || (node.type === 'repository' ? 'root' : 'unknown');
  const indent = '  '.repeat(depth);
  
  if (node.type === 'file' && node.exportedSymbols && node.exportedSymbols.length > 0) {
    const exports = node.exportedSymbols.map((s: any) => `${s.name}`).join(', ');
    label += ` \`${exports}\``;
  }

  if (node.isFolded && node.stats) {
    label += ` *(${node.stats.files} files)*`;
  }

  let result = `${indent}- ${icon} **${label}**\n`;


  const sortedChildren = [...node.children].sort((a, b) => {
    const typeOrder: Record<string, number> = { 'package': 1, 'module': 2, 'file': 3, 'symbol': 4 };
    const aOrder = typeOrder[a.type] || 99;
    const bOrder = typeOrder[b.type] || 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.name || '').localeCompare(b.name || '');
  });

  for (const child of sortedChildren) {
    result += formatMarkdown(child, depth + 1);
  }
  
  return result;
}

function computeRecursiveStats(node: any): { files: number, symbols: number } {
  let files = node.type === 'file' ? 1 : 0;
  let symbols = node.type === 'symbol' ? 1 : 0;
  
  for (const child of node.children) {
    const childStats = computeRecursiveStats(child);
    files += childStats.files;
    symbols += childStats.symbols;
  }
  
  node.stats = { files, symbols };
  return node.stats;
}

function promoteModules(node: any) {
  if (node.type === 'module') {
    const entryFiles = ['index.ts', 'index.js', 'main.go', 'mod.rs', '__init__.py', 'server.ts', 'app.ts'];
    const hasEntry = node.children.some((c: any) => c.type === 'file' && entryFiles.includes(c.name));
    if (hasEntry) {
      node.type = 'package';
    }
  }
  for (const child of node.children) {
    promoteModules(child);
  }
}


function pruneMetadata(node: any, verbose: boolean): any {
  const newNode: any = {
    name: node.name,
    type: node.type,
  };

  if (node.kind) newNode.kind = node.kind;
  if (verbose) {
    newNode.id = node.id;
    newNode.path = node.path;
  }

  if (node.children && node.children.length > 0) {
    newNode.children = node.children.map((c: any) => pruneMetadata(c, verbose));
  }

  return newNode;
}


export function createStructureTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'query_repo_structure',
      description: 'Get a hierarchical overview of the repository (Modules -> Files -> Symbols).',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Focus on a specific directory or module' },
          depth: { type: 'number', default: 2, description: 'Depth of the hierarchy to explore' },
          format: { type: 'string', enum: ['json', 'tree', 'markdown'], default: 'tree', description: 'Output format' },
          adaptive: { type: 'boolean', default: true, description: 'Use adaptive zooming and folding' },
          verbose: { type: 'boolean', default: false, description: 'Include IDs and full paths in JSON output' }
        },
        required: [],
      },


      handler: async (args: any) => {
        const depth = args.depth ?? 2;
        const adaptive = args.adaptive !== false;
        const focusPath = args.path;

        const repos = await store.query<any>(`SELECT id, name, type, path FROM repository LIMIT 1`);
        if (repos.length === 0) {
          return { content: [{ type: 'text', text: 'Repository not initialized. Run `tokenzip init` and `tokenzip parse` first.' }], isError: true };
        }
        
        const rootId = repos[0].id.toString();
        
        // Fetch stats to determine threshold
        const statsRes = await store.query<any>('SELECT count() as count FROM file GROUP ALL');
        const totalFiles = statsRes[0]?.count || 0;
        const foldThreshold = totalFiles > 1000 ? 50 : 8;

        // Fetch all contains edges
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
          
          let name = node.name;
          if (!name && node.path) {
            name = node.path.split('/').pop() || node.path;
          }

          nodeMap.set(id, {
            id: id,
            name: name,
            type: node.type,
            path: node.path,
            kind: node.kind,
            isExported: node.isExported,
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

        const fullTree = nodeMap.get(rootId);
        if (!fullTree) {
          return { content: [{ type: 'text', text: 'Structure not found.' }], isError: true };
        }

        // 1. Promote modules based on index files
        promoteModules(fullTree);

        // 2. Compute recursive stats
        computeRecursiveStats(fullTree);

        // 3. Apply adaptive folding and depth pruning
        const pruneAndFold = (node: any, currentDepth: number) => {
          // isAtFocus is true ONLY if we are specifically targeting this path or its parents/children
          let isAtFocus = focusPath ? (node.path === focusPath || (node.path && node.path.startsWith(focusPath + '/')) || (focusPath.startsWith(node.path + '/'))) : false;

          // Adaptive folding for dense directories (if not at focus)
          if (adaptive && currentDepth >= 1 && (node.type === 'module' || node.type === 'package') && node.stats.files > foldThreshold && !isAtFocus) {
            node.filesSummarized = true;
            
            const subDirs = node.children.filter((c: any) => c.type === 'module' || c.type === 'package');
            const entryFiles = ['index.ts', 'index.js', 'main.go', 'mod.rs', '__init__.py', 'server.ts', 'app.ts'];
            const files = node.children.filter((c: any) => c.type === 'file');
            
            const importantFiles = files.filter((f: any) => entryFiles.includes(f.name) || (f.exportedSymbols && f.exportedSymbols.length > 0))
              .slice(0, 5);
            
            node.children = [...subDirs, ...importantFiles];
            if (files.length > importantFiles.length) {
              node.children.push({
                type: 'summary',
                name: `... (+${files.length - importantFiles.length} more files)`,
                children: []
              });
            }
          }

          // Depth pruning (respect focus path)
          if (currentDepth >= depth && !isAtFocus) {
            if (node.type === 'file') {
              node.exportedSymbols = node.children
                .filter((c: any) => c.type === 'symbol' && c.isExported)
                .map((c: any) => ({ name: c.name, kind: c.kind, type: c.type }));
            }
            node.children = [];
            return;
          }

          for (const child of node.children) {
            pruneAndFold(child, currentDepth + 1);
          }
        };


        // If focusPath is provided, we might want to find the node for the focusPath first
        let targetTree = fullTree;
        if (focusPath) {
          const focusNode = Array.from(nodeMap.values()).find(n => n.path === focusPath);
          if (focusNode) targetTree = focusNode;
        }

        pruneAndFold(targetTree, 0);

        const format = args.format ?? (adaptive ? 'tree' : 'json');
        const verbose = args.verbose === true || args.verbose === 'true';

        if (format === 'tree') {
          const treeText = formatTree(targetTree);
          return { content: [{ type: 'text', text: treeText }] };
        }

        if (format === 'markdown') {
          const mdText = formatMarkdown(targetTree);
          return { content: [{ type: 'text', text: mdText }] };
        }

        // Default: JSON
        const prunedTree = pruneMetadata(targetTree, verbose);
        const response = budget.truncate({ structure: prunedTree });
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
    },
    {
      name: 'inspect_targets',
      description: 'Get full signatures and JSDoc for multiple files or symbols in one call.',
      inputSchema: {
        type: 'object',
        properties: {
          targets: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'List of file paths or symbol names to inspect' 
          }
        },
        required: ['targets'],
      },
      handler: async (args: any) => {
        let targets: string[] = [];
        if (Array.isArray(args.targets)) {
          targets = args.targets;
        } else if (typeof args.targets === 'string') {
          targets = args.targets.split(',').map(t => t.trim());
        }

        const results: any[] = [];


        for (const target of targets) {
          // Check if it's a file
          const fileRes = await store.query<any[]>('SELECT id, path, language FROM file WHERE path = $path LIMIT 1', { path: target });
          if (fileRes.length > 0) {
            const symbols = await store.query('SELECT name, kind, signature, docstring, isExported FROM symbol WHERE fileId = $fileId AND isExported = true', { fileId: fileRes[0].id });
            results.push({
              type: 'file',
              path: target,
              exports: symbols
            });
            continue;
          }

          // Check if it's a symbol
          const symbolRes = await store.query<any[]>(`
            SELECT name, kind, signature, docstring, 
                   (SELECT path FROM file WHERE id = $parent.fileId)[0].path as filePath 
            FROM symbol WHERE name = $name AND isExported = true
          `, { name: target });
          
          if (symbolRes.length > 0) {
            results.push({
              type: 'symbol',
              name: target,
              definitions: symbolRes
            });
          } else {
            results.push({
              type: 'unknown',
              target,
              error: 'Not found or not exported'
            });
          }
        }

        const response = budget.truncate({ results });
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      }
    }
  ];
}
