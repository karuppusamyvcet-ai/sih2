/* ==========================================================================
   animator.js — the character's animation set.

   Every clip named in Documentation/01 and character_spec.json is implemented
   here as a parametric pose (a function of time returning bone rotations).
   Poses are treated as *offsets from the A-pose bind*, so the 12° arm drop set
   by the builder is preserved.

   Transitions are damped rather than cut: the animator eases the live pose
   toward the target pose, which gives smooth Idle→Walk→Interact→Read→Talk
   changes without hand-authored transition clips, and no popping at any frame
   rate. Additive head/neck look-at is layered on top so the character can look
   at an exhibit while walking.

   Clips: Idle_Breathe, Idle_Stand, Walk, Walk_Carry_Book, Run_FastWalk,
   Turn_Left, Turn_Right, Look_At_Exhibit, Point_At_Exhibit, Speak, Listen,
   Read_Standing, Examine_Manuscript, Interact_Press, Sit_Idle, Sit_Read,
   Door_Enter, Door_Exit, Greet, Think, Explain_Gesture, Take_Notes,
   Book_Open, Book_Close, Presentation_Lecture.
   ========================================================================== */

const s = Math.sin, c = Math.cos;
const D = (deg) => (deg * Math.PI) / 180;

/** helper: blend between two angles */
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

