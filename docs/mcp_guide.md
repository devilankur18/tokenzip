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
| `get_codebase_stats` | Overview of files, symbols, and relations. |
| `query_symbol` | Find where a symbol is defined and get its signature. |
| `find_references` | Find all callers/users of a specific symbol. |
| `get_file_symbols` | List all functions, classes, and types in a file. |
| `get_dependencies` | See what a file imports. |
| `smart_file_read` | Read a file in "skeleton" mode to save tokens. |
| `query_repo_structure` | Hierarchical overview (Modules -> Files -> Symbols) with recursive `depth`. |

## Testing Tools Directly
You can test any MCP tool directly from your terminal using the `mcp` command:

```bash
tokenzip mcp query_symbol symbol_name=myFunctionName
tokenzip mcp smart_file_read path=src/index.ts mode=skeleton
tokenzip mcp query_repo_structure depth=2
```

## Deep Context Strategies

TokenZip tools are optimized for agentic workflows where token budgets are tight:

- **Recursive Mapping**: Use `query_repo_structure` to understand the physical and logical layout of a repository without scanning every directory manually.
- **Skeleton Navigation**: Use `smart_file_read` in `skeleton` mode to see "how to use" a file (imports + signatures) without fetching the "how it works" (implementation bodies).
- **Auto-Pruning**: Structural tools automatically use "Balanced Truncation" to fit large directory structures into the context window by intelligently pruning the largest sub-lists first.

## Troubleshooting
- **No data returned**: Ensure you have run `tokenzip parse` first.
- **Connection errors**: Check that the `--cwd` path in your config is correct and points to a directory with a `.tokenzip` folder.
