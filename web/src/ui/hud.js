/* ==========================================================================
   hud.js — the heads-up display: objective banner, interaction prompt,
   knowledge points, zone title card, subtitles, toasts and both maps.

   Kept deliberately small on screen (brief §27) and collapsible on phones:
   the minimap can be hidden, and on touch devices the HUD controls sit in the
   two thumb zones so they never cover the exhibit the player is looking at.
   ========================================================================== */

import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(content, state, { onArchive, onMap, onMenu } = {}) {
    this.content = content;
    this.state = state;
    this.el = {
      hud: $('hud'),
      objective: $('hud-objective'),
      objectiveText: $('objective-text'),
      objectiveProgress: $('objective-progress'),
      points: $('kp-value'),
      prompt: $('hud-prompt'),
      promptKey: $('prompt-key'),
      promptText: $('prompt-text'),
      zone: $('hud-zone'),
      subtitles: $('subtitles'),
      subtitleText: $('subtitle-text'),
      toast: $('toast'),
      minimap: $('minimap'),
      mapCanvas: $('map-canvas')
    };
    this.subtitleTimer = null;
    this.toastTimer = null;
    this.minimapTimer = 0;
    this.mapOpen = false;

    if (onArchive) $('hud-archive').addEventListener('click', onArchive);
    if (onMap) $('hud-map').addEventListener('click', onMap);
    if (onMenu) $('hud-menu').addEventListener('click', onMenu);
  }

  show(on = true) { this.el.hud.classList.toggle('visible', on); }

  setObjective(text, progress = '') {
    this.el.objectiveText.textContent = text;
    this.el.objectiveProgress.textContent = progress;
  }

  flashObjective(text) {
    this.el.objectiveText.textContent = text;
    this.el.objective.classList.remove('flash');
    void this.el.objective.offsetWidth;
    this.el.objective.classList.add('flash');
  }

  setPoints(value) { this.el.points.textContent = value; }

  setPrompt(label, key = null) {
    if (!label) { this.el.prompt.classList.remove('show'); return; }
    const isTouch = document.body.classList.contains('touch');
    this.el.promptKey.textContent = isTouch ? '⦿' : (key || 'E');
    this.el.promptKey.style.display = isTouch ? 'none' : '';
    this.el.promptText.textContent = label;
    this.el.prompt.classList.add('show');
  }

  zoneCard(title, subtitle = '') {
    this.el.zone.innerHTML = `${title}${subtitle ? `<small>${subtitle}</small>` : ''}`;
    this.el.zone.classList.add('show');
    clearTimeout(this._zoneTimer);
    this._zoneTimer = setTimeout(() => this.el.zone.classList.remove('show'), 2600);
  }

  subtitle(text, ms = null) {
    if (!this.state.settings.subtitles) return;
    this.el.subtitleText.textContent = text;
    this.el.subtitles.classList.add('show');
    clearTimeout(this.subtitleTimer);
    this.subtitleTimer = setTimeout(() => this.el.subtitles.classList.remove('show'), ms || Math.max(3000, text.length * 58));
  }

  clearSubtitle() {
    this.el.subtitles.classList.remove('show');
    this.el.subtitleText.textContent = '';
  }

  toast(message, type = 'info', ms = 4200) {
    this.el.toast.textContent = message;
    this.el.toast.className = `toast show ${type === 'warn' ? 'warn' : type === 'error' ? 'error' : ''}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.className = 'toast'; }, ms);
  }

  /* --------------------------------------------------------------- minimap */
  minimap(player, world, quests) {
    const canvas = this.el.minimap;
    if (!canvas || !this.state.settings.showMinimap) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const inHub = world.zone === 'hub';
    const R = inHub
      ? { width: this.content.museum.hall.width, depth: this.content.museum.hall.depth }
      : this.content.exhibits.rooms[world.zone] || { width: 30, depth: 30 };
    const pad = 16;
    const scale = Math.min((W - pad * 2) / R.width, (H - pad * 2) / R.depth);
    const toScreen = (x, z) => [W / 2 + x * scale, H / 2 + z * scale];

    // room outline
    ctx.strokeStyle = 'rgba(242,236,221,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - (R.width / 2) * scale, H / 2 - (R.depth / 2) * scale, R.width * scale, R.depth * scale);

    if (inHub) {
      // the six doors
      for (const d of this.content.museum.doors) {
        const zone = this.content.zonesById.get(d.zone);
        const [sx, sy] = toScreen(d.x, d.z);
        const entered = this.state.progress.zonesEntered.includes(d.zone);
        ctx.fillStyle = entered ? '#2E6E5E' : d.accent;
        ctx.fillRect(sx - 9, sy - 5, 18, 10);
        ctx.fillStyle = 'rgba(242,236,221,0.85)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(d.index), sx, sy + 3.5);
        if (entered) {
          ctx.strokeStyle = '#2E6E5E'; ctx.lineWidth = 2;
          ctx.strokeRect(sx - 11, sy - 7, 22, 14);
        }
      }
      // central monument
      const [cx, cy] = toScreen(0, 1.2);
      ctx.fillStyle = 'rgba(201,162,39,0.75)';
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    } else {
      // live exhibits in the current room
      for (const it of world.interactables) {
        const [sx, sy] = toScreen(it.centre.x, it.centre.z);
        ctx.fillStyle = it === player.focus ? '#C9A227' : 'rgba(201,162,39,0.42)';
        ctx.beginPath(); ctx.arc(sx, sy, it === player.focus ? 4.5 : 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    // player: a triangle pointing where the player is facing
    const [px, py] = toScreen(player.position.x, player.position.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.yaw + Math.PI);
    ctx.fillStyle = '#F2ECDD';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // current objective marker
    const ctxObj = quests?.currentObjective();
    if (ctxObj?.objective?.type === 'reach') {
      const key = ctxObj.objective.target;
      const door = this.content.museum.doors.find(d => d.zone === ctxObj.mission.zone);
      if (door && inHub) {
        const [dx, dy] = toScreen(door.x, door.z);
        ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(dx, dy, 13 + Math.sin(performance.now() / 300) * 2, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  /* ------------------------------------------------------------ full map */
  drawMap(world, player, quests) {
    const canvas = this.el.mapCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // hub plan
    const hall = this.content.museum.hall;
    const pad = 60;
    const scale = Math.min((W - pad * 2) / (hall.width + 30), (H - pad * 2) / (hall.depth + 24));
    const cx = W / 2, cy = H / 2;
    const toS = (x, z) => [cx + x * scale, cy + z * scale];

    ctx.fillStyle = 'rgba(20,32,54,0.85)';
    ctx.fillRect(cx - (hall.width / 2) * scale, cy - (hall.depth / 2) * scale, hall.width * scale, hall.depth * scale);
    ctx.strokeStyle = 'rgba(201,162,39,0.6)'; ctx.lineWidth = 2;
    ctx.strokeRect(cx - (hall.width / 2) * scale, cy - (hall.depth / 2) * scale, hall.width * scale, hall.depth * scale);

    // entrance
    const [ex, ey] = toS(0, -hall.depth / 2);
    ctx.fillStyle = '#7cb0e0';
    ctx.fillRect(ex - 30, ey - 6, 60, 12);
    ctx.fillStyle = '#0b1220'; ctx.font = '600 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ENTRANCE', ex, ey + 3);

    // door galleries
    for (const d of this.content.museum.doors) {
      const [dx, dy] = toS(d.x, d.z);
      const zone = this.content.zonesById.get(d.zone);
      const entered = this.state.progress.zonesEntered.includes(d.zone);
      const completed = this.state.progress.zonesCompleted.includes(d.zone);
      ctx.fillStyle = d.accent;
      ctx.fillRect(dx - 22, dy - 14, 44, 28);
      ctx.strokeStyle = completed ? '#2E6E5E' : entered ? 'rgba(242,236,221,0.6)' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = completed ? 4 : 2;
      ctx.strokeRect(dx - 22, dy - 14, 44, 28);
      ctx.fillStyle = '#0b1220';
      ctx.font = '700 12px sans-serif';
      ctx.fillText(`DOOR ${d.index}`, dx, dy + 3);
      ctx.fillStyle = 'rgba(242,236,221,0.92)';
      ctx.font = '11px sans-serif';
      wrapText(ctx, (zone?.shortName || d.zone).toUpperCase(), dx, dy + 30, 120, 12);
    }

    // central monument + archive terminals
    const [mx, my] = toS(0, 1.2);
    ctx.fillStyle = 'rgba(201,162,39,0.85)';
    ctx.beginPath(); ctx.arc(mx, my, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b1220'; ctx.font = '10px sans-serif';
    ctx.fillText('CENTRE', mx, my + 34);

    // player
    const [px, py] = toS(player.position.x, player.position.z);
    ctx.save(); ctx.translate(px, py); ctx.rotate(-player.yaw + Math.PI);
    ctx.fillStyle = '#F2ECDD';
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 9); ctx.lineTo(-7, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#F2ECDD'; ctx.font = '600 12px sans-serif';
    ctx.fillText(this.content.t('map.you'), px, py - 16);

    // objective marker
    const obj = quests?.currentObjective();
    if (obj?.mission?.zone && obj.mission.zone !== 'hub') {
      const door = this.content.museum.doors.find(d => d.zone === obj.mission.zone);
      if (door) {
        const [ox, oy] = toS(door.x, door.z);
        ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ox, oy, 30 + Math.sin(performance.now() / 320) * 3, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  listMap(world, player, quests) {
    const list = $('map-list');
    const jump = $('map-jump');
    if (!list || !jump) return;
    const p = this.state.progress;
    list.innerHTML = '';
    for (const z of this.content.zones.zones) {
      const entered = p.zonesEntered.includes(z.id);
      const completed = p.zonesCompleted.includes(z.id);
      const li = document.createElement('li');
      li.innerHTML = `<span class="dot" style="background:${z.accentColor}"></span>
        <span>${z.doorIndex}. ${z.name}</span>
        <span class="st">${completed ? '✓ complete' : entered ? 'visited' : 'locked?'}</span>`;
      list.appendChild(li);
    }
    const hubLi = document.createElement('li');
    hubLi.innerHTML = `<span class="dot" style="background:#C9A227"></span><span>Museum hub · archive terminals · timeline wall</span><span class="st">${world.zone === 'hub' ? 'you are here' : ''}</span>`;
    list.insertBefore(hubLi, list.firstChild);

    jump.innerHTML = '';
    const addJump = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'btn btn-ghost';
      b.textContent = label;
      b.addEventListener('click', fn);
      jump.appendChild(b);
    };
    addJump('Return to the hub', () => this.onJump?.('hub'));
    for (const z of this.content.zones.zones) {
      if (!p.zonesEntered.includes(z.id) && z.id !== 'early_life') continue;
      addJump(z.shortName || z.name, () => this.onJump?.(z.id));
    }
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { ctx.fillText(line, x, yy); line = w; yy += lineHeight; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

/** Background scenery for the main menu: a slow camera drift through the hub. */
export class MenuCamera {
  constructor(camera, world, player) {
    this.camera = camera;
    this.world = world;
    this.player = player;
    this.t = 0;
    this.active = false;
  }
  start() { this.active = true; this.t = 0; }
  stop() { this.active = false; }
  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const angle = this.t * 0.06;
    const radius = 13 + Math.sin(this.t * 0.12) * 3;
    const y = 2.6 + Math.sin(this.t * 0.18) * 0.5;
    this.camera.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius - 2);
    this.camera.lookAt(Math.sin(angle * 0.4) * 4, 2.1, 2.5 + Math.cos(angle * 0.3) * 3);
    this.player.character.root.visible = false;
  }
}
