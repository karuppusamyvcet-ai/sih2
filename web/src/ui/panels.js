/* ==========================================================================
   panels.js — every screen the player opens.

   Archive · document viewer · quiz · Archive Guide · museum map · memorial
   list · objectives · settings · credits · completion certificate · pause.

   All text that is chrome comes from localization.json through content.t();
   all text that is history comes from the archive record, verbatim, with its
   citation printed underneath it. That separation is deliberate: the interface
   can be translated, the source material must not be paraphrased by us.
   ========================================================================== */

const $ = (id) => document.getElementById(id);

export class Panels {
  constructor(ctx) {
    Object.assign(this, ctx);           // content, state, quests, quiz, audio, hud, world, player, game
    this.current = null;
    this.filters = { text: '', category: 'ALL', zone: 'ALL' };
    this.selectedRecord = null;
    this.viewerState = null;
    this.magnified = false;
    this.bindStatic();
    this.buildSettings();
    this.buildCredits();
    this.applyI18n();
  }

  /* ------------------------------------------------------------ plumbing */
  open(name) {
    const el = $(`modal-${name}`);
    if (!el) return;
    document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    el.classList.add('open');
    this.current = name;
    document.body.classList.add('ui-open');
    this.audio?.ui('open');
    this.game?.releasePointer();
  }

  close(name = null) {
    const target = name || this.current;
    if (target) $(`modal-${target}`)?.classList.remove('open');
    if (!document.querySelector('.modal.open')) {
      this.current = null;
      document.body.classList.remove('ui-open');
      this.game?.capturePointer();
    }
    this.audio?.ui('close');
  }

