/* ==========================================================================
   player.js — the player: movement, the third-person camera and the
   interaction probe.

   Movement is camera-relative and damped, so it feels the same with a keyboard
   and with a thumb on glass. The camera follows behind and slightly above,
   avoids obstacles by shortening its boom, and can be pulled closer for
   inspection. The interaction probe is a forward sphere-cast plus a proximity
   test, which gives the HUD its "Press E to Interact" prompt and drives every
   exhibit in the game.
   ========================================================================== */

import * as THREE from 'three';

const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();

export class Player {
  constructor({ scene, camera, character, animator, world, state, content, audio }) {
    this.scene = scene;
    this.camera = camera;
    this.character = character;
    this.animator = animator;
    this.world = world;
    this.state = state;
    this.content = content;
    this.audio = audio;

    this.position = new THREE.Vector3(0, 0, -11.5);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;               // character facing
    this.cameraYaw = 0;
    this.cameraPitch = 0.22;
    this.cameraDistance = 3.4;
    this.cameraTargetDistance = 3.4;
    this.height = 1.7;
    this.radius = 0.34;
    this.speedWalk = 2.5;
    this.speedRun = 4.6;
    this.jump = 0;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.stepDistance = 0;
    this.focus = null;
    this.focusDistance = 0;
    this.interactRadius = 2.6;
    this.cameraShake = 0;
    this.locked = false;         // frozen during cinematic / modals
    this.inspectMode = false;
    this.mouse = { x: 0.5, y: 0.5 };
  }

  spawn(zoneId, { keepYaw = false } = {}) {
    const p = this.world.spawnPointFor(zoneId);
    this.position.copy(p);
    this.velocity.set(0, 0, 0);
    if (!keepYaw) { this.yaw = 0; this.cameraYaw = 0; }
    this.cameraPitch = 0.22;
    this.cameraDistance = this.cameraTargetDistance = 3.4;
    this.character.root.position.set(p.x, 0, p.z);
    this.character.root.rotation.y = this.yaw;
    this.snapCamera();
  }

  /* -------------------------------------------------------------- movement */
  update(dt, input, { doorCheck = null } = {}) {
    if (this.locked) {
      this.animator.update(dt, {});
      this.updateCamera(dt, input);
      return;
    }

    // camera rotation from mouse / touch / right stick
    const look = input.consumeLook();
    const sens = 0.0022;
    this.cameraYaw -= look.dx * sens;
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + look.dy * sens, -0.25, 0.85);

    // zoom
    const wheel = input.consumeWheel();
    if (wheel) this.cameraTargetDistance = THREE.MathUtils.clamp(this.cameraTargetDistance + wheel * 0.5, 1.6, 6.5);

    // desired horizontal movement, camera-relative
    const move = input.move();
    const mag = Math.min(1, Math.hypot(move.x, move.y));
    const running = input.runHeld() && mag > 0.3;
    const speed = (running ? this.speedRun : this.speedWalk) * mag;

