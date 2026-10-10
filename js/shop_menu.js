// ============================================================
// 상점 새 메뉴 UI (개편) — 상점 화면의 "표시와 조작"만 담당함. 구매/판매 처리·가격 공식·아이템 데이터는 전부 기존 것을 그대로 호출함.
//   · 구매 수량 입력/판매 수량 입력 팝업 = navigation.js openBuyQtyModal(action, typeId) (그대로, 변경 없음)
//   · 구매/판매 확정 처리 = actions.js confirmBuyQty / performSellQty / sellItem·performSellItem 등 (그대로)
//   · 가격·정렬 = formulas.js shopEquipmentEntries/shopArtifactEntries/sortShopEntries, data.js SHOP_SORT_FIELDS, state.js shopUI(filter/dir)
//   · 툴팁 = 도감과 같은 고정 위치 툴팁(codexShowTipHtml/codexHideTip) / 골드 표시 = 신버전 인벤토리 .inv-box-gold / 검색창 = 도감·인벤토리 .codex-search
// 구조: 제목 → [구매|판매 탭 + 소유 골드] → 분류 탭(장비/소비/마석/기타, 가로 스크롤) → 세부 분류 탭(장비만) → 필터·정렬 방향 / 검색 → 빠른 구매/판매 → 아이템 목록(이 영역만 세로 스크롤).
// 분류는 이름·아이템 목록에 하드코딩하지 않음: SHOP_TABS(분류 정의)와 각 아이템 데이터/보유 현황에서 "지금 이 모드(구매/판매)에서 실제로 표시 가능한 아이템"을 모아
// 그 아이템이 하나라도 있는 분류/세부 분류만 탭으로 만듦.
// 예전 상점 UI(render.js renderShopTab 이하, main.js 상점 리스너, index.html .shop-legacy-wrap)는 삭제하지 않고 SHOP_MENU_UI='legacy'로 복구 가능하게 보존함.
// ============================================================

// 화면 상태(저장하지 않음. 빠른 구매/판매 체크만 state.settings.shopQuickTrade에 저장)
// mode: 'buy'|'sell' / cat·leaf: 모드별로 따로 기억하는 분류(최상위 탭 id)·세부 분류 id / leafByTop: 모드·분류별로 마지막에 보던 세부 분류 /
// query: 모드별 검색어(구매·판매 검색은 서로 섞이지 않음) / filterOpen: 필터 드롭다운 / cache: 영역별 마지막 HTML / tipByKey·rowByKey: 마지막으로 그린 목록 정보
let shopMenuUI = { mode: 'buy', cat: {}, leaf: {}, leafByTop: {}, query: {}, filterOpen: false, resetScroll: false, cache: {}, tipByKey: {}, rowByKey: {} };
SHOP_MODES.forEach(m => { shopMenuUI.cat[m.id] = null; shopMenuUI.leaf[m.id] = null; shopMenuUI.leafByTop[m.id] = {}; shopMenuUI.query[m.id] = ''; });

function shopMenuEsc(s){ return codexEsc(s); }
function shopMenuIsMobile(){ return document.body.classList.contains('mobile-preset'); }
function shopMenuModeDef(){ return SHOP_MODES.find(m => m.id === shopMenuUI.mode) || SHOP_MODES[0]; }

// ---- 데이터 → 행(row) ----
// 행 공통 필드: key(목록 식별) / mode / cat(최상위 분류 id) / leaf(세부 분류 id) / name(검색 대상·강조 대상)·namePre/nameSuf(강조하지 않는 앞/뒤 표시)·color / iconHtml·border·bg / tip(툴팁 HTML) /
//   price(정렬·표시용 단가) / levelReq(정렬용, 없으면 null) / action·typeId(기존 구매·판매 팝업 호출용) / src·id(장비 인스턴스 판매용) / unavailable·tag
function shopMenuLeafIds(top){ return top.subTabs ? top.subTabs.map(s => s.id) : [top.id]; }

