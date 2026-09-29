/* ==========================================================================
   builder.js — the world.

   Generates the museum hub from museum.json, each gallery from its room
   description in exhibits.json, and the eight memorial reconstructions from
   memorials.json. Rooms are built, disposed and rebuilt on demand: only the
   hub and the current gallery are ever resident, which is the memory strategy
   documented for Android in Documentation/09.

   Every interactable is returned in a flat list the player system can raycast
   against, so adding an exhibit is a content change, not a code change.
   ========================================================================== */

import * as THREE from 'three';
import * as P from './props.js';

export class World {
  constructor(scene, content, materials, quality = 'high') {
    this.scene = scene;
    this.content = content;
    this.mats = materials;
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.name = 'GeneratedWorld';
    this.scene.add(this.group);
    this.interactables = [];
    this.colliders = [];
    this.doors = [];
    this.room = null;
    this.zone = 'hub';
    this.lights = [];
    this.memorial = null;
  }

  clear() {
    this.interactables = [];
    this.colliders = [];
    this.doors = [];
    this.memorial = null;
    const kill = (obj) => {
      obj.traverse((o) => {
        if (o.isMesh || o.isInstancedMesh) {
          o.geometry?.dispose?.();
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
          else if (o.material && o.material.__generated !== false) o.material.dispose?.();
        }
      });
      obj.parent?.remove(obj);
    };
    while (this.group.children.length) kill(this.group.children[0]);
    if (this.room) { kill(this.room); this.room = null; }
  }

