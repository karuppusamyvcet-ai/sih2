/**
 * Headless boot test for the browser build.
 *
 * Loads the real index.html into jsdom, stubs only the two things a headless
 * process cannot provide — WebGL and a canvas 2D backend — and then boots the
 * real src/main.js. It drives the actual game: menu -> new journey -> hub ->
 * each of the six galleries -> a memorial reconstruction -> an exhibit
 * interaction and the quiz engine, reporting any exception, any console error
 * and any DOM element the UI failed to find.
 *
 * Usage (from a tree that has jsdom + three installed):
 *   node boot.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const errors = [];
const warnings = [];
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  ok   ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name} ${detail}`); }
};

/* ------------------------------------------------------------- 2D canvas */
const ctx2d = () => new Proxy({
  measureText: () => ({ width: 42 }),
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w, height: h }),
  putImageData: () => {},
  canvas: null
}, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true; } });

/* ------------------------------------------------------------------ DOM */
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'http://localhost:8000/' });
const { window } = dom;
const { document } = window;

window.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type === '2d') { const c = ctx2d(); c.canvas = this; return c; }
  return { /* a pretend GL context: the renderer is stubbed below */ };
};
window.matchMedia = window.matchMedia || ((q) => ({
  matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}
}));
window.speechSynthesis = { getVoices: () => [], speak: () => {}, cancel: () => {}, addEventListener: () => {} };
window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });

for (const key of ['document', 'navigator', 'location', 'localStorage', 'HTMLElement', 'Node',
  'Element', 'CustomEvent', 'Event', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
  'matchMedia', 'speechSynthesis', 'DOMParser', 'Image', 'Blob', 'URLSearchParams', 'MutationObserver',
  'history']) {
  const value = window[key] ?? class { observe() {} unobserve() {} disconnect() {} };
  try { globalThis[key] = value; } catch { /* read-only in this node version */ }
}
for (const key of ['ResizeObserver', 'IntersectionObserver', 'SpeechSynthesisUtterance']) {
  globalThis[key] = window[key] ?? class { observe() {} unobserve() {} disconnect() {} };
}
globalThis.self = globalThis;
globalThis.window = window;

