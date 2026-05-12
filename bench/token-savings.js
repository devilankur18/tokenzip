#!/usr/bin/env node
/**
 * bench/token-savings.js
 *
 * Measures token savings from using TokenZip vs. naive file-paste approach.
 * Uses chars÷4 as the standard GPT-4 token estimate.
 *
 * Usage:
 *   node bench/token-savings.js
 *   node bench/token-savings.js --cwd /tmp/express-bench
 */

import { SurrealStore, Indexer, executeStrategy, TokenBudgetManager } from '../dist/index.js';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { parseArgs } from 'util';

const { values: args } = parseArgs({
  options: { cwd: { type: 'string', default: '/tmp/express-bench' } }
});

const BENCH_REPO = resolve(args.cwd);
const CHARS_PER_TOKEN = 4;

// ─── setup in-memory store for benchmark ────────────────────────────────────
const store = new SurrealStore('mem://');
await store.initialize();
await store.migrate();

const indexer = new Indexer(store, BENCH_REPO);
await indexer.indexCodebase();

// ─── helpers ────────────────────────────────────────────────────────────────

function naiveTokens(chars) {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

function readFileChars(filePath) {
  try {
    return readFileSync(filePath, 'utf8').length;
  } catch {
    return 0;
  }
}

function readCodeRange(filePath, range) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const start = Math.max(0, range.startLine - 1);
    const end = Math.min(lines.length, range.endLine);
    return lines.slice(start, end).join('\n');
  } catch {
    return '';
  }
}

async function tzSmartRead(filePath, mode, targetSymbol = null) {
  const allFiles = await store.query('SELECT path, id FROM file');
  const targetFile = allFiles.find(f => f.path === filePath || f.path.endsWith(filePath));
  if (!targetFile) return "";
  
  const fileId = targetFile.id;
  const absPath = resolve(BENCH_REPO, filePath);
  
  // Signature: executeStrategy(mode, relPath, absPath, fileId, store, targetSymbol, budget, maxTokens)
  const result = await executeStrategy(mode, filePath, absPath, fileId, store, targetSymbol, new TokenBudgetManager(), 8000);
  return result.content;
}

async function tokenzipSearch(query, limit = 5, includeBody = false) {
  // Simulate the search command output
  const q = `
    SELECT 
      name, kind, signature, startLine, endLine, 
      (SELECT path FROM file WHERE id = $parent.fileId)[0].path AS filePath
    FROM symbol 
    WHERE string::lowercase(name) CONTAINS string::lowercase($query)
    LIMIT $limit;
  `;
  const results = await store.query(q, { query, limit });
  
  if (includeBody) {
    for (const sym of results) {
      if (sym.filePath) {
        sym.body = readCodeRange(join(BENCH_REPO, sym.filePath), { 
          startLine: sym.startLine, 
          endLine: sym.endLine 
        });
      }
    }
  }

  return JSON.stringify(results, null, 2);
}

