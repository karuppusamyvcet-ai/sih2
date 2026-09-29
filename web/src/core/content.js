/* ==========================================================================
   content.js — the archive itself.
   Loads the single source of truth (content/*.json, identical to the files the
   Unity project reads from Assets/Resources/Content), builds the search index,
   and implements the retrieval layer used by the Archive Guide.

   Design rule enforced here, not just documented: the Guide answers only from
   retrieved archive passages and always returns the list of records it used.
   If nothing is retrieved it says so. There is no generative fallback.
   ========================================================================== */

const FILES = [
  'archive', 'timeline', 'zones', 'questions', 'museum', 'quests',
  'achievements', 'memorials', 'glossary', 'guide', 'localization',
  'exhibits', 'character_spec'
];

export class Content {
  constructor(bundle, locale = 'en') {
    Object.assign(this, bundle);
    this.locale = locale;
    this.recordsById = new Map(this.archive.records.map(r => [r.id, r]));
    this.eventsById = new Map(this.timeline.events.map(e => [e.id, e]));
    this.conceptsById = new Map(this.glossary.concepts.map(c => [c.id, c]));
    this.questionsById = new Map(this.questions.questions.map(q => [q.id, q]));
    this.missionsById = new Map(this.quests.missions.map(m => [m.id, m]));
    this.achievementsById = new Map(this.achievements.achievements.map(a => [a.id, a]));
    this.memorialsById = new Map(this.memorials.sites.map(s => [s.id, s]));
    this.zonesById = new Map(this.zones.zones.map(z => [z.id, z]));
    this.exhibitsById = new Map(this.exhibits.exhibits.map(e => [e.id, e]));
    this.categories = [...new Set(this.archive.records.map(r => r.category))].sort();
    this.buildIndex();
  }

