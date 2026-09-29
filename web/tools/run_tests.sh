#!/usr/bin/env bash
# Runs the browser build test suites against the *vendored* three.js.
#
# The browser modules import the bare specifier "three" (resolved by the
# importmap in index.html). Node needs a real node_modules entry, so this
# script builds a throwaway tree in /tmp that maps "three" to
# web/vendor/three.module.js — the exact file the demo ships — and runs the
# test there. Nothing is written inside the repository.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB="$ROOT/web"
TREE="${TMPDIR:-/tmp}/heritage-character-test"

rm -rf "$TREE"
mkdir -p "$TREE/node_modules/three"
cp -r "$WEB/src" "$TREE/src"
cp -r "$WEB/content" "$TREE/content"
mkdir -p "$TREE/tools"
cp "$WEB/tools/test_character.js" "$TREE/tools/test_character.mjs"
cp "$WEB/tools/test_gameplay.js" "$TREE/tools/test_gameplay.mjs"
# test_content.js is a CommonJS driver (it reads the module sources itself),
# so it keeps the .cjs extension when it is copied into the throwaway tree.
cp "$WEB/tools/test_content.js" "$TREE/tools/test_content.cjs"
cp "$WEB/vendor/three.module.js" "$TREE/node_modules/three/index.js"
cat > "$TREE/node_modules/three/package.json" <<'JSON'
{ "name": "three", "version": "0.160.1", "type": "module", "main": "index.js", "exports": { ".": "./index.js" } }
JSON
cat > "$TREE/package.json" <<'JSON'
{ "name": "heritage-character-test", "private": true, "type": "module" }
JSON

echo "SIH26096 — browser build test suite (node $(node --version), vendored three.js $(grep -oE "REVISION = '[0-9]+'" "$WEB/vendor/three.module.js" | head -1 | grep -oE "[0-9]+"))"
cd "$TREE"

echo ""
echo "### character + animation ###"
node tools/test_character.mjs
CHAR=$?

echo ""
echo "### gameplay logic ###"
node tools/test_gameplay.mjs
PLAY=$?

echo ""
echo "### content engine ###"
node tools/test_content.cjs
CONTENT=$?

echo ""
if [ $(( CHAR + PLAY + CONTENT )) -eq 0 ]; then
  echo "ALL SUITES PASSED"
else
  echo "SUITE FAILURES: character=$CHAR gameplay=$PLAY content=$CONTENT"
fi
exit $(( CHAR + PLAY + CONTENT ))
