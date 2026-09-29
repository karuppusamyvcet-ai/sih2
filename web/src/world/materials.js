/* ==========================================================================
   materials.js — every surface in the museum, generated at runtime.

   Nothing is downloaded and no texture files ship with the build: marble,
   sandstone, walnut, paper, fabric, the tie's repeating motif, and — most
   importantly — the *signage*. Door labels, exhibit captions, the timeline
   wall and the information panels are canvas textures drawn at load time, so
   the museum can carry readable text on any platform without a font atlas.
   ========================================================================== */

import * as THREE from 'three';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function finish(c, { repeat = [1, 1], srgb = true, aniso = 4 } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = aniso;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function noise(ctx, w, h, amount, size = 1) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  if (size > 1) {
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ marble */
export function marbleTexture(base = '#E8E2D6', vein = '#b9ae9a', size = 512) {
  const key = `marble:${base}:${vein}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size); const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = vein; ctx.globalAlpha = 0.5;
  for (let i = 0; i < 26; i += 1) {
    ctx.beginPath();
    let x = Math.random() * size; let y = Math.random() * size;
    ctx.lineWidth = Math.random() * 1.8 + 0.3;
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s += 1) {
      x += (Math.random() - 0.5) * 120; y += (Math.random() - 0.3) * 90;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  noise(ctx, size, size, 12);
  const tex = finish(c, { repeat: [6, 6] });
  cache.set(key, tex);
  return tex;
}

/* -------------------------------------------------------------- sandstone */
export function stoneTexture(base = '#C9B79A', mortar = '#9C8C72', size = 512) {
  const c = canvas(size, size); const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  const rows = 8; const rowH = size / rows;
  ctx.strokeStyle = 'rgba(120,104,80,0.55)'; ctx.lineWidth = 2;
  for (let r = 0; r < rows; r += 1) {
    const y = r * rowH;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    const offset = (r % 2) * (size / 12);
    for (let x = offset; x < size; x += size / 6) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + rowH); ctx.stroke();
    }
  }
  noise(ctx, size, size, 18);
  return finish(c, { repeat: [5, 5] });
}

/* ------------------------------------------------------------------ wood */
export function woodTexture(base = '#4A3423', size = 512) {
  const c = canvas(size, size); const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i += 1) {
    ctx.strokeStyle = `rgba(${20 + Math.random() * 60},${14 + Math.random() * 40},${8 + Math.random() * 24},0.35)`;
    ctx.lineWidth = Math.random() * 2.6 + 0.4;
    const y = Math.random() * size;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 5);
    ctx.stroke();
  }
  noise(ctx, size, size, 10);
  return finish(c, { repeat: [2, 2] });
}

/* ----------------------------------------------------------------- paper */
export function paperTexture(base = '#EFE7D3', size = 512) {
  const c = canvas(size, size); const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 400; i += 1) {
    ctx.fillStyle = `rgba(150,135,105,${Math.random() * 0.06})`;
    ctx.beginPath(); ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 2.2, 0, Math.PI * 2); ctx.fill();
  }
  noise(ctx, size, size, 8);
  return finish(c);
}

/* --------------------------------------------------------------- fabric */
export function fabricTexture(base = '#1D2B45', strength = 0.08, size = 256) {
  const c = canvas(size, size); const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * strength})`;
    ctx.fillRect(0, y, size, 1);
  }
  for (let x = 0; x < size; x += 2) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * strength})`;
    ctx.fillRect(x, 0, 1, size);
  }
  return finish(c);
}

/* ---------------------------------------------------------- tie pattern */
/** The repeating motif of the tie — generated, so no licensed fabric art. */
export function tiePatternTexture(base = '#9E2130', a = '#E6D9C6', b = '#2A1A16', size = 256, scale = 18) {
  const c = canvas(size, size); const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  const step = size / scale;
  for (let y = 0; y < scale; y += 1) {
    for (let x = 0; x < scale; x += 1) {
      const px = x * step + (y % 2) * step * 0.5;
      const py = y * step;
      ctx.fillStyle = (x + y) % 3 === 0 ? a : b;
      ctx.globalAlpha = (x + y) % 3 === 0 ? 0.75 : 0.45;
      ctx.beginPath(); ctx.arc(px + step * 0.3, py + step * 0.5, step * 0.16, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  return finish(c, { repeat: [1, 3] });
}

/* --------------------------------------------------------- leather grain */
export function leatherTexture(base = '#2A211C', size = 256) {
  const c = canvas(size, size); const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i += 1) {
    ctx.fillStyle = `rgba(255,235,210,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.4, 1.4);
  }
  return finish(c, { repeat: [3, 3] });
}

