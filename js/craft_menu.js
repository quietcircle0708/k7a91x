// ============================================================
// 제작소 새 메뉴 UI (리메이크) — 제작 버튼을 누르기 전의 메뉴 화면과 그 안의 상호작용만 담당함.
// [제작] 버튼을 누르면 예전과 똑같이 openCraftPopup(category, itemId)(navigation.js)로 넘어가며, 그 이후의 제작 팝업/재료 장비 선택/
// 확인/연출/결과/재료 소모/지급/저장은 전혀 건드리지 않음. 예전 메뉴(render.js renderCraftList 등)는 그대로 보존돼 있고
// data.js의 CRAFT_MENU_UI 값('new'/'legacy')으로 전환함.
//
// 구조: 제목 → 가로 분류 탭(CRAFT_SUB_TABS 중 제작 아이템이 있는 분류) → [왼쪽 세로 탭 | 필터·검색 + 제작 아이템 목록(스크롤)] →
//       고정 하단(선택 아이템 / 필요 재료[내부 스크롤] / 천장 영역 / 제작 확률 / 제작 버튼).
// 재활용: 도감의 즐겨찾기(state.codexFavorites, codexIsFavorite/codexToggleFavorite, 별 아이콘)·고정 위치 툴팁(codexShowTipHtml)·검색 UI/결과 드롭다운
//         (.codex-search/.codex-results, codexHighlightHtml)·세로 탭(.codex-vtab) / 인벤토리 정렬 드롭다운(invSortSelectHtml, INV_SORT_CRITERIA,
//         state.invSort['craft']) / 기존 제작 데이터·재료·툴팁·판정 함수(CRAFTABLE_ITEMS, findCraftResource, craftResource*, craftItemCanCraft→craftPopupCanCraft).
// ============================================================

const CRAFT_VTAB_FAVORITES = 'favorites';
const CRAFT_VTAB_ALL = 'all';

// 화면 상태(저장하지 않음. 즐겨찾기만 state.codexFavorites에 'craft:<제작 아이템 id>' 키로 저장, 정렬 기준은 state.invSort.craft에 저장)
// cat: 가로 분류 id / vtab: 세로 탭 id(favorites|all|세부 종류 id) / query·resultsOpen: 검색 / selectedKey: 선택한 제작 아이템 key /
// focusKey: 검색 결과로 이동한 아이템(강조) / resetScroll: 목록 스크롤을 맨 위로 / tipByKey: 마지막으로 그린 툴팁 HTML / cache: 영역별 마지막 HTML(바뀐 부분만 다시 그림)
let craftMenuUI = { cat: null, vtab: CRAFT_VTAB_ALL, query: '', resultsOpen: false, selectedKey: null, focusKey: null, resetScroll: false, tipByKey: {}, cache: {}, entries: [], searchByKey: {} };

function craftMenuEsc(s){ return codexEsc(s); }
function craftMenuKey(item){ return 'craft:' + item.id; }

// ---- 데이터 → 엔트리 ----
// CRAFT_SUB_TABS(분류 정의)와 CRAFTABLE_ITEMS(실제 제작 데이터)만 읽음. 제작 가능 여부는 기존 판정(craftItemCanCraft)을 그대로 사용.
function craftMenuBuildEntries(){
  const out = [];
  CRAFT_SUB_TABS.forEach(st => {
    (CRAFTABLE_ITEMS[st.id] || []).forEach(item => {
      const grade = item.grade || 'normal';
      out.push({
        key: craftMenuKey(item), category: st.id, categoryLabel: st.label, item, name: item.name, grade,
        color: craftItemNameColor(item), kind: craftItemKind(st.id, item),
        levelReq: craftItemLevelReq(item), gradeRank: WEAPON_GRADE_RANK[grade] ?? Object.keys(WEAPON_GRADES).length,
        craftable: craftItemCanCraft(st.id, item), order: out.length,
      });
    });
  });
  return out;
}
function craftMenuEntryByKey(key){ return craftMenuUI.entries.find(e => e.key === key) || null; }