  closeAll() { document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')); this.current = null; document.body.classList.remove('ui-open'); }

  get isOpen() { return !!document.querySelector('.modal.open'); }

  bindStatic() {
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => this.close(btn.dataset.close));
    });
    document.querySelectorAll('[data-pause]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.pause;
        if (action === 'mainmenu') { this.close('pause'); this.game.toMainMenu(); return; }
        if (action === 'restart') { this.close('pause'); this.game.restartCheckpoint(); return; }
        if (action === 'archive') this.openArchive();
        if (action === 'map') this.openMap();
        if (action === 'objectives') this.openObjectives();
        if (action === 'settings') this.openSettings();
      });
    });
    $('cert-print')?.addEventListener('click', () => window.print());

    // archive search + filters
    $('archive-search')?.addEventListener('input', (e) => {
      this.filters.text = e.target.value.trim();
      this.renderArchive();
    });
    this.buildFilters();
  }

  applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      const text = this.content.t(key);
      if (text !== key) el.textContent = text;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.placeholder = this.content.t(el.dataset.i18nPh);
    });
  }

  applySettingsToDom() {
    const s = this.state.settings;
    document.body.classList.toggle('contrast', s.contrast);
    document.documentElement.style.setProperty('--text-scale', String(s.textScale));
    const minimap = $('minimap');
    if (minimap) minimap.classList.toggle('hidden', !s.showMinimap);
  }

  /* ------------------------------------------------------------- ARCHIVE */
  buildFilters() {
    const box = $('archive-filters');
    if (!box) return;
    box.innerHTML = '';
    const mk = (label, value, group) => {
      const b = document.createElement('button');
      b.className = `chip${((group === 'category' ? this.filters.category : this.filters.zone) === value ? ' on' : '')}`;
      b.textContent = label;
      b.addEventListener('click', () => {
        if (group === 'category') this.filters.category = value; else this.filters.zone = value;
        this.buildFilters();
        this.renderArchive();
      });
      box.appendChild(b);
    };
    mk(this.content.t('archive.all'), 'ALL', 'category');
    this.content.categories.forEach(c => mk(c, c, 'category'));
    mk('—', 'ALL', 'zone');
    this.content.zones.zones.forEach(z => mk(z.shortName || z.name, z.id, 'zone'));
    const collected = document.createElement('button');
    collected.className = 'chip';
    collected.textContent = this.content.t('archive.collected');
    collected.addEventListener('click', () => { this.onlyCollected = !this.onlyCollected; this.renderArchive(); });
    box.appendChild(collected);
  }

  openArchive() {
    this.open('archive');
    this.renderArchive();
  }

  renderArchive() {
    const list = $('archive-list');
    const status = $('archive-status');
    if (!list) return;
    const collected = new Set(this.state.progress.collected);
    let docs;
    if (this.filters.text) {
      docs = this.content.search(this.filters.text, {
        zone: this.filters.zone === 'ALL' ? null : this.filters.zone,
        category: this.filters.category === 'ALL' ? null : this.filters.category,
        kinds: ['archive', 'concept', 'memorial', 'event'],
        limit: 80
      });
      this.quests?.notify('search');
    } else {
      docs = this.content.archive.records
        .filter(r => (this.filters.zone === 'ALL' || r.zone === this.filters.zone))
        .filter(r => (this.filters.category === 'ALL' || r.category === this.filters.category))
        .filter(r => (!this.onlyCollected || collected.has(r.id)))
        .map(r => ({ kind: 'archive', id: r.id, title: r.title, record: r, text: r }));
    }
    list.innerHTML = '';
    if (!docs.length) {
      list.innerHTML = `<p class="empty" style="padding:1rem">${this.content.t('archive.noResults')}</p>`;
    }
    docs.forEach((doc) => {
      const rec = doc.record || doc;
      const div = document.createElement('div');
      div.className = 'rec';
      const tag = collected.has(rec.id) ? '✓ recorded · ' : '';
      div.innerHTML = `<h4>${doc.title}</h4>
        <p><span class="tag">${tag}${rec.category || doc.kind}</span>${(rec.date || '').toString().slice(0, 10)} · ${rec.location || ''}</p>`;
      div.addEventListener('click', () => {
        list.querySelectorAll('.rec').forEach(r => r.classList.remove('on'));
        div.classList.add('on');
        this.showRecord(rec);
      });
      list.appendChild(div);
    });
    if (status) {
      status.textContent = this.content.t('archive.results', { count: docs.length })
        + ` · ${this.state.progress.collected.length}/${this.content.archive.records.length} recorded in your archive`;
    }
  }

  showRecord(rec) {
    const panel = $('archive-detail');
    if (!panel) return;
    this.selectedRecord = rec;
    const collected = this.state.progress.collected.includes(rec.id);
    const related = (rec.related || []).map(id => this.content.recordsById.get(id)).filter(Boolean);
    panel.innerHTML = `
      <h3>${rec.title}</h3>
      <div class="meta">
        <span>${rec.category}</span><span>${rec.zone}</span>
        <span>${(rec.date || '').toString().slice(0, 10)}</span>
        <span>${rec.location || ''}</span>
        ${rec.period ? `<span>${rec.period}</span>` : ''}
      </div>
      <p>${rec.description}</p>
      ${rec.significance ? `<p class="sig">${rec.significance}</p>` : ''}
      <div class="media">${(rec.media || []).map((m, i) =>
        `<span class="media-pill${m.isReconstruction ? ' recon' : ''}" data-media="${i}">${m.type} · ${m.label}</span>`).join('')}</div>
      <div class="source"><b>${this.content.t('archive.source')}:</b> ${rec.source}<br>
        <span style="color:var(--cream-dim)">${rec.reviewStatus === 'platform-example'
          ? 'Platform documentation record.' : 'Editorial review required before public exhibition.'}</span></div>
      ${related.length ? `<div class="source"><b>${this.content.t('archive.related')}:</b> ${related.map(r => r.title).join(' · ')}</div>` : ''}
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.9rem">
        <button class="btn btn-primary" id="rec-view">${this.content.t('viewer.metadata')} / OPEN</button>
        <button class="btn" id="rec-collect" ${collected ? 'disabled' : ''}>${collected ? this.content.t('archive.recorded') : this.content.t('archive.addToArchive')}</button>
        <button class="btn btn-ghost" id="rec-source">${this.content.t('archive.openSource')}</button>
      </div>`;
    $('rec-view')?.addEventListener('click', () => this.openViewer(rec));
    $('rec-collect')?.addEventListener('click', () => {
      this.game.collect(rec.id);
      this.showRecord(rec);
    });
    $('rec-source')?.addEventListener('click', () => {
      this.quests?.notify('source_opened');
      this.hud.toast(`Source — ${rec.source}`);
    });
    panel.querySelectorAll('.media-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const media = rec.media[Number(pill.dataset.media)];
        this.playMedia(rec, media);
      });
    });
  }

  playMedia(rec, media) {
    if (!media) return;
    if (media.type === 'text' || media.type === 'document') { this.openViewer(rec); return; }
    if (media.type === 'audio') {
      this.audio.exhibitChime();
      const line = `${rec.title}. ${media.label}. ${media.isReconstruction ? 'This is a digital reconstruction, not an original recording.' : ''}`;
      this.audio.narrate(line, { onSubtitle: (t) => this.hud.subtitle(t) });
      this.hud.toast(`${media.label} — ${media.isReconstruction ? 'digital reconstruction' : 'institutional holding'}`);
      return;
    }
    if (media.type === 'image' || media.type === 'video' || media.type === 'model') {
      this.openViewer(rec, { startAt: media, forceRecon: media.isReconstruction });
      return;
    }
    this.hud.toast(this.content.t('error.unsupported'), 'warn');
  }

  /* ------------------------------------------------------- DOCUMENT VIEWER */
  openViewer(rec, { startAt = null, forceRecon = false } = {}) {
    this.open('viewer');
    $('viewer-title').textContent = rec.title;
    const pages = this.pagesFor(rec);
    this.viewerState = { rec, pages, page: 0, startAt, forceRecon };
    this.renderViewer();
  }

  /** A record becomes a small paginated document: summary, context, media, citation. */
  pagesFor(rec) {
    const pages = [];
    pages.push({
      heading: rec.title,
      body: rec.description,
      note: rec.isReconstruction ? 'Digital Reconstruction' : ''
    });
    if (rec.significance) pages.push({ heading: 'Why it matters in this archive', body: rec.significance });
    (rec.media || []).forEach((m) => {
      pages.push({
        heading: `${m.type.toUpperCase()} — ${m.label}`,
        body: m.isReconstruction
          ? 'Generated for this platform and labelled as a reconstruction. It is not an authentic photograph, recording or document. Where the institution holds a genuine item, the file is attached through the content-import system and this flag is set to false.'
          : 'Institutional holding. The file is attached from the institution\'s own copy through the content-import system.',
        note: m.isReconstruction ? 'Digital Reconstruction' : 'Institutional holding',
        flag: m.isReconstruction
      });
    });
    pages.push({ heading: 'Citation', body: rec.source, isSource: true });
    return pages;
  }

  renderViewer() {
    const vs = this.viewerState;
    if (!vs) return;
    const page = vs.pages[vs.page];
    const sheet = $('page-sheet');
    if (sheet) {
      sheet.innerHTML = `${page.flag ? '<div class="watermark">RECONSTRUCTION</div>' : ''}
        <h4>${page.heading}</h4>
        <div style="white-space:pre-wrap">${page.body}</div>
        <span class="page-num">${vs.page + 1} / ${vs.pages.length}</span>`;
      sheet.style.transform = this.magnified ? 'scale(1.14)' : '';
    }
    $('viewer-pager').textContent = this.content.t('viewer.page', { page: vs.page + 1, total: vs.pages.length });
    $('viewer-flag').textContent = page.isSource ? 'Citation' : page.note || '';
    const flags = (vs.rec.media || []).filter(m => m.isReconstruction).length;
    $('viewer-meta').innerHTML = `
      <dl>
        <dt>Record</dt><dd>${vs.rec.id}</dd>
        <dt>Category</dt><dd>${vs.rec.category}</dd>
        <dt>Gallery</dt><dd>${vs.rec.zone}</dd>
        <dt>Period</dt><dd>${vs.rec.period || '—'}</dd>
        <dt>Date</dt><dd>${(vs.rec.date || '').toString().slice(0, 10)}</dd>
        <dt>Location</dt><dd>${vs.rec.location || '—'}</dd>
        <dt>Author</dt><dd>${vs.rec.author || '—'}</dd>
        <dt>Keywords</dt><dd>${(vs.rec.keywords || []).join(', ')}</dd>
        <dt>Provenance</dt><dd>${vs.rec.reviewStatus === 'platform-example' ? 'Platform documentation' : 'Institution record · editorial review required'}</dd>
        <dt>Rights</dt><dd>${flags ? `${flags} generated item(s), labelled as reconstructions` : 'No generated media on this record'}</dd>
        <dt>Transcription</dt><dd>${vs.pages.length} pages in this viewer</dd>
        <dt>Source</dt><dd>${vs.rec.source}</dd>
      </dl>`;
    this.game.noteViewerOpen(vs.rec);
  }

  viewerStep(delta) {
    const vs = this.viewerState;
    if (!vs) return;
    const next = Math.max(0, Math.min(vs.pages.length - 1, vs.page + delta));
    if (next === vs.page) return;
    const sheet = $('page-sheet');
    sheet?.classList.add('turning');
    this.audio?.ui('page');
    setTimeout(() => {
      vs.page = next;
      sheet?.classList.remove('turning');
      this.renderViewer();
    }, 190);
  }

  /* ---------------------------------------------------------------- QUIZ */
  startQuiz(ids, opts = {}) {
    const session = this.quiz.start(ids, {
      ...opts,
      onFinish: (summary) => {
        this.renderQuizSummary(summary);
        opts.onFinish?.(summary);
      }
    });
    if (!session || !session.questions.length) {
      this.hud.toast('No questions available for this exhibit.', 'warn');
      return null;
    }
    $('quiz-title').textContent = opts.title || 'Knowledge check';
    this.open('quiz');
    this.renderQuiz();
    this.game.player.playClip('Think', 2.2);
    return session;
  }

  renderQuiz() {
    const q = this.quiz.question;
    if (!q) return;
    this.pendingAnswer = null;
    $('quiz-counter').textContent = this.content.t('quiz.question', { n: this.quiz.number, total: this.quiz.total });
    $('quiz-prompt').textContent = q.prompt;
    $('quiz-progress-bar').style.width = `${((this.quiz.number - 1) / this.quiz.total) * 100}%`;
    $('quiz-score').textContent = `${this.content.t('quiz.score')}: ${this.quiz.session.correct}/${this.quiz.session.attempted}`;
    $('quiz-feedback').className = 'quiz-feedback';
    $('quiz-feedback').innerHTML = '';
    $('quiz-next').disabled = true;
    $('quiz-next').textContent = this.quiz.number === this.quiz.total ? this.content.t('quiz.finish') : this.content.t('quiz.next');

    const imageBox = $('quiz-image');
    imageBox.innerHTML = '';
    if (q.type === 'image_identification') {
      // a generated illustration, labelled as such in the question text itself
      const panel = document.createElement('div');
      panel.className = 'gen-panel';
      panel.innerHTML = `${q.imageLabel || 'Digital Reconstruction'}
        <span class="flag">Generated diagram — never presented as an authentic document.</span>`;
      imageBox.appendChild(panel);
    }

    const box = $('quiz-options');
    box.innerHTML = '';
    box.className = 'quiz-options';

    if (q.type === 'multiple_choice' || q.type === 'image_identification') {
      q.options.forEach((opt) => {
        const b = document.createElement('button');
        b.className = 'btn quiz-opt';
        b.textContent = opt.text;
        b.addEventListener('click', () => this.answer({ choice: opt.id }, b));
        box.appendChild(b);
      });
    } else if (q.type === 'true_false') {
      [['True', true], ['False', false]].forEach(([label, val]) => {
        const b = document.createElement('button');
        b.className = 'btn quiz-opt';
        b.textContent = label;
        b.addEventListener('click', () => this.answer({ bool: val }, b));
        box.appendChild(b);
      });
    } else if (q.type === 'ordering') {
      box.className = 'quiz-order';
      this.order = q.items.map(i => i.id);
      const render = () => {
        box.innerHTML = '';
        this.order.forEach((id, i) => {
          const item = q.items.find(x => x.id === id);
          const row = document.createElement('div');
          row.className = 'ord';
          row.innerHTML = `<span class="n">${i + 1}</span><span>${item.text}</span>`;
          row.draggable = true;
          row.addEventListener('dragstart', () => { this.dragId = id; });
          row.addEventListener('dragover', (e) => e.preventDefault());
          row.addEventListener('drop', () => {
            if (!this.dragId || this.dragId === id) return;
            const from = this.order.indexOf(this.dragId);
            const to = this.order.indexOf(id);
            this.order.splice(from, 1);
            this.order.splice(to, 0, this.dragId);
            this.audio?.ui('click');
            render();
          });
          const up = document.createElement('button');
          up.className = 'hud-btn'; up.textContent = '▲';
          up.addEventListener('click', (e) => { e.stopPropagation(); this.moveOrder(i, -1); render(); });
          const down = document.createElement('button');
          down.className = 'hud-btn'; down.textContent = '▼';
          down.addEventListener('click', (e) => { e.stopPropagation(); this.moveOrder(i, 1); render(); });
          row.appendChild(up); row.appendChild(down);
          box.appendChild(row);
        });
        const submit = document.createElement('button');
        submit.className = 'btn btn-primary';
        submit.textContent = 'CHECK ORDER';
        submit.style.marginTop = '0.5rem';
        submit.addEventListener('click', () => this.answer({ order: [...this.order] }, submit));
        box.appendChild(submit);
      };
      render();
    } else if (q.type === 'matching') {
      box.className = 'quiz-match';
      this.matchSel = null;
      this.matchPairs = {};
      const left = document.createElement('div'); left.className = 'col';
      const right = document.createElement('div'); right.className = 'col';
      q.pairs.forEach((p) => {
        const b = document.createElement('button');
        b.className = 'btn'; b.textContent = p.left; b.dataset.side = 'left'; b.dataset.id = p.id;
        b.addEventListener('click', () => {
          this.matchSel = p.id;
          left.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
          if (!x_done(this.matchPairs, p.id)) b.classList.add('sel');
        });
        left.appendChild(b);
      });
      const shuffled = [...new Set(q.pairs.map(p => p.right))].sort(() => Math.random() - 0.5);
      shuffled.forEach((r) => {
        const b = document.createElement('button');
        b.className = 'btn'; b.textContent = r; b.dataset.side = 'right';
        b.addEventListener('click', () => {
          if (!this.matchSel) return;
          this.matchPairs[this.matchSel] = r;
          this.audio?.ui('click');
          left.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
          this.matchSel = null;
          right.querySelectorAll('button').forEach((rb) => {
            rb.classList.toggle('done', Object.values(this.matchPairs).includes(rb.textContent));
          });
          left.querySelectorAll('button').forEach((lb) => {
            lb.classList.toggle('done', !!this.matchPairs[lb.dataset.id]);
          });
        });
        right.appendChild(b);
      });
      box.appendChild(left); box.appendChild(right);
      const submit = document.createElement('button');
      submit.className = 'btn btn-primary';
      submit.textContent = 'CHECK PAIRS';
      submit.style.marginTop = '0.5rem';
      submit.addEventListener('click', () => this.answer({ pairs: { ...this.matchPairs } }, submit));
      box.appendChild(submit);
    }
    function x_done(pairs, id) { return !!pairs[id]; }
  }

  moveOrder(index, delta) {
    const to = index + delta;
    if (to < 0 || to >= this.order.length) return;
    const [item] = this.order.splice(index, 1);
    this.order.splice(to, 0, item);
  }

  answer(payload, buttonEl) {
    const result = this.quiz.submit(payload);
    if (!result) return;
    const q = this.quiz.question;
    const options = [...$('quiz-options').querySelectorAll('button')];
    options.forEach((b) => {
      if (q.type === 'multiple_choice' || q.type === 'image_identification' || q.type === 'true_false') {
        const isCorrect = (b.textContent === result.answerText);
        if (isCorrect) b.classList.add('correct');
        if (b === buttonEl && !result.correct) b.classList.add('wrong');
        b.disabled = true;
      } else {
        b.disabled = true;
      }
    });
    const fb = $('quiz-feedback');
    fb.className = `quiz-feedback show${result.correct ? '' : ' bad'}`;
    fb.innerHTML = `
      <h4>${result.correct ? this.content.t('quiz.correct') : this.content.t('quiz.incorrect')}</h4>
      ${result.correct ? '' : `<p><b>${this.content.t('quiz.explanation')}:</b> ${result.answerText.replace(/\n/g, '<br>')}</p>`}
      <p>${result.explanation}</p>
      <p class="src"><b>${this.content.t('quiz.source')}:</b> ${result.source}</p>`;
    $('quiz-score').textContent = `${this.content.t('quiz.score')}: ${this.quiz.session.correct}/${this.quiz.session.attempted}`;
    $('quiz-next').disabled = false;
    $('quiz-progress-bar').style.width = `${(this.quiz.number / this.quiz.total) * 100}%`;
    this.game.player.playClip(result.correct ? 'Speak' : 'Think', 2.0);
  }

  quizNext() {
    if ($('quiz-next').disabled) return;
    const more = this.quiz.advance();
    if (more) this.renderQuiz();
  }

  renderQuizSummary(summary) {
    const box = $('quiz-options');
    const fb = $('quiz-feedback');
    const pct = Math.round((summary.correct / Math.max(1, summary.total)) * 100);
    $('quiz-prompt').textContent = `${summary.title} — ${summary.correct}/${summary.total} correct (${pct}%)`;
    box.innerHTML = '';
    fb.className = 'quiz-feedback show';
    fb.innerHTML = `<h4>${pct >= 60 ? 'Stage passed' : 'Not passed yet — the explanation is the point'}</h4>
      <p>${summary.perfect ? 'A clean run: every question answered correctly on the first attempt.' :
      'Every question you answered carried its explanation and its citation. Re-run the exercise whenever you like; nothing is lost by trying again.'}</p>`;
    $('quiz-next').disabled = false;
    $('quiz-next').textContent = this.content.t('common.close');
    $('quiz-next').onclick = () => {
      $('quiz-next').onclick = null;
      $('quiz-next').addEventListener('click', this._nextHandler || (() => {}));
      this.close('quiz');
    };
    // restore the standard handler for the next session
    this._nextHandler = this._nextHandler || (() => this.quizNext());
    setTimeout(() => {
      const btn = $('quiz-next');
      btn.onclick = null;
      btn.replaceWith(btn.cloneNode(true));
      $('quiz-next').addEventListener('click', () => this.quizNext());
    }, 50);
  }

  /* ------------------------------------------------------------- GUIDE */
  openGuide() {
    this.open('guide');
    const offline = !navigator.onLine;
    $('guide-title').textContent = this.content.t(offline ? 'guide.offline' : 'guide.title');
    $('guide-mode').textContent = offline
      ? this.content.guide.messages.offlineNotice
      : 'Retrieval-based · answers cite the archive records they used';
    const log = $('guide-log');
    if (!log.dataset.started) {
      log.dataset.started = '1';
      this.pushGuideTurn('guide', this.content.guide.messages.greeting, []);
    }
    const sug = $('guide-suggest');
    sug.innerHTML = '';
    this.content.guide.suggestedQuestions.slice(0, 6).forEach((qs) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = qs;
      b.addEventListener('click', () => this.askGuide(qs));
      sug.appendChild(b);
    });
    $('guide-input').focus();
  }

  pushGuideTurn(kind, text, sources = []) {
    const log = $('guide-log');
    const div = document.createElement('div');
    div.className = `turn ${kind}`;
    div.innerHTML = `<div>${text}</div>${sources.length ? `<div class="sources"><b>${this.content.t('guide.sources')}</b>${
      sources.map(s => `<div><span class="link" data-archive="${s.archiveId}">${s.title}</span> — <i>${s.source}</i></div>`).join('')
    }</div>` : ''}`;
    div.querySelectorAll('[data-archive]').forEach((el) => {
      el.addEventListener('click', () => {
        const rec = this.content.recordsById.get(el.dataset.archive);
        if (rec) { this.open('archive'); this.showRecord(rec); }
      });
    });
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  askGuide(question) {
    if (!question) return;
    this.pushGuideTurn('me', question);
    const offline = !navigator.onLine;
    const answer = this.content.answer(question, { offline });
    this.quests?.notify('ask_guide');
    setTimeout(() => {
      this.pushGuideTurn('guide', answer.text.replace(/\n/g, '<br>'), answer.sources);
      this.audio?.narrate(answer.text, { onSubtitle: (t) => this.hud.subtitle(t) });
      if (answer.noResults) this.hud.toast('The Guide does not guess: not covered by this archive.', 'warn');
    }, 320);
  }

  /* --------------------------------------------------------------- MAP */
  openMap() {
    this.open('map');
    this.hud.drawMap(this.world, this.player, this.quests);
    this.hud.listMap(this.world, this.player, this.quests);
    this.hud.onJump = (zone) => { this.close('map'); this.game.travelTo(zone); };
  }

  /* ---------------------------------------------------------- MEMORIALS */
  openMemorials() {
    this.open('memorial');
    const list = $('memorial-list');
    list.innerHTML = '';
    this.content.memorials.sites.forEach((site) => {
      const b = document.createElement('button');
      b.className = 'btn';
      const visited = this.state.progress.memorialsVisited.includes(site.id);
      b.innerHTML = `<span class="btn-label">${visited ? '✓ ' : ''}${site.name}</span><span class="btn-hint">${site.city}</span>`;
      b.addEventListener('click', () => {
        this.showMemorial(site);
        this.game.visitMemorialScene(site.id);
      });
      list.appendChild(b);
    });
    const first = this.content.memorials.sites.find(s => !this.state.progress.memorialsVisited.includes(s.id)) || this.content.memorials.sites[0];
    if (first) this.showMemorial(first);
  }

  showMemorial(site) {
    const rec = this.content.recordsById.get(site.archiveId);
    const detail = $('memorial-detail');
    $('memorial-title').textContent = site.name;
    detail.innerHTML = `
      <span class="city">${site.city}${site.state ? ` · ${site.state}` : ''}</span>
      <h3>${site.name}</h3>
      <p>${site.narration}</p>
      <div class="flag">${this.content.t('archive.reconstruction')}</div>
      <p>${this.content.memorials.reconstructionLabel}</p>
      <h4 style="margin:.8rem 0 .3rem">Guided tour</h4>
      <ol>${(site.tour || []).map(t => `<li><b>${t.label}</b> — ${t.text}</li>`).join('')}</ol>
      ${rec ? `<h4 style="margin:.9rem 0 .3rem">Archive record</h4>
        <p>${rec.description}</p>
        <div class="src">${rec.source}</div>` : ''}
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.9rem">
        <button class="btn btn-primary" id="mem-enter">Enter the reconstruction</button>
        <button class="btn" id="mem-narrate">Play narration</button>
        ${rec ? `<button class="btn btn-ghost" id="mem-record">Open record</button>` : ''}
      </div>`;
    $('mem-enter')?.addEventListener('click', () => { this.close('memorial'); this.game.visitMemorialScene(site.id); });
    $('mem-narrate')?.addEventListener('click', () => {
      this.audio.narrate(site.narration, { onSubtitle: (t) => this.hud.subtitle(t) });
      this.hud.toast('Narration — digital reconstruction of the site description');
    });
    $('mem-record')?.addEventListener('click', () => { this.close('memorial'); this.openArchive(); this.showRecord(rec); });
  }

  /* ---------------------------------------------------------- OBJECTIVES */
  openObjectives() {
    this.open('objectives');
    const body = $('objectives-body');
    const p = this.state.progress;
    body.innerHTML = this.content.quests.missions.map((m) => {
      const done = m.objectives.filter(o => p.objectives[o.id]).length;
      const active = this.quests.active()?.id === m.id;
      return `<section style="margin-bottom:1rem">
        <h3 style="font-size:var(--fs-sm);letter-spacing:.08em;color:${active ? 'var(--gold)' : 'var(--cream)'}">
          MISSION ${m.index} — ${m.title} ${done === m.objectives.length ? '✓' : ''}</h3>
        <p style="color:var(--cream-dim);font-size:var(--fs-xs)">${m.description}</p>
        <ol>${m.objectives.map(o => `<li class="${p.objectives[o.id] ? 'done' : active ? 'now' : ''}">${o.label}</li>`).join('')}</ol>
        <p style="font-size:var(--fs-xs);color:var(--stone)">${done}/${m.objectives.length} objectives · ${m.rewardPoints} points</p>
      </section>`;
    }).join('');
  }

  /* ------------------------------------------------------------ SETTINGS */
  buildSettings() {
    const body = $('settings-body');
    if (!body) return;
    const s = this.state.settings;
    const rows = [];
    const slider = (key, label, min = 0, max = 1, step = 0.05) =>
      rows.push(`<div class="set-row"><label>${label}</label>
        <input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}">
        <span class="val" data-val="${key}">${typeof s[key] === 'number' ? Math.round(s[key] * 100) : s[key]}</span></div>`);
    slider('master', this.content.t('settings.master'));
    slider('music', this.content.t('settings.music'));
    slider('voice', this.content.t('settings.voice'));
    slider('sfx', this.content.t('settings.sfx'));

    rows.push(`<div class="set-row"><label>${this.content.t('settings.subtitles')}</label>
      <input type="checkbox" data-setting="subtitles" ${s.subtitles ? 'checked' : ''}><span class="val"></span></div>`);
    rows.push(`<div class="set-row"><label>${this.content.t('settings.narration')}</label>
      <input type="checkbox" data-setting="narration" ${s.narration ? 'checked' : ''}><span class="val"></span></div>`);
    slider('textScale', this.content.t('settings.textSize'), 0.85, 1.5, 0.05);
    rows.push(`<div class="set-row"><label>${this.content.t('settings.highContrast')}</label>
      <input type="checkbox" data-setting="contrast" ${s.contrast ? 'checked' : ''}><span class="val"></span></div>`);
    rows.push(`<div class="set-row"><label>${this.content.t('settings.reduceEffects')}</label>
      <input type="checkbox" data-setting="reduceEffects" ${s.reduceEffects ? 'checked' : ''}><span class="val"></span></div>`);
    rows.push(`<div class="set-row"><label>${this.content.t('settings.simplifiedControls')}</label>
      <input type="checkbox" data-setting="simplifiedControls" ${s.simplifiedControls ? 'checked' : ''}><span class="val"></span></div>`);
    rows.push(`<div class="set-row"><label>${this.content.t('settings.showMinimap') || 'Minimap'}</label>
      <input type="checkbox" data-setting="showMinimap" ${s.showMinimap ? 'checked' : ''}><span class="val"></span></div>`);
    rows.push(`<div class="set-row"><label>${this.content.t('settings.quality')}</label>
      <select data-setting="quality">
        ${['auto', 'low', 'medium', 'high'].map(q => `<option value="${q}" ${s.quality === q ? 'selected' : ''}>${this.content.t(`quality.${q}`) || q.toUpperCase()}</option>`).join('')}
      </select><span class="val"></span></div>`);
    rows.push(`<div class="set-row"><label>${this.content.t('settings.language')}</label>
      <select data-setting="language">
        ${this.content.locales.map(l => `<option value="${l.code}" ${s.language === l.code ? 'selected' : ''}>${l.name}${l.status !== 'complete' ? ' (partial)' : ''}</option>`).join('')}
      </select><span class="val"></span></div>`);
    slider('sensitivityMouse', this.content.t('settings.sensitivityPC'), 0.3, 2.5, 0.1);
    slider('sensitivityTouch', this.content.t('settings.sensitivityTouch'), 0.3, 2.5, 0.1);
    rows.push(`<div class="set-row"><label>${this.content.t('settings.invertY')}</label>
      <input type="checkbox" data-setting="invertY" ${s.invertY ? 'checked' : ''}><span class="val"></span></div>`);
    rows.push(`<div class="set-row"><label>Export / import save</label>
      <div style="display:flex;gap:.5rem"><button class="btn btn-ghost" id="save-export">EXPORT</button>
      <button class="btn btn-ghost" id="save-import">IMPORT</button>
      <button class="btn btn-ghost danger" id="save-reset">RESET JOURNEY</button></div><span class="val"></span></div>`);

    body.innerHTML = rows.join('');

    body.querySelectorAll('[data-setting]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.setting;
        const value = input.type === 'checkbox' ? input.checked
          : input.type === 'range' ? Number(input.value) : input.value;
        this.state.setSetting(key, value);
        const label = body.querySelector(`[data-val="${key}"]`);
        if (label) label.textContent = typeof value === 'number' ? Math.round(value * 100) : '';
        this.onSettingsChanged(key, value);
      });
    });

    $('save-export')?.addEventListener('click', () => {
      const blob = new Blob([this.state.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'heritage-journey-save.json';
      a.click();
      this.hud.toast('Save exported.');
    });
    $('save-import')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'application/json';
      input.addEventListener('change', async () => {
        try {
          const text = await input.files[0].text();
          this.state.importJSON(text);
          this.applySettingsToDom();
          this.hud.toast('Save imported.');
        } catch (err) {
          this.hud.toast('That file could not be read as a save.', 'error');
        }
      });
      input.click();
    });
    $('save-reset')?.addEventListener('click', () => {
      if (confirm('Erase the saved journey and start again?')) {
        this.state.reset();
        this.game.restartCheckpoint();
        this.close('settings');
      }
    });
  }

  onSettingsChanged(key, value) {
    if (key === 'contrast' || key === 'textScale' || key === 'showMinimap') this.applySettingsToDom();
    if (key === 'language') { this.content.setLocale(value); this.applyI18n(); this.buildSettings(); }
    if (key === 'reduceEffects' || key === 'quality') this.game.applyQuality();
    this.audio?.applySettings();
    this.applySettingsToDom();
  }

  openSettings() { this.open('settings'); }

  /* ------------------------------------------------------------- CREDITS */
  buildCredits() {
    const body = $('credits-body');
    if (!body) return;
    body.innerHTML = `
      <h3>Game</h3>
      <p>AMBEDKAR: THE DIGITAL HERITAGE JOURNEY<br>Explore. Discover. Learn.</p>
      <h3>Problem statement</h3>
      <p>Smart India Hackathon 2026 · <b>SIH26096</b><br>
      Digital Heritage Archive for Memorials, Manuscripts &amp; Ambedkar — AI-Powered Institutional Archive and Audio-Visual Knowledge Platform<br>
      Theme: Smart Education · Organisation: Ministry of Social Justice and Empowerment</p>
      <h3>Team <span class="hint">${this.content.t('credits.placeholderHint')}</span></h3>
      <div class="ph" contenteditable="true">Team name — add here</div>
      <div class="ph" contenteditable="true" style="margin-top:.4rem">Institution / College — add here</div>
      <div class="ph" contenteditable="true" style="margin-top:.4rem">Team members — add here</div>
      <div class="ph" contenteditable="true" style="margin-top:.4rem">Mentor — add here</div>
      <div class="ph" contenteditable="true" style="margin-top:.4rem">Department — add here</div>
      <h3>Technology</h3>
      <ul>
        <li>Unity 6 (URP) project for the Windows and Android builds — C# systems, ScriptableObject content, procedural character and scene builders</li>
        <li>This browser build: three.js, generated geometry and materials, Web Audio ambience</li>
        <li>Shared content database: JSON records consumed identically by both builds</li>
      </ul>
      <h3>Content sources</h3>
      <ul>
        <li>Constituent Assembly Debates (Government of India, public record)</li>
        <li>Constitution of India, India Code (Government of India)</li>
        <li>Dr. Babasaheb Ambedkar: Writings and Speeches (Government of Maharashtra / Dr. Ambedkar Foundation)</li>
        <li>Columbia University Libraries; LSE Library; Government of India ministry records on the memorials</li>
      </ul>
      <p class="hint">Every archive record in this platform prints its own citation. Records are marked
      “editorial review required” until a named editor verifies them against the cited source.</p>
      <h3>Asset credits</h3>
      <p>All 3D geometry, materials, textures, signage, sound and narration in this build are generated at
      runtime by the project's own code. No third-party models, textures, fonts or audio files are included.
      The character is a digital reconstruction prepared for education; it is not an authentic photograph.</p>
      <h3>Disclaimer</h3>
      <p>${this.content.t('credits.disclaimer')}</p>`;
  }

  openCredits() { this.open('credits'); }

  /* ------------------------------------------------------- CERTIFICATE */
  openCertificate() {
    this.open('certificate');
    const stats = $('cert-stats');
    stats.innerHTML = this.quests.dashboard()
      .map(d => `<div><b>${d.value}</b><span>${d.label}</span></div>`).join('');
    this.audio?.ui('achievement');
  }

  openPause() { this.open('pause'); }
}
