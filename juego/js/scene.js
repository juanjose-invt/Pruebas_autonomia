// Escena 3D: tablero de madera, canicas de cristal, inclinación y física de rodadura.
import * as THREE from '../vendor/three.min.js';
import { DONE, BLOCK, PIT, FELT, DIRS } from './engine.js';
import { rng } from './generator.js';

const R = 0.34;            // radio de la canica (la casilla mide 1)
const HOLE = 0.425;        // radio de los hoyos
const FRAME = 0.4;         // ancho del marco
const MAX_TILT = 0.2;      // ~11,5°
const ACCEL = 34;          // casillas/s² con el tablero inclinado a tope
const DRAG = 0.9;
export const MARBLE_COLORS = ['#f2a20c', '#2358e0', '#d61f45'];
const LIGHT_DIR = new THREE.Vector3(-0.85, 1, 0.5).normalize();

// ---------- texturas hechas a mano con canvas ----------

function woodCanvas(base, dark, light, seed, w = 512, h = 512) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  // bandas anchas de tono
  for (let i = 0; i < 14; i++) {
    const y = r() * h, bh = 10 + r() * 60;
    g.fillStyle = r() < 0.5 ? dark : light;
    g.globalAlpha = 0.05 + r() * 0.07;
    g.fillRect(0, y, w, bh);
  }
  // vetas finas y onduladas
  for (let i = 0; i < 260; i++) {
    const y0 = r() * h, amp = 1 + r() * 5, f = 0.004 + r() * 0.012, ph = r() * 6.28;
    g.strokeStyle = r() < 0.72 ? dark : light;
    g.globalAlpha = 0.05 + r() * 0.16;
    g.lineWidth = 0.4 + r() * 1.6;
    g.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.7 + ph) * amp * 0.3;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  // poros
  g.fillStyle = dark;
  for (let i = 0; i < 900; i++) {
    g.globalAlpha = 0.05 + r() * 0.1;
    g.fillRect(r() * w, r() * h, 2 + r() * 7, 0.7);
  }
  g.globalAlpha = 1;
  return c;
}

function tableCanvas() {
  const w = 1024, h = 1024, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = rng(77);
  const planks = 4, pw = w / planks;
  for (let i = 0; i < planks; i++) {
    const l = 30 + r() * 4;
    g.fillStyle = `hsl(186 30% ${l}%)`;
    g.fillRect(i * pw, 0, pw, h);
    for (let k = 0; k < 90; k++) { // brochazos a lo largo de la tabla
      const x = i * pw + r() * pw;
      g.strokeStyle = r() < 0.5 ? '#0d2a2e' : '#9fd0cf';
      g.globalAlpha = 0.03 + r() * 0.05;
      g.lineWidth = 1 + r() * 3;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 12, h); g.stroke();
    }
    g.globalAlpha = 0.55; g.fillStyle = '#0f2b2f';
    g.fillRect(i * pw - 1.5, 0, 3, h);
    g.globalAlpha = 0.12; g.fillStyle = '#c9ecea';
    g.fillRect(i * pw + 2, 0, 1.5, h);
    g.globalAlpha = 1;
  }
  return c;
}

function feltCanvas() {
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d'), r = rng(5);
  g.fillStyle = '#5c7a3e'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = r() < 0.5 ? '#35501f' : '#8fae63';
    g.globalAlpha = 0.12 + r() * 0.2;
    g.fillRect(r() * s, r() * s, 1 + r() * 2, 1);
  }
  return c;
}