// 가로 분류: 제작 아이템이 하나라도 있는 분류만(데이터에 새 분류 아이템이 생기면 자동으로 탭이 생김). 하나도 없으면 첫 분류를 빈 목록으로 보여줌.
function craftMenuCategories(){
  const has = new Set(craftMenuUI.entries.map(e => e.category));
  const list = CRAFT_SUB_TABS.filter(st => has.has(st.id));
  return list.length ? list : CRAFT_SUB_TABS.slice(0, 1);
}
// 세로 탭: 즐겨찾기 → 전체 → 현재 분류에 실제로 있는 세부 종류(종류 표의 순서, 표에 없는 새 종류는 맨 뒤).
function craftMenuVTabs(){
  const cat = craftMenuUI.cat;
  const kinds = [];
  craftMenuUI.entries.filter(e => e.category === cat && e.kind).forEach(e => { if(!kinds.some(k => k.id === e.kind.id)) kinds.push({ id: e.kind.id, label: e.kind.label }); });
  const src = CRAFT_KIND_SOURCES[cat];
  const order = src ? Object.keys(src.labels() || {}) : [];
  const rank = id => { const i = order.indexOf(id); return i === -1 ? order.length : i; };
  kinds.sort((a, b) => rank(a.id) - rank(b.id));
  return [{ id: CRAFT_VTAB_FAVORITES, label: '즐겨찾기' }, { id: CRAFT_VTAB_ALL, label: '전체' }].concat(kinds);
}

// ---- 목록 ----
// 기본 순서: 착용 제한 레벨 낮은 순(예전 제작소 목록과 같은 규칙, 동점이면 데이터 등록 순서). 즐겨찾기 탭은 도감과 같이 그 역순(레벨↓ → 등급↓ → 이름).
// 정렬 드롭다운 기준을 고르면 그 기준이 1순위(동점이면 기본 순서 유지).
function craftMenuBaseCompare(a, b){
  if(a.levelReq !== b.levelReq) return a.levelReq - b.levelReq;
  return a.order - b.order;
}
function craftMenuSorted(list, favTab){
  let out = list.slice().sort(favTab ? codexCompareFavorites : craftMenuBaseCompare);
  const crit = invSortGet('craft');
  if(crit){
    const cmp = INV_SORT_CRITERIA[crit].compare;
    const info = e => ({ kindKey: '', gradeRank: e.gradeRank, price: 0, level: 0, craftable: e.craftable });
    out = out.map((e, i) => ({ e, i })).sort((a, b) => cmp(info(a.e), info(b.e)) || a.i - b.i).map(o => o.e);
  }
  return out;
}
function craftMenuFilteredEntries(){
  const { cat, vtab } = craftMenuUI;
  const favTab = vtab === CRAFT_VTAB_FAVORITES;
  const list = craftMenuUI.entries.filter(e => e.category === cat && (
    favTab ? codexIsFavorite(e.key) : (vtab === CRAFT_VTAB_ALL || (e.kind && e.kind.id === vtab))));
  return craftMenuSorted(list, favTab);
}

