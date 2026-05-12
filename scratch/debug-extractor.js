import fs from 'node:fs';
import path from 'node:path';
import { Parser, Language } from 'web-tree-sitter';
import { TypeScriptExtractor } from '../src/extractor/code/typescript.js';

async function test() {
  await Parser.init();
  const parser = new Parser();
  const Lang = await Language.load('node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm');
  parser.setLanguage(Lang);

  const extractor = new TypeScriptExtractor();
  const filePath = '/tmp/openclaw-bench/ui/src/ui/custom-theme.ts';
  const content = fs.readFileSync(filePath, 'utf8');
  const tree = parser.parse(content);

  const ctx = {
    filePath,
    relativePath: 'ui/src/ui/custom-theme.ts',
    content,
    contentHash: 'mock',
    tree,
    language: 'typescript',
    moduleId: null
  };

  const iifeBody = extractor['findTopLevelIIFE'](tree.rootNode);
  console.log('IIFE Body found:', !!iifeBody);
  if (iifeBody) {
    console.log('IIFE Body type:', iifeBody.type);
    console.log('IIFE Body range:', iifeBody.startPosition.row, 'to', iifeBody.endPosition.row);
  }

  const result = extractor.extract(ctx);
  let log = `Symbols: ${result.symbols.length}\n`;
  log += `IIFE Body found: ${!!iifeBody}\n`;
  for (const sym of result.symbols) {
    log += `- ${sym.name} (${sym.kind}) [internal=${sym.isInternal}] signature: ${sym.signature}\n`;
  }
  fs.writeFileSync('scratch/debug-output.txt', log);
}

test().catch(console.error);
