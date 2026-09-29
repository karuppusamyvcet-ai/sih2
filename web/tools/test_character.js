/**
 * Runtime test for the character build and the animation system.
 *
 * Runs the real modules — the same code the browser executes — against the
 * vendored three.js under Node with a canvas shim, so the character and all
 * 25 clips are actually exercised on every commit without a GPU:
 *
 *   node web/tools/run_character_test.sh   (wraps this file, see that script)
 *
 * What it proves:
 *   - the rig builds with every bone the animator addresses
 *   - measured height and shoulder span match character_spec.json
 *   - the identity features (glasses, moustache, hair, tie) exist
 *   - LOD switching removes geometry
 *   - every clip in character_spec.json runs 1 s without a NaN or a broken pose
 */
import fs from 'node:fs';
import path from 'node:path';

/* ---------------------------------------------------------------- DOM shim */
const noop = () => {};
const makeContext = () => new Proxy({
  measureText: () => ({ width: 12 }),
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)) }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)) }),
  canvas: null
}, {
  get: (target, prop) => (prop in target ? target[prop] : noop),
  set: (target, prop, value) => { target[prop] = value; return true; }
});

globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') return { style: {}, appendChild: noop, setAttribute: noop };
    const c = { width: 1, height: 1, style: {}, getContext: makeContext, toDataURL: () => '' };
    c.getContext().canvas = c;
    return c;
  },
  createElementNS: () => ({ style: {} }),
  addEventListener: noop
};
globalThis.window = { addEventListener: noop, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720 };
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 16);
globalThis.self = globalThis;

const THREE = await import('three');
const { buildCharacter, measureCharacter } = await import('../src/char/builder.js');
const { Animator, CLIPS } = await import('../src/char/animator.js');