// ---- 렌더 ----
function craftMenuSet(id, html, key){ // 내용이 같으면 다시 그리지 않음(열려 있는 드롭다운/호버 중인 툴팁/스크롤 유지)
  const box = el(id);
  if(!box) return false;
  const ck = key || id;
  if(craftMenuUI.cache[ck] === html) return false;
  craftMenuUI.cache[ck] = html;
  box.innerHTML = html;
  return true;
}
function craftMenuRenderTabs(){
  const cats = craftMenuCategories();
  craftMenuSet('craftCatTabs', cats.map(c => `<button class="inv-box-tab craft-cat-tab ${c.id === craftMenuUI.cat ? 'active' : ''}" data-cat="${c.id}">${craftMenuEsc(c.label)}</button>`).join(''));
}
function craftMenuRenderVTabs(){
  craftMenuSet('craftVTabs', craftMenuVTabs().map((c, i) => {
    const cls = (c.id === craftMenuUI.vtab ? ' active' : '') + (c.id === CRAFT_VTAB_FAVORITES ? ' codex-vtab-fav' : '') + (i === 1 ? ' codex-vtab-after-fav' : '');
    return `<button class="codex-vtab${cls}" data-vtab="${c.id}">${craftMenuEsc(c.label)}</button>`;
  }).join(''));
}
function craftMenuRenderSort(){
  const wrap = el('craftSortWrap');
  if(!wrap) return;
  const html = invSortSelectHtml('craft');
  if(wrap.dataset.sortHtml !== html){ wrap.innerHTML = html; wrap.dataset.sortHtml = html; } // 같으면 다시 그리지 않음(열려 있는 드롭다운 유지)
}
function craftMenuRowHtml(e){
  const cls = (e.key === craftMenuUI.selectedKey ? ' selected' : '') + (e.craftable ? '' : ' unavailable') + (e.key === craftMenuUI.focusKey ? ' flash' : '');
  craftMenuUI.tipByKey[e.key] = craftItemTooltipHtml(e.item);
  return `<div class="craft-row${cls}" data-key="${e.key}">`
    + `<span class="inv-icon craft-row-icon" style="border-color:${e.color};">${craftItemIconHtml(e.item, 'inv-icon-img')}${codexFavMarkHtml(e.key)}</span>`
    + `<span class="craft-row-name" style="color:${e.color};">${craftMenuEsc(e.name)}</span>`
    + `<span class="craft-row-status ${e.craftable ? 'ok' : 'no'}">${e.craftable ? '제작 가능' : '제작 불가능'}</span>`
    + `</div>`;
}
function craftMenuRenderList(){
  const list = craftMenuFilteredEntries();
  const html = list.length
    ? list.map(craftMenuRowHtml).join('')
    : `<div class="inv-empty">${craftMenuUI.vtab === CRAFT_VTAB_FAVORITES ? '즐겨찾기한 제작 아이템이 없습니다.' : '제작 가능한 아이템이 없습니다.'}</div>`;
  const scroller = el('craftListScroll');
  const prev = scroller.scrollTop;
  const changed = craftMenuSet('craftList', html);
  if(changed && typeof codexHideTip === 'function') codexHideTip(); // 다시 그린 행에 붙어 있던 툴팁은 닫음
  if(craftMenuUI.resetScroll){ scroller.scrollTop = 0; craftMenuUI.resetScroll = false; }
  else if(changed) scroller.scrollTop = prev;
}
// 천장 표시 영역: 이번 단계에서는 실제 천장 시스템이 없으므로 항상 빈 게이지(자리만 확보). 나중에 천장 시스템을 연결할 때는 이 함수가
// { current, max }를 돌려주게 하면 게이지 채움과 '현재 시도 / 천장 횟수' 텍스트가 자동으로 표시됨.
function craftMenuPityState(entry){ return null; }
function craftMenuRenderBottom(){
  const e = craftMenuUI.selectedKey ? craftMenuEntryByKey(craftMenuUI.selectedKey) : null;
  const item = e && e.item;
  // 선택 아이템: [아이콘] 이름 (+ 즐겨찾기 별)
  let sel;
  if(e){
    craftMenuUI.tipByKey.sel = craftItemTooltipHtml(item);
    sel = `<span class="inv-icon craft-sel-icon" data-tip="sel" style="border-color:${e.color};">${craftItemIconHtml(item, 'inv-icon-img')}</span>`
      + `<span class="craft-sel-name" data-tip="sel" style="color:${e.color};">${craftMenuEsc(e.name)}</span>`
      + `<button class="craft-fav-btn ${codexIsFavorite(e.key) ? 'on' : ''}" data-fav="${e.key}" title="즐겨찾기" aria-label="즐겨찾기"><img src="${CODEX_FAVORITE_IMG}" alt="" draggable="false"></button>`;
  } else {
    sel = `<span class="craft-sel-empty">제작할 아이템을 선택하세요</span>`;
  }
  craftMenuSet('craftSel', sel);
  // 필요 재료: 아이콘(+툴팁) 아래 보유/필요 수량(충족 노랑·부족 빨강은 제작 팝업과 같은 클래스). 실제 소모는 제작 이후 기존 과정에서 처리됨.
  let mats = '';
  if(item){
    mats = craftMaterialsSortedByGradeDesc(item.materials).map((m, i) => {
      const resource = findCraftResource(m.name);
      if(!resource) return '';
      const owned = craftResourceOwnedCount(resource);
      const color = craftResourceColor(resource);
      craftMenuUI.tipByKey['m' + i] = craftResourceTooltipHtml(resource);
      return `<div class="craft-mat-cell" data-tip="m${i}"><span class="inv-icon craft-mat-icon" style="border-color:${color};">${craftResourceIconHtml(resource, 'inv-icon-img')}</span>`
        + `<span class="${owned >= m.need ? 'craft-slot-qty-ok' : 'craft-slot-qty-short'}">${owned}/${m.need}</span></div>`;
    }).join('');
  }
  craftMenuSet('craftMatGrid', mats);
  // 재료 4개 미만이면 한 줄만 쓰고 가운데 정렬(.few), 4개 이상은 왼쪽부터 4열 격자(5개 이상이면 2번째 줄부터 왼쪽부터 나열) — 세부는 css .craft-mat-grid 참고
  const matCount = el('craftMatGrid').children.length;
  const grid = el('craftMatGrid');
  grid.classList.toggle('few', matCount > 0 && matCount < 4);
  grid.style.setProperty('--craft-mat-n', matCount);
  // 천장(자리만) / 제작 확률 / 제작 버튼
  const pity = e ? craftMenuPityState(e) : null;
  el('craftPityFill').style.width = pity && pity.max ? Math.min(100, Math.round(pity.current / pity.max * 100)) + '%' : '0%';
  el('craftPityText').textContent = pity && pity.max ? `${pity.current} / ${pity.max}` : '천장';
  el('craftRate').textContent = e ? `제작 확률 ${item.successChance}%` : '제작 확률 -';
  el('craftMakeCost').innerHTML = e ? goldHtml((item.craftCost || 0).toLocaleString()) : '';
  const btn = el('craftMakeBtn');
  btn.disabled = !e;
  btn.classList.toggle('dim', !!e && !e.craftable); // 지금은 제작 조건이 안 맞아도 누르면 기존 제작 팝업이 열려 부족한 부분을 확인할 수 있음(눌러도 팝업의 [제작]은 비활성)
}
function craftMenuRender(){
  craftMenuRenderTabs();
  craftMenuRenderVTabs();
  craftMenuRenderSort();
  craftMenuRenderList();
  craftMenuRenderBottom();
  craftMenuRenderResults();
}
// 현재 분류/세로 탭 값이 데이터와 맞는지 보정(분류 탭이 사라졌거나 세부 종류가 없어진 경우)
function craftMenuNormalize(){
  const cats = craftMenuCategories();
  if(!cats.some(c => c.id === craftMenuUI.cat)){ craftMenuUI.cat = cats[0].id; craftMenuUI.vtab = CRAFT_VTAB_ALL; }
  if(!craftMenuVTabs().some(t => t.id === craftMenuUI.vtab)) craftMenuUI.vtab = CRAFT_VTAB_ALL;
  if(craftMenuUI.selectedKey && !craftMenuEntryByKey(craftMenuUI.selectedKey)) craftMenuUI.selectedKey = null;
}
// 제작소 화면에 들어올 때(navigation.js showView)
function craftMenuOpen(){
  craftMenuUI.entries = craftMenuBuildEntries();
  craftMenuUI.cache = {};
  craftMenuUI.resetScroll = true;
  craftMenuNormalize();
  craftMenuRender();
}
// render()가 불릴 때마다(재료/골드가 바뀐 경우 등) 호출 — 제작소 화면이 아니면 아무것도 안 함. 바뀐 부분만 다시 그림.
function craftMenuRefresh(){
  if(currentView !== 'craft' || CRAFT_MENU_UI !== 'new') return;
  craftMenuUI.entries = craftMenuBuildEntries();
  craftMenuNormalize();
  craftMenuRender();
}

