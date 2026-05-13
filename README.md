<div align="center">

# 🗜️ TokenZip

**The Semantic Compression Layer for AI Agents.**  
Transform any codebase into a queryable knowledge graph and stop wasting tokens on implementation details.

[![npm version](https://img.shields.io/npm/v/tokenzip.svg)](https://www.npmjs.com/package/tokenzip)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 💡 The Idea

AI agents (Claude, Cursor, Copilot) are context-starved. Feeding them entire source files is like giving someone a whole book when they only need the table of contents and a few specific chapters.

**TokenZip** transforms your codebase into a **Relational Knowledge Graph**. It indexes symbols, relationships, and call stacks, allowing AI agents to "see" your code's structure and APIs without drowning in redundant implementation logic.

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

---

## 📊 Case Study: OpenClaw (14K+ Files)

[OpenClaw](https://github.com/Clawdi-AI/openclaw) is a massive project heavy-coded with AI. In a benchmark comparing raw context vs. TokenZip optimization, the results were staggering:

| Metric | Standard `file_read` | TokenZip `smart_file_read` |
| :--- | :--- | :--- |
| **Total Context Footprint** | 11.3 Million Tokens | 2.9 Million Tokens |
| **Token Savings** | 0% | **73% 🚀** |
| **Input Cost (Per Turn)** | 🔴 11.3M Tokens | 🟢 2.9M Tokens |
| **5-Turn Cumulative** | 🔴 56.5M Tokens | 🟢 14.5M Tokens |
| **Direct Savings (5 Turns)** | **--** | **42M Tokens (~$120+ Saved)** |
| **Context Headroom** | ❌ Zero (Truncated) | ✅ Fits 3.8x more context |

*By reducing the "per-file" token tax, TokenZip allows your AI agents to maintain massive repositories in their active memory without hitting token limits or burning through API budgets.*

*Check out the [detailed benchmark report](https://gist.github.com/devilankur18/e21baec76d348dd2f1cd3339c3a1d319) for file-level metrics.*

---

## 🛠️ Key Features

- **Relational Graph Database**: Powered by **SurrealDB**, storing files → modules → symbols → call edges.
- **Deep Code Analysis**: Uses **Tree-sitter** to extract complex relationships (`calls`, `imports`, `inherits`, `implements`).
- **AI-Ready (MCP)**: Exposes the graph as an **MCP server** for deep context in Claude Desktop, Cursor, and more.
- **Incremental Parsing**: Only indexes changed files using content hashing—perfect for large repos.
- **Git Enrichment**: Maps symbol history to git commits for better context.

---

## 🚀 Vision: The Agentic Future

TokenZip isn't just a database; it is the **Cognitive Infrastructure** that allows AI to transition from a reactive "chatbot" to an autonomous **Digital Engineer**.

- **Query vs. Read**: Replaces expensive 50k-token "context dumps" with 500-token **Structured Queries**. Agents stop "reading" files to find dependencies and start "querying" the graph—drastically reducing hallucinations and costs.
- **Autonomous Multi-Hop Reasoning**: Enables **Recursive Impact Analysis**. An agent can trace who calls a function across the entire repository, allowing for reliable, end-to-end refactoring without breaking the build.
- **Semantic Grounding**: Acts as the project's **Ground Truth**. By moving from creative token prediction to **Structural Assembly**, the agent verifies every symbol and import before writing a single line of code.
- **Proactive Context Fetching**: The agent no longer waits for you to provide context; it proactively fetches its own blueprints from the Memory Mesh, maintaining a perfect mental model of the entire codebase.
- **Consistency & Intuition**: By consulting the graph's existing patterns, the agent develops an "intuition" for your specific project style, ensuring that new code mimics existing middleware, error handling, and standards perfectly.

---

## ⚡ Quick Start

### 1. Install
```bash
npm install -g tokenzip
```

### 2. Initialize & Parse
```bash
# Go to your repository
cd /path/to/repo

# Initialize metadata (.tokenzip/)
tokenzip init

# Build the knowledge graph
tokenzip parse
```

### 3. Expose to AI
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

## ⚙️ Configuration

Set the `TOKENZIP_CWD` environment variable in your `.zshrc` or `.bashrc` to run commands from anywhere:
```bash
export TOKENZIP_CWD=/path/to/your/project
```

---

## 🏗️ Project Status & Roadmap

> [!IMPORTANT]
> TokenZip v2 is currently **Experimental**. We are actively refining the edge resolution logic and adding more language support.

- [x] TypeScript / JavaScript support
- [ ] Python Extractor
- [ ] Go / Rust Support
- [ ] Visual Graph Explorer (Web UI)
- [ ] Deeper Call Graph Resolution

---

## 📄 License

MIT © [Ankur Agarwal](https://github.com/devilankur18)