// 소비 아이템 아이콘 상자 색: 플라스크는 기존 상점과 같은 붉은 상자(#2a1414/#c13c3c), 비급 등은 등급 색
function shopMenuConsumableLook(item){
  if(isScrollItem(item)){ const g = scrollGradeInfo(item); return { border: g ? g.color : 'var(--forge-line)', bg: '#242424', name: null }; }
  return { border: '#c13c3c', bg: '#2a1414', name: 'var(--forge-cream)' };
}
// 소비 아이템 이름 표시 조각: 비급은 앞에 굵은 보라색 "[비급]" + 등급 색 이름(consumableNameHtml과 동일한 표시), 그 외는 기본 이름.
// 검색어 강조는 이름 본문(name)에만 적용하고 접두어/접미어(pre/suf)에는 적용하지 않음.
function shopMenuConsumableNameParts(item){
  if(isScrollItem(item)){
    const g = scrollGradeInfo(item);
    return { pre: `<span style="color:${WEAPON_GRADES.epic.color}; font-weight:700;">[비급]</span>`, color: g ? g.color : null };
  }
  return { pre: '', color: null };
}
// 구매 불가 사유(표시용 짧은 문구). 사유가 없으면 ''. 판정 자체는 기존 shopBuyMaxQty(골드·슬롯·보유 여부)를 그대로 사용함.
function shopMenuBuyBlockedTag(action, typeId){
  if(shopBuyMaxQty(action, typeId) > 0) return null;
  if(action === 'buy-artifact' && ownsArtifact(typeId)) return '보유 중';
  if(action === 'buy-weapon' && equipInventoryFull()) return '인벤토리 가득참';
  if(action === 'buy-consumable' && !canAcquireInCategory('consumable', ((state.consumables && state.consumables[typeId]) || 0) > 0)) return '인벤토리 가득참';
  if(action === 'buy-artifact' && inventoryCategoryFull('artifact')) return '인벤토리 가득참';
  return ''; // 골드 부족 등: 문구 없이 흐리게만 표시
}

// 구매 탭: 세부 분류(leaf)별 구매 가능 목록. 장비/아티팩트는 기존 shopEntriesForTab(purchasable / buyPrice 규칙), 소비는 buyPrice가 있는 것만.
// 마석/기타는 구매 개념이 없음(MISC_ITEMS에 구매가 없음) → 구매 탭에는 나타나지 않음.
function shopMenuBuyRows(leaf){
  let base = [];
  if(leaf === 'consumable') base = Object.values(CONSUMABLES).filter(c => c.buyPrice != null).map(c => ({ id: c.id, price: c.buyPrice, levelReq: null, action: 'buy-consumable' }));
  else if(['weapon', 'armor', 'sub', 'accessory'].includes(leaf)) base = shopEntriesForTab(leaf).map(e => ({ ...e, action: 'buy-weapon' }));
  else if(leaf === 'artifact') base = shopEntriesForTab(leaf).map(e => ({ ...e, action: 'buy-artifact' }));
  return base.map(b => {
    const d = shopBuyItemDisplay(b.action, b.id); // 아이콘/툴팁은 구매 팝업과 같은 함수
    let name, color, pre = '', border = d.borderColor, bg = '#242424';
    if(b.action === 'buy-weapon'){ name = wpn(b.id).name; color = weaponNameColor(b.id, 0); }
    else if(b.action === 'buy-artifact'){ name = ARTIFACTS[b.id].name; color = artifactNameColor(b.id); border = color; }
    else {
      const item = CONSUMABLES[b.id]; const look = shopMenuConsumableLook(item); const parts = shopMenuConsumableNameParts(item);
      name = item.name; pre = parts.pre; color = parts.color || look.name; border = look.border; bg = look.bg;
    }
    const tag = shopMenuBuyBlockedTag(b.action, b.id);
    return { key: `buy:${b.action}:${b.id}`, mode: 'buy', name, namePre: pre, nameSuf: '', color, iconHtml: d.iconHtml, border, bg, tip: d.tooltipHtml,
      price: b.price, levelReq: b.levelReq, action: b.action, typeId: b.id, unavailable: tag !== null, tag: tag || '' };
  });
}

