/* ==========================================================================
   props.js — the museum's furniture and architecture, built from primitives.

   Every prop is a factory returning { group, interact? } so the room builders
   stay declarative. Repeated props (columns, books, colonnade bays, plinths)
   are instanced: the Android roadmap in Documentation/09 depends on this file
   keeping the draw-call count low.
   ========================================================================== */

import * as THREE from 'three';

const geoCache = new Map();
function box(w, h, d) {
  const key = `b${w}|${h}|${d}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(key);
}
function cyl(rt, rb, h, seg = 16) {
  const key = `c${rt}|${rb}|${h}|${seg}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.CylinderGeometry(rt, rb, h, seg));
  return geoCache.get(key);
}
function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** A framed caption panel: frame, backing and a legible text texture. */
export function signPanel(mats, lines, {
  width = 2.4, height = 1.6, opts = {}, tilt = 0, post = false, postHeight = 0.9
} = {}) {
  const g = new THREE.Group();
  const frame = mesh(box(width + 0.08, height + 0.08, 0.06), mats.brass, 0, 0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mats._sign(lines, opts));
  face.position.z = 0.045;
  g.add(frame, face);
  if (post) {
    g.add(mesh(box(0.12, postHeight, 0.12), mats.darkMetal, -width / 2 + 0.2, -height / 2 - postHeight / 2, 0));
    g.add(mesh(box(0.12, postHeight, 0.12), mats.darkMetal, width / 2 - 0.2, -height / 2 - postHeight / 2, 0));
    const base = mesh(box(width * 0.8, 0.06, 0.4), mats.brass, 0, -height / 2 - postHeight, 0);
    g.add(base);
  }
  g.rotation.x = tilt;
  return { group: g, panel: face };
}

export function displayCase(mats, { width = 2.4, height = 1.5, depth = 1.1, artefact = true } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(width, 0.75, depth), mats.wood, 0, 0.375, 0));
  g.add(mesh(box(width + 0.06, 0.05, depth + 0.06), mats.brass, 0, 0.78, 0));
  const glass = mesh(box(width - 0.06, height - 0.8, depth - 0.06), mats.glass, 0, 0.8 + (height - 0.8) / 2, 0);
  glass.castShadow = false;
  g.add(glass);
  if (artefact) {
    const page = mesh(box(width * 0.5, 0.03, depth * 0.55), mats.paper, 0, 0.84, 0);
    page.rotation.z = 0.04;
    g.add(page, mesh(box(width * 0.34, 0.02, depth * 0.4), mats.paper, width * 0.1, 0.88, 0.02));
  }
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), mats._sign(
    ['DIGITAL RECONSTRUCTION'], { width: 512, height: 128, titleSize: 46, border: true, accent: '#C9A227' }));
  tag.position.set(0, 0.34, depth / 2 + 0.005);
  g.add(tag);
  return { group: g };
}

export function bookshelf(mats, { width = 6, height = 3.2, depth = 0.6, fill = 0.85 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(width, height, 0.06), mats.wood, 0, height / 2, -depth / 2));
  g.add(mesh(box(0.08, height, depth), mats.wood, -width / 2, height / 2, 0));
  g.add(mesh(box(0.08, height, depth), mats.wood, width / 2, height / 2, 0));
  const shelves = 5;
  const bookGeo = box(0.05, 0.28, 0.2);
  const palette = ['#8C2F39', '#1F4E79', '#2E6E5E', '#6B4F2A', '#C9A227', '#4A3423', '#7A5BA6'];
  const mats2 = palette.map(c => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.8 }));
  for (let s = 1; s <= shelves; s += 1) {
    const y = (height / (shelves + 1)) * s;
    g.add(mesh(box(width - 0.1, 0.05, depth - 0.1), mats.wood, 0, y, 0));
    const count = Math.floor((width - 0.3) / 0.075 * fill);
    const inst = new THREE.InstancedMesh(bookGeo, mats2[s % mats2.length], count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i += 1) {
      const x = -width / 2 + 0.15 + i * 0.075;
      const rot = (Math.random() - 0.5) * 0.12;
      const scale = 0.82 + Math.random() * 0.4;
      m.compose(new THREE.Vector3(x, y + 0.16 * scale, (Math.random() - 0.5) * 0.06),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)),
        new THREE.Vector3(1, scale, 1));
      inst.setMatrixAt(i, m);
      inst.setColorAt?.(i, new THREE.Color(palette[(i * 3 + s) % palette.length]));
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = false; inst.receiveShadow = true;
    g.add(inst);
  }
  return { group: g };
}

