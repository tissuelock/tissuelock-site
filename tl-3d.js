// Tissuelock — glass forms. Two objects:
//   data-gl="waves"  the logo's three waves, extruded into frosted glass slabs (hero)
//   data-gl="panels" the product: three frosted sheets, offset side by side
// One shared rAF; scenes render only while on screen. Pointer motion is fed
// through a critically-damped spring so it never snaps or jitters.

import * as THREE from 'three';

const scenes = [];
const pointer = { tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0, has: false };

/* ---------------- environment: a soft studio, built procedurally ---------------- */

// The equirect source is identical for every scene, so build it once.
let envSource = null;

function studioEnv(renderer) {
  if (envSource) {
    const pm = new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    const t = pm.fromEquirectangular(envSource).texture;
    pm.dispose();
    return t;
  }
  const w = 1024, h = 512;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');

  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0.00, '#dfe9f2');
  sky.addColorStop(0.42, '#7d93a8');
  sky.addColorStop(0.58, '#1b2f42');
  sky.addColorStop(1.00, '#050d16');
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);

  // soft boxes — these become the long edge highlights on the glass
  const blob = (x, y, rx, ry, a) => {
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    g.addColorStop(0, 'rgba(255,255,255,' + a + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.save();
    c.translate(x, y);
    c.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    c.translate(-x, -y);
    c.fillStyle = g;
    c.fillRect(x - rx, y - ry, rx * 2, ry * 2);
    c.restore();
  };
  blob(210, 120, 300, 85, 0.95);
  blob(690, 95, 210, 60, 0.8);
  blob(470, 210, 150, 150, 0.35);
  blob(900, 250, 180, 120, 0.4);

  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  envSource = tex;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  return env;
}

function glassMaterial(opts) {
  const o = opts || {};
  return new THREE.MeshPhysicalMaterial({
    name: o.name || 'frosted glass',
    color: new THREE.Color(o.color || 0xffffff),
    metalness: 0,
    roughness: o.roughness !== undefined ? o.roughness : 0.42,
    transmission: o.transmission !== undefined ? o.transmission : 0.94,
    thickness: o.thickness !== undefined ? o.thickness : 0.5,
    ior: 1.46,
    clearcoat: 0.7,
    clearcoatRoughness: 0.35,
    attenuationColor: new THREE.Color(o.attenuation || 0xbcd4e6),
    attenuationDistance: 2.4,
    envMapIntensity: o.envIntensity !== undefined ? o.envIntensity : 1.5,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthWrite: false
  });
}

/* ---------------- geometry ---------------- */

// A tilde-shaped ribbon, tapered to points at both tips — the logo's wave.
function waveGeometry(len, amp, thick) {
  const N = 90;
  const top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = (t - 0.5) * len;
    const y = Math.sin(t * Math.PI * 2) * amp;
    const taper = Math.pow(Math.sin(Math.PI * t), 0.55);
    const h = thick * taper * 0.5;
    const slope = Math.cos(t * Math.PI * 2) * amp * (Math.PI * 2) / len;
    const nx = -slope / Math.hypot(1, slope);
    const ny = 1 / Math.hypot(1, slope);
    top.push(new THREE.Vector2(x + nx * h, y + ny * h));
    bot.push(new THREE.Vector2(x - nx * h, y - ny * h));
  }
  const shape = new THREE.Shape();
  shape.moveTo(top[0].x, top[0].y);
  for (let i = 1; i <= N; i++) shape.lineTo(top[i].x, top[i].y);
  for (let i = N; i >= 0; i--) shape.lineTo(bot[i].x, bot[i].y);
  shape.closePath();

  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.17, bevelEnabled: true, bevelThickness: 0.045,
    bevelSize: 0.04, bevelOffset: 0, bevelSegments: 4, curveSegments: 6
  });
  g.center();
  g.computeVertexNormals();
  return g;
}

function roundedRectGeometry(w, h, r, depth) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: depth, bevelEnabled: true, bevelThickness: 0.016,
    bevelSize: 0.016, bevelOffset: 0, bevelSegments: 3, curveSegments: 10
  });
  g.center();
  g.computeVertexNormals();
  return g;
}

/* ---------------- object builders ---------------- */

