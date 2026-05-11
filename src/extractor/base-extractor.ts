import { Parser, SyntaxNode } from 'web-tree-sitter';
import { SymbolIR, EdgeIR, ExtractorContext, ExtractionResult } from './types.js';
import crypto from 'crypto';

export abstract class BaseExtractor {
  abstract readonly language: string;
  abstract readonly extensions: string[];

  abstract extract(ctx: ExtractorContext): ExtractionResult;

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
    return `symbol:${pathHash}_${symbolName}_${kind}_${startLine}`;
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

  protected extractDocstring(node: SyntaxNode, content: string): string | null {
    const prev = node.previousNamedSibling;
    if (prev && (prev.type === 'comment' || prev.type === 'block_comment')) {
      return content.slice(prev.startIndex, prev.endIndex).trim();
    }
    return null;
  }
}
