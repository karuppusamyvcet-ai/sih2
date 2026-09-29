#!/usr/bin/env bash
#
# Headless boot test for the browser build.
#
# Builds a throwaway tree in $TMPDIR that holds the real index.html, styles,
# src and content, plus two stand-ins for what a headless process cannot give
# us: jsdom for the DOM and tools/three_renderer_stub.js for the GPU renderer.
# It then boots src/main.js and plays the game — menu, intro, hub, all six
# galleries, a memorial, an exhibit, the archive, a quiz, the Guide, the door
# locking rules, saving and the settings — failing on any exception.
#
# jsdom is fetched with npm on first use. Without a network the script says so
# and exits 0 rather than blocking a commit: the offline gate is
# web/tools/run_tests.sh, which needs nothing but node.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB="$ROOT/web"
TREE="${TMPDIR:-/tmp}/heritage-boot-test"
JSDOM_VER="22.1.0"

rm -rf "$TREE"
mkdir -p "$TREE"
cp -r "$WEB/src" "$TREE/src"
cp -r "$WEB/content" "$TREE/content"
cp -r "$WEB/styles" "$TREE/styles"
cp "$WEB/index.html" "$TREE/index.html"
cp "$WEB/tools/boot_test.mjs" "$TREE/boot.mjs"
cat > "$TREE/package.json" <<'JSON'
{ "name": "heritage-boot-test", "private": true, "type": "module" }
JSON

if [ ! -d "$TREE/node_modules/jsdom" ]; then
  if command -v npm >/dev/null 2>&1; then
    echo "installing jsdom into the test tree (first run only)…"
    (cd "$TREE" && npm install "jsdom@$JSDOM_VER" --no-audit --no-fund --silent) \
      || { echo "SKIPPED: jsdom could not be installed (no npm registry access).";
           echo "        The offline gate is: bash web/tools/run_tests.sh"; exit 0; }
  else
    echo "SKIPPED: npm is not available, so jsdom cannot be installed."
    echo "        The offline gate is: bash web/tools/run_tests.sh"
    exit 0
  fi
fi

# npm prunes anything it does not know about, so the three.js stand-in is
# written after the install
mkdir -p "$TREE/node_modules/three"
cp "$WEB/tools/three_renderer_stub.js" "$TREE/node_modules/three/index.js"
cp "$WEB/vendor/three.module.js" "$TREE/node_modules/three/three.real.js"
cat > "$TREE/node_modules/three/package.json" <<'JSON'
{ "name": "three", "version": "0.160.1", "type": "module", "main": "index.js",
  "exports": { ".": "./index.js", "./three.real.js": "./three.real.js" } }
JSON

cd "$TREE"
node boot.mjs
