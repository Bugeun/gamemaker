// ============================================================
// 냥냥 공장 — Cat Factory idle farm sim
// Inspired by reference screenshots: cute pixel-art cat-staffed
// dairy/produce factory with auto-production, tap-to-skip,
// daily quests, leveling, and a cozy beige aesthetic.
// ============================================================

const STORAGE_KEY = 'catfactory:v1';

const CHAT_LINES = [
  '야옹~', '냥냥~', '더 일하자냥!', '오늘도 화이팅~',
  '우유 짱이야!', '토마토 맛있어!', '사장님 화이팅!',
  '누가 두고 간 애들이야?!', '냥냥 공장 최고~',
  '일은 사랑이다 😺', '졸려요... 야옹...', '월급 언제 줘요냥?',
];

// Repeatable upgrades have price scaling. Each "action" mutates state.
const SHOP_ITEMS = () => ([
  { id: 'cow',        cat: 'build', name: '소 추가',          desc: '우유 생산 라인 +1',
    icon: '🐮', price: 220 + state.staff.cows * 180,
    action: () => state.staff.cows += 1 },
  { id: 'farm',       cat: 'staff', name: '농부 고양이 +1',    desc: '토마토 수확 속도↑',
    icon: '🐱', price: 250 + state.staff.farmCats * 200,
    action: () => state.staff.farmCats += 1 },
  { id: 'bottler',    cat: 'staff', name: '포장 고양이 +1',    desc: '병 포장 속도↑',
    icon: '🐈', price: 300 + state.staff.bottlerCats * 220,
    action: () => state.staff.bottlerCats += 1 },
  { id: 'cowSpd',     cat: 'shop',  name: '소 사료 강화',      desc: '우유 간격 -10%',
    icon: '🌾', price: state.upgrades.cowPrice,
    action: () => {
      state.intervals.cow = Math.max(2000, state.intervals.cow * 0.9);
      state.upgrades.cowPrice = Math.floor(state.upgrades.cowPrice * 1.5);
    } },
  { id: 'gardenSpd',  cat: 'shop',  name: '비료 강화',        desc: '토마토 간격 -10%',
    icon: '💧', price: state.upgrades.gardenPrice,
    action: () => {
      state.intervals.garden = Math.max(2500, state.intervals.garden * 0.9);
      state.upgrades.gardenPrice = Math.floor(state.upgrades.gardenPrice * 1.5);
    } },
  { id: 'bottlerSpd', cat: 'shop',  name: '포장기 업그레이드', desc: '포장 간격 -10%',
    icon: '⚙️', price: state.upgrades.bottlerPrice,
    action: () => {
      state.intervals.bottler = Math.max(1500, state.intervals.bottler * 0.9);
      state.upgrades.bottlerPrice = Math.floor(state.upgrades.bottlerPrice * 1.5);
    } },
]);

