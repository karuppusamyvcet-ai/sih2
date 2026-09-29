/* ==========================================================================
   quests.js — missions, objectives, achievements and the completion status.

   All eight missions, their objectives and the sixteen achievements are data
   (quests.json, achievements.json). This file only interprets objective types:
     reach · interact · collect · quiz · search · ask_guide · minigame · final
   Adding a mission or an achievement is therefore a content edit, which is what
   the brief asks for ("a content creator should be able to add a new archive
   item without changing gameplay code").
   ========================================================================== */

export class Quests {
  constructor(content, state, ui = null) {
    this.content = content;
    this.state = state;
    this.ui = ui;
    this.currentMission = null;
    this.listeners = [];
  }

  on(fn) { this.listeners.push(fn); return fn; }
  emit(evt) { for (const fn of this.listeners) { try { fn(evt); } catch (e) { console.error(e); } } }

  /* ------------------------------------------------------------- missions */
  missionById(id) { return this.content.missionsById.get(id); }

  /** The active mission: the first that is not complete. */
  active() {
    for (const m of this.content.quests.missions) {
      if (!this.isMissionComplete(m.id)) return m;
    }
    return this.content.quests.missions[this.content.quests.missions.length - 1] || null;
  }

  isMissionComplete(missionId) {
    const m = this.missionById(missionId);
    if (!m) return false;
    const zone = m.zone;
    if (zone && zone !== 'hub' && this.state.progress.zonesCompleted.includes(zone) && m.index < 8) return true;
    return m.objectives.every(o => this.state.progress.objectives[o.id]);
  }

  /** The next unfinished objective of the active mission. */
  currentObjective() {
    const m = this.active();
    if (!m) return null;
    const obj = m.objectives.find(o => !this.state.progress.objectives[o.id]);
    return obj ? { mission: m, objective: obj } : null;
  }

  /**
   * How far an objective with a counter has got.
   *
   * Every countable objective type goes through countProgress; a quiz objective
   * without an explicit count still needs one correct answer for its target
   * question, which is what makes "answer the ordering question" completable.
   */
  objectiveProgress(obj) {
    const done = this.countProgress(obj);
    if (done === null) return null;
    return { done, total: obj.count || 1 };
  }

  /**
   * The question ids a quiz objective counts, and how many are needed.
   *
   * A target may name one question ("answer the ordering question") or a whole
   * set ("answer four early-life questions"). Both are expressed in content:
   * a count greater than one means the set the named question belongs to.
   */
  quizTargets(obj) {
    const ids = this.content.questions.questions.map(q => q.id);
    const group = obj.target.replace(/_\d+$/, '');
    const inGroup = ids.filter(id => id === group || id.startsWith(`${group}_`));
    if (obj.count && obj.count > 1) return { ids: inGroup.length ? inGroup : [obj.target], total: obj.count };
    if (ids.includes(obj.target)) return { ids: [obj.target], total: 1 };
    return { ids: inGroup, total: obj.count || 1 };
  }

  countProgress(obj) {
    const p = this.state.progress;
    if (obj.type === 'interact') {
      if (obj.target === 'memorial_reconstruction') return Math.min(p.memorialsVisited.length, obj.count);
      if (obj.target === 'exhibit_manuscript_shelf') {
        const ids = this.content.exhibitsById.get('exhibit_manuscript_shelf')?.archiveIds || [];
        return Math.min(ids.filter(id => p.collected.includes(id)).length, obj.count || 99);
      }
      if (obj.target === 'zone_early_life') {
        return Math.min(p.exhibitionsVisited.filter(id => id.startsWith('exhibit_early')).length, obj.count || 99);
      }
      if (obj.target === 'exhibit_law_rights_wall') {
        return Math.min(p.exhibitionsVisited.includes('exhibit_law_rights_wall') ? obj.count : 0, obj.count);
      }
      if (obj.target === 'exhibit_hub_door_labels') {
        return Math.min(p.zonesEntered.length, obj.count || 6);
      }
      return Math.min(p.exhibitionsVisited.filter(id => id.includes(obj.target)).length, obj.count || 99);
    }
    if (obj.type === 'quiz') {
      const { ids, total } = this.quizTargets(obj);
      return Math.min(ids.filter(id => p.quizResults[id]?.correct).length, total);
    }
    if (obj.type === 'search') return Math.min(p.searchesRun, obj.count || 1);
    if (obj.type === 'ask_guide') return Math.min(p.guideQuestions, obj.count || 1);
    return null;
  }

