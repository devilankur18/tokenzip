import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { fileCache } from '../../utils/file-cache.js';
import { findClosestMatch } from '../../utils/string-utils.js';
import path from 'path';
import fs from 'fs';
import { StringRecordId } from 'surrealdb';

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
            enum: ['interface_only', 'skeleton', 'dependency_only', 'implementation_of', 'auto'],
            default: 'auto'
          },
          target_symbol: {
            type: 'string',
            description: "Required for 'implementation_of'. The symbol name (e.g., 'processPayment')."
          },
          max_tokens: {
            type: 'number',
            default: 4000,
            description: 'Soft limit for response size. Tool will degrade mode if exceeded.'
          },
          include_docs: {
            type: 'boolean',
            default: false,
            description: 'Whether to include JSDoc/comments. Default is false to save tokens.'
          },
          range: {
            type: 'object',
            properties: {
              start: { type: 'number' },
              end: { type: 'number' }
            },
            description: 'Specific line range to read (1-indexed).'
          }
        },
        required: ['path']
      },
      handler: async (args: any) => {
        try {
          const { path: filePath, mode = 'auto', target_symbol, max_tokens = 4000, include_docs = false, range } = args;
          const absPath = path.resolve(repoPath, filePath);

          // 1. Check if file exists in DB
          const fileRes = await store.query<any>('SELECT id, parse_status FROM file WHERE path = $path LIMIT 1', { path: filePath });
          if (fileRes.length === 0) {
            return { content: [{ type: 'text', text: `File not found in index: ${filePath}` }], isError: true };
          }

          const fileNode = fileRes[0];
          if (fileNode.parse_status === 'failed') {
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

          // 2. Handle specific range request
          if (range) {
            try {
              const lines = fileCache.getRange(absPath, range.start, range.end);
              const response: any = budget.truncate({
                content: lines.join('\n'),
                mode_used: 'range',
                range
              });

              // Inject Cortex
              const cortex = await injectCortex(filePath, store, budget);
              if (cortex) response._cortex = cortex;

              return {
                content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
              };
            } catch (err: any) {
              return { content: [{ type: 'text', text: `Error reading range: ${err.message}` }], isError: true };
            }
          }

          let finalMode = mode;

          // 2. Resolve 'auto' mode
          if (mode === 'auto') {
            // Default to skeleton, but check if it's too big
            const testRes = await executeStrategy('skeleton', filePath, absPath, fileId, store, target_symbol, budget, max_tokens, include_docs);
            if (testRes.tokensUsed > max_tokens) {
              finalMode = 'interface_only';
            } else {
              finalMode = 'skeleton';
            }
          }

          // 3. Execute requested strategy
          let result = await executeStrategy(finalMode, filePath, absPath, fileId, store, target_symbol, budget, max_tokens, include_docs);

          // 3. Degrade logic for skeleton
          if (mode === 'skeleton' && budget.estimate(result.content) > max_tokens) {
            result = await executeStrategy('interface_only', filePath, absPath, fileId, store, target_symbol, budget, max_tokens, include_docs);
            result.warnings = [...(result.warnings || []), 'Auto-downgraded from skeleton to interface_only due to token limit.'];
          }

          const response: any = budget.truncate({
            content: result.content,
            mode_used: result.mode_used,
            symbol_count: result.symbol_count,
            warnings: result.warnings || []
          });

          // 4. Inject Cortex memory
          const cortex = await injectCortex(filePath, store, budget);
          if (cortex) {
            response._cortex = cortex;
          }

          return {
            content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
          };
        } catch (err: any) {
          return { content: [{ type: 'text', text: err.message }], isError: true };
        }
      }
    }
  ];
}
import { injectCortex } from './cortex.js';

export async function calculateAllMetrics(
  relPath: string,
  absPath: string,
  fileId: string,
  store: IStore,
  budget: TokenBudgetManager
) {
  const recordId = typeof fileId === 'string' ? new StringRecordId(fileId) : fileId;
  const symbols = await store.query<any>('SELECT * FROM symbol WHERE fileId = $fileId ORDER BY startLine ASC', { fileId: recordId });
  
  // We can't easily call the private strategy functions here without refactoring
  // But we can call executeStrategy and it will use the cache if we implement one
  // Or for now, we just accept the 3 queries but parallelized.
  
  // Wait, I'll just refactor the strategies to be exported.
  
  const [iRes, sRes, dRes] = await Promise.all([
    interfaceOnlyStrategy(relPath, absPath, fileId, store, false, symbols),
    skeletonStrategy(relPath, absPath, fileId, store, false, symbols),
    dependencyOnlyStrategy(relPath, absPath, fileId, store, symbols)
  ]);

  return {
    interfaceTokens: budget.estimate(iRes.content),
    skeletonTokens: budget.estimate(sRes.content),
    dependencyTokens: budget.estimate(dRes.content),
  };
}

