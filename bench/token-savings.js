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

import { SurrealStore, Indexer } from '../dist/index.js';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { parseArgs } from 'util';

const { values: args } = parseArgs({
  options: { cwd: { type: 'string', default: '/tmp/express-bench' } }
});

const BENCH_REPO = resolve(args.cwd);
const CHARS_PER_TOKEN = 4;

// ─── setup in-memory store for benchmark ────────────────────────────────────
console.log('🚀 Initializing in-memory benchmark engine...');
const store = new SurrealStore('mem://');
await store.initialize();
await store.migrate();

const indexer = new Indexer(store, BENCH_REPO);
console.log('📦 Indexing express (in-memory)...');
await indexer.indexCodebase();
console.log('✅ Indexing complete.\n');

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

async function tokenzipSearch(query, limit = 5) {
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
  return JSON.stringify(results, null, 2);
}

function tokenzipStats() {
  try {
    const out = execSync(
      `${CLI} search __IMPOSSIBLE_QUERY__ --cwd "${BENCH_REPO}" 2>&1 || true`,
      { encoding: 'utf8', timeout: 5000 }
    );
    return out;
  } catch {
    return '';
  }
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
      if (['node_modules', '.git', 'test', 'examples', 'docs', '.tokenzip'].includes(f)) continue;
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (ext.some(e => full.endsWith(e))) results.push(full);
    }
  }
  walk(dir);
  return results;
}

// ─── scenarios ──────────────────────────────────────────────────────────────

console.log(W('━'.repeat(70)));
console.log(W('  🗜️  TokenZip Token Savings Benchmark'));
console.log(W(`  Repo: ${BENCH_REPO}`));
console.log(W('━'.repeat(70)));

const allFiles = getAllFiles(BENCH_REPO);
console.log(DIM(`\n  Repo has ${allFiles.length} source files\n`));

const results = [];

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1: Understand what the Router class does
// Naive: paste lib/router/index.js (or similar)
// TokenZip: search "Router"
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S1: "What does the Router class do?"';
  const naiveFiles = allFiles.filter(f => 
    f.includes('router') && (f.endsWith('index.js') || f.endsWith('router.js'))
  );
  const naiveChars = naiveFiles.reduce((acc, f) => acc + readFileChars(f), 0) || 5000;
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tokenzipSearch('Router', 3);
  const r = row(label, naiveChars, tzOut);
  results.push(r);
  console.log(`  ${G('done')}  (saved ${savings(r.naiveTok, r.tzTok)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2: What does the Application/app class expose?
// Naive: paste application.js (the big one)
// TokenZip: search "Application"
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S2: "What methods does Application expose?"';
  const naiveFiles = allFiles.filter(f =>
    f.endsWith('application.js') || f.endsWith('application.ts') || f.endsWith('app.js')
  );
  const naiveChars = naiveFiles.reduce((acc, f) => acc + readFileChars(f), 0) || 5000;
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tokenzipSearch('Application', 5);
  const r = row(label, naiveChars, tzOut);
  results.push(r);
  console.log(`  ${G('done')}  (saved ${savings(r.naiveTok, r.tzTok)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3: What does the Layer match function do?
// Naive: paste lib/router/layer.js
// TokenZip: search "match"
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S3: "What does Layer.match() do?"';
  const naiveFiles = allFiles.filter(f =>
    f.endsWith('layer.js') || f.endsWith('layer.ts')
  );
  const naiveChars = naiveFiles.reduce((acc, f) => acc + readFileChars(f), 0) || 3000;
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tokenzipSearch('match', 5);
  const r = row(label, naiveChars, tzOut);
  results.push(r);
  console.log(`  ${G('done')}  (saved ${savings(r.naiveTok, r.tzTok)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 4: What does the request parsing look like?
// Naive: paste all of lib/request.js
// TokenZip: search "request"
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S4: "What does the request module expose?"';
  const naiveFiles = allFiles.filter(f =>
    f.endsWith('request.js') || f.endsWith('request.ts')
  );
  const naiveChars = naiveFiles.reduce((acc, f) => acc + readFileChars(f), 0) || 4000;
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tokenzipSearch('request', 5);
  const r = row(label, naiveChars, tzOut);
  results.push(r);
  console.log(`  ${G('done')}  (saved ${savings(r.naiveTok, r.tzTok)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 5: Full repo overview — worst case naive
// Naive: first 50 lines of every source file
// TokenZip: search "init" or "use" — top symbols that span the repo
// ─────────────────────────────────────────────────────────────────────────────
{
  const label = 'S5: Full repo "What does this codebase do?"';
  let naiveChars = 0;
  for (const f of allFiles.slice(0, 30)) {
    const content = readFileSync(f, 'utf8').split('\n').slice(0, 50).join('\n');
    naiveChars += content.length;
  }
  process.stdout.write(`  ${B('Running')} ${label}...`);
  const tzOut = await tokenzipSearch('use', 10);
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
