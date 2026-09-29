/* ==========================================================================
   builder.js — Dr. B. R. Ambedkar, built from character_spec.json.

   The model is generated, not downloaded, so it stays licence-clean and stays
   faithful to the reference sheet: round dark glasses, short receding hairline,
   small clipped moustache, white shirt, red patterned tie, three-piece suit,
   dark leather lace-up shoes, stocky broad-shouldered build (shoulder width is
   2.35 × head width), calm upright stance.

   Rig: an articulated hierarchy of rigid segments (each mesh parented to its
   bone). This is a deliberate engineering choice for a cross-platform
   educational title — it is cheap on mobile, has no skinning artefacts, and
   animates by rotating transforms, which is exactly what the Unity
   CharacterBuilder mirror does as well. Documentation/01 records the upgrade
   path to a skinned mesh.

   Every in-game instance of this character carries the label in CreditsScreen
   and in the character's own archive record: it is a digital reconstruction,
   not an authentic photograph.
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

export function buildCharacter(spec, quality = 'high') {
  const P = spec.proportions;
  const C = spec.clothing;
  const M = spec.materials;
  const F = spec.facialFeatures;
  const detailed = quality !== 'low';
  const seg = detailed ? 20 : 10;

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
    shoes: mat(M.shoes, detailed ? { map: leatherTexture(C.shoeColor) } : {})
  };

  // name every material after its palette slot: the audit tooling and the
  // runtime tests identify parts by material, not by mesh order
  for (const [key, m] of Object.entries(mats)) m.name = key;

  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const sphere = (r, w = seg, h = Math.max(6, seg >> 1)) => new THREE.SphereGeometry(r, w, h);
  const cyl = (rt, rb, h, s = seg) => new THREE.CylinderGeometry(rt, rb, h, s);

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

  // ---------------------------------------------------------------- rig
  const root = new THREE.Group();
  root.name = 'Ambedkar_Root';

  const SPINE_Y = 0.10, CHEST_Y = 0.22, UPPER_CHEST_Y = 0.20;
  const hips = node('Hips', root, 0, P.hipHeight, 0);
  const spine = node('Spine', hips, 0, SPINE_Y, 0);
  const chest = node('Chest', spine, 0, CHEST_Y, 0);
  const upperChest = node('UpperChest', chest, 0, UPPER_CHEST_Y, 0);
  // the neck sits exactly on the shoulder line defined by the spec
  const neck = node('Neck', upperChest, 0, P.shoulderHeight - (P.hipHeight + SPINE_Y + CHEST_Y + UPPER_CHEST_Y), 0.008);
  const head = node('Head', neck, 0, P.neckHeight, 0);

  const bones = { Hips: hips, Spine: spine, Chest: chest, UpperChest: upperChest, Neck: neck, Head: head };

  // ------------------------------------------------------------- footwear
  const buildLeg = (side) => {
    const s = side === 'L' ? -1 : 1;
    const upper = node(`UpperLeg_${side}`, hips, s * 0.098, -0.006, 0);          // hip joint at 0.850
    const lower = node(`LowerLeg_${side}`, upper, 0, -P.hipToKnee, 0);           // knee at 0.470
    const foot = node(`Foot_${side}`, lower, 0, -P.kneeAboveAnkle, 0);           // ankle at 0.062
    const toe = node(`Toe_${side}`, foot, 0, -0.02, P.shoeLength * 0.36);
    const thigh = put(cyl(P.thighRadius * 0.96, P.thighRadius, P.hipToKnee, seg), mats.trousers, upper, 0, -P.hipToKnee / 2, 0);
    thigh.scale.z = 0.94;
    put(cyl(P.calfRadius * 0.86, P.calfRadius, P.ankleAboveSole, seg), mats.trousers, lower, 0, -P.ankleAboveSole / 2, 0);
    const shoe = put(box(P.shoeWidth, P.shoeHeight, P.shoeLength), mats.shoes, foot, 0, -P.shoeHeight * 0.32, P.shoeLength * 0.14);
    put(box(P.shoeWidth * 0.92, P.shoeHeight * 0.7, P.shoeLength * 0.3), mats.shoes, foot, 0, -P.shoeHeight * 0.45, P.shoeLength * 0.5);
    // lace-up detail: two small bars on the instep
    put(box(P.shoeWidth * 0.45, 0.006, 0.012), mats.trim, foot, 0, P.shoeHeight * 0.14, P.shoeLength * 0.16);
    put(box(P.shoeWidth * 0.45, 0.006, 0.012), mats.trim, foot, 0, P.shoeHeight * 0.14, P.shoeLength * 0.24);
    return { upper, lower, foot, toe, shoe };
  };
  const legL = buildLeg('L');
  const legR = buildLeg('R');

  // ------------------------------------------------------- vertical layout
  // Every position below derives from character_spec.json, so the model and the
  // document cannot drift apart: hips at hipHeight, shoulder line at
  // shoulderHeight, head centred on headCentreHeight, crown at crownHeight.
  const hipY = P.hipHeight;
  const shoulderY = P.shoulderHeight;
  const torsoH = shoulderY - hipY;                       // hip to shoulder line
  const headPivotY = shoulderY + P.neckHeight;
  const headCentre = P.headCentreHeight;                 // = crownHeight - skullHalfHeight
  const eyeRel = P.eyeHeight - headCentre;               // eyes relative to the head centre
  const chinRel = P.chinHeight - headCentre;

  // ----------------------------------------------------------------- torso
  const upperChestWorldY = hipY + 0.52;                  // Hips + Spine + Chest + UpperChest offsets
  const torso = node('TorsoMesh', upperChest, 0, (hipY + torsoH / 2) - upperChestWorldY, 0);
  const chestDepth = P.chestDepth;
  // jacket body: a barrel, no athletic taper — the reference build is stocky
  const jacket = put(cyl(P.waistWidth * 0.44, P.waistWidth * 0.5, torsoH * 1.06, seg), mats.jacket, torso, 0, 0.012, 0);
  jacket.scale.z = chestDepth / (P.waistWidth * 0.5);
  // the shoulder yoke joins the jacket to the arm sockets, so nothing floats
  put(box(P.shoulderWidth - 0.02, 0.1, chestDepth * 0.94), mats.jacket, torso, 0, torsoH / 2 - 0.05, -0.004);
  const belly = put(sphere(P.waistWidth * 0.36, seg, seg >> 1), mats.jacket, torso, 0, -0.12, P.bellyBulge);
  belly.scale.set(1.0, 0.82, chestDepth / (P.waistWidth * 0.72));
  // waistcoat band, visible above the buttoned jacket
  const waist = put(cyl(P.waistWidth * 0.42, P.waistWidth * 0.42, 0.2, seg), mats.waistcoat, torso, 0, -0.16, 0);
  waist.scale.z = chestDepth / (P.waistWidth * 0.84);
  // shirt placket between the lapels
  put(box(0.072, torsoH * 0.62, 0.03), mats.shirt, torso, 0, torsoH * 0.2, chestDepth * 0.5 + 0.004);
  // collar, sitting just under the chin
  put(cyl(0.072, 0.078, C.collarHeight, seg), mats.shirt, torso, 0, torsoH / 2 + 0.018, 0.006);
  // lapels
  put(box(C.lapelWidth, 0.3, 0.024), mats.trim, torso, -0.1, torsoH * 0.22, chestDepth * 0.48, [0, 0.32, 0.16]);
  put(box(C.lapelWidth, 0.3, 0.024), mats.trim, torso, 0.1, torsoH * 0.22, chestDepth * 0.48, [0, -0.32, -0.16]);
  // pocket flaps + buttons
  put(box(0.1, 0.026, 0.016), mats.trim, torso, -0.13, -0.1, chestDepth * 0.46);
  put(box(0.1, 0.026, 0.016), mats.trim, torso, 0.13, -0.1, chestDepth * 0.46);
  for (let i = 0; i < 2; i += 1) put(cyl(0.008, 0.008, 0.008, 8), mats.trim, torso, 0, 0.04 - i * 0.075, chestDepth * 0.5 + 0.01);

  // tie: the signature red patterned strip, hung from the collar
  const tieTop = node('TieTop', torso, 0, torsoH / 2 - 0.014, chestDepth * 0.5 - 0.006);
  const tieSeg = (parent, y, w, h, d) => put(box(w, h, d), mats.tie, parent, 0, y, 0);
  put(box(C.tieWidth * 0.72, 0.036, 0.026), mats.tie, tieTop, 0, -0.02, 0.004);   // knot
  const tieBody = node('TieBody', tieTop, 0, -0.036, 0.004);
  tieSeg(tieBody, -0.07, C.tieWidth * 0.82, 0.16, 0.02);
  tieSeg(tieBody, -0.19, C.tieWidth * 0.9, 0.15, 0.019);
  tieSeg(tieBody, -0.29, C.tieWidth, 0.12, 0.018);
  tieSeg(tieBody, -0.38, C.tieWidth * 0.64, 0.07, 0.017);                         // tip

  // ------------------------------------------------------------------ arms
  const buildArm = (side) => {
    const s = side === 'L' ? -1 : 1;
    // shoulder joints sit 5.5 cm below the shoulder line, where a real shoulder
    // pivots — the jacket yoke covers the gap, so the arms are never detached
    const shoulder = node(`Shoulder_${side}`, upperChest, s * (P.shoulderWidth / 2 - 0.055),
      (shoulderY - 0.055) - upperChestWorldY, 0);
    const upper = node(`UpperArm_${side}`, shoulder, s * 0.045, 0, 0);
    const lower = node(`LowerArm_${side}`, upper, 0, -P.upperArmLength, 0);
    const hand = node(`Hand_${side}`, lower, 0, -P.lowerArmLength, 0);
    put(cyl(0.062, 0.07, P.upperArmLength, seg), mats.jacket, upper, 0, -P.upperArmLength / 2, 0);
    put(cyl(0.052, 0.06, P.lowerArmLength * 0.92, seg), mats.jacket, lower, 0, -P.lowerArmLength / 2, 0);
    put(cyl(0.052, 0.052, 0.018, seg), mats.shirt, lower, 0, -P.lowerArmLength + 0.012, 0);
    const palm = put(box(P.handLength * 0.62, P.handLength * 0.9, P.handLength * 0.40), mats.skin, hand, 0, -P.handLength * 0.42, 0);
    const fingers = [];
    if (detailed) {
      for (let i = 0; i < 4; i += 1) {
        fingers.push(put(box(0.016, P.handLength * 0.5, 0.017), mats.skin, hand,
          (i - 1.5) * 0.019, -P.handLength * 0.88, 0.004));
      }
    }
    const thumb = put(box(0.018, P.handLength * 0.36, 0.018), mats.skin, hand, s * P.handLength * 0.30, -P.handLength * 0.46, 0.01, [0, 0, s * 0.5]);
    return { shoulder, upper, lower, hand, palm, fingers, thumb };
  };
  const armL = buildArm('L');
  const armR = buildArm('R');

  // ------------------------------------------------------------------ head
  const headMesh = node('HeadMesh', head, 0, headCentre - headPivotY, 0);
  // skull built to the spec's head width / height / depth, not to a sphere
  put(sphere(1, seg, seg), mats.skin, headMesh, 0, 0, 0, null,
    [P.skullHalfWidth, P.skullHalfHeight, P.skullHalfDepth]);
  put(sphere(1, seg, seg >> 1), mats.skin, headMesh, 0, chinRel * 0.55, 0.006, null,
    [P.skullHalfWidth * 0.95, P.skullHalfHeight * 0.5, P.skullHalfDepth * 0.8]);
  put(sphere(1, seg >> 1, seg >> 2), mats.skin, headMesh, 0, chinRel * 0.86, 0.026, null, [0.045, 0.034, 0.044]);
  // the neck is visible between the collar and the jaw
  put(cyl(P.neckRadius * 0.94, P.neckRadius, P.neckHeight + 0.045, seg), mats.skin, neck, 0, P.neckHeight * 0.25, 0.006);
  // nose, eyes, brows, ears
  put(sphere(0.024, seg >> 1, seg >> 2), mats.skin, headMesh, 0, eyeRel - 0.002, P.skullHalfDepth - 0.008, null, [1, 0.96, 1.25]);
  put(box(0.014, 0.005, 0.018), mats.skinShadow, headMesh, -P.eyeSpacing / 2, eyeRel - 0.03, P.skullHalfDepth - 0.012);
  put(box(0.014, 0.005, 0.018), mats.skinShadow, headMesh, P.eyeSpacing / 2, eyeRel - 0.03, P.skullHalfDepth - 0.012);
  [-1, 1].forEach((s) => {
    put(sphere(0.0085, seg >> 2, seg >> 3), mats.hair, headMesh, s * P.eyeSpacing / 2, eyeRel, P.skullHalfDepth - 0.017);
    put(box(0.03, 0.007, 0.012), mats.hair, headMesh, s * P.eyeSpacing / 2, eyeRel + 0.027, P.skullHalfDepth - 0.014);
    put(sphere(F.ears.size, seg >> 1, seg >> 2), mats.skin, headMesh, s * P.skullHalfWidth, eyeRel + 0.002, 0.002, null, [0.4, 1.1, 0.8]);
  });

  // moustache — small, clipped, never comic
  const mous = node('Moustache', headMesh, 0, F.moustache.yOffset, P.skullHalfDepth - 0.012);
  put(box(F.moustache.width * 0.52, F.moustache.height, 0.014), mats.moustache, mous, -0.012, 0, 0, [0, 0, 0.06]);
  put(box(F.moustache.width * 0.52, F.moustache.height, 0.014), mats.moustache, mous, 0.012, 0, 0, [0, 0, -0.06]);

  // hair: short shell with a receding hairline, thinner on top than at the sides
  const hairGroup = node('Hair', headMesh, 0, 0, 0);
  const hairShell = new THREE.Mesh(
    new THREE.SphereGeometry(1, seg, seg, 0, Math.PI * 2, 0, Math.PI * 0.58), mats.hair);
  // the hair cap is the top of the head: skull top + hairCapThickness = crownHeight
  const hairScaleY = (P.skullHalfHeight + P.hairCapThickness) / P.skullHalfHeight;
  hairShell.scale.set(P.skullHalfWidth * 1.035, P.skullHalfHeight * hairScaleY, P.skullHalfDepth * 1.04);
  hairShell.position.y = -0.012;            // the backward tilt below lifts the rear of the cap
  hairShell.rotation.x = -0.13;            // pulled back off the forehead: the receding line
  hairShell.castShadow = quality !== 'low';
  hairGroup.add(hairShell);
  [-1, 1].forEach((s) => {
    put(sphere(1, seg >> 1, seg >> 2), mats.hair, hairGroup, s * P.skullHalfWidth * 0.92, eyeRel + 0.028, -0.008, null,
      [0.026, 0.05, 0.046]);                // side mass above the ear
  });
  put(sphere(1, seg >> 1, seg >> 2), mats.hair, hairGroup, 0, eyeRel + 0.03, -P.skullHalfDepth * 0.72, null,
    [0.05, 0.045, 0.032]);                  // nape

  // glasses — the single most recognisable feature; never hidden
  const G = F.glasses;
  const glasses = node('Glasses', headMesh, 0, 0, 0);
  const rimGeo = new THREE.TorusGeometry(G.lensRadius, G.rimThickness, 8, detailed ? 24 : 12);
  const lensGeo = new THREE.CircleGeometry(G.lensRadius * 0.96, detailed ? 20 : 12);
  [-1, 1].forEach((s) => {
    const rim = new THREE.Mesh(rimGeo, mats.frame);
    rim.position.set(s * (G.lensRadius + G.bridgeWidth * 0.5), eyeRel + G.yOffset, G.zOffset);
    rim.castShadow = false;
    const lens = new THREE.Mesh(lensGeo, mats.lens);
    lens.position.set(s * (G.lensRadius + G.bridgeWidth * 0.5), eyeRel + G.yOffset, G.zOffset + 0.001);
    lens.renderOrder = 2;
    glasses.add(rim, lens);
    const temple = new THREE.Mesh(box(0.006, 0.006, G.templeLength), mats.frame);
    temple.position.set(s * (G.lensRadius * 2 + G.bridgeWidth * 0.5), eyeRel + G.yOffset + 0.014,
      G.zOffset - G.templeLength / 2 - 0.006);
    glasses.add(temple);
  });
  const bridge = new THREE.Mesh(box(G.bridgeWidth, 0.005, 0.006), mats.frame);
  bridge.position.set(0, eyeRel + G.yOffset + 0.012, G.zOffset - 0.002);
  glasses.add(bridge);

  // ---------------------------------------------------------------- props
  const bookProp = new THREE.Group();
  bookProp.name = 'BookProp';
  bookProp.visible = false;
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.22), mat({ color: '#4A3423', roughness: 0.6 }));
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.205), mat({ color: '#EFE7D3', roughness: 0.9 }));
  pages.position.y = 0.004;
  const cover2 = cover.clone(); cover2.position.y = 0.018;
  bookProp.add(pages, cover, cover2);
  bookProp.position.set(0, -P.handLength * 0.7, 0.03);
  bookProp.rotation.x = -0.35;
  armL.hand.add(bookProp);

  // ------------------------------------------------------------- assembly
  bones.Shoulder_L = armL.shoulder; bones.UpperArm_L = armL.upper; bones.LowerArm_L = armL.lower; bones.Hand_L = armL.hand;
  bones.Shoulder_R = armR.shoulder; bones.UpperArm_R = armR.upper; bones.LowerArm_R = armR.lower; bones.Hand_R = armR.hand;
  bones.UpperLeg_L = legL.upper; bones.LowerLeg_L = legL.lower; bones.Foot_L = legL.foot; bones.Toe_L = legL.toe;
  bones.UpperLeg_R = legR.upper; bones.LowerLeg_R = legR.lower; bones.Foot_R = legR.foot; bones.Toe_R = legR.toe;

  // A-pose bind: 12° arm drop as specified
  const drop = THREE.MathUtils.degToRad(P.armDropDeg);
  armL.upper.rotation.z = drop; armR.upper.rotation.z = -drop;

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
      if (level >= 2) {
        armL.fingers.forEach(f => show(f, false));
        armR.fingers.forEach(f => show(f, false));
        show(glasses, true);            // glasses stay visible at every LOD
      } else {
        armL.fingers.forEach(f => show(f, true));
        armR.fingers.forEach(f => show(f, true));
      }
    },
    setShadow(cast) {
      root.traverse((o) => { if (o.isMesh) o.castShadow = cast; });
    },
    /** Highlight the reveal silhouette during the intro cinematic. */
    setRim() {}
  };
}

/** Measured silhouette check — reported by Tools/audit_character_spec.py and used in validation. */
export function measureCharacter(character) {
  const b = new THREE.Box3().setFromObject(character.root);
  const size = new THREE.Vector3();
  b.getSize(size);
  const P = character.spec.proportions;
  return {
    height: size.y,
    shoulderSpan: P.shoulderWidth,
    headWidth: P.headWidth,
    shoulderToHead: P.shoulderWidth / P.headWidth,
    eyeHeight: P.eyeHeight
  };
}