export async function executeStrategy(
  mode: string,
  relPath: string,
  absPath: string,
  fileId: string,
  store: IStore,
  targetSymbol: string | undefined,
  budget: TokenBudgetManager,
  maxTokens: number,
  includeDocs: boolean = false,
  preFetchedSymbols?: any[]
): Promise<{ content: string; mode_used: string; symbol_count: number; tokensUsed: number; warnings?: string[] }> {
  let result: any;
  switch (mode) {
    case 'interface_only':
      result = await interfaceOnlyStrategy(relPath, absPath, fileId, store, includeDocs, preFetchedSymbols);
      break;
    case 'skeleton':
      result = await skeletonStrategy(relPath, absPath, fileId, store, includeDocs, preFetchedSymbols);
      break;
    case 'dependency_only':
      result = await dependencyOnlyStrategy(relPath, absPath, fileId, store, preFetchedSymbols);
      break;
    case 'implementation_of':
      result = await implementationOfStrategy(relPath, absPath, fileId, targetSymbol || '', store, includeDocs);
      break;
    default:
      result = await interfaceOnlyStrategy(relPath, absPath, fileId, store, includeDocs, preFetchedSymbols);
  }

  return {
    ...result,
    tokensUsed: budget.estimate(result.content)
  };
}

async function interfaceOnlyStrategy(relPath: string, absPath: string, fileId: string, store: IStore, includeDocs: boolean, preFetchedSymbols?: any[]) {
  const recordId = typeof fileId === 'string' ? new StringRecordId(fileId) : fileId;
  const symbols = preFetchedSymbols || await store.query<any>('SELECT * FROM symbol WHERE fileId = $fileId ORDER BY startLine ASC', { fileId: recordId });
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
    if (['interface', 'type', 'enum', 'variable'].includes(sym.kind)) {
      // Show full range for small type definitions, truncate if too large
      const contentLines = fileCache.getRange(absPath, sym.startLine, sym.endLine);
      if (contentLines.length > 30) {
        output.push(contentLines.slice(0, 15).join('\n'));
        output.push('    // ... [truncated large definition] ...');
        output.push(contentLines.slice(-10).join('\n'));
      } else {
        output.push(contentLines.join('\n'));
      }
    } else {
      // Show signature only
      if (includeDocs && sym.docstring) {
        output.push(sym.docstring);
      }
      let sig = sym.signature || lines[sym.startLine - 1];
      if (!sig.trim().endsWith('{')) {
        sig += ' { /* ... */ }';
      } else {
        // If it ends with {, we might need to add a closing } or just a comment
        sig += ' /* [body] */ }';
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

async function skeletonStrategy(relPath: string, absPath: string, fileId: string, store: IStore, includeDocs: boolean, preFetchedSymbols?: any[]) {
  const recordId = typeof fileId === 'string' ? new StringRecordId(fileId) : fileId;
  const symbols = preFetchedSymbols || await store.query<any>('SELECT * FROM symbol WHERE fileId = $fileId ORDER BY startLine ASC', { fileId: recordId });
  const lines = fileCache.getLines(absPath);
  
  const hiddenLines = new Set<number>();
  
  // 1. Mark lines to hide (bodies of functions/methods and docstrings)
  for (const sym of symbols) {
    // Hide docstrings if requested
    if (!includeDocs && sym.docStartLine && sym.docEndLine) {
      for (let i = sym.docStartLine; i <= sym.docEndLine; i++) {
        hiddenLines.add(i);
      }
    }
    
    // Hide bodies of functions, methods, and multi-line variables (objects/arrays)
    if (['function', 'method', 'variable'].includes(sym.kind) && sym.endLine > sym.startLine) {
      for (let i = sym.startLine + 1; i < sym.endLine; i++) {
        hiddenLines.add(i);
      }
    }
  }
  
  // 1.5. Hide standalone large comment blocks if documentation is not requested
  if (!includeDocs) {
    let commentBlockStart = -1;
    for (let i = 1; i <= lines.length; i++) {
      const line = lines[i - 1].trim();
      const isComment = line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line.startsWith('*/');
      
      if (isComment && !hiddenLines.has(i)) {
        if (commentBlockStart === -1) commentBlockStart = i;
      } else {
        if (commentBlockStart !== -1) {
          const blockLen = i - commentBlockStart;
          if (blockLen > 3) {
            // Hide middle of the comment block
            for (let j = commentBlockStart + 1; j < i - 1; j++) {
              hiddenLines.add(j);
            }
          }
          commentBlockStart = -1;
        }
      }
    }
    // Handle case where file ends with a comment block
    if (commentBlockStart !== -1) {
      const blockLen = lines.length + 1 - commentBlockStart;
      if (blockLen > 3) {
        for (let j = commentBlockStart + 1; j < lines.length; j++) {
          hiddenLines.add(j);
        }
      }
    }
  }

  // 2. PROTECT structural lines (signatures of nested symbols)
  // We want to make sure that even if a line is inside a hidden body, 
  // if it's the START of another symbol, we show it.
  for (const sym of symbols) {
    if (['function', 'method', 'class', 'interface', 'type', 'enum', 'variable'].includes(sym.kind)) {
      hiddenLines.delete(sym.startLine);
      // For single-line symbols, endLine is the same as startLine
      if (sym.endLine > sym.startLine) {
        // We keep the closing brace visible too
        hiddenLines.delete(sym.endLine);
      }
    }
  }

  const resultLines: string[] = [];
  let inHiddenBlock = false;
  
  for (let i = 1; i <= lines.length; i++) {
    if (hiddenLines.has(i)) {
      if (!inHiddenBlock) {
        // Find if this line is part of a docstring or a body
        const isDoc = symbols.some(s => s.docStartLine <= i && s.docEndLine >= i);
        if (!isDoc) {
          resultLines.push('    /* [body] */');
        }
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

async function dependency_only_logic(relPath: string, absPath: string, fileId: string, store: IStore, preFetchedSymbols?: any[]) {
  const lines = fileCache.getLines(absPath);
  const imports = lines.filter(l => l.trim().startsWith('import') || l.trim().startsWith('require('));
  const exports = lines.filter(l => l.trim().startsWith('export '));

  const recordId = typeof fileId === 'string' ? new StringRecordId(fileId) : fileId;
  const symbols = preFetchedSymbols 
    ? preFetchedSymbols.filter(s => ["function", "method", "class"].includes(s.kind))
    : await store.query<any>('SELECT id, name, kind FROM symbol WHERE fileId = $fileId AND kind IN ["function", "method", "class"]', { fileId: recordId });
  
  const callGraph: string[] = [];
  if (symbols.length > 0) {
    const symIds = symbols.map(s => s.id);
    const allCalls = await store.query<any>(
      'SELECT in, metadata.targetName as target FROM calls WHERE in IN $symIds',
      { symIds }
    );
    
    // Group calls by symbol
    const callsMap = new Map<string, string[]>();
    for (const call of allCalls) {
      const inId = call.in.toString();
      if (!callsMap.has(inId)) callsMap.set(inId, []);
      if (call.target) callsMap.get(inId)!.push(call.target);
    }

    for (const sym of symbols) {
      const targets = callsMap.get(sym.id.toString());
      if (targets && targets.length > 0) {
        const uniqueTargets = [...new Set(targets)].slice(0, 5).join(', ');
        callGraph.push(`// ${sym.kind} '${sym.name}' calls: ${uniqueTargets}`);
      }
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

async function dependencyOnlyStrategy(relPath: string, absPath: string, fileId: string, store: IStore, preFetchedSymbols?: any[]) {
    return await dependency_only_logic(relPath, absPath, fileId, store, preFetchedSymbols);
}

async function implementationOfStrategy(relPath: string, absPath: string, fileId: string, targetSymbol: string, store: IStore, includeDocs: boolean) {
  // Use proper RecordId for fileId if it's not already one
  const recordId = typeof fileId === 'string' ? new StringRecordId(fileId) : fileId;

  const results = await store.query<any>(
    'SELECT * FROM symbol WHERE (string::lowercase(name) = string::lowercase($name) OR string::ends_with(string::lowercase(name), string::lowercase($suffix))) AND fileId = $fileId LIMIT 1', 
    { name: targetSymbol, suffix: `.${targetSymbol}`, fileId: recordId }
  );
  
  if (!results || results.length === 0) {
    // Fuzzy match
    const allSymbolsRes = await store.query<any>('SELECT name FROM symbol WHERE fileId = $fileId', { fileId: recordId });
    const symbolNames = allSymbolsRes.map(s => s.name);
    const closest = findClosestMatch(targetSymbol, symbolNames);
    
    let msg = `Symbol '${targetSymbol}' not found in ${relPath}.`;
    if (closest) {
       // Check if the closest match is actually an exact match (ignoring case)
       if (closest.toLowerCase() === targetSymbol.toLowerCase()) {
         // This is the weird case where the query failed but fuzzy match found it
         // Let's try to get the full symbol for this closest match
         const fallbackRes = await store.query<any>('SELECT * FROM symbol WHERE name = $name AND fileId = $fileId LIMIT 1', { name: closest, fileId: recordId });
         if (fallbackRes && fallbackRes.length > 0) {
           return await renderSymbol(fallbackRes[0], absPath, store, includeDocs);
         }
       }
       msg += ` Did you mean '${closest}'?`;
    }
    if (symbolNames.length > 0) {
      msg += `\nAvailable symbols in this file: ${symbolNames.join(', ')}`;
    }
    
    return {
      content: msg,
      mode_used: 'implementation_of',
      symbol_count: 0
    };
  }

  return await renderSymbol(results[0], absPath, store, includeDocs);
}

async function renderSymbol(sym: any, absPath: string, store: IStore, includeDocs: boolean) {
  const output: string[] = [];

  // If it's a method, try to find the parent class signature for context
  let parentId = sym.parentSymbolId;
  if (!parentId) {
    // Try range-based lookup
    const parents = await store.query<any>(
      'SELECT * FROM symbol WHERE kind = "class" AND startLine < $line AND endLine > $line AND fileId = $fileId LIMIT 1',
      { line: sym.startLine, fileId: sym.fileId }
    );
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

  const rangeStart = (includeDocs && sym.docStartLine) ? sym.docStartLine : sym.startLine;
  const code = fileCache.getRange(absPath, rangeStart, sym.endLine).join('\n');
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