// 판매 탭: 플레이어가 실제로 보유한 것 중 상점에 팔 수 있는 것만.
//  - 장비: 보유 장비 인스턴스 하나하나(기존 인벤토리 판매와 같은 가격 공식 durabilityAdjustedSellValue). 잠긴 장비는 판매 불가라 제외. 아티팩트는 판매 기능이 없어 제외.
//  - 소비 / 마석 / 기타: 보유 수량 1개 이상(기존 상점 판매 규칙: sell-consumable / sell-misc).
function shopMenuSellRows(leaf, ctx){
  const out = [];
  ctx.equip.filter(e => e.src === leaf && !e.locked).forEach(e => {
    out.push({ key: `sell:equip:${e.src}:${e.id}`, mode: 'sell', name: e.name, namePre: '', nameSuf: shopMenuEsc(`${e.item.damaged ? '(손상)' : ''}${e.item.level > 0 ? ' +' + e.item.level : ''}`), color: e.borderColor, iconHtml: e.iconHtml, border: e.borderColor, bg: '#242424',
      tip: e.tooltipHtml, price: e.price, levelReq: e.def.levelReq || 1, action: 'sell-equip', src: e.src, id: e.id, qty: null, unavailable: false, tag: '' });
  });
  if(leaf === 'consumable'){
    Object.values(CONSUMABLES).forEach(item => {
      const owned = (state.consumables && state.consumables[item.id]) || 0;
      if(owned <= 0 || item.sellPrice == null) return;
      const d = shopBuyItemDisplay('sell-consumable', item.id); const look = shopMenuConsumableLook(item); const parts = shopMenuConsumableNameParts(item);
      out.push({ key: `sell:sell-consumable:${item.id}`, mode: 'sell', name: item.name, namePre: parts.pre, nameSuf: '', color: parts.color || look.name, iconHtml: d.iconHtml, border: look.border, bg: look.bg,
        tip: d.tooltipHtml, price: item.sellPrice, levelReq: null, action: 'sell-consumable', typeId: item.id, qty: owned, unavailable: false, tag: '' });
    });
  }
  Object.values(MISC_ITEMS).filter(m => m.itemClass === leaf && (state[m.stateKey] || 0) > 0).forEach(item => {
    const d = shopBuyItemDisplay('sell-misc', item.id);
    out.push({ key: `sell:sell-misc:${item.id}`, mode: 'sell', name: item.name, namePre: '', nameSuf: '', color: d.borderColor, iconHtml: d.iconHtml, border: d.borderColor, bg: '#242424',
      tip: d.tooltipHtml, price: item.sellPrice, levelReq: null, action: 'sell-misc', typeId: item.id, qty: state[item.stateKey] || 0, unavailable: false, tag: '' });
  });
  return out;
}

// 지금 모드에서 표시 가능한 모든 행(분류 정보 포함). SHOP_TABS 순서대로 모음.
function shopMenuBuildRows(mode){
  const rows = [];
  const ctx = { equip: mode === 'sell' ? invBoxEquipEntries() : [] };
  SHOP_TABS.forEach(top => shopMenuLeafIds(top).forEach(leaf => {
    (mode === 'sell' ? shopMenuSellRows(leaf, ctx) : shopMenuBuyRows(leaf)).forEach(r => { r.cat = top.id; r.leaf = leaf; rows.push(r); });
  }));
  return rows;
}