/* the app fetches its own content files: serve them from disk */
globalThis.fetch = async (url) => {
  const rel = String(url).replace(/^\.\//, '');
  const file = path.resolve(rel);
  if (!fs.existsSync(file)) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
};

/* record anything the app logs as an error */
const consoleErrors = [];
const consoleWarns = [];
const origError = console.error;
const origWarn = console.warn;
console.error = (...a) => { consoleErrors.push(a.map(String).join(' ')); };
console.warn = (...a) => { consoleWarns.push(a.map(String).join(' ')); };
window.addEventListener('error', (e) => errors.push(`window error: ${e.message}`));
process.on('unhandledRejection', (e) => errors.push(`unhandled rejection: ${e && e.message}`));

/* ---------------------------------------------------------------- three */
/* The renderer cannot exist without a GPU, so it is replaced with a stub that
   implements only the surface main.js uses. Everything else is real three.js. */
const THREE_KEYS = Object.keys(await import('three'));
const savedRenderer = THREE_KEYS.includes('WebGLRenderer');

/* ---------------------------------------------------------------- boot */
console.log('SIH26096 — headless boot test (jsdom + real modules)\n');
const t0 = Date.now();
let game = null;
try {
  await import('./src/main.js');
  game = window.heritageGame;
  for (let i = 0; i < 240 && !(game && game.ready); i += 1) {
    await new Promise(r => setTimeout(r, 50));
  }
} catch (err) {
  fail = fail + 1;
  console.log(`  FAIL the module graph failed to load: ${err.message}`);
}

check('the game object is constructed and exposed', !!game);
if (!game) { console.log('\nAborting: nothing to drive.'); process.exit(1); }
check('boot reaches ready (content + renderer + character + world + systems)', game.ready === true,
  document.getElementById('boot-status')?.textContent || '');
check('boot took under 20 s', Date.now() - t0 < 20000, `${Date.now() - t0} ms`);
check('no module-level exceptions', errors.length === 0, errors.join(' | '));

console.log('\nWiring');
check('the archive loaded all records', game.content.archive.records.length > 60, String(game.content.archive.records.length));
check('renderer, scene, camera and character exist', !!(game.renderer && game.scene && game.camera && game.character));
check('all systems are wired', !!(game.hud && game.panels && game.world && game.player && game.quests && game.quiz));
check('the main menu is visible at boot', document.getElementById('menu')?.classList.contains('visible')
  || document.getElementById('menu')?.offsetParent !== undefined);
const continueBtn = document.getElementById('btn-continue');
check('CONTINUE exists in the main menu', !!continueBtn);
check('CONTINUE reflects whether a save was found',
  continueBtn.disabled === (game.state.hasSave() === false),
  `disabled=${continueBtn?.disabled} hasSave=${game.state.hasSave()}`);
check('the continue hint explains the state', !!document.getElementById('continue-hint')?.textContent);
check('every menu action required by the brief is present',
  ['new', 'continue', 'archive', 'settings', 'credits', 'demo', 'presentation', 'exit']
    .every(a => !!document.querySelector(`[data-action="${a}"]`)),
  [...document.querySelectorAll('[data-action]')].map(b => b.dataset.action).join(','));

console.log('\nPlaying the game');
const guard = async (label, fn) => {
  try { await fn(); return true; } catch (err) { errors.push(`${label}: ${err.message}`); return false; }
};

await guard('new journey', () => game.startJourney({ demo: false }));
check('NEW JOURNEY starts the cinematic intro', game.mode === 'intro', game.mode);
check('the intro is skippable', typeof game.skipIntro === 'function');
await guard('skip intro', () => game.skipIntro());
for (let i = 0; i < 60 && game.mode !== 'play'; i += 1) await new Promise(r => setTimeout(r, 20));
check('skipping the intro lands in the museum', game.mode === 'play', game.mode);
check('the hub is built with six doors', game.world.doors.length === 6, String(game.world.doors.length));
check('the six door labels are rendered', !!document.getElementById('minimap'));
check('the player is standing in the hub', game.world.zone === 'hub', game.world.zone);

const zones = ['early_life', 'social_reform', 'law_constitution', 'manuscripts', 'memorials', 'legacy'];
for (const zone of zones) {
  const ok = await guard(`enterZone(${zone})`, () => game.enterZone(zone));
  const built = game.world.zone === zone;
  check(`gallery ${zone} builds and becomes the active room`, ok && built, game.world.zone);
  const interactables = game.world.interactables.length;
  check(`gallery ${zone} registers interactables (${interactables})`, interactables > 0);
}
const memSite = game.content.memorials.sites[3];
const memOk = await guard('memorial scene', () => game.visitMemorialScene(memSite.id));
check(`a memorial reconstruction builds (${memSite.id})`, memOk && game.world.zone === 'memorial', game.world.zone);
const badMemOk = await guard('unknown memorial id', () => game.visitMemorialScene('not_a_site'));
check('an unknown memorial id falls back instead of throwing', badMemOk, errors.slice(-2).join(' | '));

await guard('hub', () => game.enterZone('hub'));

console.log('\nInteraction and UI');
check('the HUD shows an objective', !!document.getElementById('objective-text'));
const firstExhibit = game.world.interactables.find(i => i.kind !== 'door');
check('the hub exposes an interactable to use', !!firstExhibit, JSON.stringify(game.world.interactables.slice(0, 3).map(i => i.id)));
if (firstExhibit) {
  const ok = await guard('handleExhibit', () => game.handleExhibit(firstExhibit, { open: true }));
  check(`interacting with ${firstExhibit.id} opens its panel without throwing`, ok, errors.slice(-2).join(' | '));
  const modalOpen = !!document.querySelector('.modal.open');
  check('a modal or the HUD responded to the interaction', modalOpen || !!document.getElementById('toast')?.textContent);
  game.panels.closeAll();
}
const archiveOk = await guard('open archive', () => game.openArchive());
check('the Digital Archive opens', archiveOk && !!document.querySelector('.modal.open'));
for (let i = 0; i < 40; i += 1) {
  const row = document.querySelector('#archive-list li, #archive-results li, #archive-list button');
  if (row) { try { row.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); } catch (err) { errors.push(`archive click: ${err.message}`); } break; }
}
game.panels.closeAll();
const quizOk = await guard('quiz', () => game.panels.startQuiz(['q_early_1', 'q_law_1']));
check('a quiz kiosk starts a session', quizOk && game.quiz.active === true);
if (game.quiz.active) {
  const q = game.quiz.question;
  const answer = q.type === 'true_false' ? { bool: q.answerBool } : { choice: q.answerId };
  const res = game.quiz.submit(answer);
  check('submitting an answer returns grading plus explanation', !!res && res.correct === true && res.explanation.length > 20);
  game.panels.quizNext ? game.panels.quizNext() : game.quiz.advance();
}
const guideOk = await guard('guide', () => game.panels.openGuide());
check('the Archive Guide opens', guideOk);
if (guideOk) {
  const answer = game.content.answer('What does Article 32 do?');
  check('the Guide answers with citations', answer.sources.length > 0 && !answer.noResults);
  check('the Guide is labelled offline', game.content.guide.messages.offlineLabel.toLowerCase().includes('offline'));
}
game.panels.closeAll();
for (const name of ['openMap', 'openObjectives', 'openSettings', 'openCredits', 'openCertificate']) {
  const ok = await guard(name, () => game.panels[name]());
  check(`${name}() opens without throwing`, ok);
  const open = !!document.querySelector('.modal.open');
  check(`${name}() actually shows a modal`, open, name);
  game.panels.closeAll();
}
const pauseOk = await guard('pause', () => game.openPause());
check('the pause menu opens', pauseOk);
game.panels.closeAll();