// ---- 검색(인벤토리 검색과 같은 방식) ----
// 검색 결과 = 모든 가로 분류의 제작 아이템 중 이름이 일치하는 것(결과 오른쪽에 분류 표시). 결과를 고르면 그 아이템의 분류/세부 종류 탭으로
// 이동해 선택·강조함. 검색어는 탭을 옮겨도 유지되고, 검색창을 다시 선택하면 초기화, 제작소를 나가면 초기화됨.
function craftMenuQueryNorm(){ return (craftMenuUI.query || '').trim().toLowerCase(); }
function craftMenuSearchResults(q){
  const out = [];
  craftMenuCategories().forEach(c => {
    craftMenuSorted(craftMenuUI.entries.filter(e => e.category === c.id && e.name.toLowerCase().includes(q)), false).forEach(e => out.push(e));
  });
  return out;
}
function craftMenuRenderResults(){
  const box = el('craftResults');
  if(!box) return;
  const q = craftMenuQueryNorm();
  craftMenuUI.searchByKey = {};
  if(!q || !craftMenuUI.resultsOpen){ box.style.display = 'none'; return; }
  const results = craftMenuSearchResults(q);
  const html = results.length
    ? results.slice(0, CODEX_SEARCH_MAX_RESULTS).map(e => {
        craftMenuUI.searchByKey[e.key] = e;
        return `<button class="codex-result" data-key="${e.key}"><span style="color:${e.color};">${codexHighlightHtml(e.name, craftMenuUI.query)}</span><span class="codex-result-cat">${craftMenuEsc(e.categoryLabel)}</span></button>`;
      }).join('')
    : '<div class="codex-result-empty">검색 결과가 없습니다.</div>';
  if(craftMenuUI.cache.results !== html){ box.innerHTML = html; craftMenuUI.cache.results = html; }
  box.style.display = 'block';
}
function craftMenuGoTo(key){
  const e = craftMenuUI.searchByKey[key] || craftMenuEntryByKey(key);
  if(!e) return;
  craftMenuUI.cat = e.category;
  craftMenuUI.vtab = e.kind ? e.kind.id : CRAFT_VTAB_ALL;
  craftMenuUI.selectedKey = e.key;
  craftMenuUI.focusKey = e.key;
  craftMenuUI.resultsOpen = false;
  craftMenuRender();
  const row = el('craftList').querySelector(`[data-key="${e.key}"]`);
  if(row) el('craftListScroll').scrollTop = Math.max(0, row.offsetTop - 4);
}
function craftMenuSearchReset(){
  craftMenuUI.query = '';
  craftMenuUI.resultsOpen = false;
  craftMenuUI.focusKey = null;
  const input = document.getElementById('craftSearchInput');
  if(input) input.value = '';
  const box = document.getElementById('craftResults');
  if(box){ box.style.display = 'none'; box.innerHTML = ''; }
  craftMenuUI.cache.results = null;
}