// 분류/세부 분류 값이 현재 표시 가능한 아이템과 맞는지 보정하고, 탭 목록을 계산함(아이템이 하나도 없는 분류는 탭을 만들지 않음).
function shopMenuLayout(rows){
  const m = shopMenuUI.mode;
  const tops = SHOP_TABS.filter(t => rows.some(r => r.cat === t.id));
  if(!tops.some(t => t.id === shopMenuUI.cat[m])) shopMenuUI.cat[m] = tops.length ? tops[0].id : null;
  const top = tops.find(t => t.id === shopMenuUI.cat[m]) || null;
  let subs = [];
  if(top && top.subTabs) subs = top.subTabs.filter(s => rows.some(r => r.leaf === s.id));
  let leaf = null;
  if(top){
    const leafIds = top.subTabs ? subs.map(s => s.id) : [top.id];
    const remembered = shopMenuUI.leafByTop[m][top.id];
    leaf = leafIds.includes(remembered) ? remembered : (leafIds[0] || null);
    shopMenuUI.leafByTop[m][top.id] = leaf;
  }
  shopMenuUI.leaf[m] = leaf;
  return { tops, top, subs, leaf };
}

// ---- 렌더 ----
function shopMenuSet(id, html){ // 내용이 같으면 다시 그리지 않음(열려 있는 드롭다운/스크롤/호버 중인 툴팁 유지)
  const box = el(id);
  if(!box) return false;
  if(shopMenuUI.cache[id] === html) return false;
  shopMenuUI.cache[id] = html;
  box.innerHTML = html;
  return true;
}
// 검색어와 일치하는 이름 글자 강조 — 도감/신버전 인벤토리 검색과 같은 함수(codexHighlightHtml, .codex-hl)를 그대로 사용.
// 구매/판매 검색어는 모드별로 따로 저장되므로 그 행이 속한 모드(r.mode)의 검색어만 적용됨.
function shopMenuHighlight(r){
  return codexHighlightHtml(r.name, shopMenuUI.query[r.mode] || '');
}
function shopMenuRowHtml(r){
  shopMenuUI.tipByKey[r.key] = r.tip;
  shopMenuUI.rowByKey[r.key] = r;
  const count = r.qty != null ? ` <span class="shop-row-count">×${r.qty.toLocaleString()}</span>` : '';
  const priceText = (r.qty != null ? '<span class="shop-row-unit">개당</span> ' : '') + goldHtml(r.price.toLocaleString());
  const tag = r.tag ? `<span class="shop-row-tag">${shopMenuEsc(r.tag)}</span>` : '';
  const nameStyle = r.color ? ` style="color:${r.color};"` : '';
  const cls = r.unavailable ? ' unavailable' : '';
  return `<div class="shop-row${cls}" data-key="${shopMenuEsc(r.key)}" data-action="${r.action}" data-type="${shopMenuEsc(String(r.typeId != null ? r.typeId : r.id))}">`
    + `<span class="shop-row-icon" style="border-color:${r.border || 'var(--forge-line)'}; background:${r.bg};">${r.iconHtml}</span>`
    + `<span class="shop-row-info"><span class="shop-row-name"><span class="shop-row-name-in"${nameStyle}>${r.namePre}${shopMenuHighlight(r)}${r.nameSuf}${count}</span></span><span class="shop-row-price">${priceText}${tag}</span></span>`
    + `</div>`;
}
function shopMenuQueryNorm(){ return (shopMenuUI.query[shopMenuUI.mode] || '').trim().toLowerCase(); }

