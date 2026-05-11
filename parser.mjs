import fs from "fs";
import path from "path";
import Parser from "web-tree-sitter";

const ROOT = process.argv[2] || process.cwd();

const EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
]);

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
]);

const results = [];

await Parser.init();

const parser = new Parser();

const Lang = await Parser.Language.load(
  "./node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm"
);

parser.setLanguage(Lang);

function walk(dir) {
  const entries = fs.readdirSync(dir, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        walk(fullPath);
      }
      continue;
    }

    const ext = path.extname(entry.name);

    if (EXTENSIONS.has(ext)) {
      parseFile(fullPath);
    }
  }
}

function parseFile(filePath) {
  try {
    const code = fs.readFileSync(filePath, "utf8");

    const tree = parser.parse(code);

    const fileData = {
      file: path.relative(ROOT, filePath),
      imports: [],
      functions: [],
      hooks: [],
      supabaseTables: [],
    };

    traverse(tree.rootNode, code, fileData);

    results.push(fileData);
  } catch (err) {
    console.error(`Failed: ${filePath}`);
    console.error(err.message);
  }
}

function traverse(node, code, fileData) {
  extractImport(node, code, fileData);
  extractFunction(node, code, fileData);
  extractHook(node, code, fileData);
  extractSupabase(node, code, fileData);

  for (const child of node.namedChildren) {
    traverse(child, code, fileData);
  }
}

function text(node, code) {
  return code.slice(node.startIndex, node.endIndex);
}

function extractImport(node, code, fileData) {
  if (node.type !== "import_statement") return;

  const source = node.childForFieldName("source");

  if (source) {
    fileData.imports.push(
      text(source, code).replace(/['"]/g, "")
    );
  }
}

function extractFunction(node, code, fileData) {
  if (
    node.type === "function_declaration" ||
    node.type === "method_definition"
  ) {
    const nameNode = node.childForFieldName("name");

    if (nameNode) {
      fileData.functions.push(
        text(nameNode, code)
      );
    }
  }

  if (node.type === "lexical_declaration") {
    const txt = text(node, code);

    const match = txt.match(
      /const\s+([A-Za-z0-9_]+)\s*=\s*\(?.*=>/
    );

    if (match) {
      fileData.functions.push(match[1]);
    }
  }
}

function extractHook(node, code, fileData) {
  if (node.type !== "call_expression") return;

  const fn = node.childForFieldName("function");

  if (!fn) return;

  const fnText = text(fn, code);

  if (fnText.startsWith("use")) {
    fileData.hooks.push(fnText);
  }
}

function extractSupabase(node, code, fileData) {
  if (node.type !== "call_expression") return;

  const fn = node.childForFieldName("function");

  if (!fn) return;

  const fnText = text(fn, code);

  if (!fnText.includes(".from")) return;

  const args = node.childForFieldName("arguments");

  if (!args) return;

  const argText = text(args, code);

  const match = argText.match(
    /["'`](.*?)["'`]/
  );

  if (match) {
    fileData.supabaseTables.push(match[1]);
  }
}

console.log(`Scanning: ${ROOT}`);

walk(ROOT);

const output = {
  scannedAt: new Date().toISOString(),
  totalFiles: results.length,
  files: results,
};

fs.writeFileSync(
  "ast-index.json",
  JSON.stringify(output, null, 2)
);

console.log("Done.");
console.log(`Files parsed: ${results.length}`);
console.log("Output: ast-index.json");