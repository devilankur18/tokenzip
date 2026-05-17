# ROADMAP

## KPIs

This project which offer mcp tools to Coding Agents likes of ClaudeCode, Cursor, Codex. With aim of improving new coding sessions

- KP1: Low cost learning on a new sessions- currently on new session Agent read a lot of code files to lean the architecture before making any real changes, context size is bloated and reach to 200K very easily.
- KP2: Less human in the loop in new session: A lot of human instructions are missed from last session and need to repeatedly given again in new session.
- KP3: Identify New Feature which can make Ai agents smarter, less repetitive and auto run with minimal human in loop, and still deliver high quality output.
- KPI4: Effective Tools (✅ Completed): Consolidated 24 tools into 5 high-impact intents (`code_snapshot`, `code_read`, `code_search`, `code_trace_flow`, `code_insight`).

Example: in a new session, need to read too many files, to learn about the requirement, how can It do it in less token and more effective way, what kind of mcp tool it need which can be build on top on graph based memory which can save input tokens for every new agent session.  Agent should be able to provide high quality context.


## Stories

### Story 1: Recursive Knowledge Inheritance (✅ Completed in V2)
KPI: KP2
Type: Update Tool
Scenario: An agent is working on src/modules/billing/stripe/processor.ts. A critical "Gotcha" is saved at the src/modules/billing/ level.
User Problem: If the agent only looks at the file-level context, it misses the parent-level architectural rules.
Status: Implemented in `code_snapshot` and `code_read`. Insights now automatically bubble up and are injected into the agent's view.
Impact: Agents "automatically" follow project conventions without being told.
MCP Tool: `code_insight` / `code_snapshot`