function shopMenuRender(){
  if(!el('shopNewWrap')) return;
  const m = shopMenuUI.mode;
  const rows = shopMenuBuildRows(m);
  const { tops, top, subs, leaf } = shopMenuLayout(rows);

  // 구매/판매 탭 + 소유 골드(신버전 인벤토리 골드 표시와 같은 서식)
  shopMenuSet('shopModeTabs', SHOP_MODES.map(x => `<button class="shop-mode-tab ${x.id === m ? 'active' : ''}" data-mode="${x.id}">${shopMenuEsc(x.label)}</button>`).join(''));
  shopMenuSet('shopGold', `소유 골드 <span class="inv-box-gold-val"><b>${state.gold.toLocaleString()}</b>${uiIconHtml('gold', 'ui-icon-inline')}</span>`);
  // 분류 탭(장비/소비/마석/기타) — 표시 가능한 아이템이 있는 분류만 / 세부 분류(장비) — 같은 규칙
  shopMenuSet('shopCatTabs', tops.map(t => `<button class="inv-box-tab shop-cat-tab ${top && t.id === top.id ? 'active' : ''}" data-cat="${t.id}">${shopMenuEsc(t.label)}</button>`).join(''));
  const subWrap = el('shopSubTabs');
  subWrap.style.display = top && top.subTabs && subs.length ? 'flex' : 'none';
  shopMenuSet('shopSubTabs', subs.map(s => `<button class="shop-sub-tab ${s.id === leaf ? 'active' : ''}" data-leaf="${s.id}">${shopMenuEsc(s.label)}</button>`).join(''));
  // 필터(기존 가격/착용 제한 레벨 + 오름차순/내림차순)
  const filterDef = SHOP_SORT_FIELDS.find(f => f.id === shopUI.filter) || SHOP_SORT_FIELDS[0];
  el('shopNewFilterLabel').textContent = filterDef.label;
  el('shopNewSortDirBtn').textContent = shopUI.dir === 'asc' ? '↑ 오름차순' : '↓ 내림차순';
  shopMenuSet('shopNewFilterMenu', SHOP_SORT_FIELDS.map(f => `<button class="shop-filter-item ${shopUI.filter === f.id ? 'active' : ''}" data-filter="${f.id}">${shopMenuEsc(f.label)}</button>`).join(''));
  el('shopNewFilterMenu').style.display = shopMenuUI.filterOpen ? 'block' : 'none';
  // 빠른 구매/판매(구매·판매 공통 하나의 설정 — 문구만 모드에 맞춤)
  el('shopQuickLabel').textContent = shopMenuModeDef().quickLabel;
  el('shopQuickTrade').checked = !!(state.settings && state.settings.shopQuickTrade);

  // 목록: 검색어가 있으면 이 모드의 모든 분류에서 이름이 맞는 아이템(탭 선택과 무관), 없으면 선택한 세부 분류의 아이템
  const q = shopMenuQueryNorm();
  const list = q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows.filter(r => r.leaf === leaf);
  const sorted = sortShopEntries(list, shopUI.filter, shopUI.dir);
  shopMenuUI.tipByKey = {}; shopMenuUI.rowByKey = {};
  const html = sorted.length
    ? sorted.map(shopMenuRowHtml).join('')
    : `<div class="inv-empty">${q ? '검색 결과가 없습니다.' : (m === 'sell' ? '판매할 수 있는 아이템이 없습니다.' : '구매할 수 있는 아이템이 없습니다.')}</div>`;
  const scroller = el('shopListScroll');
  const prev = scroller.scrollTop;
  const changed = shopMenuSet('shopList', html);
  if(changed && typeof codexHideTip === 'function') codexHideTip(); // 다시 그린 행에 붙어 있던 툴팁은 닫음
  if(shopMenuUI.resetScroll){ scroller.scrollTop = 0; shopMenuUI.resetScroll = false; }
  else if(changed) scroller.scrollTop = prev;
}
// 상점 화면에 들어올 때(navigation.js showView)
function shopMenuOpen(){
  shopMenuUI.cache = {};
  shopMenuUI.filterOpen = false;
  shopMenuUI.resetScroll = true;
  shopMenuSyncSearchInput();
  shopMenuRender();
}
// render()가 불릴 때마다(골드/보유 수량이 바뀐 경우 등) 호출 — 상점 화면이 아니면 아무것도 안 함. 바뀐 부분만 다시 그림.
function shopMenuRefresh(){
  if(currentView !== 'shop') return;
  shopMenuRender();
}

// ---- 검색(구매/판매 탭별로 독립) ----
function shopMenuSyncSearchInput(){
  const input = document.getElementById('shopSearchInput');
  if(input) input.value = shopMenuUI.query[shopMenuUI.mode] || '';
}
function shopMenuSearchReset(){ // 상점 메뉴를 나가면 두 모드의 검색어를 모두 초기화(인벤토리 검색과 동일)
  SHOP_MODES.forEach(m => { shopMenuUI.query[m.id] = ''; });
  shopMenuSyncSearchInput();
}