function buildWaves(env) {
  const group = new THREE.Group();
  group.name = 'waves';
  // The logo's own three tints, sampled from the mark: pale top, blue middle,
  // slate bottom (top to bottom matches restY below).
  const tints = [0xd6dce2, 0x4585c4, 0x53779f];
  const rough = [0.5, 0.36, 0.42];
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const geo = waveGeometry(3.5, 0.34, 0.66);
    const mat = glassMaterial({
      name: 'wave glass ' + (i + 1),
      color: tints[i],
      attenuation: tints[i],
      transmission: 0.82,   // less clear than before so the tint actually reads
      roughness: rough[i],
      thickness: 0.6,
      envIntensity: 1.65
    });
    mat.envMap = env;
    const m = new THREE.Mesh(geo, mat);
    m.name = 'wave' + (i + 1);
    m.userData.restY = (1 - i) * 0.78;
    m.userData.restZ = (i - 1) * 0.30;
    m.userData.restRot = (i - 1) * 0.055;
    group.add(m);
    parts.push(m);
  }
  group.userData.parts = parts;
  group.userData.layout = (k) => {
    // k: 0 = collapsed (intro), 1 = fanned out (rest)
    parts.forEach((m, i) => {
      m.position.y = m.userData.restY * k;
      m.position.z = m.userData.restZ * k;
      m.rotation.z = m.userData.restRot * k;
      m.rotation.x = (1 - k) * 0.55;
      m.scale.setScalar(0.82 + 0.18 * k);
    });
  };
  return group;
}

// The hero form: the logo's wave, repeated into a woven interface — two tissue
// planes meeting through a layered seam. Unfurls from a single line.
function buildLattice(env) {
  const group = new THREE.Group();
  group.name = 'interface';
  const N = 7;
  const parts = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);            // 0..1 top to bottom
    const geo = waveGeometry(4.3, 0.30 + Math.sin(t * Math.PI) * 0.09, 0.40);
    const mid = Math.sin(t * Math.PI);  // brightest through the seam
    const mat = glassMaterial({
      name: 'ribbon ' + (i + 1),
      color: mid > 0.72 ? 0xa9cbe8 : (i % 2 ? 0xdbe7f1 : 0xeef5fb),
      roughness: 0.34 + (1 - mid) * 0.2,
      transmission: 0.95,
      thickness: 0.42,
      envIntensity: 1.5 + mid * 0.5
    });
    mat.envMap = env;
    const m = new THREE.Mesh(geo, mat);
    m.name = 'ribbon' + (i + 1);
    m.userData.restY = (t - 0.5) * 2.55;
    m.userData.restZ = Math.sin(t * Math.PI * 2) * 0.34;
    m.userData.restRotZ = (t - 0.5) * 0.30;
    m.userData.restRotY = Math.sin(t * Math.PI) * 0.22;
    m.userData.phase = t * 1.9;
    parts.push(m);
    group.add(m);
  }
  group.userData.parts = parts;
  group.userData.layout = (k) => {
    parts.forEach((m, i) => {
      // staggered unfurl: outer ribbons arrive last
      const off = Math.abs(i - (N - 1) / 2) / ((N - 1) / 2);
      const kk = Math.max(0, Math.min(1, (k * 1.5) - off * 0.5));
      const e = 1 - Math.pow(1 - kk, 4);
      m.position.y = m.userData.restY * e;
      m.position.z = m.userData.restZ * e;
      m.rotation.z = m.userData.restRotZ * e;
      m.rotation.y = m.userData.restRotY * e;
      m.rotation.x = (1 - e) * 1.25;
      m.scale.set(0.6 + 0.4 * e, 0.28 + 0.72 * e, 1);
      m.material.opacity = 0.25 + 0.75 * e;
    });
  };
  return group;
}

// A rounded-rectangle contour as points, for outline drawing.
function roundedRectPoints(w, h, r, seg) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  s.closePath();
  return s.getPoints(seg || 12);
}

