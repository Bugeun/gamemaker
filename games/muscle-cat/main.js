// ============ CONFIG ============
const STORAGE_KEY = 'mcg:v1';
const SPAWN_COST = 50;
const FEED_COST = 3;
const FEED_XP = 8;
const TRAIN_XP = 2;
const COIN_PER_SEC = 0.2;           // per cat
const OFFLINE_CAP_SEC = 60 * 15;    // 15 min

// ============ SPECIES POOL ============
const SPECIES = [
  { id: 0, name: '치즈',   color: '#f4a64a', accent: '#c36f1f', belly: '#ffd9a8' },
  { id: 1, name: '까망',   color: '#2b2b33', accent: '#59595f', belly: '#4a4a55' },
  { id: 2, name: '하양',   color: '#f0ece6', accent: '#c9c3b8', belly: '#ffffff' },
  { id: 3, name: '회색',   color: '#8a8f98', accent: '#5c6069', belly: '#b5b9c0' },
  { id: 4, name: '스모크', color: '#5f7f9c', accent: '#3d556f', belly: '#93adc3' },
  { id: 5, name: '삼색',   color: '#ead2a8', accent: '#8c6038', belly: '#fff4df' },
];

const NAMES = [
  '나비','치즈','까망','오레오','모찌','보리','두부','호빵','감자','쿠키',
  '크림','레오','단비','콩이','별이','루이','망고','참치','토리','쏘세지',
];

// ============ LEVEL / STAGE / XP ============
function muscleForLevel(lv) {
  return Math.min(1, Math.max(0, (lv - 1) / 15));
}
function stageForLevel(lv) {
  if (lv >= 16) return { name: '머슬몬스터', emoji: '💥' };
  if (lv >= 12) return { name: '헬창',       emoji: '🏋️' };
  if (lv >= 8)  return { name: '근육',       emoji: '💪' };
  if (lv >= 5)  return { name: '청년',       emoji: '😼' };
  if (lv >= 3)  return { name: '꼬마',       emoji: '😺' };
  return         { name: '새끼',             emoji: '🐱' };
}
function xpRequired(lv) {
  return 4 + Math.floor(lv * 2.5);
}

