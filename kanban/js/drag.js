// Arrastrar y soltar con pointer events: notas (entre columnas y dentro de una) y columnas.
// Ratón y lápiz: arrastre al mover unos píxeles. Dedo: pulsación mantenida, para no robar el desplazamiento.
const LONG_PRESS_MS = 260;
const SLOP_TOUCH = 10;
const SLOP_MOUSE = 6;
const SLICES = 8;
const EDGE = 64;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;

export function initDrag(boardEl, columnsEl, cb) {
  let press = null;
  let drag = null;
  let suppressClickUntil = 0;
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  boardEl.addEventListener('pointerdown', (e) => {
    if (press || drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('button, input, textarea, select, a')) return;
    const note = e.target.closest('.note[data-card]');
    const head = note ? null : e.target.closest('.col-head');
    const el = note || head;
    if (!el) return;
    press = { el, kind: note ? 'card' : 'col', id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, timer: 0 };
    if (e.pointerType === 'touch') {
      press.timer = setTimeout(() => { if (press) begin(); }, LONG_PRESS_MS);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  });

  // Con el dedo, una vez cogida la nota, el navegador no debe desplazar la página.
  document.addEventListener('touchmove', (e) => { if (drag && e.cancelable) e.preventDefault(); }, { passive: false });
  boardEl.addEventListener('contextmenu', (e) => {
    if (press || drag || e.target.closest('.note, .col-head')) e.preventDefault();
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag) abort(); });
  window.addEventListener('blur', () => { if (drag) abort(); else clearPress(); });

  function onMove(e) {
    if (!press || e.pointerId !== press.id) return;
    press.x = e.clientX;
    press.y = e.clientY;
    if (drag) return;
    const dist = Math.hypot(press.x - press.x0, press.y - press.y0);
    if (press.type === 'touch') {
      if (dist > SLOP_TOUCH) clearPress(); // el dedo se ha movido: es un desplazamiento
    } else if (dist > SLOP_MOUSE) {
      begin();
    }
  }

  function onUp(e) {
    if (!press || e.pointerId !== press.id) return;
    if (drag) drop(); else clearPress();
  }

  function onCancel(e) {
    if (!press || e.pointerId !== press.id) return;
    if (drag) abort(); else clearPress();
  }

  function clearPress() {
    if (press) clearTimeout(press.timer);
    press = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  }

  function begin() {
    clearTimeout(press.timer);
    if (!press.el.isConnected) { clearPress(); return; }
    if (press.type === 'touch' && navigator.vibrate) { try { navigator.vibrate(8); } catch { /* sin vibración */ } }
    document.body.classList.add('is-dragging');
    boardEl.classList.add('dragging');
    if (press.kind === 'card') beginCard(); else beginColumn();
    drag.last = performance.now();
    drag.raf = requestAnimationFrame(frame);
  }

  // ---- Notas ----
  function beginCard() {
    const el = press.el;
    const rect = el.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rot = parseFloat(el.style.getPropertyValue('--rot')) || 0;
    const flat = reducedQuery.matches;

    const ghost = document.createElement('div');
    ghost.className = 'ghost';
    ghost.style.width = w + 'px';
    ghost.style.height = h + 'px';
    const shadow = document.createElement('div');
    shadow.className = 'ghost-shadow';
    const tilt = document.createElement('div');
    tilt.className = 'ghost-tilt';
    ghost.append(shadow, tilt);

    // La nota se parte en tiras articuladas: cada una gira sobre el borde de la anterior
    // y juntas dibujan la curva del papel.
    const count = flat ? 1 : SLICES;
    const sliceH = h / count;
    const shades = [];
    let parent = tilt;
    for (let i = 0; i < count; i++) {
      const slice = document.createElement('div');
      slice.className = 'ghost-slice' + (i === 0 ? ' first' : '');
      slice.style.height = sliceH + 'px';
      const clip = document.createElement('div');
      clip.className = 'ghost-clip';
      clip.style.height = (i === count - 1 ? sliceH : sliceH + 1) + 'px';
      const clone = el.cloneNode(true);
      clone.removeAttribute('tabindex');
      clone.removeAttribute('data-card');
      clone.classList.add('in-ghost');
      clone.style.width = w + 'px';
      clone.style.height = h + 'px';
      clone.style.marginTop = -(i * sliceH) + 'px';
      const shade = document.createElement('div');
      shade.className = 'ghost-shade';
      clip.append(clone, shade);
      slice.append(clip);
      parent.append(slice);
      shades.push(shade);
      parent = slice;
    }

    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.style.height = h + 'px';
    el.before(placeholder);
    el.classList.add('drag-source');
    document.body.append(ghost);

    drag = {
      kind: 'card', el, ghost, tilt, shadow, shades, placeholder, w, h, rot, flat,
      grabX: press.x0 - cx, grabY: press.y0 - cy,
      x: cx, y: cy, vx: 0, vy: 0, curl: 0, sway: 0, lift: 0, settle: null,
      list: placeholder.parentNode, before: el,
    };
    paintGhost();
  }

  function paintGhost() {
    const d = drag;
    d.ghost.style.transform = `translate3d(${d.x - d.w / 2}px, ${d.y - d.h / 2}px, 0)`;
    const scale = 1 + 0.06 * d.lift;
    d.tilt.style.transform = `translateZ(${30 * d.lift}px) rotateZ(${d.rot * (1 - d.lift * 0.5) + d.sway}deg) scale(${scale})`;
    // d.curl es la curvatura total, repartida entre las tiras; la primera compensa la mitad
    // para que el centro de la nota siga mirando al frente.
    const n = d.shades.length;
    const step = n > 1 ? d.curl / (n - 1) : 0;
    d.ghost.style.setProperty('--curl', step.toFixed(3) + 'deg');
    d.ghost.style.setProperty('--curl-first', (-d.curl / 2).toFixed(3) + 'deg');
    d.shadow.style.opacity = String(0.2 + 0.34 * d.lift);
    d.shadow.style.transform = `translate(${12 * d.lift}px, ${5 + 30 * d.lift}px) scale(${1 + 0.03 * d.lift})`;
    // Luz desde arriba: lo que se inclina hacia atrás se oscurece y lo que viene hacia delante se aclara.
    // Cada tira lleva un degradado entre el tono de sus dos bordes, así no se ven escalones.
    for (let i = 0; i < n; i++) {
      const top = -d.curl / 2 + (i - 0.5) * step;
      d.shades[i].style.background = `linear-gradient(${tone(top)}, ${tone(top + step)})`;
    }
  }

  function tone(angle) {
    return angle >= 0
      ? `rgba(255,255,255,${clamp(angle / 70, 0, 0.32).toFixed(3)})`
      : `rgba(46,24,0,${clamp(-angle / 110, 0, 0.2).toFixed(3)})`;
  }

  function placeCard() {
    const d = drag;
    const cols = [...columnsEl.querySelectorAll('.column')];
    if (!cols.length) return;
    let best = null;
    let bestDist = Infinity;
    for (const col of cols) {
      const r = col.getBoundingClientRect();
      const dist = press.x < r.left ? r.left - press.x : press.x > r.right ? press.x - r.right : 0;
      if (dist < bestDist) { bestDist = dist; best = col; }
    }
    const list = best.querySelector('.cards');
    const items = [...list.children].filter((c) => c.matches('.note[data-card]') && c !== d.el);
    let before = null;
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (press.y < r.top + r.height / 2) { before = item; break; }
    }
    if (list !== d.list || before !== d.before) {
      list.insertBefore(d.placeholder, before);
      d.list = list;
      d.before = before;
    }
    d.overList = list;
  }

  // ---- Columnas ----
  function beginColumn() {
    const head = press.el;
    const col = head.closest('.column');
    const rect = head.getBoundingClientRect();
    const ghost = head.cloneNode(true);
    ghost.classList.add('col-ghost');
    ghost.style.width = head.offsetWidth + 'px';
    document.body.append(ghost);
    col.classList.add('col-dragging');
    drag = {
      kind: 'col', el: col, ghost, w: rect.width, h: rect.height,
      grabX: press.x0 - (rect.left + rect.width / 2), grabY: press.y0 - (rect.top + rect.height / 2),
      x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, vx: 0, sway: 0,
    };
  }

  function placeColumn() {
    const d = drag;
    const others = [...columnsEl.querySelectorAll('.column')].filter((c) => c !== d.el);
    let before = columnsEl.querySelector('.add-col');
    for (const col of others) {
      const r = col.getBoundingClientRect();
      if (press.x < r.left + r.width / 2) { before = col; break; }
    }
    if (d.el.nextElementSibling !== before) columnsEl.insertBefore(d.el, before);
  }

  // ---- Bucle ----
  function frame(now) {
    const d = drag;
    if (!d) return;
    const dt = Math.min(48, now - d.last) || 16;
    d.last = now;
    const k = 1 - Math.pow(0.001, dt / 240); // suavizado independiente de los fps

    if (d.settle) {
      const s = d.settle;
      const p = Math.min(1, (now - s.t0) / s.ms);
      const e = 1 - Math.pow(1 - p, 4);
      d.x = lerp(s.x0, s.x1, e);
      d.y = lerp(s.y0, s.y1, e);
      d.curl = lerp(s.curl0, 0, e);
      d.sway = lerp(s.sway0, 0, e);
      d.lift = 1 - e;
      paintGhost();
      if (p >= 1) { finishCard(); return; }
      d.raf = requestAnimationFrame(frame);
      return;
    }

    const tx = press.x - d.grabX;
    const ty = press.y - d.grabY;
    const dx = tx - d.x;
    const dy = ty - d.y;
    d.x = tx;
    d.y = ty;

    autoScroll(dt);

    if (d.kind === 'card') {
      d.vx = lerp(d.vx, dx / dt * 16, 0.3);
      d.vy = lerp(d.vy, dy / dt * 16, 0.3);
      if (d.flat) {
        d.lift = 1; d.curl = 0; d.sway = 0;
      } else {
        d.lift = lerp(d.lift, 1, k * 1.6);
        // El borde de abajo se queda atrás: al subir se curva más, al bajar se aplana.
        d.curl = lerp(d.curl, clamp(30 - d.vy * 1.6, -8, 58), k);
        d.sway = lerp(d.sway, clamp(d.vx * 0.9, -11, 11), k);
      }
      paintGhost();
      placeCard();
    } else {
      d.vx = lerp(d.vx, dx / dt * 16, 0.3);
      d.sway = reducedQuery.matches ? 0 : lerp(d.sway, clamp(d.vx * 0.5, -6, 6), k);
      d.ghost.style.transform = `translate3d(${d.x - d.w / 2}px, ${d.y - d.h / 2}px, 0) rotate(${-2 + d.sway}deg) scale(1.04)`;
      placeColumn();
    }
    d.raf = requestAnimationFrame(frame);
  }

  function autoScroll(dt) {
    const speed = (dist) => (clamp(1 - dist / EDGE, 0, 1) ** 1.5) * dt * 0.9;
    const b = boardEl.getBoundingClientRect();
    if (press.x < b.left + EDGE) boardEl.scrollLeft -= speed(press.x - b.left);
    else if (press.x > b.right - EDGE) boardEl.scrollLeft += speed(b.right - press.x);
    const list = drag.kind === 'card' ? drag.overList : null;
    if (list && list.scrollHeight > list.clientHeight) {
      const r = list.getBoundingClientRect();
      if (press.y < r.top + EDGE) list.scrollTop -= speed(Math.max(0, press.y - r.top));
      else if (press.y > r.bottom - EDGE) list.scrollTop += speed(Math.max(0, r.bottom - press.y));
    }
  }

  function drop() {
    const d = drag;
    if (d.kind === 'col') {
      const order = [...columnsEl.querySelectorAll('.column')].map((c) => c.dataset.col);
      cleanup();
      cb.onColumnDrop(order);
      return;
    }
    if (d.settle) return;
    placeCard();
    if (d.flat) { finishCard(); return; }
    const r = d.placeholder.getBoundingClientRect();
    d.settle = {
      t0: performance.now(), ms: 240,
      x0: d.x, y0: d.y, x1: r.left + r.width / 2, y1: r.top + r.height / 2,
      curl0: d.curl, sway0: d.sway, rot0: d.rot,
    };
  }

  function finishCard() {
    const d = drag;
    const list = d.placeholder.parentNode;
    const colId = list.closest('.column').dataset.col;
    let index = 0;
    for (const c of list.children) {
      if (c === d.placeholder) break;
      if (c.matches('.note[data-card]') && c !== d.el) index++;
    }
    const cardId = d.el.dataset.card;
    cleanup();
    cb.onCardDrop(cardId, colId, index);
  }

  function abort() {
    cleanup();
    if (cb.onAbort) cb.onAbort();
  }

  function cleanup() {
    const d = drag;
    if (d) {
      cancelAnimationFrame(d.raf);
      d.ghost.remove();
      if (d.kind === 'card') {
        d.placeholder.remove();
        d.el.classList.remove('drag-source');
      } else {
        d.el.classList.remove('col-dragging');
      }
    }
    drag = null;
    document.body.classList.remove('is-dragging');
    boardEl.classList.remove('dragging');
    suppressClickUntil = performance.now() + 350;
    clearPress();
  }

  return {
    // Tras soltar, el navegador puede lanzar un clic: no debe abrir el editor.
    justDragged: () => performance.now() < suppressClickUntil,
    isActive: () => !!drag,
  };
}
