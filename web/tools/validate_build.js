#!/usr/bin/env node
/**
 * Static validation of the browser build.
 *
 * Runs without a browser, so it can gate every commit:
 *   1. every javscript file parses (syntax)
 *   2. every relative import resolves to a file that exists
 *   3. every getElementById / querySelector id used in src/ exists in index.html
 *   4. every data-i18n key and every content.t('key') call exists in localization.json
 *   5. every clip in character_spec.json is implemented in src/char/animator.js
 *   6. every proportion field referenced by src/char/builder.js exists in the spec
 *   7. the museum still has exactly six doors and six galleries
 *   8. the vendored three.js build is present
 *
 * Usage:  node web/tools/validate_build.js
 * Exit 0 = clean, 1 = failures.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const { execFileSync } = require('child_process');

const WEB = path.resolve(__dirname, '..');
const ROOT = path.resolve(WEB, '..');
const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

/* ------------------------------------------------------------------ files */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'vendor' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(path.join(WEB, 'src'));
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const spec = JSON.parse(fs.readFileSync(path.join(WEB, 'content', 'character_spec.json'), 'utf8'));
const museum = JSON.parse(fs.readFileSync(path.join(WEB, 'content', 'museum.json'), 'utf8'));
const zones = JSON.parse(fs.readFileSync(path.join(WEB, 'content', 'zones.json'), 'utf8'));
const loc = JSON.parse(fs.readFileSync(path.join(WEB, 'content', 'localization.json'), 'utf8'));

/* 1. syntax --------------------------------------------------------------- */
/* These are ES modules, so check them as .mjs via node's own parser. */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heritage-check-'));
for (const file of files) {
  const tmp = path.join(tmpDir, path.basename(file).replace(/\.js$/, '.mjs'));
  fs.copyFileSync(file, tmp);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  } catch (err) {
    const msg = (err.stderr || err.stdout || '').toString().split('\n').slice(0, 3).join(' ').trim();
    fail(`syntax: ${path.relative(ROOT, file)} — ${msg}`);
  }
}

/* 2. imports -------------------------------------------------------------- */
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  for (const m of code.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const target = m[1];
    if (target === 'three') {
      if (!fs.existsSync(path.join(WEB, 'vendor', 'three.module.js'))) {
        fail(`import "three" in ${path.relative(ROOT, file)} but web/vendor/three.module.js is missing`);
      }
      continue;
    }
    if (!target.startsWith('.')) { warn(`bare import "${target}" in ${path.relative(ROOT, file)}`); continue; }
    const resolved = path.resolve(dir, target);
    if (!fs.existsSync(resolved)) fail(`import "${target}" in ${path.relative(ROOT, file)} does not resolve`);
  }
}

/* 3. DOM ids -------------------------------------------------------------- */
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const usedIds = new Map();
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  for (const m of code.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) usedIds.set(m[1], file);
  for (const m of code.matchAll(/\$\(\s*['"]([^'"]+)['"]\s*\)/g)) usedIds.set(m[1], file);
}
for (const [id, file] of usedIds) {
  if (htmlIds.has(id)) continue;
  // ids created at runtime by the panel templates are fine
  const code = fs.readFileSync(file, 'utf8');
  if (code.includes(`id="${id}"`) || code.includes(`id='${id}'`) || code.includes(`id=\"${id}\"`)) continue;
  fail(`DOM id "${id}" used in ${path.relative(ROOT, file)} but not present in index.html nor created at runtime`);
}

/* 4. localization keys ---------------------------------------------------- */
const enKeys = new Set(Object.keys(loc.strings.en));
const i18nAttr = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]);
for (const key of i18nAttr) if (!enKeys.has(key)) fail(`data-i18n="${key}" missing from localization.json (en)`);
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  for (const m of code.matchAll(/\.t\(\s*['"]([^'"]+)['"]/g)) {
    if (!enKeys.has(m[1])) fail(`localization key "${m[1]}" used in ${path.relative(ROOT, file)} is missing from localization.json (en)`);
  }
}
for (const code of Object.keys(loc.strings)) {
  if (code === 'en') continue;
  const keys = Object.keys(loc.strings[code]).filter(k => !k.startsWith('_'));
  const entry = loc.locales.find(l => l.code === code);
  if (!entry) fail(`localization.json: strings for "${code}" but no locale entry`);
  if (entry && entry.status === 'complete' && keys.length < enKeys.size) {
    fail(`localization "${code}" is marked complete but has only ${keys.length}/${enKeys.size} keys`);
  }
}