// The product: three stacked sheets. Each sheet is an opaque face carrying one
// outline in the same tint — solid, so no edge reads through the sheet in front.
function buildPanels() {
  const group = new THREE.Group();
  group.name = 'panels';
  const parts = [];
  const EDGE = 0x7FC4E8;
  for (let i = 0; i < 3; i++) {
    const pts = roundedRectPoints(1.30, 2.78, 0.075, 14);
    const sheet = new THREE.Group();
    sheet.name = 'sheet' + (i + 1);

    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
    const face = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({
        name: 'sheet face ' + (i + 1),
        color: 0x0A1A2B,
        toneMapped: false,   // ACES would darken the fill off the section background
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      })
    );
    face.name = 'sheet face ' + (i + 1);
    sheet.add(face);

    // The outline is a thin filled ring, not a line: GL ignores line width, so a
    // real ring is the only way to control stroke weight.
    const T = 0.022;
    const ring = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
    ring.holes.push(new THREE.Path(
      roundedRectPoints(1.30 - T * 2, 2.78 - T * 2, Math.max(0.01, 0.075 - T), 14)
        .map((p) => new THREE.Vector2(p.x, p.y))
    ));
    const line = new THREE.Mesh(
      new THREE.ShapeGeometry(ring),
      new THREE.MeshBasicMaterial({ name: 'sheet outline ' + (i + 1), color: EDGE, side: THREE.DoubleSide, toneMapped: false })
    );
    line.name = 'sheet outline ' + (i + 1);
    line.position.z = 0.002;
    sheet.add(line);

    // The mark sits in the bottom-right corner of the front sheet only.
    if (i === 2) {
      const mw = 0.26, mh = mw * (248 / 313);
      const tex = new THREE.TextureLoader().load('assets/logo-mark-dark-clean.png');
      tex.colorSpace = THREE.SRGBColorSpace;
      const badge = new THREE.Mesh(
        new THREE.PlaneGeometry(mw, mh),
        new THREE.MeshBasicMaterial({ name: 'sheet mark', map: tex, transparent: true, toneMapped: false, depthWrite: false })
      );
      badge.name = 'sheet mark';
      badge.position.set(1.30 / 2 - mw / 2 - 0.10, -2.78 / 2 + mh / 2 + 0.10, 0.004);
      sheet.add(badge);
    }

    const m = sheet;
    m.userData.restX = (i - 1) * 0.58;
    m.userData.restY = (i - 1) * 0.11;
    m.userData.restZ = (i - 1) * 0.055;
    parts.push(m);
    group.add(m);
  }
  group.rotation.set(0.07, -0.13, -0.155);
  group.userData.parts = parts;
  group.userData.layout = (k) => {
    parts.forEach((m) => {
      m.position.x = m.userData.restX * k;
      m.position.y = m.userData.restY * k;
      m.position.z = m.userData.restZ * k;
    });
  };
  return group;
}

/* ---------------- scene plumbing ---------------- */

function makeScene(canvas) {
  const kind = canvas.dataset.gl;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.style.display = 'none';
    return null;
  }
  renderer.setPixelRatio(Math.min(1.6, window.devicePixelRatio || 1));
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const env = studioEnv(renderer);
  scene.environment = env;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, kind === 'panels' ? 7.6 : kind === 'lattice' ? 7.8 : 7.0);

  scene.add(new THREE.AmbientLight(0x6f8ea8, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(-3.4, 4.2, 3.6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fc4ea, 1.5);
  rim.position.set(3.8, -1.6, -2.4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(1.2, -3.2, 4.0);
  scene.add(fill);

  const pivot = new THREE.Group();
  scene.add(pivot);
  const obj = kind === 'panels' ? buildPanels()
    : kind === 'lattice' ? buildLattice(env)
    : buildWaves(env);
  pivot.add(obj);

  const s = {
    canvas, kind, renderer, scene, camera, pivot, obj,
    visible: true, intro: kind === 'lattice' ? 0 : 1, introFrom: 0,
    introing: false, t0: 0, dur: 2400, baseZ: camera.position.z, spin: 0
  };
  obj.userData.layout(s.intro);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    s.lastW = w; s.lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the object framed on narrow viewports
    const fit = Math.min(1, w / 620);
    camera.position.z = s.baseZ * (1 + (1 - fit) * 0.55);
    camera.updateProjectionMatrix();
  };
  s.resize = resize;
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);

  if (window.IntersectionObserver) {
    new IntersectionObserver((es) => { es.forEach((e) => { s.visible = e.isIntersecting; }); },
      { rootMargin: '120px' }).observe(canvas);
  }
  return s;
}

