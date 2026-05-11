import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { Parser, Language } from "web-tree-sitter";
import { Surreal, createRemoteEngines } from 'surrealdb';
import { createNodeEngines } from '@surrealdb/node';



const MODE = process.argv[2];
const QUERY = process.argv[3];
const ROOT = process.cwd();
const TS_WASM_PATH = "./node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm";

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".mdx"]);
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".tokenzip"]);

// const db = new Surreal();

const db = new Surreal({
    engines: {
        ...createRemoteEngines(),
        ...createNodeEngines(),
    },
});

// ==========================================
// RECURSIVE CRAWLER
// ==========================================
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!IGNORE_DIRS.has(file)) getAllFiles(fullPath, arrayOfFiles);
    } else if (EXTENSIONS.has(path.extname(file))) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

// ==========================================
// AST EXTRACTOR: FIND DIRECT CALLS
// ==========================================
// This replaces Regex. It only finds direct calls like `myFunc()` 
// and ignores member expressions like `toast.success()` or `array.map()`.
function extractDirectCalls(astNode) {
  const calls = new Set();
  const walk = (n) => {
    if (n.type === 'call_expression') {
      const fnNode = n.childForFieldName('function');
      // Only grab direct identifiers (ignores obj.method calls)
      if (fnNode && fnNode.type === 'identifier') {
        calls.add(fnNode.text);
      }
    }
    for (let i = 0; i < n.childCount; i++) walk(n.child(i));
  };
  walk(astNode);
  return Array.from(calls);
}

// ==========================================
// CORE LOGIC: THE INGESTOR
// ==========================================
async function indexCodebase() {
  await Parser.init();
  const parser = new Parser();
  const Lang = await Language.load(TS_WASM_PATH);
  parser.setLanguage(Lang);

  const allFiles = getAllFiles(ROOT);
  console.log(`🚀 Indexing ${allFiles.length} files...\n`);

  for (const filePath of allFiles) {
    const relativePath = path.relative(ROOT, filePath);
    const code = fs.readFileSync(filePath, "utf8");
    const fileId = `file:\`${relativePath.replace(/\W/g, '_')}\``;

    // Handle Markdown Files for Workflows
    if (relativePath.endsWith('.md') || relativePath.endsWith('.mdx')) {
      await db.query(`UPSERT ${fileId} SET path = $path, type = 'markdown', content = $content`, { path: relativePath, content: code });
      console.log(`✅ [MD] ${relativePath}`);
      continue;
    }

    const lines = code.split("\n");
    let tree;
    try { tree = parser.parse(code); } catch(e) { continue; }

    await db.query(`UPSERT ${fileId} SET path = $path, type = 'code'`, { path: relativePath });

    const walkAST = async (node) => {
      const isFunction = ['function_declaration', 'method_definition', 'arrow_function'].includes(node.type);
      const isClass = node.type === 'class_declaration';

      if (isFunction || isClass) {
        let nameNode = node.childForFieldName('name');
        if (!nameNode && node.type === 'arrow_function' && node.parent?.type === 'variable_declarator') {
          nameNode = node.parent.childForFieldName('name');
        }

        if (nameNode) {
          const rawName = nameNode.text;
          const safeName = rawName.replace(/\W/g, '_');
          const symId = `symbol:\`${safeName}_${Math.random().toString(36).substring(2, 7)}\``;

          const signature = lines[node.startPosition.row].trim();
          const snippet = code.substring(node.startIndex, node.endIndex);
          
          // Use AST to find exact function calls (No more Regex!)
          const directCalls = extractDirectCalls(node);

          try {
            await db.query(`
              CREATE ${symId} SET 
                name = $name, 
                kind = $kind, 
                signature = $signature,
                snippet = $snippet,
                calls_out = $calls_out,
                line_start = $line_start,
                line_end = $line_end;
              RELATE ${symId}->BELONGS_TO->${fileId};
            `, {
              name: rawName,
              kind: node.type,
              signature: signature,
              snippet: snippet,
              calls_out: directCalls,
              line_start: node.startPosition.row + 1,
              line_end: node.endPosition.row + 1
            });
          } catch (e) { /* skip */ }
        }
      }
      for (let i = 0; i < node.childCount; i++) await walkAST(node.child(i));
    };

    await walkAST(tree.rootNode);
    console.log(`✅ [TS] ${relativePath}`);
  }
}