// ============ SVG CAT RENDERER ============
function renderCat({ species, level }) {
  const m = muscleForLevel(level);
  const { color, accent, belly } = species;

  // Layout constants
  const cx = 200;
  const shoulderY = 225;
  const hipY = 315;
  const shoulderHalf = 55 + m * 65;
  const waistHalf = 50 + m * 8;
  const hipHalf = 60 + m * 5;
  const bodyMidY = (shoulderY + hipY) / 2;

  // Torso: V-taper path
  const torso = `M ${cx - shoulderHalf} ${shoulderY} `
    + `Q ${cx - waistHalf - 4} ${bodyMidY} ${cx - hipHalf} ${hipY} `
    + `Q ${cx} ${hipY + 10} ${cx + hipHalf} ${hipY} `
    + `Q ${cx + waistHalf + 4} ${bodyMidY} ${cx + shoulderHalf} ${shoulderY} `
    + `Q ${cx} ${shoulderY - 16} ${cx - shoulderHalf} ${shoulderY} Z`;

  // Arms
  const armW = 16 + m * 30;
  const armLen = 75 + m * 30;
  const armCX_L = cx - shoulderHalf + armW * 0.25;
  const armCX_R = cx + shoulderHalf - armW * 0.25;
  const armCY = shoulderY + armLen * 0.5;
  const armAngle = 4 + m * 4;
  const showBicep = m > 0.25;
  const bicepR = 8 + m * 14;
  const showVeins = m > 0.75;

  // Legs
  const legY = hipY + 14;
  const legRX = 16;
  const legRY = 18;
  const legLeftX = cx - hipHalf + 8;
  const legRightX = cx + hipHalf - 8;

  // Tail
  const tailTipY = hipY - 80 - m * 25;
  const tailTipX = cx + hipHalf + 60;

  // Head
  const headCY = 140 - m * 8;
  const headCX = cx;
  const headRX = 60;
  const headRY = 55;

  // Eyes
  const pupilW = 3 + m * 1.5;
  const pupilH = 9 - m * 3;
  const eyeY = headCY;
  const eyeLeftX = headCX - 19;
  const eyeRightX = headCX + 19;
  const browThick = m > 0.4;

  // Mouth: ω shape with philtrum line. Smirk at high muscle.
  const smirk = m > 0.5;
  const mouthPath = smirk
    ? `M ${headCX - 9} ${headCY + 20} Q ${headCX + 2} ${headCY + 22} ${headCX + 10} ${headCY + 14} M ${headCX} ${headCY + 10} L ${headCX} ${headCY + 18}`
    : `M ${headCX - 7} ${headCY + 18} Q ${headCX} ${headCY + 22} ${headCX + 7} ${headCY + 18} M ${headCX} ${headCY + 10} L ${headCX} ${headCY + 18}`;

  return `
  <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <!-- Tail -->
    <path d="M ${cx + hipHalf - 4} ${hipY - 4} Q ${cx + hipHalf + 40} ${hipY - 30} ${tailTipX} ${tailTipY}"
      stroke="${color}" stroke-width="${14 + m * 8}" stroke-linecap="round" fill="none"/>
    <path d="M ${cx + hipHalf - 4} ${hipY - 4} Q ${cx + hipHalf + 40} ${hipY - 30} ${tailTipX} ${tailTipY}"
      stroke="${accent}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.35"/>

    <!-- Back legs -->
    <ellipse cx="${legLeftX}" cy="${legY}" rx="${legRX}" ry="${legRY}" fill="${color}"/>
    <ellipse cx="${legRightX}" cy="${legY}" rx="${legRX}" ry="${legRY}" fill="${color}"/>
    <ellipse cx="${legLeftX}" cy="${legY + legRY + 2}" rx="${legRX + 2}" ry="6" fill="${color}"/>
    <ellipse cx="${legRightX}" cy="${legY + legRY + 2}" rx="${legRX + 2}" ry="6" fill="${color}"/>

    <!-- Torso -->
    <path d="${torso}" fill="${color}"/>

    <!-- Belly -->
    <ellipse cx="${cx}" cy="${bodyMidY + 10}" rx="${30 + m * 8}" ry="${38 + m * 6}" fill="${belly}" opacity="0.65"/>

    ${m > 0.25 ? `
    <line x1="${cx}" y1="${shoulderY + 4}" x2="${cx}" y2="${shoulderY + 28 + m * 10}"
      stroke="${accent}" stroke-width="${1.5 + m * 1.5}" stroke-linecap="round" opacity="0.55"/>
    ` : ''}

    ${m > 0.55 ? `
    <line x1="${cx}" y1="${shoulderY + 40}" x2="${cx}" y2="${shoulderY + 80}" stroke="${accent}" stroke-width="1.3" opacity="0.45"/>
    <line x1="${cx - 12}" y1="${shoulderY + 50}" x2="${cx + 12}" y2="${shoulderY + 50}" stroke="${accent}" stroke-width="1" opacity="0.4"/>
    <line x1="${cx - 12}" y1="${shoulderY + 66}" x2="${cx + 12}" y2="${shoulderY + 66}" stroke="${accent}" stroke-width="1" opacity="0.4"/>
    ` : ''}

    <!-- Left arm -->
    <g transform="rotate(${armAngle} ${armCX_L} ${shoulderY})">
      <ellipse cx="${armCX_L}" cy="${armCY}" rx="${armW}" ry="${armLen * 0.5}" fill="${color}"/>
      ${showBicep ? `<ellipse cx="${armCX_L - armW * 0.3}" cy="${armCY - armLen * 0.2}" rx="${bicepR}" ry="${bicepR * 0.7}" fill="${accent}" opacity="0.4"/>` : ''}
      <ellipse cx="${armCX_L}" cy="${armCY + armLen * 0.5 + 4}" rx="${armW * 0.85}" ry="${12 + m * 4}" fill="${color}"/>
      ${showVeins ? `<path d="M ${armCX_L - armW * 0.4} ${armCY - 10} Q ${armCX_L - armW * 0.25} ${armCY + 4} ${armCX_L - armW * 0.35} ${armCY + 16}" stroke="${accent}" stroke-width="1.2" fill="none" opacity="0.55"/>` : ''}
    </g>

    <!-- Right arm -->
    <g transform="rotate(${-armAngle} ${armCX_R} ${shoulderY})">
      <ellipse cx="${armCX_R}" cy="${armCY}" rx="${armW}" ry="${armLen * 0.5}" fill="${color}"/>
      ${showBicep ? `<ellipse cx="${armCX_R + armW * 0.3}" cy="${armCY - armLen * 0.2}" rx="${bicepR}" ry="${bicepR * 0.7}" fill="${accent}" opacity="0.4"/>` : ''}
      <ellipse cx="${armCX_R}" cy="${armCY + armLen * 0.5 + 4}" rx="${armW * 0.85}" ry="${12 + m * 4}" fill="${color}"/>
      ${showVeins ? `<path d="M ${armCX_R + armW * 0.4} ${armCY - 10} Q ${armCX_R + armW * 0.25} ${armCY + 4} ${armCX_R + armW * 0.35} ${armCY + 16}" stroke="${accent}" stroke-width="1.2" fill="none" opacity="0.55"/>` : ''}
    </g>

    <!-- Head -->
    <ellipse cx="${headCX}" cy="${headCY}" rx="${headRX}" ry="${headRY}" fill="${color}"/>

    <!-- Ears -->
    <polygon points="${headCX - 42},${headCY - 44} ${headCX - 20},${headCY - 66} ${headCX - 12},${headCY - 38}" fill="${color}"/>
    <polygon points="${headCX + 42},${headCY - 44} ${headCX + 20},${headCY - 66} ${headCX + 12},${headCY - 38}" fill="${color}"/>
    <polygon points="${headCX - 34},${headCY - 46} ${headCX - 22},${headCY - 58} ${headCX - 18},${headCY - 42}" fill="${accent}" opacity="0.7"/>
    <polygon points="${headCX + 34},${headCY - 46} ${headCX + 22},${headCY - 58} ${headCX + 18},${headCY - 42}" fill="${accent}" opacity="0.7"/>

    <!-- Cheeks -->
    <ellipse cx="${headCX - 30}" cy="${headCY + 12}" rx="9" ry="5" fill="#ff7aa8" opacity="0.28"/>
    <ellipse cx="${headCX + 30}" cy="${headCY + 12}" rx="9" ry="5" fill="#ff7aa8" opacity="0.28"/>

    ${browThick ? `
    <path d="M ${eyeLeftX - 10} ${eyeY - 16} L ${eyeLeftX + 8} ${eyeY - 9}" stroke="#0a0a0f" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M ${eyeRightX + 10} ${eyeY - 16} L ${eyeRightX - 8} ${eyeY - 9}" stroke="#0a0a0f" stroke-width="3.5" stroke-linecap="round"/>
    ` : ''}

    <!-- Eyes -->
    <ellipse cx="${eyeLeftX}" cy="${eyeY}" rx="${pupilW}" ry="${pupilH}" fill="#0a0a0f"/>
    <ellipse cx="${eyeRightX}" cy="${eyeY}" rx="${pupilW}" ry="${pupilH}" fill="#0a0a0f"/>
    <circle cx="${eyeLeftX + 1}" cy="${eyeY - pupilH * 0.4}" r="1.3" fill="#fff"/>
    <circle cx="${eyeRightX + 1}" cy="${eyeY - pupilH * 0.4}" r="1.3" fill="#fff"/>

    <!-- Nose -->
    <path d="M ${headCX - 5} ${headCY + 10} L ${headCX + 5} ${headCY + 10} L ${headCX} ${headCY + 15} Z" fill="#ff7aa8"/>

    <!-- Mouth -->
    <path d="${mouthPath}" stroke="#0a0a0f" stroke-width="2" fill="none" stroke-linecap="round"/>

    <!-- Whiskers -->
    <line x1="${headCX - 28}" y1="${headCY + 16}" x2="${headCX - 55}" y2="${headCY + 12}" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
    <line x1="${headCX - 28}" y1="${headCY + 22}" x2="${headCX - 54}" y2="${headCY + 24}" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
    <line x1="${headCX + 28}" y1="${headCY + 16}" x2="${headCX + 55}" y2="${headCY + 12}" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
    <line x1="${headCX + 28}" y1="${headCY + 22}" x2="${headCX + 54}" y2="${headCY + 24}" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
  </svg>`;
}

