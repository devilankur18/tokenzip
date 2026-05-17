# Cortex — Persistent Knowledge Layer for Coding Agents

> Evolved design merging our original "Context Memory" architecture (graph-native
> edge-based scoping, auto-recall, `supersedes` versioning, `max_tokens` budget)
> with key insights from an external review (traversal planning, summary/details
> split, content-hash staleness, leaner category enum, dedicated verbs).

---

## Name: **Cortex (Recall Intelligence)**

"Context Memory" was descriptive but verbose. **Cortex** is the persistent knowledge layer that powers Recall Kit. In V2, the specialized `cortex_*` tools have been consolidated into the unified **`code_insight`** tool for a cleaner, more actionable agent interface.

---

## Tool Suite (Recall Kit V2 Consolidation)

In Recall Kit V2, all persistent memory actions are handled via **`code_insight`**:

| Action | Equivalent V1 Tool | Purpose |
|---|---|---|
| `recall` | `cortex_recall` | Retrieve relevant notes with scope inheritance + budget |
| `save` | `cortex_save` | Persist structured knowledge scoped to graph nodes |
| `search` | `cortex_search` | Cross-cutting search by keyword/tag/type across all notes |
| `forget` | `cortex_remove` | Archive a note (staleness management) |
| `traverse` | `cortex_traverse` | Planned action: Optimized reading plan generation |

---

---

## Data Model

### Annotation Node

```sql
DEFINE TABLE annotation SCHEMAFULL;
-- Identity
DEFINE FIELD type       ON annotation TYPE string DEFAULT 'annotation';
DEFINE FIELD category   ON annotation TYPE string
  ASSERT $value IN [
    'guideline',        -- coding, testing, security, naming (use tags for sub-type)
    'architecture',     -- design patterns, architectural decisions, module overview
    'gotcha',           -- non-obvious behavior, edge cases, traps
    'traversal_hint',   -- reading orders, skip paths for modules
    'workflow',         -- deploy sequences, setup steps, operational procedures
    'todo'              -- persistent TODOs that survive sessions
  ];

-- Content (split for token optimization)
DEFINE FIELD title      ON annotation TYPE string;
DEFINE FIELD summary    ON annotation TYPE string;     -- Dense 1-3 sentences. Shown in auto-recall.
DEFINE FIELD details    ON annotation TYPE option<string>; -- Extended context. Only shown on explicit recall.

-- Provenance
DEFINE FIELD source     ON annotation TYPE string DEFAULT 'developer'
  ASSERT $value IN ['developer', 'agent', 'traversal'];
DEFINE FIELD confidence ON annotation TYPE float DEFAULT 1.0;  -- 0.0-1.0
DEFINE FIELD tags       ON annotation TYPE array DEFAULT [];

-- Priority & Lifecycle
DEFINE FIELD priority   ON annotation TYPE string DEFAULT 'normal'
  ASSERT $value IN ['critical', 'important', 'normal', 'low'];
DEFINE FIELD supersedes ON annotation TYPE option<record<annotation>>;
DEFINE FIELD is_active  ON annotation TYPE bool DEFAULT true;

-- Staleness Detection
DEFINE FIELD target_hash ON annotation TYPE option<string>;  -- content_hash of target file at write time

-- Usage Tracking
DEFINE FIELD access_count ON annotation TYPE int DEFAULT 0;
DEFINE FIELD last_accessed ON annotation TYPE option<datetime>;

-- Traversal Hint Fields (only when category = 'traversal_hint')
DEFINE FIELD read_order ON annotation TYPE array DEFAULT [];
DEFINE FIELD skip_paths ON annotation TYPE array DEFAULT [];

-- Timestamps
DEFINE FIELD created_at  ON annotation TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at  ON annotation TYPE datetime DEFAULT time::now();
DEFINE FIELD session_id  ON annotation TYPE option<string>;
```

### Suggestion Node (Separate Table)

```sql
DEFINE TABLE suggestion SCHEMAFULL;
DEFINE FIELD type           ON suggestion TYPE string DEFAULT 'suggestion';
DEFINE FIELD problem        ON suggestion TYPE string;
DEFINE FIELD proposed       ON suggestion TYPE string;
DEFINE FIELD kpi_impact     ON suggestion TYPE option<string>;
DEFINE FIELD severity       ON suggestion TYPE string DEFAULT 'medium'
  ASSERT $value IN ['low', 'medium', 'high', 'critical'];
DEFINE FIELD related_targets ON suggestion TYPE array DEFAULT [];
DEFINE FIELD status         ON suggestion TYPE string DEFAULT 'new'
  ASSERT $value IN ['new', 'acknowledged', 'implemented', 'dismissed'];
DEFINE FIELD occurrence_count ON suggestion TYPE int DEFAULT 1;
DEFINE FIELD created_at     ON suggestion TYPE datetime DEFAULT time::now();
DEFINE FIELD session_id     ON suggestion TYPE option<string>;
```