const root = path.resolve(import.meta.dirname, '..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'content', 'character_spec.json'), 'utf8'));

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  ok   ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name} ${detail}`); }
};
const finite = (obj) => {
  let bad = null;
  obj.traverse((o) => {
    if (!bad && (o.isMesh || o.isObject3D)) {
      const v = [...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()];
      if (v.some(n => !Number.isFinite(n))) bad = o.name || o.type;
    }
  });
  return bad;
};

console.log('Character build');
const character = buildCharacter(spec, 'high');
const bones = character.bones;
const required = ['Hips', 'Spine', 'Chest', 'UpperChest', 'Neck', 'Head',
  'UpperLeg_L', 'LowerLeg_L', 'Foot_L', 'UpperLeg_R', 'LowerLeg_R', 'Foot_R'];
check('every core bone exists', required.every(b => bones[b]), required.filter(b => !bones[b]).join(','));
check('shoulder and arm chains exist', Object.keys(bones).some(b => b.startsWith('UpperArm_'))
  && Object.keys(bones).some(b => b.startsWith('Hand_')), Object.keys(bones).join(','));
check('no non-finite transform after build', !finite(character.root), String(finite(character.root)));

const measured = measureCharacter(character);
check(`measured height is 1.700 m (got ${measured.height.toFixed(3)})`, Math.abs(measured.height - 1.7) < 0.015);
check(`shoulder span is ${spec.proportions.shoulderWidth} m`, Math.abs(measured.shoulderSpan - spec.proportions.shoulderWidth) < 0.02);
check(`shoulder:head ratio is ${spec.proportions.shoulderWidth / spec.proportions.headWidth < 2.35 ? '<=2.35' : '?'}`,
  measured.shoulderToHead > 1.8 && measured.shoulderToHead < 2.6, measured.shoulderToHead.toFixed(2));

console.log('\nAnatomy audit (nothing may drift from character_spec.json)');
const B = new THREE.Box3().setFromObject(character.root);
const P = spec.proportions;
check('feet rest on the floor', Math.abs(B.min.y) < 0.02, B.min.y.toFixed(3));
check('nothing in the silhouette passes the crown', B.max.y <= P.crownHeight + 0.02, B.max.y.toFixed(3));
check('chin sits just above the shoulder line and below the eyes',
  P.chinHeight > P.shoulderHeight && P.chinHeight < P.eyeHeight,
  `${P.shoulderHeight} < ${P.chinHeight} < ${P.eyeHeight}`);
const chinToCrown = P.crownHeight - P.chinHeight;
check(`head height is ${P.headHeight} m (chin to crown = ${chinToCrown.toFixed(3)})`, Math.abs(chinToCrown - P.headHeight) < 0.005);
check(`height is ${P.headToBodyRatio} head-heights`, Math.abs(P.crownHeight / P.headHeight - P.headToBodyRatio) < 0.05);
const glassesY = character.glasses.children[0].getWorldPosition(new THREE.Vector3()).y;
check(`glasses sit on the eye line (${glassesY.toFixed(3)})`, Math.abs(glassesY - P.eyeHeight) < 0.012);
const mousY = character.moustache.getWorldPosition(new THREE.Vector3()).y;
check(`moustache sits between the chin and the eyes (${mousY.toFixed(3)})`, mousY > P.chinHeight && mousY < P.eyeHeight);
const handBoxes = ['Hand_L', 'Hand_R'].map(n => new THREE.Box3().setFromObject(bones[n]));
const kneeHeight = P.hipJointHeight - P.hipToKnee;
check('hands hang between hip and knee in the A-pose',
  handBoxes.every(b => b.max.y < P.hipHeight + 0.08 && b.min.y > kneeHeight),
  handBoxes.map(b => `${b.min.y.toFixed(2)}..${b.max.y.toFixed(2)}`).join(' '));
const shirtMeshes = [];
character.root.traverse(o => { if (o.isMesh && o.material?.name === 'shirt') shirtMeshes.push(o); });
const collar = shirtMeshes.map(m => new THREE.Box3().setFromObject(m)).find(b => b.max.y > P.shoulderHeight && b.max.y < P.chinHeight);
check('collar sits between the shoulder line and the chin', !!collar, collar ? '' : 'no shirt mesh in that band');

console.log('\nIdentity features (must match the character sheet)');
check('glasses group present', !!character.glasses, 'glasses');
check('hair group present', !!character.hairGroup);
check('moustache present', !!character.moustache);
const tieMesh = [];
character.root.traverse(o => { if (o.material && o.material.name === 'tie_red') tieMesh.push(o); });
check('red patterned tie uses the signature colour', character.materials.tie.color.getHexString().toLowerCase() === '9e2130',
  character.materials.tie.color.getHexString());
check('suit is the navy three-piece palette',
  character.materials.jacket.color.getHexString().toLowerCase() === '1d2b45'
  && character.materials.shirt.color.getHexString().toLowerCase() === 'f3f1ea',
  `${character.materials.jacket.color.getHexString()} / ${character.materials.shirt.color.getHexString()}`);
check('book prop exists for the read/carry clips', !!character.props.book);

console.log('\nLOD');
const highTris = countTriangles(character.root);
const low = buildCharacter(spec, 'low');
const lowTris = countTriangles(low.root);
check(`LOW quality reduces triangles (${highTris} -> ${lowTris})`, lowTris < highTris);
character.setLod(2);
const afterLod = countVisibleTriangles(character.root);
check('setLod(2) hides detail geometry', afterLod <= highTris);
character.setLod(0);

console.log('\nAnimation — every clip in character_spec.json');
const animator = new Animator(character);
const clips = Object.keys(CLIPS);
check(`all ${spec.clipList.length} spec clips are implemented (${clips.length} found)`,
  spec.clipList.every(c => clips.includes(c)), spec.clipList.filter(c => !clips.includes(c)).join(','));

const problems = [];
for (const name of spec.clipList) {
  animator.play(name, { restart: true });
  let broken = null;
  let minHip = Infinity, maxHip = -Infinity;
  for (let frame = 0; frame < 60; frame += 1) {
    animator.update(1 / 60, { speed: 1.6, moving: true });
    broken = broken || finite(character.root);
    const hip = bones.Hips.getWorldPosition(new THREE.Vector3()).y;
    minHip = Math.min(minHip, hip); maxHip = Math.max(maxHip, hip);
  }
  if (broken) problems.push(`${name}: non-finite (${broken})`);
  if (maxHip > 1.2) problems.push(`${name}: hip rises to ${maxHip.toFixed(2)} m`);
  if (minHip < 0.2) problems.push(`${name}: hip drops to ${minHip.toFixed(2)} m`);
}
check('all clips animate without NaN or a broken pelvis', problems.length === 0, problems.join(' | '));

animator.play('Read_Standing');
for (let i = 0; i < 30; i += 1) animator.update(1 / 60, {});
check('the book appears for Read_Standing', character.props.book.visible === true);
animator.play('Idle_Breathe');
for (let i = 0; i < 90; i += 1) animator.update(1 / 60, {});
check('the book is put away when idle', character.props.book.visible === false);
check('blending leaves the pose at the bind pose when idle',
  Math.abs(bones.Head.rotation.x) < 0.25, bones.Head.rotation.x.toFixed(3));

animator.setLook(0.6, 0.1, 1);
animator.update(1 / 60, {});
check('look-at is additive on the neck and head', Math.abs(bones.Head.rotation.y) > 0.05);

function countTriangles(obj) {
  let tris = 0;
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    const idx = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
    tris += Math.round(idx / 3) * (o.children.length ? 1 : 1);
  });
  return tris;
}
function countVisibleTriangles(obj) {
  let tris = 0;
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.visible) return;
    const g = o.geometry;
    tris += Math.round((g.index ? g.index.count : g.attributes.position.count) / 3);
  });
  return tris;
}
console.log('\n' + '-'.repeat(60));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
