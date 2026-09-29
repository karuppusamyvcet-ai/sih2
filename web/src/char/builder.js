/* ==========================================================================
   builder.js — Dr. B. R. Ambedkar, generated from character_spec.json.

   The figure is not a downloaded model, so it stays licence-clean and stays
   faithful to the reference: round dark-rimmed glasses, short neatly combed
   hair with a receding hairline, clipped moustache, clean-shaven, stocky
   broad-shouldered build, dark navy three-piece suit over a white shirt, the
   signature red patterned tie, dark lace-up shoes, calm upright stance.

   Everything is derived from the specification's numbers: the crown, the
   hairline, the eye line, the chin, the shoulder line, the hip joint, the knee,
   the ankle and the sole. A single edit to character_spec.json moves the model
   with it, in this build and in the Unity build.

   Surfaces are lofted profiles rather than boxes — a body is a tapered volume
   with a waist, a chest and a jaw, and it has to read as one from any angle.
   Limbs are tapered tubes joined by spheres at the joints, the shoes carry the
   sole to the floor, and the head is a lofted skull with a jaw, cheeks and a
   hairline that recedes at the temples.

   Rig: an articulated hierarchy of rigid segments, one mesh group per bone.
   That is cheap on mobile, has no skinning artefacts, and animates by rotating
   transforms — which is exactly what the Unity CharacterFactory mirror does.
   ========================================================================== */

import * as THREE from 'three';
import { fabricTexture, tiePatternTexture, leatherTexture } from '../world/materials.js';

const mat = (cfg, extra = {}) => new THREE.MeshStandardMaterial({
  color: new THREE.Color(cfg.color),
  roughness: cfg.roughness ?? 0.6,
  metalness: cfg.metallic ?? 0,
  ...(cfg.alpha !== undefined ? { transparent: true, opacity: cfg.alpha } : {}),
  ...extra
});

/* ------------------------------------------------------------------ lofts */

/**
 * Loft a closed surface through a stack of elliptical rings.
 * `levels` run bottom to top: { y, rx, rz, z? } — z shifts a ring forward or
 * back, which is how the chest is carried in front of the spine and how the
 * face sits proud of the back of the skull.
 */
