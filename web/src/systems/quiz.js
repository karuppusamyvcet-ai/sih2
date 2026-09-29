/* ==========================================================================
   quiz.js — the reusable assessment engine.

   Five question types, all data-driven from questions.json:
     multiple_choice · true_false · ordering · matching · image_identification

   Pedagogical rule implemented here, not in the UI: an item can only be marked
   once, the explanation and the citation are returned with every answer, and
   nothing is ever scored as simply "wrong" — the engine always carries the
   knowledge point back to the player (brief §63).
   ========================================================================== */

export class Quiz {
  constructor(content, state, quests, audio = null) {
    this.content = content;
    this.state = state;
    this.quests = quests;
    this.audio = audio;
    this.session = null;
  }

  start(questionIds, { title = 'Knowledge check', onFinish = null, onStage = null, kind = 'quiz' } = {}) {
    const questions = questionIds
      .map(id => this.content.questionsById.get(id))
      .filter(Boolean);
    this.session = {
      title, kind, onFinish, onStage,
      questions,
      index: 0,
      answers: [],
      correct: 0,
      attempted: 0,
      perfectSoFar: true,
      answered: false
    };
    return this.session;
  }

  get active() { return !!this.session; }
  get question() { return this.session?.questions[this.session.index] || null; }
  get total() { return this.session?.questions.length || 0; }
  get number() { return (this.session?.index || 0) + 1; }

  /** Submit an answer for the current question. Returns the graded result. */
  submit(payload) {
    const q = this.question;
    const s = this.session;
    if (!q || !s || s.answered) return null;

    let correct = false;
    let detail = '';

    switch (q.type) {
      case 'multiple_choice':
      case 'image_identification': {
        correct = payload.choice === q.answerId;
        detail = `You chose “${this.labelFor(q, payload.choice)}”.`;
        break;
      }
      case 'true_false': {
        correct = payload.bool === q.answerBool;
        detail = `You chose “${payload.bool ? 'True' : 'False'}”.`;
        break;
      }
      case 'ordering': {
        const given = payload.order || [];
        correct = given.length === q.correctOrder.length && given.every((id, i) => id === q.correctOrder[i]);
        detail = 'The correct order is shown below.';
        break;
      }
      case 'matching': {
        const pairs = q.pairs;
        const got = payload.pairs || {};
        correct = pairs.every(p => got[p.id] === p.right);
        const right = pairs.filter(p => got[p.id] === p.right).length;
        detail = `${right} of ${pairs.length} pairs matched correctly.`;
        break;
      }
      default: correct = false;
    }

    s.answered = true;
    s.attempted += 1;
    if (correct) s.correct += 1;
    else s.perfectSoFar = false;
    s.answers.push({ id: q.id, correct, payload });

    if (this.audio) this.audio.ui(correct ? 'correct' : 'wrong');
    this.quests?.notify('quiz', {
      questionId: q.id, correct, sessionPerfect: s.perfectSoFar && s.correct === s.questions.length
    });

    return {
      correct,
      detail,
      explanation: q.explanation,
      source: q.source,
      archiveRefs: q.archiveRefs || [],
      answerText: this.correctAnswerText(q),
      points: correct ? (q.points || this.content.questions.defaultPoints || 10) : 0
    };
  }

  labelFor(q, id) {
    if (!id) return '—';
    const opt = (q.options || []).find(o => o.id === id);
    return opt ? opt.text : id;
  }

  correctAnswerText(q) {
    switch (q.type) {
      case 'multiple_choice':
      case 'image_identification':
        return this.labelFor(q, q.answerId);
      case 'true_false':
        return q.answerBool ? 'True' : 'False';
      case 'ordering':
        return q.correctOrder.map((id, i) => `${i + 1}. ${q.items.find(it => it.id === id)?.text || id}`).join('\n');
      case 'matching':
        return q.pairs.map(p => `${p.left} → ${p.right}`).join('\n');
      default: return '';
    }
  }

  /** Move to the next question. Returns false when the session is finished. */
  advance() {
    const s = this.session;
    if (!s) return false;
    s.answered = false;
    s.index += 1;
    if (s.index >= s.questions.length) {
      const summary = {
        title: s.title, kind: s.kind, correct: s.correct, attempted: s.attempted,
        total: s.questions.length, perfect: s.perfectSoFar
      };
      const cb = s.onFinish;
      this.session = null;
      cb?.(summary);
      return false;
    }
    s.onStage?.(s.index + 1);
    return true;
  }

  abandon() { this.session = null; }

  /** Quiz groups used by the exhibit kiosks and the final challenge. */
  groupFor(quizIds) { return quizIds.filter(id => this.content.questionsById.has(id)); }

  finalChallengeStages() {
    const q = this.content.questions;
    const stages = [
      { stage: 1, label: 'Identify the historical topic', ids: ['q_final_1'] },
      { stage: 2, label: 'Match archive entries with their descriptions', ids: ['q_match_memorials'] },
      { stage: 3, label: 'Arrange the timeline items', ids: ['q_final_4'] },
      { stage: 4, label: 'Constitutional questions', ids: ['q_final_2', 'q_final_3'] },
      { stage: 5, label: 'Identify the documents', ids: ['q_img_preamble', 'q_img_rights'] },
      { stage: 6, label: 'Final knowledge questions', ids: ['q_final_5', 'q_final_6'] }
    ];
    return stages
      .map(s => ({ ...s, ids: s.ids.filter(id => q.questions.some(x => x.id === id)) }))
      .filter(s => s.ids.length);
  }
}
