#!/usr/bin/env node
/* ==========================================================================
   render_museum.mjs — renders the generated museum, without a browser.

   The world is code-generated from the same JSON the game loads, so the only
   honest way to review it is to look at it. This tool builds the real hub, a
   real gallery and a real memorial scene through web/src/world/builder.js and
   rasterises them on the CPU into PNG files.

   Usage (from the repository root):

     node web/tools/render_museum.mjs [outDir]

   It writes hub.png, gallery-law.png, memorial-deekshabhoomi.png and
   gallery-manuscripts.png. The shading is a simple two-light approximation, so
   it is a composition and proportion check rather than a preview of the game's
   own renderer — but it is the same geometry and the same materials.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');

/* materials.js draws its textures with a 2D canvas; this tool only needs the
   colours, so the context is stubbed and the maps are ignored. */
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
}

stubCanvas();

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

const THREE = await import('three');
const { World } = await import(path.join(WEB, 'src', 'world', 'builder.js'));
const { buildMaterialLibrary } = await import(path.join(WEB, 'src', 'world', 'materials.js'));
const { Content } = await import(path.join(WEB, 'src', 'core', 'content.js'));

const FILES = ['archive', 'timeline', 'zones', 'questions', 'museum', 'quests', 'achievements',
  'memorials', 'glossary', 'guide', 'localization', 'exhibits', 'character_spec'];
const bundle = {};
for (const name of FILES) {
  bundle[name] = JSON.parse(fs.readFileSync(path.join(WEB, 'content', `${name}.json`), 'utf8'));
}
const content = new Content(bundle, 'en');
content.doors = content.museum.doors;

/* ---------------------------------------------------------------- raster */

function collectTriangles(root) {
  const tris = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.isMesh && !object.isInstancedMesh) return;
    let visible = true;
    for (let p = object; p; p = p.parent) if (!p.visible) visible = false;
    if (!visible) return;

    const geometry = object.geometry;
    const position = geometry?.getAttribute?.('position');
    if (!position) return;
    const index = geometry.getIndex();
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const colour = material?.color ? material.color : new THREE.Color(0.75, 0.75, 0.75);
    const alpha = material?.transparent ? (material.opacity ?? 1) : 1;

    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const m4 = new THREE.Matrix4();

    const emit = (matrix) => {
      const count = index ? index.count : position.count;
      const limit = count > 60000 ? 60000 : count;
      for (let i = 0; i + 2 < limit; i += 3) {
        const i0 = index ? index.getX(i) : i;
        const i1 = index ? index.getX(i + 1) : i + 1;
        const i2 = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(position, i0).applyMatrix4(matrix);
        b.fromBufferAttribute(position, i1).applyMatrix4(matrix);
        c.fromBufferAttribute(position, i2).applyMatrix4(matrix);
        tris.push({ a: a.clone(), b: b.clone(), c: c.clone(), colour, alpha });
      }
    };

    if (object.isInstancedMesh) {
      const instances = Math.min(object.count, 200);
      for (let n = 0; n < instances; n += 1) {
        object.getMatrixAt(n, m4);
        m4.premultiply(object.matrixWorld);
        emit(m4);
      }
    } else {
      emit(object.matrixWorld);
    }
  });
  return tris;
}