export function documentTable(mats, { width = 3.2, depth = 1.6, height = 1.05 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(width, 0.08, depth), mats.wood, 0, height, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    g.add(mesh(box(0.1, height, 0.1), mats.darkMetal, sx * (width / 2 - 0.2), height / 2, sz * (depth / 2 - 0.2)));
  });
  const sheet = mesh(box(width * 0.42, 0.02, depth * 0.6), mats.paper, -width * 0.2, height + 0.05, 0);
  sheet.rotation.y = 0.08;
  const sheet2 = mesh(box(width * 0.34, 0.02, depth * 0.5), mats.paper, width * 0.18, height + 0.05, 0.05);
  sheet2.rotation.y = -0.14;
  g.add(sheet, sheet2);
  return { group: g };
}

export function kiosk(mats, { title = ['INTERACTIVE'], w = 1.4, h = 2.2, d = 0.8 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(w, h * 0.62, d), mats.darkMetal, 0, h * 0.31, 0));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, h * 0.42), mats._sign(title, {
    width: 512, height: 384, titleSize: 54, bodySize: 28, align: 'center'
  }));
  screen.position.set(0, h * 0.7, d / 2 + 0.01);
  screen.rotation.x = -0.18;
  g.add(screen);
  const glow = new THREE.PointLight(new THREE.Color('#7cb0e0'), 0.6, 4.2, 2);
  glow.position.set(0, h * 0.72, d / 2 + 0.25);
  g.add(glow);
  return { group: g, screen };
}

export function bench(mats, { width = 3 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(width, 0.1, 0.62), mats.fabric, 0, 0.46, 0));
  g.add(mesh(box(width, 0.36, 0.1), mats.fabric, 0, 0.66, -0.26));
  [[-1, 0], [1, 0]].forEach(([sx]) => g.add(mesh(box(0.1, 0.44, 0.5), mats.darkMetal, sx * (width / 2 - 0.25), 0.22, 0)));
  return { group: g };
}

export function receptionDesk(mats, { width = 6, height = 1.15, depth = 1.6 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(width, height, depth), mats.wood, 0, height / 2, 0));
  g.add(mesh(box(width + 0.1, 0.08, depth + 0.1), mats.brass, 0, height + 0.02, 0));
  const label = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.8, 0.4), mats._sign(
    ['INFORMATION · DIGITAL HERITAGE ARCHIVE'], { width: 1024, height: 128, titleSize: 40 }));
  label.position.set(0, height * 0.62, depth / 2 + 0.02);
  g.add(label);
  return { group: g };
}

export function centralMonument(mats, { text = ['THE DIGITAL AMBEDKAR', 'HERITAGE MUSEUM'],
  width = 3.2, height = 4.8, depth = 1.2 } = {}) {
  const g = new THREE.Group();
  const drum = width / 2;
  g.add(mesh(cyl(drum * 0.92, drum, 0.45, 40), mats.brass, 0, 0.22, 0));
  g.add(mesh(cyl(drum * 0.78, drum * 0.84, 0.3, 40), mats.marble, 0, 0.6, 0));
  const pillar = mesh(box(depth * 1.7, height, depth), mats.marble, 0, height / 2 + 0.75, 0);
  g.add(pillar);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0), mats._sign(text, {
    width: 768, height: 448, titleSize: 62, bodySize: 34, seal: true
  }));
  plaque.position.set(0, height * 0.72, depth * 0.52);
  plaque.rotation.y = Math.PI;
  const plaque2 = plaque.clone();
  plaque2.position.z = -depth * 0.52; plaque2.rotation.y = 0;
  g.add(plaque, plaque2);
  g.add(mesh(cyl(drum * 0.42, drum * 0.5, 0.5, 32), mats.darkMetal, 0, 0.85, 0));
  return { group: g };
}

export function audioPillar(mats, { label = ['AUDIO', 'NARRATION'] } = {}) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.34, 0.42, 0.35, 20), mats.darkMetal, 0, 0.17, 0));
  g.add(mesh(cyl(0.24, 0.24, 1.7, 20), mats.brass, 0, 1.15, 0));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.34), mats._sign(label, {
    width: 512, height: 256, titleSize: 56, bodySize: 30
  }));
  screen.position.set(0, 1.9, 0.25);
  g.add(screen);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 28), mats.gold);
  ring.position.y = 2.05; ring.rotation.x = Math.PI / 2;
  g.add(ring);
  return { group: g, screen };
}

