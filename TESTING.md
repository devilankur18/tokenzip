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

## 🚀 Integration Tests & Benchmarks

We maintain a high-fidelity integration test suite that benchmarks TokenZip against a real-world repository (**Express.js**). These tests verify the entire pipeline: indexing, edge resolution, and MCP tool execution.

### 📦 Unified Benchmark Environment

Both `npm test` and `npm run bench` share a unified infrastructure:
- **Location**: `.bench/express` in the project root.
- **Shared Setup**: Managed via `src/utils/test/bench-setup.ts`.
- **Isolation**: Each run uses a local SurrealDB instance mapped to the benchmark repository.

### Running Integration Tests
The integration suite validates functional correctness and tool output consistency.

```bash
# Run the integration suite
npm test src/mcp/__tests__/mcp-integration.test.ts
```

### Running Performance Benchmarks
The benchmarking scripts measure token efficiency and E2E CLI performance.

```bash
# Run all benchmarks (setup + savings + mcp)
npm run bench

# Run specific parts
npm run bench:setup    # Prepare the benchmark repo
npm run bench:savings  # Generate token savings report
npm run bench:mcp      # E2E MCP validation via CLI stdio
```

## 🛠 Troubleshooting

### Database Locks
If a test run crashes, a background `surreal` process might still be running and holding a lock on the database.
- **Check logs**: View `.bench/express/.tokenzip/db/surreal.log` for error details.
- **Kill processes**: If you see "Address already in use" or "Database already locked", manually kill the `surreal` process:
  ```bash
  pkill surreal
  ```

### Resetting the Benchmark
If the benchmark repository or database becomes corrupted, simply delete the `.bench` directory:
```bash
rm -rf .bench
```