export const CLIPS = {
  Idle_Breathe: (t) => ({
    Spine: [D(0.7) * s(t * 1.1), D(0.5) * s(t * 0.6), 0],
    Chest: [D(-0.6) * s(t * 1.1 + 0.4), 0, 0],
    Head: [D(0.5) * s(t * 0.7), D(1.1) * s(t * 0.32), 0],
    UpperArm_L: [0, 0, D(0.8) * s(t * 1.05)],
    UpperArm_R: [0, 0, D(-0.8) * s(t * 1.05 + 0.6)]
  }),
  Idle_Stand: (t) => ({
    Head: [0, D(1.6) * s(t * 0.28), 0],
    Spine: [0, D(0.6) * s(t * 0.2), 0]
  }),
  Walk: (t, ctx = {}) => {
    const p = t * 7.2;
    const amp = 0.9;
    return {
      UpperLeg_L: [D(24) * s(p), 0, 0],
      UpperLeg_R: [D(-24) * s(p), 0, 0],
      LowerLeg_L: [-Math.max(0, D(30) * s(p - 0.7)), 0, 0],
      LowerLeg_R: [-Math.max(0, D(-30) * s(p - 0.7)), 0, 0],
      Foot_L: [D(8) * s(p + 0.6), 0, 0],
      Foot_R: [D(-8) * s(p + 0.6), 0, 0],
      UpperArm_L: [D(-18) * s(p) * amp, 0, D(3)],
      UpperArm_R: [D(18) * s(p) * amp, 0, D(-3)],
      LowerArm_L: [-D(14) - D(8) * s(p), 0, 0],
      LowerArm_R: [-D(14) - D(8) * s(p + Math.PI), 0, 0],
      Spine: [D(1.5), D(4) * s(p), 0],
      Chest: [0, 0, D(2) * s(p)],
      Hips: [0, D(-3) * s(p), 0],
      Head: [0, D(-2.5) * s(p), 0],
      _bob: Math.abs(s(p)) * 0.018 + (ctx.run ? 0.01 : 0)
    };
  },
  Run_FastWalk: (t) => {
    const p = t * 10.4;
    return {
      UpperLeg_L: [D(38) * s(p), 0, 0],
      UpperLeg_R: [D(-38) * s(p), 0, 0],
      LowerLeg_L: [-Math.max(0, D(52) * s(p - 0.6)), 0, 0],
      LowerLeg_R: [-Math.max(0, D(-52) * s(p - 0.6)), 0, 0],
      Foot_L: [D(14) * s(p + 0.5), 0, 0],
      Foot_R: [D(-14) * s(p + 0.5), 0, 0],
      UpperArm_L: [D(-34) * s(p), 0, D(6)],
      UpperArm_R: [D(34) * s(p), 0, D(-6)],
      LowerArm_L: [-D(52), 0, 0],
      LowerArm_R: [-D(52), 0, 0],
      Spine: [D(5), 0, 0],
      Chest: [D(3), 0, 0],
      Head: [D(-3), 0, 0],
      _bob: Math.abs(s(p)) * 0.035
    };
  },
  Walk_Carry_Book: (t) => {
    const p = t * 6.6;
    return {
      UpperLeg_L: [D(20) * s(p), 0, 0],
      UpperLeg_R: [D(-20) * s(p), 0, 0],
      LowerLeg_L: [-Math.max(0, D(26) * s(p - 0.7)), 0, 0],
      LowerLeg_R: [-Math.max(0, D(-26) * s(p - 0.7)), 0, 0],
      UpperArm_L: [-D(62), D(-18), D(-34)],
      UpperArm_R: [-D(62), D(18), D(34)],
      LowerArm_L: [-D(72), 0, D(-14)],
      LowerArm_R: [-D(72), 0, D(14)],
      Spine: [D(2), 0, 0],
      _bob: Math.abs(s(p)) * 0.014
    };
  },
  Turn_Left: () => ({ Hips: [0, D(18), 0], Chest: [0, D(14), 0], Head: [0, D(10), 0] }),
  Turn_Right: () => ({ Hips: [0, D(-18), 0], Chest: [0, D(-14), 0], Head: [0, D(-10), 0] }),
  Look_At_Exhibit: (t) => ({
    Spine: [D(-3), 0, 0],
    Chest: [D(-4), 0, 0],
    Head: [D(-9), 0, 0],
    UpperArm_L: [-D(10), 0, D(2)],
    UpperArm_R: [-D(10), 0, D(-2)]
  }),
  Point_At_Exhibit: (t) => ({
    Spine: [D(-2), D(-8), 0],
    Chest: [D(-3), D(-6), 0],
    UpperArm_R: [-D(78), D(-16), D(-8)],
    LowerArm_R: [-D(6), 0, 0],
    Hand_R: [0, 0, D(-8)],
    UpperArm_L: [D(6), 0, 0],
    Head: [D(-4), D(-6), 0]
  }),
  Speak: (t) => {
    const g = s(t * 2.1), g2 = s(t * 3.3 + 1.2);
    return {
      Spine: [D(1.2) * g, D(2.4) * g, 0],
      Chest: [D(0.8) * g2, 0, 0],
      Head: [D(2) * g2, D(4) * s(t * 0.9), 0],
      UpperArm_L: [-D(16) - D(10) * g, 0, D(10) + D(6) * g],
      UpperArm_R: [-D(16) - D(10) * g2, 0, -D(10) - D(6) * g2],
      LowerArm_L: [-D(46) - D(16) * g, 0, D(12)],
      LowerArm_R: [-D(46) - D(16) * g2, 0, -D(12)],
      Hand_L: [0, 0, D(6) * g],
      Hand_R: [0, 0, D(-6) * g2]
    };
  },
  Listen: (t) => ({
    Spine: [D(2), D(3), 0],
    Chest: [D(1), D(2), 0],
    Head: [D(3) + D(1.2) * s(t * 0.8), D(6), D(2)],
    UpperArm_L: [D(4), 0, D(4)],
    UpperArm_R: [-D(8), 0, -D(6)],
    LowerArm_R: [-D(54), 0, -D(10)]
  }),
  Read_Standing: (t) => ({
    Spine: [D(6), 0, 0],
    Chest: [D(6), 0, 0],
    Head: [D(14), 0, 0],
    UpperArm_L: [-D(58), D(-12), D(-30)],
    UpperArm_R: [-D(58), D(12), D(30)],
    LowerArm_L: [-D(66), 0, D(-12)],
    LowerArm_R: [-D(66), 0, D(12)],
    _bob: s(t * 1.6) * 0.002
  }),
  Examine_Manuscript: (t) => ({
    Spine: [D(14), 0, 0],
    Chest: [D(10), 0, 0],
    Head: [D(20), D(3) * s(t * 0.5), 0],
    UpperArm_L: [-D(52), D(-14), D(-26)],
    UpperArm_R: [-D(58), D(14), D(30)],
    LowerArm_L: [-D(60), 0, D(-10)],
    LowerArm_R: [-D(48), 0, D(6)],
    UpperLeg_L: [D(4), 0, 0],
    UpperLeg_R: [-D(3), 0, 0]
  }),
  Interact_Press: (t) => {
    const reach = Math.min(1, t * 2.4);
    return {
      Spine: [D(-4) * reach, D(-6) * reach, 0],
      Chest: [D(-3) * reach, 0, 0],
      UpperArm_R: [-D(84) * reach, D(-10) * reach, -D(6)],
      LowerArm_R: [-D(16) * reach, 0, 0],
      Hand_R: [D(10) * reach, 0, 0],
      UpperArm_L: [D(4), 0, 0],
      Head: [D(4) * reach, D(-4) * reach, 0]
    };
  },
  Sit_Idle: (t) => ({
    _rootY: -0.47,
    UpperLeg_L: [D(-84), D(4), 0],
    UpperLeg_R: [D(-84), D(-4), 0],
    LowerLeg_L: [D(80), 0, 0],
    LowerLeg_R: [D(80), 0, 0],
    Foot_L: [D(4), 0, 0],
    Foot_R: [D(4), 0, 0],
    Spine: [D(4) + D(1) * s(t * 1.2), 0, 0],
    Chest: [D(2), 0, 0],
    Head: [D(-2) + D(1) * s(t * 0.8), D(4) * s(t * 0.3), 0],
    UpperArm_L: [-D(24), 0, D(10)],
    UpperArm_R: [-D(24), 0, -D(10)],
    LowerArm_L: [-D(56), 0, D(9)],
    LowerArm_R: [-D(56), 0, -D(9)]
  }),
  Sit_Read: (t) => ({
    _rootY: -0.47,
    UpperLeg_L: [D(-84), D(4), 0],
    UpperLeg_R: [D(-84), D(-4), 0],
    LowerLeg_L: [D(80), 0, 0],
    LowerLeg_R: [D(80), 0, 0],
    Spine: [D(10), 0, 0],
    Chest: [D(8), 0, 0],
    Head: [D(16), 0, 0],
    UpperArm_L: [-D(56), D(-10), D(-22)],
    UpperArm_R: [-D(56), D(10), D(22)],
    LowerArm_L: [-D(64), 0, D(-10)],
    LowerArm_R: [-D(64), 0, D(10)]
  }),
  Door_Enter: (t) => {
    const p = t * 6.4;
    return {
      UpperLeg_L: [D(22) * s(p), 0, 0],
      UpperLeg_R: [D(-22) * s(p), 0, 0],
      LowerLeg_L: [-Math.max(0, D(26) * s(p - 0.7)), 0, 0],
      LowerLeg_R: [-Math.max(0, D(-26) * s(p - 0.7)), 0, 0],
      UpperArm_L: [D(-14) * s(p), 0, D(6)],
      UpperArm_R: [D(14) * s(p), 0, -D(6)],
      Spine: [D(3), 0, 0],
      Head: [D(-4), 0, 0],
      _bob: Math.abs(s(p)) * 0.016
    };
  },
  Door_Exit: (t) => {
    const p = t * 6.0 + 1.4;
    return {
      UpperLeg_L: [D(20) * s(p), 0, 0],
      UpperLeg_R: [D(-20) * s(p), 0, 0],
      Spine: [0, D(6), 0],
      Head: [0, D(10), 0],
      UpperArm_L: [D(-12) * s(p), 0, D(4)],
      UpperArm_R: [D(12) * s(p), 0, -D(4)],
      _bob: Math.abs(s(p)) * 0.014
    };
  },
  Greet: (t) => {
    const wave = s(t * 5.4);
    return {
      UpperArm_R: [-D(112), 0, -D(16)],
      LowerArm_R: [-D(46) + D(16) * wave, 0, D(10) * wave],
      Hand_R: [0, 0, D(14) * wave],
      UpperArm_L: [-D(8), 0, D(4)],
      Head: [D(3), D(-6), 0],
      Spine: [0, D(-5), 0]
    };
  },
  Think: (t) => ({
    Spine: [D(3), D(-4), 0],
    Chest: [D(2), 0, 0],
    Head: [D(-6) + D(2) * s(t * 0.7), D(-8), D(-2)],
    UpperArm_R: [-D(64), D(-20), D(-28)],
    LowerArm_R: [-D(96), 0, -D(16)],
    Hand_R: [D(18), D(10), 0],
    UpperArm_L: [D(6), 0, D(6)],
    LowerArm_L: [-D(22), 0, 0]
  }),
  Explain_Gesture: (t) => {
    const g = s(t * 1.6);
    return {
      Spine: [D(2), D(5) * g, 0],
      Chest: [D(1), 0, 0],
      Head: [D(2), D(8) * g, 0],
      UpperArm_L: [-D(46) - D(14) * g, 0, D(24)],
      LowerArm_L: [-D(30), 0, D(24) ],
      Hand_L: [0, 0, D(18) * g],
      UpperArm_R: [-D(30) + D(12) * g, 0, -D(18)],
      LowerArm_R: [-D(58), 0, -D(14)]
    };
  },
  Take_Notes: (t) => {
    const w = s(t * 6.2);
    return {
      Spine: [D(8), 0, 0],
      Chest: [D(7), 0, 0],
      Head: [D(17), D(2), 0],
      UpperArm_L: [-D(62), D(-16), D(-24)],
      LowerArm_L: [-D(74), 0, D(-12)],
      UpperArm_R: [-D(54), D(14), D(20)],
      LowerArm_R: [-D(70) + D(5) * w, 0, D(10)],
      Hand_R: [D(4) * w, 0, 0]
    };
  },
  Book_Open: (t) => {
    const o = Math.min(1, t * 2.2);
    return {
      Spine: [D(5) * o, 0, 0],
      Head: [D(10) * o, 0, 0],
      UpperArm_L: [-D(56) * o, D(-14) * o, D(-26) * o],
      UpperArm_R: [-D(56) * o, D(14) * o, D(26) * o],
      LowerArm_L: [-D(62) * o, 0, D(-10)],
      LowerArm_R: [-D(62) * o, 0, D(10)]
    };
  },
  Book_Close: (t) => {
    const o = 1 - Math.min(1, t * 2.6);
    return {
      Spine: [D(5) * o, 0, 0],
      Head: [D(10) * o, 0, 0],
      UpperArm_L: [-D(56) * o, 0, D(-26) * o],
      UpperArm_R: [-D(56) * o, 0, D(26) * o],
      LowerArm_L: [-D(54) * o, 0, D(-10)],
      LowerArm_R: [-D(54) * o, 0, D(10)]
    };
  },
  Presentation_Lecture: (t) => {
    const g = s(t * 1.1);
    return {
      Spine: [D(1), D(-4) * g, 0],
      Chest: [D(1), 0, 0],
      Head: [D(2), D(-8) * g, 0],
      UpperArm_R: [-D(58) - D(10) * g, D(-8), -D(14)],
      LowerArm_R: [-D(24), 0, 0],
      Hand_R: [0, 0, D(6) * g],
      UpperArm_L: [D(8), 0, D(12)],
      LowerArm_L: [-D(30), 0, D(8)]
    };
  }
};

