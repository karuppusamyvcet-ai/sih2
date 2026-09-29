/* Test double for three.js: everything is the real library except the renderer,
   which cannot exist without a GPU. Only the surface the game actually uses is
   implemented, so a headless boot exercises the real code paths. */
export * from './three.real.js';

export class WebGLRenderer {
  constructor({ canvas = null, antialias = true } = {}) {
    this.domElement = canvas || { addEventListener() {}, removeEventListener() {}, style: {}, getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) };
    this.shadowMap = { enabled: false, type: null };
    this.capabilities = { isWebGL2: true, getMaxAnisotropy: () => 1, maxTextures: 16 };
    this.info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } };
    this.antialias = antialias;
    this.outputColorSpace = 'srgb';
    this.toneMapping = 0;
    this.toneMappingExposure = 1;
    this.pixelRatio = 1;
    this._size = { width: 1280, height: 720 };
  }
  setPixelRatio(v) { this.pixelRatio = v; }
  setSize(w, h) { this._size = { width: w, height: h }; }
  getSize(v) { v?.set?.(this._size.width, this._size.height); return v || { ...this._size }; }
  setClearColor() {}
  setAnimationLoop(fn) {
    this._loop = fn;
    if (this._timer) clearInterval(this._timer);
    if (fn) this._timer = setInterval(() => { try { fn(); } catch (err) { console.error('[renderer loop]', err.message); } }, 16);
  }
  render() { this.info.render.calls += 1; }
  compile() {}
  dispose() { if (this._timer) clearInterval(this._timer); }
  getContext() { return {}; }
  getDrawingBufferSize(v) { v?.set?.(this._size.width, this._size.height); return v; }
}
