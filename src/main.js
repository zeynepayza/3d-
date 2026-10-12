import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { STOPS } from './tour.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const ACCENT = new THREE.Color('#b5562c');

// ---------- Renderer / sahne ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Tavanı kesen yatay düzlem: y < clip.constant olan her şey çizilir.
const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 3.2);
renderer.clippingPlanes = [clip];

const scene = new THREE.Scene();
scene.background = new THREE.Color('#efe9e1');
scene.fog = new THREE.Fog('#efe9e1', 30, 70);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight('#fff6ea', '#b9ab9c', 0.9));
const sun = new THREE.DirectionalLight('#fff1dc', 1.4);
sun.position.set(6, 12, 4);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 200);
const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.47;

// ---------- Durum ----------
const state = {
  mode: 'loading', // loading | tour | focus | moving
  progress: 0, // 0 .. STOPS.length-1 (ham scroll)
  current: -1,
  hover: null,
};
const pose = { pos: new THREE.Vector3(), target: new THREE.Vector3(), clip: 3.2 };
const hotspots = []; // { stop, meshes, box, center, radius, marker, li }
let posCurve, targetCurve, clipValues;

// ---------- Model ----------
const loader = new GLTFLoader();
loader.load(
  '/models/room.glb',
  (gltf) => {
    setupModel(gltf);
    $('loader').classList.add('done');
  },
  (e) => {
    const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
    $('bar-fill').style.width = pct + '%';
    $('loader-pct').textContent = pct + '%';
  },
  (err) => {
    console.error(err);
    $('loader-pct').textContent = 'Model yüklenemedi';
  }
);

function setupModel(gltf) {
  const pivot = new THREE.Group();
  pivot.add(gltf.scene);
  pivot.scale.setScalar(0.01); // cm → m
  scene.add(pivot);
  pivot.updateMatrixWorld(true);

  // Evi ortala, zemin y=0'da kalsın.
  const box = new THREE.Box3().setFromObject(pivot);
  const c = box.getCenter(new THREE.Vector3());
  pivot.position.set(-c.x, 0, -c.z);
  pivot.updateMatrixWorld(true);

  // Mesh indeksi → Three mesh (düğüm adları mesh adlarından farklı olduğu için)
  const byIndex = new Map();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const a = gltf.parser.associations.get(o);
    if (a && a.meshes !== undefined) byIndex.set(a.meshes, o);
    o.material.side = THREE.DoubleSide;
    o.material.envMapIntensity = 0.8;
  });

  const houseBox = new THREE.Box3().setFromObject(pivot);
  const houseSize = houseBox.getSize(new THREE.Vector3());
  const houseCenter = houseBox.getCenter(new THREE.Vector3()).setY(0);

  buildHotspots(byIndex);
  buildPath(houseCenter, houseSize);
  buildSections();
  setupScroll();

  state.mode = 'tour';
  samplePath(0, pose);
  camera.position.copy(pose.pos);
  lookTarget.copy(pose.target);
  clip.constant = pose.clip;
  camera.lookAt(lookTarget);
}

function buildHotspots(byIndex) {
  STOPS.forEach((stop, i) => {
    if (!stop.meshes) return;
    const meshes = stop.meshes.map((m) => byIndex.get(m)).filter(Boolean);
    if (!meshes.length) return;
    const box = new THREE.Box3();
    meshes.forEach((m) => {
      box.expandByObject(m);
      m.material = m.material.clone(); // vurgulama diğer mesh'leri etkilemesin
      m.userData.hotspot = i;
    });
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;

    const marker = document.createElement('button');
    marker.className = 'marker';
    marker.innerHTML = `<span class="pin"></span><span class="label">${stop.title}</span>`;
    marker.addEventListener('click', () => focusOn(i));
    $('markers').appendChild(marker);

    const li = document.createElement('li');
    li.innerHTML = `<span class="dot"></span>${stop.title}`;
    li.addEventListener('click', () => focusOn(i));
    $('item-list').appendChild(li);

    hotspots[i] = {
      stop, meshes, box, center, radius, marker, li,
      anchor: new THREE.Vector3(center.x, box.max.y + 0.15, center.z),
    };
  });
}

// Bir nesneye yukarıdan, çapraz açıyla bakan kamera konumu
function viewFor(h, fromDir, elevation = 0.9) {
  const d = Math.max(h.radius * 2.4, 3.0);
  const dir = fromDir.clone().setY(0).normalize();
  return h.center.clone()
    .addScaledVector(dir, d * Math.cos(elevation))
    .add(new THREE.Vector3(0, d * Math.sin(elevation), 0));
}