// ==========================================
// SEARCH ENRICHED (LLM-Optimized Callstack)
// ==========================================
async function searchMetadata(term) {
  const results = await db.query(`
    SELECT 
        id, name, signature, kind, snippet, calls_out, line_start, line_end,
        (->BELONGS_TO->file.path)[0] as file_path
    FROM symbol 
    WHERE string::lowercase(name) CONTAINS string::lowercase($term) 
    AND kind != 'variable_declarator'
    ORDER BY name ASC
    LIMIT 5
  `, { term });

  if (!results[0] || results[0].length === 0) {
    console.log(`RESULT: None found for "${term}"`);
    return;
  }

  for (const r of results[0]) {
    // 1. Callers (Incoming) - Using the new `calls_out` array!
    const callersRes = await db.query(`
      SELECT name, (->BELONGS_TO->file.path)[0] as file 
      FROM symbol 
      WHERE $symName IN calls_out
    `, { symName: r.name });
    const callers = callersRes[0] || [];

    // 2. Callees (Outgoing / Internal Dependencies)
    let resolvedCallees = [];
    const validCalls = (r.calls_out || []).filter(c => !['if', 'for', 'while', 'switch', 'catch', 'useState', 'useEffect', 'useMemo', 'useCallback'].includes(c));
    
    if (validCalls.length > 0) {
       const calleeRes = await db.query(`
         SELECT name, (->BELONGS_TO->file.path)[0] as file
         FROM symbol
         WHERE name IN $calls
       `, { calls: validCalls });
       // Deduplicate
       resolvedCallees = Array.from(new Map((calleeRes[0] || []).map(item => [item.name, item])).values());
    }
    const resolvedNames = new Set(resolvedCallees.map(c => c.name));
    const externalCalls = validCalls.filter(c => !resolvedNames.has(c));

    // 3. Workflows (Markdown)
    const workflowsRes = await db.query(`
      SELECT path FROM file 
      WHERE type = 'markdown' AND string::contains(content, $symName)
    `, { symName: r.name });
    const workflows = workflowsRes[0] || [];

    // 4. Git History (Fixed Execution Path and Error Handling)
    let gitLogs = [];
    try {
      const gitCmd = `git log -L ${r.line_start},${r.line_end}:${r.file_path} --oneline -n 3`;
      // Run git from the ROOT of the repo, capturing stderr to debug
      const stdout = execSync(gitCmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (stdout) {
         gitLogs = stdout.split('\n').filter(l => /^[a-f0-9]{7,} /.test(l)).map(l => l.trim());
      }
    } catch (e) { 
      // If it fails, print the exact Git reason (e.g. "file not tracked" or "line out of bounds")
      const errMsg = e.stderr ? e.stderr.toString().trim().split('\n')[0] : e.message.split('\n')[0];
      gitLogs = [`[Git Info] ${errMsg}`];
    }

    // --- LLM-OPTIMIZED OUTPUT ---
    console.log(`SYMBOL: ${r.name}`);
    console.log(`KIND: ${r.kind}`);
    console.log(`LOC: ${r.file_path}:${r.line_start}-${r.line_end}`);
    console.log(`SIG: ${r.signature}`);
    
    console.log(`CALL_STACK_IN (Callers):`);
    if (callers.length === 0) console.log(`  - None`);
    callers.forEach(c => console.log(`  - ${c.name} [${c.file}]`));

    console.log(`CALL_STACK_OUT (Internal Dependencies):`);
    if (resolvedCallees.length === 0) console.log(`  - None`);
    resolvedCallees.forEach(c => console.log(`  - ${c.name} [${c.file}]`));
    
    if (externalCalls.length > 0) {
      console.log(`EXTERNAL_DEPS: ${externalCalls.join(', ')}`);
    }

    console.log(`DOCS_WORKFLOWS:`);
    if (workflows.length === 0) console.log(`  - None`);
    workflows.forEach(w => console.log(`  - ${w.path}`));

    console.log(`GIT_HISTORY:`);
    if (gitLogs.length === 0) console.log(`  - None`);
    gitLogs.forEach(l => console.log(`  - ${l}`));

    console.log(`---`);
  }
}

// ==========================================
// RUNTIME
// ==========================================
async function main() {
  // await db.connect('ws://127.0.0.1:8000/rpc');
  await db.connect('surrealkv://./.tokenzip/db');
  // await db.signin({ username: 'root', password: 'root' });
  await db.use({ namespace: 'tokenzip', database: 'poc' });

  if (MODE === 'index') {
    // await db.query('DELETE symbol, file, BELONGS_TO');
    await indexCodebase();
  } else if (MODE === 'search') {
    await searchMetadata(QUERY);
  } else {
    console.log("Usage:\n  node tokenzip-poc.js index\n  node tokenzip-poc.js search <term>");
  }
  await db.close();
}

main();