// ---- 조작 ----
function shopMenuSwitchMode(mode){
  if(shopMenuUI.mode === mode) return;
  shopMenuUI.mode = mode;
  shopMenuUI.filterOpen = false;
  shopMenuUI.resetScroll = true;
  codexHideTip();
  shopMenuSyncSearchInput(); // 입력창은 그 모드의 검색어로(구매/판매 검색 상태가 섞이지 않음)
  shopMenuRender();
}
function shopMenuClearQuery(){ // 탭을 직접 고르면 검색 결과 보기를 끝내고 그 탭의 목록을 보여줌
  shopMenuUI.query[shopMenuUI.mode] = '';
  shopMenuSyncSearchInput();
}
function shopMenuSwitchCat(cat){
  shopMenuClearQuery();
  shopMenuUI.cat[shopMenuUI.mode] = cat;
  shopMenuUI.filterOpen = false;
  shopMenuUI.resetScroll = true;
  shopMenuRender();
}
function shopMenuSwitchLeaf(leaf){
  shopMenuClearQuery();
  const m = shopMenuUI.mode;
  const top = SHOP_TABS.find(t => t.id === shopMenuUI.cat[m]);
  if(top) shopMenuUI.leafByTop[m][top.id] = leaf;
  shopMenuUI.filterOpen = false;
  shopMenuUI.resetScroll = true;
  shopMenuRender();
}
function shopMenuSetFilter(filterId){
  shopUI.filter = filterId;
  shopMenuUI.filterOpen = false;
  shopMenuUI.resetScroll = true;
  shopMenuRender();
}
function shopMenuToggleDir(){
  shopUI.dir = shopUI.dir === 'asc' ? 'desc' : 'asc';
  shopMenuUI.resetScroll = true;
  shopMenuRender();
}

// 이름/가격 영역 클릭(또는 탭) → 기존 구매/판매 수량 입력 UI 호출. 장비 판매는 수량 입력이 없는 기존 흐름(판매 확인창)을 그대로 따르며,
// [빠른 판매]가 켜져 있으면 확인창만 생략하고 기존 판매 처리 함수(perform*)를 호출함.
const SHOP_EQUIP_SELL_FUNCS = {
  weapon: { ask: id => sellItem(id), run: id => performSellItem(id) },
  armor: { ask: id => sellArmorItem(id), run: id => performSellArmorItem(id) },
  sub: { ask: id => sellSubItem(id), run: id => performSellSubItem(id) },
  accessory: { ask: id => sellAccessoryItem(id), run: id => performSellAccessoryItem(id) },
};
function shopMenuActivate(key){
  const r = shopMenuUI.rowByKey[key];
  if(!r || r.unavailable) return;
  codexHideTip();
  if(r.action === 'sell-equip'){
    const f = SHOP_EQUIP_SELL_FUNCS[r.src];
    if(!f || isEnhancing) return;
    if(state.settings && state.settings.shopQuickTrade) f.run(r.id); else f.ask(r.id);
    return;
  }
  openBuyQtyModal(r.action, r.typeId);
}

// 툴팁: 아이콘 기준 고정 위치 툴팁(스크롤 영역 안에서 잘리지 않도록 도감과 같은 방식)
function shopMenuShowTip(key){
  const row = el('shopList').querySelector(`.shop-row[data-key="${key}"]`);
  const tip = shopMenuUI.tipByKey[key];
  if(row && tip) codexShowTipHtml(row.querySelector('.shop-row-icon'), tip, key);
}

