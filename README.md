<div align="center">

# 🧠 Recall Kit (formerly TokenZip)

**Total Recall for AI Agents.**  
Transform any codebase into an incremental knowledge graph. Save tokens, build memory, and ship faster.

![Recall Kit Hero Comparison](assets/hero_comparison.png)

[![npm version](https://img.shields.io/npm/v/tokenzip.svg)](https://www.npmjs.com/package/tokenzip)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
</div>

---

## 🧠 What is Recall Kit? (Intent-Driven Code Intelligence)

Recall Kit is a **Total Recall Engine** for AI-assisted development. It replaces the "context-dump" approach with high-impact, intent-driven tools that allow agents like **Claude**, **Cursor**, and **Windsurf** to understand complex repositories with 80%+ fewer tokens.

Unlike traditional tools that reset every session, Recall Kit features **Cortex Intelligence**—an incremental memory layer that stores architectural rules and "gotchas" directly in your codebase.

---

## 🚀 The Gain: `file_read` vs `smart_file_read`

Most AI tools rely on a standard `file_read` tool that dumps the raw text of a file into the context window. **TokenZip replaces this with `smart_file_read`**, leveraging **Skeletonization** to prune code context intelligently.

| Tool | Approach | Context Footprint | Cost/Latency |
| :--- | :--- | :--- | :--- |
| `file_read` | Raw Text | 100% (Full file) | 🔴 High / Overflows |
| **`smart_file_read`** | **Semantic Skeleton** | **10% - 30%** | **🟢 Low / Efficient** |

### What is Skeletonization?
Instead of reading the whole file, TokenZip generates a **Skeleton Projection**:
- **Keeps**: Imports, Exports, Class definitions, Function signatures, and Type declarations.
- **Hides**: Function/Method bodies (`/* ... implementation hidden ... */`).
- **Benefit**: The AI understands exactly **how to use** your code without wasting tokens on **how it works** internally.

#### 💡 Scenario: Building a Feature across 5 Files
Imagine you are fixing a bug or adding a feature that touches **5 source files** (~1,400 tokens each).

| Metric | Standard `file_read` | TokenZip `smart_file_read` |
| :--- | :--- | :--- |
| **Initial Context (Turn 1)** | ~15,000 tokens | **~3,000 tokens** |
| **Turn 5 (Context Bloat)** | 🔴 **~100,000 tokens** | 🟢 **~15,000 tokens** |
| **Total 10-Iteration Cost** | 🔴 **~1,100,000 tokens** | 🟢 **~165,000 tokens** |
| **Token Savings** | 0% (Baseline) | **85% SAVED 🚀** |

**The "Token Tax" Trap**: 
Standard agents send the *entire* content of every file they read in every turn. This "Context Bloat" causes a simple session to explode from 15K to 100K+ tokens in just a few turns, quickly hitting model limits and making the agent "hallucinate" as it loses its train of thought.

**The TokenZip Edge**: 
By reading **Skeletons** during navigation and only fetching full implementations when absolutely necessary, TokenZip reduces the "cumulative tax" by **~85%**. This allows you to perform deep, multi-file refactors for the price of a single standard chat.

![Token Economics](assets/cost_savings_card.png)

---

## 📊 Case Study: OpenClaw (14K+ Files)

[OpenClaw](https://github.com/Clawdi-AI/openclaw) is a massive project heavy-coded with AI. In a benchmark comparing raw context vs. TokenZip optimization, the results were staggering:

| Metric | Standard `file_read` | TokenZip `smart_file_read` |
| :--- | :--- | :--- |
| **Total Context Footprint** | 11.3 Million Tokens | 2.9 Million Tokens |
| **Token Savings** | 0% | **73% 🚀** |
| **Input Cost (Per Turn)** | 🔴 11.3M Tokens | 🟢 2.9M Tokens |
| **5-Turn Cumulative** | 🔴 56.5M Tokens | 🟢 14.5M Tokens |
| **Direct Savings (5 Turns)** | **--** | **42M Tokens (~$210+ for claude opus Saved)** |

![OpenClaw Benchmark](assets/benchmark_chart.png)

*By reducing the "per-file" token tax, TokenZip allows your AI agents to maintain massive repositories in their active memory without hitting token limits or burning through API budgets.*

*Check out the [detailed benchmark report](https://gist.github.com/devilankur18/e21baec76d348dd2f1cd3339c3a1d319) for file-level metrics.*

---

## ⚡ The V2 "Recall" Interface

Recall Kit V2 consolidates 24 redundant tools into **5 high-impact intents**:

1.  **`code_snapshot`**: Adaptive tree navigation with exported symbols and Cortex insights.
2.  **`code_search`**: Unified semantic search for symbols, classes, and logic.
3.  **`code_read`**: Semantic projections (Skeleton, Interface, Implementation) to save tokens.
4.  **`code_trace_flow`**: Unified execution flow tracing (Callers, Callees, References).
5.  **`code_insight`**: Persistent memory management (Cortex) for guidelines and gotchas.

For a deep dive into the new interface, check out the [**MCP V2 Guide**](docs/mcp_v2_guide.md).

---

## 🏛️ Incremental Memory (Cortex)

The real power of Recall Kit is its **Incremental Memory**. As an agent works on your code, it can save insights:
- "This module requires this specific env var."
- "Never use this legacy utility; use the new one instead."
- "The auth flow is spread across these 3 files."

These insights are stored in the graph. The next time an agent (or a human colleague's agent) looks at that file, it **automatically remembers** the rule. Quality grows with time.

---

## 🏗️ Technical Architecture & Memory Mesh

TokenZip builds a **Federated Memory** of your code. Instead of raw text, it stores symbols, relationships, and call edges in a high-performance **SurrealDB** graph.

![Architecture Diagram](https://mermaid.ink/svg/pako:eNptkE1OwzAQha8yeY2-QEKLViyQCAlSAsSCSCyInSAnTWr-kR_HUVVvxyE4ClfhyByDozB2_KqqV_Pmzbzf-GTWlZpWSTuU3qE0Hsr_qWqUvldqlrZHeT-UPVl-V-omXoAyrYfSM5TOIzk4vU2T6Xv9v5fW6G6U-v78OaXhVFr-XKmZtD3K-6HsyfKnUv_S0uiofD7K_0Yp_R-Umn5Wap60Xcp7pfx7pfxzpf6vUi6T_P9Zyn-SUnov1V97W_n9kP-XUko7pMypNMc_Bf49yI2eSu_I0p2_X8vfoVfT6X858g_vK2F8)

For a deep dive into how the "Memory Mesh" works, see our [Architecture Guide](docs/architecture.md).

---

## ⚡ Quick Start (Zero to Running in 30s)

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/devilankur18/tokenzip/blob/main/notebooks/tokenzip_demo.ipynb)

### 1. One-Step Setup
Run this in your repository root to initialize and index the codebase:
```bash
npx tokenzip setup
```

### 2. Expose to AI
Start the MCP server to let your AI agents use `smart_file_read`, `query_symbol`, and `find_references`.
```bash
tokenzip serve
```

---

## 📖 CLI Usage

### `tokenzip search <query>`
Find any symbol, its signature, and its relationships across the codebase.
```bash
tokenzip search createMcpServer
```

### `tokenzip smart-read <file_path>`
Test the compression logic directly from your terminal.
```bash
# Get the skeleton (no function bodies)
tokenzip smart-read src/engine/indexer.ts --mode skeleton

# Get only signatures and types
tokenzip smart-read src/engine/indexer.ts --mode interface_only
```

### `tokenzip report`
Generate a token efficiency audit for your own repository.
```bash
tokenzip report --output audit.md
```

---

### 2. Connect to Your AI Editor

TokenZip works with all major AI editors. Here are the top 3:

#### 🤖 Claude Desktop
Add this to `claude_desktop_config.json`:
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

#### 🖱️ Cursor
1. Go to **Settings** > **Features** > **MCP**.
2. Add a new **Command** server: `tokenzip serve --cwd /path/to/repo`.

#### 💻 VS Code + GitHub Copilot
1. Run **"MCP: Open User Configuration"** from the Command Palette.
2. Paste the JSON configuration (same as Claude Desktop).

---

### 📚 Full Integration Guide (Top 10 Editors)
For detailed instructions on **Windsurf, Zed, Aider, Claude Code, Continue, and more**, see our [**MCP Multi-Editor Guide**](docs/mcp_guide.md).

> [!TIP]
> If you are running TokenZip from source, run `npm link` in the root of this project to make the `tokenzip` command available globally.

### 🌳 Deep Structural Awareness
The `query_repo_structure` tool now supports recursive depth, allowing agents to understand your repository's layout from modules down to individual symbols in a single query.
- **Recursive Hierarchy**: Explore Repo → Folders → Files → Symbols with configurable depth.
- **Balanced Truncation**: High-density structures are pruned intelligently (targeting the largest lists first) to fit within AI context windows while preserving the overall "map."

For more details, see the [MCP Guide](docs/mcp_guide.md).

## 🛠️ Commands
## ⚙️ Configuration

Set the `TOKENZIP_CWD` environment variable in your `.zshrc` or `.bashrc` to run commands from anywhere:
```bash
---

## 🏠 Local LLM Support (Ollama / LocalAI)

TokenZip is the perfect companion for **Local LLMs** where context windows are often constrained. By skeletonizing files, you can fit massive context into models like `Qwen-Coder` or `CodeLlama` running on your own hardware.

Check out the [Local LLM Guide](docs/local_llm_guide.md) for optimized settings.

---


## 🏗️ Project Status & Roadmap

> [!IMPORTANT]
> TokenZip is currently **Experimental**. We are actively refining the edge resolution logic and adding more language support.

- [x] TypeScript / JavaScript support
- [ ] Python Extractor
- [ ] Go / Rust Support
- [ ] Visual Graph Explorer (Web UI)
- [ ] Deeper Call Graph Resolution

---

---

## 🤝 Contributing & Community

We welcome contributions of all sizes! 
- **Add a Language**: We need extractors for Python, Go, and Rust.
- **Improve Tools**: Help us refine the MCP tools for better agentic reasoning.

Please see [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## 📜 License

MIT © [Ankur Agarwal](https://github.com/devilankur18)
