import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============ SHARED WITH 2D GAME ============
const STORAGE_KEY = 'mcg:v1';
const TRAIN_XP = 3;

const SPECIES = [
  { id: 0, name: '치즈',   color: 0xf4a64a, accent: 0xc36f1f, belly: 0xffd9a8 },
  { id: 1, name: '까망',   color: 0x2b2b33, accent: 0x59595f, belly: 0x4a4a55 },
  { id: 2, name: '하양',   color: 0xf0ece6, accent: 0xc9c3b8, belly: 0xffffff },
  { id: 3, name: '회색',   color: 0x8a8f98, accent: 0x5c6069, belly: 0xb5b9c0 },
  { id: 4, name: '스모크', color: 0x5f7f9c, accent: 0x3d556f, belly: 0x93adc3 },
  { id: 5, name: '삼색',   color: 0xead2a8, accent: 0x8c6038, belly: 0xfff4df },
];
const NAMES = ['나비','치즈','까망','오레오','모찌','보리','두부','호빵','감자','쿠키','크림','레오','단비','콩이','별이','루이','망고','참치','토리','쏘세지'];

function muscleForLevel(lv) { return Math.min(1, Math.max(0, (lv - 1) / 15)); }
function stageForLevel(lv) {
  if (lv >= 16) return { name: '머슬몬스터', emoji: '💥' };
  if (lv >= 12) return { name: '헬창',       emoji: '🏋️' };
  if (lv >= 8)  return { name: '근육',       emoji: '💪' };
  if (lv >= 5)  return { name: '청년',       emoji: '😼' };
  if (lv >= 3)  return { name: '꼬마',       emoji: '😺' };
  return         { name: '새끼',             emoji: '🐱' };
}
function xpRequired(lv) { return 4 + Math.floor(lv * 2.5); }

function defaultState() {
  const sp = SPECIES[Math.floor(Math.random() * SPECIES.length)];
  const cat = {
    id: 'c' + Math.random().toString(36).slice(2, 10),
    speciesId: sp.id,
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    level: 1,
    xp: 0,
  };
  return { coins: 10, cats: [cat], activeCatId: cat.id, lastTick: Date.now() };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (!s?.cats?.length) return defaultState();
    if (!s.cats.find(c => c.id === s.activeCatId)) s.activeCatId = s.cats[0].id;
    return s;
  } catch { return defaultState(); }
}
function saveState() {
  state.lastTick = Date.now();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

let state = loadState();
const activeIdx = () => Math.max(0, state.cats.findIndex(c => c.id === state.activeCatId));
const activeCat = () => state.cats[activeIdx()];
const speciesOf = (cat) => SPECIES[cat.speciesId] || SPECIES[0];

// ============ THREE.JS SETUP ============
const canvas = document.getElementById('canvas');
const scene = new THREE.Scene();
scene.background = null; // transparent (CSS gradient shows through)

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.2, 6.5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.8;
controls.target.set(0, 1.4, 0);
controls.minDistance = 3;
controls.maxDistance = 12;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI * 0.52;

// ============ LIGHTS ============
const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1d40, 0.5);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xfff1d0, 1.6);
key.position.set(4, 6, 3);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 4;
key.shadow.camera.bottom = -4;
scene.add(key);

const rim = new THREE.PointLight(0xff3e88, 8, 15, 1.4);
rim.position.set(-3, 1.5, -2.5);
scene.add(rim);

const purple = new THREE.PointLight(0x7c5cff, 5, 12, 1.5);
purple.position.set(3, 0.5, -2);
scene.add(purple);

// ============ FLOOR ============
const floorGeo = new THREE.CircleGeometry(5, 48);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x12141c,
  roughness: 0.85,
  metalness: 0.2,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.05;
floor.receiveShadow = true;
scene.add(floor);

// Subtle ring on floor
const ringGeo = new THREE.RingGeometry(1.6, 1.7, 64);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.25 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = -Math.PI / 2;
ring.position.y = -0.04;
scene.add(ring);

// ============ PARAMETRIC CAT MODEL ============
let catGroup = null;
let targetMuscle = muscleForLevel(activeCat().level);
let currentMuscle = targetMuscle;

