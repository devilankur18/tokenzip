# ROADMAP

## KPIs

This project which offer mcp tools to Coding Agents likes of ClaudeCode, Cursor, Codex. With aim of improving new coding sessions

- KP1: Low cost learning on a new sessions- currently on new session Agent read a lot of code files to lean the architecture before making any real changes, context size is bloated and reach to 200K very easily.
- KP2: Less human in the loop in new session: A lot of human instructions are missed from last session and need to repeatedly given again in new session.
- KP3: Identify New Feature which can make Ai agents smarter, less repetitive and auto run with minimal human in loop, and still deliver high quality output.
- KPI4: Effective Tools: We dont want to confuse ai agents with too many tools, study existing tools and see which tools are duplicate here, We dont want too many tools, we want tools which are relevant in long term for a larger crowd and can solve there problems effectively

Example: in a new session, need to read too many files, to learn about the requirement, how can It do it in less token and more effective way, what kind of mcp tool it need which can be build on top on graph based memory which can save input tokens for every new agent session.  Agent should be able to provide high quality context.


## Stories

### Story 1: Recursive Knowledge Inheritance
KPI: KP2
Type: Update Tool
Scenario: An agent is working on src/modules/billing/stripe/processor.ts. A critical "Gotcha" is saved at the src/modules/billing/ level.
User Problem: If the agent only looks at the file-level context, it misses the parent-level architectural rules unless it manually recalls every parent directory.
Potential Solution: Enhance cortex_recall to use Deep Inheritance. When a file is read, the tool automatically bubbles up the directory tree to find all relevant annotations (scoped to file -> module -> codebase).
Impact: Agents "automatically" follow project conventions without being told, even if the rules are defined 3 levels up in the hierarchy.
MCP Tool: cortex_recall (Update)
Input Diff: Add depth (how many levels to bubble up, default=max).
Improvement: Returns a flattened list of inherited notes sorted by priority, ensuring "Global Rules" always accompany "Local Logic".