// Durakta `from` varsa onu kullan, yoksa kamera evin merkezi tarafında dursun.
function viewDir(h, houseCenter) {
  if (h.stop.from) return new THREE.Vector3(h.stop.from[0], 0, h.stop.from[1]);
  const from = houseCenter.clone().sub(h.center).setY(0);
  if (from.lengthSq() < 0.5) from.set(0, 0, 1);
  return from;
}

function buildPath(houseCenter, size) {
  const span = Math.max(size.x, size.z);
  const pos = [];
  const tgt = [];
  clipValues = [];
  const overview = {
    intro: new THREE.Vector3(0.75, 0.75, 1.0),
    plan: new THREE.Vector3(0.1, 1.5, 0.55),
    outro: new THREE.Vector3(-0.8, 1.1, 0.9),
  };

  STOPS.forEach((stop, i) => {
    if (stop.overview) {
      const dir = (overview[stop.id] || overview.plan).clone().normalize();
      pos.push(houseCenter.clone().addScaledVector(dir, span * 1.25));
      tgt.push(houseCenter.clone());
    } else {
      const h = hotspots[i];
      pos.push(viewFor(h, viewDir(h, houseCenter)));
      tgt.push(h.center.clone());
    }
    clipValues.push(stop.clip ?? 2.05);
  });

  posCurve = new THREE.CatmullRomCurve3(pos, false, 'centripetal');
  targetCurve = new THREE.CatmullRomCurve3(tgt, false, 'centripetal');
}

const smooth = (x) => x * x * (3 - 2 * x);

// Ham scroll değerini duraklarda bekleyen bir değere çevir.
function dwell(raw) {
  const i = Math.floor(raw);
  const u = raw - i;
  return i + smooth(THREE.MathUtils.clamp((u - 0.25) / 0.5, 0, 1));
}

function samplePath(raw, out) {
  const n = STOPS.length - 1;
  const p = Math.min(dwell(raw), n);
  const t = p / n;
  posCurve.getPoint(t, out.pos);
  targetCurve.getPoint(t, out.target);
  const i = Math.min(Math.floor(p), n - 1);
  out.clip = THREE.MathUtils.lerp(clipValues[i], clipValues[i + 1], p - i);
  return out;
}

// ---------- Scroll bölümleri ----------
function buildSections() {
  const root = $('sections');
  STOPS.forEach((stop, i) => {
    const s = document.createElement('section');
    s.className = 'section' + (i === 0 ? ' intro' : '');
    const btn = stop.meshes ? `<button data-focus="${i}">Yakından incele</button>` : '';
    const hint = i === 0 ? '<p class="scroll-hint">↓ Kaydırarak gezin</p>' : '';
    s.innerHTML = `<div class="card">
      <p class="kicker">${stop.kicker}</p>
      <h2>${stop.title}</h2>
      <p class="text">${stop.text}</p>${btn}${hint}</div>`;
    root.appendChild(s);
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-focus]');
    if (b) focusOn(+b.dataset.focus);
  });
}

function setupScroll() {
  ScrollTrigger.create({
    trigger: '#sections',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
    onUpdate: (st) => {
      state.progress = st.progress * (STOPS.length - 1);
      $('progress-fill').style.width = st.progress * 100 + '%';
      setCurrent(Math.round(state.progress));
    },
  });
  setCurrent(0);
}

function setCurrent(i) {
  if (i === state.current) return;
  state.current = i;
  document.querySelectorAll('.section').forEach((s, k) => s.classList.toggle('active', k === i));
  hotspots.forEach((h, k) => {
    if (!h) return;
    h.li.classList.toggle('active', k === i);
    h.marker.classList.toggle('near', k === i);
  });
}

// ---------- Odak modu ----------
let focusedIndex = -1;