    if (mag > 0.01) {
      const forward = TMP.set(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
      const right = TMP2.set(forward.z, 0, -forward.x);
      const dir = new THREE.Vector3()
        .addScaledVector(forward, move.y)
        .addScaledVector(right, move.x);
      if (dir.lengthSq() > 0) {
        dir.normalize();
        this.velocity.lerp(dir.multiplyScalar(speed), Math.min(1, dt * 9));
        const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
        this.yaw = this.lerpAngle(this.yaw, targetYaw, Math.min(1, dt * 8));
      }
    } else {
      this.velocity.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 12));
    }

    // integrate position with collision
    const before = this.position.clone();
    this.position.x += this.velocity.x * dt;
    this.resolveCollisions('x');
    this.position.z += this.velocity.z * dt;
    this.resolveCollisions('z');
    this.clampToRoom();

    // jump — optional, small, never affects content access
    if (input.keys.has('Space') && this.grounded) { this.verticalVelocity = 3.0; this.grounded = false; }
    if (!this.grounded) {
      this.verticalVelocity -= 9.2 * dt;
      this.jump += this.verticalVelocity * dt;
      if (this.jump <= 0) { this.jump = 0; this.verticalVelocity = 0; this.grounded = true; }
    }

    // footstep audio
    const travelled = before.distanceTo(this.position);
    this.stepDistance += travelled;
    if (travelled > 0.001 && this.stepDistance > 0.85) {
      this.stepDistance = 0;
      this.audio.footstep(running ? 1.3 : 1);
    }

    // pose selection
    const planar = Math.hypot(this.velocity.x, this.velocity.z);
    const clip = this.locked ? 'Idle_Stand'
      : planar < 0.12 ? 'Idle_Breathe'
        : running ? 'Run_FastWalk' : 'Walk';
    if (this.animator.current !== clip && !this.forcedClip) {
      this.animator.play(clip, { blendSpeed: planar > 0.2 ? 8 : 4 });
    }

    this.character.root.position.set(this.position.x, this.jump, this.position.z);
    this.character.root.rotation.y = this.yaw;
    this.animator.update(dt, { run: running });

    this.updateCamera(dt, input);
    this.probeInteraction();
    if (doorCheck) doorCheck(this);
  }

  forcedClip = null;

  playClip(name, seconds = null) {
    this.forcedClip = name;
    this.animator.play(name, { blendSpeed: 6, restart: true });
    if (seconds) {
      clearTimeout(this._clipTimer);
      this._clipTimer = setTimeout(() => { this.forcedClip = null; }, seconds * 1000);
    }
  }

  lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }

  /* ------------------------------------------------------------ collision */
  resolveCollisions(axis) {
    for (const box of this.world.colliders) {
      if (box.tag === 'stage' && this.position.y > 0.1) continue;
      const withinX = this.position.x > box.min.x - this.radius && this.position.x < box.max.x + this.radius;
      const withinZ = this.position.z > box.min.z - this.radius && this.position.z < box.max.z + this.radius;
      const heightOk = box.max.y > 0.35 && box.min.y < 1.6;
      if (withinX && withinZ && heightOk) {
        if (axis === 'x') {
          this.position.x = this.position.x < (box.min.x + box.max.x) / 2 ? box.min.x - this.radius : box.max.x + this.radius;
          this.velocity.x = 0;
        } else {
          this.position.z = this.position.z < (box.min.z + box.max.z) / 2 ? box.min.z - this.radius : box.max.z + this.radius;
          this.velocity.z = 0;
        }
      }
    }
  }

  clampToRoom() {
    const R = this.content.exhibits.rooms[this.world.zone];
    const dims = this.world.zone === 'hub'
      ? { width: this.content.museum.hall.width, depth: this.content.museum.hall.depth }
      : R ? { width: R.width + 10, depth: R.depth + 10 } : { width: 40, depth: 40 };
    const mx = dims.width / 2 - 0.7;
    const mz = dims.depth / 2 - 0.7;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -mx, mx);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -mz, mz);
  }

  /* --------------------------------------------------------------- camera */
  updateCamera(dt, input) {
    const dist = THREE.MathUtils.lerp(this.cameraDistance, this.cameraTargetDistance, Math.min(1, dt * 6));
    this.cameraDistance = dist;
    const height = this.inspectMode ? 1.45 : 1.62;
    const pivot = TMP.set(this.position.x, this.jump + height, this.position.z);

    const dir = new THREE.Vector3(
      Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
      Math.sin(this.cameraPitch) + 0.28,
      Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
    ).normalize();

    // obstacle avoidance: shorten the boom if a collider is in the way
    let allowed = dist;
    for (const box of this.world.colliders) {
      const hit = this.rayBoxDistance(pivot, dir, box);
      if (hit !== null && hit < allowed) allowed = Math.max(1.1, hit - 0.25);
    }

    const desired = new THREE.Vector3().copy(pivot).addScaledVector(dir, allowed);
    desired.y = Math.max(0.55, desired.y);
    this.camera.position.lerp(desired, Math.min(1, dt * 9));
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt);
      this.camera.position.x += (Math.random() - 0.5) * 0.03 * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * 0.03 * this.cameraShake;
    }
    this.camera.lookAt(pivot.x, pivot.y + 0.12, pivot.z);
  }

  snapCamera() {
    const height = 1.62;
    const dir = new THREE.Vector3(
      Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
      Math.sin(this.cameraPitch) + 0.28,
      Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
    ).normalize();
    this.camera.position.copy(new THREE.Vector3(this.position.x, this.jump + height, this.position.z).addScaledVector(dir, this.cameraDistance));
    this.camera.lookAt(this.position.x, this.jump + height + 0.12, this.position.z);
  }

  /** Distance along a ray to an AABB, or null. Slab method. */
  rayBoxDistance(origin, dir, box) {
    let tmin = 0, tmax = Infinity;
    for (const axis of ['x', 'y', 'z']) {
      const o = origin[axis], d = dir[axis];
      const mn = box.min[axis], mx = box.max[axis];
      if (Math.abs(d) < 1e-6) { if (o < mn || o > mx) return null; continue; }
      let t1 = (mn - o) / d, t2 = (mx - o) / d;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    return tmin;
  }

  /* ---------------------------------------------------------- interaction */
  probeInteraction() {
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const origin = new THREE.Vector3(this.position.x, 1.35, this.position.z);
    let best = null;
    let bestScore = Infinity;
    for (const it of this.world.interactables) {
      const toObj = TMP.copy(it.centre).sub(origin);
      const dist = toObj.length();
      if (dist > this.interactRadius + 1.6) continue;
      const ahead = toObj.clone().setY(0).normalize().dot(forward);
      const facing = ahead > 0.25 || dist < 1.5;
      if (!facing) continue;
      const score = dist - ahead * 1.2;
      if (score < bestScore) { bestScore = score; best = it; }
    }
    this.focus = best;
    this.focusDistance = best ? best.centre.distanceTo(origin) : 0;
  }

  /** Look at an exhibit while examining it: smooth head turn, not a snap. */
  lookAtExhibit(target, weight = 1) {
    if (!target) { this.animator.setLook(0, 0, 0); return; }
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const targetYaw = Math.atan2(dx, dz);
    let rel = ((targetYaw - this.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    const dy = (target.y || 1.4) - 1.6;
    this.animator.setLook(THREE.MathUtils.clamp(rel, -0.9, 0.9), THREE.MathUtils.clamp(dy * 0.6, -0.3, 0.4), weight);
  }

  teleportTo(x, z, yaw = null) {
    this.position.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    if (yaw !== null) { this.yaw = yaw; this.cameraYaw = yaw; }
    this.character.root.position.set(x, 0, z);
    this.character.root.rotation.y = this.yaw;
    this.snapCamera();
  }
}
