import { Parser, SyntaxNode } from 'web-tree-sitter';
import { SymbolIR, EdgeIR, ExtractorContext, ExtractionResult } from './types.js';
import crypto from 'crypto';

export abstract class BaseExtractor {
  abstract readonly language: string;
  abstract readonly extensions: string[];

  abstract extract(ctx: ExtractorContext): ExtractionResult;

  generateFileId(relativePath: string): string {
    return `file:${relativePath.replace(/\W/g, '_')}`;
  }

  postProcess(
    symbols: SymbolIR[], 
    edges: EdgeIR[], 
    ctx: ExtractorContext
  ): { symbols: SymbolIR[]; edges: EdgeIR[] } {
    return { symbols, edges };
  }

  generateSymbolId(
    filePath: string, 
    symbolName: string, 
    kind: string, 
    startLine: number
  ): string {
    const pathHash = this.hashPath(filePath);
    const safeName = symbolName.replace(/\W/g, '_');
    return `symbol:${pathHash}_${safeName}_${kind}_${startLine}`;
  }

  protected hashPath(filePath: string): string {
    return crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 8);
  }

  protected walk(
    node: SyntaxNode, 
    visitors: Record<string, (node: SyntaxNode) => void>
  ): void {
    const visitor = visitors[node.type];
    if (visitor) {
      visitor(node);
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walk(node.child(i)!, visitors);
    }
  }

  protected runQuery(
    language: any, 
    node: SyntaxNode, 
    queryString: string
  ): any[] {
    const query = language.query(queryString);
    return query.matches(node);
  }

  protected extractDocstring(node: SyntaxNode, content: string): { text: string; startLine: number; endLine: number } | null {
    let current: SyntaxNode | null = node;
    while (current) {
      const prev = current.previousNamedSibling;
      if (prev && (prev.type === 'comment' || prev.type === 'block_comment')) {
        return {
          text: content.slice(prev.startIndex, prev.endIndex).trim(),
          startLine: prev.startPosition.row + 1,
          endLine: prev.endPosition.row + 1
        };
      }
      // Only go up one level to check statement parent
      if (current.parent && ['expression_statement', 'lexical_declaration', 'variable_declaration'].includes(current.parent.type)) {
        current = current.parent;
      } else {
        break;
      }
    }
    return null;
  }
}