function focusOn(i) {
  const h = hotspots[i];
  if (!h) return;
  focusedIndex = i;
  state.mode = 'moving';
  document.body.classList.add('focused');
  controls.enabled = false;

  const from = h.stop.from
    ? new THREE.Vector3(h.stop.from[0], 0, h.stop.from[1])
    : camera.position.clone().sub(h.center);
  const dest = viewFor(h, from, 0.6);
  const d = Math.max(h.radius * 1.6, 1.4);
  dest.sub(h.center).setLength(d).add(h.center);

  $('focus-kicker').textContent = h.stop.kicker;
  $('focus-title').textContent = h.stop.title;
  $('focus-text').textContent = h.stop.text;
  $('focus-card').hidden = false;
  hotspots.forEach((x, k) => x && x.li.classList.toggle('active', k === i));

  tweenCamera(dest, h.center, 2.05, () => {
    state.mode = 'focus';
    controls.target.copy(h.center);
    controls.minDistance = Math.max(h.radius * 0.6, 0.5);
    controls.maxDistance = Math.max(h.radius * 4, 5);
    controls.enabled = true;
  });
}

function exitFocus() {
  if (state.mode !== 'focus') return;
  focusedIndex = -1;
  state.mode = 'moving';
  controls.enabled = false;
  $('focus-card').hidden = true;
  document.body.classList.remove('focused');
  const back = samplePath(state.progress, { pos: new THREE.Vector3(), target: new THREE.Vector3() });
  tweenCamera(back.pos, back.target, back.clip, () => {
    state.mode = 'tour';
    const cur = state.current;
    state.current = -1;
    setCurrent(cur);
  });
}

const lookTarget = new THREE.Vector3();
function tweenCamera(pos, target, clipTo, done) {
  const startTarget = lookTarget.clone();
  const proxy = { t: 0 };
  const startPos = camera.position.clone();
  const startClip = clip.constant;
  gsap.to(proxy, {
    t: 1,
    duration: 1.6,
    ease: 'power3.inOut',
    onUpdate: () => {
      camera.position.lerpVectors(startPos, pos, proxy.t);
      lookTarget.lerpVectors(startTarget, target, proxy.t);
      clip.constant = THREE.MathUtils.lerp(startClip, clipTo, proxy.t);
      camera.lookAt(lookTarget);
    },
    onComplete: done,
  });
}

$('focus-back').addEventListener('click', exitFocus);
window.addEventListener('keydown', (e) => e.key === 'Escape' && exitFocus());

// ---------- Hover / tıklama ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;

function pick(e) {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  // Kesme düzleminin üstünde kalan (görünmeyen) yüzeyleri atla
  const hit = hits.find((x) => x.point.y < clip.constant);
  return hit && hit.object.userData.hotspot !== undefined ? hit.object.userData.hotspot : null;
}

function setHover(i) {
  if (state.hover === i) return;
  if (state.hover !== null) hotspots[state.hover].meshes.forEach((m) => m.material.emissive?.setRGB(0, 0, 0));
  state.hover = i;
  if (i !== null) hotspots[i].meshes.forEach((m) => m.material.emissive?.copy(ACCENT).multiplyScalar(0.35));
  canvas.classList.toggle('hovering', i !== null && i !== focusedIndex);
}

canvas.addEventListener('pointermove', (e) => {
  if (state.mode === 'loading' || state.mode === 'moving') return;
  setHover(pick(e));
});
canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || state.mode === 'moving' || state.mode === 'loading') return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5;
  downAt = null;
  if (moved) return;
  const i = pick(e);
  if (i !== null && i !== focusedIndex) focusOn(i);
});

// ---------- Döngü ----------
const tmp = new THREE.Vector3();
const desired = { pos: new THREE.Vector3(), target: new THREE.Vector3(), clip: 3.2 };
const clock = new THREE.Clock();

function updateMarkers() {
  const w = window.innerWidth;
  const hh = window.innerHeight;
  hotspots.forEach((h) => {
    if (!h) return;
    tmp.copy(h.anchor).project(camera);
    const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
    h.marker.classList.toggle('hidden', !visible);
    if (visible) {
      const x = (tmp.x * 0.5 + 0.5) * w - 7;
      const y = (-tmp.y * 0.5 + 0.5) * hh - 7;
      h.marker.style.transform = `translate(${x}px, ${y}px)`;
    }
  });
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (state.mode === 'tour') {
    samplePath(state.progress, desired);
    const k = 1 - Math.exp(-dt * 5);
    camera.position.lerp(desired.pos, k);
    lookTarget.lerp(desired.target, k);
    clip.constant += (desired.clip - clip.constant) * k;
    camera.lookAt(lookTarget);
  } else if (state.mode === 'focus') {
    controls.update();
    lookTarget.copy(controls.target);
  }
  if (state.mode !== 'loading') updateMarkers();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