// ============ STATE ============
let state = null;

function randomSpecies() { return SPECIES[Math.floor(Math.random() * SPECIES.length)]; }
function randomName()    { return NAMES[Math.floor(Math.random() * NAMES.length)]; }
function makeCat(species) {
  return {
    id: 'c' + Math.random().toString(36).slice(2, 10),
    speciesId: species.id,
    name: randomName(),
    level: 1,
    xp: 0,
  };
}

function defaultState() {
  const first = makeCat(randomSpecies());
  return {
    coins: 10,
    cats: [first],
    activeCatId: first.id,
    lastTick: Date.now(),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed?.cats?.length) return defaultState();
    if (!parsed.cats.find(c => c.id === parsed.activeCatId)) {
      parsed.activeCatId = parsed.cats[0].id;
    }
    return parsed;
  } catch (e) {
    console.warn('Load failed, using default', e);
    return defaultState();
  }
}

function saveState() {
  state.lastTick = Date.now();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

function applyOfflineProgress() {
  const elapsed = Math.min(OFFLINE_CAP_SEC, (Date.now() - state.lastTick) / 1000);
  if (elapsed < 5) return 0;
  const earned = Math.floor(elapsed * COIN_PER_SEC * state.cats.length);
  if (earned > 0) state.coins += earned;
  return earned;
}

function activeCat() { return state.cats.find(c => c.id === state.activeCatId) || state.cats[0]; }
function speciesOf(cat) { return SPECIES[cat.speciesId] || SPECIES[0]; }

// ============ ACTIONS ============
function addXp(cat, amount) {
  let leveled = 0;
  cat.xp += amount;
  while (cat.xp >= xpRequired(cat.level)) {
    cat.xp -= xpRequired(cat.level);
    cat.level += 1;
    leveled += 1;
  }
  return leveled;
}

function train() {
  const cat = activeCat();
  const gained = addXp(cat, TRAIN_XP);
  bumpCat();
  renderAll();
  if (gained > 0) onLevelUp(cat, gained);
  saveState();
}

function feed() {
  if (state.coins < FEED_COST) { toast('🪙 코인 부족'); return; }
  state.coins -= FEED_COST;
  const cat = activeCat();
  const gained = addXp(cat, FEED_XP);
  bumpCat();
  renderAll();
  if (gained > 0) onLevelUp(cat, gained);
  saveState();
}

function summon() {
  if (state.coins < SPAWN_COST) { toast('🪙 코인 부족'); return; }
  state.coins -= SPAWN_COST;
  const sp = randomSpecies();
  const cat = makeCat(sp);
  state.cats.push(cat);
  state.activeCatId = cat.id;
  renderAll();
  toast(`✨ ${cat.name} (${sp.name}) 소환!`);
  saveState();
}

function setActive(catId) {
  state.activeCatId = catId;
  renderAll();
  saveState();
}

function resetAll() {
  if (!confirm('모든 데이터를 초기화할까요?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  renderAll();
  saveState();
  toast('초기화 완료');
}

function onLevelUp(cat, count) {
  const stage = stageForLevel(cat.level);
  toast(`🎉 Lv.${cat.level} · ${stage.emoji} ${stage.name}`);
  const wrap = document.getElementById('cat-wrap');
  wrap.classList.add('level-up');
  setTimeout(() => wrap.classList.remove('level-up'), 750);
}

// ============ RENDER ============
function bumpCat() {
  const wrap = document.getElementById('cat-wrap');
  wrap.classList.remove('train-anim');
  void wrap.offsetWidth;
  wrap.classList.add('train-anim');
}

function renderAll() {
  const cat = activeCat();
  const sp = speciesOf(cat);
  const stage = stageForLevel(cat.level);
  const xpNeed = xpRequired(cat.level);

  document.getElementById('stat-coins').textContent = state.coins;
  document.getElementById('stat-cats').textContent = state.cats.length;
  document.getElementById('cat-name').textContent = `${cat.name} · ${sp.name}`;
  document.getElementById('cat-stage').textContent = `${stage.emoji} ${stage.name}`;
  document.getElementById('cat-level').textContent = cat.level;
  document.getElementById('xp-fill').style.width = `${Math.min(100, (cat.xp / xpNeed) * 100)}%`;
  document.getElementById('xp-text').textContent = `${cat.xp} / ${xpNeed} XP`;
  document.getElementById('cat-svg').innerHTML = renderCat({ species: sp, level: cat.level });

  document.getElementById('btn-feed').disabled = state.coins < FEED_COST;
  document.getElementById('btn-summon').disabled = state.coins < SPAWN_COST;

  const grid = document.getElementById('collection-grid');
  document.getElementById('collection-count').textContent = state.cats.length;
  grid.innerHTML = state.cats.map(c => {
    const csp = speciesOf(c);
    return `<div class="slot ${c.id === state.activeCatId ? 'active' : ''}" data-cat-id="${c.id}">
      <div class="slot-level">Lv ${c.level}</div>
      <div class="slot-cat">${renderCat({ species: csp, level: c.level })}</div>
      <div class="slot-name">${c.name}</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.slot').forEach(el => {
    el.addEventListener('click', () => setActive(el.dataset.catId));
  });
}

let _toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ============ PASSIVE INCOME LOOP ============
let tickAccum = 0;
let lastFrame = 0;
function loop(now) {
  if (!lastFrame) lastFrame = now;
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  tickAccum += dt * COIN_PER_SEC * state.cats.length;
  if (tickAccum >= 1) {
    const gained = Math.floor(tickAccum);
    state.coins += gained;
    tickAccum -= gained;
    document.getElementById('stat-coins').textContent = state.coins;
    const feedBtn = document.getElementById('btn-feed');
    const summonBtn = document.getElementById('btn-summon');
    if (feedBtn.disabled && state.coins >= FEED_COST) feedBtn.disabled = false;
    if (summonBtn.disabled && state.coins >= SPAWN_COST) summonBtn.disabled = false;
  }
  requestAnimationFrame(loop);
}

// ============ INIT ============
function init() {
  state = loadState();
  const earned = applyOfflineProgress();
  renderAll();
  saveState();
  if (earned > 0) setTimeout(() => toast(`🪙 오프라인 수익 +${earned}`), 600);

  document.getElementById('btn-train').addEventListener('click', train);
  document.getElementById('btn-feed').addEventListener('click', feed);
  document.getElementById('btn-summon').addEventListener('click', summon);
  document.getElementById('btn-reset').addEventListener('click', resetAll);

  // Keyboard: Space = train
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); train(); }
  });

  requestAnimationFrame(loop);
  setInterval(saveState, 10000);
  window.addEventListener('pagehide', saveState);
  window.addEventListener('beforeunload', saveState);
}

init();
