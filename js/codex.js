// ============================================================
// codex.js — 도감(기본 목록 UI)
// 가로 탭([장비] [몬스터]) + 장비 등급 필터(체크박스) + 검색 + 장비 세로 탭(즐겨찾기 포함) + 5×8 아이템 그리드.
// 아이콘 클릭 메뉴(정보 / 즐겨찾기), 아이템 세부 정보(강화 단계별 + 내 인벤토리 장비와 비교)까지.
// 획득처/획득·미획득 표시 등은 아직 없음(이후 단계).
// UI는 신버전(박스) 인벤토리의 탭/슬롯/툴팁 스타일(.inv-box-*)을 그대로 재사용하고,
// 아이템 목록은 실제 장비 데이터(WEAPON_TYPES / ARMOR_TYPES / SUB_TYPES / ACCESSORY_TYPES)에서 자동으로 만든다.
// ============================================================

// ---- 가로 탭(확장 가능) ----
// panelId: 해당 탭을 선택했을 때 보이는 패널 DOM id. 탭을 추가하려면 항목 + 패널 DOM만 추가하면 됨.
const CODEX_TABS = [
  { id: 'equipment', label: '장비', panelId: 'codexPanelEquipment' },
  { id: 'monster',   label: '몬스터', panelId: 'codexPanelMonster' }, // 이번 단계: 자리만 있고 기능은 이후 단계
];

// ---- 장비 그리드 규격 ----
const CODEX_COLUMNS = 5;
const CODEX_ROWS = 8;
const CODEX_MIN_SLOTS = CODEX_COLUMNS * CODEX_ROWS; // 아이템이 적어도 빈 칸으로 40칸을 채워 그리드 영역 높이를 유지함

// ---- 장비 세로 탭 ----
// 표시 순서. id는 `장비종류[:세부종류]` 형태(무기/보조는 종류 전체, 방어구/장신구는 세부 종류별).
// 데이터에는 있는데 여기에 없는 새 세부 종류(예: 팔찌)는 아래 codexCategories()가 목록 맨 아래에 자동으로 추가함.
const CODEX_EQUIP_CATEGORIES = [
  { id: 'weapon',            label: '무기' },
  { id: 'armor:helmet',      label: '투구' },
  { id: 'armor:armor',       label: '갑옷' },
  { id: 'armor:shoes',       label: '신발' },
  { id: 'sub',               label: '보조' },
  { id: 'accessory:necklace', label: '목걸이' },
  { id: 'accessory:ring',    label: '반지' },
];

// 장비 데이터 소스 → 세로 탭 id 결정 규칙. 새 장비 종류 테이블이 생기면 여기에 한 줄만 추가하면 됨.
const CODEX_EQUIP_SOURCES = [
  { src: 'weapon',    table: () => WEAPON_TYPES,    categoryOf: () => 'weapon' },
  { src: 'armor',     table: () => ARMOR_TYPES,     categoryOf: def => 'armor:' + def.armorKind,         kindLabels: () => ARMOR_KINDS },
  { src: 'sub',       table: () => SUB_TYPES,       categoryOf: () => 'sub' },
  { src: 'accessory', table: () => ACCESSORY_TYPES, categoryOf: def => 'accessory:' + def.accessoryKind, kindLabels: () => ACCESSORY_KINDS },
];

const CODEX_SEARCH_MAX_RESULTS = 60;

// ---- 즐겨찾기 ----
// 즐겨찾기 탭은 항상 세로 탭 맨 위에 고정(실제 장비 분류가 아니라 '즐겨찾기한 아이템 모음' 보기).
// 즐겨찾기 상태는 기존 게임 저장 데이터(state.codexFavorites = 엔트리 key 목록)에 들어가며 saveState()로 저장됨.
const CODEX_FAVORITES_ID = 'favorites';
const CODEX_FAVORITES_LABEL = '즐겨찾기';
const CODEX_FAVORITE_IMG = 'assets/ui/icon_favorite.png';

// ---- 아이템 세부 정보 ----
// 강화 단계 선택이 가능한 장비 종류(인벤토리 액션에서 '강화 선택'이 있는 종류와 동일: 무기/방어구/장신구, 보조는 강화 불가).
// 선택 가능 범위는 0 ~ MAX_LEVEL(실제 강화 최대 단계, data.js).
const CODEX_ENHANCEABLE_SRCS = ['weapon', 'armor', 'accessory'];

