/* ==========================================================================
   audio.js — museum sound, generated at runtime.

   No audio files ship with the build. Ambience, music and every sound effect
   are synthesised with the Web Audio API, which keeps the repository free of
   third-party audio and keeps the download small. Narration uses the platform
   speech synthesiser when one is available — always with subtitles, because
   subtitles are the accessible path and a synthetic voice is not a substitute.

   Music is deliberately restrained: a slow four-chord pad that never rises
   above the narration (the mix keeps voice loudest, ambience under both).
   ========================================================================== */

export class Audio {
  constructor(state) {
    this.state = state;
    this.ctx = null;
    this.master = null;
    this.buses = {};
    this.started = false;
    this.musicTimer = null;
    this.ambienceNodes = [];
    this.lastFootstep = 0;
    this.voices = [];
    this.speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  async start() {
    if (this.started) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { console.warn('[audio] Web Audio unavailable — continuing silently.'); return; }
      this.ctx = new Ctx();
      await this.ctx.resume?.();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.state.settings.master;
      this.master.connect(this.ctx.destination);

      const mk = (v) => { const g = this.ctx.createGain(); g.gain.value = v; g.connect(this.master); return g; };
      this.buses = { music: mk(this.state.settings.music * 0.5), sfx: mk(this.state.settings.sfx), voice: mk(this.state.settings.voice), ambience: mk(0.5) };

      this.started = true;
      this.startAmbience();
      this.startMusic();
      this.applySettings();
    } catch (err) {
      console.warn('[audio] could not initialise:', err.message);
    }
  }

  applySettings() {
    if (!this.started) return;
    const s = this.state.settings;
    this.master.gain.value = s.master;
    this.buses.music.gain.value = s.music * 0.5;
    this.buses.sfx.gain.value = s.sfx;
    this.buses.voice.gain.value = s.voice;
    if (s.music <= 0.001 && this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    else if (s.music > 0.001 && !this.musicTimer) this.startMusic();
  }

  // ------------------------------------------------------------ ambience
  /** Low museum room tone: filtered noise + a very soft drone. */
  startAmbience() {
    if (!this.started) return;
    const ctx = this.ctx;
    const bufferSize = 4 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer; noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.5;
    noise.connect(lp).connect(ng).connect(this.buses.ambience);
    noise.start();

    const drone = ctx.createOscillator(); drone.type = 'sine'; drone.frequency.value = 55;
    const dg = ctx.createGain(); dg.gain.value = 0.05;
    drone.connect(dg).connect(this.buses.ambience); drone.start();
    this.ambienceNodes = [noise, drone];
  }

  // -------------------------------------------------------------- music
  /** Four soft chords, one every eight seconds, in a minor-key heritage register. */
  startMusic() {
    if (!this.started || this.musicTimer) return;
    const chords = [
      [146.83, 220.0, 293.66],   // D minor
      [130.81, 196.0, 261.63],   // C major
      [116.54, 174.61, 233.08],  // A# major
      [98.0, 146.83, 196.0]      // G major
    ];
    let i = 0;
    const play = () => {
      if (!this.started || this.state.settings.music <= 0.001) return;
      const ctx = this.ctx;
      const notes = chords[i % chords.length];
      i += 1;
      notes.forEach((f, k) => {
        const o = ctx.createOscillator(); o.type = k === 0 ? 'sine' : 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        const t = ctx.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.11 / (k + 1), t + 2.2);
        g.gain.linearRampToValueAtTime(0, t + 9.5);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
        o.connect(g).connect(lp).connect(this.buses.music);
        o.start(t); o.stop(t + 10);
      });
    };
    play();
    this.musicTimer = setInterval(play, 8000);
  }