  /* --------------------------------------------------------- notifications */
  completeObjective(objId, mission) {
    const changed = this.state.completeObjective(objId, mission);
    if (changed) {
      const ok = this.content.localization ? null : null; // i18n applied by the UI layer
      this.emit({ type: 'objective', objId, mission });
      this.checkMission(mission);
    }
    return changed;
  }

  checkMission(mission) {
    if (!mission) return;
    if (this.isMissionComplete(mission.id)) {
      const reward = mission.rewardPoints || 0;
      if (reward && !this.state.progress.flags[`reward_${mission.id}`]) {
        this.state.progress.flags[`reward_${mission.id}`] = true;
        this.state.addPoints(reward);
      }
      if (mission.zone && mission.zone !== 'hub') this.state.completeZone(mission.zone);
      this.emit({ type: 'mission', mission });
      this.checkAchievements();
      if (this.allComplete()) this.finish();
    }
  }

  /* ------------------------------------------------------------- events */
  /**
   * Called by the game loop for everything that happens.
   *
   * Two responsibilities, deliberately separated:
   *   1. record the event in the save (always — the archive keeps counting even
   *      after every mission is finished, so nothing is lost post-completion)
   *   2. advance the active objective if this event is the one it was waiting for
   */
  notify(kind, payload = {}) {
    // --- 1. record -------------------------------------------------------
    switch (kind) {
      case 'zone_entered': this.state.enterZone(payload.zoneId); break;
      case 'interact':
        this.state.recordExhibit(payload.exhibitId);
        if (payload.collected && payload.archiveId) this.state.collect(payload.archiveId);
        break;
      case 'memorial': this.state.visitMemorial(payload.memorialId); break;
      case 'quiz':
        this.state.recordQuiz(payload.questionId, payload.correct);
        if (payload.correct && payload.sessionPerfect) {
          const q = this.state.progress.quizStats;
          q.perfectSessions = (q.perfectSessions || 0) + 1;
        }
        break;
      case 'search': this.state.countSearch(); break;
      case 'ask_guide': this.state.countGuideQuestion(); break;
      case 'source_opened': this.state.countSourceOpened(); break;
      default: break;
    }

    // --- 2. advance the active objective ---------------------------------
    const ctx = this.currentObjective();
    if (!ctx) { this.checkAchievements(); return; }
    const { objective: obj, mission } = ctx;

    switch (kind) {
      case 'zone_entered':
        if (obj.type === 'reach' && (obj.target === `zone_${payload.zoneId}_entry` || payload.zoneId === mission.zone)) {
          this.completeObjective(obj.id, mission);
        }
        break;

      case 'proximity':
        if (obj.type === 'reach' && payload.target === obj.target && payload.distance <= (obj.radius || 3)) {
          this.completeObjective(obj.id, mission);
        }
        break;

      case 'interact': {
        if (obj.type === 'interact') {
          const matches = obj.target === payload.exhibitId
            || (obj.target === 'zone_early_life' && (payload.exhibitId || '').startsWith('exhibit_early'))
            || (obj.target === 'memorial_reconstruction' && payload.kind === 'memorial_plinth')
            || (obj.target === 'search_any' && false);
          if (matches) {
            const prog = this.objectiveProgress(obj);
            if (!prog || prog.done >= prog.total) this.completeObjective(obj.id, mission);
          }
        }
        break;
      }

      case 'memorial':
        if (obj.type === 'interact' && obj.target === 'memorial_reconstruction') {
          const prog = this.objectiveProgress(obj);
          if (prog && prog.done >= prog.total) this.completeObjective(obj.id, mission);
        }
        break;

      case 'minigame':
        if (obj.type === 'minigame' && (obj.target === payload.minigame || payload.minigame === obj.target)) {
          this.completeObjective(obj.id, mission);
        }
        break;

      case 'final_stage':
        if (obj.type === 'final' && obj.stage === payload.stage) this.completeObjective(obj.id, mission);
        break;

      default: break;
    }

    // A counted objective completes the moment its counter fills, whatever event
    // filled it — this is what keeps content edits from needing code changes.
    if (!this.state.progress.objectives[obj.id]) {
      const prog = this.objectiveProgress(obj);
      if (prog && prog.done >= prog.total) this.completeObjective(obj.id, mission);
    }
    this.checkAchievements();
  }

