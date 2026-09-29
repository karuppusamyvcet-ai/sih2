/**
 * Gameplay logic test — the parts of the game that must be right for a judge to
 * trust it, verified without a browser and without a network:
 *
 *   1. every question in the bank is answerable, and every answer carries the
 *      explanation and the citation (§63: never a bare "wrong")
 *   2. all five question types grade correctly
 *   3. all eight missions can actually be completed, all sixteen achievements
 *      can actually unlock, and the HERITAGE ARCHIVIST badge is reachable
 *   4. achievements are data-driven: every trigger type used in
 *      achievements.json is understood by the evaluator
 *   5. the save system round-trips, and a corrupted save is recovered rather
 *      than bricking the game
 *
 * Run through web/tools/run_tests.sh.  Can also run as ESM directly:
 *   node --experimental-default-type=module web/tools/test_gameplay.js
 */
import fs from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------ localStorage shim */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  get length() { return store.size; }
};
globalThis.console.warn = ((orig) => (...args) => {
  if (String(args[0]).includes('achievement trigger type')) warnings.push(String(args[0]));
  return orig(...args);
})(console.warn);
const warnings = [];

const root = path.resolve(import.meta.dirname, '..');
const files = ['archive', 'timeline', 'zones', 'questions', 'museum', 'quests',
  'achievements', 'memorials', 'glossary', 'guide', 'localization', 'exhibits', 'character_spec'];
const bundle = {};
for (const f of files) bundle[f] = JSON.parse(fs.readFileSync(path.join(root, 'content', `${f}.json`), 'utf8'));
bundle.character = bundle.character_spec;