export function archiveCabinet(mats, { width = 3.4, height = 2.4, depth = 0.7 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(width, height, depth), mats.wood, 0, height / 2, 0));
  const drawerMat = mats.brass;
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const w = width / 3 - 0.12;
      const h = height / 4 - 0.1;
      const x = -width / 2 + width / 6 + c * (width / 3);
      const y = height / 8 + r * (height / 4);
      const d = mesh(box(w, h, 0.06), drawerMat, x, y, depth / 2 + 0.03);
      const handle = mesh(box(w * 0.3, 0.04, 0.04), mats.darkMetal, x, y, depth / 2 + 0.08);
      g.add(d, handle);
    }
  }
  const card = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.9, 0.26), mats._sign(
    ['ARCHIVE CABINET · ACCESSION REGISTER'], { width: 1024, height: 128, titleSize: 38 }));
  card.position.set(0, height - 0.2, depth / 2 + 0.02);
  g.add(card);
  return { group: g };
}

export function projectionScreen(mats, { width = 12, height = 6.4, lines = ['WELCOME TO THE MUSEUM', 'Digital Heritage Archive · SIH26096'] } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(width + 0.4, height + 0.4, 0.16), mats.darkMetal, 0, height / 2 + 0.6, 0));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mats._sign(lines, {
    width: 1536, height: 864, titleSize: 96, bodySize: 52, align: 'center', seal: true
  }));
  screen.position.set(0, height / 2 + 0.6, 0.1);
  screen.rotation.y = Math.PI;
  g.add(screen);
  return { group: g, screen };
}

export function infoStele(mats, { lines = ['DIGITAL HERITAGE ARCHIVE'] } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(1.3, 0.12, 0.5), mats.darkMetal, 0, 0.06, 0));
  const body = mesh(box(1.1, 2.3, 0.18), mats.stone, 0, 1.2, 0);
  g.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.9), mats._sign(lines, {
    width: 512, height: 1024, titleSize: 52, bodySize: 30, align: 'left'
  }));
  face.position.set(0, 1.25, 0.1);
  face.rotation.y = Math.PI;
  g.add(face);
  const face2 = face.clone(); face2.rotation.y = 0; face2.position.z = -0.1;
  g.add(face2);
  return { group: g };
}

export function planter(mats, { size = 1.6 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(size, 0.6, size), mats.stone, 0, 0.3, 0));
  g.add(mesh(box(size * 0.86, 0.06, size * 0.86), mats.soil, 0, 0.62, 0));
  for (let i = 0; i < 7; i += 1) {
    const leaf = mesh(new THREE.ConeGeometry(0.2, 0.9, 6), mats.leaf,
      (Math.random() - 0.5) * size * 0.6, 1.0, (Math.random() - 0.5) * size * 0.6);
    leaf.rotation.z = (Math.random() - 0.5) * 0.6;
    g.add(leaf);
  }
  return { group: g };
}

export function mapTable(mats, { width = 9, depth = 6 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(width, 0.5, depth), mats.marble, 0, 0.45, 0));
  g.add(mesh(box(width + 0.2, 0.08, depth + 0.2), mats.brass, 0, 0.72, 0));
  g.add(mesh(box(width - 0.6, 0.02, depth - 0.6), mats.screen, 0, 0.77, 0));
  const compass = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.02, 8, 32), mats.gold);
  compass.position.set(-width / 2 + 1.1, 0.79, depth / 2 - 1.0);
  compass.rotation.x = Math.PI / 2;
  g.add(compass);
  return { group: g };
}

export function plinth(mats, { radius = 0.9, height = 1.1, accent = '#C9A227', lines = ['MEMORIAL'] } = {}) {
  const g = new THREE.Group();
  g.add(mesh(cyl(radius, radius * 1.08, height, 28), mats.marble, 0, height / 2, 0));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.94, 0.02, 8, 40),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), emissive: new THREE.Color(accent), emissiveIntensity: 0.5, roughness: 0.4 }));
  ring.position.y = height + 0.02; ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(radius * 1.7, 0.34), mats._sign(lines, {
    width: 768, height: 160, titleSize: 46, accent
  }));
  plate.position.set(0, height * 0.55, radius + 0.02);
  g.add(plate);
  const light = new THREE.PointLight(new THREE.Color(accent), 0.7, 5.5, 2);
  light.position.set(0, height + 0.5, 0);
  g.add(light);
  return { group: g, plate, light };
}

