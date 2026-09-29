#!/usr/bin/env node
/* ==========================================================================
   render_character.mjs — renders the generated character from the real builder,
   without a browser.

   The character is code-generated, so "does it look like him?" has to be
   answerable before a build reaches a phone. This tool walks the real object
   tree produced by web/src/char/builder.js and rasterises it on the CPU into
   PNG files: a full-body front view, a side view, and a head close-up.

   Usage (from the repository root):

     node web/tools/render_character.mjs [outDir]

   It writes front.png, side.png, threequarter.png and head.png. The renderer
   shades each triangle with a single directional light, so it is a likeness
   check and a proportion check — not a substitute for the game's own renderer.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');

/* three is vendored as a single file; a local node_modules entry maps the bare
   specifier the builder imports. node_modules is gitignored, so this is
   scaffolding for the tool rather than something the repository ships. */
function ensureThree() {
  const dir = path.join(WEB, 'node_modules', 'three');
  const entry = path.join(dir, 'index.js');
  if (fs.existsSync(entry)) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(WEB, 'vendor', 'three.module.js'), entry);
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ name: 'three', version: '0.160.1', type: 'module', main: 'index.js', exports: { '.': './index.js' } }, null, 2));
}

ensureThree();

/* The materials are canvas textures. In a browser they are drawn; here the
   renderer only needs the material *colours*, so the 2D context is stubbed out
   and the texture maps are ignored. */
function stubCanvas() {
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, {
    get: (target, key) => {
      if (key === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h });
      if (key === 'putImageData') return () => {};
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      if (key === 'measureText') return () => ({ width: 10 });
      if (key === 'canvas') return { width: 0, height: 0 };
      return () => {};
    },
    set: () => true
  });
  const element = () => ({ width: 0, height: 0, getContext: () => context, toDataURL: () => 'data:,' });
  globalThis.document = { createElement: element, createElementNS: element, documentElement: { style: {} } };
  globalThis.window = globalThis.window || { devicePixelRatio: 1, addEventListener() {} };
  globalThis.HTMLCanvasElement = function HTMLCanvasElement() {};
  globalThis.ImageData = function ImageData(w, h) { this.data = new Uint8ClampedArray(Math.max(4, (w || 1) * (h || 1) * 4)); };
}

stubCanvas();

const THREE = await import('three');
const { buildCharacter, measureCharacter } = await import(path.join(WEB, 'src', 'char', 'builder.js'));
const spec = JSON.parse(fs.readFileSync(path.join(WEB, 'content', 'character_spec.json'), 'utf8'));

/* ---------------------------------------------------------------- rasteriser */

const LIGHT = new THREE.Vector3(-0.45, 0.75, 0.9).normalize();

function collectTriangles(root) {
  const tris = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.isMesh || !object.visible) return;
    // skip the LOD tiers the current quality does not use
    let visible = true;
    for (let p = object; p; p = p.parent) if (!p.visible) visible = false;
    if (!visible) return;

    const geometry = object.geometry;
    const position = geometry.getAttribute('position');
    if (!position) return;
    const index = geometry.getIndex();
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const colour = material && material.color ? material.color : new THREE.Color(0.8, 0.8, 0.8);
    const alpha = material && material.transparent ? (material.opacity ?? 1) : 1;

    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 3) {
      const i0 = index ? index.getX(i) : i;
      const i1 = index ? index.getX(i + 1) : i + 1;
      const i2 = index ? index.getX(i + 2) : i + 2;
      a.fromBufferAttribute(position, i0).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(position, i1).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(position, i2).applyMatrix4(object.matrixWorld);
      tris.push({ a: a.clone(), b: b.clone(), c: c.clone(), colour, alpha, name: object.name });
    }
  });
  return tris;
}