function marbleCanvas(hex, seed) {
  const w = 256, h = 128, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), r = rng(seed);
  const col = new THREE.Color(hex);
  const deep = col.clone().multiplyScalar(0.62), lite = col.clone().lerp(new THREE.Color('#ffffff'), 0.55);
  g.fillStyle = '#' + deep.getHexString(); g.fillRect(0, 0, w, h);
  // cuerpo de color con una franja más clara
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#' + col.getHexString()); grd.addColorStop(0.5, '#' + deep.getHexString()); grd.addColorStop(1, '#' + col.getHexString());
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  // vetas de "ojo de gato"
  g.filter = 'blur(2.5px)';
  for (let i = 0; i < 3; i++) {
    const y0 = h * (0.25 + 0.25 * i) + (r() - 0.5) * 10, amp = 12 + r() * 14, ph = r() * 6.28;
    g.strokeStyle = i === 1 ? '#fffdf5' : '#' + lite.getHexString();
    g.globalAlpha = i === 1 ? 0.75 : 0.6;
    g.lineWidth = 7 + r() * 10;
    g.beginPath();
    for (let x = -8; x <= w + 8; x += 6) {
      const y = y0 + Math.sin((x / w) * 6.283 * 2 + ph) * amp;
      if (x === -8) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.filter = 'none';
  g.globalAlpha = 1;
  return c;
}

function envCanvas() {
  const w = 512, h = 256, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#fff6e6'); grd.addColorStop(0.42, '#cdbb9c'); grd.addColorStop(0.56, '#5d7f80'); grd.addColorStop(1, '#1b3336');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.filter = 'blur(6px)';
  g.fillStyle = '#ffffff';
  g.fillRect(70, 22, 70, 60); g.fillRect(150, 22, 30, 60);   // ventana
  g.fillRect(360, 30, 50, 40);
  g.filter = 'none';
  return c;
}

function glowCanvas() {
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  return c;
}

function tex(canvas, repeat) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

// ---------- geometría ----------

function roundRectPath(p, x, y, w, h, r) {
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y); p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x + w, y + h - r); p.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  p.lineTo(x + r, y + h); p.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x, y + r); p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
}

/** Extruye una forma dibujada en planta (x, -z) hacia arriba; la cara superior queda en y = top. */
function slab(shape, height, top, bevel, curve = 8, bevelSeg = 2) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: bevelSeg, curveSegments: curve,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, top - height + bevel, 0);
  return geo;
}

