# Contributing to TokenZip

First off, thank you for considering contributing to TokenZip! It's people like you that make TokenZip such a great tool for the AI engineering community.

## 🏗️ Technical Architecture

TokenZip is built on three main pillars:
1.  **The Parser**: Uses `tree-sitter` to extract symbols and relationships from source code.
2.  **The Storage**: Powered by **SurrealDB**, storing code as a relational graph.
3.  **The Interface**: An **MCP (Model Context Protocol) Server** that exposes the graph to AI agents.

### Project Structure
- `src/engine`: Core indexing and graph logic.
- `src/extractors`: Language-specific symbol extraction.
- `src/mcp`: MCP server implementation and tools.
- `src/cli`: CLI command handling.

## 🚀 How Can I Contribute?

### 1. Adding Language Support
We are looking for extractors for **Python, Go, Rust, and Java**. Check out `src/extractors/typescript.ts` for an example of how to implement a new language.

### 2. Improving MCP Tools
Have an idea for a tool that makes AI agents smarter? Propose it in an issue!

### 3. Fixing Bugs
Check the [GitHub Issues](https://github.com/devilankur18/tokenzip/issues) for any open bugs.

## 🛠️ Development Setup

1.  **Clone the repo**:
    ```bash
    git clone https://github.com/devilankur18/tokenzip.git
    cd tokenzip
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Build the project**:
    ```bash
    npm run build
    ```

4.  **Run tests**:
    ```bash
    npm test
    ```

## 📜 Pull Request Process

1.  Create a new branch for your feature or bugfix.
2.  Ensure tests pass and add new tests if applicable.
3.  Update the README if you are adding new features or changing APIs.
4.  Open a PR with a clear description of the changes.

## ⚖️ License

By contributing, you agree that your contributions will be licensed under its MIT License.
