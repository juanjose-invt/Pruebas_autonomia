// Escenas 3D del modo paso a paso. Una sola escena de three.js con una masa deformable
// (malla esférica cuyos vértices se recalculan según el paso y el avance 0..1), manos
// esquemáticas y flechas que marcan el gesto. Sin texturas externas: todo se genera aquí.
import * as THREE from '../vendor/three.module.min.js';

const C = {
  dough: [0.945, 0.878, 0.737], flour: [0.985, 0.968, 0.925], baked: [0.93, 0.66, 0.3], char: [0.3, 0.17, 0.08],
  sauce: [0.74, 0.17, 0.1], sauceBaked: [0.62, 0.12, 0.07],
  tomato: 0xc5301e, basil: 0x2f6b3a, cream: 0xfbf6ea,
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const n3 = (x, y, z) => Math.sin(x * 2.1 + 1.7) * Math.sin(y * 2.3 + 0.3) * Math.sin(z * 1.9 + 2.4)
  + 0.5 * Math.sin(x * 4.7 + y * 3.1 + 0.5) * Math.sin(z * 5.3 + x * 1.3 + 1.1)
  + 0.25 * Math.sin(y * 9.1 + z * 7.7) * Math.sin(x * 8.3 + 2.2);

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

// ---------- texturas generadas ----------
function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  return tex;
}
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function marbleTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#efece5'; g.fillRect(0, 0, w, h);
    const r = rng(7);
    g.filter = 'blur(14px)';
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(${150 + r() * 40},${150 + r() * 40},${150 + r() * 35},${0.05 + r() * 0.07})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 60 + r() * 220, 30 + r() * 90, r() * 3, 0, 7); g.fill();
    }
    g.filter = 'blur(1.2px)';
    for (let i = 0; i < 16; i++) {
      let x = r() * w, y = r() * h; const a0 = 0.5 + r() * 0.5;
      g.strokeStyle = `rgba(120,122,120,${0.1 + r() * 0.22})`; g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath(); g.moveTo(x, y);
      let a = a0;
      for (let k = 0; k < 16; k++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 70; y += Math.sin(a) * 70; g.lineTo(x, y); }
      g.stroke();
    }
    g.filter = 'none';
  });
}

// Azulejo: el mismo motivo que la cenefa de la interfaz (flor de cuatro pétalos y rombo).
function tileTex() {
  return canvasTex(512, 512, (g, w) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i * s, y = j * s, cx = x + s / 2, cy = y + s / 2;
      g.fillStyle = '#f7f0df'; g.fillRect(x, y, s, s);
      g.fillStyle = '#2f6b3a';
      for (let k = 0; k < 4; k++) {
        g.save(); g.translate(cx, cy); g.rotate((k * Math.PI) / 2 + Math.PI / 4);
        g.beginPath(); g.ellipse(0, -s * 0.24, s * 0.1, s * 0.2, 0, 0, 7); g.fill(); g.restore();
      }
      g.fillStyle = '#c5301e';
      g.beginPath(); g.arc(cx, cy, s * 0.085, 0, 7); g.fill();
      for (const [qx, qy] of [[x, y], [x + s, y], [x, y + s], [x + s, y + s]]) {
        g.save(); g.translate(qx, qy); g.rotate(Math.PI / 4);
        g.fillRect(-s * 0.11, -s * 0.11, s * 0.22, s * 0.22); g.restore();
      }
      g.strokeStyle = '#d9cfb8'; g.lineWidth = 3; g.strokeRect(x, y, s, s);
    }
  }, [5, 2]);
}

function woodTex() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#c99a62'; g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${90 + r() * 50},${55 + r() * 30},${25 + r() * 20},${0.08 + r() * 0.2})`;
      g.lineWidth = 0.6 + r() * 2.4;
      const y = r() * h;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 16, w * 0.6, y + (r() - 0.5) * 16, w, y + (r() - 0.5) * 10);
      g.stroke();
    }
  });
}

// ---------- geometría de la masa ----------
function makeDoughGeo(rows = 44, cols = 72) {
  const count = (rows - 1) * cols + 2;
  const dirs = new Float32Array(count * 3);
  let k = 0;
  dirs.set([0, 1, 0], 0); k = 1;
  for (let i = 1; i < rows; i++) {
    const th = (i / rows) * Math.PI;
    for (let j = 0; j < cols; j++) {
      const ph = (j / cols) * Math.PI * 2;
      dirs.set([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)], k * 3); k++;
    }
  }
  dirs.set([0, -1, 0], k * 3);
  const idx = [];
  const at = (i, j) => 1 + (i - 1) * cols + (j % cols);
  for (let j = 0; j < cols; j++) idx.push(0, at(1, j + 1), at(1, j));
  for (let i = 1; i < rows - 1; i++) for (let j = 0; j < cols; j++) {
    idx.push(at(i, j), at(i, j + 1), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j));
  }
  for (let j = 0; j < cols; j++) idx.push(count - 1, at(rows - 1, j), at(rows - 1, j + 1));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  geo.setIndex(idx);
  return { geo, dirs, count };
}