// ─── colour helpers ─────────────────────────────────────────────────────────
const G = s => `\x1b[32m${s}\x1b[0m`;
const B = s => `\x1b[34m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const W = s => `\x1b[1m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const DIM = s => `\x1b[2m${s}\x1b[0m`;

function savings(naive, tz) {
  const pct = ((naive - tz) / naive * 100).toFixed(1);
  return pct >= 90 ? G(`${pct}%`) : pct >= 70 ? Y(`${pct}%`) : R(`${pct}%`);
}

function row(label, naiveChars, tzOutput) {
  const naiveTok = naiveTokens(naiveChars);
  const tzTok = naiveTokens(tzOutput.length);
  return { label, naiveTok, tzTok, pct: ((naiveTok - tzTok) / naiveTok * 100).toFixed(1) };
}

function getAllFiles(dir, ext = ['.js', '.ts']) {
  const results = [];
  function walk(d) {
    if (!existsSync(d)) return;
    for (const f of readdirSync(d)) {
      const full = join(d, f);
      // Don't skip subdirectories unless they are hidden or node_modules
      if (['node_modules', '.git', '.tokenzip'].includes(f)) continue;
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (ext.some(e => full.endsWith(e))) results.push(full);
    }
  }
  walk(dir);
  return results;
}

// ─── scenarios ──────────────────────────────────────────────────────────────

console.log(W('━'.repeat(70)));
console.log(W('  🗜️  TokenZip Token Savings Benchmark (Realistic Mode)'));
console.log(W(`  Repo: ${BENCH_REPO}`));
console.log(W('━'.repeat(70)));

const allFiles = getAllFiles(BENCH_REPO);
console.log(DIM(`\n  Repo has ${allFiles.length} source files (including tests/examples)\n`));

const results = [];

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1: Understand what the Application class does
// Naive: paste application.js
// TokenZip: search "Application" + get bodies of top matches
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S1: "What does the Application class do?"';
  const naiveFiles = allFiles.filter(f => f.endsWith('application.js'));
  const naiveChars = naiveFiles.reduce((acc, f) => acc + readFileChars(f), 0) || 10000;
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tokenzipSearch('Application', 3, true); // Include body for realism
  const r = row(label, naiveChars, tzOut);
  results.push(r);
  console.log(`  ${G('done')}  (saved ${savings(r.naiveTok, r.tzTok)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2: How does ETag generation work?
// Naive: paste lib/utils.js
// TokenZip: search "etag" + get body
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S2: "How does ETag generation work?"';
  const naiveFiles = allFiles.filter(f => f.endsWith('utils.js'));
  const naiveChars = naiveFiles.reduce((acc, f) => acc + readFileChars(f), 0) || 5000;
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tokenzipSearch('etag', 2, true);
  const r = row(label, naiveChars, tzOut);
  results.push(r);
  console.log(`  ${G('done')}  (saved ${savings(r.naiveTok, r.tzTok)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3: What does normalizeType do?
// Naive: paste lib/utils.js
// TokenZip: search "normalizeType" + get body
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S3: "What does normalizeType do?"';
  const naiveFiles = allFiles.filter(f => f.endsWith('utils.js'));
  const naiveChars = naiveFiles.reduce((acc, f) => acc + readFileChars(f), 0) || 5000;
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tokenzipSearch('normalizeType', 1, true);
  const r = row(label, naiveChars, tzOut);
  results.push(r);
  console.log(`  ${G('done')}  (saved ${savings(r.naiveTok, r.tzTok)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 4: What does the request module expose? (Metadata only)
// Naive: paste lib/request.js
// TokenZip: search "request" (Metadata only - to see surface area)
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S4: "Request module surface area" (Metadata Only)';
  const naiveFiles = allFiles.filter(f => f.endsWith('request.js'));
  const naiveChars = naiveFiles.reduce((acc, f) => acc + readFileChars(f), 0) || 8000;
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tokenzipSearch('request', 5, false); // Just metadata
  const r = row(label, naiveChars, tzOut);
  results.push(r);
  console.log(`  ${G('done')}  (saved ${savings(r.naiveTok, r.tzTok)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 5: Cross-file connection: Who calls handle?
// Naive: grep "handle" across repo or paste index.js + application.js
// TokenZip: find_references (simulated by search + metadata)
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S5: Cross-file: "Who calls handle?"';
  const naiveFiles = allFiles.filter(f => f.endsWith('index.js') || f.endsWith('application.js'));
  const naiveChars = naiveFiles.reduce((acc, f) => acc + readFileChars(f), 0) || 15000;
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tokenzipSearch('handle', 5, false);
  const r = row(label, naiveChars, tzOut);
  results.push(r);
  console.log(`  ${G('done')}  (saved ${savings(r.naiveTok, r.tzTok)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 6: Smart File Read - interface_only vs full file
// Naive: paste lib/request.js
// TokenZip: smart_file_read(mode="interface_only")
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S6: Smart Read (interface_only): lib/request.js';
  const file = 'lib/request.js';
  const fullPath = join(BENCH_REPO, file);
  const naiveChars = readFileChars(fullPath) || 8000;
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tzSmartRead(file, 'interface_only');
  const r = row(label, naiveChars, tzOut);
  results.push(r);
  console.log(`  ${G('done')}  (saved ${savings(r.naiveTok, r.tzTok)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 7: Smart File Read - skeleton vs full file
// Naive: paste lib/response.js
// TokenZip: smart_file_read(mode="skeleton")
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S7: Smart Read (skeleton): lib/response.js';
  const file = 'lib/response.js';
  const fullPath = join(BENCH_REPO, file);
  const naiveChars = readFileChars(fullPath) || 10000;
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tzSmartRead(file, 'skeleton');
  const r = row(label, naiveChars, tzOut);
  results.push(r);
  console.log(`  ${G('done')}  (saved ${savings(r.naiveTok, r.tzTok)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 8: Smart Read (implementation_of) vs full file
// Naive: paste lib/application.js
// TokenZip: smart_file_read(mode="implementation_of", target_symbol="handle")
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S8: Smart Read (implementation_of "handle"): lib/application.js';
  const file = 'lib/application.js';
  const fullPath = join(BENCH_REPO, file);
  const naiveChars = readFileChars(fullPath) || 12000;
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tzSmartRead(file, 'implementation_of', 'handle');
  const r = row(label, naiveChars, tzOut);
  results.push(r);
  console.log(`  ${G('done')}  (saved ${savings(r.naiveTok, r.tzTok)})`);
}

// ─── results table ──────────────────────────────────────────────────────────

const COL = [52, 12, 12, 10];
const pad = (s, n) => String(s).padStart(n);
const padL = (s, n) => String(s).padEnd(n);

console.log('\n' + W('━'.repeat(70)));
console.log(W('  Results'));
console.log(W('━'.repeat(70)));
console.log(
  W(padL('  Scenario', COL[0])) +
  W(pad('Naive tok', COL[1])) +
  W(pad('TZ tok', COL[2])) +
  W(pad('Saved', COL[3]))
);
console.log('  ' + '─'.repeat(68));

let totalNaive = 0, totalTZ = 0;
for (const r of results) {
  totalNaive += r.naiveTok;
  totalTZ += r.tzTok;
  const pct = ((r.naiveTok - r.tzTok) / r.naiveTok * 100).toFixed(1);
  const color = pct >= 90 ? G : pct >= 70 ? Y : R;
  console.log(
    padL(`  ${r.label}`, COL[0]) +
    pad(r.naiveTok.toLocaleString(), COL[1]) +
    pad(r.tzTok.toLocaleString(), COL[2]) +
    pad(color(`${pct}%`), COL[3] + 10)
  );
}

console.log('  ' + '─'.repeat(68));
const totalPct = ((totalNaive - totalTZ) / totalNaive * 100).toFixed(1);
console.log(
  W(padL('  TOTAL', COL[0])) +
  W(pad(totalNaive.toLocaleString(), COL[1])) +
  W(pad(totalTZ.toLocaleString(), COL[2])) +
  W(pad(G(`${totalPct}%`), COL[3] + 10))
);
console.log(W('━'.repeat(70)));

const avgSavings = ((totalNaive - totalTZ) / totalNaive * 100).toFixed(1);
console.log(`\n  ${W('Average token savings:')} ${G(avgSavings + '%')}`);
console.log(`  ${W('Naive total:')}          ${Y(totalNaive.toLocaleString())} tokens`);
console.log(`  ${W('TokenZip total:')}       ${G(totalTZ.toLocaleString())} tokens`);
console.log(`  ${W('Context budget freed:')} ${G((totalNaive - totalTZ).toLocaleString())} tokens (~${Math.round((totalNaive - totalTZ)/totalNaive * 128000).toLocaleString()} chars in a 128k window)\n`);