/* ------------------------------------------------------------------ sign */
/**
 * Draw a museum sign: a caption plate, a door label or a panel of body text.
 * Returns a CanvasTexture. `align` may be 'left' | 'center'.
 */
export function signTexture(lines, {
  width = 1024, height = 256, bg = '#12100C', fg = '#F2ECDD', accent = '#C9A227',
  titleSize = 64, bodySize = 34, align = 'center', border = true, seal = false
} = {}) {
  const c = canvas(width, height); const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  if (border) {
    ctx.strokeStyle = accent; ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, width - 20, height - 20);
  }
  let y = height * 0.32;
  lines.forEach((line, i) => {
    const isTitle = i === 0;
    ctx.fillStyle = isTitle ? accent : fg;
    ctx.font = `${isTitle ? '600' : '400'} ${isTitle ? titleSize : bodySize}px "Segoe UI", Roboto, "Noto Sans", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const x = align === 'center' ? width / 2 : 40;
    const maxWidth = width - 80;
    y = drawWrapped(ctx, line, x, y, maxWidth, (isTitle ? titleSize : bodySize) * 1.35, align);
    y += 12;
  });
  if (seal) {
    ctx.fillStyle = accent; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(width - 70, height - 62, 26, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, align) {
  const words = String(text).split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word; y += lineHeight;
    } else line = test;
  }
  if (line) { ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}

/** A generated illustration panel (used for quiz image questions and screens). */
export function illustrationTexture(kind = 'preamble', { width = 768, height = 512 } = {}) {
  const c = canvas(width, height); const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, '#16233c'); g.addColorStop(1, '#0a1120');
  ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#C9A227'; ctx.globalAlpha = 0.5; ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, width - 32, height - 32);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#F2ECDD';
  ctx.textAlign = 'center';
  if (kind === 'gen_diagram_equality_chain') {
    const items = ['Equality before the law  (Art. 14)', 'No discrimination  (Art. 15)', 'Untouchability abolished  (Art. 17)', 'Life and liberty  (Art. 21)', 'REMEDY  ( … )'];
    ctx.font = '500 30px "Segoe UI", Roboto, sans-serif';
    items.forEach((t, i) => {
      const y = 110 + i * 74;
      ctx.fillStyle = i === 4 ? 'rgba(201,162,39,0.25)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(70, y - 30, width - 140, 56);
      ctx.strokeStyle = i === 4 ? '#C9A227' : 'rgba(201,162,39,0.35)';
      ctx.lineWidth = 2; ctx.strokeRect(70, y - 30, width - 140, 56);
      ctx.fillStyle = i === 4 ? '#C9A227' : '#F2ECDD';
      ctx.fillText(t, width / 2, y + 8);
    });
  } else {
    ctx.font = '600 44px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#C9A227';
    ctx.fillText('We, the People of India', width / 2, height * 0.42);
    ctx.font = '400 26px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#F2ECDD';
    ctx.fillText('…having solemnly resolved to constitute India into a', width / 2, height * 0.52);
    ctx.fillText('SOVEREIGN DEMOCRATIC REPUBLIC', width / 2, height * 0.59);
    ctx.font = '400 20px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#cfc6b4';
    ctx.fillText('typographic panel · not an authentic document', width / 2, height * 0.86);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ------------------------------------------------------- material library */
export function buildMaterialLibrary(museum, quality = 'high') {
  const M = museum.materials || {};
  const look = (name, fallback) => ({ ...fallback, ...(M[name] || {}) });
  const std = (cfg, extra = {}) => new THREE.MeshStandardMaterial({
    color: new THREE.Color(cfg.color),
    roughness: cfg.roughness ?? 0.7,
    metalness: cfg.metallic ?? 0.0,
    ...(cfg.emissive ? { emissive: new THREE.Color(cfg.emissive), emissiveIntensity: 0.55 } : {}),
    ...extra
  });

  const marble = look('marble_cream', { color: '#E8E2D6', roughness: 0.24 });
  const stone = look('stone_sandstone', { color: '#C9B79A', roughness: 0.85 });
  const wood = look('wood_walnut', { color: '#4A3423', roughness: 0.55 });

  const mats = {
    marble: std(marble, { map: marbleTexture(marble.color) }),
    stone: std(stone, { map: stoneTexture(stone.color) }),
    ceiling: std(look('ceiling_coffered', { color: '#D8D2C6', roughness: 0.72 })),
    wood: std(wood, { map: woodTexture(wood.color) }),
    brass: std(look('brass_polished', { color: '#B08D4F', roughness: 0.28, metallic: 0.85 })),
    glass: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(look('glass_case', { color: '#DFEAF2' }).color),
      roughness: 0.06, metalness: 0, transmission: quality === 'low' ? 0 : 0.6,
      transparent: true, opacity: 0.28, thickness: 0.05, side: THREE.DoubleSide
    }),
    fabric: std(look('fabric_deep_blue', { color: '#22314E', roughness: 0.86 }), { map: fabricTexture('#22314E', 0.05) }),
    paper: std(look('paper_archive', { color: '#EFE7D3', roughness: 0.9 }), { map: paperTexture() }),
    screen: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0E1A2B'), emissive: new THREE.Color('#3E6EA8'), emissiveIntensity: 0.9,
      roughness: 0.25, metalness: 0.0
    }),
    screenWarm: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a1408'), emissive: new THREE.Color('#C9A227'), emissiveIntensity: 0.7, roughness: 0.3
    }),
    gold: new THREE.MeshStandardMaterial({ color: new THREE.Color('#C9A227'), roughness: 0.35, metalness: 0.7 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: new THREE.Color('#2b2b30'), roughness: 0.5, metalness: 0.6 }),
    leaf: new THREE.MeshStandardMaterial({ color: new THREE.Color('#4d6b45'), roughness: 0.9 }),
    soil: new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a2f26'), roughness: 1.0 }),
    water: new THREE.MeshStandardMaterial({ color: new THREE.Color('#2c4a63'), roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.82 }),
    white: new THREE.MeshStandardMaterial({ color: new THREE.Color('#f4f2ec'), roughness: 0.6 }),
    labelBack: new THREE.MeshStandardMaterial({ color: new THREE.Color('#12100C'), roughness: 0.7 })
  };

  mats._sign = (lines, opts) => new THREE.MeshStandardMaterial({
    map: signTexture(lines, opts), roughness: 0.65, metalness: 0.0, side: THREE.DoubleSide
  });
  mats._illustration = (kind) => new THREE.MeshBasicMaterial({ map: illustrationTexture(kind), side: THREE.DoubleSide });
  if (quality === 'low') {
    Object.assign(mats, {
      marble: std(marble), stone: std(stone), wood: std(wood),
      brass: std(look('brass_polished', { color: '#B08D4F', roughness: 0.4, metallic: 0.5 }))
    });
    mats._sign = (lines, opts) => new THREE.MeshStandardMaterial({ map: signTexture(lines, opts), roughness: 0.75, side: THREE.DoubleSide });
  }
  return mats;
}
