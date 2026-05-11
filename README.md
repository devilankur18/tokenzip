<div align="center">

# 🗜️ TokenZip v2

**Transform any codebase into a queryable knowledge graph.**  
Search symbols, trace call stacks, expose your repo to AI copilots — all from the terminal.

[![npm version](https://img.shields.io/npm/v/@ankur/tokenzip.svg)](https://www.npmjs.com/package/@ankur/tokenzip)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## What is TokenZip?

TokenZip builds a **relational graph database** of your entire codebase — from files → modules → symbols → call edges — stored locally in `.tokenzip/db`. You can then:

- **Search** symbols by name and see their callers, callees, and git history
- **Expose** the graph as an **MCP server** so AI copilots (Claude, Copilot, Cursor) can query your code structure
- **Keep it fresh** by re-running `parse` after changes

```
$ tokenzip search createMcpServer

SYMBOL: createMcpServer
KIND: function
LOC: src/mcp/server.ts:8-38
SIG: async function createMcpServer(store: IStore, repoPath: string) {
CALL_STACK_IN (Callers):
  - None
CALL_STACK_OUT (Internal Dependencies):
  - registerTools [src/mcp/tools/registry.ts]
DOCS_WORKFLOWS:
  - None
GIT_HISTORY:
  - fe0b20e3 initial commit (Ankur Agarwal)
---
```

---

## Install

### Global install (recommended)

```bash
npm install -g @ankur/tokenzip
```

You can then run `tokenzip` anywhere.

### Local install (per project)

```bash
npm install --save-dev @ankur/tokenzip
npx tokenzip init
```

---

## Quick Start

```bash
# 1. Go to any repo
cd /path/to/your-project

# 2. Initialize TokenZip (creates .tokenzip/ directory)
tokenzip init

# 3. Index the codebase (builds the graph)
tokenzip parse

# 4. Search for any symbol
tokenzip search "useEffect"
tokenzip search "handleAuth"
tokenzip search "db" --limit 5
```

---

## Commands

### `tokenzip init`

Initialize TokenZip in the current directory. Creates `.tokenzip/` with a `.gitignore` to exclude the database from version control.

```bash
tokenzip init
```

**Output:**
```
Created .tokenzip directory
Created .tokenzip/.gitignore
✅ TokenZip initialized! Run `tokenzip parse` to index your codebase.
```

---

### `tokenzip parse`

Parse the codebase and build the knowledge graph. Runs incrementally by default — only re-indexes files that have changed since the last run.

```bash
tokenzip parse           # incremental (fast, only changed files)
tokenzip parse --full    # full re-index from scratch
```

**What it indexes:**
- All `.ts`, `.tsx`, `.js`, `.jsx` files (more languages coming)
- Symbol definitions: functions, classes, interfaces, variables, methods
- Import/export edges
- Function call edges (cross-file)
- Git commit history for each file

**Output:**
```
🚀 Indexing 42 files...
✅ Indexing complete. Parsed 35 files.
Extracting Git history...
Found 12 commits.
Git history extraction complete.
🔄 Resolving 143 edges...
✅ Edge resolution complete.
Parse complete!
```

---

### `tokenzip search <query>`

Search for symbols by name. Returns rich context including location, signature, call stack, and git history.

```bash
tokenzip search <query>
tokenzip search <query> --limit 5
tokenzip search <query> --cwd /path/to/repo
```

| Flag | Default | Description |
|------|---------|-------------|
| `--limit <n>` | `10` | Maximum number of results to return |
| `--cwd <dir>` | current dir | Root of the repo to search |

**Example output:**
```
SYMBOL: createMcpServer
KIND: function
LOC: src/mcp/server.ts:8-38
SIG: async function createMcpServer(store: IStore, repoPath: string) {
CALL_STACK_IN (Callers):
  - None
CALL_STACK_OUT (Internal Dependencies):
  - registerTools [src/mcp/tools/registry.ts]
DOCS_WORKFLOWS:
  - None
GIT_HISTORY:
  - fe0b20e3 initial commit (Ankur Agarwal)
---
```

The search is **case-insensitive** and does substring matching — `tokenzip search server` will match `createMcpServer`, `ServerConfig`, etc.

---

### `tokenzip serve`

Start the **MCP (Model Context Protocol) server** over stdio. Exposes the knowledge graph to AI copilots that support MCP.

```bash
tokenzip serve
tokenzip serve --cwd /path/to/repo
```

| Flag | Default | Description |
|------|---------|-------------|
| `--cwd <dir>` | current dir | Root of the repo to serve |

**Available MCP tools exposed:**

| Tool | Description |
|------|-------------|
| `get_codebase_stats` | File, symbol, edge counts |
| `query_repo_structure` | List of all files and modules |
| `get_file_symbols` | All symbols in a specific file |
| `query_symbol` | Symbol definition + signature by name |
| `find_references` | All callers of a symbol |
| `get_dependencies` | Import graph for a file |

---

### `tokenzip reset`

Remove the database and optionally re-index from scratch.

```bash
tokenzip reset             # wipe the database only
tokenzip reset --parse     # wipe + re-index in one step
```

---

## AI Copilot Integration (MCP)

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tokenzip": {
      "command": "tokenzip",
      "args": ["serve", "--cwd", "/absolute/path/to/your-repo"]
    }
  }
}
```

### Cursor / VS Code (MCP-compatible extensions)

```json
{
  "mcp": {
    "servers": {
      "tokenzip": {
        "command": "tokenzip",
        "args": ["serve", "--cwd", "${workspaceFolder}"]
      }
    }
  }
}
```

### Smithery / other MCP hosts

```bash
tokenzip serve --cwd /path/to/repo
```
The server communicates over stdio and is compatible with any MCP 1.x client.

---

## How It Works

```
Your Repo
    │
    ├─ tokenzip init     → creates .tokenzip/
    │
    ├─ tokenzip parse    → 1. Walks all source files
    │                      2. Parses with Tree-sitter
    │                      3. Extracts symbols, imports, calls
    │                      4. Resolves cross-file edges
    │                      5. Indexes git history
    │                      6. Stores everything in SurrealDB (.tokenzip/db)
    │
    ├─ tokenzip search   → Direct graph query via SurrealQL
    │
    └─ tokenzip serve    → MCP server over stdio
                           AI copilots call tools → SurrealDB queries → results