export function benchRing(mats, { radius = 4.2, count = 3 } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const b = bench(mats, { width: 2.8 });
    b.group.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    b.group.rotation.y = -a + Math.PI / 2;
    g.add(b.group);
  }
  return { group: g };
}

/** A hemispherical stupa with steps and a harmika — Deekshabhoomi, stylised. */
export function stupa(mats, { radius = 12, height = 18, flights = 4, accent = '#2E6E5E' } = {}) {
  const g = new THREE.Group();
  const baseH = height * 0.34;
  g.add(mesh(cyl(radius * 1.15, radius * 1.3, baseH, 48), mats.stone, 0, baseH / 2, 0));
  for (let i = 0; i < flights; i += 1) {
    const r = radius * (1.32 + i * 0.09);
    g.add(mesh(cyl(r, r, 0.34, 48), mats.marble, 0, 0.17 + i * 0.34, 0));
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), mats.marble);
  dome.position.y = baseH;
  dome.castShadow = true; dome.receiveShadow = true;
  g.add(dome);
  const harmika = mesh(box(radius * 0.22, 2.2, radius * 0.22), mats.gold, 0, baseH + radius + 1.0, 0);
  g.add(harmika);
  const spire = mesh(cyl(0.05, 0.35, 4.2, 12), mats.gold, 0, baseH + radius + 4.0, 0);
  g.add(spire);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.05, 0.06, 8, 64),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), emissive: new THREE.Color(accent), emissiveIntensity: 0.4 }));
  ring.position.y = baseH + 0.4; ring.rotation.x = Math.PI / 2;
  g.add(ring);
  return { group: g };
}

/** A colonnade of instanced columns with a lintel — Lucknow memorial park. */
export function colonnade(mats, { columns = 20, spacing = 3.0, height = 7.0, radius = 0.36, axis = 'x', offset = 0 } = {}) {
  const g = new THREE.Group();
  const shaft = cyl(radius * 0.86, radius, height, 14);
  const cap = box(radius * 2.6, 0.4, radius * 2.6);
  const base = box(radius * 2.8, 0.5, radius * 2.8);
  const inst = new THREE.InstancedMesh(shaft, mats.stone, columns);
  const capInst = new THREE.InstancedMesh(cap, mats.stone, columns);
  const baseInst = new THREE.InstancedMesh(base, mats.stone, columns);
  const m = new THREE.Matrix4();
  for (let i = 0; i < columns; i += 1) {
    const p = -((columns - 1) * spacing) / 2 + i * spacing;
    const pos = axis === 'x' ? new THREE.Vector3(p, 0, offset) : new THREE.Vector3(offset, 0, p);
    m.makeTranslation(pos.x, height / 2 + 0.3, pos.z); inst.setMatrixAt(i, m);
    m.makeTranslation(pos.x, height + 0.5, pos.z); capInst.setMatrixAt(i, m);
    m.makeTranslation(pos.x, 0.3, pos.z); baseInst.setMatrixAt(i, m);
  }
  [inst, capInst, baseInst].forEach(o => { o.instanceMatrix.needsUpdate = true; o.castShadow = true; o.receiveShadow = true; g.add(o); });
  const span = (columns - 1) * spacing + 2;
  const lintel = axis === 'x'
    ? mesh(box(span, 0.6, radius * 3), mats.brass, 0, height + 1.0, offset)
    : mesh(box(radius * 3, 0.6, span), mats.brass, offset, height + 1.0, 0);
  g.add(lintel);
  return { group: g };
}

export function lakefront(mats, { width = 90, depth = 60 } = {}) {
  const g = new THREE.Group();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mats.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.35, depth * 0.4);
  g.add(water);
  g.add(mesh(box(width * 1.4, 0.7, 6), mats.stone, 0, -0.35, -depth * 0.1));
  return { group: g };
}

/** A figure shown as a silhouette: this build does not sculpt likenesses in stone. */
export function statueSilhouette(mats, { height = 38, accent = '#8E7038' } = {}) {
  const g = new THREE.Group();
  const body = mesh(cyl(1.1, 2.2, height * 0.72, 18), new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), roughness: 0.55, metalness: 0.25 }),
    0, height * 0.36 + 6, 0);
  const head = mesh(new THREE.SphereGeometry(1.5, 20, 14), body.material, 0, height * 0.76 + 6, 0);
  const armL = mesh(cyl(0.5, 0.5, height * 0.3, 12), body.material, -2.0, height * 0.45 + 6, 0);
  const armR = armL.clone(); armR.position.x = 2.0;
  const book = mesh(box(2.4, 0.35, 1.6), mats.paper, 0, height * 0.4 + 6, 1.2);
  g.add(body, head, armL, armR, book);
  return { group: g };
}