### Edges

```sql
-- Annotation → target (one annotation can scope to MANY targets)
DEFINE TABLE scoped_to TYPE RELATION IN annotation OUT repository | module | file | symbol;
DEFINE FIELD scope_type ON scoped_to TYPE string
  ASSERT $value IN ['codebase', 'module', 'file', 'symbol'];

-- Reverse convenience for discovery
DEFINE TABLE tagged_with TYPE RELATION IN repository | module | file | symbol OUT annotation;

-- Suggestion → related targets
DEFINE TABLE relates_to TYPE RELATION IN suggestion OUT repository | module | file | symbol;
```

---

## Scope Resolution (How `cortex_recall` Works)

When recalling for `src/auth/UserService.ts`:

```
1. Direct: annotations scoped_to file:src/auth/UserService.ts
2. Parent module: annotations scoped_to module:src/auth
3. Grandparent: annotations scoped_to module:src
4. Codebase: annotations scoped_to repository:*
```

**Ranking within results**: symbol > file > module > codebase, then confidence (high→low),
then access_count (popular notes rise), then recency.

**Staleness check**: For each annotation, if `target_hash` is set and differs from
the current file's `content_hash`, prepend `[⚠️ STALE]`.

---

## Auto-Recall Injection

Existing tools (`smart_file_read`, `get_code_overview`) inject a `_cortex` footer:

```json
{
  "path": "src/auth/UserService.ts",
  "mode": "skeleton",
  "content": "...",
  "_cortex": {
    "notes": [
      "[CRITICAL·dev] JWT validation required before all ops",
      "[GOTCHA·agent·⚠️ STALE] authenticate() returns null, does not throw"
    ],
    "more": "3 more notes. Call cortex_recall for full context."
  }
}
```

**Rules**:
- Budget cap: 10% of the tool's response size, max ~200 tokens
- Confidence threshold: ≥ 0.8 for auto-recall. Below 0.8 → explicit `recall` only
- Priority order: critical first, then important, then normal
- Summary only (never details in auto-recall)

---

## `cortex_traverse` — The Token Saver

This is the tool that solves "which files do I read?" vs recall's "what do I know?".

**Implementation logic**:
```
1. Check for stored traversal_hint on the target module
   → If found and access_count > 3: return cached plan (high confidence)
   → If found but target files changed: use as seed, re-validate via graph

2. Graph-based fallback (no cached hint):
   a. Find entry points (files with index.ts, or no incoming deps in module)
   b. BFS 1-2 levels following dependency edges
   c. For "fix_bug": reverse — start from bug file, trace dependents
   d. For "implement_feature": prioritize interfaces > configs > implementations
   e. Rank by: dependency_depth, file_size (smaller first)

3. Always include "on-demand" section for files not in critical path
4. Include token estimate for the plan vs reading everything
```

---

## Implementation Phases

### Phase 1: Core Memory (Current Sprint)
- [x] Schema: annotation table, scoped_to/tagged_with edges, indexes
- [ ] Schema: evolve to summary/details split, target_hash, access_count, lean categories
- [ ] Schema: suggestion table + relates_to edge
- [ ] `cortex_save` — save with multi-target edge scoping
- [ ] `cortex_recall` — scope-inherited retrieval with budget trimming
- [ ] `cortex_remove` — soft delete with reason logging
- [ ] Register in tool registry

### Phase 2: Traversal + Search
- [ ] `cortex_traverse` — reading plan generation
- [ ] `cortex_search` — cross-cutting keyword/tag search
- [ ] Auto-recall injection into `smart_file_read`
- [ ] Staleness detection via target_hash comparison

### Phase 3: Self-Improvement
- [ ] `cortex_suggest` — structured improvement requests
- [ ] Suggestion deduplication (occurrence_count bumping)
- [ ] Access tracking (access_count++ on recall)
- [ ] Cortex stats in `get_codebase_stats` and `get_token_savings`

---

## KPIs

| KPI | Measurement | Target |
|---|---|---|
| Token savings | Tokens for codebase learning session N vs N+1 | 60% reduction |
| Recall hit rate | % of annotations reused across sessions | >70% |
| Human repeat instructions | Developer re-instructions per session | <1 |
| Traverse efficiency | Files read with traverse vs without | 70% fewer |
| Context overhead | Annotation tokens as % of total context | <10% |
| Suggestion conversion | Suggestions leading to tool improvements | Track |
