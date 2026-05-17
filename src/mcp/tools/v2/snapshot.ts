import { IStore } from '../../../storage/interface.js';
import { TokenBudgetManager } from '../../token-budget.js';
import { RecordId } from 'surrealdb';
import { injectCortex } from '../cortex.js';

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
      default:
        return '💎';
    }
  }
  return '📁';
}

function formatTree(node: any, prefix: string = '', isLast: boolean = true, isRoot: boolean = true): string {
  const icon = getIcon(node.type, node.kind);
  let label = node.name || (node.type === 'repository' ? 'root' : 'unknown');
  
  if (node.type === 'file' && node.exportedSymbols && node.exportedSymbols.length > 0) {
    const exports = node.exportedSymbols.map((s: any) => `${getIcon(s.type, s.kind)} ${s.name}`).join(', ');
    label += ` [${exports}]`;
  }

  if (node.filesSummarized && node.stats) {
    label += ` (contains ${node.stats.files} files)`;
  }

  const line = isRoot ? `${icon} ${label}\n` : `${prefix}${isLast ? '└── ' : '├── '}${icon} ${label}\n`;
  let result = line;

  const newPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
  const sortedChildren = [...(node.children || [])].sort((a, b) => {
    const typeOrder: Record<string, number> = { 'package': 1, 'module': 2, 'file': 3, 'symbol': 4 };
    const aOrder = typeOrder[a.type] || 99;
    const bOrder = typeOrder[b.type] || 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.name || '').localeCompare(b.name || '');
  });

  for (let i = 0; i < sortedChildren.length; i++) {
    result += formatTree(sortedChildren[i], newPrefix, i === sortedChildren.length - 1, false);
  }
  
  return result;
}

async function buildHierarchy(store: IStore, focusPath?: string) {
  const repos = await store.query<any>('SELECT id, name, type, path FROM repository LIMIT 1') || [];
  if (repos.length === 0) throw new Error('Repository not initialized.');
  
  const rootNode: any = { 
    id: repos[0].id.toString(), 
    name: repos[0].name || 'root', 
    type: 'repository', 
    children: [] 
  };

  const nodes = await store.query<any>('SELECT id, name, type, path, kind, isExported, fileId FROM file, module, symbol') || [];
  const nodeMap = new Map<string, any>();
  
  // Only add files/modules to the map for hierarchy building
  for (const node of nodes) {
    if (node.type === 'file' || node.type === 'module') {
      const id = node.id.toString();
      let name = node.name;
      if (!name && node.path) {
        name = node.path.split('/').pop() || node.path;
      }
      nodeMap.set(id, { ...node, id, name, children: [] });
    }
  }

  // Build hierarchy from paths
  for (const node of nodeMap.values()) {
    if (!node.path) {
      rootNode.children.push(node);
      continue;
    }
    const parts = node.path.split('/');
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = Array.from(nodeMap.values()).find(n => n.path === parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        rootNode.children.push(node);
      }
    } else {
      rootNode.children.push(node);
    }
  }

  // Attach symbols to files (only exported ones for snapshot)
  const symbols = nodes.filter(n => n.type === 'symbol');
  for (const file of nodeMap.values()) {
    if (file.type === 'file') {
      file.exportedSymbols = symbols.filter(s => s.fileId?.toString() === file.id && s.isExported);
    }
  }

  if (focusPath) {
    const focusNode = Array.from(nodeMap.values()).find(n => n.path === focusPath);
    return focusNode || rootNode;
  }
  return rootNode;
}

export function createSnapshotTool(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return {
    name: 'code_snapshot',
    description: 'Get a semantic, hierarchical overview of a directory or the whole repository. Shows folders, files, and key exported symbols.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path relative to root.' },
        depth: { type: 'number', default: 2, description: 'Max depth of the tree.' },
        format: { type: 'string', enum: ['tree', 'json'], default: 'tree' }
      }
    },
    handler: async (args: any) => {
      try {
        const format = args.format || 'tree';
        const tree = await buildHierarchy(store, args.path);
        
        if (format === 'tree') {
          let text = formatTree(tree);
          try {
            const cortex = await injectCortex(args.path || '.', store, budget);
            if (cortex && cortex.notes && cortex.notes.length > 0) {
              text += '\n\n--- CORTEX INSIGHTS ---\n' + cortex.notes.join('\n');
            }
          } catch (e) {
            // Cortex failure shouldn't break the snapshot
          }
          return { content: [{ type: 'text', text }] };
        }

        return { content: [{ type: 'text', text: JSON.stringify(budget.truncate(tree), null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: err.message }], isError: true };
      }
    }
  };
}