export function houseShell(mats, { width = 20, depth = 15, storeys = 2, style = 'house', veranda = true } = {}) {
  const g = new THREE.Group();
  const h = storeys * 3.4;
  g.add(mesh(box(width, h, depth), style === 'institution' ? mats.marble : mats.stone, 0, h / 2, 0));
  g.add(mesh(box(width + 0.6, 0.4, depth + 0.6), mats.brass, 0, h + 0.2, 0));
  const roof = mesh(box(width * 1.05, 0.4, depth * 1.05), mats.wood, 0, h + 0.5, 0);
  g.add(roof);
  const doorGeo = box(1.4, 2.4, 0.2);
  const door = mesh(doorGeo, mats.wood, 0, 1.2, depth / 2 + 0.05);
  g.add(door);
  for (let s = 0; s < storeys; s += 1) {
    for (let i = -2; i <= 2; i += 1) {
      const w = mesh(box(1.2, 1.6, 0.12), mats.screen, i * (width / 6), 2.0 + s * 3.4, depth / 2 + 0.03);
      g.add(w);
    }
  }
  if (veranda) {
    g.add(mesh(box(width + 2.4, 0.3, 2.4), mats.marble, 0, 0.15, depth / 2 + 1.4));
    for (let i = -2; i <= 2; i += 1) g.add(mesh(cyl(0.16, 0.18, 3.2, 12), mats.stone, i * (width / 5), 1.8, depth / 2 + 2.3));
    g.add(mesh(box(width + 2.6, 0.34, 2.8), mats.brass, 0, 3.5, depth / 2 + 1.4));
  }
  return { group: g };
}

export function gardenMemorial(mats, { plazaSize = 26, obeliskHeight = 6, beds = 6, steps = 3, channel = true } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(plazaSize, 0.3, plazaSize), mats.marble, 0, 0.15, 0));
  for (let i = 0; i < steps; i += 1) g.add(mesh(box(plazaSize * (0.5 - i * 0.08), 0.22, plazaSize * 0.3), mats.stone, 0, 0.4 + i * 0.22, -plazaSize * 0.18));
  const obelisk = mesh(box(1.6, obeliskHeight, 1.6), mats.marble, 0, obeliskHeight / 2 + 1.0, 0);
  g.add(obelisk);
  const cap = mesh(cyl(0.0, 1.3, 1.2, 4), mats.gold, 0, obeliskHeight + 1.6, 0);
  cap.rotation.y = Math.PI / 4;
  g.add(cap);
  for (let i = 0; i < beds; i += 1) {
    const a = (i / beds) * Math.PI * 2;
    const bed = mesh(box(4.2, 0.4, 2.2), mats.soil, Math.cos(a) * plazaSize * 0.34, 0.4, Math.sin(a) * plazaSize * 0.34);
    bed.rotation.y = -a;
    g.add(bed);
    g.add(mesh(new THREE.ConeGeometry(1.5, 2.2, 8), mats.leaf, Math.cos(a) * plazaSize * 0.34, 1.6, Math.sin(a) * plazaSize * 0.34));
  }
  if (channel) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1.8, plazaSize * 0.7), mats.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.34, plazaSize * 0.18);
    g.add(water);
  }
  return { group: g };
}

/** A curved digital archive wall: 34 m of screen broken into panels. */
export function archiveWall(mats, { radius = 15, count = 9, height = 5.4, accent = '#7A5BA6' } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i += 1) {
    const a = -Math.PI * 0.42 + (i / (count - 1)) * Math.PI * 0.84;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.9, height), mats._sign(
      ['ARCHIVE', ['SEARCH · CITE · READ', 'SIX GALLERIES · 69 RECORDS', 'ASK THE GUIDE', 'AUDIO · VIDEO · DOCUMENTS',
        'TIMELINE 1891–2026', 'MEMORIALS · 8 SITES', 'CONSTITUTION', 'MANUSCRIPTS', 'ACHEIVEMENTS'][i % 9]],
      { width: 640, height: 1180, titleSize: 62, bodySize: 34, align: 'center', accent }));
    panel.position.set(Math.sin(a) * radius, height / 2 + 0.3, Math.cos(a) * radius);
    panel.rotation.y = Math.PI + a;
    g.add(panel);
  }
  g.add(mesh(cyl(radius + 0.2, radius + 0.2, 0.2, 64), mats.darkMetal, 0, 0.1, 0));
  return { group: g };
}