// ============ STATE ============
function defaultState() {
  return {
    level: 1,
    xp: 0,
    coins: 100,
    gems: 5,
    resources: { milk: 0, tomato: 0, bottledMilk: 0 },
    staff: { cows: 1, farmCats: 1, bottlerCats: 1 },
    intervals: { cow: 10000, garden: 15000, bottler: 8000 },
    upgrades: { cowPrice: 500, gardenPrice: 500, bottlerPrice: 500 },
    lastTick: { cow: Date.now(), garden: Date.now(), bottler: Date.now() },
    quests: [
      { id: 'milk20',   label: '우유 병 포장하기', goal: 20, key: 'bottledProduced', reward: { coins: 120, gems: 1, xp: 30 } },
      { id: 'tomato28', label: '토마토 수확하기',   goal: 28, key: 'tomatoProduced',  reward: { coins:  90, gems: 1, xp: 25 } },
      { id: 'sell15',   label: '우유 판매하기',     goal: 15, key: 'milkSold',         reward: { coins: 200, gems: 2, xp: 40 } },
    ],
    questProgress: { bottledProduced: 0, tomatoProduced: 0, milkSold: 0 },
    questsCompleted: [],
    questDay: new Date().toDateString(),
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (!s || !s.resources || !s.staff || !s.intervals) return defaultState();
    if (!s.upgrades) s.upgrades = { cowPrice: 500, gardenPrice: 500, bottlerPrice: 500 };
    return s;
  } catch (e) { return defaultState(); }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function maybeResetQuests() {
  const today = new Date().toDateString();
  if (state.questDay !== today) {
    state.questDay = today;
    state.questProgress = { bottledProduced: 0, tomatoProduced: 0, milkSold: 0 };
    state.questsCompleted = [];
  }
}

// ============ LEVEL ============
function xpForLevel(lv) { return Math.floor(50 * Math.pow(lv, 1.5)); }

function checkLevelUp() {
  let leveled = 0;
  while (state.xp >= xpForLevel(state.level)) {
    state.xp -= xpForLevel(state.level);
    state.level += 1;
    leveled += 1;
  }
  if (leveled > 0) {
    state.gems += leveled * 2;
    toast(`🎉 레벨업! Lv ${state.level} (+${leveled * 2} 💎)`);
    chatBubble('레벨업이다냥!!');
  }
}

// ============ PRODUCTION TICK ============
function tick(now) {
  // Cow → milk
  if (state.staff.cows > 0) {
    const interval = state.intervals.cow / state.staff.cows;
    if (now - state.lastTick.cow >= interval) {
      state.resources.milk += 1;
      state.lastTick.cow = now;
      floater('tile-cow', '+1 🥛');
    }
  }
  // Garden → tomato
  if (state.staff.farmCats > 0) {
    const interval = state.intervals.garden / state.staff.farmCats;
    if (now - state.lastTick.garden >= interval) {
      state.resources.tomato += 1;
      state.questProgress.tomatoProduced += 1;
      state.lastTick.garden = now;
      floater('tile-garden', '+1 🍅');
    }
  }
  // Bottler: milk → bottledMilk (needs milk in stock)
  if (state.staff.bottlerCats > 0) {
    if (state.resources.milk > 0) {
      const interval = state.intervals.bottler / state.staff.bottlerCats;
      if (now - state.lastTick.bottler >= interval) {
        state.resources.milk -= 1;
        state.resources.bottledMilk += 1;
        state.questProgress.bottledProduced += 1;
        state.lastTick.bottler = now;
        floater('tile-bottler', '+1 🍼');
      }
    } else {
      // No milk: keep timer fresh so bar shows 0%
      state.lastTick.bottler = now;
    }
  }
}

// ============ RENDER ============
const $ = (id) => document.getElementById(id);
const setText = (id, t) => { const el = $(id); if (el) el.textContent = t; };

function renderTopbar() {
  setText('lv', state.level);
  setText('coins', state.coins.toLocaleString('ko-KR'));
  setText('gems', state.gems);
  const need = xpForLevel(state.level);
  $('xp-fill').style.width = `${Math.min(100, (state.xp / need) * 100)}%`;
}

function renderTiles(now) {
  // Cow
  setText('cow-workers', state.staff.cows);
  setText('cow-stock', state.resources.milk);
  const cowInt = state.intervals.cow / Math.max(1, state.staff.cows);
  $('cow-bar').style.width = Math.min(100, ((now - state.lastTick.cow) / cowInt) * 100) + '%';
  $('cow-status').textContent = state.staff.cows > 0 ? '자동 생산 중' : '쉬는 중';

  // Garden
  setText('farm-workers', state.staff.farmCats);
  setText('garden-stock', state.resources.tomato);
  const gardenInt = state.intervals.garden / Math.max(1, state.staff.farmCats);
  $('garden-bar').style.width = Math.min(100, ((now - state.lastTick.garden) / gardenInt) * 100) + '%';
  $('garden-status').textContent = state.staff.farmCats > 0 ? '자동 물주기 중' : '쉬는 중';

  // Bottler
  setText('bottler-workers', state.staff.bottlerCats);
  setText('bottler-stock', state.resources.bottledMilk);
  if (state.resources.milk > 0 && state.staff.bottlerCats > 0) {
    const bInt = state.intervals.bottler / state.staff.bottlerCats;
    $('bottler-bar').style.width = Math.min(100, ((now - state.lastTick.bottler) / bInt) * 100) + '%';
    $('bottler-status').textContent = '자동 포장 중';
  } else {
    $('bottler-bar').style.width = '0%';
    $('bottler-status').textContent = state.staff.bottlerCats > 0 ? '우유 부족' : '쉬는 중';
  }

  // Sell button
  const total = state.resources.bottledMilk + state.resources.tomato;
  $('btn-sell').disabled = total === 0;
}

function renderQuestPip() {
  const done = state.questsCompleted.length;
  setText('quest-pip', `${done}/${state.quests.length}`);
}

function renderAll(now = Date.now()) {
  renderTopbar();
  renderTiles(now);
  renderQuestPip();
}

// ============ ACTIONS ============
function tapTile(stationId) {
  // Tap to skip 30% of progress on a station
  const SKIP = 0.30;
  if (stationId === 'cow') {
    state.lastTick.cow -= state.intervals.cow * SKIP;
    chatBubble('빨리 빨리!');
  } else if (stationId === 'garden') {
    state.lastTick.garden -= state.intervals.garden * SKIP;
    chatBubble('쑥쑥 자라라~');
  } else if (stationId === 'bottler') {
    state.lastTick.bottler -= state.intervals.bottler * SKIP;
    chatBubble('포장 빨리빨리!');
  }
}

function sell() {
  const milkPrice = 8 + Math.floor(state.level * 1.0);
  const tomatoPrice = 5 + Math.floor(state.level * 0.6);
  const earned = state.resources.bottledMilk * milkPrice + state.resources.tomato * tomatoPrice;
  if (earned === 0) { toast('판매할 게 없어요'); return; }
  const xpEarn = state.resources.bottledMilk * 4 + state.resources.tomato * 2;
  state.questProgress.milkSold += state.resources.bottledMilk;
  state.coins += earned;
  state.xp += xpEarn;
  state.resources.bottledMilk = 0;
  state.resources.tomato = 0;
  toast(`🪙 +${earned}  ⭐ +${xpEarn} XP`);
  floater('tile-shop', `+${earned} 🪙`);
  checkLevelUp();
  checkQuests();
  saveState();
}

function checkQuests() {
  state.quests.forEach(q => {
    if (state.questsCompleted.includes(q.id)) return;
    if ((state.questProgress[q.key] || 0) >= q.goal) {
      state.questsCompleted.push(q.id);
      state.coins += q.reward.coins;
      state.gems += q.reward.gems;
      state.xp += q.reward.xp;
      toast(`🎉 퀘스트 완료: ${q.label}`);
      chatBubble('퀘스트 완료냥!');
      checkLevelUp();
    }
  });
}

function buyShop(item) {
  if (state.coins < item.price) { toast('🪙 부족해요'); return; }
  state.coins -= item.price;
  item.action();
  toast(`✨ ${item.name} 완료!`);
  saveState();
  if ($('modal').open) {
    const cat = $('modal').dataset.kind;
    openModal(cat);
  }
}

// ============ MODAL ============
function openModal(kind) {
  const titles = {
    build: '🔨 건설',
    staff: '⚙️ 생산 직원',
    bag:   '🎒 가방',
    codex: '📖 도감',
    shop:  '🏪 상점',
    journal: '📓 일지'
  };
  $('modal-title').textContent = titles[kind] || '메뉴';
  $('modal').dataset.kind = kind;
  const body = $('modal-body');
  body.innerHTML = '';

  if (['build', 'staff', 'shop'].includes(kind)) {
    const items = SHOP_ITEMS().filter(it => kind === 'shop' ? true : it.cat === kind);
    if (items.length === 0) {
      body.innerHTML = '<p style="text-align:center;color:var(--dim)">아직 사용할 수 없어요</p>';
    }
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'shop-item';
      div.innerHTML = `
        <div class="sprite">${item.icon}</div>
        <div class="shop-item-info">
          <div class="shop-item-name">${item.name}</div>
          <div class="shop-item-desc">${item.desc}</div>
        </div>
        <button class="shop-buy" ${state.coins >= item.price ? '' : 'disabled'}>🪙 ${item.price}</button>
      `;
      div.querySelector('.shop-buy').addEventListener('click', () => buyShop(item));
      body.appendChild(div);
    });
  } else if (kind === 'bag') {
    const items = [
      { sprite: '🥛', name: '우유',     num: state.resources.milk },
      { sprite: '🍼', name: '병우유',   num: state.resources.bottledMilk },
      { sprite: '🍅', name: '토마토',   num: state.resources.tomato },
      { sprite: '🪙', name: '코인',     num: state.coins.toLocaleString('ko-KR') },
      { sprite: '💎', name: '젬',       num: state.gems },
      { sprite: '⭐', name: 'XP',        num: `${state.xp} / ${xpForLevel(state.level)}` },
    ];
    body.innerHTML = '<div class="bag-grid"></div>';
    const grid = body.querySelector('.bag-grid');
    items.forEach(it => {
      const d = document.createElement('div');
      d.className = 'bag-item';
      d.innerHTML = `<div class="sprite">${it.sprite}</div><div class="bag-num">${it.num}</div><div class="bag-name">${it.name}</div>`;
      grid.appendChild(d);
    });
  } else if (kind === 'codex') {
    body.innerHTML = `
      <div class="codex-text">
        <p><b>🐮 소</b> — 자동으로 우유를 만듭니다.</p>
        <p><b>🐱 농부 고양이</b> — 토마토를 수확합니다.</p>
        <p><b>🐈 포장 고양이</b> — 우유를 병에 담습니다.</p>
        <p><b>🍼 병우유</b> — 시장에 비싸게 팔립니다.</p>
        <p><b>🍅 토마토</b> — 신선할 때 팝니다.</p>
        <p><b>🪙 코인</b> — 직원·시설 구매에 씁니다.</p>
        <p><b>💎 젬</b> — 레벨업 보상으로 받습니다.</p>
      </div>
      <div class="codex-tip">💡 팁: 타일을 탭하면 30% 진행도가 즉시 채워집니다!</div>`;
  } else if (kind === 'journal') {
    state.quests.forEach(q => {
      const prog = Math.min(state.questProgress[q.key] || 0, q.goal);
      const done = state.questsCompleted.includes(q.id);
      const div = document.createElement('div');
      div.className = 'quest-mod' + (done ? ' done' : '');
      div.innerHTML = `
        <div class="quest-mod-row">
          <div class="quest-mod-name">${done ? '✅ ' : ''}${q.label}</div>
          <div class="quest-mod-prog">${prog}/${q.goal}</div>
        </div>
        <div class="quest-mod-bar"><div class="quest-mod-bar-fill" style="width:${(prog/q.goal*100).toFixed(0)}%"></div></div>
        <div class="quest-mod-reward">보상: 🪙 ${q.reward.coins} · 💎 ${q.reward.gems} · ⭐ ${q.reward.xp} XP</div>`;
      body.appendChild(div);
    });
    const note = document.createElement('p');
    note.style.cssText = 'text-align:center;color:var(--dim);font-size:11px;margin-top:8px';
    note.textContent = '※ 자정에 새 일지가 도착해요';
    body.appendChild(note);
  }
  $('modal').showModal();
}

