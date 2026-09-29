#!/usr/bin/env node
/**
 * Content-engine tests: search, the Archive Guide retrieval, and localization.
 *
 * These are the parts of the product a judge will poke at hardest — "does the
 * AI make things up?" — so they are covered by tests that run in CI without a
 * browser or a network connection.
 *
 * Usage:  node web/tools/test_content.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const WEB = path.resolve(__dirname, '..');
const files = ['archive', 'timeline', 'zones', 'questions', 'museum', 'quests',
  'achievements', 'memorials', 'glossary', 'guide', 'localization', 'exhibits', 'character_spec'];

const bundle = {};
for (const f of files) bundle[f] = JSON.parse(fs.readFileSync(path.join(WEB, 'content', `${f}.json`), 'utf8'));

/* Import the Content class by evaluating the module without a bundler. */
const source = fs.readFileSync(path.join(WEB, 'src', 'core', 'content.js'), 'utf8');
const moduleShim = { exports: {} };
const fn = new Function('exports', 'module', `${source.replace(/export class Content/, 'class Content')}\nexports.Content = Content;`);
fn(moduleShim.exports, moduleShim);
const { Content } = moduleShim.exports;

const content = new Content(bundle, 'en');

let pass = 0, fail = 0;
const check = (name, condition, detail = '') => {
  if (condition) { pass += 1; console.log(`  ok   ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name} ${detail}`); }
};

console.log('Archive Guide and search');
const hits = content.search('constitution', { limit: 12 });
check('search("constitution") returns results', hits.length >= 3, `got ${hits.length}`);
check('search("preamble") returns the Preamble record',
  content.search('preamble', { limit: 10 }).some(h => h.id === 'arc_law_preamble'));
check('search("constitution") reaches the constitutional gallery records',
  hits.some(h => (h.record?.zone || h.text?.zone) === 'law_constitution'));

const a32 = content.answer('What does Article 32 do?');
check('answer() is not empty', a32.text.length > 40);
check('answer() cites at least one record', a32.sources.length >= 1);
check('answer() cites the Article 32 record', a32.sources.some(s => s.archiveId === 'arc_law_article32'),
  JSON.stringify(a32.sources.map(s => s.archiveId)));
check('every citation carries a source string', a32.sources.every(s => s.source && s.source.length > 3));

const mahad = content.answer('What happened at Mahad in 1927?');
check('Mahad question retrieves the Mahad record', mahad.sources.some(s => s.archiveId === 'arc_social_mahad_1927'));

const unknown = content.answer('Who won the 1983 cricket world cup final?');
check('off-topic question returns no results instead of inventing an answer', unknown.noResults === true);
check('off-topic answer names the refusal message', /does not cover|rather tell you/i.test(unknown.text));

const memorialQ = content.answer('Which memorials are in the archive?');
check('memorial question retrieves records from the memorials gallery',
  memorialQ.sources.some(s => {
    const rec = content.recordsById.get(s.archiveId);
    return s.kind === 'memorial' || rec?.zone === 'memorials';
  }));

const glossaryQ = content.answer('What is constitutional morality?');
check('concept question retrieves the glossary entry', glossaryQ.sources.some(s => s.id === 'con_constitutional_morality'));

console.log('\nReconstruction labelling');
const reconRecords = content.archive.records.filter(r => (r.media || []).some(m => m.isReconstruction));
check('every generated media item carries a note',
  reconRecords.every(r => r.media.filter(m => m.isReconstruction).every(m => !!m.note)));
check('every record carries a citation', content.archive.records.every(r => (r.source || '').trim().length > 3));
check('some records are genuinely attachable public-domain items',
  content.archive.records.some(r => (r.media || []).some(m => m.isReconstruction === false)));

console.log('\nLocalization');
check('English is complete', content.localeStatus('en').status === 'complete');
check('fallback returns English for a missing Tamil key', content.t('quiz.finish') === bundle.localization.strings.en['quiz.finish']);
content.setLocale('ta');
check('Tamil override applies where present', content.t('app.subtitle') === bundle.localization.strings.ta['app.subtitle']);
check('untranslated keys fall back to English rather than showing the key',
  content.t('settings.vsync') === bundle.localization.strings.en['settings.vsync']);
content.setLocale('en');

console.log('\nQuest data');
const objectives = content.quests.missions.flatMap(m => m.objectives);
check('eight missions are defined', content.quests.missions.length === 8);
check('every mission has at least three objectives', content.quests.missions.every(m => m.objectives.length >= 3));
check('objective ids are unique', new Set(objectives.map(o => o.id)).size === objectives.length);
check('completion badge requires all eight missions', content.quests.completion.requires.length === 8);

console.log('\nExhibit wiring');
const exhibitQuizRefs = content.exhibits.exhibits.flatMap(e => e.quizIds || []);
check('exhibit quiz ids all resolve', exhibitQuizRefs.every(id => content.questionsById.has(id)));
const exhibitArchiveRefs = content.exhibits.exhibits.flatMap(e => e.archiveIds || []);
check('exhibit archive ids all resolve', exhibitArchiveRefs.every(id => content.recordsById.has(id)));
check('every exhibit in a gallery has a label and an interaction kind',
  content.exhibits.exhibits.every(e => e.label && e.interaction));

console.log('\nTimeline and memorials');
check('timeline is chronological',
  content.timeline.events.every((e, i, arr) => i === 0 || arr[i - 1].year <= e.year));
check('eight memorial sites exist', content.memorials.sites.length === 8);
check('every memorial has a guided tour', content.memorials.sites.every(s => (s.tour || []).length >= 3));
check('every memorial names its archive record', content.memorials.sites.every(s => content.recordsById.has(s.archiveId)));

console.log('\n' + '-'.repeat(60));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
