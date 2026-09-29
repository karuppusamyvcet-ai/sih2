/* ==========================================================================
   input.js — one input surface for keyboard/mouse, gamepad and touch.

   The gameplay code asks Input.move(), Input.look(), Input.runHeld() and
   subscribes to actions; it never asks which platform it is on. That is the
   platform abstraction the brief requires, applied to input.

   PC   : WASD/arrows move · Shift run · Space jump · mouse look (click to
          capture, Esc release) · wheel zoom · E interact · Tab archive ·
          M map · G guide · F reduced effects · +/- text size · Esc menu
   Touch: left stick moves · drag anywhere on the right half looks · buttons
   Pad  : left stick move · right stick look · A interact · B jump · L3 run
   ========================================================================== */

export class Input {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.state = state;
    this.keys = new Set();
    this.moveVec = { x: 0, y: 0 };      // x = strafe, y = forward
    this.look = { dx: 0, dy: 0 };
    this.wheel = 0;
    this.run = false;
    this.touch = false;
    this.pointerLocked = false;
    this.dragging = false;
    this.actions = new Map();            // name -> Set(fn)
    this.touchLook = null;
    this.stick = null;
    this.zoomBoost = 0;

    this.detectPlatform();
    this.bindKeyboard();
    this.bindMouse();
    this.bindTouch();
    this.bindGamepad();
  }

  detectPlatform() {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const noHover = window.matchMedia('(hover: none)').matches;
    this.touch = coarse || noHover || ('ontouchstart' in window && window.innerWidth < 1100);
    document.body.classList.toggle('touch', this.touch);
  }

  on(action, fn) {
    if (!this.actions.has(action)) this.actions.set(action, new Set());
    this.actions.get(action).add(fn);
  }

  fire(action, payload) {
    for (const fn of this.actions.get(action) || []) { try { fn(payload); } catch (err) { console.error(err); } }
  }

  // ------------------------------------------------------------- keyboard
  bindKeyboard() {
    const map = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (map[e.code]) this.moveVec[map[e.code]] = 1;
      switch (e.code) {
        case 'ShiftLeft': case 'ShiftRight': this.run = true; break;
        case 'Space': this.fire('jump'); e.preventDefault(); break;
        case 'KeyE': this.fire('interact'); break;
        case 'Tab': this.fire('archive'); e.preventDefault(); break;
        case 'KeyM': this.fire('map'); break;
        case 'KeyG': this.fire('guide'); break;
        case 'KeyF': this.fire('reduceEffects'); break;
        case 'KeyJ': this.fire('objectives'); break;
        case 'Escape': this.fire('menu'); break;
        case 'Equal': case 'NumpadAdd': this.fire('textSize', +0.1); break;
        case 'Minus': case 'NumpadSubtract': this.fire('textSize', -0.1); break;
        case 'Enter': this.fire('confirm'); break;
        default: break;
      }
      this.fire('any');
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (map[e.code]) this.moveVec[map[e.code]] = 0;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.run = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.moveVec = { x: 0, y: 0 }; this.run = false; });
  }

  // ---------------------------------------------------------------- mouse
  bindMouse() {
    const canvas = this.canvas;
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        if (!this.touch && !this.pointerLocked && !document.body.classList.contains('ui-open')) {
          canvas.requestPointerLock?.();
        }
        this.dragging = true;
      }
      if (e.button === 2) this.fire('zoomToggle');
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked || this.dragging) {
        const s = this.state.settings.sensitivityMouse;
        this.look.dx += e.movementX * s;
        this.look.dy += e.movementY * s * (this.state.settings.invertY ? -1 : 1);
      }
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
  }

  // ---------------------------------------------------------------- touch
  bindTouch() {
    const stick = document.getElementById('touch-stick');
    const knob = document.getElementById('stick-knob');

    const stickStart = (e) => {
      const t = e.changedTouches[0];
      const r = stick.getBoundingClientRect();
      this.stick = { id: t.identifier, cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2 };
      stickMove(e);
    };
    const stickMove = (e) => {
      if (!this.stick) return;
      const t = [...e.changedTouches].find(x => x.identifier === this.stick.id);
      if (!t) return;
      let dx = t.clientX - this.stick.cx;
      let dy = t.clientY - this.stick.cy;
      const len = Math.hypot(dx, dy);
      const max = this.stick.r * 0.62;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      const nx = dx / max;
      const ny = dy / max;
      this.moveVec.l = nx < -0.18 ? 1 : 0;
      this.moveVec.r = nx > 0.18 ? 1 : 0;
      this.moveVec.f = ny < -0.18 ? 1 : 0;
      this.moveVec.b = ny > 0.18 ? 1 : 0;
      this.run = Math.hypot(nx, ny) > 0.82;
      if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
      e.preventDefault();
    };
    const stickEnd = () => {
      this.stick = null;
      this.moveVec = { x: 0, y: 0, f: 0, b: 0, l: 0, r: 0 };
      this.run = false;
      if (knob) knob.style.transform = '';
    };
    stick.addEventListener('touchstart', stickStart, { passive: false });
    stick.addEventListener('touchmove', stickMove, { passive: false });
    stick.addEventListener('touchend', stickEnd);
    stick.addEventListener('touchcancel', stickEnd);

    // look: drag on the viewport, outside the stick and the button cluster
    const canvas = this.canvas;
    canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.touchLook = { id: t.identifier, x: t.clientX, y: t.clientY };
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (!this.touchLook) return;
      const t = [...e.changedTouches].find(x => x.identifier === this.touchLook.id);
      if (!t) return;
      const s = this.state.settings.sensitivityTouch;
      this.look.dx += (t.clientX - this.touchLook.x) * s * 1.15;
      this.look.dy += (t.clientY - this.touchLook.y) * s * 1.15 * (this.state.settings.invertY ? -1 : 1);
      this.touchLook.x = t.clientX;
      this.touchLook.y = t.clientY;
      e.preventDefault();
    }, { passive: false });
    const lookEnd = () => { this.touchLook = null; };
    canvas.addEventListener('touchend', lookEnd);
    canvas.addEventListener('touchcancel', lookEnd);

    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (e) => { e.preventDefault(); fn(); });
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
    };
    bind('touch-interact', () => this.fire('interact'));
    bind('touch-map', () => this.fire('map'));
    bind('touch-archive', () => this.fire('archive'));
    bind('touch-run', () => this.fire('runToggle'));
  }

  // -------------------------------------------------------------- gamepad
  bindGamepad() {
    this.padPrev = {};
  }

  pollGamepad() {
    if (!navigator.getGamepads) return;
    const pad = [...navigator.getGamepads()].find(Boolean);
    if (!pad) return;
    const dz = (v) => (Math.abs(v) > 0.18 ? v : 0);
    const lx = dz(pad.axes[0] ?? 0), ly = dz(pad.axes[1] ?? 0);
    const rx = dz(pad.axes[2] ?? 0), ry = dz(pad.axes[3] ?? 0);
    if (lx || ly) {
      this.moveVec.l = lx < -0.2 ? 1 : 0; this.moveVec.r = lx > 0.2 ? 1 : 0;
      this.moveVec.f = ly < -0.2 ? 1 : 0; this.moveVec.b = ly > 0.2 ? 1 : 0;
    }
    if (rx || ry) { this.look.dx += rx * 9; this.look.dy += ry * 9; }
    this.run = this.run || !!(pad.buttons[10]?.pressed);
    const edge = (i, name) => {
      const p = !!pad.buttons[i]?.pressed;
      if (p && !this.padPrev[name]) this.fire(name);
      this.padPrev[name] = p;
    };
    edge(0, 'interact'); edge(1, 'jump'); edge(8, 'archive'); edge(9, 'menu'); edge(3, 'map');
  }

  // --------------------------------------------------------------- access
  move() {
    return {
      x: (this.moveVec.r || 0) - (this.moveVec.l || 0),
      y: (this.moveVec.f || 0) - (this.moveVec.b || 0)
    };
  }

  runHeld() { return this.run; }

  consumeLook() {
    const l = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = 0; this.look.dy = 0;
    return l;
  }

  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; }

  get platformLabel() { return this.touch ? 'Touch' : 'Keyboard + mouse'; }
}
