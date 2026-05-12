const Parser = require('web-tree-sitter');
const path = require('path');

async function main() {
  await Parser.init();
  const parser = new Parser();
  const Lang = await Parser.Language.load(path.resolve('node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm'));
  parser.setLanguage(Lang);

  const code = `
/**
 * Hello
 */
function test() {}
  `;

  const tree = parser.parse(code);
  const root = tree.rootNode;

  function walk(node) {
    if (node.type === 'function_declaration') {
      console.log('Found function:', node.text.split('\n')[0]);
      const prev = node.previousNamedSibling;
      if (prev) {
        console.log('Prev sibling type:', prev.type);
        console.log('Prev sibling text:', prev.text);
      } else {
        console.log('No prev sibling');
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      walk(node.child(i));
    }
  }

  walk(root);
}

main();
