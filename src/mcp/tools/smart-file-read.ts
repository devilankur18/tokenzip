import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { fileCache } from '../../utils/file-cache.js';
import { findClosestMatch } from '../../utils/string-utils.js';
import path from 'path';
import fs from 'fs';

export function createSmartFileReadTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  return [
    {
      name: 'smart_file_read',
      description: "Reads semantic projections of a file. Use 'interface_only' to understand APIs, 'skeleton' to map structure, 'dependency_only' for impact analysis, and 'implementation_of' to see specific logic.",
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to repo root' },
          mode: {
            type: 'string',
            enum: ['interface_only', 'skeleton', 'dependency_only', 'implementation_of'],
            default: 'interface_only'
          },
          target_symbol: {
            type: 'string',
            description: "Required for 'implementation_of'. The symbol name (e.g., 'processPayment')."
          },
          max_tokens: {
            type: 'number',
            default: 4000,
            description: 'Soft limit for response size. Tool will degrade mode if exceeded.'
          }
        },
        required: ['path']
      },
      handler: async (args: any) => {
        const { path: filePath, mode = 'interface_only', target_symbol, max_tokens = 4000 } = args;
        const absPath = path.resolve(repoPath, filePath);

        // 1. Check if file exists in DB
        const fileRes = await store.query<any>('SELECT id, parseStatus FROM file WHERE path = $path LIMIT 1', { path: filePath });
        if (fileRes.length === 0) {
          return { content: [{ type: 'text', text: `File not found in index: ${filePath}` }], isError: true };
        }

        const fileNode = fileRes[0];
        if (fileNode.parseStatus === 'failed') {
          // Fallback to raw read (first 100 lines)
          try {
            const lines = fileCache.getRange(absPath, 1, 100);
            return {
              content: [{ type: 'text', text: lines.join('\n') }],
              warnings: [`File ${filePath} failed to parse during indexing. Showing first 100 lines of raw source.`]
            };
          } catch (err: any) {
            return { content: [{ type: 'text', text: `Error reading file: ${err.message}` }], isError: true };
          }
        }

        const fileId = fileNode.id;

        // 2. Execute requested strategy
        let result = await executeStrategy(mode, filePath, absPath, fileId, store, target_symbol, budget, max_tokens);

        // 3. Degrade logic for skeleton
        if (mode === 'skeleton' && budget.estimate(result.content) > max_tokens) {
          const degraded = await executeStrategy('interface_only', filePath, absPath, fileId, store, target_symbol, budget, max_tokens);
          return {
            ...degraded,
            warnings: [...(degraded.warnings || []), 'Auto-downgraded from skeleton to interface_only due to token limit.']
          };
        }

        return {
          content: [{ type: 'text', text: result.content }],
          mode_used: result.mode_used,
          token_count: budget.estimate(result.content),
          symbol_count: result.symbol_count,
          warnings: result.warnings || []
        };
      }
    }
  ];
}

export async function executeStrategy(
  mode: string,
  relPath: string,
  absPath: string,
  fileId: string,
  store: IStore,
  targetSymbol: string | undefined,
  budget: TokenBudgetManager,
  maxTokens: number
): Promise<{ content: string; mode_used: string; symbol_count: number; tokensUsed: number; warnings?: string[] }> {
  let result: any;
  switch (mode) {
    case 'interface_only':
      result = await interfaceOnlyStrategy(relPath, absPath, fileId, store);
      break;
    case 'skeleton':
      result = await skeletonStrategy(relPath, absPath, fileId, store);
      break;
    case 'dependency_only':
      result = await dependencyOnlyStrategy(relPath, absPath, fileId, store);
      break;
    case 'implementation_of':
      result = await implementationOfStrategy(relPath, absPath, fileId, targetSymbol || '', store);
      break;
    default:
      result = await interfaceOnlyStrategy(relPath, absPath, fileId, store);
  }

  return {
    ...result,
    tokensUsed: budget.estimate(result.content)
  };
}

async function interfaceOnlyStrategy(relPath: string, absPath: string, fileId: string, store: IStore) {
  const symbols = await store.query<any>('SELECT * FROM symbol WHERE fileId = $fileId ORDER BY startLine ASC', { fileId });
  const lines = fileCache.getLines(absPath);
  
  // Get imports (lines before first symbol or first 50 lines)
  const firstSymbolLine = symbols.length > 0 ? symbols[0].startLine : 50;
  const importEnd = Math.min(firstSymbolLine - 1, 50);
  const importLines = lines.slice(0, importEnd).filter(l => l.trim().startsWith('import') || l.trim().startsWith('import type') || l.trim().startsWith('export {') || l.trim().startsWith('require('));

  const output: string[] = [];
  if (importLines.length > 0) {
    output.push(importLines.join('\n'));
    output.push(''); // Gap
  }

  for (const sym of symbols) {
    if (['interface', 'type', 'enum'].includes(sym.kind)) {
      // Show full range for small type definitions
      const content = fileCache.getRange(absPath, sym.startLine, sym.endLine).join('\n');
      output.push(content);
    } else {
      // Show signature only
      if (sym.docstring) {
        output.push(sym.docstring);
      }
      let sig = sym.signature || lines[sym.startLine - 1];
      if (!sig.trim().endsWith('{')) {
        sig += ' { /* ... */ }';
      } else {
        // If it ends with {, we might need to add a closing } or just a comment
        sig += ' /* ... implementation hidden ... */ }';
      }
      output.push(sig);
    }
    output.push(''); // Gap between symbols
  }

  return {
    content: output.join('\n').trim(),
    mode_used: 'interface_only',
    symbol_count: symbols.length
  };
}