(function shopMenuInit(){
  const wrap = el('shopNewWrap');
  if(!wrap) return;
  document.body.classList.toggle('shop-ui-new', SHOP_MENU_UI === 'new');

  el('shopModeTabs').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-mode]'); if(b) shopMenuSwitchMode(b.dataset.mode); });
  el('shopCatTabs').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-cat]'); if(b) shopMenuSwitchCat(b.dataset.cat); });
  el('shopSubTabs').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-leaf]'); if(b) shopMenuSwitchLeaf(b.dataset.leaf); });

  // 필터(기존 상점 필터와 같은 동작: 드롭다운으로 기준 선택 + 방향 토글)
  el('shopNewFilterBtn').addEventListener('click', () => { shopMenuUI.filterOpen = !shopMenuUI.filterOpen; el('shopNewFilterMenu').style.display = shopMenuUI.filterOpen ? 'block' : 'none'; });
  el('shopNewFilterMenu').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-filter]'); if(b) shopMenuSetFilter(b.dataset.filter); });
  el('shopNewSortDirBtn').addEventListener('click', shopMenuToggleDir);
  document.addEventListener('click', (ev) => {
    if(!shopMenuUI.filterOpen || ev.target.closest('.shop-new-sort')) return;
    shopMenuUI.filterOpen = false;
    el('shopNewFilterMenu').style.display = 'none';
  });

  // 빠른 구매/판매(공통 설정 1개, 저장)
  el('shopQuickTrade').addEventListener('change', () => {
    state.settings.shopQuickTrade = el('shopQuickTrade').checked;
    saveState();
  });

  // 검색: 입력하는 즉시 현재 모드의 목록이 검색 결과로 바뀜. 검색창을 다시 선택하면 초기화(인벤토리 검색과 동일).
  const input = el('shopSearchInput');
  input.addEventListener('input', () => {
    shopMenuUI.query[shopMenuUI.mode] = input.value;
    shopMenuUI.resetScroll = true;
    shopMenuRender();
  });
  input.addEventListener('focus', () => {
    if(!input.value && !shopMenuUI.query[shopMenuUI.mode]) return;
    input.value = '';
    shopMenuUI.query[shopMenuUI.mode] = '';
    shopMenuUI.resetScroll = true;
    shopMenuRender();
  });

  // 목록: 이름/가격 영역 클릭 = 기존 구매/판매 수량 입력 UI(데스크톱·모바일 공통). 아이콘 클릭은 아무 동작 없음(모바일에서는 툴팁만, 아래).
  el('shopList').addEventListener('click', (ev) => {
    const row = ev.target.closest('.shop-row');
    if(row && ev.target.closest('.shop-row-info')) shopMenuActivate(row.dataset.key);
  });
  // 툴팁 — 데스크톱 프리셋: 아이콘/이름·가격 어디든 마우스를 올리면 표시. 모바일 프리셋: 마우스 이벤트(터치 뒤 따라오는 mouseover)는 무시하고,
  // 아이콘을 한 번 터치했을 때만 표시(이름/가격 영역을 터치해도 툴팁은 뜨지 않고 바로 수량 입력 UI로 감).
  wrap.addEventListener('mouseover', (ev) => {
    if(shopMenuIsMobile()) return;
    const row = ev.target.closest('.shop-row');
    if(!row || (ev.relatedTarget && row.contains(ev.relatedTarget))) return;
    shopMenuShowTip(row.dataset.key);
  });
  wrap.addEventListener('mouseout', (ev) => {
    if(shopMenuIsMobile()) return;
    const row = ev.target.closest('.shop-row');
    if(!row || (ev.relatedTarget && row.contains(ev.relatedTarget))) return;
    codexHideTip();
  });
  // 터치 탭의 click 뒤에 도감의 전역 click 처리(codex.js)가 툴팁을 닫아 버리므로, 클릭 처리가 끝난 뒤(setTimeout 0) 눌렀던 아이콘의 툴팁을 다시 띄움(제작소와 같은 방식).
  wrap.addEventListener('click', (ev) => {
    if(!shopMenuIsMobile()) return;
    const icon = ev.target.closest('.shop-row-icon');
    const row = icon && icon.closest('.shop-row');
    if(!row) return;
    const key = row.dataset.key;
    setTimeout(() => shopMenuShowTip(key), 0);
  }, true);
  el('shopListScroll').addEventListener('scroll', () => codexHideTip());
})();