// Bola o montón apoyado en la mesa.
function blob(o, dx, dy, dz, R, sx, sy, sz, lump, seed = 0) {
  const n = lump ? n3(dx * 1.8 + seed, dy * 1.8, dz * 1.8 + seed * 0.7) : 0;
  const r = R * (1 + lump * n);
  o[0] = dx * r * sx; o[2] = dz * r * sz;
  const h = R * sy * 0.32;
  o[1] = dy >= 0 ? dy * r * sy + h : dy * r * sy * 0.32 + h;
}
// Disco o plancha: contorno superelíptico, grosor `th` y borde elevado `rim`.
function slab(o, dx, dy, dz, Rx, Rz, n, th, rim, dimple = 0) {
  const q = Math.min(1, Math.hypot(dx, dz));
  const a = Math.atan2(dz, dx);
  const ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
  const rad = 1 / Math.pow(Math.pow(ca / Rx, n) + Math.pow(sa / Rz, n), 1 / n);
  o[0] = Math.cos(a) * q * rad; o[2] = Math.sin(a) * q * rad;
  if (dy > 0) {
    let y = th + rim * ss(0.78, 0.92, q);
    if (q > 0.93) { const e = (q - 0.93) / 0.07; y *= Math.sqrt(Math.max(0, 1 - e * e)); }
    if (dimple) y -= dimple * (0.5 + 0.5 * Math.sin(o[0] * 4.4) * Math.sin(o[2] * 4.4)) * (1 - ss(0.6, 0.85, q));
    o[1] = y;
  } else o[1] = 0;
}
// Solapa: dobla la parte de la masa que queda más allá de la bisagra.
function flap(o, ax, sign, h, hy, ang, stretch) {
  const a = o[ax] * sign;
  if (a <= h) return;
  const w = ss(h, h + 0.4, a);
  const th = ang * w;
  const L = (a - h) * (1 + stretch * w), ly = o[1] - hy;
  const c = Math.cos(th), s = Math.sin(th);
  o[ax] = sign * (h + L * c - ly * s);
  o[1] = Math.max(0, hy + L * s + ly * c);
}

// ---------- piezas ----------
function makeHand(mat) {
  // Ejes locales: los dedos apuntan a -z, la palma mira a -y, el pulgar queda en +x.
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), mat);
  palm.scale.set(1, 0.36, 1.05);
  g.add(palm);
  g.userData.fingers = [];
  [-0.21, -0.07, 0.07, 0.21].forEach((x, i) => {
    const piv = new THREE.Group();
    piv.position.set(x, 0, -0.25);
    const len = [0.3, 0.38, 0.4, 0.34][i];
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, len, 4, 10), mat);
    f.rotation.x = Math.PI / 2; f.position.z = -len / 2 - 0.03;
    piv.add(f); g.add(piv); g.userData.fingers.push(piv);
  });
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.26, 4, 10), mat);
  thumb.rotation.set(Math.PI / 2, 0, -0.85); thumb.position.set(0.36, -0.01, -0.1);
  g.add(thumb);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.55, 6, 14), mat);
  arm.rotation.x = Math.PI / 2 - 0.12; arm.position.set(0, 0.06, 0.62);
  g.add(arm);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.userData.curl = (c) => g.userData.fingers.forEach((p) => { p.rotation.x = -c; });
  return g;
}
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
// Coloca una mano: posición, dirección de los dedos y hacia dónde mira la palma.
function pose(h, x, y, z, fx, fy, fz, px, py, pz) {
  h.position.set(x, y, z);
  _z.set(-fx, -fy, -fz).normalize();
  _y.set(-px, -py, -pz).normalize();
  _x.crossVectors(_y, _z).normalize();
  _y.crossVectors(_z, _x);
  h.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}

function makeArrow(points, mat, radius = 0.04) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 8, false), mat));
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3.2, radius * 8, 14), mat);
  const end = curve.getPoint(1), tan = curve.getTangent(1).normalize();
  head.position.copy(end).addScaledVector(tan, radius * 3);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
  g.add(head);
  return g;
}
const arc = (cx, cy, cz, r, a0, a1, plane = 'xz', n = 14) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    if (plane === 'xz') pts.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]);
    else if (plane === 'xy') pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]);
    else pts.push([cx, cy + Math.sin(a) * r, cz + Math.cos(a) * r]);
  }
  return pts;
};

