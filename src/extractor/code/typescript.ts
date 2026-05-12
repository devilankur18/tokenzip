import { BaseExtractor } from '../base-extractor.js';
import { ExtractorContext, ExtractionResult, SymbolIR, EdgeIR, ParseError } from '../types.js';

export class TypeScriptExtractor extends BaseExtractor {
  language = 'typescript';
  extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];

  extract(ctx: ExtractorContext): ExtractionResult {
    const symbols: SymbolIR[] = [];
    const edges: EdgeIR[] = [];
    const parseErrors: ParseError[] = [];

    const fileId = this.generateFileId(ctx.relativePath);
    const iifeBody = this.findTopLevelIIFE(ctx.tree.rootNode);

    this.walk(ctx.tree.rootNode, {
      'import_statement': (node) => {
        const sourceNode = node.childForFieldName('source');
        if (sourceNode) {
          const source = sourceNode.text.replace(/['"]/g, '');
          edges.push({
            type: 'imports',
            from: fileId,
            to: `unresolved:${source}`,
            metadata: { source },
            isResolved: false
          });
        }
      },
      'function_declaration': (node) => {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) return;
        const name = nameNode.text;
        const id = this.generateSymbolId(ctx.relativePath, name, 'function', node.startPosition.row + 1);
        
        symbols.push({
          id,
          fileId,
          name,
          kind: 'function',
          signature: this.getSignature(node, ctx.content),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startCol: node.startPosition.column,
          endCol: node.endPosition.column,
          ...(() => {
            const doc = this.extractDocstring(node, ctx.content);
            return doc ? { docstring: doc.text, docStartLine: doc.startLine, docEndLine: doc.endLine } : {};
          })(),
          isInternal: this.calculateInternal(node, iifeBody),
          isExported: this.isExported(node),
          modifiers: [],
          metadata: {},
        });

        this.extractCalls(node, id, edges);
      },
      'class_declaration': (node) => {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) return;
        const name = nameNode.text;
        const id = this.generateSymbolId(ctx.relativePath, name, 'class', node.startPosition.row + 1);
        
        symbols.push({
          id,
          fileId,
          name,
          kind: 'class',
          signature: this.getSignature(node, ctx.content),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startCol: node.startPosition.column,
          endCol: node.endPosition.column,
          ...(() => {
            const doc = this.extractDocstring(node, ctx.content);
            return doc ? { docstring: doc.text, docStartLine: doc.startLine, docEndLine: doc.endLine } : {};
          })(),
          isInternal: this.calculateInternal(node, iifeBody),
          isExported: this.isExported(node),
          modifiers: [],
          metadata: {},
        });

        // Extract inherits (extends)
        const heritage = node.childForFieldName('heritage');
        if (heritage) {
          const extendsClause = heritage.descendantsOfType('extends_clause')[0];
          if (extendsClause) {
            const baseClass = extendsClause.child(1)?.text;
            if (baseClass) {
              edges.push({
                type: 'inherits',
                from: id,
                to: `unresolved_symbol:${baseClass}`,
                metadata: { targetName: baseClass },
                isResolved: false
              });
            }
          }

          // Extract implements
          const implementsClause = heritage.descendantsOfType('implements_clause')[0];
          if (implementsClause) {
            const interfaces = implementsClause.descendantsOfType('type_identifier');
            for (const iface of interfaces) {
              edges.push({
                type: 'implements',
                from: id,
                to: `unresolved_symbol:${iface.text}`,
                metadata: { targetName: iface.text },
                isResolved: false
              });
            }
          }
        }

        this.extractCalls(node, id, edges);
      },
      'method_definition': (node) => {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) return;
        const name = nameNode.text;
        const id = this.generateSymbolId(ctx.relativePath, name, 'method', node.startPosition.row + 1);
        
        symbols.push({
          id,
          fileId,
          name,
          kind: 'method',
          signature: this.getSignature(node, ctx.content),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startCol: node.startPosition.column,
          endCol: node.endPosition.column,
          ...(() => {
            const doc = this.extractDocstring(node, ctx.content);
            return doc ? { docstring: doc.text, docStartLine: doc.startLine, docEndLine: doc.endLine } : {};
          })(),
          isExported: false,
          modifiers: [],
          metadata: {},
        });

        this.extractCalls(node, id, edges);
      },
      'enum_declaration': (node) => {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) return;
        const name = nameNode.text;
        const id = this.generateSymbolId(ctx.relativePath, name, 'enum', node.startPosition.row + 1);
        
        symbols.push({
          id,
          fileId,
          name,
          kind: 'enum',
          signature: this.getSignature(node, ctx.content),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startCol: node.startPosition.column,
          endCol: node.endPosition.column,
          ...(() => {
            const doc = this.extractDocstring(node, ctx.content);
            return doc ? { docstring: doc.text, docStartLine: doc.startLine, docEndLine: doc.endLine } : {};
          })(),
          isInternal: this.calculateInternal(node, iifeBody),
          isExported: this.isExported(node),
          modifiers: [],
          metadata: {},
        });
      },
      'interface_declaration': (node) => {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) return;
        const name = nameNode.text;
        const id = this.generateSymbolId(ctx.relativePath, name, 'interface', node.startPosition.row + 1);
        
        symbols.push({
          id,
          fileId,
          name,
          kind: 'interface',
          signature: this.getSignature(node, ctx.content),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startCol: node.startPosition.column,
          endCol: node.endPosition.column,
          ...(() => {
            const doc = this.extractDocstring(node, ctx.content);
            return doc ? { docstring: doc.text, docStartLine: doc.startLine, docEndLine: doc.endLine } : {};
          })(),
          isInternal: this.calculateInternal(node, iifeBody),
          isExported: this.isExported(node),
          modifiers: [],
          metadata: {},
        });
      },
      'type_alias_declaration': (node) => {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) return;
        const name = nameNode.text;
        const id = this.generateSymbolId(ctx.relativePath, name, 'type', node.startPosition.row + 1);
        
        symbols.push({
          id,
          fileId,
          name,
          kind: 'type',
          signature: this.getSignature(node, ctx.content),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          startCol: node.startPosition.column,
          endCol: node.endPosition.column,
          ...(() => {
            const doc = this.extractDocstring(node, ctx.content);
            return doc ? { docstring: doc.text, docStartLine: doc.startLine, docEndLine: doc.endLine } : {};
          })(),
          isInternal: this.calculateInternal(node, iifeBody),
          isExported: this.isExported(node),
          modifiers: [],
          metadata: {},
        });
      },
      'assignment_expression': (node) => {
        const left = node.childForFieldName('left');
        let right = node.childForFieldName('right');
        
        // Chained assignment? req.get = req.header = function...
        // We peek ahead to the end of the chain to see if it's a function
        let ultimateRight = right;
        while (ultimateRight?.type === 'assignment_expression') {
          ultimateRight = ultimateRight.childForFieldName('right');
        }

        const functionTypes = ['function_expression', 'arrow_function', 'function', 'generator_function', 'method_definition'];
        if (functionTypes.includes(ultimateRight?.type || '')) {
          if (left?.type === 'member_expression' || left?.type === 'identifier') {
            const name = left.text;
            const id = this.generateSymbolId(ctx.relativePath, name, 'method', node.startPosition.row + 1);
            let isInternal = this.isInsideFunction(node);
            if (isInternal && iifeBody && this.isNodeInside(node, iifeBody)) {
              if (!this.isNestedDeeperThan(node, iifeBody)) {
                isInternal = false;
              }
            }
            
            symbols.push({
              id,
              fileId,
              name,
              kind: 'method',
              signature: this.getSignature(node, ctx.content),
              isInternal: this.calculateInternal(node, iifeBody),
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
              startCol: node.startPosition.column,
              endCol: node.endPosition.column,
              ...(() => {
            const doc = this.extractDocstring(node, ctx.content);
            return doc ? { docstring: doc.text, docStartLine: doc.startLine, docEndLine: doc.endLine } : {};
          })(),
              isExported: name.startsWith('exports.') || name.startsWith('module.exports'),
              modifiers: [],
              metadata: {},
            });
            this.extractCalls(ultimateRight, id, edges);
          }
        }
      },
      'expression_statement': (node) => {
        // Check for call expressions like defineGetter
        const expression = node.firstChild;
        if (expression?.type === 'call_expression') {
          const fnNode = expression.childForFieldName('function');
          if (fnNode?.text === 'defineGetter') {
            const args = expression.childForFieldName('arguments');
            const nameArg = args?.namedChild(1);
            const fnArg = args?.namedChild(2);
            
            if (nameArg && fnArg) {
              const name = nameArg.text.replace(/['"]/g, '');
              const id = this.generateSymbolId(ctx.relativePath, name, 'method', node.startPosition.row + 1);
              
              symbols.push({
                id,
                fileId,
                name,
                kind: 'method',
                signature: `getter ${name}`,
                startLine: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                startCol: node.startPosition.column,
                endCol: node.endPosition.column,
                ...(() => {
            const doc = this.extractDocstring(node, ctx.content);
            return doc ? { docstring: doc.text, docStartLine: doc.startLine, docEndLine: doc.endLine } : {};
          })(),
                isExported: true,
                modifiers: [],
                metadata: {},
              });
              this.extractCalls(fnArg, id, edges);
            }
          }
        }
      },
      'variable_declaration': (node) => {
        this.extractVariables(node, symbols, fileId, ctx, edges, iifeBody);
      },
      'lexical_declaration': (node) => {
        this.extractVariables(node, symbols, fileId, ctx, edges, iifeBody);
      },
    });

    return { symbols, edges, parseErrors };
  }

  private extractVariables(node: any, symbols: any[], fileId: string, ctx: any, edges: any[], iifeBody?: any) {
    const declarators = node.children.filter((c: any) => c.type === 'variable_declarator');
    for (const decl of declarators) {
      const nameNode = decl.childForFieldName('name');
      if (!nameNode) continue;
      const name = nameNode.text;
      const valueNode = decl.childForFieldName('value');
      let kind = 'variable';
      if (valueNode) {
        let effectiveValue = valueNode;
        // Unwrap common React wrappers: React.memo(() => ...), forwardRef(() => ...)
        while (effectiveValue.type === 'call_expression') {
          const fnNode = effectiveValue.childForFieldName('function');
          const fnText = fnNode?.text || '';
          if (['memo', 'forwardRef', 'React.memo', 'React.forwardRef'].some(w => fnText.includes(w))) {
            const args = effectiveValue.childForFieldName('arguments');
            const firstArg = args?.namedChild(0);
            if (firstArg) {
              effectiveValue = firstArg;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        if (['arrow_function', 'function_expression'].includes(effectiveValue.type)) {
          kind = 'function';
        } else if (effectiveValue.type === 'class_expression') {
          kind = 'class';
        }
      }

      const id = this.generateSymbolId(ctx.relativePath, name, kind, decl.startPosition.row + 1);
      
      let isInternal = this.calculateInternal(decl, iifeBody);

      symbols.push({
        id,
        fileId,
        name,
        kind,
        signature: this.getSignature(node, ctx.content),
        isInternal,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        startCol: node.startPosition.column,
        endCol: node.endPosition.column,
        ...(() => {
          const doc = this.extractDocstring(node, ctx.content);
          return doc ? { docstring: doc.text, docStartLine: doc.startLine, docEndLine: doc.endLine } : {};
        })(),
        isExported: this.isExported(node),
        modifiers: [],
        metadata: {},
      });
      this.extractCalls(decl, id, edges);
    }
  }

  private calculateInternal(node: any, iifeBody?: any): boolean {
    let internal = this.isInsideFunction(node);
    if (internal && iifeBody && this.isNodeInside(node, iifeBody)) {
      if (!this.isNestedDeeperThan(node, iifeBody)) {
        internal = false;
      }
    }
    return internal;
  }

  private isNodeInside(node: any, container: any): boolean {
    let curr = node.parent;
    while (curr) {
      if (curr.id === container.id) return true;
      curr = curr.parent;
    }
    return false;
  }

  private isNestedDeeperThan(node: any, container: any): boolean {
    let curr = node.parent;
    while (curr && curr.id !== container.id) {
      if (['function_declaration', 'function_expression', 'arrow_function', 'method_definition'].includes(curr.type)) {
        return true;
      }
      curr = curr.parent;
    }
    return false;
  }

  private extractCalls(node: any, symbolId: string, edges: EdgeIR[]) {
    this.walk(node, {
      'call_expression': (callNode) => {
        const fnNode = callNode.childForFieldName('function');
        if (fnNode) {
          const targetName = fnNode.text;
          edges.push({
            type: 'calls',
            from: symbolId,
            to: `unresolved_symbol:${targetName}`,
            metadata: { 
              targetName,
              isMemberCall: fnNode.type === 'member_expression'
            },
            isResolved: false
          });
        }
      }
    });
  }

  private isInsideFunction(node: any): boolean {
    let curr = node.parent;
    while (curr) {
      if (['function_declaration', 'function_expression', 'arrow_function', 'method_definition'].includes(curr.type)) {
        return true;
      }
      curr = curr.parent;
    }
    return false;
  }

  private isExported(node: any): boolean {
    return node.parent?.type === 'export_statement';
  }

  private getSignature(node: any, content: string): string {
    // For function/class declarations, they usually have a 'body' or 'statement_block'
    const body = node.childForFieldName('body') || node.descendantsOfType('statement_block')[0];
    
    // Special handling for variables that are functions
    if (['variable_declaration', 'lexical_declaration'].includes(node.type)) {
      const decl = node.children.find((c: any) => c.type === 'variable_declarator');
      const value = decl?.childForFieldName('value');
      if (value) {
        let effectiveValue = value;
        // Unwrap React.memo, etc.
        while (effectiveValue.type === 'call_expression') {
          const fnNode = effectiveValue.childForFieldName('function');
          const fnText = fnNode?.text || '';
          if (['memo', 'forwardRef', 'React.memo', 'React.forwardRef'].some(w => fnText.includes(w))) {
            const args = effectiveValue.childForFieldName('arguments');
            const firstArg = args?.namedChild(0);
            if (firstArg) effectiveValue = firstArg;
            else break;
          } else {
            break;
          }
        }

        if (['arrow_function', 'function_expression', 'class_expression'].includes(effectiveValue.type)) {
          const valBody = effectiveValue.childForFieldName('body') || effectiveValue.descendantsOfType('statement_block')[0];
          if (valBody) {
            return content.slice(node.startIndex, valBody.startIndex).trim();
          }
        }
      }
      
      // If it's a simple variable, we might want to truncate if it's too long
      const full = content.slice(node.startIndex, node.endIndex).trim();
      if (full.length > 200) {
        return full.split('\n')[0].split(';')[0].trim() + ' ...';
      }
      return full;
    }

    if (body) {
      return content.slice(node.startIndex, body.startIndex).trim();
    }
    
    // Fallback to first line if no body found
    return content.slice(node.startIndex, node.endIndex).split('\n')[0];
  }

  private findTopLevelIIFE(root: any): any | null {
    for (let i = 0; i < root.namedChildCount; i++) {
      const node = root.namedChild(i);
      if (node.type === 'expression_statement') {
        const call = node.firstNamedChild;
        if (call?.type === 'call_expression') {
          const fn = call.childForFieldName('function');
          // Handle (() => {})()
          if (fn?.type === 'parenthesized_expression') {
            const inner = fn.firstNamedChild;
            if (inner && ['arrow_function', 'function_expression'].includes(inner.type)) {
              return inner.childForFieldName('body');
            }
          }
          // Handle (function() {})() without parentheses (less common but possible)
          if (fn && ['arrow_function', 'function_expression'].includes(fn.type)) {
            return fn.childForFieldName('body');
          }
        }
      }
    }
    return null;
  }
}