/* 4b. localization keys used indirectly ------------------------------------ */
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  for (const m of code.matchAll(/t\(\s*`([a-zA-Z0-9_.]+)`/g)) {
    if (!enKeys.has(m[1])) fail(`localization key "${m[1]}" used in ${path.relative(ROOT, file)} is missing from localization.json (en)`);
  }
}

/* 5. animation clips ------------------------------------------------------ */
const animator = fs.readFileSync(path.join(WEB, 'src', 'char', 'animator.js'), 'utf8');
for (const clip of spec.clipList) {
  const re = new RegExp(`\\b${clip}\\s*:`);
  if (!re.test(animator)) fail(`clip "${clip}" from character_spec.json is not implemented in animator.js`);
}

/* 6. character proportions used by the builder --------------------------- */
const builder = fs.readFileSync(path.join(WEB, 'src', 'char', 'builder.js'), 'utf8');
const props = spec.proportions;
for (const m of builder.matchAll(/P\.([A-Za-z0-9_]+)/g)) {
  if (!(m[1] in props)) fail(`builder.js uses P.${m[1]} which is not defined in character_spec.json`);
}
for (const m of builder.matchAll(/(?:C|M)\.([A-Za-z0-9_]+)/g)) {
  if (!(m[1] in spec.clothing) && !(m[1] in spec.materials)) {
    warn(`builder.js uses ${m[0]} which is not in character_spec.json`);
  }
}

/* 7. six doors ------------------------------------------------------------ */
if (museum.doors.length !== 6) fail(`museum.json has ${museum.doors.length} doors — exactly six are required`);
if (new Set(museum.doors.map(d => d.zone)).size !== 6) fail('museum.json door zones are not distinct');
if (zones.zones.length !== 6) fail(`zones.json has ${zones.zones.length} galleries`);

/* 8. vendor --------------------------------------------------------------- */
const three = path.join(WEB, 'vendor', 'three.module.js');
if (!fs.existsSync(three)) fail('web/vendor/three.module.js is missing');
else {
  const size = fs.statSync(three).size;
  if (size < 500000) fail(`web/vendor/three.module.js looks truncated (${size} bytes)`);
}

/* content mirror ---------------------------------------------------------- */
const unityContent = path.join(ROOT, 'UnityProject', 'Assets', 'Resources', 'Content');
const webContent = path.join(WEB, 'content');
for (const f of fs.readdirSync(unityContent).filter(f => f.endsWith('.json'))) {
  const a = fs.readFileSync(path.join(unityContent, f), 'utf8');
  const bPath = path.join(webContent, f);
  if (!fs.existsSync(bPath)) { fail(`content mirror missing: web/content/${f}`); continue; }
  if (fs.readFileSync(bPath, 'utf8') !== a) warn(`web/content/${f} differs from the Unity copy (re-run the mirror step)`);
}

/* report ----------------------------------------------------------------- */
console.log('='.repeat(74));
console.log('SIH26096 — browser build validation');
console.log('='.repeat(74));
console.log(`  javascript modules : ${files.length}`);
console.log(`  DOM ids checked    : ${usedIds.size}`);
console.log(`  i18n keys (en)     : ${enKeys.size}`);
console.log(`  clips checked      : ${spec.clipList.length}`);
console.log(`  doors              : ${museum.doors.length}`);
console.log('-'.repeat(74));
if (warnings.length) {
  console.log(`WARNINGS (${warnings.length})`);
  warnings.forEach(w => console.log(`  ! ${w}`));
  console.log('-'.repeat(74));
}
if (errors.length) {
  console.log(`FAILURES (${errors.length})`);
  errors.forEach(e => console.log(`  x ${e}`));
  console.log('='.repeat(74));
  console.log('RESULT: FAILED');
  process.exit(1);
}
console.log('RESULT: PASSED — modules parse, imports resolve, DOM ids and translation keys exist,');
console.log('        every clip in the spec is implemented, and the museum still has exactly six doors.');
console.log('='.repeat(74));