async function skeletonStrategy(relPath: string, absPath: string, fileId: string, store: IStore) {
  const symbols = await store.query<any>('SELECT * FROM symbol WHERE fileId = $fileId ORDER BY startLine ASC', { fileId });
  const lines = fileCache.getLines(absPath);
  
  const resultLines: string[] = [];
  
  // Mark lines that are part of a function/method body
  const bodyLines = new Set<number>();
  for (const sym of symbols) {
    if (['function', 'method', 'class'].includes(sym.kind) && sym.endLine > sym.startLine) {
      // Check if it has any "structural" children (not just variables)
      const hasStructuralChild = symbols.some(
        (other) => 
          other.id !== sym.id && 
          ['class', 'function', 'method', 'interface', 'type'].includes(other.kind) &&
          other.startLine > sym.startLine && 
          other.endLine < sym.endLine
      );
      
      if (!hasStructuralChild) {
        for (let i = sym.startLine + 1; i < sym.endLine; i++) {
          bodyLines.add(i);
        }
      }
    }
  }

  let inHiddenBlock = false;
  for (let i = 1; i <= lines.length; i++) {
    if (bodyLines.has(i)) {
      if (!inHiddenBlock) {
        resultLines.push('    /* ... implementation hidden ... */');
        inHiddenBlock = true;
      }
      continue;
    }
    inHiddenBlock = false;
    resultLines.push(lines[i - 1]);
  }

  return {
    content: resultLines.join('\n'),
    mode_used: 'skeleton',
    symbol_count: symbols.length
  };
}

async function dependency_only_logic(relPath: string, absPath: string, fileId: string, store: IStore) {
  const lines = fileCache.getLines(absPath);
  const imports = lines.filter(l => l.trim().startsWith('import') || l.trim().startsWith('require('));
  const exports = lines.filter(l => l.trim().startsWith('export '));

  const symbols = await store.query<any>('SELECT id, name, kind FROM symbol WHERE fileId = $fileId AND kind IN ["function", "method", "class"]', { fileId });
  
  const callGraph: string[] = [];
  for (const sym of symbols) {
    // Query calls where this symbol is the source (in)
    const calls = await store.query<any>('SELECT metadata.targetName as target FROM calls WHERE in = $symId LIMIT 5', { symId: sym.id });
    if (calls.length > 0) {
      const targets = calls.map(c => c.target).filter(Boolean).join(', ');
      callGraph.push(`// ${sym.kind} '${sym.name}' calls: ${targets}`);
    }
  }

  const output = [
    '// --- IMPORTS ---',
    ...imports,
    '',
    '// --- CALL GRAPH ---',
    ...callGraph,
    '',
    '// --- EXPORTS ---',
    ...exports
  ];

  return {
    content: output.join('\n').trim(),
    mode_used: 'dependency_only',
    symbol_count: symbols.length
  };
}

async function dependencyOnlyStrategy(relPath: string, absPath: string, fileId: string, store: IStore) {
    return await dependency_only_logic(relPath, absPath, fileId, store);
}

async function implementationOfStrategy(relPath: string, absPath: string, fileId: string, targetSymbol: string, store: IStore) {
  // Look for exact match or name that ends with .targetSymbol (case-insensitive)
  const results = await store.query<any>(
    'SELECT * FROM symbol WHERE (string::lowercase(name) = string::lowercase($name) OR string::ends_with(string::lowercase(name), string::lowercase($suffix))) AND fileId = $fileId LIMIT 1', 
    { name: targetSymbol, suffix: `.${targetSymbol}`, fileId }
  );
  
  if (results.length === 0) {
    // Fuzzy match
    const allSymbols = await store.query<any>('SELECT name FROM symbol WHERE fileId = $fileId', { fileId });
    const symbolNames = allSymbols.map(s => s.name);
    const closest = findClosestMatch(targetSymbol, symbolNames);
    
    let msg = `Symbol '${targetSymbol}' not found in ${relPath}.`;
    if (closest) msg += ` Did you mean '${closest}'?`;
    if (symbolNames.length > 0) {
      msg += `\nAvailable symbols in this file: ${symbolNames.join(', ')}`;
    }
    
    return {
      content: msg,
      mode_used: 'implementation_of',
      symbol_count: 0
    };
  }

  const sym = results[0];
  const output: string[] = [];

  // If it's a method, try to find the parent class signature for context
  let parentId = sym.parentSymbolId;
  if (!parentId) {
    // Try range-based lookup
    const parents = await store.query<any>('SELECT id, signature, name FROM symbol WHERE fileId = $fileId AND kind = "class" AND startLine < $start AND endLine > $end LIMIT 1', { fileId, start: sym.startLine, end: sym.endLine });
    if (parents.length > 0) {
      parentId = parents[0].id;
      const parent = parents[0];
      output.push(`// Context: member of class ${parent.name}`);
      output.push(`${parent.signature || `class ${parent.name}`} {`);
      output.push('  // ...');
    }
  } else {
    const parent = await store.query<any>('SELECT signature, name FROM symbol WHERE id = $id LIMIT 1', { id: parentId });
    if (parent.length > 0) {
      output.push(`// Context: member of class ${parent[0].name}`);
      output.push(`${parent[0].signature || `class ${parent[0].name}`} {`);
      output.push('  // ...');
    }
  }

  const code = fileCache.getRange(absPath, sym.startLine, sym.endLine).join('\n');
  output.push(code);

  if (parentId) {
    output.push('}');
  }

  return {
    content: output.join('\n'),
    mode_used: 'implementation_of',
    symbol_count: 1
  };
}