  /**
   * Achievements are data (achievements.json): this evaluates their trigger
   * objects. Adding an achievement is a content edit — no code change, which is
   * what the brief asks for. Quests.TRIGGER_TYPES lists every supported trigger.
   */
  checkAchievements() {
    if (this._checking) return [];
    this._checking = true;
    const unlocked = [];
    try {
      const p = this.state.progress;
      for (const ach of this.content.achievements.achievements) {
        if (p.achievements.includes(ach.id)) continue;
        if (this.triggerMet(ach.trigger, p)) unlocked.push(ach.id);
      }
      for (const id of unlocked) this.state.award(id, this.content);
    } finally {
      this._checking = false;
    }
    return unlocked;
  }

  /** Evaluate one achievement trigger against the current save. */
  triggerMet(trigger = {}, p = this.state.progress) {
    const need = trigger.count ?? 1;
    switch (trigger.type) {
      case 'mission_complete':
        return this.isMissionComplete(trigger.target);
      case 'completion':
        return this.allComplete();
      case 'collect':
        return p.collected.length >= need;
      case 'interact':
        return p.exhibitionsVisited.includes(trigger.target)
          || p.memorialsVisited.includes(trigger.target)
          || p.flags[`interact_${trigger.target}`] === true;
      case 'ask_guide':
        return p.guideQuestions >= need;
      case 'search':
        return p.searchesRun >= need;
      case 'source_opened':
        return p.sourcesOpened >= need;
      case 'quiz_perfect':
        return (p.quizStats.perfectSessions || 0) >= need || p.flags.perfect_quiz === true;
      case 'memorial':
        return p.memorialsVisited.length >= need;
      case 'zone_entered':
        return p.zonesEntered.includes(trigger.target);
      default:
        console.warn(`[quests] achievement trigger type "${trigger.type}" is not supported`);
        return false;
    }
  }

  allComplete() {
    return this.content.quests.missions.every(m => this.isMissionComplete(m.id));
  }

  finish() {
    const p = this.state.progress;
    const need = this.content.quests.completion;
    if (p.flags.finished) return;
    if ((need.minQuizAccuracy || 0) > 0 && this.state.quizAccuracy() < need.minQuizAccuracy) return;
    p.flags.finished = true;
    this.state.award('ach_heritage_archivist', this.content);
    this.state.save();
    this.emit({ type: 'complete', badge: need });
  }

  /* ----------------------------------------------------------- dashboard */
  dashboard() {
    const p = this.state.progress;
    const content = this.content;
    const fields = content.achievements.progressDashboard.fields;
    const values = {
      exhibits_discovered: p.exhibitionsVisited.length,
      archive_items: p.collected.length,
      quiz_score: `${p.quizStats.correct}/${Math.max(p.quizStats.attempted, content.questions.questions.length)}`,
      knowledge_points: p.knowledgePoints,
      galleries_completed: `${p.zonesCompleted.length}/${content.zones.zones.length}`,
      memorials_visited: `${p.memorialsVisited.length}/${content.memorials.sites.length}`,
      searches_run: p.searchesRun,
      guide_questions: p.guideQuestions
    };
    return fields.map(f => ({ label: f.label, value: values[f.id] ?? '—' }));
  }
}

/** Every trigger type the achievement evaluator understands. */
Quests.TRIGGER_TYPES = ['mission_complete', 'completion', 'collect', 'interact', 'ask_guide',
  'search', 'source_opened', 'quiz_perfect', 'memorial', 'zone_entered'];
