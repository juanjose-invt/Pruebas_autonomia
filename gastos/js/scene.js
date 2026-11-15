// Estantería de tarros de cristal en WebGL (three.js).
// Dibuja solo cuando algo cambia: sin animación en curso no hay bucle de render.

import * as THREE from '../vendor/three.huchas.min.js';

export const SX = 1.6;        // ancho de celda (unidades de mundo)
export const SY = 2.4;        // alto de celda
export const BELOW = 0.7;    // parte de la celda que queda bajo la balda (canto + etiqueta)
const CAP = 110;              // monedas con el tarro lleno hasta el borde (100 % del presupuesto)
const OVER = 10;              // monedas que se desbordan a la balda
const COIN_R = 0.13;
const COIN_H = 0.034;
const FOV = 22;
const PITCH = (7 * Math.PI) / 180;
const G = 30;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function coinSlots(seed) {
  const r = rng(seed * 7919 + 13);
  const slots = [];
  const layers = CAP / 5;
  const dy = 1.13 / layers;
  const e = new THREE.Euler();
  for (let L = 0; L < layers; L++) {
    const y = 0.035 + L * dy;
    const narrow = y > 1.06 ? 0.2 : y > 0.96 ? 0.27 : 0.33;
    const a0 = r() * Math.PI * 2;
    for (let k = 0; k < 5; k++) {
      let x = 0, z = 0;
      if (k === 0) {
        const rr = r() * 0.1, a = r() * 6.283;
        x = Math.cos(a) * rr; z = Math.sin(a) * rr;
      } else {
        const a = a0 + (k / 4) * 6.283 + (r() - 0.5) * 0.5;
        const rr = narrow * (0.82 + r() * 0.18);
        x = Math.cos(a) * rr; z = Math.sin(a) * rr;
      }
      const tilt = L === 0 ? 0.05 : 0.42;
      e.set((r() - 0.5) * tilt * 2, r() * 6.283, (r() - 0.5) * tilt * 2);
      slots.push({
        p: new THREE.Vector3(x, y + (r() - 0.5) * 0.02, z),
        q: new THREE.Quaternion().setFromEuler(e),
        spill: false,
      });
    }
  }
  // Monedas desbordadas: sobre la balda, delante del tarro.
  for (let k = 0; k < OVER; k++) {
    const pile = k % 4;
    const x = -0.42 + pile * 0.28 + (r() - 0.5) * 0.06;
    const level = Math.floor(k / 4);
    e.set((r() - 0.5) * 0.08, r() * 6.283, (r() - 0.5) * 0.08);
    slots.push({
      p: new THREE.Vector3(x, COIN_H / 2 + level * COIN_H * 1.05, 0.6 + (r() - 0.5) * 0.05),
      q: new THREE.Quaternion().setFromEuler(e),
      spill: true,
    });
  }
  return slots;
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(20,6,2,0.55)');
  grad.addColorStop(0.55, 'rgba(20,6,2,0.28)');
  grad.addColorStop(1, 'rgba(20,6,2,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function underShelfTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(24,6,2,0.5)');
  grad.addColorStop(1, 'rgba(24,6,2,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#b97a43';
  g.fillRect(0, 0, 1024, 64);
  const r = rng(77);
  for (let i = 0; i < 260; i++) {
    const y = r() * 64, x = r() * 1024, w = 80 + r() * 500;
    g.strokeStyle = r() > 0.5 ? `rgba(92,48,20,${0.05 + r() * 0.12})` : `rgba(240,190,130,${0.04 + r() * 0.1})`;
    g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + w * 0.3, y + (r() - 0.5) * 5, x + w * 0.6, y + (r() - 0.5) * 5, x + w, y + (r() - 0.5) * 3);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function environment(renderer) {
  // Habitación mínima para los reflejos: una ventana fría arriba a la izquierda,
  // una lámpara cálida a la derecha y un rebote anaranjado desde abajo.
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x6c543e, side: THREE.BackSide }));
  s.add(room);
  const panel = (w, h, col, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...col), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(9, 14, [9, 8.6, 8], [-13, 9, 13]);
  panel(5, 16, [7, 5.2, 3.2], [15, 4, 9]);
  panel(26, 6, [2.4, 1.2, 0.6], [0, -14, 8]);
  panel(18, 5, [3.2, 2.6, 2], [0, 17, 2]);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.035).texture;
  pm.dispose();
  s.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return tex;
}