  static async load(base = './content/', locale = 'en', onProgress = () => {}) {
    const bundle = {};
    let done = 0;
    for (const name of FILES) {
      try {
        const res = await fetch(`${base}${name}.json`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        bundle[name] = await res.json();
      } catch (err) {
        // A missing optional content file must never break the game.
        console.warn(`[content] ${name}.json unavailable (${err.message}) — using an empty stub.`);
        bundle[name] = Content.stub(name);
      }
      done += 1;
      onProgress(done / FILES.length, name);
    }
    // the character file is named character_spec.json (shared verbatim with Unity)
    bundle.character = bundle.character_spec || Content.stub('character');
    return new Content(bundle, locale);
  }

  static stub(name) {
    const shapes = {
      archive: { schema: 'heritage.archive.v1', records: [] },
      timeline: { schema: 'heritage.timeline.v1', events: [] },
      zones: { schema: 'heritage.zones.v1', zones: [] },
      questions: { schema: 'heritage.questions.v1', questions: [], defaultPoints: 10 },
      museum: { schema: 'heritage.museum.v1', hall: {}, doors: [], setDressing: [], lighting: {} },
      quests: { schema: 'heritage.quests.v1', missions: [], completion: {} },
      achievements: { schema: 'heritage.achievements.v1', achievements: [] },
      memorials: { schema: 'heritage.memorials.v1', sites: [] },
      glossary: { schema: 'heritage.glossary.v1', concepts: [] },
      guide: { schema: 'heritage.guide.v1', messages: {}, suggestedQuestions: [], architecture: { synonyms: {}, retrieval: {} } },
      localization: { schema: 'heritage.localization.v1', locales: [{ code: 'en', name: 'English', status: 'complete' }], strings: { en: {} } },
      exhibits: { schema: 'heritage.exhibits.v1', rooms: {}, exhibits: [], interactionKinds: [] },
      character: { schema: 'heritage.character.v1', proportions: {}, materials: {}, clothing: {} }
    };
    return JSON.parse(JSON.stringify(shapes[name] || { schema: `empty.${name}` }));
  }

  // ---------------------------------------------------------------- index
  buildIndex() {
    const weights = this.guide?.architecture?.retrieval?.weights || {};
    this.docs = [];
    const add = (kind, id, obj, fields, extra = {}) => {
      const title = fields.title || fields.term || fields.name || '';
      const tokens = {};
      for (const [field, weight] of Object.entries(fields)) {
        const w = weights[field] ?? 1.0;
        for (const tok of Content.tokenize(String(Array.isArray(weight) ? weight.join(' ') : weight))) {
          // strongest field a term appears in wins, so a record that merely
          // repeats a common word many times cannot outrank a precise match
          tokens[tok] = Math.max(tokens[tok] || 0, w);
        }
      }
      // a term in the title is the strongest possible signal about what a
      // record is *about*, as opposed to what it merely mentions
      const titleTokens = new Set(Content.tokenize(String(title)));
      this.docs.push({ kind, id, obj, title, tokens, titleTokens, text: fields, ...extra });
    };

    for (const rec of this.archive.records) {
      add('archive', rec.id, rec, {
        title: rec.title, keywords: rec.keywords || [], description: rec.description,
        significance: rec.significance || '', category: rec.category, zone: rec.zone
      }, { record: rec });
    }
    for (const c of this.glossary.concepts) {
      add('concept', c.id, c, {
        term: c.term, shortDef: c.shortDef, longDef: c.longDef || '',
        keywords: c.keywords || [], zone: c.zone
      }, { concept: c });
    }
    for (const s of this.memorials.sites) {
      add('memorial', s.id, s, {
        title: s.name, tags: s.tags || [], description: s.narration,
        city: s.city, state: s.state || '', zone: 'memorials'
      }, { site: s });
    }
    for (const ev of this.timeline.events) {
      add('event', ev.id, ev, { title: ev.title, description: ev.title, zone: ev.zone }, { event: ev });
    }
    for (const z of this.zones.zones) {
      add('zone', z.id, z, { title: z.name, description: z.description, subtitle: z.subtitle || '' }, { zone: z });
    }
  }

  static tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[’'`]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !Content.STOP.has(t))
      .map(t => (t.endsWith('ies') ? t.slice(0, -3) + 'y' : t.endsWith('s') && t.length > 4 ? t.slice(0, -1) : t));
  }

  expand(query) {
    const base = Content.tokenize(query);
    const syn = this.guide?.architecture?.synonyms || {};
    const out = [...base];
    for (const t of base) {
      for (const [key, list] of Object.entries(syn)) {
        if (t === key || (list || []).includes(t)) {
          out.push(key, ...Content.tokenize((list || []).join(' ')));
        }
      }
    }
    return [...new Set(out)];
  }

  // --------------------------------------------------------------- search
  /**
   * Inverse-document-frequency multiplier.
   *
   * Without it a query for "preamble" is answered by whichever record happens
   * to repeat the word "constitution" most often. Bounded to roughly 1.2–2.1 so
   * the hand-tuned field weights in guide.json keep their meaning.
   */
  idf(token) {
    if (!this._df) {
      this._df = new Map();
      for (const doc of this.docs) {
        for (const tok of Object.keys(doc.tokens)) this._df.set(tok, (this._df.get(tok) || 0) + 1);
      }
    }
    const df = this._df.get(token) || 0;
    if (!df) return 1;
    return 1 + Math.log(1 + this.docs.length / df) / 4;
  }

  /** Weighted score of one query term against one document. */
  termScore(doc, term) {
    let score = 0;
    for (const [tok, weight] of Object.entries(doc.tokens)) {
      const w = weight * this.idf(tok);
      if (tok === term) score += w;
      else if (term.length > 3 && tok.startsWith(term)) score += w * 0.5;
      else if (tok.length > 3 && term.startsWith(tok)) score += w * 0.35;
    }
    if (score > 0 && doc.titleTokens) {
      for (const tok of doc.titleTokens) {
        if (tok === term || (term.length > 3 && tok.startsWith(term))) { score *= 1.4; break; }
      }
    }
    return score;
  }

  /**
   * Split a query into the terms the user actually typed and the synonyms the
   * guide may add. Synonyms that are just morphological variants of a typed
   * term are dropped so they cannot be counted twice.
   */
  queryTerms(query) {
    const base = Content.tokenize(query);
    const syn = this.expand(query).filter(t =>
      !base.includes(t) && !base.some(b => b.length > 3 && (t.startsWith(b) || b.startsWith(t))));
    return { base, syn };
  }

  /** Ranked local search — no network required, no server involved. */
  search(query, opts = {}) {
    const { zone = null, category = null, kinds = null, collected = null, limit = 60 } = opts;
    const { base, syn } = this.queryTerms(query);
    const scored = [];
    for (const doc of this.docs) {
      if (zone && doc.text.zone !== zone) continue;
      if (category && doc.record?.category !== category && doc.kind === 'archive') continue;
      if (kinds && !kinds.includes(doc.kind)) continue;
      if (collected && doc.kind === 'archive' && !collected.has(doc.id)) continue;
      let score = 0;
      let matched = 0;
      for (const term of base) {
        const t = this.termScore(doc, term);
        if (t > 0) matched += 1;
        score += t;
      }
      if (matched && base.length > 1) score *= 1 + 0.5 * (matched / base.length);
      // guide synonyms support a match, they never drive it: a document that
      // matches only a synonym is kept, but always ranked below one that
      // matches a term the player actually typed
      let synonym = 0;
      for (const term of syn) synonym += this.termScore(doc, term);
      score += 0.22 * synonym;
      // long records must not win on sheer size alone
      const tokenCount = Object.keys(doc.tokens).length;
      if (score > 0) score /= 1 + Math.log(1 + tokenCount / 50) / 4;
      if (!base.length && !syn.length) score = doc.kind === 'archive' ? 0.4 : 0;
      if (score > 0) scored.push({ doc, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => ({ ...s.doc, score: s.score }));
  }

  // ------------------------------------------------- Archive Guide layer
  retrieve(question, topK = null) {
    const k = topK || this.guide?.architecture?.retrieval?.topK || 4;
    const min = this.guide?.architecture?.retrieval?.minScore ?? 2.2;
    // only records that can be cited may answer a question; zone cards are
    // navigation aids, so the guided pointers cover them instead
    return this.search(question, { limit: k * 2, kinds: ['archive', 'concept', 'memorial', 'event'] })
      .filter(r => r.score >= min)
      .slice(0, k);
  }

  /** The citation string the player sees for a retrieved passage. */
  sourceOf(hit) {
    if (hit.kind === 'concept') return hit.concept?.source || 'Glossary of constitutional terms';
    if (hit.kind === 'memorial') {
      const rec = this.recordsById.get(hit.site?.archiveId);
      return rec?.source || hit.site?.source || 'Memorials register';
    }
    if (hit.kind === 'event') {
      const rec = this.recordsById.get(hit.event?.archiveId);
      return rec?.source || 'Timeline of events';
    }
    return hit.record?.source || 'Archive record';
  }

  /** Compose an answer strictly from retrieved passages. */
  answer(question, { offline = false } = {}) {
    const hits = this.retrieve(question);
    if (!hits.length) {
      const topics = this.zones.zones.map(z => z.shortName || z.name).slice(0, 6).join(', ');
      return {
        text: (this.guide.messages.noResults || 'The archive does not cover that.').replace('{topics}', topics),
        sources: [], noResults: true, offline
      };
    }

    const lead = hits[0];
    const sentences = [];
    const pick = (text) => (text || '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

    if (lead.kind === 'concept') {
      sentences.push(pick(lead.text.shortDef)[0] || '');
      const long = pick(lead.text.longDef);
      if (long[0]) sentences.push(long[0]);
    } else if (lead.kind === 'memorial') {
      sentences.push(pick(lead.text.description)[0] || '');
    } else {
      const d = pick(lead.text.description);
      if (d[0]) sentences.push(d[0]);
      if (d[1] && sentences.length < 3) sentences.push(d[1]);
      const sig = pick(lead.text.significance);
      if (sig[0] && sentences.length < 4) sentences.push(sig[0]);
    }

    for (const hit of hits.slice(1)) {
      if (sentences.length >= (this.guide.architecture.answerPolicy.maxSentences || 5)) break;
      const src = hit.kind === 'concept' ? hit.text.shortDef : hit.text.description;
      const s = pick(src)[0];
      if (s && !sentences.includes(s)) sentences.push(s);
    }

    let text = sentences.filter(Boolean).join(' ');
    const confidentAt = this.guide?.architecture?.retrieval?.lowConfidenceAt ?? 6;
    if (hits[0].score < confidentAt && this.guide.messages.lowConfidence) {
      text = this.guide.messages.lowConfidence + ' ' + text;
    }
    const hasRecon = hits.some(h => (h.record?.media || []).some(m => m.isReconstruction));
    if (hasRecon) text += ' ' + (this.guide.messages.reconstructionWarning || '');

    const pointer = (this.guide.guidedPointers || []).find(p => hits.some(h => (h.obj.zone || '') === p.topic));
    if (pointer) text += ` Where to find it: ${pointer.route}`;

    return {
      text: text.trim(),
      sources: hits.map(h => ({
        id: h.id,
        kind: h.kind,
        title: h.title,
        source: this.sourceOf(h),
        archiveId: h.record?.id || h.concept?.archiveIds?.[0] || h.site?.archiveId
          || h.event?.archiveId || h.id
      })),
      noResults: false,
      offline
    };
  }

  // ---------------------------------------------------------- localization
  get locales() { return this.localization.locales; }

  setLocale(code) { this.locale = code; }

  /** Translate a UI key with fallback to the default locale, then to the key. */
  t(key, vars = {}) {
    const tables = this.localization.strings || {};
    const def = this.localization.defaultLocale || 'en';
    let str = tables[this.locale]?.[key] ?? tables[def]?.[key] ?? key;
    for (const [k, v] of Object.entries(vars)) str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    return str;
  }

  localeStatus(code) {
    return this.locales.find(l => l.code === code) || null;
  }
}

Content.STOP = new Set(('a an the and or of in on to for with from by is are was were be been being it its this that these those as at into about than then them they he she his her their our your you we what which who whom how why when where can could should would will shall may might must not no yes do does did done have has had there here also more most other such only own same so too very s t just don now').split(' '));
