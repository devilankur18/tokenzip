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


async function executeStructureQuery(store: IStore, budget: TokenBudgetManager, args: any) {
  const depth = args.depth ?? 2;
  const adaptive = args.adaptive !== false;
  const focusPath = args.path;
  const showSymbols = args.showSymbols !== false;

  const repos = await store.query<any>(`SELECT id, name, type, path FROM repository LIMIT 1`);
  if (repos.length === 0) {
    throw new Error('Repository not initialized. Run `tokenzip init` and `tokenzip parse` first.');
  }
  
  const rootId = repos[0].id.toString();
  
  // Fetch stats to determine threshold
  const statsRes = await store.query<any>('SELECT count() as count FROM file GROUP ALL');
  const totalFiles = statsRes[0]?.count || 0;
  const foldThreshold = totalFiles > 1000 ? 50 : 8;

  // Fetch all contains edges
  const allEdges = await store.query<any[]>(`SELECT * FROM contains`) || [];

  // Collect all unique node IDs
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
  
  // 1. Build the node map and identify the root
  const nodeMap = new Map<string, any>();
  let rootNode: any = null;

  for (const node of allNodes) {
    if (!node || !node.id) continue;
    const id = node.id.toString();
    
    let name = node.name;
    if (!name && node.path) {
      name = node.path.split('/').pop() || node.path;
    }

    const entry = {
      id: id,
      name: name,
      type: node.type,
      path: node.path,
      kind: node.kind,
      isExported: node.isExported,
      children: [] as any[],
      stats: { files: 0, modules: 0, symbols: 0 }
    };

    nodeMap.set(id, entry);
    if (node.type === 'repository') rootNode = entry;
  }

  if (!rootNode) throw new Error('Repository root not found.');

  // 2. Reconstruct Hierarchy from Paths (for Files and Modules)
  // This ensures physical directory nesting is preserved regardless of DB edge flattening
  const pathToNode = new Map<string, any>();
  const nodesWithPaths = Array.from(nodeMap.values()).filter(n => n.path && (n.type === 'file' || n.type === 'module' || n.type === 'package'));
  
  for (const node of nodesWithPaths) {
    pathToNode.set(node.path, node);
  }

  for (const node of nodesWithPaths) {
    const parts = node.path.split('/');
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join('/');
      let parent = pathToNode.get(parentPath);
      
      // If parent doesn't exist (virtual folder), create it or attach to root
      if (!parent) {
        // Find the closest existing ancestor
        let ancestorPath = parentPath;
        let ancestor = null;
        while (ancestorPath.includes('/')) {
          ancestorPath = ancestorPath.split('/').slice(0, -1).join('/');
          ancestor = pathToNode.get(ancestorPath);
          if (ancestor) break;
        }
        
        if (ancestor) {
          if (!ancestor.children.some((c: any) => c.id === node.id)) {
            ancestor.children.push(node);
          }
        } else {
          // No ancestor found, attach to repository root
          if (!rootNode.children.some((c: any) => c.id === node.id)) {
            rootNode.children.push(node);
          }
        }
      } else {
        if (!parent.children.some((c: any) => c.id === node.id)) {
          parent.children.push(node);
        }
      }
    } else {
      // Top level node, attach to repository root
      if (!rootNode.children.some((c: any) => c.id === node.id)) {
        rootNode.children.push(node);
      }
    }
  }

  // 3. Attach Symbols using Edges (symbols don't have paths in the same way)
  for (const edge of allEdges) {
    if (!edge.out || !edge.in) continue;
    const fromId = edge.out.toString();
    const toId = edge.in.toString();
    const fromNode = nodeMap.get(fromId);
    const toNode = nodeMap.get(toId);
    
    if (fromNode && toNode && toNode.type === 'symbol') {
      if (!fromNode.children.some((c: any) => c.id === toNode.id)) {
        fromNode.children.push(toNode);
      }
    }
  }

  const fullTree = rootNode;

  if (!fullTree) throw new Error('Structure not found.');

  promoteModules(fullTree);
  computeRecursiveStats(fullTree);

  // 4. Sort children for deterministic output
  const sortNodes = (node: any) => {
    if (node.children && node.children.length > 0) {
      node.children.sort((a: any, b: any) => {
        if (a.type !== b.type) {
          if (a.type === 'module' || a.type === 'package') return -1;
          if (b.type === 'module' || b.type === 'package') return 1;
        }
        return (a.name || '').localeCompare(b.name || '');
      });
      for (const child of node.children) sortNodes(child);
    }
  };
  sortNodes(fullTree);

  const pruneAndFold = (node: any, currentDepth: number) => {
    let isAtFocus = focusPath ? (node.path === focusPath || (node.path && node.path.startsWith(focusPath + '/')) || (focusPath.startsWith(node.path + '/'))) : false;

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

    if (currentDepth >= depth && !isAtFocus) {
      if (node.type === 'file' && showSymbols) {
        node.exportedSymbols = node.children
          .filter((c: any) => c.type === 'symbol' && c.isExported)
          .map((c: any) => ({ name: c.name, kind: c.kind, type: c.type }));
      }
      node.children = [];
      return;
    }

    // Filter out symbols if showSymbols is false
    if (!showSymbols) {
      node.children = node.children.filter((c: any) => c.type !== 'symbol');
    }

    for (const child of node.children) {
      pruneAndFold(child, currentDepth + 1);
    }
  };

  let targetTree = fullTree;
  if (focusPath) {
    const focusNode = Array.from(nodeMap.values()).find(n => n.path === focusPath);
    if (!focusNode) {
      throw new Error(`Path "${focusPath}" not found in the indexed codebase. Ensure the path is relative to the repository root and has been parsed.`);
    }
    targetTree = focusNode;
  }


  pruneAndFold(targetTree, 0);

  const format = args.format ?? (adaptive ? 'tree' : 'json');
  const verbose = args.verbose === true || args.verbose === 'true';

  if (format === 'tree') {
    return { content: [{ type: 'text', text: formatTree(targetTree) }] };
  }

  if (format === 'markdown') {
    return { content: [{ type: 'text', text: formatMarkdown(targetTree) }] };
  }

  const prunedTree = pruneMetadata(targetTree, verbose);
  const response = budget.truncate({ structure: prunedTree });
  return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
}

export function createStructureTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'get_file_tree',
      description: 'Returns a compact, hierarchical file tree of the repository.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Focus on a specific directory' },
          depth: { type: 'number', default: 2, description: 'Depth of the tree' },
          adaptive: { type: 'boolean', default: true, description: 'Fold dense directories' }
        }
      },
      handler: async (args: any) => {
        try {
          return await executeStructureQuery(store, budget, {
            ...args,
            showSymbols: false, // Default to compact for file_tree
            format: args.format || 'tree'
          });
        } catch (err: any) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
      }
    },
    {
      name: 'get_code_overview',
      description: 'Get a semantic, hierarchical overview of the repository (Modules -> Files -> Exports). Use this to understand architectural boundaries.',

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
        try {
          return await executeStructureQuery(store, budget, args);
        } catch (err: any) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
      },
    },

    {


      name: 'query_repo_structure',
      description: 'Alias for get_code_overview. (Deprecated)',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          depth: { type: 'number', default: 2 },
          format: { type: 'string', enum: ['json', 'tree', 'markdown'], default: 'tree' }
        }
      },
      handler: async (args: any) => {
        try {
          return await executeStructureQuery(store, budget, args);
        } catch (err: any) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
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
        const response = budget.truncate(stats);
        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
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
