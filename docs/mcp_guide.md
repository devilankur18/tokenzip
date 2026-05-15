# TokenZip MCP Server Guide

TokenZip exposes its knowledge graph to AI copilots via the **Model Context Protocol (MCP)**. This allows agents like Claude to "understand" your entire codebase without reading every file.

## Setup

### 1. Build and Parse
The MCP server requires a pre-built index.
```bash
npm run build
tokenzip parse
```

## 🔌 Multi-Editor Integration

TokenZip follows the standard MCP specification. Below are instructions for the top 10 AI-native development environments.

### 1. Claude Desktop (Reference Implementation)
The primary way to use MCP.
- **Config Path (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Config Path (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`

Add this to the `mcpServers` object:
```json
{
  "mcpServers": {
    "tokenzip": {
      "command": "tokenzip",
      "args": ["serve", "--cwd", "/absolute/path/to/your/repo"]
    }
  }
}
```

### 2. Cursor
The most popular AI-native IDE.
1. Open **Settings** (`Cmd+,` or `Ctrl+,`).
2. Go to **Features** > **MCP**.
3. Click **+ Add new global MCP Server**.
4. **Name:** `tokenzip`
5. **Type:** `command`
6. **Command:** `tokenzip serve --cwd /absolute/path/to/your/repo`

### 3. VS Code + GitHub Copilot (Native)
GitHub Copilot now supports MCP natively.
1. Open the **Command Palette** (`Cmd+Shift+P`).
2. Run **"MCP: Open User Configuration"**.
3. Add the `tokenzip` definition (same as Claude Desktop JSON above).
4. Ensure you are in **Agent Mode** in the Chat panel.

### 4. VS Code + Cline / Roo Code
High-power autonomous agent extensions.
1. Open the **Cline/Roo Code** panel.
2. Click the **MCP Servers** icon (plug icon).
3. Click **Edit Config** or add a new server.
4. Paste the JSON configuration for `tokenzip`.

### 5. Windsurf (Codeium)
The "Flow-state" IDE from Codeium.
1. Open **Settings**.
2. Go to **Advanced** > **MCP Servers**.
3. Click **Add Server** and provide the `tokenzip serve` command.

### 6. Zed
High-performance editor with built-in MCP support.
1. Open your Zed settings (`Cmd+,`).
2. Add a `mcp_servers` key to your `settings.json`:
```json
{
  "mcp_servers": {
    "tokenzip": {
      "command": "tokenzip",
      "args": ["serve", "--cwd", "/absolute/path/to/your/repo"]
    }
  }
}
```

### 7. Aider (CLI)
The most popular CLI-based AI coding assistant.
Run Aider with the `--mcp` flag:
```bash
aider --mcp "tokenzip serve --cwd /absolute/path/to/your/repo"
```

### 8. Claude Code (CLI)
Anthropic's official CLI tool.
Claude Code automatically discovers MCP servers if they are configured in your Claude Desktop config, or you can add them via:
```bash
claude config add mcp.tokenzip.command "tokenzip serve --cwd /absolute/path/to/your/repo"
```

### 9. Continue (VS Code & JetBrains)
Open-source autopilot for VS Code and JetBrains IDEs.
1. Open `~/.continue/config.json`.
2. Add to the `contextProviders` or `mcpServers` section:
```json
{
  "mcpServers": [
    {
      "name": "tokenzip",
      "command": "tokenzip",
      "args": ["serve", "--cwd", "/absolute/path/to/your/repo"]
    }
  ]
}
```

### 10. Sourcegraph Cody
Enterprise AI that supports custom MCP servers.
1. Open VS Code Settings.
2. Search for `Cody: Custom MCP Servers`.
3. Add a new entry with the `tokenzip serve` command.

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
| `fetch_symbol_metadata` | Fetch full signature, docstrings, and lines for a specific symbol ID. |
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

## 🌐 External Resources

For more information on the Model Context Protocol and how to use it across various tools, check out these community resources:

- **[Official MCP Documentation](https://modelcontextprotocol.io)**: The primary source for the protocol spec and client guides.
- **[Awesome MCP](https://github.com/punkpeye/awesome-mcp)**: A curated list of MCP servers, clients, and tools.
- **[MCP Servers Repository](https://github.com/modelcontextprotocol/servers)**: The official registry of reference server implementations.