export class Animator {
  constructor(character) {
    this.character = character;
    this.clips = CLIPS;
    this.current = 'Idle_Breathe';
    this.previous = null;
    this.clipTime = 0;
    this.prevTime = 0;
    this.blend = 1;
    this.blendSpeed = 5.5;
    this.pose = {};        // live pose (offsets)
    this.target = {};      // target pose (offsets)
    this.bases = {};       // bind rotations
    this.lookAt = { yaw: 0, pitch: 0, weight: 0 };
    this.rootOffsetY = 0;
    this.carrying = false;

    const b = character.bones;
    for (const name of Object.keys(b)) {
      this.bases[name] = b[name].rotation.clone();
      this.pose[name] = [0, 0, 0];
    }
  }

  /** Switch clip. Blends unless the new clip is the same. */
  play(name, { blendSpeed = 5.5, restart = false } = {}) {
    if (!this.clips[name]) { console.warn(`[animator] unknown clip ${name}`); return; }
    if (name === this.current && !restart) { this.blendSpeed = blendSpeed; return; }
    this.previous = this.current;
    this.prevTime = this.clipTime;
    this.current = name;
    this.clipTime = 0;
    this.blendSpeed = blendSpeed;
    this.blend = 0;
  }

  setLook(yaw, pitch, weight) {
    this.lookAt.yaw = yaw; this.lookAt.pitch = pitch;
    this.lookAt.weight += (weight - this.lookAt.weight) * 0.16;
  }

