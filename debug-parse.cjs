const Parser = require('web-tree-sitter');

async function test() {
  await Parser.init();
  const parser = new Parser();
  const Lang = await Parser.Language.load('/Users/ankur/dev/docx/docx-1/.tokenzip/node_modules/web-tree-sitter/tree-sitter-typescript.wasm');
  parser.setLanguage(Lang);

  const code = "app.handle = function handle(req, res, callback) {}";
  const tree = parser.parse(code);
  
  function dump(node, depth = 0) {
    console.log('  '.repeat(depth) + node.type + (node.childCount === 0 ? ` (${node.text})` : ''));
    for (let i = 0; i < node.childCount; i++) {
      dump(node.child(i), depth + 1);
    }
  }
  
  dump(tree.rootNode);
}

test();