  /* ------------------------------------------------------------- helpers */
  addCollider(x, y, z, w, h, d, tag = '') {
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(x - w / 2, y, z - d / 2),
      new THREE.Vector3(x + w / 2, y + h, z + d / 2)
    ).expandByScalar(0));
    if (tag) this.colliders[this.colliders.length - 1].tag = tag;
  }

  registerInteractable(object, def, extra = {}) {
    const box = new THREE.Box3().setFromObject(object);
    const centre = new THREE.Vector3(); box.getCenter(centre);
    const record = {
      id: def.id, label: def.label || def.id, kind: def.kind, interaction: def.interaction,
      object, centre, box, def, ...extra
    };
    this.interactables.push(record);
    return record;
  }

  shell({ width, depth, height, palette = [], style = 'hall', floorMat = null }) {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat || this.mats.marble);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);
    const wallH = height;
    const wallMat = this.mats.stone;
    const walls = [
      [0, -depth / 2, width, 0.3],
      [0, depth / 2, width, 0.3],
      [-width / 2, 0, 0.3, depth],
      [width / 2, 0, 0.3, depth]
    ];
    walls.forEach(([x, z, w, d], i) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      wall.position.set(x, wallH / 2, z);
      wall.castShadow = false; wall.receiveShadow = true;
      g.add(wall);
      if (i === 1) { // far wall: leave the doorway opening clear
        this.addCollider(x - width / 4, 0, z, width / 2 - 1.6, wallH, d);
        this.addCollider(x + width / 4, 0, z, width / 2 - 1.6, wallH, d);
      } else if (i === 0) {
        this.addCollider(x - width / 4, 0, z, width / 2 - 1.6, wallH, d);
        this.addCollider(x + width / 4, 0, z, width / 2 - 1.6, wallH, d);
      } else {
        this.addCollider(x, 0, z, w, wallH, d);
      }
    });
    g.add(P.ceiling(this.mats, { width, depth, height, strips: style === 'memorial_hall' ? 3 : 5 }).group);
    // skirting: a stone band that stops the floor reading as a plane
    const skirtMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette[2] || '#5a4a32'), roughness: 0.8 });
    [[0, -depth / 2 + 0.16, width, 0.32], [0, depth / 2 - 0.16, width, 0.32]]
      .forEach(([x, z, w, d]) => {
        const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), skirtMat);
        s.position.set(x, 0.09, z); g.add(s);
      });
    return g;
  }

  /* ------------------------------------------------------------ the hub */
  buildHub() {
    this.clear();
    this.zone = 'hub';
    const M = this.content.museum;
    const H = M.hall;
    const room = new THREE.Group();
    room.name = 'MuseumHub';
    this.group.add(room);
    this.room = room;

    room.add(this.shell({ width: H.width, depth: H.depth, height: H.height, style: 'hall', palette: ['#E8E2D6', '#C9B79A', '#22314E'] }));

    // columns
    (H.columns || []).forEach((col) => {
      const c = P.column(this.mats, { height: col.height - 1, radius: col.radius });
      c.group.position.set(col.x, 0, col.z);
      room.add(c.group);
      this.addCollider(col.x, 0, col.z, col.radius * 2.6, col.height, col.radius * 2.6);
    });

    // entrance arch (behind the player)
    const arch = new THREE.Group();
    arch.add(new THREE.Mesh(new THREE.BoxGeometry(H.arches.entranceWidth + 1.4, 0.7, 1.2),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#B08D4F'), roughness: 0.4, metalness: 0.5 })));
    arch.position.set(0, H.arches.entranceHeight, -H.depth / 2 + 0.4);
    room.add(arch);
    const entrySign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), this.mats._sign(
      ['THE DIGITAL AMBEDKAR HERITAGE MUSEUM', 'Six galleries · 69 records · one archive'], { width: 1536, height: 200, titleSize: 66, bodySize: 40 }));
    entrySign.position.set(0, H.arches.entranceHeight + 1.1, -H.depth / 2 + 1.05);
    room.add(entrySign);

    // the six doors — exactly six, no seventh
    const doorObjs = [];
    M.doors.forEach((d, i) => {
      const door = P.galleryDoor(this.mats, d, { index: i + 1 });
      door.group.position.set(d.x, 0, d.z - 0.5);
      door.group.rotation.y = Math.PI;
      room.add(door.group);
      door.zone = d.zone;
      door.doorId = d.doorId;
      this.doors.push(door);
      doorObjs.push(door);
      this.addCollider(d.x - d.width / 2 - 0.4, 0, d.z - 0.5, 0.4, d.height, 0.8);
      this.addCollider(d.x + d.width / 2 + 0.4, 0, d.z - 0.5, 0.4, d.height, 0.8);
      this.registerInteractable(door.group, {
        id: d.doorId, label: `${d.label}`, kind: 'door', interaction: 'press'
      }, { door, zone: d.zone, isDoor: true });
    });
    room.add(P.labelRail(this.mats, M.doors).group);

    // set dressing from museum.json
    const dress = {};
    (M.setDressing || []).forEach((piece) => {
      let built = null;
      switch (piece.type) {
        case 'reception_desk': built = P.receptionDesk(this.mats, piece.size); break;
        case 'guide_terminal': built = P.kiosk(this.mats, { title: ['ARCHIVE GUIDE', 'Ask a question'], w: piece.size[0], h: piece.size[1], d: piece.size[2] }); break;
        case 'central_monument': built = P.centralMonument(this.mats, { width: piece.size[0], height: piece.size[1], depth: piece.size[2] }); break;
        case 'bench': built = P.bench(this.mats, { width: piece.size[0] }); break;
        case 'projection_screen': built = P.projectionScreen(this.mats, { width: piece.size[0], height: piece.size[1] }); break;
        case 'archive_kiosk': built = P.kiosk(this.mats, { title: ['DIGITAL ARCHIVE', 'Search 69 records'], w: piece.size[0], h: piece.size[1], d: piece.size[2] }); break;
        case 'glass_display_case': built = P.displayCase(this.mats, { width: piece.size[0], height: piece.size[1], depth: piece.size[2] }); break;
        case 'bookshelf': built = P.bookshelf(this.mats, { width: piece.size[0], height: piece.size[1], depth: piece.size[2], fill: piece.fillLevel || 0.8 }); break;
        case 'archive_cabinet': built = P.archiveCabinet(this.mats, { width: piece.size[0], height: piece.size[1], depth: piece.size[2] }); break;
        case 'info_stele': built = P.infoStele(this.mats, { lines: ['DIGITAL HERITAGE ARCHIVE', 'Search · cite · read', 'The archive answers only from its records', 'SIH26096 · Smart Education'] }); break;
        case 'planter': built = P.planter(this.mats, { size: piece.size[0] }); break;
        case 'label_rail': built = null; break;
        default: built = null;
      }
      if (!built) return;
      built.group.position.set(piece.x, 0, piece.z);
      built.group.rotation.y = THREE.MathUtils.degToRad(piece.rotationY || 0);
      room.add(built.group);
      dress[piece.id] = built;
      this.addCollider(piece.x, 0, piece.z, piece.size[0], Math.max(0.6, piece.size[1] || 1.2), piece.size[2] || 1);
    });

    // timeline wall on the west side
    const timelineWall = new THREE.Group();
    const tw = dress.hub_timeline_wall;
    const events = this.content.timeline.events.filter((e, i) => i % 4 === 0).slice(0, 10);
    events.forEach((e, i) => {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.5), this.mats._sign(
        [String(e.year), e.title], { width: 512, height: 420, titleSize: 74, bodySize: 32, align: 'left' }));
      panel.position.set(Math.sin(THREE.MathUtils.degToRad(90)) * 0, 1.6, 0);
      const holder = new THREE.Group();
      holder.add(panel);
      holder.position.set(-H.width / 2 + 0.35, 0, -9 + i * 2.05);
      holder.rotation.y = Math.PI / 2;
      timelineWall.add(holder);
    });
    room.add(timelineWall);
    if (tw) {
      room.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 22), this.mats.wood)
        .translateX(-H.width / 2 + 0.2));
    }

    // hub interactables
    const hubExhibits = this.content.exhibits.exhibits.filter(e => e.zone === 'hub');
    hubExhibits.forEach((def) => {
      let anchor = null;
      switch (def.kind) {
        case 'timeline_wall': anchor = timelineWall; break;
        case 'guide_terminal': anchor = dress.hub_guide_terminal?.group; break;
        case 'archive_kiosk': anchor = dress.hub_archive_terminal_1?.group; break;
        case 'projection_screen': anchor = dress.hub_projection_screen?.group; break;
        case 'display_case': anchor = def.position[2] > 8 ? dress.hub_glass_case_1?.group : dress.hub_glass_case_2?.group; break;
        default: anchor = null;
      }
      if (anchor) {
        const rec = this.registerInteractable(anchor, def);
        rec.anchorOverride = true;
      }
    });
    // archive terminal 2 mirrors the kiosk exhibit so either kiosk works
    if (dress.hub_archive_terminal_2) {
      this.registerInteractable(dress.hub_archive_terminal_2.group, {
        ...hubExhibits.find(e => e.id === 'exhibit_hub_archive_kiosk'), id: 'exhibit_hub_archive_kiosk_2', label: 'Digital Heritage Archive Terminal'
      });
    }

    this.buildLighting(M.lighting, H);
    return room;
  }

  buildLighting(lighting, H) {
    const amb = new THREE.AmbientLight(new THREE.Color(lighting.ambient || '#3B3A38'), lighting.ambientIntensity ?? 0.55);
    this.scene.add(amb);
    this.lights.push(amb);
    const sky = new THREE.HemisphereLight(new THREE.Color(lighting.skylightColor || '#D9E4F2'), new THREE.Color('#4a4038'), lighting.skylightIntensity ?? 0.35);
    this.scene.add(sky);
    this.lights.push(sky);

    const key = new THREE.DirectionalLight(new THREE.Color('#F0E4CC'), this.quality === 'low' ? 0.75 : 1.05);
    key.position.set(12, 22, 10);
    key.castShadow = this.quality !== 'low';
    if (key.castShadow) {
      key.shadow.mapSize.set(this.quality === 'high' ? 2048 : 1024, this.quality === 'high' ? 2048 : 1024);
      key.shadow.camera.left = -34; key.shadow.camera.right = 34;
      key.shadow.camera.top = 34; key.shadow.camera.bottom = -34;
      key.shadow.camera.far = 90;
      key.shadow.bias = -0.0012;
    }
    this.scene.add(key);
    this.lights.push(key);

    (lighting.spotGroups || []).forEach((grp) => {
      const limited = this.quality === 'low' ? Math.min(2, grp.count) : grp.count;
      for (let i = 0; i < limited; i += 1) {
        const pos = grp.positions[i] || grp.positions[0];
        const tgt = grp.targets[i] || grp.targets[0];
        const spot = new THREE.SpotLight(new THREE.Color('#FFE7BC'), grp.intensity * (this.quality === 'low' ? 0.7 : 1) * 0.55,
          Math.max(18, H.height * 2.6), THREE.MathUtils.degToRad(grp.angleDeg || 32), 0.5, 1.6);
        spot.position.set(pos[0], pos[1], pos[2]);
        spot.target.position.set(tgt[0], tgt[1], tgt[2]);
        spot.castShadow = false;
        this.scene.add(spot, spot.target);
        this.lights.push(spot);
      }
    });
  }

  clearLighting() {
    this.lights.forEach((l) => { l.parent?.remove(l); l.dispose?.(); });
    this.lights = [];
  }

  /* --------------------------------------------------------- the galleries */
  buildZone(zoneId) {
    this.clear();
    this.clearLighting();
    this.zone = zoneId;
    const room = new THREE.Group();
    room.name = `Zone_${zoneId}`;
    this.group.add(room);
    this.room = room;

    const R = this.content.exhibits.rooms[zoneId] || { width: 28, depth: 28, height: 7 };
    const palette = R.palette || [];
    room.add(this.shell({ width: R.width, depth: R.depth, height: R.height, style: R.style, palette }));

    // entrance title panel behind the spawn
    const title = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(R.width * 0.8, 12), 1.4), this.mats._sign(
      [this.content.zonesById.get(zoneId)?.name || zoneId, this.content.zonesById.get(zoneId)?.subtitle || ''],
      { width: 1536, height: 240, titleSize: 70, bodySize: 40 }));
    title.position.set(0, R.height * 0.72, -R.depth / 2 + 0.25);
    room.add(title);

    // style-specific architecture
    switch (R.style) {
      case 'timeline_ramp': this.buildRamp(room, R); break;
      case 'campaign_hall': this.buildDioramaStage(room, R); break;
      case 'rotunda': this.buildRotunda(room, R); break;
      case 'research_room': this.buildShelfWalls(room, R); break;
      case 'memorial_hall': this.buildMapFloor(room, R); break;
      case 'digital_archive': this.buildCurvedWall(room, R); break;
      default: break;
    }

    this.buildZoneLighting(zoneId, R);
    this.placeZoneExhibits(zoneId, room, R);
    return room;
  }

  buildRamp(room, R) {
    const steps = 12;
    for (let i = 0; i < steps; i += 1) {
      const z = -R.depth / 2 + 4 + (i / steps) * (R.depth - 8);
      const h = (i / steps) * (R.rampRise || 2);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(R.width - 1.2, 0.34, (R.depth - 8) / steps + 0.1), this.mats.marble);
      slab.position.set(0, h, z);
      slab.receiveShadow = true;
      room.add(slab);
    }
  }

  buildDioramaStage(room, R) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.8, 0.5, 40), this.mats.stone);
    base.position.y = 0.25;
    base.receiveShadow = true;
    room.add(base);
    this.addCollider(0, 0, 0, 15, 0.5, 15, 'stage');
    // a stylised water tank — the Mahad satyagraha site
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.4, 1.3, 24), this.mats.stone);
    tank.position.set(0, 1.1, 0.6);
    room.add(tank);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.3, 24), this.mats.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 1.76, 0.6);
    room.add(water);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 10), this.mats.wood);
      post.position.set(Math.cos(a) * 5.6, 1.3, Math.sin(a) * 5.6);
      room.add(post);
    }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.1), this.mats._sign(
      ['DIGITAL RECONSTRUCTION', 'Mahad · 20 March 1927 · not a surveyed model'],
      { width: 1024, height: 176, titleSize: 54, bodySize: 34 }));
    banner.position.set(0, 3.3, 5.4);
    room.add(banner);
  }

  buildRotunda(room, R) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9.4, 0.5, 12, 48), this.mats.brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    room.add(ring);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R.width * 0.42, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2.4),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#E9E4DA'), roughness: 0.6, side: THREE.BackSide }));
    dome.position.y = R.height * 0.62;
    room.add(dome);
    const oculus = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#D9E4F2'), emissive: new THREE.Color('#D9E4F2'), emissiveIntensity: 0.8 }));
    oculus.rotation.x = Math.PI / 2;
    oculus.position.y = R.height * 0.98;
    room.add(oculus);
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const col = P.column(this.mats, { height: 5.6, radius: 0.34 });
      col.group.position.set(Math.cos(a) * 11.4, 0, Math.sin(a) * 11.4);
      room.add(col.group);
      this.addCollider(Math.cos(a) * 11.4, 0, Math.sin(a) * 11.4, 0.9, 5.6, 0.9);
    }
  }

  buildShelfWalls(room, R) {
    [-1, 1].forEach((s) => {
      const shelf = P.bookshelf(this.mats, { width: R.depth * 0.8, height: 3.4, depth: 0.6, fill: 0.9 });
      shelf.group.position.set(s * (R.width / 2 - 0.6), 0, 0);
      shelf.group.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      room.add(shelf.group);
    });
    this.addCollider(-R.width / 2 + 0.6, 0, 0, 1, 3.4, R.depth * 0.8);
    this.addCollider(R.width / 2 - 0.6, 0, 0, 1, 3.4, R.depth * 0.8);
  }

  buildMapFloor(room, R) {
    const map = new THREE.Mesh(new THREE.PlaneGeometry(R.width * 0.7, R.depth * 0.6),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#101c2e'), emissive: new THREE.Color('#1f4e79'), emissiveIntensity: 0.25, roughness: 0.5 }));
    map.rotation.x = -Math.PI / 2;
    map.position.y = 0.02;
    room.add(map);
    const sites = this.content.memorials.sites;
    sites.forEach((site, i) => {
      const a = (i / sites.length) * Math.PI * 2;
      const r = Math.min(R.width, R.depth) * 0.28;
      const plinth = P.plinth(this.mats, {
        radius: 0.85, height: 1.05, accent: site.palette?.[1] || '#C9A227',
        lines: [site.name]
      });
      plinth.group.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      room.add(plinth.group);
      this.addCollider(Math.cos(a) * r, 0, Math.sin(a) * r, 1.8, 1.1, 1.8);
      this.registerInteractable(plinth.group, {
        id: `plinth_${site.id}`, label: site.name, kind: 'memorial_plinth', interaction: 'press'
      }, { memorialId: site.id });
    });
  }

  buildCurvedWall(room, R) {
    const wall = P.archiveWall(this.mats, { radius: Math.min(R.width, R.depth) * 0.42, count: this.quality === 'low' ? 6 : 9, height: R.height * 0.62 });
    wall.group.position.set(0, 0, -R.depth * 0.16);
    room.add(wall.group);
  }

  buildZoneLighting(zoneId, R) {
    const zone = this.content.zonesById.get(zoneId);
    const accent = new THREE.Color(zone?.accentColor || '#C9A227');
    const amb = new THREE.AmbientLight(new THREE.Color('#3A3630'), zoneId === 'memorials' ? 0.42 : 0.55);
    this.scene.add(amb); this.lights.push(amb);
    const hemi = new THREE.HemisphereLight(new THREE.Color('#D9E4F2'), new THREE.Color('#3a332c'), 0.3);
    this.scene.add(hemi); this.lights.push(hemi);
    const key = new THREE.DirectionalLight(new THREE.Color('#F3E7D0'), this.quality === 'low' ? 0.7 : 0.95);
    key.position.set(8, 18, 8);
    key.castShadow = this.quality !== 'low';
    if (key.castShadow) {
      key.shadow.mapSize.set(this.quality === 'high' ? 2048 : 1024, this.quality === 'high' ? 2048 : 1024);
      key.shadow.camera.left = -26; key.shadow.camera.right = 26;
      key.shadow.camera.top = 26; key.shadow.camera.bottom = -26;
      key.shadow.camera.far = 70;
    }
    this.scene.add(key); this.lights.push(key);
    const accentLight = new THREE.PointLight(accent, 0.8, R.height * 2.2, 2);
    accentLight.position.set(0, R.height * 0.8, R.depth * 0.25);
    this.scene.add(accentLight); this.lights.push(accentLight);
  }

  placeZoneExhibits(zoneId, room, R) {
    const defs = this.content.exhibits.exhibits.filter(e => e.zone === zoneId);
    defs.forEach((def) => {
      const [x, y, z] = def.position;
      const size = def.size || [1.4, 1.4, 0.6];
      let built = null;
      const rotY = THREE.MathUtils.degToRad(def.rotationY || 0);

      switch (def.kind) {
        case 'display_case': built = P.displayCase(this.mats, { width: size[0], height: size[1], depth: size[2] }); break;
        case 'document_table': built = P.documentTable(this.mats, { width: size[0], depth: size[2] }); break;
        case 'reading_table': built = P.documentTable(this.mats, { width: size[0], depth: size[2] }); break;
        case 'reading_desk': built = P.documentTable(this.mats, { width: size[0], depth: size[2], height: 0.75 }); break;
        case 'book_shelf': built = P.bookshelf(this.mats, { width: size[0], height: size[1], depth: size[2], fill: 0.92 }); break;
        case 'audio_pillar': built = P.audioPillar(this.mats, { label: [def.label.slice(0, 18), 'LISTEN'] }); break;
        case 'quiz_kiosk': built = P.kiosk(this.mats, { title: ['KNOWLEDGE CHECK', def.label], w: size[0], h: size[1], d: size[2] }); break;
        case 'minigame_station': built = P.kiosk(this.mats, { title: [def.minigame === 'match_event' ? 'MATCH THE EVENT' : 'SORT THE TIMELINE', 'Interactive exercise'], w: size[0], h: size[1], d: size[2] }); break;
        case 'magnifier_station': built = P.documentTable(this.mats, { width: size[0], depth: size[2] }); break;
        case 'scanning_station': built = P.kiosk(this.mats, { title: ['SCANNING STATION', 'Accession · rights · transcription'], w: size[0], h: size[1], d: size[2] }); break;
        case 'constitution_table': built = this.buildConstitutionTable(room, size); break;
        case 'map_table': built = P.mapTable(this.mats, { width: size[0], depth: size[2] }); break;
        case 'search_terminal': built = P.kiosk(this.mats, { title: ['ARCHIVE SEARCH', 'constitution · education · memorials'], w: size[0], h: size[1], d: size[2] }); break;
        case 'ai_terminal': built = P.kiosk(this.mats, { title: ['ARCHIVE GUIDE', 'Ask a question — cited answers'], w: size[0], h: size[1], d: size[2] }); break;
        case 'media_wall': built = this.buildMediaWall(room, def, size); break;
        case 'achievement_wall': built = this.buildAchievementWall(room, def, size); break;
        case 'digital_timeline': built = this.buildDigitalTimeline(room, def, size); break;
        case 'final_challenge_dais': built = this.buildDais(room, size); break;
        case 'reconstruction_diorama': built = null; break; // built by the room's centrepiece
        case 'panel': built = P.signPanel(this.mats, [def.label], { width: size[0], height: size[1], post: true, opts: { width: 1024, height: 640, titleSize: 52, bodySize: 32, align: 'left' } }); break;
        case 'paired_extract': built = this.buildPairedExtract(room, def, size); break;
        case 'article_wall': built = this.buildArticleWall(room, def, size); break;
        case 'comparison_panel': built = P.signPanel(this.mats, [def.label, 'Objectives Resolution → Preamble'], { width: size[0], height: size[1], post: true, opts: { width: 1280, height: 720, titleSize: 52, bodySize: 34, align: 'left' } }); break;
        default: built = P.signPanel(this.mats, [def.label], { width: size[0], height: size[1], post: true }); break;
      }
      if (!built) return;
      built.group.position.set(x, y, z);
      built.group.rotation.y = rotY;
      room.add(built.group);
      if (def.kind !== 'reconstruction_diorama') {
        this.addCollider(x, 0, z, Math.max(0.8, size[0]), Math.max(0.8, size[1] || 1.4), Math.max(0.8, size[2] || 1));
      }
      const rec = this.registerInteractable(built.group, def);
      rec.built = built;
    });
  }

  buildConstitutionTable(room, size) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(size[0] / 2, size[0] / 2, 0.12, 40), this.mats.wood);
    top.position.y = 0.98;
    g.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(size[0] / 2 - 0.1, 0.03, 8, 60), this.mats.gold);
    ring.rotation.x = Math.PI / 2; ring.position.y = 1.05;
    g.add(ring);
    const centre = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.0, 24), this.mats.darkMetal);
    centre.position.y = 0.5;
    g.add(centre);
    const book = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 1.0), this.mats.paper);
    book.position.y = 1.14;
    g.add(book);
    // floating article panels around the table
    const concepts = this.content.glossary.concepts.filter(cn => cn.zone === 'law_constitution').slice(0, 8);
    concepts.forEach((cn, i) => {
      const a = (i / concepts.length) * Math.PI * 2;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.05), this.mats._sign(
        [cn.term.replace(/^Article\s/, 'Art. '), cn.shortDef.slice(0, 90)],
        { width: 640, height: 460, titleSize: 44, bodySize: 26, align: 'left' }));
      panel.position.set(Math.cos(a) * 2.5, 1.5 + Math.sin(i) * 0.18, Math.sin(a) * 2.5);
      panel.rotation.y = -a + Math.PI / 2;
      g.add(panel);
    });
    this.addCollider(0, 0, 0, size[0], 1.1, size[0]);
    return { group: g };
  }

  buildPairedExtract(room, def, size) {
    const g = new THREE.Group();
    const left = P.signPanel(this.mats, ['POSITION A — separate electorates', def.panel?.body?.slice(0, 150) || ''],
      { width: size[0] / 2 - 0.1, height: size[1], opts: { width: 768, height: 640, titleSize: 40, bodySize: 26, align: 'left' } });
    const right = P.signPanel(this.mats, ['POSITION B — joint electorates', 'Reserved seats within a joint electorate.'],
      { width: size[0] / 2 - 0.1, height: size[1], opts: { width: 768, height: 640, titleSize: 40, bodySize: 26, align: 'left' } });
    left.group.position.x = -(size[0] / 4);
    right.group.position.x = size[0] / 4;
    g.add(left.group, right.group);
    return { group: g };
  }

  buildArticleWall(room, def, size) {
    const g = new THREE.Group();
    const articleList = ['Article 12 · definition of State', 'Article 14 · equality before the law', 'Article 15 · no discrimination',
      'Article 16 · equality of opportunity', 'Article 17 · untouchability abolished', 'Article 19 · freedoms',
      'Article 21 · life and personal liberty', 'Article 25 · freedom of religion', 'Article 32 · constitutional remedies'];
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), this.mats._sign(
      ['PART III — FUNDAMENTAL RIGHTS', articleList.join('  ·  ')],
      { width: 1536, height: 900, titleSize: 60, bodySize: 34, align: 'left' }));
    g.add(panel);
    return { group: g };
  }

  buildMediaWall(room, def, size) {
    const g = new THREE.Group();
    const items = def.media || [];
    items.forEach((m, i) => {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), this.mats._sign(
        [m.type.toUpperCase(), m.label, m.isReconstruction ? 'Digital Reconstruction' : 'Institutional holding'],
        { width: 768, height: 480, titleSize: 54, bodySize: 30, align: 'center' }));
      panel.position.set(0, 2.9 - i * 1.8, 0.12);
      g.add(panel);
    });
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, size[1], 0.2), this.mats.darkMetal);
    back.position.set(0, size[1] / 2, 0);
    g.add(back);
    return { group: g };
  }

  buildAchievementWall(room, def, size) {
    const g = new THREE.Group();
    const rows = this.content.achievements.achievements.slice(0, 16).map(a => `◦ ${a.title} — ${a.description}`);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), this.mats._sign(
      ['ACHIEVEMENT WALL', rows.slice(0, 8).join('\n')],
      { width: 1024, height: 768, titleSize: 54, bodySize: 26, align: 'left' }));
    g.add(panel);
    return { group: g };
  }

  buildDigitalTimeline(room, def, size) {
    const g = new THREE.Group();
    const evs = this.content.timeline.events.filter((e, i) => i % 3 === 0).map(e => `${e.year} · ${e.title}`);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), this.mats._sign(
      ['INTERACTIVE TIMELINE 1891 — 2026', evs.slice(0, 6).join('\n')],
      { width: 1536, height: 700, titleSize: 56, bodySize: 30, align: 'left' }));
    g.add(panel);
    return { group: g };
  }

  buildDais(room, size) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(size[0] / 2, size[0] / 2 + 0.3, 0.36, 40), this.mats.stone);
    base.position.y = 0.18;
    g.add(base);
    const lectern = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.5), this.mats.wood);
    lectern.position.set(0, 0.9, 0.4);
    g.add(lectern);
    const seal = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 8, 40), this.mats.gold);
    seal.rotation.x = Math.PI / 2; seal.position.y = 0.38;
    g.add(seal);
    return { group: g };
  }

  /* ------------------------------------------------------- the memorials */
  buildMemorial(siteId) {
    this.clear();
    this.clearLighting();
    this.zone = 'memorial';
    const site = this.content.memorialsById.get(siteId);
    const room = new THREE.Group();
    room.name = `Memorial_${siteId}`;
    this.group.add(room);
    this.room = room;
    this.memorial = site;
    if (!site) return room;

    const P0 = site.sceneParams || {};
    const size = P0.plazaSize || 30;
    room.add(this.shell({ width: size + 12, depth: size + 12, height: Math.max(12, (P0.domeHeight || 14) + 6), style: 'memorial_hall', palette: site.palette }));

    switch (site.sceneStyle) {
      case 'garden_memorial': {
        const g = P.gardenMemorial(this.mats, { plazaSize: P0.plazaSize, obeliskHeight: P0.obeliskHeight, beds: P0.gardenBeds, steps: P0.stepCount, channel: P0.waterChannel });
        room.add(g.group);
        break;
      }
      case 'house_library': {
        const h = P.houseShell(this.mats, { width: P0.houseWidth, depth: P0.houseDepth, storeys: P0.storeys, style: 'house', veranda: true });
        room.add(h.group);
        const shelf = P.bookshelf(this.mats, { width: Math.min(10, P0.libraryShelfMetres / 4), height: 3.0, depth: 0.6, fill: 1 });
        shelf.group.position.set(0, 0, -P0.houseDepth / 2 - 6);
        room.add(shelf.group);
        break;
      }
      case 'plaza_memorial': {
        const canopy = new THREE.Mesh(new THREE.CylinderGeometry(P0.canopyRadius || 5, (P0.canopyRadius || 5) * 1.15, 1.2, 40), this.mats.stone);
        canopy.position.y = 5.2;
        room.add(canopy);
        for (let i = 0; i < (P0.columns || 12); i += 1) {
          const a = (i / (P0.columns || 12)) * Math.PI * 2;
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 5, 16), this.mats.marble);
          col.position.set(Math.cos(a) * (P0.canopyRadius || 5) * 0.92, 2.5, Math.sin(a) * (P0.canopyRadius || 5) * 0.92);
          room.add(col);
        }
        for (let i = 0; i < (P0.stepCount || 5); i += 1) {
          const step = new THREE.Mesh(new THREE.CylinderGeometry((P0.canopyRadius || 5) + i * 0.8, (P0.canopyRadius || 5) + i * 0.8, 0.3, 40), this.mats.marble);
          step.position.y = 0.15 + i * 0.3;
          room.add(step);
        }
        break;
      }
      case 'stupa_complex': {
        const st = P.stupa(this.mats, { radius: P0.domeRadius || 12, height: P0.domeHeight || 18, flights: P0.stairFlights || 4, accent: site.palette?.[1] });
        room.add(st.group);
        for (let i = 0; i < (P0.reflectingPool || 2); i += 1) {
          const pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), this.mats.water);
          pool.rotation.x = -Math.PI / 2;
          pool.position.set(0, 0.06, 22 + i * 12);
          room.add(pool);
        }
        break;
      }
      case 'colonial_house_memorial': {
        const h = P.houseShell(this.mats, { width: P0.houseWidth, depth: P0.houseDepth, storeys: P0.storeys, style: 'house', veranda: true });
        room.add(h.group);
        const study = P.documentTable(this.mats, { width: 2.6, depth: 1.4 });
        study.group.position.set(0, 0, -P0.houseDepth / 2 - 7);
        room.add(study.group);
        break;
      }
      case 'colonnade_park': {
        const c1 = P.colonnade(this.mats, { columns: 20, spacing: 3.0, height: 7, radius: 0.36, axis: 'x', offset: -10 });
        const c2 = P.colonnade(this.mats, { columns: 20, spacing: 3.0, height: 7, radius: 0.36, axis: 'x', offset: 10 });
        room.add(c1.group, c2.group);
        const channel = new THREE.Mesh(new THREE.PlaneGeometry(4, 60), this.mats.water);
        channel.rotation.x = -Math.PI / 2;
        room.add(channel);
        const centralStupa = P.stupa(this.mats, { radius: (P0.centralStupaRadius || 8) * 0.5, height: 10, flights: 3, accent: '#B4703A' });
        centralStupa.group.position.set(0, 0, -22);
        room.add(centralStupa.group);
        break;
      }
      case 'lakefront_monument': {
        const lake = P.lakefront(this.mats, { width: 120, depth: 90 });
        room.add(lake.group);
        const statue = P.statueSilhouette(this.mats, { height: P0.statueHeight || 38, accent: site.palette?.[1] });
        statue.group.position.set(0, 0, -6);
        room.add(statue.group);
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 6, 32), this.mats.stone);
        ped.position.y = 3;
        room.add(ped);
        break;
      }
      case 'institution_atrium':
      default: {
        const h = P.houseShell(this.mats, { width: P0.atriumWidth || 26, depth: P0.atriumDepth || 22, storeys: 2, style: 'institution', veranda: false });
        room.add(h.group);
        for (let i = 0; i < (P0.readingTables || 6); i += 1) {
          const t = P.documentTable(this.mats, { width: 2.6, depth: 1.5 });
          t.group.position.set(-8 + (i % 3) * 8, 0, -6 + Math.floor(i / 3) * 8);
          room.add(t.group);
        }
        break;
      }
    }

    // information pillar with the site record, labelled as a reconstruction
    const record = site.archiveId ? this.content.recordsById.get(site.archiveId) : null;
    const info = P.infoStele(this.mats, {
      lines: [site.name, `${site.city} · ${site.state || ''}`, site.category.replace(/_/g, ' '), '', 'DIGITAL RECONSTRUCTION', 'Not a surveyed model.']
    });
    info.group.position.set(-6, 0, 6);
    info.group.rotation.y = 0.5;
    room.add(info.group);
    this.registerInteractable(info.group, {
      id: `memorial_info_${site.id}`, label: `${site.name} — information`, kind: 'memorial_info', interaction: 'read'
    }, { memorialId: site.id, record });

    // narration pillar
    const audio = P.audioPillar(this.mats, { label: ['NARRATION', site.city] });
    audio.group.position.set(6, 0, 6);
    room.add(audio.group);
    this.registerInteractable(audio.group, {
      id: `memorial_narration_${site.id}`, label: `Narration — ${site.name}`, kind: 'audio', interaction: 'listen'
    }, { memorialId: site.id, narration: site.narration });

    // tour waypoints as floor markers
    (site.tour || []).forEach((t, i) => {
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 24),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(site.palette?.[1] || '#C9A227'), emissive: new THREE.Color(site.palette?.[1] || '#C9A227'), emissiveIntensity: 0.5, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(-8 + i * 8, 0.03, 10);
      room.add(marker);
      this.registerInteractable(marker, {
        id: `memorial_tour_${site.id}_${t.id}`, label: `Tour stop ${i + 1} — ${t.label}`, kind: 'tour_stop', interaction: 'read'
      }, { memorialId: site.id, tourStop: t });
    });

    const amb = new THREE.AmbientLight(new THREE.Color('#3A3630'), 0.5);
    this.scene.add(amb); this.lights.push(amb);
    const hemi = new THREE.HemisphereLight(new THREE.Color('#CBD8E8'), new THREE.Color('#332e28'), 0.35);
    this.scene.add(hemi); this.lights.push(hemi);
    const key = new THREE.DirectionalLight(new THREE.Color('#F6EBD6'), this.quality === 'low' ? 0.75 : 1.0);
    key.position.set(14, 26, 12);
    key.castShadow = this.quality !== 'low';
    if (key.castShadow) {
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -40; key.shadow.camera.right = 40;
      key.shadow.camera.top = 40; key.shadow.camera.bottom = -40;
      key.shadow.camera.far = 110;
    }
    this.scene.add(key); this.lights.push(key);

    return room;
  }

  /* ----------------------------------------------------------- utilities */
  spawnPointFor(zoneId) {
    if (zoneId === 'hub') {
      const s = this.content.museum.spawnPoint || [0, 0, -11.5];
      return new THREE.Vector3(s[0], 0, s[2]);
    }
    if (zoneId === 'memorial') return new THREE.Vector3(0, 0, 12);
    const R = this.content.exhibits.rooms[zoneId];
    const depth = R?.depth || 28;
    return new THREE.Vector3(0, 0, -depth / 2 + 5);
  }

  /** Convert a world position into a museum-map coordinate (metres → plan). */
  mapPosition(position) {
    if (this.zone === 'hub') return { x: position.x, y: position.z, scale: 1 };
    const R = this.content.exhibits.rooms[this.zone] || {};
    return { x: position.x, y: position.z, scale: 1, room: this.zone, width: R.width, depth: R.depth };
  }
}

export { P as Props };