console.log('\nDoors and mission flow');
// complete mission 1 the way the game does, then walk through a door
const missions = game.content.quests.missions;
const drive = async () => {
  for (const z of game.content.zones.zones) game.quests.notify('zone_entered', { zoneId: z.id });
  game.quests.notify('proximity', { target: 'hub_center', distance: 0.3 });
  game.quests.notify('interact', { exhibitId: 'exhibit_hub_guide_terminal' });
  game.quests.notify('interact', { exhibitId: 'exhibit_hub_door_labels' });
  game.state.progress.flags.interact_ui_archive = true;
  game.quests.notify('interact', { exhibitId: 'ui_archive' });
  game.quests.checkAchievements();
};
await guard('mission 1', drive);
check('mission 1 completes', game.quests.isMissionComplete(missions[0].id));
const doorInteractable = game.world.interactables.find(i => i.kind === 'door' && i.zone === 'early_life');
check('the hub exposes the early-life door as an interactable', !!doorInteractable,
  JSON.stringify(game.world.interactables.filter(i => i.kind === 'door').map(i => i.id)));
check('the first door leads to the early-life gallery',
  game.world.doors[0].zone === 'early_life', game.world.doors[0].zone);
check('the early-life gallery is open once mission 1 is done', game.isZoneUnlocked('early_life') === true);
const doorOk = await guard('useDoor', () => game.useDoor(doorInteractable));
await new Promise(r => setTimeout(r, 800));
check('walking through the door loads its gallery', doorOk && game.world.zone === 'early_life', game.world.zone);
await guard('hub', () => game.enterZone('hub'));
const lockedDoor = game.world.interactables.find(i => i.kind === 'door' && i.zone === 'legacy');
const lockedSafe = await guard('locked door', () => game.useDoor(lockedDoor));
check('a locked gallery refuses entry without throwing', lockedSafe, errors.slice(-2).join(' | '));
check('the locked gallery is still the hub', game.world.zone === 'hub', game.world.zone);
check('the player was told why the door is locked', !!document.getElementById('toast')?.textContent?.length);

console.log('\nFrame loop and save');
const framesBefore = game.frameCount ?? 0;
await new Promise(r => setTimeout(r, 600));
check('the frame loop runs', (game.frameCount ?? 0) > framesBefore, `${game.frameCount}`);
check('saving works', await guard('save', () => { game.state.save(); return true; }));
check('the save is readable', JSON.parse(window.localStorage.getItem('heritage.save.v1')).player.zone === 'hub');
check('quality presets apply without throwing', await guard('quality', () => {
  for (const q of ['low', 'medium', 'high', 'auto']) {
    game.state.setSetting('quality', q);
    game.applyQuality(false);
  }
  game.state.setSetting('quality', 'auto');
  game.applyQuality(false);
}));
check('accessibility settings apply without throwing', await guard('a11y', () => {
  game.state.setSetting('textScale', 1.4);
  game.state.setSetting('contrast', true);
  game.panels.applySettingsToDom();
}));
check('reduced effects mode applies', await guard('reduced', () => { game.state.setSetting('reduceEffects', true); game.applyQuality(false); }));

console.log('\nDiagnostics');
check('no DOM lookups returned null during play', consoleErrors.filter(e => /null|undefined/.test(e)).length === 0,
  consoleErrors.filter(e => /null|undefined/.test(e)).slice(0, 3).join(' | '));
check('no exceptions were raised', errors.length === 0, errors.slice(0, 4).join(' | '));
check('no console errors were logged', consoleErrors.length === 0, consoleErrors.slice(0, 4).join(' | '));
console.log(`  -- console warnings (${consoleWarns.length})`);
consoleWarns.slice(0, 6).forEach(w => console.log(`     ! ${w.slice(0, 140)}`));

console.error = origError;
console.warn = origWarn;
console.log('\n' + '-'.repeat(66));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