// ============ EFFECTS ============
function floater(tileId, text) {
  const tile = $(tileId);
  const layer = $('floater-layer');
  if (!tile || !layer) return;
  const f = document.createElement('div');
  f.className = 'floater';
  f.textContent = text;
  const tRect = tile.getBoundingClientRect();
  const lRect = layer.getBoundingClientRect();
  f.style.left = (tRect.left + tRect.width / 2 - lRect.left) + 'px';
  f.style.top  = (tRect.top - lRect.top + 12) + 'px';
  layer.appendChild(f);
  setTimeout(() => f.remove(), 1100);
}

let _toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

let _bubbleTimer;
function chatBubble(msg) {
  const b = $('chat-bubble');
  b.textContent = msg;
  b.classList.add('show');
  clearTimeout(_bubbleTimer);
  _bubbleTimer = setTimeout(() => b.classList.remove('show'), 2400);
}

function randomChat() {
  if (Math.random() < 0.45) {
    chatBubble(CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)]);
  }
}

// ============ EVENTS ============
['cow', 'garden', 'bottler'].forEach(s => {
  $(`tile-${s}`).addEventListener('click', () => tapTile(s));
});
$('btn-sell').addEventListener('click', (e) => { e.stopPropagation(); sell(); });
$('tile-shop').addEventListener('click', sell);
document.querySelectorAll('.nav-btn').forEach(b => {
  b.addEventListener('click', () => openModal(b.dataset.modal));
});
$('modal-close').addEventListener('click', () => $('modal').close());
$('modal').addEventListener('click', (e) => {
  if (e.target === $('modal')) $('modal').close(); // click on backdrop
});

// ============ MAIN LOOP ============
maybeResetQuests();
renderAll();

setInterval(() => {
  const now = Date.now();
  tick(now);
  renderAll(now);
}, 250);

setInterval(() => { saveState(); }, 5000);
setInterval(randomChat, 9000);
setTimeout(() => chatBubble('환영해냥! 타일 탭으로 빠르게 일해봐요~'), 600);

window.addEventListener('pagehide', saveState);
window.addEventListener('beforeunload', saveState);
