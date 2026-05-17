# 🧠 Recall Kit: MCP V2 Guide

Recall Kit (formerly TokenZip) is a high-performance **Model Context Protocol (MCP)** server designed to give AI agents "Total Recall" of your codebase. 

By consolidating 24 specialized tools into **5 high-impact, intent-driven tools**, Recall Kit reduces context bloat by up to 80%, allowing agents to learn faster, save tokens, and provide higher-quality code changes with less repetitive instruction.

---

## 🚀 The Core Philosophy

Traditional MCP tools are "atomic"—one tool for one small task. Recall Kit is **"Intent-Driven"**:
1. **Adaptive Snapshotting**: Instead of a raw file tree, get a semantic map of what matters.
2. **Semantic Projection**: Read code at the level of detail you need (Skeleton → Interface → Implementation).
3. **Incremental Memory (Cortex)**: Every insight an agent learns is saved to the repo's knowledge graph. Next time, the agent *remembers* the architectural rules without being told.
4. **Token ROI**: Every byte sent to the LLM is measured and optimized.

---

## 🛠️ The 5 "Recall" Tools

### 1. `code_snapshot`
**Intent**: "I need to understand the architecture and where to start."
Adaptive tree that folds irrelevant folders, promotes modules, and highlights exported symbols.

**Input**:
```json
{ "path": "src/mcp", "depth": 2 }
```

**Output**:
```text
🏠 tokenzip
└── 📦 mcp
    ├── 📄 server.ts [𝑓 createMcpServer]
    ├── 📄 token-budget.ts [🏛️ TokenBudgetManager]
    └── 📂 v2 (contains 5 tools)

--- CORTEX INSIGHTS ---
💡 [Architecture] V2 tools use TokenBudgetManager for automatic truncation.
💡 [Guideline] Always use absolute paths for file operations in handlers.
```

---

### 2. `code_search`
**Intent**: "Where is the logic for X?"
Unified semantic and text search across symbols, docstrings, and signatures.

**Input**:
```json
{ "query": "budget management", "kind": "class" }
```

**Output**:
```json
{
  "matchCount": 1,
  "matches": [
    {
      "name": "TokenBudgetManager",
      "kind": "class",
      "filePath": "src/mcp/token-budget.ts",
      "signature": "export class TokenBudgetManager"
    }
  ]
}
```

---

### 3. `code_read`
**Intent**: "I want to see how this works without using 50k tokens."
Supports three "Projections":
- **`skeleton`**: Just signatures and imports (90% token savings).
- **`interface`**: Public APIs only.
- **`implementation`**: Full code for a specific symbol.

**Input**:
```json
{ "path": "src/mcp/server.ts", "mode": "skeleton" }
```

**Output**:
```typescript
import { IStore } from '../storage/interface.js';

/** Creates the MCP server instance */
export async function createMcpServer(store: IStore, repoPath: string) {
    /* [implementation hidden in skeleton mode] */
}
```

---

### 4. `code_trace_flow`
**Intent**: "If I change this, what breaks?" or "How do I call this?"
Unifies call hierarchy, references, and implementations into one graph traversal.

**Input**:
```json
{ "target": "createMcpServer", "direction": "in" }
```

**Output**:
```json
{
  "incoming": [
    { "name": "main", "kind": "function", "filePath": "src/index.ts" }
  ],
  "implementations": [],
  "references": [
    { "name": "testServer", "kind": "variable", "filePath": "tests/setup.ts" }
  ]
}
```

---

### 5. `code_insight` (Cortex)
**Intent**: "I learned something/I need to check rules."
Manages persistent memory. Insights are linked to specific files/modules and grow over time.

**Input (Save)**:
```json
{
  "action": "save",
  "target": "src/mcp/tools",
  "note": {
    "title": "Tool Registration Pattern",
    "summary": "Always wrap V2 tools with the UsageTracker in registry.ts.",
    "category": "guideline"
  }
}
```

**Input (Recall)**:
```json
{ "action": "recall", "target": "src/mcp/tools" }
```

---

## 📈 Why Recall Kit?

### 1. Incremental Intelligence
Unlike standard tools that "reset" every session, Recall Kit's **Cortex** stores intelligence in your repository.
- **First Session**: Agent asks 10 questions about the architecture.
- **Fifth Session**: Agent reads `code_snapshot`, sees 3 stored guidelines, and starts coding immediately without asking.
- **Community Intelligence**: In open-source repos, these insights are committed to the repo, allowing *every* developer's agent to benefit from past "Total Recall."

### 2. Radical Token Savings
By using `skeleton` reads and `adaptive` snapshots, agents can stay in the "Goldilocks Zone" of context—enough information to be accurate, but small enough to keep the LLM fast and cheap.

### 3. Less Repetition
Stop telling your agent to "ignore the tests folder" or "follow the orchestrator pattern." Save it once using `code_insight`, and the agent will see it every time it looks at the relevant folder.

---

## 🔌 Setup & Integration

Recall Kit works with all major AI editors (Claude Desktop, Cursor, VS Code, Windsurf, etc.). 

For full setup instructions per editor, see the [Legacy Setup Guide](./mcp_guide.md#plug-multi-editor-integration) (the connection strings remain the same).