function buildCat(species, muscle) {
  const g = new THREE.Group();

  const baseMat = new THREE.MeshStandardMaterial({
    color: species.color, roughness: 0.55, metalness: 0.05,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: species.accent, roughness: 0.7, metalness: 0,
  });
  const pinkMat = new THREE.MeshStandardMaterial({
    color: 0xff7aa8, roughness: 0.4, metalness: 0,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0f, roughness: 0.15, metalness: 0.3,
  });

  // Head
  const headGeo = new THREE.SphereGeometry(0.62, 32, 24);
  const head = new THREE.Mesh(headGeo, baseMat);
  head.position.y = 2.5 - muscle * 0.08;
  head.castShadow = true;
  g.add(head);

  // Ears
  for (const side of [-1, 1]) {
    const earGeo = new THREE.ConeGeometry(0.2, 0.42, 14);
    const ear = new THREE.Mesh(earGeo, baseMat);
    ear.position.set(side * 0.36, 3.02 - muscle * 0.08, -0.02);
    ear.rotation.z = side * -0.12;
    ear.rotation.x = -0.15;
    ear.castShadow = true;
    g.add(ear);

    const innerGeo = new THREE.ConeGeometry(0.13, 0.3, 10);
    const inner = new THREE.Mesh(innerGeo, accentMat);
    inner.position.copy(ear.position);
    inner.position.z += 0.05;
    inner.rotation.copy(ear.rotation);
    g.add(inner);
  }

  // Eyes
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), eyeMat);
    eye.position.set(side * 0.2, 2.55 - muscle * 0.08, 0.56);
    g.add(eye);
    // Eye shine
    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    shine.position.set(side * 0.2 + 0.015, 2.58 - muscle * 0.08, 0.62);
    g.add(shine);
  }

  // Nose (pink)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), pinkMat);
  nose.position.set(0, 2.4 - muscle * 0.08, 0.6);
  nose.scale.set(1.1, 0.7, 0.9);
  g.add(nose);

  // Cheeks (subtle pink)
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0xff7aa8, roughness: 0.6, transparent: true, opacity: 0.35 })
    );
    cheek.position.set(side * 0.36, 2.4 - muscle * 0.08, 0.45);
    cheek.scale.set(1, 0.6, 0.3);
    g.add(cheek);
  }

  // Torso (V-taper scaled sphere)
  const torsoGeo = new THREE.SphereGeometry(0.7, 32, 24);
  const torso = new THREE.Mesh(torsoGeo, baseMat);
  torso.position.y = 1.25;
  torso.scale.set(
    0.92 + muscle * 0.85,   // shoulder width grows
    1.45,
    0.7 + muscle * 0.35,
  );
  torso.castShadow = true;
  torso.receiveShadow = true;
  g.add(torso);

  // Waist taper: small darker band
  if (muscle > 0.3) {
    const waist = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 24, 16),
      accentMat
    );
    waist.position.y = 0.85;
    waist.scale.set(0.95 + muscle * 0.1, 0.5, 0.75);
    waist.material = accentMat.clone();
    waist.material.transparent = true;
    waist.material.opacity = 0.25;
    g.add(waist);
  }

  // Belly (lighter spot)
  const bellyMat = new THREE.MeshStandardMaterial({
    color: species.belly, roughness: 0.5, transparent: true, opacity: 0.7,
  });
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), bellyMat);
  belly.position.set(0, 1.1, 0.45);
  belly.scale.set(1, 1.2, 0.4);
  g.add(belly);

  // Arms (capsules — grow thickness + length with muscle)
  for (const side of [-1, 1]) {
    const armR = 0.22 + muscle * 0.28;
    const armLen = 0.8 + muscle * 0.4;
    const armGeo = new THREE.CapsuleGeometry(armR, armLen, 8, 16);
    const arm = new THREE.Mesh(armGeo, baseMat);
    arm.position.set(side * (0.88 + muscle * 0.55), 1.2, 0);
    arm.rotation.z = side * (0.06 + muscle * 0.04);
    arm.castShadow = true;
    g.add(arm);

    // Bicep bump (visible from muscle > 0.25)
    if (muscle > 0.25) {
      const bicep = new THREE.Mesh(
        new THREE.SphereGeometry(armR * 0.75, 16, 12),
        baseMat
      );
      bicep.position.set(side * (0.88 + muscle * 0.55) - side * 0.06, 1.5, 0);
      g.add(bicep);
    }

    // Paw
    const paw = new THREE.Mesh(
      new THREE.SphereGeometry(armR * 1.1, 12, 8),
      baseMat
    );
    paw.position.set(side * (0.88 + muscle * 0.55), 0.5, 0);
    paw.scale.set(1.05, 0.65, 0.9);
    paw.castShadow = true;
    g.add(paw);
  }

  // Legs
  for (const side of [-1, 1]) {
    const legGeo = new THREE.CapsuleGeometry(0.24, 0.45, 6, 12);
    const leg = new THREE.Mesh(legGeo, baseMat);
    leg.position.set(side * 0.32, 0.2, 0.05);
    leg.castShadow = true;
    g.add(leg);
    // Foot paw
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), baseMat);
    foot.position.set(side * 0.32, -0.02, 0.2);
    foot.scale.set(1, 0.5, 1.3);
    foot.castShadow = true;
    g.add(foot);
  }

  // Tail (TubeGeometry curving upward)
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.5, -0.55),
    new THREE.Vector3(0.55, 0.85, -0.75),
    new THREE.Vector3(0.95, 1.6, -0.5),
    new THREE.Vector3(0.75, 2.4, -0.1),
  ]);
  const tailGeo = new THREE.TubeGeometry(tailCurve, 32, 0.12 + muscle * 0.04, 10, false);
  const tail = new THREE.Mesh(tailGeo, baseMat);
  tail.castShadow = true;
  g.add(tail);

  return g;
}