  // ------------------------------------------------------------ one-shots
  tone({ freq = 440, type = 'sine', dur = 0.18, gain = 0.22, bus = 'sfx', slide = 0, delay = 0 }) {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.buses[bus] || this.buses.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.22, gain = 0.16, freq = 900, q = 1.2, bus = 'sfx' }) {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(bp).connect(g).connect(this.buses[bus] || this.buses.sfx);
    src.start(t);
  }

  ui(kind = 'click') {
    switch (kind) {
      case 'click': this.tone({ freq: 620, dur: 0.07, gain: 0.14, type: 'triangle' }); break;
      case 'open': this.tone({ freq: 440, dur: 0.22, gain: 0.16, slide: 260, type: 'sine' }); break;
      case 'close': this.tone({ freq: 520, dur: 0.18, gain: 0.14, slide: -180, type: 'sine' }); break;
      case 'correct': [660, 880, 1180].forEach((f, i) => this.tone({ freq: f, dur: 0.26, gain: 0.15, delay: i * 0.09, type: 'sine' })); break;
      case 'wrong': this.tone({ freq: 220, dur: 0.34, gain: 0.16, slide: -60, type: 'triangle' }); break;
      case 'collect': [720, 1080].forEach((f, i) => this.tone({ freq: f, dur: 0.3, gain: 0.13, delay: i * 0.1 })); break;
      case 'page': this.noise({ dur: 0.16, gain: 0.13, freq: 2400, q: 0.8 }); break;
      case 'door': this.tone({ freq: 90, dur: 1.5, gain: 0.2, type: 'sine', slide: 30 }); this.noise({ dur: 0.7, gain: 0.08, freq: 300 }); break;
      case 'achievement': [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.5, gain: 0.13, delay: i * 0.12, type: 'triangle' })); break;
      case 'error': this.tone({ freq: 160, dur: 0.26, gain: 0.14, type: 'square' }); break;
      default: this.tone({ freq: 520, dur: 0.1, gain: 0.12 });
    }
  }

  footstep(intensity = 1) {
    const now = performance.now();
    if (now - this.lastFootstep < 320) return;
    this.lastFootstep = now;
    this.noise({ dur: 0.11, gain: 0.05 * intensity, freq: 420 + Math.random() * 160, q: 1.4 });
  }

  exhibitChime() { this.tone({ freq: 520, dur: 0.5, gain: 0.1, type: 'sine' }); this.tone({ freq: 780, dur: 0.4, gain: 0.05, type: 'sine', delay: 0.08 }); }

  // ------------------------------------------------------------ narration
  /**
   * Speak a line of narration, always with subtitles. Returns a promise that
   * resolves when the line finishes (or immediately when unsupported, so the
   * calling code never stalls on a missing voice).
   */
  narrate(text, { onSubtitle, onEnd } = {}) {
    onSubtitle?.(text);
    const volume = this.state.settings.voice * this.state.settings.master;
    if (!this.speechSupported || !this.state.settings.narration || volume <= 0.02 || !text) {
      const ms = Math.max(2200, text.length * 55);
      const id = setTimeout(() => onEnd?.(), ms);
      return { cancel: () => clearTimeout(id) };
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.94; u.pitch = 0.95; u.volume = Math.min(1, volume);
      const preferred = { hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', en: 'en-IN' }[this.state.settings.language] || 'en-IN';
      const voices = window.speechSynthesis.getVoices();
      const v = voices.find(x => x.lang === preferred) || voices.find(x => x.lang?.startsWith(preferred.slice(0, 2))) || voices.find(x => x.lang?.startsWith('en'));
      if (v) u.voice = v;
      u.onend = () => onEnd?.();
      u.onerror = () => onEnd?.();
      window.speechSynthesis.speak(u);
      return { cancel: () => window.speechSynthesis.cancel() };
    } catch (err) {
      console.warn('[audio] narration unavailable:', err.message);
      onEnd?.();
      return { cancel: () => {} };
    }
  }

  stopNarration() { if (this.speechSupported) { try { window.speechSynthesis.cancel(); } catch (_) { /* ignore */ } } }

  suspend() { if (this.started) this.ctx.suspend?.(); }
  resume() { if (this.started) this.ctx.resume?.(); }
}