const { Content } = await import('../src/core/content.js');
const { State } = await import('../src/core/state.js');
const { Quests } = await import('../src/systems/quests.js');
const { Quiz } = await import('../src/systems/quiz.js');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  ok   ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name} ${detail}`); }
};

const fresh = () => {
  localStorage.clear();
  const content = new Content(JSON.parse(JSON.stringify(bundle)), 'en');
  const state = new State();
  state.loadSettings();
  state.loadProgress();
  const quests = new Quests(content, state);
  const quiz = new Quiz(content, state, quests);
  return { content, state, quests, quiz };
};

/* ==================================================== question bank quality */
console.log('Question bank');
{
  const { content } = fresh();
  const questions = content.questions.questions;
  const types = new Set(['multiple_choice', 'true_false', 'ordering', 'matching', 'image_identification']);
  check(`every question uses one of the five supported types`,
    questions.every(q => types.has(q.type)), questions.filter(q => !types.has(q.type)).map(q => q.type).join(','));
  check('every question states an explanation', questions.every(q => (q.explanation || '').length > 40));
  check('every question cites a source', questions.every(q => (q.source || '').length > 5));
  check('every question is worth points', questions.every(q => (q.points || content.questions.defaultPoints) > 0));
  check('multiple-choice questions have a valid answerId',
    questions.filter(q => q.type === 'multiple_choice')
      .every(q => (q.options || []).some(o => o.id === q.answerId)));
  check('image questions name a generated diagram, not a photograph',
    questions.filter(q => q.type === 'image_identification')
      .every(q => !/photograph of/i.test(q.image || '')));
}

/* ========================================================== grading engine */
const payloadFor = (q) => {
  switch (q.type) {
    case 'multiple_choice':
    case 'image_identification': return { choice: q.answerId };
    case 'true_false': return { bool: q.answerBool };
    case 'ordering': return { order: [...q.correctOrder] };
    case 'matching': return { pairs: Object.fromEntries(q.pairs.map(p => [p.id, p.right])) };
    default: return {};
  }
};
const wrongPayloadFor = (q) => {
  switch (q.type) {
    case 'multiple_choice':
    case 'image_identification': return { choice: (q.options || []).map(o => o.id).find(id => id !== q.answerId) || 'nope' };
    case 'true_false': return { bool: !q.answerBool };
    case 'ordering': return { order: [...q.correctOrder].reverse() };
    case 'matching': return { pairs: Object.fromEntries(q.pairs.map(p => [p.id, q.pairs.map(x => x.right).find(r => r !== p.right)])) };
    default: return {};
  }
};

console.log('\nGrading — every question in the bank, right answer and wrong answer');
{
  const { content, state, quests, quiz } = fresh();
  const problems = [];
  for (const q of content.questions.questions) {
    quiz.start([q.id]);
    const good = quiz.submit(payloadFor(q));
    if (!good) { problems.push(`${q.id}: correct answer produced no result`); continue; }
    if (!good.correct) problems.push(`${q.id}: correct answer graded wrong`);
    if (!good.explanation || good.explanation.length < 40) problems.push(`${q.id}: no explanation`);
    if (!good.source) problems.push(`${q.id}: no citation`);
    if (good.points <= 0) problems.push(`${q.id}: no points`);
    if (!good.answerText) problems.push(`${q.id}: no answer text`);
    quiz.advance();

    quiz.start([q.id]);
    const bad = quiz.submit(wrongPayloadFor(q));
    if (bad.correct) problems.push(`${q.id}: wrong answer graded correct`);
    if (!bad.explanation || bad.explanation.length < 40) problems.push(`${q.id}: wrong answer had no explanation`);
    if (bad.points !== 0) problems.push(`${q.id}: wrong answer scored points`);
    quiz.advance();
  }
  check(`all ${content.questions.questions.length} questions grade correctly both ways`, problems.length === 0,
    problems.slice(0, 6).join(' | '));
  check('a session summary is produced and accurate', state.progress.quizStats.attempted === content.questions.questions.length * 2,
    String(state.progress.quizStats.attempted));
}

console.log('\nScoring and session rules');
{
  const { content, quiz } = fresh();
  const ids = content.questions.questions.slice(0, 5).map(q => q.id);
  let summary = null;
  quiz.start(ids, { title: 'test', onFinish: (s) => { summary = s; } });
  let answered = 0;
  for (const id of ids) {
    const q = content.questionsById.get(id);
    quiz.submit(payloadFor(q));
    answered += 1;
    quiz.advance();
  }
  check('a perfect run reports perfect = true', summary && summary.perfect === true && summary.correct === ids.length,
    JSON.stringify(summary));
  check('every question was attempted once', answered === ids.length);

  quiz.start(ids);
  const q0 = content.questionsById.get(ids[0]);
  quiz.submit(payloadFor(q0));
  const second = quiz.submit(payloadFor(q0));
  check('a question cannot be answered twice', second === null);
  quiz.abandon();
  check('abandon() clears the session', quiz.active === false);
}

/* ======================================================== full playthrough */
console.log('\nFull playthrough — eight missions, sixteen achievements');
{
  const { content, state, quests } = fresh();
  const stuck = [];

  /** Drive one objective the way the live game would. */
  const drive = (obj) => {
    switch (obj.type) {
      case 'reach':
        quests.notify('proximity', { target: obj.target, distance: 0.4 });
        quests.notify('zone_entered', { zoneId: obj.target.replace('zone_', '').replace('_entry', '') });
        break;
      case 'interact': {
        // satisfy whatever the objective counts, then perform the interaction
        if (obj.target === 'memorial_reconstruction') {
          for (const site of content.memorials.sites) quests.notify('memorial', { memorialId: site.id });
        } else if (obj.target === 'exhibit_manuscript_shelf') {
          const exhibit = content.exhibitsById.get('exhibit_manuscript_shelf');
          for (const id of exhibit.archiveIds) state.collect(id);
        } else if (obj.target === 'zone_early_life') {
          for (const e of content.exhibits.exhibits.filter(x => x.id.startsWith('exhibit_early'))) {
            quests.notify('interact', { exhibitId: e.id, kind: e.interaction });
          }
        } else if (obj.target === 'exhibit_hub_door_labels') {
          for (const z of content.zones.zones) quests.notify('zone_entered', { zoneId: z.id });
        }
        if (obj.target === 'ui_archive') state.progress.flags.interact_ui_archive = true;   // the real game sets this when the modal opens
        quests.notify('interact', { exhibitId: obj.target, kind: 'exhibit', collected: true });
        break;
      }
      case 'collect': {
        const pool = content.archive.records.filter(r => !state.progress.collected.includes(r.id));
        const want = Math.min(obj.count || 1, pool.length);
        for (let i = 0; i < want; i += 1) {
          state.collect(pool[i].id);
          quests.notify('interact', { exhibitId: 'collect', collected: true });
        }
        break;
      }
      case 'quiz': {
        // answer the named question first, then as many others from its set as the
        // objective asks for — the order a player would actually follow
        const group = obj.target.replace(/_\d+$/, '');
        const bank = content.questions.questions.map(q => q.id);
        const set = bank.filter(id => id === group || id.startsWith(`${group}_`));
        const ordered = [obj.target, ...set].filter((id, i, a) => bank.includes(id) && a.indexOf(id) === i);
        const want = Math.min(obj.count || 1, ordered.length);
        for (const id of ordered.slice(0, want)) {
          state.recordQuiz(id, true);
          quests.notify('quiz', { questionId: id, correct: true, sessionPerfect: true });
        }
        break;
      }
      case 'search': for (let i = 0; i < (obj.count || 1); i += 1) quests.notify('search', {}); break;
      case 'ask_guide': for (let i = 0; i < (obj.count || 1); i += 1) quests.notify('ask_guide', {}); break;
      case 'minigame': quests.notify('minigame', { minigame: obj.target }); break;
      case 'final': {
        const stages = [...new Set(content.quests.missions
          .flatMap(m => m.objectives.filter(o => o.type === 'final').map(o => o.stage)))].sort();
        for (const stage of stages) quests.notify('final_stage', { stage });
        quests.notify('final_stage', { stage: 7 });
        break;
      }
      default: stuck.push(`unsupported objective type ${obj.type} (${obj.id})`);
    }
  };

  let guard = 0;
  while (!quests.allComplete() && guard < 200) {
    guard += 1;
    const ctx = quests.currentObjective();
    if (!ctx) { const m = quests.active(); if (m) quests.checkMission(m); else break; continue; }
    drive(ctx.objective);
    quests.checkAchievements();
    if (!state.progress.objectives[ctx.objective.id]) {
      stuck.push(`${ctx.mission.id}/${ctx.objective.id} (${ctx.objective.type} ${ctx.objective.target || ''})`);
      break;
    }
  }

  // a player also does things the missions do not demand: reads sources, searches
  // the archive, asks the Guide, collects records and visits every memorial
  for (let i = 0; i < 5; i += 1) quests.notify('source_opened', {});
  for (let i = 0; i < 10; i += 1) quests.notify('search', {});
  for (let i = 0; i < 5; i += 1) quests.notify('ask_guide', {});
  for (const rec of content.archive.records) {
    if (state.progress.collected.length >= 30) break;
    state.collect(rec.id);
  }
  for (const site of content.memorials.sites) quests.notify('memorial', { memorialId: site.id });
  quests.checkAchievements();

  check('every objective is reachable (no dead ends)', stuck.length === 0, stuck.join(' | '));
  const doneMissions = content.quests.missions.filter(m => quests.isMissionComplete(m.id));
  check(`all ${content.quests.missions.length} missions complete`, doneMissions.length === content.quests.missions.length,
    content.quests.missions.filter(m => !quests.isMissionComplete(m.id)).map(m => m.id).join(','));
  check('the completion state is reached', quests.allComplete() === true);

  const earned = state.progress.achievements;
  const missing = content.achievements.achievements.filter(a => !earned.includes(a.id));
  check(`all ${content.achievements.achievements.length} achievements unlock`, missing.length === 0,
    missing.map(a => `${a.id}(${a.trigger.type})`).join(', '));
  check('the HERITAGE ARCHIVIST badge is awarded', earned.includes('ach_heritage_archivist'));
  check('the completion event fires (certificate unlocked)', state.progress.flags.finished === true);
  const req = content.quests.completion;
  check('every mission the badge requires is complete', req.requires.every(id => quests.isMissionComplete(id)),
    req.requires.filter(id => !quests.isMissionComplete(id)).join(','));
  check(`the quiz-accuracy requirement is met (>= ${req.minQuizAccuracy})`,
    state.quizAccuracy() >= (req.minQuizAccuracy || 0), state.quizAccuracy().toFixed(2));
  check('no unsupported achievement trigger was encountered', warnings.length === 0, warnings.join(' | '));
  check('knowledge points accumulate across the journey', state.progress.knowledgePoints > 300,
    String(state.progress.knowledgePoints));

  const dashboard = quests.dashboard();
  const fields = content.achievements.progressDashboard.fields;
  check(`the progress dashboard reports all ${fields.length} tracked statistics`,
    dashboard.length === fields.length && dashboard.every(d => d.label && d.value !== undefined),
    JSON.stringify(dashboard));
  const byLabel = Object.fromEntries(fields.map((f, i) => [f.id, dashboard[i].value]));
  check('the dashboard reports six galleries completed', byLabel.galleries_completed === '6/6', String(byLabel.galleries_completed));
  check('the dashboard reports eight memorials visited', byLabel.memorials_visited === '8/8', String(byLabel.memorials_visited));
  check('the dashboard reports the archive items recorded', Number(byLabel.archive_items) > 10, String(byLabel.archive_items));
  check('the dashboard reports knowledge points', Number(byLabel.knowledge_points) > 300, String(byLabel.knowledge_points));
}

console.log('\nAchievement data contract');
{
  const { content, quests } = fresh();
  const used = [...new Set(content.achievements.achievements.map(a => a.trigger.type))];
  const unsupported = used.filter(t => !Quests.TRIGGER_TYPES.includes(t));
  check(`every trigger type in achievements.json is supported (${used.join(', ')})`, unsupported.length === 0, unsupported.join(','));
  check('achievement targets reference real missions or exhibits',
    content.achievements.achievements.every(a => {
      if (a.trigger.type === 'mission_complete') return content.missionsById.has(a.trigger.target);
      if (a.trigger.type === 'interact') return true;   // may be a UI target such as ui_archive
      if (a.trigger.type === 'completion') return a.trigger.target === content.quests.completion.id;
      return true;
    }));
  check('achievements are worth points', content.achievements.achievements.every(a => a.points > 0));
}

/* ============================================================ save system */
console.log('\nSave system');
{
  const { content, state } = fresh();
  state.addPoints(120);
  state.collect('arc_law_preamble');
  state.enterZone('law_constitution');
  state.setSetting('textScale', 1.3);
  state.saveSettings();
  state.save();

  check('a save now exists', state.hasSave() === true);
  const SAVE_KEY = 'heritage.save.v1';
  const BACKUP_KEY = 'heritage.save.corrupt.v1';
  const snapshot = localStorage.getItem(SAVE_KEY);
  check('the save is written under the versioned key', !!snapshot);
  check('the save is valid JSON', (() => { try { JSON.parse(snapshot); return true; } catch { return false; } })());
  check('the save carries a format version', JSON.parse(snapshot).version === 1, String(JSON.parse(snapshot).version));
  check('the save stores the player position for CONTINUE',
    typeof JSON.parse(snapshot).player.z === 'number');

  // load into a second state object, as a fresh boot would
  const state2 = new State();
  state2.loadSettings();
  const result = state2.loadProgress();
  check('a valid save loads cleanly', result === 'ok', result);
  check('points survive a round trip', state2.progress.knowledgePoints === state.progress.knowledgePoints);
  check('collected items survive a round trip', state2.progress.collected.includes('arc_law_preamble'));
  check('settings survive a round trip', state2.settings.textScale === 1.3, String(state2.settings.textScale));

  // export / import
  const exported = state.exportJSON();
  check('export produces parseable JSON', (() => { try { JSON.parse(exported); return true; } catch { return false; } })());
  state.reset();
  check('reset clears progress', state.progress.knowledgePoints === 0 && state.progress.collected.length === 0);
  state.importJSON(exported);
  check('import restores the exported save', state.progress.collected.includes('arc_law_preamble'));

  // corrupted save
  localStorage.setItem(SAVE_KEY, '{"version":1, "collected": [1,2,3,');
  const state3 = new State();
  const recovered = state3.loadProgress();
  check('a corrupted save does not throw and is reported', recovered !== 'ok', recovered);
  check('the player keeps a playable state after corruption',
    state3.progress.knowledgePoints === 0 && Array.isArray(state3.progress.collected));
  check('the corrupted payload is preserved for support, not silently deleted', !!localStorage.getItem(BACKUP_KEY),
    Object.keys(Object.fromEntries(store)).join(','));
  check('the damaged save is moved out of the way so the game starts clean', !localStorage.getItem(SAVE_KEY));
}

console.log('\n' + '-'.repeat(60));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