export function createScene(canvas, hooks = {}) {
  const reduced = () => hooks.reducedMotion && hooks.reducedMotion();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#254a4e');
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 120);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = new THREE.CanvasTexture(envCanvas());
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  scene.environment = pmrem.fromEquirectangular(envTex).texture;
  scene.environmentIntensity = 0.55;
  envTex.dispose(); pmrem.dispose();

  scene.add(new THREE.HemisphereLight('#fff1dc', '#27474b', 0.9));
  const sun = new THREE.DirectionalLight('#fff0d8', 2.6);
  sun.position.copy(LIGHT_DIR).multiplyScalar(22);
  sun.castShadow = true;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  sun.shadow.camera.near = 6; sun.shadow.camera.far = 44;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 5;
  scene.add(sun);

  // materiales
  const beechCanvas = woodCanvas('#e2b877', '#9a6a33', '#f6dcae', 11);
  const cherryCanvas = woodCanvas('#a4633a', '#5f3318', '#cf9263', 23);
  const walnutCanvas = woodCanvas('#6d4526', '#3a2110', '#93643c', 31);
  const mBeech = new THREE.MeshStandardMaterial({ map: tex(beechCanvas), roughness: 0.62, envMapIntensity: 0.5 });
  const mFrame = new THREE.MeshStandardMaterial({ map: tex(cherryCanvas), roughness: 0.55, envMapIntensity: 0.6 });
  const mWalls = [0, 0.31, 0.67].map((o) => {
    const t = tex(cherryCanvas, [0.3, 1.4]); t.offset.set(o, o);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, envMapIntensity: 0.6 });
  });
  const mWalnut = new THREE.MeshStandardMaterial({ map: tex(walnutCanvas, [0.35, 0.35]), roughness: 0.5, envMapIntensity: 0.6 });
  // el interior de cada hoyo va pintado del color de su canica
  const cupMats = MARBLE_COLORS.map((hex) => {
    const c = new THREE.Color(hex);
    return {
      wall: new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.5), roughness: 0.8, side: THREE.BackSide, envMapIntensity: 0.1 }),
      floor: new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.34), roughness: 0.9, envMapIntensity: 0.1 }),
    };
  });
  const mPit = new THREE.MeshStandardMaterial({ color: '#150c06', roughness: 1, side: THREE.BackSide, envMapIntensity: 0 });
  const mPitFloor = new THREE.MeshBasicMaterial({ color: '#080403' });
  const mScorch = new THREE.MeshStandardMaterial({ color: '#2b1608', roughness: 0.9, transparent: true, opacity: 0.8 });
  const mFelt = new THREE.MeshStandardMaterial({ map: tex(feltCanvas(), [1.2, 1.2]), roughness: 1, envMapIntensity: 0 });
  const glowTex = new THREE.CanvasTexture(glowCanvas());
  // Cristal sin pagar el coste de la transmisión real: la luz "atraviesa" la canica y la
  // enciende por el lado opuesto al sol, y el canto se aclara como en el vidrio macizo.
  const glassU = { uBack: { value: new THREE.Vector3(0, -1, 0) } };
  const marbleMats = MARBLE_COLORS.map((hex, i) => {
    const t = tex(marbleCanvas(hex, 40 + i));
    const m = new THREE.MeshPhysicalMaterial({
      map: t, roughness: 0.07, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03,
      envMapIntensity: 2.4, emissive: new THREE.Color(hex), emissiveMap: t, emissiveIntensity: 0.16,
    });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uBack = glassU.uBack;
      sh.uniforms.uTint = { value: new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.25) };
      sh.fragmentShader = 'uniform vec3 uBack;\nuniform vec3 uTint;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float gBack = pow(max(dot(normal, uBack), 0.0), 2.2);
         float gRim = pow(1.0 - abs(normal.z), 3.0);
         totalEmissiveRadiance += uTint * (gBack * 0.85) + vec3(1.0, 0.97, 0.9) * (gRim * 0.16);
         diffuseColor.rgb *= 1.0 - 0.35 * gRim;`);
    };
    return m;
  });
  const ringMats = MARBLE_COLORS.map((hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.35, envMapIntensity: 0.8 }));

  // mesa y peana
  const tableT = tex(tableCanvas(), [5, 5]);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshLambertMaterial({ map: tableT }));
  table.rotation.x = -Math.PI / 2; table.position.y = -1.7; table.receiveShadow = true;
  scene.add(table);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 0.8, 40), mWalnut);
  stand.position.y = -1.3; stand.castShadow = true; stand.receiveShadow = true;
  scene.add(stand);

  const flipG = new THREE.Group(), tiltG = new THREE.Group();
  scene.add(flipG); flipG.add(tiltG);
  let boardG = null;           // piezas del nivel actual
  let L = null, n = 0;
  let marbles = [];            // { mesh, glow, x, z, y, vis }
  const sphereGeo = new THREE.SphereGeometry(R, 36, 24);
  const glowGeo = new THREE.CircleGeometry(0.27, 20).rotateX(-Math.PI / 2);

  const cx = (c) => (c % n) - (n - 1) / 2;
  const cz = (c) => ((c / n) | 0) - (n - 1) / 2;

  function disposeBoard() {
    if (!boardG) return;
    boardG.traverse((o) => { if (o.geometry && o.geometry !== sphereGeo && o.geometry !== glowGeo) o.geometry.dispose(); });
    tiltG.remove(boardG);
    boardG = null;
  }

  function buildBoard(level) {
    disposeBoard();
    L = level; n = L.n;
    boardG = new THREE.Group();
    const half = n / 2, E = n + 2 * FRAME;
    const add = (geo, mat, cast = true, recv = true) => {
      const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; boardG.add(m); return m;
    };
    // tabla con los hoyos taladrados
    const plate = roundRectPath(new THREE.Shape(), -E / 2, -E / 2, E, E, 0.34);
    const holes = [];
    for (let c = 0; c < n * n; c++) {
      if (L.cup[c] >= 0 || L.type[c] === PIT) {
        holes.push(c);
        const h = new THREE.Path(); h.absarc(cx(c), -cz(c), HOLE, 0, Math.PI * 2, true);
        plate.holes.push(h);
      }
    }
    mBeech.map.repeat.set(1 / E, 1 / E); mBeech.map.offset.set(0.5, 0.5);
    add(slab(plate, 0.86, 0, 0.022, 22, 2), mBeech);
    // marco
    const frame = roundRectPath(new THREE.Shape(), -E / 2, -E / 2, E, E, 0.34);
    frame.holes.push(roundRectPath(new THREE.Path(), -half, -half, n, n, 0.1));
    mFrame.map.repeat.set(1 / E, 1 / E); mFrame.map.offset.set(0.5, 0.5);
    add(slab(frame, 0.34, 0.34, 0.05, 10, 3), mFrame);
    // hoyos
    for (const c of holes) {
      const pit = L.cup[c] < 0, depth = pit ? 0.84 : 0.72;
      const cyl = add(new THREE.CylinderGeometry(HOLE + 0.02, HOLE + 0.02, depth, 30, 1, true), pit ? mPit : cupMats[L.cup[c]].wall, false, true);
      cyl.position.set(cx(c), -depth / 2, cz(c));
      const fl = add(new THREE.CircleGeometry(HOLE + 0.02, 30).rotateX(-Math.PI / 2), pit ? mPitFloor : cupMats[L.cup[c]].floor, false, !pit);
      fl.position.set(cx(c), -depth, cz(c));
      const ring = add(new THREE.RingGeometry(HOLE + 0.03, pit ? HOLE + 0.085 : HOLE + 0.13, 40).rotateX(-Math.PI / 2), pit ? mScorch : ringMats[L.cup[c]], false, true);
      ring.position.set(cx(c), 0.004, cz(c));
    }
    // fieltros y tacos
    for (let c = 0; c < n * n; c++) {
      if (L.type[c] === FELT) {
        const s = roundRectPath(new THREE.Shape(), -0.41, -0.41, 0.82, 0.82, 0.12);
        const f = add(slab(s, 0.03, 0.03, 0.008), mFelt, false, true);
        f.position.set(cx(c), 0, cz(c));
      } else if (L.type[c] === BLOCK) {
        const s = roundRectPath(new THREE.Shape(), -0.44, -0.44, 0.88, 0.88, 0.14);
        const b = add(slab(s, 0.36, 0.36, 0.05), mWalnut);
        b.position.set(cx(c), 0, cz(c));
      }
    }
    // listones: se unen los tramos seguidos en una sola pieza
    const T = 0.13, H = 0.27;
    let wi = 0;
    const plank = (x, z, len, vertical) => {
      const s = roundRectPath(new THREE.Shape(), -len / 2, -T / 2, len, T, T / 2 - 0.005);
      const m = add(slab(s, H, H, 0.03, 5, 2), mWalls[wi++ % 3]);
      m.position.set(x, 0, z);
      if (vertical) m.rotation.y = Math.PI / 2;
    };
    for (let y = 0; y < n - 1; y++) { // tumbados (bajo la fila y)
      for (let x = 0; x < n; x++) {
        if (!L.wd[y * n + x]) continue;
        let x1 = x; while (x1 + 1 < n && L.wd[y * n + x1 + 1]) x1++;
        const len = x1 - x + 1;
        plank((x + x1) / 2 - (n - 1) / 2, y + 0.5 - (n - 1) / 2, len + T * 0.6, false);
        x = x1;
      }
    }
    for (let x = 0; x < n - 1; x++) { // de pie (a la derecha de la columna x)
      for (let y = 0; y < n; y++) {
        if (!L.wr[y * n + x]) continue;
        let y1 = y; while (y1 + 1 < n && L.wr[(y1 + 1) * n + x]) y1++;
        const len = y1 - y + 1;
        plank(x + 0.5 - (n - 1) / 2, (y + y1) / 2 - (n - 1) / 2, len + T * 0.6, true);
        y = y1;
      }
    }
    // canicas
    marbles = [];
    for (let i = 0; i < L.k; i++) {
      const mesh = new THREE.Mesh(sphereGeo, marbleMats[i]);
      mesh.castShadow = true;
      mesh.rotation.set(0.6 + i, i * 1.3, 0.4);
      const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
        map: glowTex, color: MARBLE_COLORS[i], transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      boardG.add(mesh); boardG.add(glow);
      marbles.push({ mesh, glow, x: 0, z: 0, y: R, cup: L.cup.indexOf(i) });
    }
    tiltG.add(boardG);
    const sc = sun.shadow.camera, b = E / 2 + 2.6;
    sc.left = -b; sc.right = b; sc.top = b; sc.bottom = -b; sc.updateProjectionMatrix();
    fitCamera();
  }

  function syncMarble(m) {
    m.mesh.position.set(m.x, m.y, m.z);
    m.glow.position.set(m.x - LIGHT_DIR.x * 0.56, 0.014, m.z - LIGHT_DIR.z * 0.56);
    const up = Math.max(0, Math.min(1, (m.y - R * 0.2) / (R * 0.8)));
    m.glow.material.opacity = 0.9 * up * (m.y > R * 1.5 ? Math.max(0, 1 - (m.y - R * 1.5) / 3) : 1);
    m.glow.visible = m.glow.material.opacity > 0.01;
  }
  const SUNK = -R + 0.03;
  function placeMarbles(pos) {
    marbles.forEach((m, i) => {
      const c = pos[i] === DONE ? m.cup : pos[i];
      m.x = cx(c); m.z = cz(c); m.y = pos[i] === DONE ? SUNK : R;
      syncMarble(m);
    });
  }
  const _ax = new THREE.Vector3(), _q = new THREE.Quaternion();
  function roll(m, dx, dz) {
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return;
    _ax.set(dz / d, 0, -dx / d);
    _q.setFromAxisAngle(_ax, d / R);
    m.mesh.quaternion.premultiply(_q);
  }

  // ---------- cámara ----------
  let W = 1, H = 1, stage = null;
  function fitCamera() {
    if (!n) return;
    const st = stage || { x: 0, y: 0, w: W, h: H };
    const E = (n + 2 * FRAME) * 1.2 + 0.4;
    const t = Math.tan((camera.fov * Math.PI) / 360);
    const usable = Math.max(120, Math.min(st.w, st.h * 1.04));
    const D = (E * H) / (usable * 2 * t);
    const pitch = 0.3;
    camera.position.set(0, Math.cos(pitch) * D, Math.sin(pitch) * D);
    camera.lookAt(0, -0.2, 0);
    camera.aspect = W / H;
    const ox = st.x + st.w / 2 - W / 2, oy = st.y + st.h / 2 - H / 2;
    camera.setViewOffset(W, H, -ox, -oy, W, H);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    glassU.uBack.value.set(-LIGHT_DIR.x, -LIGHT_DIR.y * 0.55, -LIGHT_DIR.z).normalize().transformDirection(camera.matrixWorldInverse);
    kick();
  }
  let ratioCap = 2, slow = 0, slowN = 0;
  function resize() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    const big = W * H > 1100 * 900;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, big ? 1.5 : 2, ratioCap));
    renderer.setSize(W, H, false);
    fitCamera();
  }
  function setStage(rect) { stage = rect; fitCamera(); }

  // ---------- bucle ----------
  const tiltS = { x: 0, z: 0, vx: 0, vz: 0, tx: 0, tz: 0 }; // muelle de inclinación
  let preview = { x: 0, z: 0 };
  let anims = [];           // funciones (dt) => terminado
  let raf = 0, last = 0, frames = 0, frameMs = [];
  function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
  function frame(t) {
    raf = 0;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
    if (last) {
      frameMs.push(t - last); if (frameMs.length > 240) frameMs.shift();
      // si el aparato no llega a ~35 fps, se baja la resolución interna y luego las sombras
      slow += t - last; slowN++;
      if (slowN >= 45) {
        if (slow / slowN > 28) {
          if (renderer.getPixelRatio() > 1) { ratioCap = Math.max(1, renderer.getPixelRatio() - 0.25); resize(); }
          else if (sun.shadow.mapSize.x > 1024) { sun.shadow.mapSize.set(1024, 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
        }
        slow = 0; slowN = 0;
      }
    }
    last = t; frames++;
    anims = anims.filter((fn) => !fn(dt));
    // muelle del tablero: pesado, con un pelín de rebote
    const K = 150, C = 17;
    const tx = tiltS.tx + preview.x, tz = tiltS.tz + preview.z;
    const steps = 4, h = dt / steps;
    for (let i = 0; i < steps; i++) {
      tiltS.vx += (K * (tx - tiltS.x) - C * tiltS.vx) * h; tiltS.x += tiltS.vx * h;
      tiltS.vz += (K * (tz - tiltS.z) - C * tiltS.vz) * h; tiltS.z += tiltS.vz * h;
    }
    tiltG.rotation.x = tiltS.x; tiltG.rotation.z = tiltS.z;
    renderer.render(scene, camera);
    const moving = Math.abs(tx - tiltS.x) + Math.abs(tz - tiltS.z) + Math.abs(tiltS.vx) + Math.abs(tiltS.vz) > 0.0004;
    if (anims.length || moving) raf = requestAnimationFrame(frame);
    else { tiltS.x = tx; tiltS.z = tz; }
  }
  const run = (fn) => new Promise((res) => { anims.push((dt) => { const done = fn(dt); if (done) res(); return done; }); kick(); });

  function setTiltTarget(d, amount) {
    tiltS.tx = 0; tiltS.tz = 0;
    if (d === 0) tiltS.tz = -amount; else if (d === 2) tiltS.tz = amount;
    else if (d === 1) tiltS.tx = amount; else if (d === 3) tiltS.tx = -amount;
    kick();
  }
  /** Vista previa mientras se arrastra: fx, fy en -1..1 */
  function setPreview(fx, fy) {
    preview.x = fy * MAX_TILT * 0.45; preview.z = -fx * MAX_TILT * 0.45; kick();
  }
  /** Cabeceo corto: movimiento imposible o pista. */
  function nudge(d, amount = 0.4, hold = 0.2) {
    setTiltTarget(d, MAX_TILT * amount);
    let t = 0;
    return run((dt) => { t += dt; if (t > hold) { setTiltTarget(0, 0); return true; } return false; });
  }

  // ---------- física del movimiento ----------
  /**
   * Hace rodar las canicas según los caminos calculados por las reglas. El resultado lógico
   * ya está decidido; aquí se integra el movimiento (gravedad, rozamiento, rebotes, caída).
   */
  function animateMove(d, paths) {
    const [dx, dz] = DIRS[d];
    const fast = reduced();
    setTiltTarget(d, fast ? MAX_TILT * 0.35 : MAX_TILT);
    const bodies = paths.map((p) => {
      const m = marbles[p.id];
      return { p, m, s: 0, v: 0, lim: p.steps, x0: cx(p.from), z0: cz(p.from), state: p.end === 'stay' ? 'rest' : 'roll', vy: 0, t: 0, hit: false };
    });
    const byId = {}; bodies.forEach((b) => { byId[b.p.id] = b; });
    // posición absoluta a lo largo del eje, para los choques entre canicas
    const along = (b) => (dx ? b.x0 * dx : b.z0 * dz) + b.s;
    let time = 0, settleT = 0;
    const DT = 1 / 240;
    let acc = 0;
    const step = () => {
      time += DT;
      const lean = Math.min(1, Math.abs(d % 2 === 0 ? tiltS.z : tiltS.x) / (fast ? MAX_TILT * 0.35 : MAX_TILT));
      const a = ACCEL * (fast ? 1.6 : 0.25 + 0.75 * lean);
      let maxV = 0;
      for (const b of bodies) {
        const end = b.p.end;
        if (b.state === 'roll') {
          const hole = end === 'cup' || end === 'wrong' || end === 'pit';
          if (end === 'felt' && b.s > b.lim - 0.5) {
            b.v += (-230 * (b.s - b.lim) - 30 * b.v) * DT;   // el fieltro agarra
            if (!b.hit) { b.hit = true; hooks.onFelt && hooks.onFelt(Math.abs(b.v)); }
            if (Math.abs(b.s - b.lim) < 0.004 && Math.abs(b.v) < 0.05) { b.s = b.lim; b.v = 0; b.state = 'rest'; }
          } else {
            b.v += (a - DRAG * b.v) * DT;
          }
          b.s += b.v * DT;
          if (hole) {
            if (b.s >= b.lim - 0.2) { // el borde del hoyo la atrapa
              b.state = 'drop'; b.t = 0; b.vy = 0;
              hooks.onDrop && hooks.onDrop(end, b.v);
              b.v = Math.min(b.v, 2.4);
            }
          } else if (end !== 'felt') {
            let lim = b.lim, other = null;
            if (end === 'marble') {
              other = byId[b.p.blocker];
              if (other && other.state !== 'drop') lim = Math.min(lim, along(other) - 1 - along(b) + b.s);
            }
            if (b.s >= lim) {
              b.s = lim;
              if (other && lim < b.lim - 1e-4) {            // choque canica contra canica en marcha
                const e = 0.35, rel = b.v - other.v;
                if (rel > 0) {
                  if (rel > 0.8) hooks.onImpact && hooks.onImpact('marble', rel);
                  const v1 = ((1 - e) * b.v + (1 + e) * other.v) / 2, v2 = ((1 + e) * b.v + (1 - e) * other.v) / 2;
                  b.v = v1; if (other.state === 'roll') other.v = v2;
                }
              } else {
                const sp = b.v;
                if (sp > 0.8) hooks.onImpact && hooks.onImpact(end, sp);
                if (sp > 2.5 && !fast) kickBoard(d, sp * (end === 'wall' ? 0.012 : 0.004));
                b.v = fast ? 0 : -sp * 0.3;
                if (Math.abs(b.v) < 0.7) { b.v = 0; if (a > 0 && sp < 0.75) b.state = 'rest'; }
              }
            }
          }
          maxV = Math.max(maxV, Math.abs(b.v));
        } else if (b.state === 'drop') {
          b.t += DT;
          b.v += (-420 * (b.s - b.lim) - 16 * b.v) * DT;     // traquetea dentro del hoyo
          b.s += b.v * DT;
          const floor = b.p.end === 'pit' ? -0.5 : SUNK;
          b.vy -= 60 * DT; b.m.y += b.vy * DT;
          if (b.m.y < R - 0.1) {                             // ya dentro: choca con la pared del hoyo
            const off = b.s - b.lim, room = HOLE - R - 0.01;
            if (Math.abs(off) > room) {
              b.s = b.lim + Math.sign(off) * room;
              if (Math.abs(b.v) > 0.5) hooks.onImpact && hooks.onImpact('rattle', Math.abs(b.v));
              b.v = -b.v * 0.45;
            }
          }
          if (b.m.y < floor) { b.m.y = floor; b.vy = Math.abs(b.vy) > 1.2 ? -b.vy * 0.28 : 0; }
          if (b.t > 0.42 && b.m.y === floor && b.vy === 0) { b.s = b.lim; b.v = 0; b.state = 'rest'; }
        }
        const nx = b.x0 + dx * b.s, nz = b.z0 + dz * b.s;
        roll(b.m, nx - b.m.x, nz - b.m.z);
        b.m.x = nx; b.m.z = nz;
      }
      hooks.onRoll && hooks.onRoll(maxV);
      return bodies.every((b) => b.state === 'rest');
    };
    return run((dt) => {
      acc += dt;
      let done = false;
      while (acc >= DT && !done) { acc -= DT; done = step(); }
      bodies.forEach((b) => syncMarble(b.m));
      if (done || time > 4) {
        settleT += dt;
        if (settleT === dt) { hooks.onRoll && hooks.onRoll(0); setTiltTarget(0, 0); }
        if (settleT > 0.06 || fast) {
          bodies.forEach((b) => { // deja todo exactamente en su casilla
            const c = b.p.to; b.m.x = cx(c); b.m.z = cz(c);
            if (b.p.end === 'cup' || b.p.end === 'wrong') b.m.y = SUNK; else if (b.p.end === 'pit') b.m.y = -0.5; else b.m.y = R;
            syncMarble(b.m);
          });
          return true;
        }
      }
      return false;
    });
  }
  function kickBoard(d, amt) {
    if (d === 0) tiltS.vz -= amt * 60; else if (d === 2) tiltS.vz += amt * 60;
    else if (d === 1) tiltS.vx += amt * 60; else tiltS.vx -= amt * 60;
  }

  /** Deshacer / reiniciar: las canicas vuelven de un saltito, como colocadas a mano. */
  function moveMarblesTo(pos) {
    if (reduced()) { placeMarbles(pos); kick(); return Promise.resolve(); }
    const from = marbles.map((m) => ({ x: m.x, y: m.y, z: m.z }));
    const to = marbles.map((m, i) => {
      const c = pos[i] === DONE ? m.cup : pos[i];
      return { x: cx(c), z: cz(c), y: pos[i] === DONE ? SUNK : R };
    });
    let t = 0;
    const dur = 0.26;
    return run((dt) => {
      t = Math.min(1, t + dt / dur);
      const e = 1 - Math.pow(1 - t, 3);
      marbles.forEach((m, i) => {
        const a = from[i], b = to[i];
        const far = Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.y - b.y) > 0.01;
        m.x = a.x + (b.x - a.x) * e; m.z = a.z + (b.z - a.z) * e;
        m.y = a.y + (b.y - a.y) * e + (far ? Math.sin(Math.PI * t) * 0.55 : 0);
        syncMarble(m);
      });
      return t >= 1;
    });
  }

  /** Las canicas caen sobre el tablero al empezar un nivel. */
  function dropIn(pos) {
    placeMarbles(pos);
    if (reduced()) { kick(); return Promise.resolve(); }
    const st = marbles.map((m, i) => ({ delay: 0.05 + i * 0.11, vy: 0, done: pos[i] === DONE }));
    marbles.forEach((m, i) => { if (!st[i].done) { m.y = 7 + i; syncMarble(m); } });
    return run((dt) => {
      let all = true;
      marbles.forEach((m, i) => {
        const s = st[i];
        if (s.done) return;
        all = false;
        if (s.delay > 0) { s.delay -= dt; return; }
        s.vy -= 52 * dt; m.y += s.vy * dt;
        if (m.y <= R) {
          m.y = R;
          const sp = -s.vy;
          if (sp > 1.4) { hooks.onImpact && hooks.onImpact('land', sp); s.vy = sp * 0.3; }
          else { s.vy = 0; s.done = true; }
        }
        syncMarble(m);
      });
      return all;
    });
  }

  /** Cambia de nivel dando la vuelta al tablero: el nuevo está en la otra cara. */
  function setLevel(level, pos, mode) {
    tiltS.tx = tiltS.tz = 0;
    if (mode !== 'flip' || reduced() || !boardG) {
      buildBoard(level);
      flipG.rotation.x = 0; flipG.position.y = 0;
      if (mode === 'instant') { placeMarbles(pos); kick(); return Promise.resolve(); }
      return dropIn(pos);
    }
    let t = 0, swapped = false;
    const dur = 0.85;
    hooks.onFlip && hooks.onFlip();
    return run((dt) => {
      t = Math.min(1, t + dt / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      if (!swapped && e >= 0.5) { swapped = true; buildBoard(level); placeMarbles(pos); marbles.forEach((m) => { m.mesh.visible = false; m.glow.visible = false; }); }
      flipG.rotation.x = swapped ? (e - 1) * Math.PI : e * Math.PI;
      flipG.position.y = Math.sin(Math.PI * e) * 4.2;
      return t >= 1;
    }).then(() => { marbles.forEach((m) => { m.mesh.visible = true; }); return dropIn(pos); });
  }

  resize();
  return {
    setLevel, animateMove, moveMarblesTo, nudge, setPreview, setStage, resize, kick,
    woodURL: (kind) => (kind === 'dark' ? walnutCanvas : kind === 'mid' ? cherryCanvas : beechCanvas).toDataURL('image/jpeg', 0.8),
    _dbg: { renderer, sun, table, scene, camera, THREE, mats: { mBeech, mFrame } },
    perf: () => ({ frames, avg: frameMs.length ? frameMs.reduce((a, b) => a + b, 0) / frameMs.length : 0, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
  };
}
