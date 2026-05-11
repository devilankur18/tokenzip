import { BaseExtractor } from '../base-extractor.js';
import { ExtractorContext, ExtractionResult, SymbolIR, EdgeIR, ParseError } from '../types.js';

export class TypeScriptExtractor extends BaseExtractor {
  language = 'typescript';
  extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];

  extract(ctx: ExtractorContext): ExtractionResult {
    const symbols: SymbolIR[] = [];
    const edges: EdgeIR[] = [];
    const parseErrors: ParseError[] = [];

    this.walk(ctx.tree.rootNode, {
      'function_declaration': (node) => {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) return;
        const name = nameNode.text;
        
        symbols.push({
          id: this.generateSymbolId(ctx.relativePath, name, 'function', node.startPosition.row + 1),
          fileId: `file:${ctx.relativePath}`,
          name,
          kind: 'function',
          signature: ctx.content.slice(node.startIndex, node.endIndex).split('\\n')[0],
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startCol: node.startPosition.column,
          endCol: node.endPosition.column,
          docstring: this.extractDocstring(node, ctx.content),
          isExported: this.isExported(node),
          modifiers: [],
          metadata: {},
        });
      },
      'class_declaration': (node) => {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) return;
        const name = nameNode.text;
        
        symbols.push({
          id: this.generateSymbolId(ctx.relativePath, name, 'class', node.startPosition.row + 1),
          fileId: `file:${ctx.relativePath}`,
          name,
          kind: 'class',
          signature: ctx.content.slice(node.startIndex, node.endIndex).split('\\n')[0],
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startCol: node.startPosition.column,
          endCol: node.endPosition.column,
          docstring: this.extractDocstring(node, ctx.content),
          isExported: this.isExported(node),
          modifiers: [],
          metadata: {},
        });
      },
      'method_definition': (node) => {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) return;
        const name = nameNode.text;
        
        symbols.push({
          id: this.generateSymbolId(ctx.relativePath, name, 'method', node.startPosition.row + 1),
          fileId: `file:${ctx.relativePath}`,
          name,
          kind: 'method',
          signature: ctx.content.slice(node.startIndex, node.endIndex).split('\\n')[0],
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startCol: node.startPosition.column,
          endCol: node.endPosition.column,
          docstring: this.extractDocstring(node, ctx.content),
          isExported: false,
          modifiers: [],
          metadata: {},
        });
      },
    });

    return { symbols, edges, parseErrors };
  }

  private isExported(node: any): boolean {
    return node.parent?.type === 'export_statement';
  }
}
