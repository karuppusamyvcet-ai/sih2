/* ==========================================================================
   main.js — AMBEDKAR: THE DIGITAL HERITAGE JOURNEY
   SIH26096 · Digital Heritage Archive for Memorials, Manuscripts & Ambedkar

   Boot → title → main menu → cinematic introduction → museum lobby, and from
   there the six galleries, the archive, the Archive Guide, the memorial
   reconstructions and the final knowledge challenge.

   This file wires the systems together and owns the frame loop; it holds no
   content. Missions come from quests.json, exhibits from exhibits.json, the
   archive from archive.json — so the build can be re-curated without touching
   game code (brief §38).
   ========================================================================== */

import * as THREE from 'three';
import { Content } from './core/content.js';
import { State } from './core/state.js';
import { Audio } from './core/audio.js';
import { Input } from './core/input.js';
import { buildMaterialLibrary } from './world/materials.js';
import { World } from './world/builder.js';
import { buildCharacter } from './char/builder.js';
import { Animator } from './char/animator.js';
import { Player } from './systems/player.js';
import { Quests } from './systems/quests.js';
import { Quiz } from './systems/quiz.js';
import { HUD, MenuCamera } from './ui/hud.js';
import { Panels } from './ui/panels.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.state = new State();
    this.clock = new THREE.Clock();
    this.quality = 'high';
    this.mode = 'boot';
    this.debug = new URLSearchParams(location.search).has('debug');
    this.presentation = { active: false, timer: 0, step: 0 };
    this.lastZone = 'hub';
    this.ready = false;
  }

  /* ==================================================================== boot */
  async boot() {
    this.state.loadSettings();
    this.applyQuality(true);

    const bootStatus = $('boot-status');
    const progress = $('boot-progress');
    const setProgress = (p) => { progress.style.width = `${Math.max(4, Math.round(p * 100))}%`; };

    setProgress(0.08);
    bootStatus.textContent = 'Reading the archive records…';
    try {
      this.content = await Content.load('./content/', this.state.settings.language, (p, name) => {
        setProgress(0.08 + p * 0.62);
        bootStatus.textContent = `Loaded ${name}.json`;
      });
    } catch (err) {
      console.error(err);
      bootStatus.textContent = 'The archive content could not be loaded. Check that /content is served.';
      return;
    }
    if (!this.content.archive.records.length) {
      bootStatus.textContent = 'The archive is empty — content files were found but contained no records.';
    }

    setProgress(0.74);
    bootStatus.textContent = 'Starting the renderer…';
    if (!Game.webglAvailable()) {
      bootStatus.textContent = 'This build draws the museum with WebGL, and the browser would not provide a 3D context. '
        + 'Enable hardware acceleration (or use a WebGL-capable browser such as Chrome, Edge or Firefox) and reload. '
        + 'The Unity build of this project does not need WebGL.';
      document.querySelector('.boot-bar')?.classList.add('boot-bar-error');
      return;
    }
    this.setupRenderer();

    setProgress(0.82);
    bootStatus.textContent = 'Building the character…';
    this.character = buildCharacter(this.content.character, this.quality);
    this.animator = new Animator(this.character);
    this.scene.add(this.character.root);

    this.materials = buildMaterialLibrary(this.content.museum, this.quality);
    setProgress(0.9);
    bootStatus.textContent = 'Building the museum…';
    this.world = new World(this.scene, this.content, this.materials, this.quality);

    this.setProgress = setProgress;
    this.buildSystems();

    setProgress(1);
    bootStatus.textContent = 'Ready.';

    const loadResult = this.state.hasSave() ? this.state.loadProgress() : 'empty';
    if (loadResult === 'recovered') {
      this.hud.toast(this.content.t('error.save'), 'warn', 6000);
    }
    this.updateContinueButton(loadResult);

    this.ready = true;
    setTimeout(() => this.showMenu(), 420);
    this.animate();
  }

  /** WebGL is the one hard requirement of the browser build; probe before use. */
  static webglAvailable() {
    try {
      const probe = document.createElement('canvas');
      return !!(probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl'));
    } catch (err) {
      console.error('[webgl] probe failed:', err);
      return false;
    }
  }

  setupRenderer() {
    this.canvas = $('viewport');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: this.quality !== 'low', powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality === 'high' ? 2 : 1.35));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = this.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a0f18');
    const fogDensity = this.quality === 'low' ? 0.008 : 0.012;
    this.scene.fog = new THREE.FogExp2('#101826', fogDensity);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.08, 220);

    window.addEventListener('resize', () => this.onResize());
  }

  buildSystems() {
    this.input = new Input(this.canvas, this.state);
    this.audio = new Audio(this.state);
    this.player = new Player({
      scene: this.scene, camera: this.camera, character: this.character, animator: this.animator,
      world: this.world, state: this.state, content: this.content, audio: this.audio
    });
    this.quests = new Quests(this.content, this.state);
    this.quiz = new Quiz(this.content, this.state, this.quests, this.audio);
    this.hud = new HUD(this.content, this.state, {
      onArchive: () => this.openArchive(),
      onMap: () => this.openMap(),
      onMenu: () => this.openPause()
    });
    this.panels = new Panels({
      content: this.content, state: this.state, quests: this.quests, quiz: this.quiz,
      audio: this.audio, hud: this.hud, world: this.world, player: this.player, game: this
    });
    this.menuCamera = new MenuCamera(this.camera, this.world, this.player);

    // input actions
    this.input.on('interact', () => this.onInteract());
    this.input.on('archive', () => this.openArchive());
    this.input.on('map', () => this.openMap());
    this.input.on('guide', () => this.panels.openGuide());
    this.input.on('menu', () => this.onEscape());
    this.input.on('objectives', () => this.panels.openObjectives());
    this.input.on('confirm', () => this.panels.quizNext());
    this.input.on('textSize', (d) => {
      const v = Math.max(0.85, Math.min(1.5, this.state.settings.textScale + d));
      this.state.setSetting('textScale', Math.round(v * 100) / 100);
      this.panels.applySettingsToDom();
      this.hud.toast(`Text size ${Math.round(v * 100)}%`);
    });
    this.input.on('reduceEffects', () => {
      const v = !this.state.settings.reduceEffects;
      this.state.setSetting('reduceEffects', v);
      this.applyQuality();
      this.hud.toast(`Reduced visual effects ${v ? 'on' : 'off'}`);
    });
    this.input.on('any', () => { if (this.mode === 'intro') this.skipIntro(); });

    // quest event feedback
    this.quests.on((evt) => this.onQuestEvent(evt));
    this.state.on('achievement', (a) => {
      this.audio.ui('achievement');
      this.hud.toast(`Achievement — ${a.title}: ${a.description}`, 'info', 5200);
    });
    this.state.on('progress', () => this.hud.setPoints(this.state.progress.knowledgePoints));

    // menu buttons
    document.querySelectorAll('#menu-actions .btn').forEach((btn) => {
      btn.addEventListener('click', () => this.onMenuAction(btn.dataset.action));
    });
    $('intro-skip')?.addEventListener('click', () => this.skipIntro());
    $('viewer-prev')?.addEventListener('click', () => this.panels.viewerStep(-1));
    $('viewer-next')?.addEventListener('click', () => this.panels.viewerStep(1));
    $('viewer-zoom')?.addEventListener('click', () => {
      this.panels.magnified = !this.panels.magnified;
      this.panels.renderViewer();
      $('viewer-zoom').classList.toggle('on', this.panels.magnified);
    });
    $('quiz-next')?.addEventListener('click', () => this.panels.quizNext());
    $('guide-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('guide-input');
      this.panels.askGuide(input.value.trim());
      input.value = '';
    });
    $('archive-search')?.addEventListener('search', () => this.quests.notify('search'));

    this.hud.setPoints(this.state.progress.knowledgePoints);
    this.panels.applySettingsToDom();
    this.trackObjective(false);
  }

  applyQuality() {
    const s = this.state.settings;
    const auto = window.innerWidth < 860 || /Android|iPhone|iPad/i.test(navigator.userAgent);
    this.quality = s.reduceEffects ? 'low'
      : s.quality === 'auto' ? (auto ? 'medium' : 'high') : s.quality;
    if (this.renderer) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality === 'high' ? 2 : 1.35));
      this.renderer.shadowMap.enabled = this.quality !== 'low';
    }
    if (this.world) {
      this.world.quality = this.quality;
      this.scene.traverse((o) => {
        if (o.isLight) {
          if (o.type === 'DirectionalLight') o.castShadow = this.quality !== 'low';
        }
      });
    }
  }

  /* =================================================================== menus */
  showMenu() {
    this.mode = 'menu';
    $('menu').classList.add('visible');
    $('boot').classList.remove('visible');
    $('hud').classList.remove('visible');
    if (!this.world.room) this.world.buildHub();
    this.player.spawn('hub');
    this.player.locked = true;
    this.menuCamera.start();
  }

  updateContinueButton(loadResult) {
    const btn = $('btn-continue');
    const hint = $('continue-hint');
    if (!btn) return;
    const has = this.state.hasSave() && loadResult !== 'empty';
    btn.disabled = !has;
    hint.textContent = has
      ? `${this.state.progress.knowledgePoints} points · ${this.state.progress.zonesCompleted.length}/6 galleries · mission ${Math.min(8, this.state.progress.missionIndex + 1)}`
      : 'No saved journey';
  }

  onMenuAction(action) {
    this.audio.start();
    switch (action) {
      case 'new':
        this.state.reset();
        this.startJourney({ demo: false });
        break;
      case 'continue':
        this.state.loadProgress();
        this.updateContinueButton('ok');
        this.startJourney({ demo: false, resumed: true });
        break;
      case 'archive': this.panels.openArchive(); break;
      case 'settings': this.panels.openSettings(); break;
      case 'credits': this.panels.openCredits(); break;
      case 'demo': this.startJourney({ demo: true }); break;
      case 'presentation': this.startJourney({ demo: true, presentation: true }); break;
      case 'exit':
        this.hud.toast('On Android this button closes the app; in the browser, close the tab.');
        window.close();
        break;
      default: break;
    }
  }

  startJourney({ demo = false, presentation = false, resumed = false } = {}) {
    this.state.progress.flags.demoMode = demo;
    this.state.progress.flags.presentationMode = presentation;
    $('menu').classList.remove('visible');
    this.menuCamera.stop();
    this.character.root.visible = true;
    this.world.buildHub();
    this.player.spawn('hub');

    if (!resumed && !this.state.progress.flags.introSeen) this.playIntro({ demo });
    else this.enterPlayMode(demo);

    if (demo && !resumed) {
      this.hud.toast('DEMO MODE — a guided route through all ten demonstration features. Follow the objective banner.', 'info', 8000);
    }
  }

  /* =================================================================== intro */
  playIntro({ demo = false } = {}) {
    this.mode = 'intro';
    const intro = $('intro');
    intro.classList.add('visible');
    const l1 = $('intro-line-1'), l2 = $('intro-line-2'), l3 = $('intro-line-3');
    this.player.locked = true;
    this.character.root.visible = true;
    this.player.teleportTo(0, -7.5, 0);
    this.camera.position.set(0, 2.2, -13);
    this.camera.lookAt(0, 1.5, -7.5);
    this.introTimers = [];
    const t = (ms, fn) => this.introTimers.push(setTimeout(fn, ms));
    t(400, () => l1.classList.add('show'));
    t(3200, () => l1.classList.remove('show'));
    t(3600, () => l2.classList.add('show'));
    t(6400, () => l2.classList.remove('show'));
    t(6900, () => l3.classList.add('show'));
    t(9200, () => l3.classList.remove('show'));
    t(9600, () => this.finishIntro());
    this.audio.narrate('Welcome to the Digital Ambedkar Heritage Museum. Six galleries, sixty-nine archive records, and one rule: everything you see cites its source.',
      { onSubtitle: (text) => this.hud.subtitle(text, 8000) });
    if (demo) this.hud.toast('Demo mode: the objective banner will guide you.', 'info', 6000);
  }

  skipIntro() {
    if (this.mode !== 'intro') return;
    this.introTimers?.forEach(clearTimeout);
    this.finishIntro();
  }

  finishIntro() {
    this.state.progress.flags.introSeen = true;
    this.state.save();
    $('intro').classList.remove('visible');
    this.enterPlayMode(this.state.progress.flags.demoMode);
  }

  enterPlayMode(demo = false) {
    this.mode = 'play';
    this.player.locked = false;
    this.hud.show(true);
    this.world.zone = 'hub';
    this.player.spawn('hub');
    this.hud.zoneCard('THE DIGITAL AMBEDKAR HERITAGE MUSEUM', 'Six galleries · Door 1 · Early Life & Education');
    this.quests.notify('zone_entered', { zoneId: 'hub' });
    this.trackObjective(true);
    this.audio.start();
    if (demo) this.audio.narrate('Demo mode. Walk forward into the hall; the objective banner will guide you through the whole product.',
      { onSubtitle: (t) => this.hud.subtitle(t) });
  }

  /* ================================================================ movement */
  enterZone(zoneId, { fromSave = false } = {}) {
    try {
      if (zoneId === 'hub') this.world.buildHub();
      else if (zoneId === 'memorial') this.world.buildMemorial(this.pendingMemorial || this.content.memorials.sites[0].id);
      else this.world.buildZone(zoneId);
    } catch (err) {
      console.error('[world] zone build failed:', err);
      this.hud.toast(this.content.t('error.scene'), 'error', 6000);
      this.world.buildHub();
      zoneId = 'hub';
    }
    this.world.zone = zoneId;
    if (zoneId !== 'hub' && zoneId !== 'memorial') {
      this.ensureExit(zoneId);
      const zone = this.content.zonesById.get(zoneId);
      this.hud.zoneCard(zone?.name || zoneId, zone?.subtitle || '');
      this.quests.notify('zone_entered', { zoneId });
      this.audio.narrate(zone?.description?.split('. ')[0] + '.', { onSubtitle: (t) => this.hud.subtitle(t) });
    } else if (zoneId === 'hub') {
      this.hud.zoneCard('CENTRAL HALL', 'Six doors · one archive');
    }
    if (!fromSave) this.player.spawn(zoneId);
    this.state.progress.player.zone = zoneId;
    this.state.save();
    this.trackObjective(true);
    this.hud.drawMap(this.world, this.player, this.quests);
  }

  /** Every gallery carries a return panel so the player can never be stranded. */
  ensureExit(zoneId) {
    const R = this.content.exhibits.rooms[zoneId];
    if (!R) return;
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.2),
      this.mats_or_default()._sign
        ? this.mats_or_default()._sign(['RETURN', 'Central hall · press E'], { width: 768, height: 260, titleSize: 64, bodySize: 40 })
        : new THREE.MeshStandardMaterial({ color: '#C9A227' })
    );
    panel.position.set(0, 2.2, -R.depth / 2 + 0.24);
    this.world.room.add(panel);
    this.world.registerInteractable(panel, {
      id: `exit_${zoneId}`, label: 'Return to the central hall', kind: 'exit', interaction: 'press'
    });
  }

  mats_or_default() { return this.materials || {}; }

  travelTo(zoneId) {
    if (zoneId === 'hub') { this.enterZone('hub'); return; }
    if (zoneId === 'memorial') { this.panels.openMemorials(); return; }
    this.enterZone(zoneId);
  }

  visitMemorialScene(siteId) {
    // a bad id can arrive from an old save or a hand-edited link: never throw,
    // fall back to the memorial gallery and say so
    const site = this.content.memorialsById.get(siteId);
    if (!site) {
      console.warn(`[memorial] unknown site "${siteId}" — opening the memorial gallery instead`);
      this.hud.toast(this.content.t('error.memorial'), 'warn', 5000);
      this.panels.openMemorials();
      return;
    }
    this.pendingMemorial = siteId;
    this.lastZone = 'memorials';
    this.enterZone('memorial');
    this.quests.notify('memorial', { memorialId: siteId });
    this.audio.narrate(site.narration, { onSubtitle: (t) => this.hud.subtitle(t) });
    this.hud.toast(`${site.name} — ${this.content.t('archive.reconstruction')}`, 'warn', 5600);
  }

  /* ============================================================= interaction */
  onInteract() {
    if (this.panels.isOpen) return;
    if (this.mode !== 'play') return;
    const focus = this.player.focus;
    if (!focus) {
      this.hud.toast('Nothing to interact with here. Look for an exhibit, a panel or a door.', 'info', 2600);
      return;
    }
    this.hud.flashObjective(this.trackObjective(false));
    this.handleExhibit(focus);
  }

  handleExhibit(it) {
    const def = it.def || {};
    this.audio.exhibitChime();
    (def.archiveIds || []).forEach(id => this.collect(id, { silent: true }));
    this.quests.notify('interact', { exhibitId: it.id, kind: it.kind, collected: (def.archiveIds || []).length });

    // context-sensitive animation, then the panel (brief §44)
    const clipByInteraction = {
      read: 'Read_Standing', book: 'Book_Open', examine: 'Examine_Manuscript',
      sit: 'Sit_Read', listen: 'Listen', press: 'Interact_Press', notes: 'Take_Notes', ask: 'Speak', search: 'Interact_Press'
    };
    this.player.playClip(clipByInteraction[def.interaction] || 'Look_At_Exhibit', 2.4);
    this.player.lookAtExhibit(it.centre, 1);

    switch (it.kind) {
      case 'door':
        this.useDoor(it);
        return;
      case 'exit':
        this.enterZone('hub');
        this.hud.toast('Returned to the central hall.');
        return;
      case 'memorial_plinth':
        this.visitMemorialScene(it.memorialId);
        return;
      case 'memorial_info':
        this.panels.openMemorials();
        return;
      case 'tour_stop':
        this.audio.narrate(it.tourStop.text, { onSubtitle: (t) => this.hud.subtitle(t) });
        this.hud.toast(it.label);
        return;
      case 'minigame_station':
      case 'quiz_kiosk':
      case 'final_challenge_dais': {
        const ids = this.quiz.groupFor(def.quizIds || []);
        if (!ids.length) { this.hud.toast('This exercise has no questions in the build.', 'warn'); return; }
        const isFinal = it.kind === 'final_challenge_dais';
        if (isFinal) this.startFinalChallenge();
        else this.panels.startQuiz(ids, {
          title: def.label,
          kind: def.minigame || 'quiz',
          onFinish: (summary) => {
            if (def.minigame) this.quests.notify('minigame', { minigame: def.minigame });
            this.hud.flashObjective(this.trackObjective(true));
          }
        });
        return;
      }
      case 'audio':
        if (it.narration) this.audio.narrate(it.narration, { onSubtitle: (t) => this.hud.subtitle(t) });
        else this.audio.narrate(`${it.label}. ${this.content.t('archive.reconstruction')}.`, { onSubtitle: (t) => this.hud.subtitle(t) });
        return;
      case 'map_table':
        this.panels.openMemorials();
        return;
      case 'archive_kiosk':
      case 'search_terminal':
        this.openArchive();
        return;
      case 'ai_terminal':
      case 'guide_terminal':
        this.panels.openGuide();
        return;
      case 'quiz':
        this.panels.startQuiz(this.quiz.groupFor(def.quizIds || []), { title: def.label });
        return;
      default: break;
    }

    // everything else: show its record, its media and its citation
    const firstArchive = (def.archiveIds || [])[0];
    const rec = firstArchive ? this.content.recordsById.get(firstArchive) : null;
    if (rec) {
      this.panels.openArchive();
      this.panels.showRecord(rec);
      if (def.media?.[0]?.type === 'audio') {
        this.audio.narrate(`${rec.title}. ${rec.description.split('. ')[0]}.`, { onSubtitle: (t) => this.hud.subtitle(t) });
      }
    } else if (def.panel) {
      this.hud.subtitle(`${def.panel.title} — ${def.panel.body}`, 7000);
      this.panels.openViewer({
        id: it.id, title: def.panel.title, description: def.panel.body, category: 'Exhibit',
        zone: def.zone, date: '', location: '', author: 'Platform documentation',
        media: def.media || [], source: 'Platform documentation — exhibit panel.',
        reviewStatus: 'platform-example', related: []
      });
    } else {
      this.hud.toast(`${it.label} — ${this.content.t('error.media')}`, 'warn');
    }
  }

  useDoor(it) {
    const zone = it?.zone;
    const zoneDef = this.content.zonesById.get(zone);
    if (!zone || !zoneDef) {
      console.warn('[door] interactable without a gallery id:', it && it.id);
      return;
    }
    const unlocked = this.isZoneUnlocked(zone);
    if (!unlocked) {
      this.hud.toast(zoneDef?.unlockRule?.type === 'mission_complete'
        ? `This door is locked: complete “${this.content.missionsById.get(zoneDef.unlockRule.missionId)?.title}” first.`
        : 'This door is locked.', 'warn', 5200);
      this.audio.ui('error');
      return;
    }
    it.door.isOpen = true;
    this.audio.ui('door');
    this.player.playClip('Door_Enter', 1.6);
    this.world.buildZone(zone);      // pre-build behind the animation
    setTimeout(() => {
      this.enterZone(zone);
      this.hud.zoneCard(zoneDef?.name || zone, zoneDef?.subtitle || '');
    }, 620);
  }

  isZoneUnlocked(zoneId) {
    const zone = this.content.zonesById.get(zoneId);
    if (!zone) return false;
    const rule = zone.unlockRule || { type: 'always' };
    if (rule.type === 'always') return true;
    if (rule.type === 'mission_complete') return this.quests.isMissionComplete(rule.missionId);
    return true;
  }

  openArchive() {
    if (this.mode === 'menu' || this.mode === 'play' || this.mode === 'intro') {
      this.panels.openArchive();
      this.quests.notify('interact', { exhibitId: 'ui_archive' });
      // opening the archive is a flag, and achievements are data: the evaluator
      // decides which badge that unlocks (achievements.json -> ach_archive_opened)
      this.state.progress.flags.interact_ui_archive = true;
      this.quests.checkAchievements();
    }
  }

  openMap() { this.panels.openMap(); }

  openPause() {
    if (this.mode === 'play') this.panels.openPause();
    else if (this.mode === 'menu') this.panels.openSettings();
  }

  onEscape() {
    if (this.panels.isOpen) { this.panels.close(); return; }
    if (this.mode === 'intro') { this.skipIntro(); return; }
    if (this.mode === 'play') this.panels.openPause();
  }

  collect(archiveId, { silent = false } = {}) {
    if (!archiveId) return;
    if (this.state.collect(archiveId)) {
      const rec = this.content.recordsById.get(archiveId);
      if (!silent && rec) this.audio.ui('collect');
      this.quests.notify('interact', { exhibitId: archiveId, collected: true });
      this.quests.checkAchievements();
    }
  }

  noteViewerOpen(rec) {
    if (rec?.id) this.collect(rec.id, { silent: true });
  }

  /* =============================================================== missions */
  trackObjective(announce = false) {
    const ctx = this.quests.currentObjective();
    if (!ctx) {
      const done = this.state.progress.flags.finished ? 'HERITAGE ARCHIVIST — journey complete' : 'All objectives complete';
      this.hud.setObjective(done);
      return done;
    }
    const { mission, objective } = ctx;
    const prog = this.quests.objectiveProgress(objective);
    const progress = prog ? `${prog.done}/${prog.total}` : `${mission.objectives.filter(o => !this.state.progress.objectives[o.id]).length} remaining in mission ${mission.index}`;
    this.hud.setObjective(`${mission.hudTitle || mission.title} — ${objective.label}`, progress);
    if (announce) this.hud.flashObjective(`${mission.hudTitle || mission.title} — ${objective.label}`);
    this.state.setMissionIndex(mission.index - 1);
    return objective.label;
  }

  onQuestEvent(evt) {
    switch (evt.type) {
      case 'objective':
        this.hud.flashObjective(`OBJECTIVE COMPLETE — ${this.trackObjective(false)}`);
        this.audio.ui('collect');
        break;
      case 'mission': {
        const m = evt.mission;
        this.hud.flashObjective(`GALLERY COMPLETE — ${m.title}`);
        this.hud.toast(`Mission ${m.index} complete: ${m.title} (+${m.rewardPoints} points)`, 'info', 6000);
        this.audio.ui('achievement');
        if (m.zone && m.zone !== 'hub') {
          const next = this.content.quests.missions.find(x => x.index === m.index + 1);
          this.hud.toast(next ? `Next objective: ${next.title}` : 'All galleries complete — the final challenge awaits in the Legacy Archive.', 'info', 7000);
        }
        this.trackObjective(false);
        break;
      }
      case 'complete':
        setTimeout(() => this.panels.openCertificate(), 900);
        break;
      default: break;
    }
  }

  /* ==================================================== final knowledge test */
  startFinalChallenge() {
    const stages = this.quiz.finalChallengeStages();
    if (!stages.length) { this.hud.toast('The final challenge has no questions in this build.', 'warn'); return; }
    this.finalStageIndex = 0;
    const runStage = () => {
      const stage = stages[this.finalStageIndex];
      this.hud.subtitle(`Stage ${stage.stage} of 6 — ${stage.label}`, 4000);
      this.panels.startQuiz(stage.ids, {
        title: `Final challenge — stage ${stage.stage}: ${stage.label}`,
        kind: 'final',
        onFinish: (summary) => {
          this.quests.notify('final_stage', { stage: stage.stage });
          this.finalStageIndex += 1;
          if (this.finalStageIndex < stages.length) setTimeout(runStage, 400);
          else {
            this.quests.notify('final_stage', { stage: 7 });
            this.quests.checkAchievements();
            this.quests.finish();
          }
        }
      });
    };
    runStage();
  }

  /* ============================================================== lifecycle */
  restartCheckpoint() {
    const zone = this.state.progress.player.zone || 'hub';
    this.panels.closeAll();
    this.enterZone(zone === 'memorial' ? 'memorials' : zone);
    this.hud.toast('Checkpoint restored.');
  }

  toMainMenu() {
    this.panels.closeAll();
    this.hud.show(false);
    this.showMenu();
  }

  capturePointer() { if (!document.body.classList.contains('touch') && this.mode === 'play') this.canvas.requestPointerLock?.(); }
  releasePointer() { document.exitPointerLock?.(); }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.hud.drawMap(this.world, this.player, this.quests);
  }

  /* ================================================================ the loop */
  animate() {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(0.05, this.clock.getDelta());
      if (!this.ready) return;
      this.frame(dt);
    });
  }

  frame(dt) {
    this.frameCount = (this.frameCount || 0) + 1;
    this.input.pollGamepad?.();

    if (this.mode === 'menu') {
      this.menuCamera.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.mode === 'intro') {
      // slow cinematic reveal: orbit the character, then rise to the hall
      const t = (this.introTime = (this.introTime || 0) + dt);
      const r = 6.5 - Math.min(2.4, t * 0.25);
      const a = -0.6 + t * 0.16;
      this.camera.position.set(Math.sin(a) * r, 1.75 + t * 0.06, -7.5 + Math.cos(a) * r);
      this.camera.lookAt(this.player.position.x, 1.35, this.player.position.z);
      this.animator.play('Idle_Stand', { blendSpeed: 2 });
      this.animator.update(dt, {});
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const paused = this.panels.isOpen;
    const active = !paused;
    const step = active ? dt : dt * 0.15;

    this.player.update(step, this.input, { doorCheck: (p) => this.doorProximity(p) });

    // proximity objectives (reach)
    const ctxObj = this.quests.currentObjective();
    if (ctxObj?.objective?.type === 'reach') {
      const o = ctxObj.objective;
      const target = this.reachTarget(o.target);
      if (target) {
        const d = Math.hypot(target.x - this.player.position.x, target.z - this.player.position.z);
        if (d <= (o.radius || 3)) this.quests.notify('proximity', { target: o.target, distance: d });
      }
    }

    // HUD
    if (active) {
      const focus = this.player.focus;
      this.hud.setPrompt(focus ? `${focus.label}` : null);
      if (focus) this.player.lookAtExhibit(focus.centre, 0.7);
      else this.player.lookAtExhibit(null, 0);
      if (this.frameCount % 3 === 0) {
        this.hud.minimap(this.player, this.world, this.quests);
      }
      if (this.state.progress) this.state.progress.playSeconds += dt;
      if (this.frameCount % 600 === 0) this.state.save();
    }

    // door animation + hub ambience
    for (const door of this.world.doors) {
      if (door.isOpen && door.openAmount < 1) door.open(dt);
      if (!door.isOpen && door.openAmount > 0) door.close(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }

  doorProximity(p) {
    for (const door of this.world.doors) {
      const def = this.content.museum.doors.find(d => d.doorId === door.doorId);
      if (!def) continue;
      const d = Math.hypot(def.x - p.position.x, def.z - p.position.z);
      if (d < 2.6 && !this.doorHintShown?.[door.doorId]) {
        this.doorHintShown = this.doorHintShown || {};
        this.doorHintShown[door.doorId] = true;
        const zone = this.content.zonesById.get(door.zone);
        this.hud.toast(`${zone?.name} — ${this.isZoneUnlocked(door.zone) ? 'press E to enter' : 'locked'}`, 'info', 3200);
      }
    }
  }

  reachTarget(target) {
    if (!target) return null;
    if (target === 'hub_center') return { x: 0, z: 1.2 };
    const zone = this.content.zonesById.get(target.replace('zone_', '').replace('_entry', ''));
    if (zone && this.world.zone === zone.id) return this.world.spawnPointFor(zone.id);
    return null;
  }
}

/* ------------------------------------------------------------------ start */
const game = new Game();
window.heritageGame = game;      // debug handle, used by the validation tools
game.boot().catch((err) => {
  console.error('[boot] fatal:', err);
  const status = document.getElementById('boot-status');
  if (status) status.textContent = `Startup error: ${err.message}. The archive is still browsable if you reload.`;
});