export function createScene(canvas, { reducedMotion = false, onLost } = {}) {
  const still = () => (typeof reducedMotion === 'function' ? reducedMotion() : reducedMotion);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  if (!renderer.getContext()) return null;

  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.environment = environment(renderer);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 80);
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
  key.position.set(-5, 7, 9);
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffe6c8, 0x5a2416, 0.5));

  // ---- recursos compartidos ----
  const profile = [
    [0.0, 0.0], [0.44, 0.0], [0.5, 0.025], [0.52, 0.09], [0.52, 0.98], [0.505, 1.08], [0.45, 1.17],
    [0.39, 1.23], [0.38, 1.27], [0.38, 1.36], [0.4, 1.385], [0.415, 1.41], [0.405, 1.445], [0.375, 1.45],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const jarGeo = new THREE.LatheGeometry(profile, 40);
  const gasketGeo = new THREE.TorusGeometry(0.392, 0.03, 10, 40);
  const coinGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_H, 18, 1);
  const blobGeo = new THREE.PlaneGeometry(1.7, 1.25);
  const blobTex = blobTexture();
  const underTex = underShelfTexture();
  const woodTex = woodTexture();

  const glassPatch = (shader) => {
    // Cristal barato: opaco donde hay reflejo y en los bordes (fresnel), casi invisible de frente.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
       float lumi = max(max(outgoingLight.r, outgoingLight.g), outgoingLight.b);
       diffuseColor.a = clamp(0.04 + 0.5 * pow(fres, 0.75) + 0.75 * smoothstep(0.7, 1.5, lumi), 0.0, 0.95);
       #include <opaque_fragment>`
    );
  };
  const glassBack = new THREE.MeshStandardMaterial({ color: 0xb9d3c8, roughness: 0.06, metalness: 0, transparent: true, depthWrite: false, side: THREE.BackSide, envMapIntensity: 0.55 });
  glassBack.onBeforeCompile = glassPatch;
  const glassFront = new THREE.MeshStandardMaterial({ color: 0xcfe6dc, roughness: 0.04, metalness: 0, transparent: true, depthWrite: false, side: THREE.FrontSide, envMapIntensity: 1.0 });
  glassFront.onBeforeCompile = glassPatch;
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 1, envMapIntensity: 1.35 });
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const underMat = new THREE.MeshBasicMaterial({ map: underTex, transparent: true, depthWrite: false });
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.6, metalness: 0, envMapIntensity: 0.5 });
  const COIN_COLORS = [0xe9b23a, 0xf3c955, 0xe0a22e, 0xc9703a, 0xdccfb8].map((c) => new THREE.Color(c));

  const world = new THREE.Group();
  scene.add(world);

  let jars = [];           // { id, group, coins, slots, total, gasketMat, wobble }
  let shelfObjs = [];
  let layout = { cols: 0, rows: 0, ids: '' };
  let anims = [];
  let size = { w: 1, h: 1 };
  let raf = 0;
  let dirty = true;
  let lost = false;
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  const stats = { frames: 0, total: 0, worst: 0 };

  const m4 = new THREE.Matrix4();
  const v3 = new THREE.Vector3();
  const q4 = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);

  function clearLayout() {
    for (const j of jars) {
      world.remove(j.group);
      j.coins.dispose();
      j.gasketMat.dispose();
    }
    for (const o of shelfObjs) { world.remove(o); if (o.userData.own) o.geometry.dispose(); }
    jars = []; shelfObjs = []; anims = [];
  }

  function build(list, cols) {
    clearLayout();
    const rows = Math.max(1, Math.ceil(list.length / cols));
    layout = { cols, rows, ids: list.map((j) => j.id).join('|') };
    const shelfW = cols * SX + 14;
    for (let r = 0; r < rows; r++) {
      const y = -r * SY;
      const plankGeo = new THREE.BoxGeometry(shelfW, 0.1, 1.5);
      const plank = new THREE.Mesh(plankGeo, woodMat);
      plank.position.set(0, y - 0.05, 0);
      plank.userData.own = true;
      const underGeo = new THREE.PlaneGeometry(shelfW, 0.7);
      const under = new THREE.Mesh(underGeo, underMat);
      under.position.set(0, y - 0.1 - 0.35, -0.74);
      under.userData.own = true;
      world.add(plank, under);
      shelfObjs.push(plank, under);
    }
    list.forEach((item, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const group = new THREE.Group();
      group.position.set((c - (cols - 1) / 2) * SX, -r * SY, 0);
      const slots = coinSlots(i + 1);
      const coins = new THREE.InstancedMesh(coinGeo, coinMat, CAP + OVER);
      coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const rc = rng(i * 31 + 5);
      for (let k = 0; k < CAP + OVER; k++) {
        m4.compose(slots[k].p, slots[k].q, one);
        coins.setMatrixAt(k, m4);
        coins.setColorAt(k, COIN_COLORS[Math.floor(rc() * rc() * COIN_COLORS.length * 0.999)]);
      }
      coins.count = 0;
      coins.frustumCulled = false;
      const back = new THREE.Mesh(jarGeo, glassBack);
      back.renderOrder = 1;
      const front = new THREE.Mesh(jarGeo, glassFront);
      front.renderOrder = 2;
      const gasketMat = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.55, metalness: 0, envMapIntensity: 0.6 });
      const gasket = new THREE.Mesh(gasketGeo, gasketMat);
      gasket.rotation.x = Math.PI / 2;
      gasket.position.y = 1.315;
      const blob = new THREE.Mesh(blobGeo, blobMat);
      blob.rotation.x = -Math.PI / 2;
      blob.position.set(0.12, 0.004, 0.08);
      group.add(blob, coins, gasket, back, front);
      world.add(group);
      jars.push({ id: item.id, group, coins, slots, total: 0, gasketMat, wobble: -1 });
    });
    frame();
  }

  function frame() {
    const { cols, rows } = layout;
    if (!cols) return;
    const H = rows * SY;
    const cy = (SY - BELOW) - H / 2;
    const d = H / 2 / Math.tan((FOV * Math.PI) / 360);
    camera.aspect = size.w / size.h;
    camera.position.set(par.x, cy + d * Math.sin(PITCH) + par.y, d * Math.cos(PITCH));
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
    dirty = true;
  }

  function target(count) { return count; }

  function countsFor(item) {
    if (!(item.fill > 0)) return 0;
    const inside = Math.min(CAP, Math.max(1, Math.round(item.fill * CAP)));
    const spill = item.fill > 1 ? Math.min(OVER, Math.max(1, Math.ceil((item.fill - 1) * 20))) : 0;
    return target(inside + spill);
  }

  function update(list, { cols, instant = false, rain = false } = {}) {
    if (lost) return;
    const ids = list.map((j) => j.id).join('|');
    const rebuilt = ids !== layout.ids || cols !== layout.cols;
    if (rebuilt) build(list, cols);
    const now = performance.now();
    list.forEach((item, i) => {
      const jar = jars[i];
      jar.gasketMat.color.set(item.color);
      const next = countsFor(item);
      const prev = jar.total;
      if (next === prev) return;
      // Cualquier animación pendiente de este tarro se da por terminada.
      anims = anims.filter((a) => {
        if (a.jar !== jar) return true;
        settle(a);
        return false;
      });
      jar.total = next;
      jar.coins.count = next;
      if (next > prev && !instant && !still()) {
        const n = next - prev;
        const gap = rain ? Math.min(14, 520 / n) : Math.min(46, 1500 / n);
        const base = rain ? i * 40 : 0;
        const rr = rng((now | 0) + i);
        for (let k = prev; k < next; k++) {
          const slot = jar.slots[k];
          const a = rr() * 6.283, rad = rr() * 0.14;
          const y0 = slot.spill ? 1.5 : 2.25 + rr() * 0.25;
          const sx = slot.spill ? 0 : Math.cos(a) * rad;
          const sz = slot.spill ? 0.25 : Math.sin(a) * rad;
          const tf = Math.sqrt((2 * (y0 - slot.p.y)) / G) * 1000;
          const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(rr() * 6.283, rr() * 6.283, rr() * 6.283));
          anims.push({ jar, k, slot, start: now + base + (k - prev) * gap, tf, y0, sx, sz, q0, landed: false });
          // Hasta que le toque caer, la moneda espera fuera de la vista.
          m4.makeScale(0, 0, 0);
          jar.coins.setMatrixAt(k, m4);
        }
      }
      jar.coins.instanceMatrix.needsUpdate = true;
    });
    dirty = true;
    kick();
  }

  function settle(a) {
    m4.compose(a.slot.p, a.slot.q, one);
    a.jar.coins.setMatrixAt(a.k, m4);
    a.jar.coins.instanceMatrix.needsUpdate = true;
  }

  const BOUNCE = 190;
  function step(now) {
    if (!anims.length) return false;
    const keep = [];
    for (const a of anims) {
      const t = now - a.start;
      if (t < 0) { keep.push(a); continue; }
      const total = a.tf + BOUNCE;
      if (t >= total) { settle(a); continue; }
      const p = a.slot.p;
      let y, kxz, rot;
      if (t < a.tf) {
        const s = t / 1000;
        y = a.y0 - 0.5 * G * s * s;
        rot = (t / total) * 0.9;
      } else {
        const u = (t - a.tf) / BOUNCE;
        y = p.y + Math.sin(u * Math.PI) * 0.07 * (1 - u);
        rot = 0.9 + 0.1 * u;
        if (!a.landed) { a.landed = true; if (a.jar.wobble < 0 || now - a.jar.wobble > 500) a.jar.wobble = now; }
      }
      if (a.slot.spill) kxz = Math.min(1, t / a.tf);
      else {
        const k = (1.12 - y) / Math.max(0.05, 1.12 - p.y);
        kxz = k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
      }
      v3.set(a.sx + (p.x - a.sx) * kxz, Math.max(y, p.y), a.sz + (p.z - a.sz) * kxz);
      q4.copy(a.q0).slerp(a.slot.q, rot);
      m4.compose(v3, q4, one);
      a.jar.coins.setMatrixAt(a.k, m4);
      a.jar.coins.instanceMatrix.needsUpdate = true;
      keep.push(a);
    }
    anims = keep;
    return true;
  }

  function wobble(now) {
    let active = false;
    for (const j of jars) {
      if (j.wobble < 0) continue;
      const t = (now - j.wobble) / 1000;
      if (t > 0.7) { j.wobble = -1; j.group.rotation.z = 0; continue; }
      j.group.rotation.z = 0.012 * Math.sin(t * 46) * Math.exp(-t * 6);
      active = true;
    }
    return active;
  }

  function parallax() {
    const dx = par.tx - par.x, dy = par.ty - par.y;
    if (Math.abs(dx) < 0.002 && Math.abs(dy) < 0.002) return false;
    par.x += dx * 0.12; par.y += dy * 0.12;
    frame();
    return true;
  }

  function loop(now) {
    raf = 0;
    if (lost) return;
    const t0 = performance.now();
    const a = step(now);
    const w = wobble(now);
    const p = parallax();
    if (a || w || p || dirty) {
      dirty = false;
      renderer.render(scene, camera);
      const dt = performance.now() - t0;
      stats.frames++; stats.total += dt; if (dt > stats.worst) stats.worst = dt;
    }
    if (a || w || p) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && !lost) raf = requestAnimationFrame(loop); }

  function resize(w, h) {
    size = { w: Math.max(1, w), h: Math.max(1, h) };
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size.w, size.h, false);
    frame();
    kick();
  }

  function pointer(nx, ny) {
    if (still()) return;
    par.tx = nx * 0.45; par.ty = -ny * 0.25;
    kick();
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (onLost) onLost();
  });

  function dispose() {
    lost = true;
    if (raf) cancelAnimationFrame(raf);
    clearLayout();
    for (const g of [jarGeo, gasketGeo, coinGeo, blobGeo]) g.dispose();
    for (const m of [glassBack, glassFront, coinMat, blobMat, underMat, woodMat]) m.dispose();
    for (const tx of [blobTex, underTex, woodTex, scene.environment]) tx.dispose();
    renderer.dispose();
  }

  return {
    update, resize, pointer, dispose,
    get busy() { return anims.length > 0; },
    debug: () => ({ ...stats, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, anims: anims.length, coins: jars.map((j) => j.total) }),
    resetStats: () => { stats.frames = 0; stats.total = 0; stats.worst = 0; },
  };
}
