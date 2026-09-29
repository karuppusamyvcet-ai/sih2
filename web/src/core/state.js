/* ==========================================================================
   state.js — settings, progression and the save system.

   Saves are written to localStorage under a versioned key. A corrupted or
   unreadable save is never thrown away silently: the raw string is copied to a
   backup key and a new journey starts, which is what the error message says.
   Nothing here contacts the network.
   ========================================================================== */

const SAVE_KEY = 'heritage.save.v1';
const BACKUP_KEY = 'heritage.save.corrupt.v1';
const SETTINGS_KEY = 'heritage.settings.v1';

export const DEFAULT_SETTINGS = {
  master: 0.85, music: 0.5, voice: 0.9, sfx: 0.7,
  subtitles: true, narration: true,
  textScale: 1, contrast: false, reduceEffects: false, simplifiedControls: false,
  language: 'en',
  quality: 'auto',          // auto | low | medium | high
  sensitivityMouse: 1.0, sensitivityTouch: 1.0, invertY: false,
  vsync: true, fullscreen: false, showMinimap: true
};

export const DEFAULT_PROGRESS = () => ({
  version: 1,
  missionIndex: 0,
  objectives: {},            // objectiveId -> true
  collected: [],             // archive ids recorded in MY DIGITAL ARCHIVE
  quizResults: {},           // questionId -> { correct: bool, attempts: n }
  quizStats: { attempted: 0, correct: 0, perfectSessions: 0 },
  exhibitionsVisited: [],    // exhibit ids interacted with
  achievements: [],
  knowledgePoints: 0,
  zonesEntered: [],
  zonesCompleted: [],
  memorialsVisited: [],
  searchesRun: 0,
  guideQuestions: 0,
  sourcesOpened: 0,
  player: { x: 0, y: 0, z: -11.5, yaw: 0, zone: 'hub' },
  flags: { introSeen: false, demoMode: false, presentationMode: false, finished: false },
  playSeconds: 0
});

export class State {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.progress = DEFAULT_PROGRESS();
    this.listeners = { settings: [], progress: [], achievement: [], objective: [] };
    this.notices = [];
  }

  // ------------------------------------------------------------ loading
  loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (err) {
      console.warn('[state] settings unreadable, using defaults:', err.message);
      this.settings = { ...DEFAULT_SETTINGS };
    }
    return this.settings;
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); }
    catch (err) { console.warn('[state] could not persist settings:', err.message); }
    this.emit('settings');
  }

  /** Returns 'ok' | 'empty' | 'recovered' */
  loadProgress() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return 'empty';
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.player) throw new Error('save shape not recognised');
      this.progress = { ...DEFAULT_PROGRESS(), ...parsed,
        quizStats: { ...DEFAULT_PROGRESS().quizStats, ...(parsed.quizStats || {}) },
        flags: { ...DEFAULT_PROGRESS().flags, ...(parsed.flags || {}) },
        player: { ...DEFAULT_PROGRESS().player, ...(parsed.player || {}) } };
      return 'ok';
    } catch (err) {
      try { localStorage.setItem(BACKUP_KEY, raw); localStorage.removeItem(SAVE_KEY); } catch (_) { /* storage full */ }
      console.warn('[state] save recovered from a damaged file:', err.message);
      this.progress = DEFAULT_PROGRESS();
      return 'recovered';
    }
  }

  hasSave() { return !!localStorage.getItem(SAVE_KEY); }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.progress)); }
    catch (err) { console.warn('[state] save failed:', err.message); }
  }

  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ }
    this.progress = DEFAULT_PROGRESS();
    this.emit('progress');
  }

  exportJSON() { return JSON.stringify({ settings: this.settings, progress: this.progress }, null, 2); }

  importJSON(text) {
    const parsed = JSON.parse(text);
    if (parsed.settings) { this.settings = { ...DEFAULT_SETTINGS, ...parsed.settings }; this.saveSettings(); }
    if (parsed.progress) { this.progress = { ...DEFAULT_PROGRESS(), ...parsed.progress }; this.save(); this.emit('progress'); }
    return true;
  }

  // ------------------------------------------------------------- events
  on(kind, fn) { (this.listeners[kind] ||= []).push(fn); return fn; }
  emit(kind, payload) { for (const fn of this.listeners[kind] || []) { try { fn(payload); } catch (err) { console.error(err); } } }

  // -------------------------------------------------------- progression
  setSetting(key, value) {
    this.settings[key] = value;
    this.saveSettings();
  }

  get objectiveDone() { return this.progress.objectives; }

  completeObjective(objId, mission) {
    if (!objId || this.progress.objectives[objId]) return false;
    this.progress.objectives[objId] = true;
    this.emit('objective', { objId, mission });
    this.save();
    return true;
  }

  recordExhibit(exhibitId) {
    if (!exhibitId || this.progress.exhibitionsVisited.includes(exhibitId)) return false;
    this.progress.exhibitionsVisited.push(exhibitId);
    this.addPoints(5);
    return true;
  }

  collect(archiveId) {
    if (!archiveId || this.progress.collected.includes(archiveId)) return false;
    this.progress.collected.push(archiveId);
    this.addPoints(10);
    this.save();
    return true;
  }

  enterZone(zoneId) {
    if (!zoneId || this.progress.zonesEntered.includes(zoneId)) return false;
    this.progress.zonesEntered.push(zoneId);
    this.save();
    return true;
  }

  completeZone(zoneId) {
    if (!zoneId || this.progress.zonesCompleted.includes(zoneId)) return false;
    this.progress.zonesCompleted.push(zoneId);
    this.save();
    return true;
  }

  recordQuiz(questionId, correct) {
    const prev = this.progress.quizResults[questionId];
    this.progress.quizResults[questionId] = { correct, attempts: (prev?.attempts || 0) + 1 };
    this.progress.quizStats.attempted += 1;
    if (correct) { this.progress.quizStats.correct += 1; this.addPoints(10); }
    this.save();
    return !prev?.correct && correct;
  }

  visitMemorial(id) {
    if (this.progress.memorialsVisited.includes(id)) return false;
    this.progress.memorialsVisited.push(id);
    this.addPoints(15);
    this.save();
    return true;
  }

  countSearch() { this.progress.searchesRun += 1; this.save(); }
  countGuideQuestion() { this.progress.guideQuestions += 1; this.save(); }
  countSourceOpened() { this.progress.sourcesOpened += 1; this.save(); }

  addPoints(n) {
    this.progress.knowledgePoints += n;
    this.emit('progress');
    this.save();
  }

  award(achievementId, content) {
    if (this.progress.achievements.includes(achievementId)) return false;
    this.progress.achievements.push(achievementId);
    const def = content?.achievementsById.get(achievementId);
    if (def?.points) this.progress.knowledgePoints += def.points;
    this.emit('achievement', def || { id: achievementId, title: achievementId });
    this.emit('progress');
    this.save();
    return true;
  }

  setMissionIndex(i) { this.progress.missionIndex = Math.max(this.progress.missionIndex, i); this.save(); }

  quizAccuracy() {
    const { attempted, correct } = this.progress.quizStats;
    return attempted ? correct / attempted : 0;
  }
}