function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // critically-damped spring toward the pointer — smooth in, smooth out
  const k = 26, d = 2 * Math.sqrt(26) * 1.06;
  pointer.vx += (-k * (pointer.x - pointer.tx) - d * pointer.vx) * dt;
  pointer.vy += (-k * (pointer.y - pointer.ty) - d * pointer.vy) * dt;
  pointer.x += pointer.vx * dt;
  pointer.y += pointer.vy * dt;

  const t = now / 1000;
  for (const s of scenes) {
    if (!s || !s.visible) continue;

    // Self-correcting size: ResizeObserver is not delivered while the document
    // is hidden, so a canvas can be left at the 300x150 default. Cheap compare.
    if (s.canvas.clientWidth !== s.lastW || s.canvas.clientHeight !== s.lastH) s.resize();

    if (s.introing) {
      const p = Math.min(1, (now - s.t0) / s.dur);
      const e = easeOutQuint(p);
      s.intro = s.introFrom + (1 - s.introFrom) * e;
      s.obj.userData.layout(s.intro);
      s.camera.position.z = s.baseZ * (1.42 - 0.42 * easeInOutCubic(p));
      s.camera.updateProjectionMatrix();
      if (p >= 1) { s.introing = false; s.intro = 1; }
    }

    const idle = 0.055 * Math.sin(t * 0.28) + 0.03 * Math.sin(t * 0.17 + 1.1);
    const lead = s.introing ? (1 - s.intro) : 0;

    if (s.kind === 'panels') {
      s.pivot.rotation.y = pointer.x * 0.62 + idle * 0.62;
      s.pivot.rotation.x = -pointer.y * 0.42 + idle * 0.38;
      s.pivot.position.y = Math.sin(t * 0.34) * 0.045;
    } else if (s.kind === 'lattice') {
      s.pivot.rotation.y = pointer.x * 0.5 + idle * 0.8 + lead * 0.9;
      s.pivot.rotation.x = -pointer.y * 0.3 + idle * 0.4;
      s.pivot.rotation.z = pointer.x * 0.045;
      s.pivot.position.y = Math.sin(t * 0.31) * 0.05;
      // each ribbon breathes on its own phase — the seam never reads static
      const parts = s.obj.userData.parts;
      for (let i = 0; i < parts.length; i++) {
        const m = parts[i];
        const ph = m.userData.phase;
        m.position.z = m.userData.restZ * s.intro + Math.sin(t * 0.42 + ph) * 0.07 * s.intro;
        m.rotation.z = m.userData.restRotZ * s.intro + Math.sin(t * 0.33 + ph) * 0.028 * s.intro;
      }
    } else {
      s.pivot.rotation.y = pointer.x * 0.62 + idle + lead * 1.1;
      s.pivot.rotation.x = -pointer.y * 0.4 + idle * 0.5;
      s.pivot.rotation.z = pointer.x * 0.06;
      s.pivot.position.y = Math.sin(t * 0.4) * 0.06;
    }
    s.renderer.render(s.scene, s.camera);
  }
}

/* ---------------- boot ---------------- */

// Re-renders can replace canvas nodes; without pruning, their WebGL contexts
// pile up and the browser starts dropping the oldest ones.
const MAX_SCENES = 4;

function dropScene(i) {
  const s = scenes[i];
  s.scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  s.renderer.dispose();   // no loseContext: it triggers restore churn
  scenes.splice(i, 1);
}

function prune() {
  for (let i = scenes.length - 1; i >= 0; i--) {
    if (!scenes[i].canvas.isConnected) dropScene(i);
  }
}

// Each scene costs a WebGL context plus an environment map, so only ever build
// one for a canvas that genuinely has none, and keep a hard ceiling.
function attach() {
  const pending = document.querySelectorAll('canvas[data-gl]:not([data-gl-bound])');
  if (!pending.length) return scenes.length;
  prune();
  pending.forEach((cv) => {
    if (cv.__tl) return;
    while (scenes.length >= MAX_SCENES) dropScene(0);
    cv.__tl = true;
    cv.setAttribute('data-gl-bound', '1');
    const s = makeScene(cv);
    if (s) {
      scenes.push(s);
      cv.dispatchEvent(new CustomEvent('tl-gl-ready', { bubbles: true }));
    }
  });
  return scenes.length;
}

window.addEventListener('pointermove', (e) => {
  pointer.tx = e.clientX / Math.max(1, window.innerWidth) - 0.5;
  pointer.ty = e.clientY / Math.max(1, window.innerHeight) - 0.5;
  pointer.has = true;
}, { passive: true });
window.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });

window.TL3D = {
  attach: attach,
  count: () => scenes.length,
  playIntro(ms) {
    attach();
    scenes.forEach((s) => {
      if (s.kind !== 'lattice') return;
      s.introFrom = 0;
      s.intro = 0;
      s.obj.userData.layout(0);
      s.dur = ms || 2400;
      s.t0 = performance.now();
      s.introing = true;
    });
  },
  settle() {
    scenes.forEach((s) => {
      s.introing = false;
      s.intro = 1;
      s.obj.userData.layout(1);
      s.camera.position.z = s.baseZ;
      s.camera.updateProjectionMatrix();
    });
  }
};

// The template streams in, so poll briefly for canvases that arrive late.
// attach() is a no-op unless an unbound canvas actually exists.
attach();
let tries = 0;
const iv = setInterval(() => { attach(); if (++tries > 24) clearInterval(iv); }, 150);
requestAnimationFrame(frame);
