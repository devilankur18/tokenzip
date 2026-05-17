# 🔌 Recall Kit MCP Integration Guide

Recall Kit (V2) replaces traditional atomic tools with **Intent-Driven** code intelligence. This guide covers how to connect Recall Kit to your favorite AI editor.

> [!IMPORTANT]
> **New to Recall Kit V2?**  
> Check out the [**Recall V2 "Total Recall" Guide](./mcp_v2_guide.md)** for detailed instructions on the new 5-tool intent interface (`code_snapshot`, `code_read`, etc.).

---

## 🔌 Multi-Editor Setup

Recall Kit follows the standard MCP specification. Below are instructions for the top 10 AI-native development environments.

### 1. Claude Desktop (Reference Implementation)
The primary way to use MCP.
- **Config Path (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Config Path (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`

Add this to the `mcpServers` object:
```json
{
  "mcpServers": {
    "recall": {
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
4. **Name:** `recall`
5. **Type:** `command`
6. **Command:** `tokenzip serve --cwd /absolute/path/to/your/repo`

### 3. VS Code + GitHub Copilot (Native)
GitHub Copilot now supports MCP natively.
1. Open the **Command Palette** (`Cmd+Shift+P`).
2. Run **"MCP: Open User Configuration"**.
3. Add the `recall` definition (same as Claude Desktop JSON above).
4. Ensure you are in **Agent Mode** in the Chat panel.

### 4. VS Code + Cline / Roo Code
High-power autonomous agent extensions.
1. Open the **Cline/Roo Code** panel.
2. Click the **MCP Servers** icon (plug icon).
3. Click **Edit Config** or add a new server.
4. Paste the JSON configuration for `recall`.

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
    "recall": {
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
claude config add mcp.recall.command "tokenzip serve --cwd /absolute/path/to/your/repo"
```

### 9. Continue (VS Code & JetBrains)
Open-source autopilot for VS Code and JetBrains IDEs.
1. Open `~/.continue/config.json`.
2. Add to the `contextProviders` or `mcpServers` section:
```json
{
  "mcpServers": [
    {
      "name": "recall",
      "command": "tokenzip",
      "args": ["recall", "tokenzip", "serve", "--cwd", "/absolute/path/to/your/repo"]
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