// ---- 화면 상태(저장하지 않음) ----
// grades: 등급 id → 체크 여부(WEAPON_GRADES 기준으로 자동 구성, 기본은 전부 체크).
let codexUI = { tab: 'equipment', cat: null, grades: {}, query: '', focusKey: null, tipKey: null, popupKey: null };
// 아이템 세부 정보 화면 상태(저장하지 않음). key: 도감 엔트리 key / levelA: 왼쪽(도감 아이템) 강화 단계 /
// targetKey: 오른쪽 비교 대상(내 인벤토리 장비의 key, 없으면 빈 상태) / levelB: 오른쪽 강화 단계 / picking: 비교 대상 선택 중
let codexInfo = { key: null, levelA: 0, targetKey: null, levelB: 0, picking: false };
let codexEntries = [];      // 현재 데이터 기준 장비 엔트리(도감 화면에 들어올 때마다 새로 만듦)
let codexEntryByKey = {};

function codexEsc(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 즐겨찾기 탭 정렬 = 위 규칙의 역순: 착용 레벨 내림차순 → 등급 내림차순(유니크 → … → 일반) → 이름 가나다순(이름은 역순이 아님).
function codexCompareFavorites(a, b){
  if(a.levelReq !== b.levelReq) return b.levelReq - a.levelReq;
  if(a.gradeRank !== b.gradeRank) return b.gradeRank - a.gradeRank;
  return a.name.localeCompare(b.name, 'ko');
}

// ---- 즐겨찾기 상태(저장 데이터) ----
function codexFavList(){
  if(!Array.isArray(state.codexFavorites)) state.codexFavorites = [];
  return state.codexFavorites;
}
function codexIsFavorite(key){ return codexFavList().includes(key); }
function codexToggleFavorite(key){
  const list = codexFavList();
  const i = list.indexOf(key);
  if(i >= 0) list.splice(i, 1); else list.push(key); // 해제하면 저장 데이터에서도 바로 제거됨
  saveState();
}

// ---- 데이터 → 엔트리 ----
// 실제 장비 데이터의 모든 아이템을 강화 0단계 기준으로 표시(아이콘/등급색/툴팁은 인벤토리와 같은 equipInstanceDisplayInfo 사용).
function codexBuildEntries(){
  const out = [];
  CODEX_EQUIP_SOURCES.forEach(source => {
    const table = source.table() || {};
    Object.keys(table).forEach(type => {
      const def = table[type];
      if(!def) return;
      const info = equipInstanceDisplayInfo({ level: 0 }, type);
      const grade = def.grade || 'normal';
      out.push({
        key: source.src + ':' + type, src: source.src, type, def,
        name: def.name || type, grade,
        cat: source.categoryOf(def),
        levelReq: def.levelReq || 0, gradeRank: WEAPON_GRADE_RANK[grade] ?? Object.keys(WEAPON_GRADES).length,
        iconHtml: info.iconHtml, tooltipHtml: info.tooltipHtml, color: info.color,
      });
    });
  });
  return out.sort(codexCompare); // 세로 탭 목록과 검색 결과 모두 같은 정렬 규칙(아래 codexCompare)을 따름
}

// ---- 정렬 규칙(세로 탭별 목록 + 검색 결과 공통) ----
// 우선순위: ① 착용 레벨 제한 오름차순(낮은 레벨 → 위) ② 등급 오름차순(일반 → 레어 → 에픽 → 유니크, WEAPON_GRADES 순서)
// ③ 이름 가나다순(같은 착용 레벨 + 같은 등급일 때). 그래도 같으면 데이터에 등록된 순서를 유지함(Array.sort는 안정 정렬).
function codexCompare(a, b){
  if(a.levelReq !== b.levelReq) return a.levelReq - b.levelReq;
  if(a.gradeRank !== b.gradeRank) return a.gradeRank - b.gradeRank;
  return a.name.localeCompare(b.name, 'ko');
}

// 세로 탭 목록: 정해진 순서 + 데이터에만 있는 새 종류(목록 맨 아래에 자동 추가).
function codexCategories(){
  const list = [{ id: CODEX_FAVORITES_ID, label: CODEX_FAVORITES_LABEL }]; // 즐겨찾기: 항상 최상단 고정
  CODEX_EQUIP_CATEGORIES.forEach(c => list.push({ id: c.id, label: c.label }));
  const known = new Set(list.map(c => c.id));
  CODEX_EQUIP_SOURCES.forEach(source => {
    codexEntries.filter(e => e.src === source.src).forEach(e => {
      if(known.has(e.cat)) return;
      known.add(e.cat);
      const kind = e.cat.split(':')[1];
      const labels = source.kindLabels ? source.kindLabels() : null;
      list.push({ id: e.cat, label: (labels && labels[kind]) || kind || e.cat });
    });
  });
  return list;
}
function codexCategoryLabel(catId){
  const c = codexCategories().find(x => x.id === catId);
  return c ? c.label : catId;
}

function codexGradeIds(){ return Object.keys(WEAPON_GRADES); }
function codexGradeOn(grade){ return codexUI.grades[grade] !== false; }

// ---- 필터 ----
function codexMatchesQuery(entry, q){
  return !q || entry.name.toLowerCase().includes(q);
}
function codexNormQuery(){ return codexUI.query.trim().toLowerCase(); }
// 현재 목록 = 선택한 세로 탭 + 체크된 등급 + (검색어가 있으면) 이름 일치.
// 즐겨찾기 탭은 종류와 상관없이 즐겨찾기한 아이템만(역순 정렬), 아이템은 원래 종류 탭에도 그대로 표시됨.
function codexFilteredEntries(){
  const q = codexNormQuery();
  const favTab = codexUI.cat === CODEX_FAVORITES_ID;
  const list = codexEntries.filter(e => (favTab ? codexIsFavorite(e.key) : e.cat === codexUI.cat) && codexGradeOn(e.grade) && codexMatchesQuery(e, q));
  return favTab ? list.sort(codexCompareFavorites) : list;
}
// 검색 결과 목록 = 등록된 전체 장비(세로 탭/등급 체크와 무관).
function codexSearchResults(){
  const q = codexNormQuery();
  if(!q) return [];
  return codexEntries.filter(e => codexMatchesQuery(e, q));
}

// 검색어와 일치하는 부분을 노란색으로 강조한 이름 HTML.
function codexHighlightHtml(name, query){ // query를 생략하면 장비 도감 검색어(몬스터 도감은 자기 검색어를 넘김)
  const q = (query != null ? query : codexUI.query).trim();
  if(!q) return codexEsc(name);
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return name.split(re).map((part, i) => i % 2 === 1 ? `<span class="codex-hl">${codexEsc(part)}</span>` : codexEsc(part)).join('');
}

// ---- 렌더 ----
function codexRenderTabs(){
  el('codexTabs').innerHTML = CODEX_TABS.map(t =>
    `<button class="inv-box-tab ${t.id === codexUI.tab ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('');
  CODEX_TABS.forEach(t => { const p = el(t.panelId); if(p) p.style.display = t.id === codexUI.tab ? '' : 'none'; });
}
function codexRenderVTabs(){
  el('codexVTabs').innerHTML = codexCategories().map((c, i) => {
    const cls = (c.id === codexUI.cat ? ' active' : '') + (c.id === CODEX_FAVORITES_ID ? ' codex-vtab-fav' : '') + (i === 1 ? ' codex-vtab-after-fav' : '');
    return `<button class="codex-vtab${cls}" data-cat="${c.id}">${c.label}</button>`;
  }).join('');
}
// 등급 체크박스는 WEAPON_GRADES 기준으로 한 번에 구성(등급이 추가되면 자동으로 늘어남).
function codexRenderGradeChecks(){
  el('codexChecks').innerHTML = codexGradeIds().map(g =>
    `<label class="codex-check" style="--codex-grade-color:${WEAPON_GRADES[g].color};">`
    + `<input type="checkbox" data-grade="${g}" ${codexGradeOn(g) ? 'checked' : ''}>`
    + `<span class="codex-checkbox"></span><span class="codex-check-label">${WEAPON_GRADES[g].label}</span></label>`).join('');
}
function codexFavMarkHtml(key){
  return codexIsFavorite(key) ? `<img class="codex-fav-mark" src="${CODEX_FAVORITE_IMG}" alt="" draggable="false">` : '';
}
function codexRenderGrid(scrollToKey, keepScroll){
  const list = codexFilteredEntries();
  const total = Math.max(CODEX_MIN_SLOTS, Math.ceil(list.length / CODEX_COLUMNS) * CODEX_COLUMNS);
  let cells = '';
  for(let i = 0; i < total; i++){
    if(i < list.length){
      const e = list[i];
      cells += `<div class="inv-box-slot filled codex-slot${e.key === codexUI.focusKey ? ' flash' : ''}" data-key="${e.key}" style="border-color:${e.color};">${e.iconHtml}${codexFavMarkHtml(e.key)}</div>`;
    } else {
      cells += '<div class="inv-box-slot empty"></div>';
    }
  }
  const scroller = el('codexGridScroll');
  const prevScroll = scroller.scrollTop;
  el('codexGrid').innerHTML = cells;
  codexSyncGridHeight();
  if(keepScroll){
    scroller.scrollTop = prevScroll;
  } else if(scrollToKey){
    const slot = el('codexGrid').querySelector(`[data-key="${scrollToKey}"]`);
    if(slot) scroller.scrollTop = Math.max(0, slot.offsetTop - 4);
  } else {
    scroller.scrollTop = 0;
  }
}
// 그리드 영역 높이 = 항상 8줄이 들어가는 높이로 고정(결과가 적어도 줄이지 않고, 40개를 넘으면 이 안에서 스크롤).
// 슬롯은 칸 폭에 맞춰 정사각형으로 줄어들 수 있으므로 실제 슬롯 높이를 측정해서 계산함.
function codexSyncGridHeight(){
  const grid = el('codexGrid');
  const slot = grid.querySelector('.inv-box-slot');
  const cs = getComputedStyle(grid);
  const gap = parseFloat(cs.rowGap) || 4;
  const padTop = parseFloat(cs.paddingTop) || 0, padBottom = parseFloat(cs.paddingBottom) || 0;
  const h = (slot && slot.getBoundingClientRect().height) || 42;
  const total = Math.round(CODEX_ROWS * h + (CODEX_ROWS - 1) * gap + padTop + padBottom);
  el('codexGridScroll').style.height = total + 'px';
  el('codexVTabs').style.maxHeight = total + 'px';
  el('codexWrap').style.setProperty('--codex-grid-h', total + 'px'); // 세부 정보/비교 대상 선택 화면도 같은 높이(인벤토리 비교 화면이 그리드 영역을 덮는 것과 동일)
}
function codexRenderResults(){
  const box = el('codexResults');
  const q = codexNormQuery();
  if(!q || !codexUI.resultsOpen){ box.style.display = 'none'; return; }
  const results = codexSearchResults();
  if(results.length === 0){
    box.innerHTML = '<div class="codex-result-empty">검색 결과가 없습니다.</div>';
  } else {
    box.innerHTML = results.slice(0, CODEX_SEARCH_MAX_RESULTS).map(e =>
      `<button class="codex-result" data-key="${e.key}"><span style="color:${e.color};">${codexHighlightHtml(e.name)}</span>`
      + `<span class="codex-result-cat">${codexEsc(codexCategoryLabel(e.cat))}</span></button>`).join('');
  }
  box.style.display = 'block';
}
function codexRender(scrollToKey, keepScroll){
  codexRenderTabs();
  if(codexUI.tab === 'equipment'){
    codexRenderVTabs();
    codexRenderGrid(scrollToKey, keepScroll);
    codexRenderResults();
  } else if(codexUI.tab === 'monster' && typeof codexMonsterRender === 'function'){
    codexMonsterRender(scrollToKey, keepScroll); // 몬스터 도감(codex_monster.js)
  }
}

// ---- 도감 화면 진입/이탈 ----
function codexOpen(){
  codexEntries = codexBuildEntries();
  codexEntryByKey = {};
  codexEntries.forEach(e => { codexEntryByKey[e.key] = e; });
  if(typeof codexMonsterOpen === 'function') codexMonsterOpen(); // 몬스터 도감 엔트리 구성(툴팁/팝업 조회용으로 codexEntryByKey에도 등록됨, 장비 목록과는 별도 배열)
  const cats = codexCategories();
  if(!cats.some(c => c.id === codexUI.cat)){ // 기본 선택은 즐겨찾기가 아니라 첫 번째 장비 분류
    const firstEquip = cats.find(c => c.id !== CODEX_FAVORITES_ID);
    codexUI.cat = firstEquip ? firstEquip.id : null;
  }
  codexInfo = { key: null, levelA: 0, targetKey: null, levelB: 0, picking: false };
  codexCloseOverlays();
  codexClosePopup();
  codexUI.query = '';
  codexUI.focusKey = null;
  codexUI.resultsOpen = false;
  el('codexSearchInput').value = '';
  codexRenderGradeChecks();
  codexRender();
}
function codexOnLeave(){
  codexHideTip();
  codexClosePopup();
  codexInfo = { key: null, levelA: 0, targetKey: null, levelB: 0, picking: false };
  codexCloseOverlays();
  codexUI.resultsOpen = false;
  el('codexResults').style.display = 'none';
  if(typeof codexMonsterOnLeave === 'function') codexMonsterOnLeave();
}

// ---- 검색 결과 선택 → 해당 아이템이 속한 가로/세로 탭으로 이동 ----
function codexGoToEntry(key){
  const e = codexEntryByKey[key];
  if(!e) return;
  codexUI.tab = 'equipment';
  codexUI.cat = e.cat;
  codexUI.grades[e.grade] = true; // 그 아이템의 등급이 꺼져 있으면 목록에서 보이도록 켬
  codexUI.focusKey = key;
  codexUI.resultsOpen = false;
  codexRenderGradeChecks();
  codexRender(key);
}

// ---- 툴팁(스크롤 영역 안에서 잘리지 않도록 화면 기준 고정 위치로 표시) ----
function codexShowTip(slotEl){
  const e = codexEntryByKey[slotEl.dataset.key];
  if(!e) return;
  codexShowTipHtml(slotEl, e.tooltipHtml, e.key);
}
// 임의의 HTML을 anchorEl 위(공간이 없으면 아래)에 고정 위치 툴팁으로 표시(몬스터 도감의 드랍 아이콘 툴팁도 사용).
function codexShowTipHtml(anchorEl, html, tipKey){
  const tip = el('codexTip');
  if(!anchorEl || !tip) return;
  tip.innerHTML = html;
  tip.classList.add('show');
  codexUI.tipKey = tipKey;
  const slotEl = anchorEl;
  const r = slotEl.getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const vw = document.documentElement.clientWidth;
  let left = r.left + r.width / 2 - tw / 2;
  left = Math.max(8, Math.min(left, vw - tw - 8));
  let top = r.top - th - 6;
  if(top < 8) top = r.bottom + 6;
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}
function codexHideTip(){
  const tip = el('codexTip');
  if(tip) tip.classList.remove('show');
  codexUI.tipKey = null;
}


// ============================================================
// 아이콘 클릭 메뉴(신버전 인벤토리 팝업 재사용) — 메뉴 항목은 CODEX_ACTION_PROVIDERS에만 추가하면 늘어남
// ============================================================
// 가로 탭 id별 항목 제공자(이번 단계는 장비 탭만). 인벤토리의 INV_BOX_ACTION_PROVIDERS와 같은 구조.
const CODEX_ACTION_PROVIDERS = {
  equipment: (e) => [
    { id: 'info', label: '정보', run: () => codexOpenInfo(e.key) },
    { id: 'favorite', label: codexIsFavorite(e.key) ? '즐겨찾기 해제' : '즐겨찾기',
      run: () => { codexToggleFavorite(e.key); codexRender(null, true); } }, // 즐겨찾기 탭에서는 해제 즉시 목록에서 사라짐(스크롤 위치 유지)
  ],
};
function codexActionsFor(entry){
  const provider = CODEX_ACTION_PROVIDERS[codexUI.tab];
  return provider ? provider(entry) : [];
}
// 인벤토리 팝업(.inv-box-popup, invBoxPositionPopup)과 같은 모양/위치 보정을 사용
function codexPopupEl(){
  let p = document.getElementById('codexPopup');
  if(!p){
    p = document.createElement('div');
    p.id = 'codexPopup';
    p.className = 'inv-box-popup';
    p.style.display = 'none';
    document.body.appendChild(p);
    p.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-act-idx]');
      if(!btn || btn.disabled) return;
      const entry = codexEntryByKey[codexUI.popupKey];
      if(!entry) return;
      const action = codexActionsFor(entry)[Number(btn.dataset.actIdx)];
      if(!action || action.disabled) return;
      codexClosePopup();
      action.run();
    });
  }
  return p;
}
function codexClosePopup(){
  codexUI.popupKey = null;
  const p = document.getElementById('codexPopup');
  if(p) p.style.display = 'none';
}
function codexOpenPopup(key, slotEl){
  const entry = codexEntryByKey[key];
  if(!entry || !slotEl) return;
  const actions = codexActionsFor(entry);
  const buttons = actions.length === 0
    ? '<div class="inv-box-popup-empty">사용할 수 있는 기능이 없습니다.</div>'
    : actions.map((a, i) => `<button class="inv-btn equip ${a.active ? 'active' : ''}" data-act-idx="${i}" ${a.disabled ? 'disabled' : ''}>${a.label}</button>`).join('');
  const popup = codexPopupEl();
  codexUI.popupKey = key;
  codexHideTip();
  popup.innerHTML = `<div class="inv-box-popup-name"><span style="color:${entry.color};">${codexEsc(entry.name)}</span></div><div class="inv-box-popup-actions">${buttons}</div>`;
  invBoxPositionPopup(popup, slotEl);
}

// ============================================================
// 아이템 세부 정보 — 인벤토리 아이템 비교 UI(.inv-box-compare / .cmp-*, invCompareBuildRows, invCompareRowsHtml)를 그대로 사용
// 왼쪽 = 도감에서 고른 아이템(원하는 강화 단계, 내구도 100%) / 오른쪽 = 처음엔 빈 상태, [변경]으로 내 인벤토리 장비를 골라 비교
// ============================================================
function codexEnhanceable(src){ return CODEX_ENHANCEABLE_SRCS.includes(src); }

// 비교 UI가 읽는 표시용 엔트리({ tooltipHtml, iconHtml, borderColor }). 아이콘/툴팁은 실제 장비 표시 함수(equipInstanceDisplayInfo)가
// 강화 단계에 맞춰 만들어 주므로(강화 이펙트·공격력·판매 가격 등) 별도 강화 계산식을 만들지 않음.
function codexDisplayFor(type, level, baseItem){
  const item = baseItem
    ? Object.assign({}, baseItem, { level })                                  // 내 장비: 실제 내구도/손상 상태를 유지하고 강화 단계만 바꿔서 표시
    : { level, damaged: false, currentDurability: freshCurrentDurability(type) }; // 도감 아이템: 실제 보유 장비가 아니므로 내구도는 항상 100%
  const info = equipInstanceDisplayInfo(item, type);
  return { tooltipHtml: info.tooltipHtml, iconHtml: info.iconHtml, borderColor: info.color };
}
function codexCompareGroupOf(entry){
  return invCompareGroup({ src: entry.src, kindKey: invSortInfoEquip(entry.src, { type: entry.type, level: 0 }).kindKey });
}
// 오른쪽 비교 대상(내 인벤토리 장비). 사라졌거나 비교할 수 없는 종류가 되었으면 null.
function codexTargetEntry(){
  if(!codexInfo.targetKey) return null;
  const a = codexEntryByKey[codexInfo.key];
  const t = invBoxBuildEntries('equipment').find(e => e.key === codexInfo.targetKey);
  if(!a || !t || invCompareGroup(t) !== codexCompareGroupOf(a)) return null;
  return t;
}
function codexEnhCell(side, level, enabled){
  if(!enabled) return '-';
  return `<span class="cdx-enh"><button class="cdx-enh-btn" data-cdx="enh" data-side="${side}" data-d="-1" ${level <= 0 ? 'disabled' : ''}>◀</button>`
    + `<span class="cdx-enh-val">+${level}</span>`
    + `<button class="cdx-enh-btn" data-cdx="enh" data-side="${side}" data-d="1" ${level >= MAX_LEVEL ? 'disabled' : ''}>▶</button></span>`;
}
function codexRenderInfo(){
  const panel = el('codexInfo');
  const a0 = codexEntryByKey[codexInfo.key];
  if(!codexInfo.key || !a0 || codexInfo.picking){ panel.style.display = 'none'; panel.innerHTML = ''; return; }
  const t = codexTargetEntry();
  if(codexInfo.targetKey && !t){ codexInfo.targetKey = null; } // 대상이 사라졌으면 빈 상태로
  const a = codexDisplayFor(a0.type, codexInfo.levelA, null);
  const b = t ? codexDisplayFor(t.type, codexInfo.levelB, t.item) : { tooltipHtml: '', iconHtml: '', borderColor: '' };
  let rows = invCompareBuildRows(a, b);
  if(!t){ // 비교 대상이 없을 땐 증감(▲▼)을 만들지 않고, 오른쪽 값은 '-'로 표시
    rows = rows.map(r => Object.assign({}, r, { delta: null, deltaA: null, bHtml: r.bHtml === '없음' ? '-' : r.bHtml }));
  }
  // '강화' 항목: 이름 아래 / 등급 위. 강화 불가 아이템은 단계 선택 UI 없이 '-'
  const enhRow = { label: '강화', aHtml: codexEnhCell('a', codexInfo.levelA, codexEnhanceable(a0.src)), bHtml: t ? codexEnhCell('b', codexInfo.levelB, codexEnhanceable(t.src)) : '-' };
  const nameIdx = rows.findIndex(r => r.label === INV_COMPARE_TIP_LABELS.name);
  rows.splice(nameIdx + 1, 0, enhRow);
  const icon = (e, empty) => empty
    ? '<div class="inv-box-slot empty cmp-slot"></div>'
    : `<div class="inv-box-slot filled cmp-slot" style="border-color:${e.borderColor};">${e.iconHtml}</div>`;
  panel.innerHTML = `<div class="cmp-body"><div class="cmp-head"><div class="cmp-head-label"></div><div class="cmp-head-side">${icon(a, false)}</div>`
    + `<div class="cmp-head-side">${icon(b, !t)}<button class="inv-box-btn cmp-change" data-cdx="change">변경</button></div></div>${invCompareRowsHtml(rows)}</div>`
    + `<div class="cmp-foot"><button class="inv-box-btn" data-cdx="close">닫기</button></div>`;
  panel.style.display = 'flex';
}

// 비교 대상 선택 화면: 내 인벤토리 장비 탭을 그대로 보여 주고(인벤토리와 같은 정렬/슬롯/툴팁), 같은 종류 장비만 고를 수 있음(나머지는 흐리게).
function codexRenderPicker(){
  const panel = el('codexPicker');
  const a0 = codexEntryByKey[codexInfo.key];
  if(!a0 || !codexInfo.picking){ panel.style.display = 'none'; panel.innerHTML = ''; codexCursorSync(); return; }
  const group = codexCompareGroupOf(a0);
  const entries = invBoxSortEntries(invBoxBuildEntries('equipment'), 'equipment');
  const comparable = entries.filter(e => invCompareGroup(e) === group).length;
  const cells = entries.map(e => {
    const ok = invCompareGroup(e) === group;
    return `<div class="inv-box-slot filled ${ok ? '' : 'compare-disabled'} ${e.locked ? 'locked' : ''}" data-key="${e.key}" style="border-color:${e.borderColor};">`
      + `${e.iconHtml}${e.equipped ? '<span class="inv-box-equip-mark">E</span>' : ''}${invLockBadgeHtml(e.locked)}<span class="tooltip">${e.tooltipHtml}</span></div>`;
  }).join('');
  panel.innerHTML = `<div class="cmp-body"><div class="codex-pick-msg">${comparable ? '비교할 아이템을 선택하세요.' : '비교할 수 있는 같은 종류의 장비가 없습니다.'}</div>`
    + `<div class="inv-box-grid">${cells}</div></div>`
    + `<div class="cmp-foot"><button class="inv-box-btn" data-cdx="pick-cancel">취소</button></div>`;
  panel.style.display = 'flex';
  codexCursorSync();
}
function codexRenderOverlays(){ codexRenderInfo(); codexRenderPicker(); }
function codexCloseOverlays(){
  ['codexInfo', 'codexPicker'].forEach(id => { const n = document.getElementById(id); if(n){ n.style.display = 'none'; n.innerHTML = ''; } });
  codexCursorSync();
}
function codexOpenInfo(key){
  if(!codexEntryByKey[key]) return;
  codexHideTip();
  codexClosePopup();
  codexUI.resultsOpen = false;
  el('codexResults').style.display = 'none';
  codexInfo = { key, levelA: 0, targetKey: null, levelB: 0, picking: false };
  codexRenderOverlays();
}
function codexCloseInfo(){
  codexInfo = { key: null, levelA: 0, targetKey: null, levelB: 0, picking: false };
  codexRenderOverlays();
}
function codexInfoIsOpen(){ return !!codexInfo.key; }

// 비교 대상 선택 중 돋보기 커서(인벤토리 비교 모드와 같은 이미지/크기, 마우스 환경에서만)
function codexCursorSync(){
  const active = codexInfo.picking && currentView === 'collection';
  document.body.classList.toggle('codex-picking', active);
  if(!active){ const c = document.getElementById('invCompareCursor'); if(c) c.style.display = 'none'; }
}

// ---- 이벤트 ----
(function bindCodexEvents(){
  el('codexTabs').addEventListener('click', (ev) => {
    const b = ev.target.closest('.inv-box-tab');
    if(!b || b.dataset.tab === codexUI.tab) return;
    codexUI.tab = b.dataset.tab;
    codexHideTip();
    codexClosePopup();
    codexCloseInfo();
    if(typeof codexMonsterCloseInfo === 'function') codexMonsterCloseInfo();
    codexRender();
  });
  el('codexVTabs').addEventListener('click', (ev) => {
    const b = ev.target.closest('.codex-vtab');
    if(!b || b.dataset.cat === codexUI.cat) return;
    codexUI.cat = b.dataset.cat;
    codexUI.focusKey = null;
    codexHideTip();
    codexClosePopup();
    codexRender();
  });
  el('codexChecks').addEventListener('change', (ev) => {
    const cb = ev.target.closest('input[data-grade]');
    if(!cb) return;
    codexUI.grades[cb.dataset.grade] = cb.checked;
    codexUI.focusKey = null;
    codexHideTip();
    codexClosePopup();
    codexCloseInfo(); // 필터를 바꾸면 세부 정보 화면은 닫고 목록으로 돌아감
    codexRenderGrid();
  });
  const input = el('codexSearchInput');
  input.addEventListener('input', () => {
    codexUI.query = input.value;
    codexUI.resultsOpen = true;
    codexUI.focusKey = null;
    codexHideTip();
    codexClosePopup();
    codexCloseInfo();
    codexRenderGrid();
    codexRenderResults();
  });
  input.addEventListener('focus', () => { if(codexNormQuery()){ codexUI.resultsOpen = true; codexRenderResults(); } });
  el('codexResults').addEventListener('click', (ev) => {
    const b = ev.target.closest('.codex-result');
    if(b){ codexClosePopup(); codexCloseInfo(); codexGoToEntry(b.dataset.key); } // 검색 결과는 원래 종류 탭으로 이동(즐겨찾기 탭으로 보내지 않음)
  });

  // 슬롯: hover = 툴팁(마우스), 클릭/터치 = 아이템 메뉴(정보 / 즐겨찾기). 같은 슬롯을 다시 누르면 메뉴가 닫힘
  const grid = el('codexGrid');
  grid.addEventListener('mouseover', (ev) => { const s = ev.target.closest('.codex-slot'); if(s && codexUI.popupKey !== s.dataset.key) codexShowTip(s); });
  grid.addEventListener('mouseout', (ev) => { if(ev.target.closest('.codex-slot')) codexHideTip(); });
  grid.addEventListener('click', (ev) => {
    const s = ev.target.closest('.codex-slot');
    if(!s) return;
    if(codexUI.popupKey === s.dataset.key) codexClosePopup();
    else codexOpenPopup(s.dataset.key, s);
  });
  el('codexGridScroll').addEventListener('scroll', () => { codexHideTip(); codexClosePopup(); });

  // 세부 정보 화면: 강화 단계 ◀▶ / 비교 대상 [변경] / [닫기]
  el('codexInfo').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-cdx]');
    if(!btn || btn.disabled) return;
    const act = btn.dataset.cdx;
    if(act === 'enh'){
      const d = Number(btn.dataset.d);
      if(btn.dataset.side === 'a') codexInfo.levelA = Math.max(0, Math.min(MAX_LEVEL, codexInfo.levelA + d));
      else codexInfo.levelB = Math.max(0, Math.min(MAX_LEVEL, codexInfo.levelB + d));
      const body = el('codexInfo').querySelector('.cmp-body');
      const top = body ? body.scrollTop : 0;
      codexRenderInfo();
      const nb = el('codexInfo').querySelector('.cmp-body');
      if(nb) nb.scrollTop = top; // 단계를 바꿔도 보고 있던 스크롤 위치 유지
    } else if(act === 'change'){
      codexInfo.picking = true;
      codexRenderOverlays();
    } else if(act === 'close'){
      codexCloseInfo();
    }
  });
  // 비교 대상 선택 화면: 같은 종류 장비 클릭 = 선택, [취소] = 세부 정보로 돌아감(기존 비교 대상은 그대로)
  el('codexPicker').addEventListener('click', (ev) => {
    const cancel = ev.target.closest('button[data-cdx="pick-cancel"]');
    if(cancel){ codexInfo.picking = false; codexRenderOverlays(); return; }
    const slot = ev.target.closest('.inv-box-slot.filled');
    if(!slot || slot.classList.contains('compare-disabled')) return;
    const target = invBoxBuildEntries('equipment').find(e => e.key === slot.dataset.key);
    if(!target) return;
    codexInfo.targetKey = target.key;
    codexInfo.levelB = target.item.level || 0;
    codexInfo.picking = false;
    codexRenderOverlays();
  });
  // 돋보기 커서(비교 대상 선택 중, 마우스 환경)
  document.addEventListener('mousemove', (ev) => {
    if(!codexInfo.picking || currentView !== 'collection') return;
    const c = invCompareCursorEl();
    if(!invLockHasMouse() || !ev.target.closest || !ev.target.closest('#codexPicker')){ c.style.display = 'none'; return; }
    c.style.left = ev.clientX + 'px'; c.style.top = ev.clientY + 'px'; c.style.display = 'block';
  });

  document.addEventListener('click', (ev) => {
    if(!ev.target.closest('.codex-slot') && !ev.target.closest('#codexPopup') && !ev.target.closest('.codex-mdrop')){
      codexHideTip();
      codexClosePopup(); // 메뉴 바깥 영역을 누르면 닫힘(신버전 인벤토리와 동일)
    }
    if(!ev.target.closest('#codexSearch') && codexUI.resultsOpen){
      codexUI.resultsOpen = false;
      el('codexResults').style.display = 'none';
    }
  });
  document.addEventListener('keydown', (ev) => {
    if(ev.key !== 'Escape' || currentView !== 'collection') return;
    if(codexUI.tab === 'monster'){ if(typeof codexMonsterOnEscape === 'function') codexMonsterOnEscape(); return; }
    if(codexUI.popupKey){ codexClosePopup(); return; }
    if(codexInfo.picking){ codexInfo.picking = false; codexRenderOverlays(); return; } // 비교 대상 선택 취소 → 세부 정보로
    if(codexInfoIsOpen()) codexCloseInfo();
  });
  window.addEventListener('scroll', () => { if(codexUI.popupKey) codexClosePopup(); }, true);
  window.addEventListener('resize', () => {
    codexHideTip();
    codexClosePopup();
    if(currentView === 'collection'){
      if(codexUI.tab === 'monster' && typeof codexMonsterSyncGridHeight === 'function') codexMonsterSyncGridHeight();
      else codexSyncGridHeight();
    }
  });
})();
