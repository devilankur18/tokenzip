export interface SymbolIR {
  id: string;
  fileId: string;
  name: string;
  kind: string;
  signature?: string;
  returnType?: string;
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  docstring?: string | null;
  docStartLine?: number;
  docEndLine?: number;
  isExported: boolean;
  isAsync?: boolean;
  isStatic?: boolean;
  visibility?: 'public' | 'private' | 'protected';
  modifiers: string[];
  parentSymbolId?: string;
  metadata: Record<string, unknown>;
}

export interface EdgeIR {
  type: string;
  from: string;
  to: string;
  metadata?: Record<string, unknown>;
  isResolved?: boolean;
}

export interface ParseError {
  line: number;
  column: number;
  message: string;
}

export interface ExtractionResult {
  symbols: SymbolIR[];
  edges: EdgeIR[];
  parseErrors: ParseError[];
}

export interface ExtractorContext {
  filePath: string;
  relativePath: string;
  content: string;
  contentHash: string;
  tree: import('web-tree-sitter').Tree;
  language: string;
  moduleId: string | null;
}