/** A door: frame, two leaves, label plate, accent lighting, open() animation. */
export function galleryDoor(mats, door, { index = 1 } = {}) {
  const g = new THREE.Group();
  const w = door.width, h = door.height;
  const accent = new THREE.Color(door.accent || '#C9A227');
  const frameMat = new THREE.MeshStandardMaterial({ color: accent.clone().multiplyScalar(0.5), roughness: 0.45, metalness: 0.35 });
  const leafMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2b2419'), roughness: 0.55, metalness: 0.25 });

  g.add(mesh(box(w + 0.7, 0.5, 0.9), mats.stone, 0, h + 0.25, 0));
  g.add(mesh(box(0.35, h + 0.5, 0.9), frameMat, -w / 2 - 0.18, (h + 0.5) / 2, 0));
  g.add(mesh(box(0.35, h + 0.5, 0.9), frameMat, w / 2 + 0.18, (h + 0.5) / 2, 0));

  const pivotL = new THREE.Group(); const pivotR = new THREE.Group();
  pivotL.position.set(-w / 2, 0, 0); pivotR.position.set(w / 2, 0, 0);
  const leafL = mesh(box(w / 2, h, 0.14), leafMat, w / 4, h / 2, 0);
  const leafR = mesh(box(w / 2, h, 0.14), leafMat, -w / 4, h / 2, 0);
  pivotL.add(leafL); pivotR.add(leafR);
  g.add(pivotL, pivotR);

  const label = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.5, 0.72), mats._sign(
    [`DOOR ${index}`, door.label], { width: 1024, height: 256, titleSize: 46, bodySize: 58, accent: door.accent, seal: true }));
  label.position.set(0, h + 0.85, 0.5);
  g.add(label);

  const light = new THREE.SpotLight(accent, 14, 14, Math.PI / 7, 0.45, 2);
  light.position.set(0, h + 1.6, -1.6);
  light.target.position.set(0, 0.8, 1.2);
  g.add(light, light.target);
  const glow = new THREE.PointLight(accent, 0.5, 6, 2);
  glow.position.set(0, 1.2, 0.6);
  g.add(glow);

  return {
    group: g,
    openAmount: 0,
    isOpen: false,
    open(dt) {
      this.openAmount = Math.min(1, this.openAmount + dt * 1.5);
      const a = this.openAmount * Math.PI * 0.62;
      pivotL.rotation.y = a; pivotR.rotation.y = -a;
      return this.openAmount >= 1;
    },
    close(dt) {
      this.openAmount = Math.max(0, this.openAmount - dt * 1.8);
      const a = this.openAmount * Math.PI * 0.62;
      pivotL.rotation.y = a; pivotR.rotation.y = -a;
      return this.openAmount <= 0;
    }
  };
}

/** Ceiling with skylight strips and coffers — cheap and readable. */
export function ceiling(mats, { width, depth, height, strips = 5 }) {
  const g = new THREE.Group();
  g.add(mesh(box(width, 0.5, depth), mats.ceiling, 0, height, 0));
  for (let i = 0; i < strips; i += 1) {
    const z = -depth / 2 + (depth / (strips + 1)) * (i + 1);
    const strip = new THREE.Mesh(box(width * 0.82, 0.12, 1.5),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#D9E4F2'), emissive: new THREE.Color('#D9E4F2'), emissiveIntensity: 0.55, roughness: 0.4 }));
    strip.position.set(0, height - 0.32, z);
    g.add(strip);
  }
  return { group: g };
}

export function column(mats, { height = 8.2, radius = 0.55 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(radius * 3, 0.4, radius * 3), mats.stone, 0, 0.2, 0));
  g.add(mesh(cyl(radius * 0.92, radius, height, 20), mats.stone, 0, height / 2 + 0.3, 0));
  g.add(mesh(box(radius * 3.1, 0.42, radius * 3.1), mats.brass, 0, height + 0.5, 0));
  return { group: g };
}

export function labelRail(mats, doors) {
  const g = new THREE.Group();
  doors.forEach((d, i) => {
    const p = signPanel(mats, [`DOOR ${i + 1}`, d.label], {
      width: 2.9, height: 0.82, opts: { width: 1024, height: 300, titleSize: 46, bodySize: 56, accent: d.accent }
    });
    p.group.position.set(d.x, 5.4, d.z - 0.55);
    p.group.rotation.y = Math.PI;
    g.add(p.group);
  });
  return { group: g };
}
