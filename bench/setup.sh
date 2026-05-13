#!/usr/bin/env bash
# bench/setup.sh — Clone express and index it with the local TokenZip build
set -e

CLI="node ./dist/cli/index.js"
BENCH_REPO="./.bench/express"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TokenZip Benchmark Setup"
echo "  Repo: expressjs/express → $BENCH_REPO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Clone express (shallow, fast)
if [ -d "$BENCH_REPO" ]; then
  echo "✅ $BENCH_REPO already exists — skipping clone"
else
  echo "📦 Cloning expressjs/express..."
  git clone --depth=1 https://github.com/expressjs/express "$BENCH_REPO"
  echo "✅ Cloned."
fi

# 2. Init + parse
echo ""
echo "🔧 Initializing TokenZip..."
$CLI init --cwd "$BENCH_REPO" 2>&1 || true   # ignore if already initialized

echo ""
echo "⏱  Parsing express... (timing this)"
START=$(date +%s)
$CLI reset --parse --cwd "$BENCH_REPO"
END=$(date +%s)
ELAPSED=$((END - START))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Parse complete in ${ELAPSED}s"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
