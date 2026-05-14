# TokenZip MCP Server Guide

TokenZip exposes its knowledge graph to AI copilots via the **Model Context Protocol (MCP)**. This allows agents like Claude to "understand" your entire codebase without reading every file.

## Setup

### 1. Build and Parse
The MCP server requires a pre-built index.
```bash
npm run build
tokenzip parse
```

### 2. Configure Claude Desktop
Add TokenZip to your Claude Desktop configuration (usually at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "tokenzip": {
      "command": "tokenzip",
      "args": ["serve", "--cwd", "/your/project/path"]
    }
  }
}
```

> [!TIP]
> If the `tokenzip` command is not found, ensure you have linked the package locally using `npm link` or provide the absolute path to `node` and `dist/cli/index.js`.

## Available Tools

| Tool | Description |
| :--- | :--- |
| `get_code_overview` | **Recommended Entry Point.** Semantic map (Modules -> Files -> Exports). |
| `get_file_tree` | Fast, compact hierarchical file tree (Folders -> Files). |
| `inspect_targets` | Bulk fetch signatures for multiple files/symbols in one call. |
| `smart_file_read` | Read semantic file projections (Skeleton, Interface, etc.) to save tokens. |
| `query_symbol` | Find where a symbol is defined and get its full signature. |
| `find_references` | Find all callers, implementations, or users of a specific symbol. |
| `find_implementations` | Find all implementations of a specific interface or class. |
| `get_call_hierarchy` | Retrieve both incoming (callers) and outgoing (callees) for a symbol. |
| `get_context_bundle` | Fetch a symbol's implementation plus signatures of all its dependencies. |
| `search_codebase` | Regex search across the entire codebase. |
| `fuzzy_find_symbol` | Fuzzy search for symbol names. |
| `get_file_symbols` | List all symbols (functions, classes, etc.) in a specific file. |
| `get_dependencies` | Get the import dependencies for a specific file. |
| `get_codebase_stats` | Overview of files, symbols, and knowledge graph density. |
| `get_token_savings` | View ROI and efficiency metrics for the current session. |
| `cortex_save` | Save a persistent note (guideline, gotcha) to the graph. |
| `cortex_recall` | Retrieve relevant notes for a specific file or module. |
| `cortex_search` | Search for notes across the entire codebase. |
| `cortex_traverse` | Get an optimized reading order for a module or feature. |
| `cortex_suggest` | Log an improvement suggestion for the tool developer. |


## Tool Reference & Example Outputs

### 1. `get_code_overview`
Use this for initial orientation. It provides a semantic view of the architecture, focusing on entry points and modules.
```text
🏠 tokenzip
├── 📦 cli (contains 4 files)
│   ├── 📄 index.ts [𝑓 callback_program.hook, 𝑓 callback_program.parseAsync]
│   └── 📄 resolve-db.ts [𝑓 resolveDbPath]
├── 📦 mcp (contains 12 files)
│   ├── 📄 server.ts [𝑓 createMcpServer]
│   ├── 📄 token-budget.ts [🏛️ TokenBudgetManager]
│   └── 📄 usage-tracker.ts [🏛️ UsageTracker]
└── 📄 index.ts
```

### 2. `get_file_tree`
Use this for a quick "filesystem" view. It folds dense directories to save tokens.
```text
🏠 tokenzip
├── 📂 src
│   ├── 📂 cli
│   ├── 📂 mcp
│   └── 📄 index.ts
├── 📂 bench
└── 📄 tsup.config.ts
```

### 3. `inspect_targets`
Use this to drill down into multiple specific files or symbols identified in the overview.
```json
{
  "results": [
    {
      "type": "file",
      "path": "src/mcp/server.ts",
      "exports": [
        { "name": "createMcpServer", "signature": "async function createMcpServer(store: IStore, repoPath: string)" }
      ]
    },
    {
      "type": "symbol",
      "name": "TokenBudgetManager",
      "definitions": [
        { "filePath": "src/mcp/token-budget.ts", "kind": "class", "name": "TokenBudgetManager", "signature": "class TokenBudgetManager" }
      ]
    }
  ]
}
```

### 4. `smart_file_read`
Fetches specific projections. `skeleton` mode is best for understanding usage without implementation details.
```typescript
import { IStore } from '../storage/interface.js';

export async function createMcpServer(store: IStore, repoPath: string) {
    /* [body truncated to save tokens] */
}
```

### 5. Cortex Memory (Persistent Knowledge)
Cortex allows agents to save and recall architectural knowledge, guidelines, and "gotchas" directly in the code graph.

- **`cortex_save`**: Use this when you discover something important about the codebase (e.g., "The auth logic is spread across these 3 files", "Never call this function directly").
- **`cortex_recall`**: Automatically triggered by `get_code_overview` and `smart_file_read`, but can be called manually to fetch all known notes for a path.
- **`cortex_traverse`**: Generates a "reading plan" for a module based on stored hints and dependency analysis.

```json
// Example cortex_save call
{
  "category": "architecture",
  "title": "Data Flow Pattern",
  "summary": "Services must never call repositories directly; use the Orchestrator layer.",
  "scope": "module",
  "targets": ["src/services"]
}
```

## Deep Context Strategies

TokenZip tools are optimized for agentic workflows where token budgets are tight:

- **2-Step Drill Down**: Start with `get_code_overview` to find high-level modules. Then use `inspect_targets` to fetch the exact signatures of interest.
- **Adaptive Skeletonization**: Structural tools automatically fold large directories (e.g., `... (+42 more files)`) while keeping all sub-directories visible, ensuring you never lose the "road map."
- **Semantic Promotion**: Directories containing entry points (like `index.ts`) are promoted to **Modules** (📦) and their primary exports are showcased automatically in the tree view.

## Troubleshooting
- **No data returned**: Ensure you have run `tokenzip parse` first.
- **EISDIR Error**: Ensure you aren't passing a directory path to a tool that expects a file (use `inspect_targets` for directories).
- **Connection errors**: Check that the `--cwd` path in your config is correct and points to a directory with a `.tokenzip` folder.
