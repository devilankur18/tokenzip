# Testing TokenZip

This document outlines the testing strategy and commands for TokenZip. We use **Vitest** for both unit and high-fidelity integration testing.

## 🧪 Unit Tests

Unit tests focus on individual components like the TypeScript extractor, token budget manager, and utility functions.

```bash
# Run all tests
npm test

# Run unit tests only
npm test src/engine/__tests__
```

## 🚀 Integration Tests (Benchmark)

We maintain a high-fidelity integration test suite that benchmarks TokenZip against a real-world repository (**Express.js**). These tests verify the entire pipeline: indexing, edge resolution, and MCP tool execution.

### Prerequisites

- **Git**: Required to clone the benchmark repository.
- **Internet Access**: Required for the first run to fetch the benchmark repo.
- **Node.js >= 18**

### Running Integration Tests

The integration suite is located in `src/mcp/__tests__/mcp-integration.test.ts`.

```bash
# Run the integration suite
npm test src/mcp/__tests__/mcp-integration.test.ts
```

### How it works

1.  **Isolation**: The test setup creates a `.test-bench/` directory in the project root.
2.  **Benchmark Repo**: It clones `expressjs/express` and pins it to a stable commit.
3.  **Clean DB**: Each test run uses an isolated SurrealDB instance on a predictable port (e.g., `40000`).
4.  **Snapshots**: We use Vitest snapshots to ensure MCP tool outputs remain consistent and deterministic.

## 📐 MCP Format Standardization

To ensure TokenZip remains a first-class citizen in the MCP ecosystem, we have a specific suite for verifying JSON response formats.

```bash
npm test src/mcp/__tests__/mcp-format.test.ts
```

## 🛠 Troubleshooting

### Database Locks
If a test run crashes, a background `surreal` process might still be running and holding a lock on the database.
- **Check logs**: View `.test-bench/express/.tokenzip/db/surreal.log` for error details.
- **Kill processes**: If you see "Address already in use" or "Database already locked", manually kill the `surreal` process:
  ```bash
  pkill surreal
  ```

### Resetting the Benchmark
If the benchmark repository or database becomes corrupted, simply delete the `.test-bench` directory:
```bash
rm -rf .test-bench
```

## 📊 Benchmarking Tools

We also provide CLI-based benchmarking scripts for measuring token savings:

```bash
# Run all benchmarks (setup + savings + mcp)
npm run bench

# Run specific benchmarks
npm run bench:savings
npm run bench:mcp
```