function render(tris, { eye, target, width, height, fov = 34 }) {
  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.05, 100);
  camera.position.set(eye.x, eye.y, eye.z);
  camera.lookAt(target.x, target.y, target.z);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const colour = new Float32Array(width * height * 3).fill(0);
  const depth = new Float32Array(width * height).fill(Infinity);
  // a soft studio backdrop so the silhouette reads
  for (let y = 0; y < height; y++) {
    const t = y / height;
    const shade = 0.20 + 0.16 * (1 - t);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      colour[i] = shade * 0.92; colour[i + 1] = shade * 0.95; colour[i + 2] = shade;
    }
  }

  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
  const normal = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();

  for (const tri of tris) {
    pa.copy(tri.a).project(camera);
    pb.copy(tri.b).project(camera);
    pc.copy(tri.c).project(camera);
    if (pa.z < -1 || pb.z < -1 || pc.z < -1 || pa.z > 1 || pb.z > 1 || pc.z > 1) continue;

    const ax = (pa.x * 0.5 + 0.5) * width, ay = (1 - (pa.y * 0.5 + 0.5)) * height;
    const bx = (pb.x * 0.5 + 0.5) * width, by = (1 - (pb.y * 0.5 + 0.5)) * height;
    const cx = (pc.x * 0.5 + 0.5) * width, cy = (1 - (pc.y * 0.5 + 0.5)) * height;

    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) continue;

    e1.copy(tri.b).sub(tri.a); e2.copy(tri.c).sub(tri.a);
    normal.copy(e1).cross(e2).normalize();
    const facing = normal.dot(new THREE.Vector3().copy(camera.position).sub(tri.a).normalize());
    if (facing <= 0) continue;                       // back-face culling

    const lambert = 0.32 + 0.68 * Math.max(0, normal.dot(LIGHT));
    const r = tri.colour.r * lambert, g = tri.colour.g * lambert, b = tri.colour.b * lambert;

    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / area;
        const w1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) / area;
        const w2 = 1 - w0 - w1;
        const l0 = 1 - w0 - w1, l1 = w0, l2 = w1;
        if (l0 < 0 || l1 < 0 || l2 < 0) continue;
        const z = l0 * pa.z + l1 * pb.z + l2 * pc.z;
        const idx = y * width + x;
        if (z >= depth[idx]) continue;
        depth[idx] = z;
        const o = idx * 3;
        if (tri.alpha < 0.999) {
          const a = Math.max(0.04, Math.min(0.9, tri.alpha));
          colour[o] = colour[o] * (1 - a) + r * a;
          colour[o + 1] = colour[o + 1] * (1 - a) + g * a;
          colour[o + 2] = colour[o + 2] * (1 - a) + b * a;
        } else {
          colour[o] = r; colour[o + 1] = g; colour[o + 2] = b;
        }
      }
    }
  }
  return { colour, width, height };
}

/* --------------------------------------------------------------------- PNG */

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function writePng(file, image) {
  const { colour, width, height } = image;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[offset++] = Math.max(0, Math.min(255, Math.round(Math.sqrt(Math.max(0, colour[i])) * 255)));
      raw[offset++] = Math.max(0, Math.min(255, Math.round(Math.sqrt(Math.max(0, colour[i + 1])) * 255)));
      raw[offset++] = Math.max(0, Math.min(255, Math.round(Math.sqrt(Math.max(0, colour[i + 2])) * 255)));
    }
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', (() => {
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(width, 0);
      ihdr.writeUInt32BE(height, 4);
      ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
      return ihdr;
    })()),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
  return png.length;
}

/* -------------------------------------------------------------------- main */

const outDir = process.argv[2] || '/tmp/heritage-render';
fs.mkdirSync(outDir, { recursive: true });

const character = buildCharacter(spec, 'high');
const mesh = measureCharacter(character);
const triangles = collectTriangles(character.root);

console.log(`character: ${triangles.length} triangles, height ${mesh.height.toFixed(3)} m, ` +
            `shoulder span ${mesh.shoulderSpan.toFixed(3)} m, bones ${Object.keys(character.bones).length}`);

const headY = spec.proportions.headCentreHeight;
const views = [
  { name: 'front', eye: { x: 0, y: 0.9, z: 3.4 }, target: { x: 0, y: 0.9, z: 0 }, width: 460, height: 760, fov: 30 },
  { name: 'side', eye: { x: 3.4, y: 0.9, z: 0 }, target: { x: 0, y: 0.9, z: 0 }, width: 460, height: 760, fov: 30 },
  { name: 'threequarter', eye: { x: 2.2, y: 1.15, z: 2.6 }, target: { x: 0, y: 0.95, z: 0 }, width: 460, height: 760, fov: 30 },
  { name: 'head', eye: { x: 0, y: headY, z: 0.72 }, target: { x: 0, y: headY - 0.01, z: 0 }, width: 520, height: 560, fov: 26 }
];

for (const view of views) {
  const image = render(triangles, view);
  const file = path.join(outDir, `${view.name}.png`);
  const bytes = writePng(file, image);
  console.log(`wrote ${file} (${(bytes / 1024).toFixed(0)} kB)`);
}