function render(tris, { eye, target, width, height, fov, ambient = 0.30, sun = 0.75 }) {
  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 400);
  camera.position.set(eye.x, eye.y, eye.z);
  camera.lookAt(target.x, target.y, target.z);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const colour = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const t = y / height;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      colour[i] = 0.055 + 0.05 * t; colour[i + 1] = 0.06 + 0.055 * t; colour[i + 2] = 0.075 + 0.07 * t;
    }
  }
  const depth = new Float32Array(width * height).fill(Infinity);

  const sunDir = new THREE.Vector3(-0.42, 0.78, 0.46).normalize();
  const fillDir = new THREE.Vector3(0.55, 0.35, -0.75).normalize();
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), normal = new THREE.Vector3();
  const view = new THREE.Vector3();

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
    view.copy(camera.position).sub(tri.a).normalize();
    if (normal.dot(view) <= 0) continue;

    const lambert = ambient + sun * Math.max(0, normal.dot(sunDir))
      + 0.22 * Math.max(0, normal.dot(fillDir));
    const r = tri.colour.r * lambert, g = tri.colour.g * lambert, b = tri.colour.b * lambert;

    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / area;
        const w1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = (1 - w0 - w1) * pa.z + w0 * pb.z + w1 * pc.z;
        const idx = y * width + x;
        if (z >= depth[idx]) continue;
        depth[idx] = z;
        const o = idx * 3;
        const a = tri.alpha < 0.999 ? Math.max(0.05, Math.min(0.85, tri.alpha)) : 1;
        colour[o] = colour[o] * (1 - a) + r * a;
        colour[o + 1] = colour[o + 1] * (1 - a) + g * a;
        colour[o + 2] = colour[o + 2] * (1 - a) + b * a;
      }
    }
  }
  return { colour, width, height };
}

/* ------------------------------------------------------------------- PNG */

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
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
  for (let y = 0; y < height; y += 1) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      raw[offset++] = Math.max(0, Math.min(255, Math.round(Math.sqrt(Math.max(0, colour[i])) * 255)));
      raw[offset++] = Math.max(0, Math.min(255, Math.round(Math.sqrt(Math.max(0, colour[i + 1])) * 255)));
      raw[offset++] = Math.max(0, Math.min(255, Math.round(Math.sqrt(Math.max(0, colour[i + 2])) * 255)));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]));
}

/* ------------------------------------------------------------------ main */

const outDir = process.argv[2] || '/tmp/heritage-render';
fs.mkdirSync(outDir, { recursive: true });
const materials = buildMaterialLibrary(content.museum, 'high');

const shots = [
  {
    name: 'hub',
    build: (world) => world.buildHub(),
    eye: { x: 0, y: 2.4, z: 26 }, target: { x: 0, y: 2.2, z: 0 },
    width: 1000, height: 560, fov: 62
  },
  {
    name: 'hub-doors',
    build: (world) => world.buildHub(),
    eye: { x: 0, y: 2.6, z: 4 }, target: { x: 0, y: 2.9, z: 15 },
    width: 1000, height: 560, fov: 70
  },
  {
    name: 'hub-entrance',
    build: (world) => world.buildHub(),
    eye: { x: 0, y: 3.2, z: -13 }, target: { x: 0, y: 2.4, z: 6 },
    width: 1000, height: 560, fov: 68
  },
  {
    name: 'gallery-law',
    build: (world) => world.buildZone('law_constitution'),
    eye: { x: 0, y: 2.4, z: 7 }, target: { x: 0, y: 2.0, z: -4 },
    width: 1000, height: 560, fov: 66
  },
  {
    name: 'gallery-manuscripts',
    build: (world) => world.buildZone('manuscripts'),
    eye: { x: 0, y: 2.6, z: 6 }, target: { x: 0, y: 2.2, z: -6 },
    width: 1000, height: 560, fov: 68
  },
  {
    name: 'memorial-deekshabhoomi',
    build: (world) => world.buildMemorial('mem_deekshabhoomi'),
    eye: { x: 0, y: 6, z: 24 }, target: { x: 0, y: 8, z: 0 },
    width: 1000, height: 560, fov: 58
  }
];

for (const shot of shots) {
  const scene = new THREE.Scene();
  const world = new World(scene, content, materials, 'high');
  shot.build(world);
  const tris = collectTriangles(scene);
  const image = render(tris, shot);
  writePng(path.join(outDir, `${shot.name}.png`), image);
  console.log(`${shot.name}: ${tris.length} triangles, ${world.interactables.length} interactables, ` +
              `${world.colliders.length} colliders → ${shot.name}.png`);
}
