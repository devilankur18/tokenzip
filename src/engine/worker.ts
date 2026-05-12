import { parentPort } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import { Parser, Language } from 'web-tree-sitter';
import { ExtractorRegistry } from '../extractor/registry.js';
import { contentHash } from '../utils/hash.js';

let parser: Parser;
let registry: ExtractorRegistry;
let languageLoaded = false;

async function init(wasmPath: string) {
  await Parser.init();
  parser = new Parser();
  const Lang = await Language.load(wasmPath);
  parser.setLanguage(Lang);
  registry = new ExtractorRegistry();
  languageLoaded = true;
}

if (parentPort) {
  parentPort.on('message', async (msg) => {
    if (msg.type === 'init') {
      try {
        await init(msg.wasmPath);
        parentPort?.postMessage({ type: 'ready' });
      } catch (e: any) {
        parentPort?.postMessage({ type: 'error', error: e.message });
      }
      return;
    }

    if (msg.type === 'extract') {
      if (!languageLoaded) {
        parentPort?.postMessage({ type: 'error', error: 'Worker not initialized' });
        return;
      }

      const { filePath, relativePath } = msg;
      try {
        const code = fs.readFileSync(filePath, 'utf8');
        const hash = contentHash(code);
        const tree = parser.parse(code);
        const extractor = registry.getExtractor(filePath);

        if (!extractor || !tree) {
          parentPort?.postMessage({ type: 'skipped', filePath });
          return;
        }

        const ctx = {
          filePath,
          relativePath,
          content: code,
          contentHash: hash,
          tree,
          language: extractor.language,
          moduleId: null, // Module ID is handled by the main thread
        };

        const result = extractor.extract(ctx);
        
        // Symbols and edges need to be serializable
        parentPort?.postMessage({
          type: 'result',
          filePath,
          hash,
          result: {
            symbols: result.symbols,
            edges: result.edges,
            parseErrors: result.parseErrors
          },
          codeLength: code.length,
          lineCount: code.split('\n').length,
          language: extractor.language,
          ext: path.extname(filePath)
        });
      } catch (e: any) {
        parentPort?.postMessage({ type: 'error', filePath, error: e.message });
      }
    }
  });
}
