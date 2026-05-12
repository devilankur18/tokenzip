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
tokenzip search "db" --l## Features

- **Relational Graph Storage**: Built on **SurrealDB** (embedded), indexing files, modules, symbols, and relationships.
- **Deep Code Analysis**: Uses **Tree-sitter** to extract not just symbols, but complex relationships like `calls`, `imports`, `inherits`, and `implements`.
- **Interactive Indexing**: Real-time progress indicators and clear phase logging (Scanning → Indexing → Git → Resolution).
- **Smart Scoping**: Automatically respects `.gitignore` rules and provides robust error handling for system or restricted directories.
- **Flexible CLI**: Persistent configuration via `TOKENZIP_CWD` environment variable and global `--cwd` support.
- **AI-Ready (MCP)**: Exposes everything as an **MCP server** for deep context in Claude, Cursor, and other AI copilots.

---

## Install

```bash
npm install -g @ankur/tokenzip
```

---

## Configuration

TokenZip uses a global `--cwd` option to determine the repository root. You can set this once via an environment variable to avoid repeating it:

```bash
# Set it in your .zshrc or .bashrc
export TOKENZIP_CWD=/path/to/your/project

# Now you can run commands from anywhere
tokenzip parse
tokenzip search "Indexer"
```

---

## Commands

### `tokenzip init`

Initialize TokenZip in the target directory. Creates the `.tokenzip/` metadata folder.

```bash
tokenzip init [--cwd <dir>]
```

---

### `tokenzip parse`

Index the codebase and build the knowledge graph.

- **Interactive**: Shows real-time parsing progress and statistics.
- **Incremental**: Only parses changed files using content hashing.
- **Scale-Ready**: Respects `.gitignore` and handles restricted directories gracefully.

```bash
tokenzip parse [--full]
```

**Output:**
```
📂 Working Directory: /Users/ankur/dev/my-project
📦 Initializing Repository...
🔍 Scanning files... found 1240 files.

🚀 Indexing 1240 files...
   [45%] Processing: src/components/Header.tsx...
✅ Indexing complete! Parsed 842 files, skipped 398 in 12.4s.

📜 Extracting Git history... done.
🔄 Resolving 452 edges... done.

✨ Codebase Knowledge Graph is ready!
```

---

### `tokenzip search <query>`

Search for symbols by name. Returns rich context including:
- **Call Stack**: Who calls this symbol and what does it call?
- **Hierarchy**: Inheritance (`inherits`) and interface (`implements`) links.
- **History**: Recent git commits touching the file.

```bash
tokenzip search useEffect
```

---

### `tokenzip serve`

Start the **MCP (Model Context Protocol) server**. Exposes your code structure to AI copilots.

```bash
tokenzip serve
```

**Available Tools:**
| Tool | Description |
|------|-------------|
| `get_codebase_stats` | High-level overview of the graph density |
| `query_repo_structure` | Hierarchical view of modules and files |
| `find_references` | Multi-relationship search (calls, references, inherits, implements) |
| `query_symbol` | Get definition, signature, and context |

---

## How It Works

TokenZip transforms source code into a queryable graph:

1. **Scan**: Identifies files, respecting `.gitignore`.
2. **Extract**: Parses with Tree-sitter to find symbols and local relationships.
3. **Link**: Performs global edge resolution to connect calls across files.
4. **Enrich**: Maps Git history and inheritance hierarchies.
5. **Serve**: Provides a standard MCP interface for AI tools.

---

## Supported Languages

| Language | Status | Features |
|----------|--------|----------|
| **TypeScript/JSX** | ✅ Full | Classes, Interfaces, Call-tracking, Inheritance |
| **JavaScript** | ✅ Full | Symbol extraction, Imports/Exports |
| **Python/Go/Rust** | 🔜 Planned | - |

---

## Project Structure

```
src/
├── cli/                 # Command routing and CWD resolution
├── engine/              # Indexer logic & .gitignore handling
├── extractor/           
│   ├── code/           # Language-specific Tree-sitter extractors
│   └── git.ts          # Git history enrichment
├── mcp/                 # MCP Server & Tool definitions
├── storage/             # SurrealDB schema & store implementation
└── utils/               # Hashing and path utilities
```

---

## License

MIT © Ankur Agarwal
ence tools
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