```

**Storage:** [SurrealDB](https://surrealdb.com/) embedded (SurrealKV), stored entirely in `.tokenzip/db`. No external server needed.

**Parsing:** [Tree-sitter](https://tree-sitter.github.io/) with the TypeScript grammar. Language support is pluggable via the `ExtractorRegistry`.

---

## Graph Schema

| Node | Fields |
|------|--------|
| `file` | `path`, `language`, `line_count`, `content_hash`, `parse_status` |
| `symbol` | `name`, `kind`, `signature`, `startLine`, `endLine`, `fileId`, `isExported` |
| `module` | `name`, `is_root` |
| `commit` | `hash`, `message`, `author`, `date` |

| Edge | Meaning |
|------|---------|
| `calls` | Symbol A calls Symbol B |
| `imports` | File/module A imports from B |
| `modified_in` | File was changed in commit |

---

## Project Structure

```
.tokenzip/
├── src/
│   ├── cli/
│   │   ├── commands/    # init, parse, reset, search, serve
│   │   ├── resolve-db.ts
│   │   └── index.ts
│   ├── engine/
│   │   └── indexer.ts   # orchestrates parsing + edge resolution
│   ├── extractor/
│   │   ├── base-extractor.ts
│   │   ├── code/
│   │   │   └── typescript.ts   # Tree-sitter symbol extraction
│   │   ├── git.ts              # Git history extractor
│   │   └── registry.ts
│   ├── mcp/
│   │   ├── server.ts           # MCP server factory
│   │   ├── token-budget.ts     # Response size management
│   │   └── tools/
│   │       ├── structure.ts    # repo/file tools
│   │       └── symbol.ts       # symbol/reference tools
│   └── storage/
│       └── surreal/
│           ├── migrations.ts   # Schema definitions
│           └── store.ts        # SurrealDB CRUD + query layer
├── db/                 # SurrealDB data (gitignored)
├── package.json
└── tsup.config.ts
```

---

## Supported Languages

| Language | Status |
|----------|--------|
| TypeScript | ✅ Full |
| JavaScript | ✅ Full (via TS grammar) |
| Python | 🔜 Planned |
| Go | 🔜 Planned |
| Rust | 🔜 Planned |

---

## Adding a New Language Extractor

1. Create `src/extractor/code/<language>.ts` extending `BaseExtractor`
2. Implement `extract(ctx)` returning `{ symbols, edges, parseErrors }`
3. Register it in `src/extractor/registry.ts`

---

## Contributing

```bash
git clone https://github.com/devilankur18/tokenzip
cd tokenzip
npm install
npm run build
node dist/cli/index.js init
node dist/cli/index.js parse
node dist/cli/index.js search "Indexer"
```

---

## License

MIT © Ankur Agarwal