// ---- 조작 ----
function craftMenuSelect(key){
  craftMenuUI.selectedKey = key;
  craftMenuUI.focusKey = null;
  craftMenuRender();
}
function craftMenuSwitchCat(cat){
  if(craftMenuUI.cat === cat) return;
  craftMenuUI.cat = cat; craftMenuUI.vtab = CRAFT_VTAB_ALL; craftMenuUI.focusKey = null; craftMenuUI.resetScroll = true;
  craftMenuRender();
}
function craftMenuSwitchVTab(vtab){
  if(craftMenuUI.vtab === vtab) return;
  craftMenuUI.vtab = vtab; craftMenuUI.focusKey = null; craftMenuUI.resetScroll = true;
  craftMenuRender();
}

(function craftMenuInit(){
  document.body.classList.toggle('craft-ui-new', CRAFT_MENU_UI === 'new'); // 새 메뉴/예전 메뉴 중 하나만 표시(css)
  const wrap = el('craftNewWrap');
  if(!wrap) return;

  el('craftCatTabs').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-cat]'); if(b) craftMenuSwitchCat(b.dataset.cat); });
  el('craftVTabs').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-vtab]'); if(b) craftMenuSwitchVTab(b.dataset.vtab); });
  // 정렬 드롭다운이 바뀌면 목록은 맨 위부터(정렬 상태 저장/다시 그리기는 main.js의 공용 change 처리가 함)
  el('craftSortWrap').addEventListener('change', () => { craftMenuUI.resetScroll = true; });

  // 목록: 행 클릭 = 선택(하단 영역에 표시)
  el('craftList').addEventListener('click', (ev) => {
    const row = ev.target.closest('.craft-row');
    if(row) craftMenuSelect(row.dataset.key);
  });
  // 하단: 즐겨찾기 별 / 제작 버튼(기존 제작 팝업으로 넘어감)
  el('craftSel').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-fav]');
    if(!b) return;
    codexToggleFavorite(b.dataset.fav); // 도감과 같은 즐겨찾기 저장(state.codexFavorites). 즐겨찾기 탭에서 해제하면 목록에서 바로 사라짐
    craftMenuRender();
  });
  el('craftMakeBtn').addEventListener('click', () => {
    const e = craftMenuUI.selectedKey ? craftMenuEntryByKey(craftMenuUI.selectedKey) : null;
    if(e) openCraftPopup(e.category, e.item.id); // 여기서부터는 기존 제작 시스템
  });

  // 툴팁: 목록 행(제작 아이템)·선택 아이템·재료 아이콘 — 스크롤 영역 안에서 잘리지 않도록 도감과 같은 고정 위치 툴팁 사용
  wrap.addEventListener('mouseover', (ev) => {
    const row = ev.target.closest('.craft-row');
    const tipEl = ev.target.closest('[data-tip]');
    if(row) codexShowTipHtml(row.querySelector('.craft-row-icon'), craftMenuUI.tipByKey[row.dataset.key] || '', row.dataset.key);
    else if(tipEl && craftMenuUI.tipByKey[tipEl.dataset.tip]) codexShowTipHtml(tipEl.querySelector('.inv-icon') || tipEl, craftMenuUI.tipByKey[tipEl.dataset.tip], tipEl.dataset.tip);
  });
  wrap.addEventListener('mouseout', (ev) => {
    if(ev.target.closest('.craft-row') || ev.target.closest('[data-tip]')) codexHideTip();
  });
  el('craftListScroll').addEventListener('scroll', () => codexHideTip());
  el('craftMatScroll').addEventListener('scroll', () => codexHideTip());

  // 검색창(인벤토리 검색과 같은 동작)
  const input = el('craftSearchInput');
  input.addEventListener('input', () => {
    craftMenuUI.query = input.value;
    craftMenuUI.resultsOpen = true;
    craftMenuRenderResults();
  });
  input.addEventListener('focus', () => { // 검색어가 있는 상태에서 다시 선택하면 비우고 새로 검색(탭 이동만으로는 지우지 않음)
    if(!input.value && !craftMenuUI.query) return;
    input.value = '';
    craftMenuUI.query = '';
    craftMenuUI.resultsOpen = false;
    craftMenuRenderResults();
  });
  el('craftResults').addEventListener('click', (ev) => {
    const b = ev.target.closest('.codex-result');
    if(b) craftMenuGoTo(b.dataset.key);
  });
  document.addEventListener('click', (ev) => { // 검색창/결과 밖을 누르면 결과 드롭다운만 닫음(검색어는 유지)
    if(craftMenuUI.resultsOpen && !ev.target.closest('#craftSearch')){
      craftMenuUI.resultsOpen = false;
      el('craftResults').style.display = 'none';
    }
  });
})();