export function createScene(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4ecd9);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

  const hemi = new THREE.HemisphereLight(0xfff7ea, 0xb5a58c, 1.15);
  const sun = new THREE.DirectionalLight(0xfffaf0, 2.1);
  sun.position.set(3.5, 7, 4.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
  sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun);

  const tex = { marble: marbleTex(), tile: tileTex(), wood: woodTex() };
  const M = {
    dough: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }),
    flour: new THREE.MeshStandardMaterial({ color: 0xfbf7ee, roughness: 1 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.35, side: THREE.DoubleSide }),
    red: new THREE.MeshStandardMaterial({ color: C.tomato, roughness: 0.5 }),
    green: new THREE.MeshStandardMaterial({ color: C.basil, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xdcebe4, roughness: 0.08, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    water: new THREE.MeshStandardMaterial({ color: 0xa9d3de, roughness: 0.1, transparent: true, opacity: 0.75 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 1, transparent: true, opacity: 1, side: THREE.DoubleSide }),
    hand: new THREE.MeshStandardMaterial({ color: 0xddb898, roughness: 0.85 }),
    arrow: new THREE.MeshBasicMaterial({ color: C.tomato, transparent: true, opacity: 0.95 }),
    arrow2: new THREE.MeshBasicMaterial({ color: C.basil, transparent: true, opacity: 0.95 }),
    ring: new THREE.MeshBasicMaterial({ color: C.tomato, side: THREE.DoubleSide }),
    track: new THREE.MeshBasicMaterial({ color: 0x1c2b20, transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.8 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8e969b, roughness: 0.5, side: THREE.DoubleSide }),
    iron: new THREE.MeshStandardMaterial({ color: 0x34363a, roughness: 0.6, side: THREE.DoubleSide }),
    stone: new THREE.MeshStandardMaterial({ color: 0xc9b79c, roughness: 0.95 }),
    oven: new THREE.MeshStandardMaterial({ color: 0x5b3a2a, roughness: 1, side: THREE.BackSide, emissive: 0xff6a1f, emissiveIntensity: 0.18 }),
    fire: new THREE.MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: 0.9 }),
    cheese: new THREE.MeshStandardMaterial({ color: 0xfdfaf0, roughness: 0.5 }),
    batter: new THREE.MeshStandardMaterial({ color: 0xefe0bf, roughness: 0.5 }),
  };

  // Entorno fijo: encimera de mármol y pared de azulejo.
  const counter = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshStandardMaterial({ map: tex.marble, roughness: 0.42 }));
  counter.rotation.x = -Math.PI / 2; counter.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), new THREE.MeshStandardMaterial({ map: tex.tile, roughness: 0.5 }));
  wall.position.set(0, 4.5, -4.6);
  scene.add(counter, wall);

  // Masa.
  const dg = makeDoughGeo();
  const dough = new THREE.Mesh(dg.geo, M.dough);
  dough.castShadow = true; dough.receiveShadow = true; dough.frustumCulled = false;
  const doughPivot = new THREE.Group();
  doughPivot.add(dough);
  scene.add(doughPivot);
  const o = [0, 0, 0, 0, 0, 0];
  function shape(fn) {
    const pos = dg.geo.attributes.position.array, col = dg.geo.attributes.color.array, d = dg.dirs;
    for (let i = 0, k = 0; i < dg.count; i++, k += 3) {
      o[3] = C.dough[0]; o[4] = C.dough[1]; o[5] = C.dough[2];
      fn(o, d[k], d[k + 1], d[k + 2], i);
      pos[k] = o[0]; pos[k + 1] = o[1]; pos[k + 2] = o[2];
      col[k] = o[3]; col[k + 1] = o[4]; col[k + 2] = o[5];
    }
    dg.geo.attributes.position.needsUpdate = true;
    dg.geo.attributes.color.needsUpdate = true;
    dg.geo.computeVertexNormals();
  }
  const tint = (o2, c, t) => { o2[3] = lerp(o2[3], c[0], t); o2[4] = lerp(o2[4], c[1], t); o2[5] = lerp(o2[5], c[2], t); };

  // Grupo de atrezo, se reconstruye en cada paso.
  let props = new THREE.Group();
  scene.add(props);
  const own = []; // geometrías propias del paso, para liberarlas
  const mesh = (geo, mat, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); own.push(geo);
    m.castShadow = shadow; m.receiveShadow = true; props.add(m); return m;
  };
  const addHand = (mirror) => { const h = makeHand(M.hand); h.scale.set(mirror ? -1.4 : 1.4, 1.4, 1.4); props.add(h); h.traverse((m) => m.isMesh && own.push(m.geometry)); return h; };
  const addArrow = (pts, mat = M.arrow, r) => { const a = makeArrow(pts, mat, r); props.add(a); a.traverse((m) => m.isMesh && own.push(m.geometry)); return a; };

  function bowl(scale = 1) {
    const pts = [[0.001, 0.03], [0.85, 0.03], [1.25, 0.3], [1.55, 0.72], [1.72, 1.15], [1.76, 1.15], [1.6, 0.72], [1.3, 0.24], [0.9, 0], [0.001, 0]]
      .map(([x, y]) => new THREE.Vector2(x * scale, y * scale));
    const b = mesh(new THREE.LatheGeometry(pts, 56), M.ceramic);
    b.receiveShadow = false;
    const rim = mesh(new THREE.TorusGeometry(1.74 * scale, 0.035 * scale, 8, 64), M.red, false);
    rim.rotation.x = Math.PI / 2; rim.position.y = 1.15 * scale;
    return b;
  }
  function timeRing(radius) {
    const track = mesh(new THREE.RingGeometry(radius, radius + 0.09, 96, 1), M.track, false);
    const ring = mesh(new THREE.RingGeometry(radius, radius + 0.09, 96, 1, Math.PI / 2, -Math.PI * 2), M.ring, false);
    for (const m of [track, ring]) { m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.receiveShadow = false; }
    return (p) => ring.geometry.setDrawRange(0, Math.round(96 * clamp(p)) * 6);
  }
  function flourDust(n = 260, spread = 4.2) {
    const r = rng(11), arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * 7, d = Math.sqrt(r()) * spread;
      arr.set([Math.cos(a) * d, 0.012, Math.sin(a) * d * 0.7], i * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(arr, 3)); own.push(geo);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.9 }));
    props.add(pts); return pts;
  }
  function panMesh(variant) {
    if (variant === 'pan-round') {
      const pts = [[0.001, 0], [1.75, 0], [1.95, 0.42], [2.0, 0.42], [1.8, -0.04], [0.001, -0.04]].map(([x, y]) => new THREE.Vector2(x, y + 0.05));
      const p = mesh(new THREE.LatheGeometry(pts, 56), M.iron);
      const handle = mesh(new THREE.BoxGeometry(1.5, 0.09, 0.32), M.iron);
      handle.position.set(2.65, 0.42, 0);
      return { p, handle, hx: 1.72, hz: 1.72, n: 2 };
    }
    const g = new THREE.Group(); props.add(g);
    const W = 2.6, D = 1.95, H = 0.3, t = 0.04;
    const part = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.steel); own.push(m.geometry); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); };
    part(W * 2, t, D * 2, 0, t / 2, 0);
    part(W * 2, H, t, 0, H / 2, -D); part(W * 2, H, t, 0, H / 2, D);
    part(t, H, D * 2, -W, H / 2, 0); part(t, H, D * 2, W, H / 2, 0);
    return { p: g, hx: W - 0.08, hz: D - 0.08, n: 5 };
  }

  // ---------- escenas por tipo de paso ----------
  let update = () => {};
  let cam = { pos: [0, 3.5, 5.7], look: [0, 0.5, 0] };
  let duration = 7;

  const SCENES = {
    mix(v) {
      duration = 8;
      bowl();
      const pinch = v === 'pinch', poolish = v === 'poolish', biga = v === 'biga';
      const mound = mesh(new THREE.SphereGeometry(1, 28, 16), M.flour);
      mound.position.y = 0.2;
      const stream = mesh(new THREE.CylinderGeometry(0.05, 0.04, 2.2, 10), M.water, false);
      stream.position.set(0.35, 1.75, 0);
      const jug = mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.8, 24, 1, true), M.glass, false);
      jug.position.set(1.0, 3.05, 0); jug.rotation.z = 1.15;
      const salt = pinch ? flourDust(60, 0.9) : null;
      if (salt) salt.material.size = 0.05;
      const hand = poolish ? null : addHand();
      let spoon = null;
      if (poolish) {
        spoon = new THREE.Group(); props.add(spoon);
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 10), M.wood); st.position.y = 1.1;
        const hd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), M.wood); hd.scale.set(1, 1.5, 0.45);
        spoon.add(st, hd); own.push(st.geometry, hd.geometry);
        spoon.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      }
      const arrow = addArrow(arc(0, 1.75, 0, 1.15, 0.4, 5.2, 'xz', 20));
      update = (p) => {
        const a = pinch ? 1 : ss(0.28, 0.62, p);
        mound.visible = !pinch && a < 0.99; mound.scale.set(1.05 * (1 - a * 0.9), 0.5 * (1 - a), 1.05 * (1 - a * 0.9));
        const pour = !pinch && p > 0.04 && p < 0.36;
        stream.visible = pour; jug.visible = !pinch && p < 0.42;
        jug.rotation.z = 1.15 * ss(0, 0.06, p) * (1 - ss(0.36, 0.42, p));
        const done = pinch ? ss(0.2, 1, p) : ss(0.42, 1, p);
        const lump = pinch ? lerp(0.13, 0.07, done) : biga ? lerp(0.3, 0.26, done) : poolish ? lerp(0.2, 0.0, done) : lerp(0.26, 0.13, done);
        const sy = poolish ? lerp(0.5, 0.26, done) : pinch ? 0.55 : biga ? 0.6 : lerp(0.5, 0.62, done);
        const sxz = poolish ? lerp(0.9, 1.25, done) : pinch ? 1.15 : 1.05;
        const stir = p * 9;
        shape((q, dx, dy, dz) => {
          blob(q, dx, dy, dz, 1.0 * (0.25 + 0.75 * a), sxz, sy, sxz, lump, biga ? 3 : 0);
          q[1] += 0.06;
          tint(q, C.flour, (1 - done) * (biga ? 0.9 : 0.8) + (biga ? 0.25 : 0));
        });
        doughPivot.rotation.y = stir * 0.5;
        if (salt) { salt.position.y = lerp(2.2, 0.75, ss(0, 0.25, p)); salt.visible = p < 0.3; }
        const stirring = pinch ? p > 0.2 : p > 0.36;
        arrow.visible = stirring;
        const tool = hand || spoon;
        tool.visible = stirring;
        if (hand) {
          const r = pinch ? 0.35 : 0.6, y = 1.02 + 0.1 * Math.sin(stir * 2.3);
          const cs = Math.cos(stir), sn = Math.sin(stir);
          pose(hand, cs * r, y + 0.25 + (pinch ? 0.12 * Math.sin(stir * 4) : 0), sn * r, -sn * 0.3, -1, cs * 0.3, -sn, 0.25, cs);
          hand.userData.curl(pinch ? 0.9 + 0.5 * Math.sin(stir * 4) : 0.75);
        } else {
          spoon.position.set(Math.cos(stir) * 0.6, 0.35, Math.sin(stir) * 0.6);
          spoon.rotation.set(0.3 * Math.sin(stir), 0, -0.3 * Math.cos(stir));
        }
      };
    },

    autolyse(v) {
      duration = 7;
      const rest = v === 'rest';
      cam = { pos: [0, 3.6, 5.8], look: [0, 0.5, 0] };
      let cover;
      if (rest) {
        cover = mesh(new THREE.SphereGeometry(1.55, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.glass, false);
      } else {
        bowl();
        const geo = new THREE.CircleGeometry(2.05, 56, 0, Math.PI * 2);
        const ps = geo.attributes.position;
        for (let i = 0; i < ps.count; i++) {
          const x = ps.getX(i), y = ps.getY(i), r = Math.hypot(x, y);
          ps.setZ(i, r < 1.76 ? -0.1 * (1 - (r / 1.76) ** 2) : -(r - 1.76) * 1.5 + 0.04 * Math.sin(Math.atan2(y, x) * 9));
        }
        geo.computeVertexNormals();
        cover = mesh(geo, M.cloth, false);
        cover.rotation.x = -Math.PI / 2; cover.position.y = 1.19;
      }
      const ring = timeRing(rest ? 1.95 : 2.15);
      update = (p) => {
        const e = ease(p);
        if (rest) {
          shape((q, dx, dy, dz) => blob(q, dx, dy, dz, 0.86, lerp(1, 1.12, e), lerp(0.92, 0.78, e), lerp(1, 1.12, e), lerp(0.05, 0, e)));
          cover.position.y = lerp(1.6, 0, ss(0, 0.14, p));
        } else {
          shape((q, dx, dy, dz) => {
            blob(q, dx, dy, dz, 1.0, lerp(1.05, 1.2, e), lerp(0.62, 0.48, e), lerp(1.05, 1.2, e), lerp(0.24, 0.05, e));
            q[1] += 0.06; tint(q, C.flour, 0.18 * (1 - e));
          });
          M.cloth.opacity = lerp(1, 0.3, ss(0.16, 0.3, p));
          cover.position.y = lerp(2.2, 1.19, ss(0, 0.12, p));
        }
        doughPivot.rotation.y = 0.4;
        ring(p);
      };
    },

    knead() {
      duration = 9;
      cam = { pos: [2.6, 3.4, 5.2], look: [0, 0.45, -0.3] };
      flourDust(120, 4);
      const hand = addHand();
      const aPush = addArrow([[1.55, 0.05, 0.9], [1.55, 0.05, -0.2], [1.55, 0.05, -1.4]]);
      const aFold = addArrow(arc(1.55, 0.3, -0.5, 1.0, Math.PI, 0.1, 'yz'), M.arrow2);
      const aTurn = addArrow(arc(0, 0.05, 0, 1.75, 0.2, 1.75, 'xz'), M.arrow2);
      const R = 0.95;
      update = (p) => {
        const cyc = Math.min(1.9999, p * 2), n = Math.floor(cyc), u = cyc - n;
        const k = u < 0.4 ? ease(u / 0.4) : 1 - ease((u - 0.4) / 0.32);
        const f = ss(0.4, 0.72, u), back = ss(0.72, 1, u);
        const lump = lerp(0.13, 0.03, p);
        const sz = 1 + 0.8 * k, sy = lerp(0.72, 0.42, k), shift = -0.5 * k;
        const foldAng = f * 2.85 * (1 - back);
        shape((q, dx, dy, dz) => {
          blob(q, dx, dy, dz, R, 1.08, sy + 0.1 * f, sz, lump, n * 2);
          q[2] += shift;
          if (foldAng > 0.01) flap(q, 2, -1, 0.15, 0.3, foldAng, 0.1);
        });
        doughPivot.rotation.y = (n + back) * Math.PI / 2;
        aPush.visible = u < 0.4; aFold.visible = u >= 0.4 && u < 0.72; aTurn.visible = u >= 0.72;
        hand.userData.curl(u < 0.4 ? 0.2 : 0.9);
        if (u < 0.4) {
          pose(hand, 0, R * sy * 1.3 + 0.22, 0.75 - 1.5 * k, 0, 0.12, -1, 0, -1, -0.2);
        } else if (u < 0.72) {
          const a = f * 2.85;
          pose(hand, 0, 0.62 + Math.sin(a) * 1.05, -0.2 - Math.cos(a) * 1.25, 0, -0.5 - 0.5 * f, -1 + 1.3 * f, 0, -1 + 0.4 * f, 0.3 + 0.7 * f);
        } else {
          const a = back * Math.PI / 2;
          pose(hand, 1.25 - 0.5 * back, 0.75, 0.5 + 0.7 * Math.sin(a), -0.7, -0.25, -0.7, -1, -0.4, 0.2);
        }
      };
    },

    fold() {
      duration = 11;
      cam = { pos: [0, 4.3, 5.4], look: [0, 0.7, 0] };
      const bowlGroupStart = props.children.length;
      bowl(1.08);
      const hand = addHand();
      const aFold = addArrow(arc(0.15, 1.2, 0, 1.25, 0.15, Math.PI - 0.35, 'xy'));
      const aTurn = addArrow(arc(0, 1.5, 0, 2.05, 0.3, 1.7, 'xz'), M.arrow2);
      void bowlGroupStart;
      update = (p) => {
        const cyc = Math.min(3.9999, p * 4), n = Math.floor(cyc), u = cyc - n;
        const lift = ss(0, 0.45, u), over = ss(0.45, 0.8, u), settle = ss(0.8, 1, u);
        const ang = (lift * 1.35 + over * 1.6) * (1 - settle);
        const stretch = (0.75 * lift - 0.6 * over) * (1 - settle);
        const tight = (n + settle) / 4;
        const sy = lerp(0.46, 0.6, tight), sxz = lerp(1.2, 1.08, tight);
        shape((q, dx, dy, dz) => {
          blob(q, dx, dy, dz, 1.05, sxz, sy, sxz, 0.06, n);
          q[1] += 0.08;
          if (ang > 0.01) flap(q, 0, 1, 0.3, 0.3, ang, stretch);
        });
        doughPivot.rotation.y = (n + settle) * Math.PI / 2;
        aFold.visible = u < 0.8; aTurn.visible = u >= 0.8;
        const L = (1.05 * sxz - 0.3) * (1 + stretch);
        if (u < 0.8) {
          pose(hand, 0.3 + L * Math.cos(ang) * 1.0 + 0.1, 0.55 + L * Math.sin(ang) * 1.0 + 0.5, 0.05, -0.25, -1, 0, -1, 0.2, 0.15);
          hand.userData.curl(1.0);
        } else {
          const a = settle * Math.PI / 2;
          pose(hand, Math.cos(a) * 2.45, 1.42, Math.sin(a) * 2.45, -Math.cos(a), -0.25, -Math.sin(a), 0, -1, 0);
          hand.userData.curl(0.9);
        }
      };
    },

    ball() {
      duration = 8;
      cam = { pos: [0, 4.3, 5.2], look: [0, 0.45, 0.2] };
      flourDust(90, 4);
      const h1 = addHand(), h2 = addHand(true);
      const turn = addArrow(arc(0, 0.05, 0, 1.75, 0.5, 4.6, 'xz', 20));
      update = (p) => {
        const e = ease(p), R = 0.86, spin = p * 12;
        const cx = 0.14 * Math.cos(spin), cz = 0.14 * Math.sin(spin);
        shape((q, dx, dy, dz) => blob(q, dx, dy, dz, R, lerp(1.2, 1, e), lerp(0.56, 0.95, e), lerp(1.2, 1, e), lerp(0.2, 0, ss(0, 0.8, p)), 5));
        doughPivot.rotation.y = -spin * 0.6;
        doughPivot.position.set(cx, 0, cz);
        const w = R * lerp(1.2, 1.0, e) + 0.2;
        pose(h1, w + cx, R * 0.62, 0.3 + cz, -0.25, -0.2, -1, -1, -0.45, 0);
        pose(h2, -w + cx, R * 0.62, 0.3 + cz, 0.25, -0.2, -1, 1, -0.45, 0);
        h1.userData.curl(0.65); h2.userData.curl(0.65);
        void turn;
      };
    },

    ferment(v, step) {
      duration = 8;
      const cold = !!step.cold;
      if (cold) { sun.color.set(0xd6e6ff); hemi.color.set(0xe6f0ff); }
      const pan = v === 'pan-rect' || v === 'pan-round';
      const jar = v === 'jar', inBowl = v === 'bowl' || v === 'biga';
      let ring; let pm; let liquid; const bubbles = [];
      const blisters = [];
      const r = rng(21);
      for (let i = 0; i < 9; i++) { const a = r() * 7, t = 0.25 + r() * 0.9; blisters.push([Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a), 0.25 + r() * 0.55, 0.05 + r() * 0.05]); }
      const bump = (dx, dy, dz, p) => {
        let b = 0;
        for (const s of blisters) { const d = dx * s[0] + dy * s[1] + dz * s[2]; if (d > 0.965) b += s[4] * 0.7 * ss(0.965, 1, d) * ss(s[3], s[3] + 0.3, p); }
        return b;
      };
      if (jar) {
        cam = { pos: [0, 3.2, 6.4], look: [0, 1.25, 0] };
        mesh(new THREE.CylinderGeometry(0.95, 0.9, 2.7, 40, 1, true), M.glass, false).position.y = 1.35;
        liquid = mesh(new THREE.CylinderGeometry(0.88, 0.84, 1, 40), M.batter);
        const band = mesh(new THREE.TorusGeometry(0.97, 0.035, 8, 48), M.red, false);
        band.rotation.x = Math.PI / 2; band.position.y = 0.92;
        for (let i = 0; i < 16; i++) {
          const a = r() * 7, d = Math.sqrt(r()) * 0.72;
          const b = mesh(new THREE.SphereGeometry(0.05 + r() * 0.07, 12, 8), M.batter, false);
          b.userData = { x: Math.cos(a) * d, z: Math.sin(a) * d, t: 0.2 + r() * 0.6 };
          bubbles.push(b);
        }
        ring = timeRing(1.5);
      } else if (pan) {
        cam = v === 'pan-rect' ? { pos: [0, 5.8, 7.0], look: [0, 0.1, 0.2] } : { pos: [0, 4.6, 5.8], look: [0, 0.2, 0] };
        pm = panMesh(v);
        ring = timeRing(v === 'pan-round' ? 2.4 : 3.35);
      } else if (inBowl) {
        bowl(1.08);
        ring = timeRing(2.3);
      } else {
        const dome = mesh(new THREE.SphereGeometry(1.75, 44, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.glass, false);
        dome.position.y = 0;
        const mark = mesh(new THREE.RingGeometry(0.86, 0.9, 64, 1), M.ring, false);
        mark.rotation.x = -Math.PI / 2; mark.position.y = 0.014;
        ring = timeRing(2.1);
      }
      update = (p) => {
        const e = ease(p);
        if (jar) {
          dough.visible = false;
          const h = lerp(0.9, 1.95, e) - 0.06 * ss(0.9, 1, p);
          liquid.scale.y = h; liquid.position.y = h / 2 + 0.03;
          for (const b of bubbles) { const s = ss(b.userData.t, b.userData.t + 0.25, p); b.scale.setScalar(s); b.position.set(b.userData.x, h + 0.02, b.userData.z); b.visible = s > 0.01; }
        } else if (pan) {
          shape((q, dx, dy, dz) => {
            slab(q, dx, dy, dz, pm.hx, pm.hz, pm.n, lerp(0.17, 0.33, e), 0, 0.03 * (1 - e));
            if (dy > 0) q[1] += bump(dx, dy, dz, p) * 0.9;
            q[1] += 0.06;
          });
        } else if (inBowl) {
          const biga = v === 'biga', s = lerp(1, biga ? 1.14 : 1.3, e);
          shape((q, dx, dy, dz) => {
            blob(q, dx, dy, dz, 1.0 * s, 1.15, lerp(0.5, 0.62, e), 1.15, biga ? lerp(0.28, 0.2, e) : 0.03, 3);
            if (dy > 0 && !biga) { const b = bump(dx, dy, dz, p); q[0] += dx * b; q[1] += dy * b + b; q[2] += dz * b; }
            q[1] += 0.08;
            if (biga) tint(q, C.flour, 0.25);
          });
        } else {
          const s = Math.cbrt(1 + 0.95 * e);
          shape((q, dx, dy, dz) => {
            blob(q, dx, dy, dz, 0.86 * s, lerp(1, 1.14, e), lerp(0.95, 0.76, e), lerp(1, 1.14, e), 0);
            if (dy > 0) { const b = bump(dx, dy, dz, p); q[0] += dx * b; q[1] += dy * b; q[2] += dz * b; }
          });
        }
        ring(p);
      };
    },

    stretch(v) {
      duration = 9;
      const pan = v === 'pan-rect' || v === 'pan-round', rolled = v === 'rolled';
      cam = v === 'pan-rect' ? { pos: [0, 6.2, 6.2], look: [0, 0.1, 0.2] } : { pos: [0, 6.0, 5.6], look: [0, 0.1, 0.2] };
      let pm = null, pin = null;
      if (pan) pm = panMesh(v); else flourDust(260, 4.4);
      const h1 = rolled ? null : addHand(), h2 = rolled ? null : addHand(true);
      if (rolled) {
        pin = new THREE.Group(); props.add(pin);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.0, 24), M.wood);
        const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.1, 12), M.wood);
        pin.add(body, hl); own.push(body.geometry, hl.geometry);
        pin.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.rotation.z = Math.PI / 2; } });
      }
      const Rf = rolled ? 2.25 : 2.2;
      const arrows = pan
        ? [addArrow([[0.3, 0.6, 0.25], [1.2, 0.6, 0.9], [2.1, 0.6, 1.5]]), addArrow([[-0.3, 0.6, -0.25], [-1.2, 0.6, -0.9], [-2.1, 0.6, -1.5]])]
        : rolled
          ? [addArrow([[2.5, 0.1, 0.3], [2.5, 0.1, 1.0], [2.5, 0.1, 1.7]]), addArrow([[2.5, 0.1, -0.3], [2.5, 0.1, -1.0], [2.5, 0.1, -1.7]])]
          : [addArrow([[0.35, 0.7, 0], [1.1, 0.7, 0], [1.9, 0.7, 0]]), addArrow([[-0.35, 0.7, 0], [-1.1, 0.7, 0], [-1.9, 0.7, 0]]), addArrow(arc(0, 0.05, 0, 2.6, 0.5, 2.3, 'xz'), M.arrow2)];
      update = (p) => {
        const e = ease(p), b = ss(0, 0.3, p);
        let Rx, Rz, n, th, rim, dim;
        if (pan) { Rx = lerp(1.0, pm.hx, e); Rz = lerp(1.0, pm.hz, e); n = lerp(2, pm.n, e); th = lerp(0.42, 0.17, e); rim = 0; dim = 0.05 * ss(0.3, 0.8, p); }
        else { Rx = Rz = lerp(0.98, Rf, e); n = 2; th = lerp(0.5, rolled ? 0.045 : 0.065, e); rim = rolled ? 0 : 0.17 * ss(0.25, 1, p); dim = 0; }
        const tmp = [0, 0, 0];
        shape((q, dx, dy, dz) => {
          slab(q, dx, dy, dz, Rx, Rz, n, th, rim, dim);
          if (b < 1) {
            tmp[0] = q[0]; tmp[1] = q[1]; tmp[2] = q[2];
            blob(q, dx, dy, dz, pan ? 1.0 : 0.86, pan ? 1.15 : 1.1, pan ? 0.6 : 0.8, pan ? 1.15 : 1.1, pan ? 0.05 : 0);
            q[0] = lerp(q[0], tmp[0], b); q[1] = lerp(q[1], tmp[1], b); q[2] = lerp(q[2], tmp[2], b);
          }
          if (pan) q[1] += 0.06;
        });
        const spin = p * 7;
        if (!pan && !rolled) doughPivot.rotation.y = -spin * 0.35;
        const top = lerp(pan ? 0.8 : 0.9, th, b);
        if (pin) {
          const z = Math.sin(p * Math.PI * 6) * Rx * 0.78 * b;
          pin.position.set(0, top + 0.2, z);
          pin.children[0].rotation.x = z * 4;
        } else {
          [h1, h2].forEach((h, i) => {
            const u = (p * 6 + i * 0.5) % 1, out = ss(0, 0.7, u), lift = ss(0.7, 0.85, u) * (1 - ss(0.85, 1, u));
            const sgn = i ? -1 : 1, t = lerp(0.18, 0.62, out);
            const press = 0.05 * Math.abs(Math.sin(u * 22)) * (1 - lift);
            const zs = pan ? (Math.floor(p * 6 + i * 0.5) % 2 ? -1 : 1) * 0.7 : 0;
            pose(h, sgn * Rx * t + sgn * 0.1, top + 0.24 + press + lift * 0.45, zs * Rz * t + 0.8, sgn * 0.1, -0.3, -1, 0, -1, -0.15);
            h.userData.curl(0.25 + press * 4);
          });
        }
        void arrows;
      };
    },

    bake(v) {
      duration = 10;
      const pan = v === 'pan-rect' || v === 'pan-round', rolled = v === 'rolled';
      cam = v === 'pan-rect' ? { pos: [0, 3.9, 8.6], look: [0, 0.7, -0.4] } : { pos: [0, 3.3, 7.4], look: [0, 0.75, -0.4] };
      counter.visible = false; wall.visible = false;
      scene.background.set(0x2a1c16);
      hemi.intensity = 0.85; sun.intensity = 1.5; sun.color.set(0xffe2c0);
      const floor = mesh(new THREE.BoxGeometry(11, 0.3, 8), M.stone, false);
      floor.position.set(0, -0.15, -0.6);
      const dome = mesh(new THREE.SphereGeometry(4.2, 48, 24, Math.PI, Math.PI, 0, Math.PI / 2), M.oven, false);
      dome.position.set(0, 0, -0.6); dome.receiveShadow = false;
      const glow = new THREE.PointLight(0xff7a2a, 30, 14, 1.6);
      glow.position.set(-2.3, 1.2, -2.2); props.add(glow);
      const flames = [];
      for (let i = 0; i < 5; i++) {
        const f = mesh(new THREE.ConeGeometry(0.22 + (i % 2) * 0.1, 0.9 + (i % 3) * 0.25, 10), M.fire, false);
        f.position.set(-2.9 + i * 0.3, 0.45, -2.3 - (i % 2) * 0.35); f.receiveShadow = false; flames.push(f);
      }
      const embers = mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: 0xff5a1a }), false);
      embers.scale.set(1.0, 0.14, 0.6); embers.position.set(-2.4, 0.05, -2.4);
      own.push(embers.material);
      let pm = null, peel = null;
      const food = new THREE.Group(); props.add(food);
      if (pan) { pm = panMesh(v); props.remove(pm.p); food.add(pm.p); if (pm.handle) { props.remove(pm.handle); food.add(pm.handle); } }
      else {
        peel = new THREE.Group(); props.add(peel);
        const blade = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 0.05, 48), M.wood);
        blade.scale.z = 1.05;
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 4), M.wood);
        handle.position.z = 4.2;
        peel.add(blade, handle); own.push(blade.geometry, handle.geometry);
        peel.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      }
      const Rx = pan ? pm.hx : 2.2, Rz = pan ? pm.hz : 2.2, n = pan ? pm.n : 2;
      const r = rng(5), cheese = [], basil = [];
      for (let i = 0; i < (pan ? 9 : 6); i++) {
        const a = (i / (pan ? 9 : 6)) * 6.28 + r() * 0.6, d = 0.3 + r() * 0.42;
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.27 + r() * 0.08, 16, 10), M.cheese); own.push(c.geometry);
        c.userData = { x: Math.cos(a) * d * Rx, z: Math.sin(a) * d * Rz }; c.castShadow = true;
        food.add(c); cheese.push(c);
      }
      for (let i = 0; i < 3; i++) {
        const lf = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), M.green); own.push(lf.geometry);
        lf.userData = { x: (i - 1) * 0.55 + 0.1, z: (i % 2) * 0.5 - 0.2, ry: i * 1.9 };
        food.add(lf); basil.push(lf);
      }
      food.add(doughPivot);
      const heat = [-1.2, 0, 1.2].map((x) => addArrow([[x, 2.9, -0.3], [x + 0.12, 2.3, -0.3], [x, 1.7, -0.3]], M.arrow, 0.035));
      update = (p, t) => {
        const inn = pan ? ease(p / 0.14) : ease(p / 0.12);
        const bk = ss(0.16, 0.92, p);
        const th = pan ? lerp(0.33, 0.5, ss(0.16, 0.6, p)) : rolled ? 0.05 : 0.065;
        const rim = pan ? 0 : rolled ? lerp(0.03, 0.07, bk) : lerp(0.17, 0.36, ss(0.16, 0.55, p));
        const sauceEdge = pan ? 0.9 : 0.77;
        shape((q, dx, dy, dz) => {
          slab(q, dx, dy, dz, Rx, Rz, n, th, rim);
          const rho = Math.hypot(dx, dz);
          if (dy > 0 && rho < sauceEdge) {
            const nn = 0.5 + 0.5 * n3(dx * 6, dy * 6, dz * 6) / 1.75;
            q[3] = lerp(C.sauce[0], C.sauceBaked[0], bk) * (0.9 + 0.2 * nn); q[4] = lerp(C.sauce[1], C.sauceBaked[1], bk); q[5] = lerp(C.sauce[2], C.sauceBaked[2], bk);
            q[1] += 0.012 * nn * bk;
          } else {
            tint(q, C.baked, bk * (dy > 0 ? 0.85 : 0.6));
            const sp = n3(dx * 7.5 + 2, dy * 7.5, dz * 7.5 + 1);
            if (dy > 0 && sp > 0.5 && !pan) tint(q, C.char, ss(0.5, 1.0, sp) * ss(0.45, 1, bk) * 0.9);
            if (dy > 0 && !pan) q[1] += rim * 0.25 * ss(0.3, 1, sp) * bk;
          }
          if (pan) q[1] += 0.06;
        });
        const z0 = lerp(4.6, 0, inn);
        food.position.set(0, pan ? 0 : 0.03, z0);
        if (peel) {
          const out = ss(0.12, 0.22, p);
          peel.position.set(0, 0.0, z0 + out * 7.5);
          peel.visible = out < 0.99;
          food.position.y = lerp(0.06, 0, out);
        }
        const melt = ss(0.25, 0.7, p);
        for (const c of cheese) {
          c.position.set(c.userData.x, th + (pan ? 0.06 : 0) + 0.03, c.userData.z);
          c.scale.set(lerp(1, 1.7, melt), lerp(0.42, 0.13, melt), lerp(1, 1.7, melt));
        }
        const leaf = ss(0.93, 0.99, p);
        basil.forEach((lf) => {
          lf.visible = leaf > 0.01;
          lf.position.set(lf.userData.x, th + 0.1 + (pan ? 0.06 : 0) + (1 - leaf) * 1.2, lf.userData.z);
          lf.scale.set(1.1 * leaf, 0.12 * leaf, 0.62 * leaf); lf.rotation.y = lf.userData.ry;
        });
        const fl = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
        glow.intensity = 34 * fl;
        M.oven.emissiveIntensity = 0.16 + 0.05 * fl;
        flames.forEach((f, i) => { f.scale.y = 0.75 + 0.35 * Math.abs(Math.sin(t * (6 + i) + i)); });
        const hot = p > 0.16 && p < 0.92;
        heat.forEach((a, i) => { a.visible = hot; a.position.y = -0.25 * (((t * 0.6 + i * 0.33) % 1)); });
        M.arrow.opacity = hot ? 0.55 + 0.35 * Math.sin(t * 3) : 0.95;
      };
    },
  };

  let current = null, progress = 0, playing = false, last = 0, raf = 0, hold = 0, clock = 0;
  const onProgress = opts.onProgress || (() => {});

  function clearProps() {
    scene.add(doughPivot); // por si estaba dentro del grupo del horno
    scene.remove(props);
    for (const g of own) g.dispose();
    own.length = 0;
    props = new THREE.Group();
    scene.add(props);
    dough.visible = true;
    doughPivot.rotation.set(0, 0, 0); doughPivot.position.set(0, 0, 0);
    counter.visible = true; wall.visible = true;
    scene.background.set(0xf4ecd9);
    hemi.intensity = 1.15; sun.intensity = 2.1;
    sun.color.set(0xfffaf0); hemi.color.set(0xfff7ea);
    M.cloth.opacity = 1; M.arrow.opacity = 0.95;
    cam = { pos: [0, 3.5, 5.7], look: [0, 0.5, 0] };
  }

  function fitCamera() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // En formatos estrechos alejamos la cámara para que quepa el ancho de la escena.
    const k = Math.max(1, 1.25 / camera.aspect);
    const [lx, ly, lz] = cam.look;
    camera.position.set(lx + (cam.pos[0] - lx) * k, ly + (cam.pos[1] - ly) * k, lz + (cam.pos[2] - lz) * k);
    camera.lookAt(lx, ly, lz);
    camera.updateProjectionMatrix();
  }

  function render() { update(progress, clock); renderer.render(scene, camera); }

  function frame(now) {
    raf = 0;
    if (!playing) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    if (hold > 0) { hold -= dt; if (hold <= 0) progress = 0; }
    else {
      progress += dt / duration;
      if (progress >= 1) { progress = 1; hold = 1.4; }
    }
    render(); onProgress(progress);
    raf = requestAnimationFrame(frame);
  }

  const api = {
    setStep(step) {
      clearProps();
      current = step;
      const fn = SCENES[step.type] || SCENES.mix;
      fn(step.variant, step);
      progress = 0; hold = 0;
      fitCamera(); render(); onProgress(progress);
    },
    setProgress(p) { progress = clamp(p); hold = 0; render(); },
    get progress() { return progress; },
    get playing() { return playing; },
    play() { if (playing) return; playing = true; last = performance.now(); if (progress >= 1) progress = 0; raf = requestAnimationFrame(frame); },
    pause() { playing = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    resize() { fitCamera(); render(); },
    dispose() {
      api.pause(); clearProps();
      dg.geo.dispose(); Object.values(M).forEach((m) => m.dispose()); Object.values(tex).forEach((x) => x.dispose());
      counter.geometry.dispose(); counter.material.dispose(); wall.geometry.dispose(); wall.material.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
  void current;
  return api;
}