  /** true when the given clip is the one currently playing */
  isPlaying(name) { return this.current === name; }

  update(dt, ctx = {}) {
    this.clipTime += dt;
    const fn = this.clips[this.current];
    this.target = fn ? { ...fn(this.clipTime, ctx) } : {};

    // root vertical offset (sitting, walk bob) is eased, never snapped
    const targetRoot = (this.target._rootY || 0) + (this.target._bob || 0);
    this.rootOffsetY += (targetRoot - this.rootOffsetY) * Math.min(1, dt * 6);

    // book prop visibility follows the carry state
    const wantsBook = ['Read_Standing', 'Examine_Manuscript', 'Walk_Carry_Book', 'Sit_Read', 'Take_Notes',
      'Book_Open', 'Book_Close'].includes(this.current);
    if (wantsBook !== this.carrying) {
      this.carrying = wantsBook;
      this.character.props.book.visible = wantsBook;
    }

    const t = Math.min(1, dt * this.blendSpeed);
    const bones = this.character.bones;
    for (const name of Object.keys(bones)) {
      const base = this.bases[name];
      const tgt = this.target[name] || [0, 0, 0];
      const cur = this.pose[name];
      cur[0] = lerpAngle(cur[0], tgt[0], t);
      cur[1] = lerpAngle(cur[1], tgt[1], t);
      cur[2] = lerpAngle(cur[2], tgt[2], t);
      bones[name].rotation.set(base.x + cur[0], base.y + cur[1], base.z + cur[2]);
    }

    // additive look-at on neck and head (used when examining exhibits)
    const w = this.lookAt.weight;
    if (w > 0.01) {
      const neck = bones.Neck, head = bones.Head;
      neck.rotation.y += this.lookAt.yaw * 0.35 * w;
      head.rotation.y += this.lookAt.yaw * 0.5 * w;
      head.rotation.x += this.lookAt.pitch * 0.5 * w;
    }

    // vertical bob for the whole figure
    this.character.root.position.y += (this.rootOffsetY - this.character.root.position.y) * Math.min(1, dt * 8);
  }

  /** Used by the camera in inspection mode and by the intro cinematic. */
  currentClipDuration() { return 1; }
}