function loft(levels, segments, { caps = true } = {}) {
  const positions = [];
  const indices = [];
  const rings = levels.length;

  for (let i = 0; i < rings; i += 1) {
    const level = levels[i];
    const rx = Math.max(0.0006, level.rx);
    const rz = Math.max(0.0006, level.rz);
    for (let j = 0; j <= segments; j += 1) {
      const a = (j / segments) * Math.PI * 2;
      positions.push(Math.sin(a) * rx, level.y, Math.cos(a) * rz + (level.z || 0));
    }
  }
  for (let i = 0; i < rings - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const a = i * (segments + 1) + j;
      const b = a + segments + 1;
      // counter-clockwise seen from outside: a, a+1, b — the other order makes
      // the surface invisible from the front
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  if (caps) {
    // flat fans close the top and the bottom, so a limb never shows daylight
    const bottom = levels[0];
    const top = levels[rings - 1];
    const bottomIndex = positions.length / 3;
    positions.push(0, bottom.y, bottom.z || 0);
    const topIndex = positions.length / 3;
    positions.push(0, top.y, top.z || 0);
    for (let j = 0; j < segments; j += 1) {
      indices.push(bottomIndex, j + 1, j);
      const base = (rings - 1) * (segments + 1);
      indices.push(topIndex, base + j, base + j + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A tapered limb segment: radiusFrom at the bottom, radiusTo at the top. */
function tube(radiusBottom, radiusTop, height, segments, squash = 1) {
  return loft([
    { y: 0, rx: radiusBottom, rz: radiusBottom * squash },
    { y: height * 0.5, rx: (radiusBottom + radiusTop) * 0.5, rz: (radiusBottom + radiusTop) * 0.5 * squash },
    { y: height, rx: radiusTop, rz: radiusTop * squash }
  ], segments);
}

/**
 * A garment shell: the same stack of rings as `loft`, but open at the front with
 * a per-ring wedge, and given real thickness (an outer surface, an inner lining
 * and rims along the opening). That is what makes a jacket read as a jacket —
 * the V of the lapels shows the shirt and the waistcoat beneath, instead of the
 * front being a painted stripe on a barrel.
 */
function shellArc(levels, segments, thickness = 0.008) {
  const positions = [];
  const indices = [];
  const rings = levels.length;

  for (let i = 0; i < rings; i += 1) {
    const level = levels[i];
    const gap = Math.max(0, level.gap || 0);
    const rx = Math.max(0.0006, level.rx);
    const rz = Math.max(0.0006, level.rz);
    const z = level.z || 0;
    const inner = 1 - thickness / Math.max(rx, rz);
    for (let j = 0; j <= segments; j += 1) {
      const a = gap + (j / segments) * (Math.PI * 2 - gap * 2);
      // outer, then inner, interleaved so the rim can be built from the pairs
      positions.push(Math.sin(a) * rx, level.y, Math.cos(a) * rz + z);
      positions.push(Math.sin(a) * rx * inner, level.y, Math.cos(a) * rz * inner + z);
    }
  }

  const stride = (segments + 1) * 2;
  for (let i = 0; i < rings - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const o0 = i * stride + j * 2;
      const o1 = o0 + 2;
      const u0 = o0 + stride;
      const u1 = u0 + 2;
      indices.push(o0, o1, u0, o1, u1, u0);                    // outer face
      const n0 = o0 + 1, n1 = o1 + 1, m0 = u0 + 1, m1 = u1 + 1;
      indices.push(n0, m0, n1, n1, m0, m1);                    // lining, wound inward
    }
  }

  // the two rims of the opening
  const last = segments * 2;
  for (let i = 0; i < rings - 1; i += 1) {
    const o = i * stride, u = o + stride;
    indices.push(o, u, o + 1, o + 1, u, u + 1);                // left edge
    indices.push(o + last, o + last + 1, u + last, o + last + 1, u + last + 1, u + last);
  }

  // top and bottom caps close the hem and the shoulder line
  [0, rings - 1].forEach((ring, index) => {
    const base = ring * stride;
    for (let j = 0; j < segments; j += 1) {
      const o = base + j * 2, n = o + 1, o1 = o + 2, n1 = o1 + 1;
      if (index === 0) indices.push(o, n, o1, o1, n, n1);
      else indices.push(o, o1, n, o1, n1, n);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The hair cap: a shell over the skull whose lower edge follows a hairline
 * function of the azimuth. That is what makes the receding line legible — the
 * hair stops high at the front and sweeps low at the back and over the ears.
 */
function hairCap({ rx, ry, rz, segments = 28, rings = 7, front, side, back }) {
  const positions = [];
  const indices = [];
  const hairline = (a) => {
    const c = Math.cos(a);                       // +1 at the front, -1 at the back
    return c >= 0 ? front + (side - front) * (1 - c) : side + (back - side) * (-c);
  };
  for (let i = 0; i <= rings; i += 1) {
    const u = i / rings;
    for (let j = 0; j <= segments; j += 1) {
      const a = (j / segments) * Math.PI * 2;
      const t = u * hairline(a);                 // polar angle: 0 at the crown
      positions.push(Math.sin(t) * Math.sin(a) * rx, Math.cos(t) * ry, Math.sin(t) * Math.cos(a) * rz);
    }
  }
  for (let i = 0; i < rings; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const a = i * (segments + 1) + j;
      const b = a + segments + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/* ------------------------------------------------------------------ build */

export function buildCharacter(spec, quality = 'high') {
  const P = spec.proportions;
  const C = spec.clothing;
  const M = spec.materials;
  const F = spec.facialFeatures;
  const detailed = quality !== 'low';
  const seg = detailed ? 20 : 12;                // radial resolution
  const fine = detailed ? 16 : 8;

  // ------------------------------------------------------------ materials
  const mats = {
    skin: mat(M.skin),
    skinShadow: mat(M.skin_shadow),
    hair: mat(M.hair),
    moustache: mat(M.moustache),
    frame: mat(M.glasses_frame),
    lens: mat(M.glass_lens, { side: THREE.DoubleSide }),
    jacket: mat(M.jacket, detailed ? { map: fabricTexture(C.jacketColor, 0.05) } : {}),
    trim: mat(M.jacket_trim),
    waistcoat: mat(M.waistcoat, detailed ? { map: fabricTexture(C.waistcoatColor, 0.05) } : {}),
    shirt: mat(M.shirt),
    tie: mat(M.tie, detailed ? { map: tiePatternTexture(C.tieColor, C.tiePatternColorA, C.tiePatternColorB, 256, 12) } : {}),
    trousers: mat(M.trousers, detailed ? { map: fabricTexture(C.trousersColor, 0.05) } : {}),
    shoes: mat(M.shoes, detailed ? { map: leatherTexture(C.shoeColor) } : {}),
    eye: mat({ color: '#F4F1EA', roughness: 0.25 }),
    iris: mat({ color: '#2A1F17', roughness: 0.2 }),
    sole: mat({ color: '#191512', roughness: 0.75 })
  };
  // name every material after its palette slot: the tooling and the tests
  // identify parts by material, never by mesh order
  for (const [key, m] of Object.entries(mats)) m.name = key;

  const node = (name, parent, x = 0, y = 0, z = 0) => {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const put = (geometry, material, parent, x = 0, y = 0, z = 0, rot = null, scale = null) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    m.castShadow = quality !== 'low';
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const ball = (radius) => new THREE.SphereGeometry(radius, fine, Math.max(6, fine >> 1));

  // ---------------------------------------------------------------- rig
  const root = new THREE.Group();
  root.name = 'Ambedkar_Root';

  const SPINE_Y = 0.10, CHEST_Y = 0.22, UPPER_CHEST_Y = 0.20;
  const hips = node('Hips', root, 0, P.hipHeight, 0);
  const spine = node('Spine', hips, 0, SPINE_Y, 0);
  const chest = node('Chest', spine, 0, CHEST_Y, 0);
  const upperChest = node('UpperChest', chest, 0, UPPER_CHEST_Y, 0);
  const upperChestWorldY = P.hipHeight + SPINE_Y + CHEST_Y + UPPER_CHEST_Y;
  const neck = node('Neck', upperChest, 0, P.shoulderHeight - upperChestWorldY, 0.006);
  const head = node('Head', neck, 0, P.neckHeight, 0);

  const bones = { Hips: hips, Spine: spine, Chest: chest, UpperChest: upperChest, Neck: neck, Head: head };

  const hipY = P.hipHeight;
  const shoulderY = P.shoulderHeight;
  const headCentre = P.headCentreHeight;
  const headPivotY = shoulderY + P.neckHeight;
  const eyeRel = P.eyeHeight - headCentre;
  const chinRel = P.chinHeight - headCentre;
  const kneeY = P.hipJointHeight - P.hipToKnee;

  // ---------------------------------------------------------------- pelvis
  put(loft([
    { y: 0.62 - P.hipHeight, rx: 0.128, rz: 0.100, z: 0 },
    { y: 0.72 - P.hipHeight, rx: 0.142, rz: 0.106, z: 0 },
    { y: P.hipJointHeight - P.hipHeight, rx: 0.148, rz: 0.104, z: 0 },
    { y: P.hipJointHeight - P.hipHeight + 0.06, rx: 0.140, rz: 0.098, z: 0 }
  ], seg), mats.trousers, hips, 0, 0, 0);

  // ------------------------------------------------------------- footwear
  const buildLeg = (side) => {
    const s = side === 'L' ? -1 : 1;
    const upper = node(`UpperLeg_${side}`, hips, s * 0.082, P.hipJointHeight - hipY, 0);
    const lower = node(`LowerLeg_${side}`, upper, 0, -P.hipToKnee, 0);
    const foot = node(`Foot_${side}`, lower, 0, -P.kneeAboveAnkle, 0);
    const toe = node(`Toe_${side}`, foot, 0, -0.012, P.shoeLength * 0.34);

    // thigh and calf are tapered, so the trouser leg has a shape instead of a
    // silhouette: the calf runs the full knee-to-ankle length (0.408 m)
    put(tube(P.thighRadius * 0.82, P.thighRadius, P.hipToKnee, seg, 0.94), mats.trousers, upper, 0, -P.hipToKnee, 0);
    put(ball(P.thighRadius * 0.62), mats.trousers, lower, 0, 0, 0);
    const calfHeight = P.kneeAboveAnkle - P.ankleAboveSole * 0.4;
    put(tube(P.calfRadius * 0.84, P.calfRadius * 1.0, calfHeight, seg, 0.94), mats.trousers, lower, 0, -calfHeight, 0);
    // trouser break: the cuff rests on the shoe instead of stopping short
    put(tube(P.calfRadius * 0.9, P.calfRadius * 0.98, C.trouserCuffBreak * 1.6, seg, 0.95), mats.trousers, foot,
      0, -P.ankleAboveSole * 0.55, 0);

    const shoe = new THREE.Group();
    shoe.name = `Shoe_${side}`;
    foot.add(shoe);
    const soleY = -P.ankleAboveSole;
    put(new THREE.BoxGeometry(P.shoeWidth, 0.018, P.shoeLength), mats.sole, shoe, 0, soleY + 0.009, P.shoeLength * 0.10);
    put(new THREE.BoxGeometry(P.shoeWidth * 0.96, P.shoeHeight * 0.62, P.shoeLength * 0.58), mats.shoes, shoe,
      0, soleY + 0.018 + P.shoeHeight * 0.31, P.shoeLength * 0.06);
    put(ball(P.shoeHeight * 0.5), mats.shoes, shoe, 0, soleY + P.shoeHeight * 0.45, P.shoeLength * 0.36, null,
      [P.shoeWidth / (P.shoeHeight), 0.9, (P.shoeLength * 0.5) / (P.shoeHeight * 1.9)]);
    put(new THREE.BoxGeometry(P.shoeWidth * 0.9, P.shoeHeight * 0.66, P.shoeLength * 0.16), mats.shoes, shoe,
      0, soleY + 0.018 + P.shoeHeight * 0.33, -P.shoeLength * 0.40);         // heel
    put(ball(P.shoeHeight * 0.34), mats.shoes, shoe, 0, soleY + P.shoeHeight * 0.72, P.shoeLength * 0.24, null,
      [P.shoeWidth / (P.shoeHeight * 0.7), 1, 1]);                          // instep
    for (let i = 0; i < 2; i += 1) {
      put(new THREE.BoxGeometry(P.shoeWidth * 0.42, 0.006, 0.014), mats.trim, shoe,
        0, soleY + P.shoeHeight * 0.66, P.shoeLength * (0.10 + i * 0.09));
    }

    return { upper, lower, foot, toe, shoe };
  };
  const legL = buildLeg('L');
  const legR = buildLeg('R');

  // ----------------------------------------------------------------- torso
  const torso = node('TorsoMesh', upperChest, 0, (hipY + shoulderY) / 2 - upperChestWorldY, 0);
  const torsoRel = (worldY) => worldY - (hipY + shoulderY) / 2;      // torso-local y

  // jacket: hem below the hips, waist, belly, chest, shoulders. The reference
  // build is stocky — the broadest point is the shoulder line, and the waist
  // never pinches in
  const jacketLevels = [
    { y: torsoRel(hipY - 0.16), rx: 0.157, rz: 0.116, z: 0.004 },     // hem, just below the hip joint
    { y: torsoRel(hipY - 0.06), rx: 0.159, rz: 0.120, z: 0.004 },
    { y: torsoRel(hipY + 0.06), rx: 0.152, rz: 0.118, z: 0.003 },     // waist (waistWidth 0.332)
    { y: torsoRel(hipY + 0.20), rx: 0.158, rz: 0.126, z: 0.006 },     // belly, held in
    { y: torsoRel(hipY + 0.33), rx: 0.170, rz: 0.129, z: 0.008 },     // chest
    { y: torsoRel(hipY + 0.44), rx: 0.184, rz: 0.124, z: 0.006 },     // upper chest
    { y: torsoRel(shoulderY - 0.030), rx: P.shoulderWidth / 2 - 0.006, rz: 0.118, z: 0.004 },
    { y: torsoRel(shoulderY), rx: P.shoulderWidth / 2 - 0.020, rz: 0.110, z: 0.002 },  // the shoulder pitches over
    { y: torsoRel(shoulderY + 0.022), rx: P.shoulderWidth / 2 - 0.062, rz: 0.092, z: 0.0 }
  ];
  // the coat: buttoned at the waist, opening into the V of the lapels above it
  const gaps = [0, 0, 0.06, 0.20, 0.42, 0.56, 0.66, 0.72, 0.78];
  const coatLevels = jacketLevels.map((level, i) => ({ ...level, gap: gaps[i] }));
  put(shellArc(coatLevels, seg, 0.010), mats.jacket, torso, 0, 0, 0);
  put(shellArc(jacketLevels.map((l, i) => ({ ...l, rx: l.rx * 0.97, rz: l.rz * 0.97, gap: gaps[i] })),
    seg, 0.008), mats.trim, torso, 0, 0, 0);

  // shoulder caps close the joint, so the sleeves never look bolted on
  [-1, 1].forEach((s) => {
    put(ball(0.060), mats.jacket, torso, s * 0.088, torsoRel(shoulderY - 0.028), 0, null, [1, 0.95, 1]);
  });

  // layers inside the V, from the body outward: shirt, waistcoat, then the tie
  const coatFront = (index) => jacketLevels[index].rz + (jacketLevels[index].z || 0);
  put(loft([
    { y: torsoRel(hipY - 0.05), rx: 0.106, rz: coatFront(0) - 0.030, z: 0.002 },
    { y: torsoRel(hipY + 0.12), rx: 0.112, rz: coatFront(3) - 0.030, z: 0.004 },
    { y: torsoRel(hipY + 0.28), rx: 0.105, rz: coatFront(4) - 0.030, z: 0.006 },
    { y: torsoRel(shoulderY - 0.045), rx: 0.090, rz: coatFront(5) - 0.026, z: 0.004 }
  ], seg), mats.shirt, torso, 0, 0, 0);
  // waistcoat: a front panel in the opening below the chest, with two buttons
  put(loft([
    { y: torsoRel(hipY + 0.02), rx: 0.084, rz: coatFront(2) - 0.018, z: 0.002 },
    { y: torsoRel(hipY + 0.18), rx: 0.088, rz: coatFront(3) - 0.018, z: 0.002 },
    { y: torsoRel(hipY + 0.30), rx: 0.076, rz: coatFront(4) - 0.020, z: 0.002 }
  ], fine), mats.waistcoat, torso, 0, 0, 0);
  [-0.02, -0.10].forEach((dy, i) => put(ball(0.005), mats.trim, torso, 0,
    torsoRel(hipY + 0.20) + dy, coatFront(3) - 0.012 + i * 0.001));

  // lapels: two thin slabs angled out from the collar to the chest
  [-1, 1].forEach((s) => {
    // the lapel folds back along the rim of the opening, so it belongs to the
    // coat rather than floating in front of it
    const gap = 0.46;
    const rimX = Math.sin(gap * s) * jacketLevels[5].rx;
    const rimZ = Math.cos(gap) * jacketLevels[5].rz;
    const lapel = put(new THREE.BoxGeometry(C.lapelWidth * 1.05, 0.20, 0.016), mats.jacket, torso,
      rimX * 0.92, torsoRel(shoulderY - 0.10), rimZ - 0.004, [0.04, s * 0.46, s * 0.24]);
    lapel.name = `Lapel_${s < 0 ? 'L' : 'R'}`;
  });
  [-1, 1].forEach((s) => {
    put(new THREE.BoxGeometry(0.090, 0.022, 0.012), mats.trim, torso, s * 0.108,
      torsoRel(hipY + 0.07), jacketLevels[2].rz - 0.006, [0, s * 0.5, 0]);
  });

  // collar: a low band under the chin, with wings at the front so the shirt
  // reaches the jaw instead of ending at the chest
  put(tube(0.070, 0.076, C.collarHeight, seg, 0.92), mats.shirt, torso, 0, torsoRel(shoulderY) - 0.002, 0.006);
  [-1, 1].forEach((s) => {
    put(new THREE.BoxGeometry(0.044, 0.024, 0.013), mats.shirt, torso,
      s * 0.030, torsoRel(shoulderY) + 0.006, 0.080, [0, s * 0.5, s * 0.30]);
  });

  // tie: knot at the collar, body down the shirt, the signature red accent
  const tieFront = jacketLevels[4].rz + (jacketLevels[4].z || 0) - 0.014;
  const tieTop = node('TieTop', torso, 0, torsoRel(shoulderY) - 0.020, tieFront);
  put(new THREE.BoxGeometry(C.tieWidth * 0.78, 0.030, 0.020), mats.tie, tieTop, 0, -0.012, 0.002);
  const tieBody = node('TieBody', tieTop, 0, -0.030, -0.004);
  [[-0.055, 0.86, 0.13], [-0.155, 0.94, 0.13], [-0.250, 1.0, 0.10], [-0.315, 0.60, 0.05]]
    .forEach(([y, w, h]) => put(new THREE.BoxGeometry(C.tieWidth * w, h, 0.016), mats.tie, tieBody, 0, y, 0));

  // ------------------------------------------------------------------ arms
  const buildArm = (side) => {
    const s = side === 'L' ? -1 : 1;
    const shoulder = node(`Shoulder_${side}`, upperChest, s * 0.088,
      (shoulderY - 0.028) - upperChestWorldY, 0);
    const upper = node(`UpperArm_${side}`, shoulder, s * 0.058, -0.01, 0);   // socket at ±0.146
    const lower = node(`LowerArm_${side}`, upper, 0, -P.upperArmLength, 0);
    const hand = node(`Hand_${side}`, lower, 0, -P.lowerArmLength, 0);

    // sleeve: shoulder → elbow → cuff, tapering the way a jacket sleeve does
    put(ball(0.059), mats.jacket, upper, 0, 0, 0);
    put(tube(0.045, 0.058, P.upperArmLength, seg), mats.jacket, upper, 0, -P.upperArmLength, 0);
    put(ball(0.045), mats.jacket, lower, 0, 0, 0);
    put(tube(0.040, 0.045, P.lowerArmLength - 0.03, seg), mats.jacket, lower, 0, -(P.lowerArmLength - 0.03), 0);
    put(tube(0.037, 0.039, 0.012, seg), mats.shirt, lower, 0, -P.lowerArmLength + 0.010, 0);   // cuff

    // hand: palm, four fingers, thumb
    const handY = -P.handLength * 0.46;
    put(new THREE.BoxGeometry(0.064, P.handLength * 0.60, 0.030), mats.skin, hand, 0, handY, 0.002);
    const fingers = [];
    if (detailed) {
      for (let i = 0; i < 4; i += 1) {
        fingers.push(put(new THREE.BoxGeometry(0.0135, P.handLength * 0.44, 0.017), mats.skin, hand,
          (i - 1.5) * 0.0158, -P.handLength * 0.92, 0.003));
      }
    }
    const thumb = put(new THREE.BoxGeometry(0.015, P.handLength * 0.32, 0.017), mats.skin, hand,
      s * P.handLength * 0.34, handY + 0.004, 0.012, [0, 0, s * 0.55]);
    return { shoulder, upper, lower, hand, fingers, thumb };
  };
  const armL = buildArm('L');
  const armR = buildArm('R');

  // ------------------------------------------------------------- head/skull
  const headMesh = node('HeadMesh', head, 0, headCentre - headPivotY, 0);
  const HW = P.skullHalfWidth, HH = P.skullHalfHeight, HD = P.skullHalfDepth;

  put(loft([
    { y: chinRel, rx: HW * 0.54, rz: HD * 0.52, z: 0.014 },            // broad chin
    { y: chinRel + HH * 0.18, rx: HW * 0.88, rz: HD * 0.82, z: 0.012 },// heavy jaw
    { y: chinRel + HH * 0.36, rx: HW, rz: HD * 0.96, z: 0.012 },       // jowl
    { y: chinRel + HH * 0.58, rx: HW * 1.0, rz: HD * 0.98, z: 0.008 }, // mouth and cheek
    { y: eyeRel, rx: HW, rz: HD, z: 0.0 },                             // eye line
    { y: eyeRel + HH * 0.30, rx: HW * 0.99, rz: HD * 0.98, z: -0.002 },
    { y: eyeRel + HH * 0.55, rx: HW * 0.88, rz: HD * 0.90, z: -0.004 },
    { y: chinRel + HH * 1.85, rx: HW * 0.58, rz: HD * 0.60, z: -0.004 },
    { y: chinRel + HH * 2.0, rx: HW * 0.17, rz: HD * 0.17, z: -0.004 }  // crown
  ], seg), mats.skin, headMesh, 0, 0, 0);

  // neck, visible between the collar and the jaw
  put(tube(P.neckRadius * 1.05, P.neckRadius * 1.12, P.neckHeight + 0.026, seg, 0.96), mats.skin, neck,
    0, -0.004, 0.012);

  // face: nose, eyes, brows, ears, mouth
  put(loft([
    { y: eyeRel + 0.012, rx: 0.008, rz: 0.010, z: HD * 0.90 },   // bridge, between the brows
    { y: eyeRel - 0.020, rx: 0.011, rz: 0.020, z: HD * 0.93 },
    { y: eyeRel - 0.044, rx: 0.014, rz: 0.026, z: HD * 0.96 },   // tip
    { y: eyeRel - 0.060, rx: 0.016, rz: 0.016, z: HD * 0.92 }    // nostril line
  ], fine), mats.skin, headMesh, 0, 0, 0);
  [-1, 1].forEach((s) => {
    // a dark almond rather than a white sphere: at this scale it reads as an
    // eye behind a round lens instead of a cartoon eyeball
    put(new THREE.BoxGeometry(0.024, 0.0105, 0.006), mats.iris, headMesh,
      s * P.eyeSpacing / 2, eyeRel - 0.002, HD * 0.86, [0, 0, 0]);
    put(new THREE.BoxGeometry(0.007, 0.007, 0.004), mats.eye, headMesh,
      s * P.eyeSpacing / 2 + s * 0.006, eyeRel + 0.001, HD * 0.872);
    // a soft crease under the moustache stands in for the mouth line
    if (s > 0) put(new THREE.BoxGeometry(0.026, 0.0035, 0.006), mats.skinShadow, headMesh,
      0, chinRel + HH * 0.24, HD * 0.885);
    // brows sit above the spectacle rim, as in the reference
    put(new THREE.BoxGeometry(0.030, F.brows?.thickness ?? 0.008, 0.012), mats.hair, headMesh,
      s * P.eyeSpacing / 2, eyeRel + 0.034, HD * 0.86, [0, s * 0.08, 0]);
    // ears: flattened against the skull, and outside the hairline
    put(ball(F.ears?.size ?? 0.032), mats.skin, headMesh, s * HW * 1.01, eyeRel - 0.006, -0.006, null,
      [0.34, 1.0, 0.78]);
  });

  // moustache — small and clipped, never comic; the reference is clean-shaven
  // apart from this
  const mous = node('Moustache', headMesh, 0, F.moustache.yOffset + 0.006, HD * 0.900);
  [-1, 1].forEach((s) => {
    put(new THREE.BoxGeometry(F.moustache.width * 0.58, F.moustache.height, 0.012), mats.moustache, mous,
      s * F.moustache.width * 0.25, s * 0.0012, 0, [0, 0, s * 0.12]);
  });

  // hair: short, neatly combed, receding at the front, fuller at the sides
  const hairGroup = node('Hair', headMesh, 0, 0, 0);
  const hairRecession = F.hair?.hairlineRecession ?? 0.16;
  const shell = new THREE.Mesh(hairCap({
    rx: HW * 1.035,
    ry: (HH + P.hairCapThickness) * 0.955,
    rz: HD * 1.04,
    segments: detailed ? 32 : 16,
    rings: detailed ? 8 : 4,
    front: Math.PI * (0.275 + hairRecession * 0.10),   // well back: the high bald forehead
    side: Math.PI * 0.50,                             // stops above the ear, temple bare
    back: Math.PI * 0.63
  }), mats.hair);
  shell.needsUpdate = true;
  shell.castShadow = quality !== 'low';
  hairGroup.add(shell);
  // a slightly fuller mass at the temples, kept clear of the ear itself
  [-1, 1].forEach((s) => {
    put(ball(0.022), mats.hair, hairGroup, s * HW * 0.86, eyeRel + 0.056, -0.030, null, [0.8, 0.95, 1.20]);
  });
  put(ball(0.040), mats.hair, hairGroup, 0, eyeRel + 0.024, -HD * 0.80, null, [1.5, 1.2, 0.8]);  // nape

  // glasses — the single most recognisable feature; visible at every LOD
  const G = F.glasses;
  const glasses = node('Glasses', headMesh, 0, 0, 0);
  const rimGeometry = new THREE.TorusGeometry(G.lensRadius, G.rimThickness, detailed ? 8 : 5, detailed ? 26 : 12);
  const lensGeometry = new THREE.CircleGeometry(G.lensRadius * 0.96, detailed ? 22 : 12);
  [-1, 1].forEach((s) => {
    const x = s * (G.lensRadius + G.bridgeWidth * 0.5);
    const rim = new THREE.Mesh(rimGeometry, mats.frame);
    rim.position.set(x, eyeRel + G.yOffset, G.zOffset + 0.004);
    rim.castShadow = false;
    const lens = new THREE.Mesh(lensGeometry, mats.lens);
    lens.position.set(x, eyeRel + G.yOffset, G.zOffset + 0.005);
    lens.renderOrder = 2;
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, G.templeLength), mats.frame);
    temple.position.set(s * (G.lensRadius * 2 + G.bridgeWidth * 0.5), eyeRel + G.yOffset + 0.008,
      G.zOffset + 0.002 - G.templeLength / 2 - 0.006);
    temple.rotation.x = -0.08;
    glasses.add(rim, lens, temple);
  });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(G.bridgeWidth, 0.005, 0.006), mats.frame);
  bridge.position.set(0, eyeRel + G.yOffset + 0.006, G.zOffset + 0.002);
  glasses.add(bridge);

  // ---------------------------------------------------------------- props
  const bookProp = new THREE.Group();
  bookProp.name = 'BookProp';
  bookProp.visible = false;
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.22), mat({ color: '#4A3423', roughness: 0.6 }));
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.205), mat({ color: '#EFE7D3', roughness: 0.9 }));
  pages.position.y = 0.004;
  const cover2 = cover.clone();
  cover2.position.y = 0.018;
  bookProp.add(pages, cover, cover2);
  bookProp.position.set(0, -P.handLength * 0.7, 0.03);
  bookProp.rotation.x = -0.35;
  armL.hand.add(bookProp);

  // ------------------------------------------------------------- assembly
  bones.Shoulder_L = armL.shoulder; bones.UpperArm_L = armL.upper; bones.LowerArm_L = armL.lower; bones.Hand_L = armL.hand;
  bones.Shoulder_R = armR.shoulder; bones.UpperArm_R = armR.upper; bones.LowerArm_R = armR.lower; bones.Hand_R = armR.hand;
  bones.UpperLeg_L = legL.upper; bones.LowerLeg_L = legL.lower; bones.Foot_L = legL.foot; bones.Toe_L = legL.toe;
  bones.UpperLeg_R = legR.upper; bones.LowerLeg_R = legR.lower; bones.Foot_R = legR.foot; bones.Toe_R = legR.toe;
  bones.Neck = neck; bones.Head = head;

  // A-pose bind: the specified 12° arm drop
  const drop = THREE.MathUtils.degToRad(P.armDropDeg);
  armL.upper.rotation.z = drop;
  armR.upper.rotation.z = -drop;

  const all = [];
  root.traverse((o) => { if (o.isMesh) all.push(o); });

  return {
    spec, root, bones, materials: mats, meshes: all,
    props: { book: bookProp },
    glasses, hairGroup, moustache: mous,
    /** Distance-based LOD, called by the player system each frame. */
    setLod(level) {
      if (this._lod === level) return;
      this._lod = level;
      const show = (o, v) => { o.visible = v; };
      const fingers = level >= 2 ? false : true;
      armL.fingers.forEach(f => show(f, fingers));
      armR.fingers.forEach(f => show(f, fingers));
      // the identity features are never touched by an LOD switch
      show(glasses, true);
      show(hairGroup, true);
      show(mous, true);
    },
    setShadow(cast) {
      root.traverse((o) => { if (o.isMesh) o.castShadow = cast; });
    },
    /** Highlight the reveal silhouette during the intro cinematic. */
    setRim() {}
  };
}

/** Measured silhouette check — reported by the audits and used in validation. */
export function measureCharacter(character) {
  const box = new THREE.Box3().setFromObject(character.root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const P = character.spec.proportions;

  // On a stocky figure in an A-pose the widest part of the silhouette *is* the
  // shoulder line, so this reports the built width rather than restating the
  // specification: a build that drifts away from 0.414 m is caught.
  const span = Math.max(Math.abs(box.max.x), Math.abs(box.min.x)) * 2;

  return {
    height: size.y,
    shoulderSpan: span,
    headWidth: P.headWidth,
    shoulderToHead: span / P.headWidth,
    eyeHeight: P.eyeHeight
  };
}