function disposeGroup(g) {
  if (!g) return;
  g.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
}

function rebuildCat(flashOnLevelUp = false) {
  if (catGroup) {
    scene.remove(catGroup);
    disposeGroup(catGroup);
  }
  const cat = activeCat();
  catGroup = buildCat(speciesOf(cat), currentMuscle);
  scene.add(catGroup);
  if (flashOnLevelUp) flash();
}

// ============ FLASH FX ============
function flash() {
  const flashLight = new THREE.PointLight(0xffd166, 30, 10, 1);
  flashLight.position.set(0, 2, 1.5);
  scene.add(flashLight);
  let t = 0;
  const dur = 0.6;
  const startIntensity = 30;
  (function tick() {
    t += 0.016;
    const k = Math.max(0, 1 - t / dur);
    flashLight.intensity = startIntensity * k;
    if (k > 0) requestAnimationFrame(tick);
    else { scene.remove(flashLight); flashLight.dispose(); }
  })();
}

// ============ HUD ============
function updateHUD() {
  const cat = activeCat();
  const sp = speciesOf(cat);
  const stage = stageForLevel(cat.level);
  const need = xpRequired(cat.level);
  document.getElementById('cat-name').textContent = `${cat.name} · ${sp.name}`;
  document.getElementById('cat-stage').textContent = `${stage.emoji} ${stage.name}`;
  document.getElementById('cat-level').textContent = cat.level;
  document.getElementById('xp-fill').style.width = `${Math.min(100, (cat.xp / need) * 100)}%`;
  document.getElementById('xp-text').textContent = `${cat.xp} / ${need}`;
  document.getElementById('cat-counter').textContent = `${activeIdx() + 1} / ${state.cats.length}`;
}

let _toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ============ ACTIONS ============
function train() {
  const cat = activeCat();
  cat.xp += TRAIN_XP;
  let leveled = 0;
  while (cat.xp >= xpRequired(cat.level)) {
    cat.xp -= xpRequired(cat.level);
    cat.level += 1;
    leveled += 1;
  }
  targetMuscle = muscleForLevel(cat.level);
  updateHUD();
  saveState();
  if (leveled > 0) {
    const stage = stageForLevel(cat.level);
    toast(`🎉 Lv.${cat.level} · ${stage.emoji} ${stage.name}`);
  }
}

function cycleCat(dir) {
  if (state.cats.length < 2) { toast('고양이 1마리만 있어요'); return; }
  const idx = activeIdx();
  const next = (idx + dir + state.cats.length) % state.cats.length;
  state.activeCatId = state.cats[next].id;
  currentMuscle = muscleForLevel(activeCat().level);
  targetMuscle = currentMuscle;
  rebuildCat();
  updateHUD();
  saveState();
}

function toggleAutoRotate() {
  const btn = document.getElementById('btn-autorotate');
  controls.autoRotate = !controls.autoRotate;
  btn.dataset.on = controls.autoRotate;
}

// ============ EVENTS ============
document.getElementById('btn-train').addEventListener('click', train);
document.getElementById('btn-prev').addEventListener('click', () => cycleCat(-1));
document.getElementById('btn-next').addEventListener('click', () => cycleCat(+1));
document.getElementById('btn-autorotate').addEventListener('click', toggleAutoRotate);
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); train(); }
  else if (e.code === 'ArrowLeft') cycleCat(-1);
  else if (e.code === 'ArrowRight') cycleCat(+1);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Hide hint after 5s
setTimeout(() => {
  const h = document.getElementById('hint');
  if (h) h.style.transition = 'opacity 0.5s'; h.style.opacity = '0';
}, 5000);

// ============ RENDER LOOP ============
function animate() {
  requestAnimationFrame(animate);

  // Smooth muscle lerp — if currentMuscle != targetMuscle, lerp & rebuild at thresholds
  const diff = targetMuscle - currentMuscle;
  if (Math.abs(diff) > 0.005) {
    currentMuscle += diff * 0.08;
    if (Math.abs(diff) < 0.02) currentMuscle = targetMuscle;
    rebuildCat(Math.abs(diff) > 0.04); // flash only on big jumps
  }

  controls.update();
  renderer.render(scene, camera);
}

// Init
rebuildCat();
updateHUD();
animate();

// Save periodically & on unload
setInterval(saveState, 10000);
window.addEventListener('pagehide', saveState);
window.addEventListener('beforeunload', saveState);
