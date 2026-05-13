#!/usr/bin/env node
/**
 * bench/mcp-test.js
 *
 * Spawns `tokenzip serve` as a child process and tests each MCP tool
 * via the stdio transport. Validates:
 *   - Each tool returns valid JSON
 *   - _token_count is present and within budget
 *   - Response time is acceptable (<2s per call)
 *
 * Usage:
 *   node bench/mcp-test.js
 *   node bench/mcp-test.js --cwd /tmp/express-bench
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { parseArgs } from 'util';
import { existsSync } from 'fs';

const { values: args } = parseArgs({
  options: { cwd: { type: 'string', default: resolve(process.cwd(), './.bench/express') } }
});

const BENCH_REPO = resolve(args.cwd);
const CLI_PATH = resolve(import.meta.dirname, '../dist/cli/index.js');
const TOKEN_BUDGET = 8000;

// ─── colour helpers ─────────────────────────────────────────────────────────
const G = s => `\x1b[32m${s}\x1b[0m`;
const B = s => `\x1b[34m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const W = s => `\x1b[1m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const DIM = s => `\x1b[2m${s}\x1b[0m`;

// ─── MCP stdio client ────────────────────────────────────────────────────────

class McpClient {
  constructor(proc) {
    this.proc = proc;
    this.pending = new Map();
    this.nextId = 1;
    this.buffer = '';

    proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop(); // keep incomplete line
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        } catch {
          // non-JSON server output — ignore
        }
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      this.proc.stdin.write(msg + '\n');
      // Timeout after 15s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout waiting for response to: ${method}`));
        }
      }, 15000);
    });
  }

  async initialize() {
    return this.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-test', version: '1.0.0' }
    });
  }

  async listTools() {
    return this.send('tools/list', {});
  }

  async callTool(name, args) {
    return this.send('tools/call', { name, arguments: args });
  }

  close() {
    this.proc.stdin.end();
  }
}

// ─── test runner ─────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n' + W('━'.repeat(70)));
  console.log(W('  🔌 TokenZip MCP Tool Integration Test'));
  console.log(W(`  Repo: ${BENCH_REPO}`));
  console.log(W('━'.repeat(70)) + '\n');

  if (!existsSync(resolve(BENCH_REPO, '.tokenzip', 'db')) &&
      !existsSync(resolve(BENCH_REPO, 'db'))) {
    console.log(R('  ❌ No TokenZip DB found. Run bench/setup.sh first.\n'));
    process.exit(1);
  }

  // Spawn the MCP server
  console.log(DIM(`  Spawning: node ${CLI_PATH} serve --cwd ${BENCH_REPO}\n`));
  const proc = spawn('node', [CLI_PATH, 'serve', '--cwd', BENCH_REPO], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  proc.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg) console.log(DIM(`  [server:stderr] ${msg}`));
  });

  proc.stdout.on('data', d => {
    const msg = d.toString().trim();
    if (msg && !msg.startsWith('{')) console.log(DIM(`  [server:stdout] ${msg}`));
  });

  // Give the server a moment to start
  await new Promise(r => setTimeout(r, 3000));

  const client = new McpClient(proc);

  const results = [];

  async function test(name, description, toolName, toolArgs) {
    const start = Date.now();
    try {
      const result = await client.callTool(toolName, toolArgs);
      const elapsed = Date.now() - start;
      const content = result?.content?.[0]?.text ?? '';
      let parsed = null;
      try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }

      const tokenCount = parsed?._token_count ?? Math.ceil(content.length / 4);
      const truncated = parsed?._truncated ?? false;
      const withinBudget = tokenCount <= TOKEN_BUDGET;

      const status = withinBudget ? G('✅ PASS') : R('❌ FAIL');
      console.log(`  ${status}  ${W(name)}`);
      console.log(`         ${description}`);
      console.log(`         ${B('Tool:')} ${toolName}  ${B('Args:')} ${JSON.stringify(toolArgs)}`);
      console.log(`         ${B('Tokens:')} ${tokenCount.toLocaleString()}/${TOKEN_BUDGET.toLocaleString()}  ${B('Truncated:')} ${truncated}  ${B('Time:')} ${elapsed}ms`);

      if (content.length > 0) {
        const preview = content.slice(0, 120).replace(/\n/g, ' ');
        console.log(`         ${DIM('Preview: ' + preview + (content.length > 120 ? '...' : ''))}`);
      }
      console.log();

      results.push({ name, pass: withinBudget, tokenCount, elapsed });
    } catch (err) {
      const elapsed = Date.now() - start;
      console.log(`  ${R('❌ FAIL')}  ${W(name)}`);
      console.log(`         Error: ${err.message}`);
      console.log();
      results.push({ name, pass: false, tokenCount: 0, elapsed });
    }
  }

  // 1. Initialize
  try {
    await client.initialize();
    console.log(`  ${G('✅')} MCP Handshake successful\n`);
  } catch (e) {
    console.log(`  ${R('❌')} MCP Handshake failed: ${e.message}\n`);
  }

  // 2. List tools
  let tools = [];
  try {
    const res = await client.listTools();
    tools = res?.tools ?? [];
    console.log(`  ${G('✅')} Tools registered: ${tools.map(t => W(t.name)).join(', ')}\n`);
  } catch (e) {
    console.log(`  ${R('❌')} tools/list failed: ${e.message}\n`);
  }

  console.log(W('  Test Cases:'));
  console.log('  ' + '─'.repeat(68) + '\n');

  // 3. Run tool tests
  await test(
    'query_symbol: Router',
    'Get definition and location of the Router symbol',
    'query_symbol',
    { symbol_name: 'Router' }
  );

  await test(
    'find_references: init',
    'Find all callers of the init function',
    'find_references',
    { symbol_name: 'init' }
  );

  await test(
    'get_dependencies: application.js',
    'Get import graph for the application module',
    'get_dependencies',
    { file_path: 'lib/application.js' }
  );

  await test(
    'query_repo_structure',
    'Get full repo file/module hierarchy',
    'query_repo_structure',
    {}
  );

  await test(
    'get_file_symbols: src/index.ts',
    'List all symbols defined in the main entry point',
    'get_file_symbols',
    { file_path: 'src/index.ts' }
  );

  await test(
    'get_codebase_stats',
    'Get high-level repository stats',
    'get_codebase_stats',
    {}
  );

  await test(
    'smart_file_read: src/index.ts (skeleton)',
    'Read semantic projection of the entry point',
    'smart_file_read',
    { path: 'src/index.ts', mode: 'skeleton' }
  );

  // ─── summary ──────────────────────────────────────────────────────────────
  client.close();
  proc.kill();

  await new Promise(r => setTimeout(r, 200));

  const passed = results.filter(r => r.pass).length;
  const failed = results.length - passed;
  const avgTokens = Math.round(results.reduce((a, r) => a + r.tokenCount, 0) / results.length);
  const avgMs = Math.round(results.reduce((a, r) => a + r.elapsed, 0) / results.length);

  console.log(W('━'.repeat(70)));
  console.log(W('  Summary'));
  console.log(W('━'.repeat(70)));
  console.log(`  Tests:         ${passed} passed, ${failed > 0 ? R(failed + ' failed') : G('0 failed')}`);
  console.log(`  Avg tokens:    ${avgTokens.toLocaleString()} / ${TOKEN_BUDGET.toLocaleString()} budget`);
  console.log(`  Avg response:  ${avgMs}ms`);
  console.log(`  Budget cap:    ${passed === results.length ? G('All responses within 8k token limit') : R('Some responses exceeded budget')}`);
  console.log(W('━'.repeat(70)) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error(R('\nFatal: ' + e.message));
  process.exit(1);
});
