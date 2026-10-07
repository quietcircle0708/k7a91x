// ============================================================
// inventory_box.js — 신버전(박스) 인벤토리 UI
// 설정(인벤토리 UI)에서 '신버전(박스)'를 선택했을 때만 표시됨(render.js의 INVENTORY_UI_RENDERERS에 등록).
// 구버전(세로) 인벤토리 코드/DOM은 그대로 두고, 이 파일은 "표시/조작 UI"만 새로 만듦 — 아이템 데이터, 획득/저장,
// 장착·강화 선택·판매·소비 사용 등 실제 처리는 전부 기존 함수(equipItem/equipArmorPiece/sellItem/useFlask 등)를
// 그대로 호출하므로 게임 로직 결과는 구버전과 완전히 같음.
// ============================================================

// ---- 레이아웃 상수 ----
const INV_BOX_COLUMNS = 8;
const INV_BOX_ROWS = 8;
const INV_BOX_SLOTS_PER_PAGE = INV_BOX_COLUMNS * INV_BOX_ROWS; // 슬롯 영역에 한 번에 보이는 칸 수 = 8×8 = 64칸(이름은 예전 페이지 구조의 흔적). 이 칸 수를 넘는 슬롯이 생길 때만
                                                               // 슬롯 영역이 스크롤됨. 실제 카테고리별 최대 슬롯(INV_MAX, data.js)은 현재 64라 평소에는 스크롤이 생기지 않음(용량 규칙은 구버전과 공용 — formulas.js 참고)
const INV_BOX_DOUBLE_CLICK_MS = 320; // 같은 슬롯을 이 시간 안에 두 번 누르면 더블 클릭(마우스/터치 공통)으로 처리

// 신버전 탭 5개. 장비 소분류(무기/방어구/보조/장신구)는 쓰지 않고 장비 탭 하나에 전부 표시하며, 아티팩트는
// 실제 데이터(state.artifacts)는 그대로 두고 UI에서만 별도 탭으로 분리함.
const INV_BOX_TABS = [
  { id: 'equipment', label: '장비' },
  { id: 'artifact', label: '아티팩트' },
  { id: 'consumable', label: '소비' },
  { id: 'stone', label: '마석' },
  { id: 'misc', label: '기타' },
];

// ---- 정렬 ----
// 구버전 인벤토리와 같은 공용 정렬(data.js의 INV_SORT_*, formulas.js의 invSortList 등)을 사용함 — 이 파일에는 정렬 기준/종류 순서를
// 따로 두지 않음. 탭별로 고른 기준은 state.invSort에 저장되고(화면을 나갔다 와도 유지), 기준을 고르지 않은 기본 상태는 높은 등급 먼저.
// 엔트리는 아래 엔트리 빌더가 공용 invSortInfo*로 채운 kindKey/gradeRank/price/level을 가짐.
// 장비 탭의 \"착용 장비 우선 정렬\" 체크가 켜져 있으면 착용 중인 장비를 맨 앞(착용 슬롯 순서: INV_SORT_WORN_SLOT_ORDER)에 두고,
// 나머지는 선택한 기준대로 이어서 정렬함. 보유 데이터 배열은 바꾸지 않고 표시 순서만 바뀜.
function invBoxSortEntries(entries, tab){
  let list = invSortList(tab, entries, e => e);
  if(tab === 'equipment' && invSortWornFirstOn()){
    const worn = list.filter(e => e.equipped).sort((x, y) => invWornSlotRank(x.src, x.id) - invWornSlotRank(y.src, y.id));
    list = worn.concat(list.filter(e => !e.equipped));
  }
  return list;
}
// 정렬 드롭다운(탭별 기준)과 장비 탭 전용 착용 우선 체크(하단 슬롯 수량 오른쪽에 있음)를 현재 탭에 맞게 채움.
function invBoxRenderSortControls(tab){
  const wrap = el('invBoxSortWrap');
  if(wrap){
    const html = invSortSelectHtml(tab);
    if(wrap.dataset.sortHtml !== html){ wrap.innerHTML = html; wrap.dataset.sortHtml = html; } // 같으면 다시 그리지 않음(열려 있는 드롭다운 유지)
  }
  const checkWrap = el('invBoxWornFirstWrap');
  if(checkWrap){
    checkWrap.style.display = tab === 'equipment' ? '' : 'none';
    const cb = el('invBoxWornFirst');
    if(cb) cb.checked = invSortWornFirstOn();
  }
}

// ---- UI 상태(저장하지 않는 화면 상태) ----
// entriesByKey: 마지막으로 그린 슬롯 key → 엔트리(클릭 처리용). query/resultsOpen: 인벤토리 검색어와 결과 드롭다운 열림 여부(탭을 옮겨도 유지,
// 인벤토리 메뉴를 나가면 invBoxSearchReset으로 초기화). focusKey: 검색 결과로 이동한 아이템(한 번만 강조). lastTab/resetScroll: 슬롯 영역 스크롤 위치 복원용.
let invBoxUI = { tab: 'equipment', query: '', resultsOpen: false, focusKey: null, lastTab: null, resetScroll: false, cellCount: 0, searchByKey: {}, popupKey: null, lastClick: { key: null, time: 0 }, entriesByKey: {} };

// ---- 아이템 비교 모드(신버전·장비 전용, 저장하지 않는 일시적 조작 모드) ----
// on: 비교 모드 여부 / baseKey: 비교 기준 장비 A(최초에 \'아이템 비교\'를 누른 장비) / group: A의 장비 대분류(invCompareGroup) /
// targetKey: 비교 대상 장비 B(없으면 \'비교 대상 선택 상태\', 있으면 비교 팝업이 열려 있음). [변경]은 targetKey만 비우고 A는 유지함.
// 인벤토리 메뉴를 벗어나면 navigation.js showView가 invCompareReset()을 호출해 모드·기준·대상·커서를 모두 초기화함.
let invCompare = { on: false, baseKey: null, group: null, targetKey: null, levelA: null, levelB: null }; // levelA/levelB: 비교 화면에서만 쓰는 A/B 표시용 강화 단계(실제 장비 데이터는 바꾸지 않음)
function invCompareReset(){
  invCompare = { on: false, baseKey: null, group: null, targetKey: null, levelA: null, levelB: null };
  if(typeof invCompareCursorSync === 'function') invCompareCursorSync(); // 돋보기 커서 원상복구
  const panel = document.getElementById('invBoxCompare');
  if(panel){ panel.style.display = 'none'; panel.innerHTML = ''; }
}
function invCompareStart(entry){
  const group = invCompareGroup(entry);
  if(!group) return;
  invBoxClosePopup();
  invCompare = { on: true, baseKey: entry.key, group, targetKey: null, levelA: entry.item.level || 0, levelB: null }; // A의 시작 단계 = 실제 강화 단계([변경]으로 B만 바꿔도 A의 단계는 유지)
  if(typeof invCompareCursorSync === 'function') invCompareCursorSync();
  render();
}

// ---- 표시용 엔트리 만들기 ----
// 기존 아이템 데이터/인스턴스를 그대로 읽어 슬롯 표시용 객체로만 변환함(새 데이터 구조를 저장하지 않음).
// 엔트리 공통 필드: key(슬롯 식별), src(종류별 처리기 key), id, kindKey/gradeRank/price/level(정렬용 — 공용 invSortInfo*), iconHtml/tooltipHtml/
// borderColor/qty(표시용), equipped(실제 장착 여부 — 이름이 아니라 기존 착용 상태 판정 함수로 계산).
function invBoxEquipEntries(){
  const out = [];
  const sources = [
    { src: 'weapon', list: state.inventory || [] },
    { src: 'armor', list: state.armorInventory || [] },
    { src: 'sub', list: state.subInventory || [] },
    { src: 'accessory', list: state.accessoryInventory || [] },
  ];
  sources.forEach(({ src, list }) => {
    list.forEach(item => {
      const type = item.type || 'longsword';
      const def = wpn(type);
      const info = equipInstanceDisplayInfo(item, type); // 아이콘/등급색/툴팁 — 구버전 카드와 동일 함수
      out.push({
        key: src + ':' + item.id, src, id: item.id, item, type, def, name: info.name, nameSuffix: `${item.damaged ? '(손상)' : ''}${item.level > 0 ? ' +' + item.level : ''}`, // name: 검색 대상(기본 이름)
        ...invSortInfoEquip(src, item), // kindKey/gradeRank/price/level — 구버전 정렬과 같은 공용 함수
        iconHtml: info.iconHtml, tooltipHtml: info.tooltipHtml, borderColor: info.color, qty: null,
        nameHtml: `<span style="color:${info.color};">${info.name}${item.damaged ? '(손상)' : ''}${item.level > 0 ? ' +' + item.level : ''}</span>`,
        equipped: isEquipInstanceWorn(src, item.id), locked: !!item.locked, // locked: 잠금 상태(구버전과 같은 item.locked)
      });
    });
  });
  return out;
}
function invBoxArtifactEntries(){
  return (state.artifacts || []).filter(id => ARTIFACTS[id]).map(id => {
    const a = ARTIFACTS[id];
    const color = artifactNameColor(id);
    return {
      key: 'artifact:' + id, src: 'artifact', id, item: a, type: id, name: a.name,
      ...invSortInfoArtifact(id),
      iconHtml: itemIconHtml(a, 'inv-icon-img'), tooltipHtml: buildArtifactTooltipHtml(id), borderColor: color, qty: null,
      nameHtml: `<span style="color:${color};">${a.name}</span>`,
      equipped: isArtifactEquipped(id),
    };
  });
}
function invBoxConsumableEntries(){
  const out = [];
  Object.values(CONSUMABLES).forEach(item => {
    const count = (state.consumables && state.consumables[item.id]) || 0;
    if(count <= 0) return;
    const scroll = isScrollItem(item);
    const g = scroll ? scrollGradeInfo(item) : null;
    out.push({
      key: 'consumable:' + item.id, src: 'consumable', id: item.id, item, type: item.id, name: item.name,
      ...invSortInfoConsumable(item),
      iconHtml: itemIconHtml(item, 'inv-icon-img'), tooltipHtml: buildConsumableTooltipHtml(item.id),
      borderColor: g ? g.color : 'var(--forge-line)', qty: count,
      nameHtml: consumableNameHtml(item), equipped: false,
    });
  });
  // 흔적은 CONSUMABLES 같은 정적 표가 아니라 개별 인스턴스(state.traceInventory)라 장비처럼 슬롯 1개씩 차지함.
  (state.traceInventory || []).forEach(t => {
    const name = `${weaponName(t.forType)}의 흔적`;
    out.push({
      key: 'trace:' + t.id, src: 'trace', id: t.id, item: t, type: t.forType, name,
      ...invSortInfoTrace(),
      iconHtml: weaponIconHtml(t.forType, 'inv-icon-img'),
      tooltipHtml: `<div>${name}</div><div style="color:var(--forge-cream-dim);">단련의 힘을 견디지 못한 ${weaponName(t.forType)}의 흔적</div>`,
      borderColor: 'var(--forge-line)', qty: null, nameHtml: name, equipped: false,
    });
  });
  return out;
}
function invBoxMiscEntries(itemClass){
  const isStone = itemClass === 'stone';
  return Object.values(MISC_ITEMS)
    .filter(item => item.itemClass === itemClass)
    .map(item => ({ item, count: state[item.stateKey] || 0 }))
    .filter(e => e.count > 0)
    .map(({ item, count }) => {
      const color = isStone ? stoneNameColor(item.id) : miscNameColor(item.id);
      return {
        key: itemClass + ':' + item.id, src: itemClass, id: item.id, item, type: item.id, name: item.name,
        ...invSortInfoMisc(item, itemClass),
        iconHtml: itemIconHtml(item, 'inv-icon-img'),
        tooltipHtml: isStone ? buildStoneTooltipHtml(item.id) : buildMiscTooltipHtml(item.id),
        borderColor: color, qty: count, nameHtml: `<span style="color:${color};">${item.name}</span>`, equipped: false,
      };
    });
}
function invBoxBuildEntries(tab){
  if(tab === 'equipment') return invBoxEquipEntries();
  if(tab === 'artifact') return invBoxArtifactEntries();
  if(tab === 'consumable') return invBoxConsumableEntries();
  if(tab === 'stone') return invBoxMiscEntries('stone');
  if(tab === 'misc') return invBoxMiscEntries('misc');
  return [];
}

// ---- 아이템 팝업(클릭 시) ----
// 기존 프로젝트에는 인벤토리 아이콘을 눌렀을 때 뜨는 전용 팝업이 없고, 구버전 카드의 버튼(착용/강화 선택/판매/사용하기)이
// 카드에 직접 붙어 있었음 — 그래서 여기서는 새 기능을 만들지 않고 "구버전 카드와 같은 버튼 구성/활성 조건/기존 처리 함수"
// 를 그대로 팝업에 담아 보여줌. 종류(src)별 제공자(INV_BOX_ACTION_PROVIDERS)가 { id, label, run, disabled, reason,
// active, quickEquip } 목록을 돌려주는 구조라, 이후 팝업 기능을 늘릴 때는 제공자에 항목만 추가하면 됨.
function invBoxReqReason(type){
  return '착용 조건을 만족해야 장착할 수 있습니다.' + (weaponRequirementText(type) ? ` (${weaponRequirementText(type)})` : '');
}
const INV_BOX_ACTION_PROVIDERS = {
  // 무기는 방어구/장신구와 같은 구조: 착용(착용 해제)과 강화 선택이 서로 독립된 동작이고, 구버전 카드와 같은 공통 함수
  // (equipWeaponPiece/unequipWeaponPiece, selectForgeTargetFromInventory — actions.js)를 호출함.
  weapon: (e) => {
    const reqOk = meetsWeaponEquipRequirements(e.type, state.playerLevel, effectiveStats());
    const blocked = !e.equipped && e.def.handType === 'two_hand' && !canEquipTwoHandedWeapon();
    const isForgeTarget = e.id === state.forgeTargetId;
    return [
      { id: 'wear', label: e.equipped ? '착용 해제' : '착용', active: e.equipped, quickEquip: true,
        disabled: !e.equipped && (!reqOk || blocked),
        reason: (!e.equipped && !reqOk) ? invBoxReqReason(e.type) : (blocked ? '보조 아이템을 장착 중에는 양손 무기를 장착할 수 없습니다.' : ''),
        run: () => e.equipped ? unequipWeaponPiece(e.id) : equipWeaponPiece(e.id) },
      { id: 'forge', label: isForgeTarget ? '강화 대상' : '강화 선택', active: isForgeTarget,
        disabled: isForgeTarget || !reqOk || e.locked, reason: e.locked ? INV_LOCKED_REASON : ((!isForgeTarget && !reqOk) ? invBoxReqReason(e.type) : ''),
        run: () => selectForgeTargetFromInventory(e.id) },
      { id: 'compare', label: '아이템 비교', run: () => invCompareStart(e) }, // 잠긴 장비도 비교 가능(잠금과 무관)
      { id: 'sell', label: `판매 (${e.price.toLocaleString()}G)`, variant: 'sell', disabled: !!e.locked, reason: e.locked ? INV_LOCKED_REASON : '', run: () => sellItem(e.id) },
    ];
  },
  armor: (e) => {
    const reqOk = meetsWeaponEquipRequirements(e.type, state.playerLevel, effectiveStats());
    const isForgeTarget = e.id === state.forgeTargetId;
    return [
      { id: 'wear', label: e.equipped ? '착용 해제' : '착용', active: e.equipped, quickEquip: true,
        disabled: !e.equipped && !reqOk, reason: (!e.equipped && !reqOk) ? invBoxReqReason(e.type) : '',
        run: () => e.equipped ? unequipArmorPiece(e.id) : equipArmorPiece(e.id) },
      { id: 'forge', label: isForgeTarget ? '강화 대상' : '강화 선택', active: isForgeTarget,
        disabled: isForgeTarget || !reqOk || e.locked, reason: e.locked ? INV_LOCKED_REASON : ((!isForgeTarget && !reqOk) ? invBoxReqReason(e.type) : ''),
        run: () => selectForgeTargetFromInventory(e.id) },
      { id: 'compare', label: '아이템 비교', run: () => invCompareStart(e) }, // 잠긴 장비도 비교 가능(잠금과 무관)
      { id: 'sell', label: `판매 (${e.price.toLocaleString()}G)`, variant: 'sell', disabled: !!e.locked, reason: e.locked ? INV_LOCKED_REASON : '', run: () => sellArmorItem(e.id) },
    ];
  },
  sub: (e) => {
    const reqOk = meetsWeaponEquipRequirements(e.type, state.playerLevel, effectiveStats());
    const canWear = !e.equipped && reqOk && canEquipSubItem();
    let reason = '';
    if(!e.equipped && !reqOk) reason = invBoxReqReason(e.type);
    else if(!e.equipped && reqOk && !canEquipSubItem()) reason = '양손 무기를 장착 중에는 보조 아이템을 장착할 수 없습니다.';
    return [
      { id: 'wear', label: e.equipped ? '착용 해제' : '착용', active: e.equipped, quickEquip: true,
        disabled: !e.equipped && !canWear, reason,
        run: () => e.equipped ? unequipSubPiece(e.id) : equipSubPiece(e.id) },
      { id: 'compare', label: '아이템 비교', run: () => invCompareStart(e) }, // 잠긴 장비도 비교 가능(잠금과 무관)
      { id: 'sell', label: `판매 (${e.price.toLocaleString()}G)`, variant: 'sell', disabled: !!e.locked, reason: e.locked ? INV_LOCKED_REASON : '', run: () => sellSubItem(e.id) }, // 보조는 강화 선택 버튼 없음
    ];
  },
  accessory: (e) => {
    const reqOk = meetsWeaponEquipRequirements(e.type, state.playerLevel, effectiveStats());
    const isNecklace = e.def.accessoryKind === 'necklace'; // 목걸이는 전용 슬롯이라 장신구1·2 슬롯 가득참과 무관
    const slotsFull = (state.equippedAccessories || []).filter(id => id != null).length >= ACCESSORY_SLOT_MAX;
    const canWear = !e.equipped && reqOk && (isNecklace || !slotsFull);
    const isForgeTarget = e.id === state.forgeTargetId;
    return [
      { id: 'wear', label: e.equipped ? '착용 해제' : (!isNecklace && slotsFull && reqOk ? '슬롯 가득참' : '착용'),
        active: e.equipped, quickEquip: true, disabled: !e.equipped && !canWear,
        reason: (!e.equipped && !reqOk) ? invBoxReqReason(e.type) : '',
        run: () => e.equipped ? unequipAccessoryPiece(e.id) : equipAccessoryPiece(e.id) },
      { id: 'forge', label: isForgeTarget ? '강화 대상' : '강화 선택', active: isForgeTarget,
        disabled: isForgeTarget || !reqOk || e.locked, reason: e.locked ? INV_LOCKED_REASON : ((!isForgeTarget && !reqOk) ? invBoxReqReason(e.type) : ''),
        run: () => selectForgeTargetFromInventory(e.id) },
      { id: 'compare', label: '아이템 비교', run: () => invCompareStart(e) }, // 잠긴 장비도 비교 가능(잠금과 무관)
      { id: 'sell', label: `판매 (${e.price.toLocaleString()}G)`, variant: 'sell', disabled: !!e.locked, reason: e.locked ? INV_LOCKED_REASON : '', run: () => sellAccessoryItem(e.id) },
    ];
  },
  artifact: (e) => {
    const slotFull = state.equippedArtifacts.length >= ARTIFACT_SLOT_MAX;
    return [
      { id: 'wear', label: e.equipped ? '해제' : '장착', active: e.equipped, quickEquip: true,
        disabled: !e.equipped && slotFull, reason: (!e.equipped && slotFull) ? '장착 슬롯이 모두 사용 중입니다. 다른 아티팩트를 먼저 해제해주세요.' : '',
        run: () => e.equipped ? unequipArtifact(e.id) : equipArtifact(e.id) },
    ];
  },
  consumable: (e) => [
    { id: 'use', label: '사용하기', run: () => isScrollItem(e.item) ? openScrollUseModal(e.id) : useFlask(e.id) },
  ],
  trace: (e) => [
    { id: 'use', label: '사용하기', run: () => useTraceItem(e.id) },
  ],
  stone: () => [],  // 마석/기타는 구버전에도 인벤토리에서 쓸 수 있는 기능이 없음(판매는 상점에서)
  misc: () => [],
};
function invBoxActionsFor(entry){
  const provider = INV_BOX_ACTION_PROVIDERS[entry.src];
  return provider ? provider(entry) : [];
}

// 더블 클릭 빠른 착용/해제(토글) — 각 제공자가 quickEquip로 표시한 "착용/착용 해제" 동작을 그대로 실행함(구버전의
// 착용 버튼과 같은 함수·같은 조건). 착용 중이 아니면 착용, 이미 착용 중이면 착용 해제가 실행됨(제공자의 quickEquip
// 동작이 현재 착용 상태에 맞는 함수를 고름). 착용 조건을 못 채워 버튼이 비활성인 상태에서는 아무 일도 하지 않으며, 착용 대상이
// 아닌 소비/마석/기타 아이템은 quickEquip 동작이 없어 적용되지 않음.
function invBoxQuickEquip(entry){
  const action = invBoxActionsFor(entry).find(a => a.quickEquip);
  if(!action || action.disabled) return false;
  action.run();
  return true;
}
function invBoxHasQuickEquip(entry){
  return invBoxActionsFor(entry).some(a => a.quickEquip);
}

// ---- 팝업 열기/닫기/위치 ----
function invBoxPopupEl(){
  let p = document.getElementById('invBoxPopup');
  if(!p){
    p = document.createElement('div');
    p.id = 'invBoxPopup';
    p.className = 'inv-box-popup';
    p.style.display = 'none';
    document.body.appendChild(p);
    p.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act-idx]');
      if(!btn || btn.disabled) return;
      const entry = invBoxUI.entriesByKey[invBoxUI.popupKey];
      if(!entry) return;
      const action = invBoxActionsFor(entry)[Number(btn.dataset.actIdx)];
      if(!action || action.disabled) return;
      invBoxClosePopup();
      action.run();
    });
  }
  return p;
}
function invBoxClosePopup(){
  invBoxUI.popupKey = null;
  const p = document.getElementById('invBoxPopup');
  if(p) p.style.display = 'none';
}
function invBoxPopupHtml(entry){
  const actions = invBoxActionsFor(entry);
  const qty = entry.qty != null ? ` <span class="inv-box-popup-qty">×${entry.qty}</span>` : '';
  const buttons = actions.length === 0
    ? '<div class="inv-box-popup-empty">사용할 수 있는 기능이 없습니다.</div>'
    : actions.map((a, i) => `<button class="inv-btn ${a.variant === 'sell' ? 'sell' : 'equip'} ${a.active ? 'active' : ''}" data-act-idx="${i}" ${a.disabled ? 'disabled' : ''} ${a.reason ? `title="${a.reason.replace(/"/g, '&quot;')}"` : ''}>${a.label}</button>`).join('');
  return `<div class="inv-box-popup-name">${entry.nameHtml}${qty}</div><div class="inv-box-popup-actions">${buttons}</div>`;
}
// 선택한 슬롯의 우측에 표시하되, 화면 오른쪽 경계를 넘으면 슬롯 왼쪽으로, 위/아래 경계를 넘으면 안쪽으로 보정함
// (툴팁 위치 보정 adjustTooltipPosition과 같은 경계 여백 TOOLTIP_EDGE_MARGIN을 그대로 사용).
function invBoxPositionPopup(popup, slotEl){
  const margin = typeof TOOLTIP_EDGE_MARGIN === 'number' ? TOOLTIP_EDGE_MARGIN : 6;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const sr = slotEl.getBoundingClientRect();
  popup.style.visibility = 'hidden';
  popup.style.display = 'block';
  const pw = popup.offsetWidth, ph = popup.offsetHeight;
  let left = sr.right + 6;
  if(left + pw > vw - margin) left = sr.left - pw - 6;
  left = Math.max(margin, Math.min(left, vw - margin - pw));
  let top = sr.top;
  if(top + ph > vh - margin) top = vh - margin - ph;
  top = Math.max(margin, top);
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.style.visibility = '';
}
function invBoxOpenPopup(key, slotEl){
  const entry = invBoxUI.entriesByKey[key];
  if(!entry || !slotEl) return;
  const popup = invBoxPopupEl();
  invBoxUI.popupKey = key;
  popup.innerHTML = invBoxPopupHtml(entry);
  invBoxPositionPopup(popup, slotEl);
}
// 화면이 다시 그려진 뒤(아이템 판매/장착 등으로 상태가 바뀜) 열려 있는 팝업을 최신 상태로 갱신하거나, 대상 아이템이
// 사라졌으면 닫음.
function invBoxRefreshPopup(){
  if(!invBoxUI.popupKey) return;
  const grid = document.getElementById('invBoxGrid');
  const slotEl = grid && Array.from(grid.querySelectorAll('.inv-box-slot.filled')).find(s => s.dataset.key === invBoxUI.popupKey);
  if(!slotEl || !invBoxUI.entriesByKey[invBoxUI.popupKey]){ invBoxClosePopup(); return; }
  invBoxOpenPopup(invBoxUI.popupKey, slotEl);
}

// ---- 렌더링 ----
// 탭이 잠금 가능한지 — 그 탭의 엔트리 src가 INV_LOCKABLE_SRCS에 있으면 가능(현재는 장비 탭). 탭 확장 시 데이터(INV_LOCKABLE_SRCS)만 늘리면 됨.
function invBoxTabLockable(tab){
  const sample = invBoxBuildEntries(tab)[0];
  return tab === 'equipment' || (!!sample && isInvLockable(sample.src));
}
function invBoxSlotHtml(entry, query){
  const qtyHtml = entry.qty != null ? `<span class="reward-item-qty">${entry.qty}</span>` : ''; // 보상창 획득 아이템 슬롯과 같은 수량 표시
  const equipHtml = entry.equipped ? '<span class="inv-box-equip-mark">E</span>' : '';
  // 잠금 가능한 탭(INV_LOCKABLE_SRCS)의 슬롯에는 data-lock-src/id를 붙여 잠금 모드 클릭(main.js)이 이 슬롯을 잠금 대상으로 인식하게 하고,
  // 잠긴 아이템에는 아이콘 위 왼쪽 상단에 잠금 아이콘 오버레이를 얹음(기존 아이콘/테두리/등급 색/E 표시는 그대로).
  const lockAttrs = isInvLockable(entry.src) ? ` data-lock-src="${entry.src}" data-lock-id="${entry.id}"` : '';
  // 비교 모드: 기준 장비는 강조(compare-base), 같은 장비 대분류는 그대로(클릭해 비교), 그 외(다른 장비 종류/비장비 탭)는 흐리게 비활성(compare-disabled)
  let cmpCls = '';
  if(invCompare.on) cmpCls = entry.key === invCompare.baseKey ? ' compare-base' : (invCompareGroup(entry) === invCompare.group ? '' : ' compare-disabled');
  // 검색어가 있으면 일치하지 않는 아이템은 숨기지 않고 비교 모드의 비활성 표시와 같은 방식(흐림)으로 표시 — 슬롯 위치는 그대로.
  const dimCls = query && !invBoxMatches(entry, query) ? ' search-dim' : '';
  const flashCls = entry.key === invBoxUI.focusKey ? ' flash' : '';
  return `<div class="inv-box-slot filled ${entry.locked ? 'locked' : ''}${cmpCls}${dimCls}${flashCls}" data-key="${entry.key}"${lockAttrs} style="border-color:${entry.borderColor};">`
    + `${entry.iconHtml}${qtyHtml}${equipHtml}${invLockBadgeHtml(entry.locked)}<span class="tooltip">${entry.tooltipHtml}</span></div>`;
}
// ---- 인벤토리 검색 / 슬롯 영역 스크롤 ----
// 검색창·결과 드롭다운은 도감 검색 UI(.codex-search/.codex-results/.codex-result/.codex-hl, codexHighlightHtml/codexEsc)를 그대로 재사용함.
// 검색 대상은 인벤토리 전체(모든 탭)이지만, 슬롯 영역에는 항상 현재 탭의 아이템만 표시하고 검색어와 맞지 않는 슬롯은 흐리게만 표시함.
function invBoxQueryNorm(){ return (invBoxUI.query || '').trim().toLowerCase(); }
function invBoxMatches(entry, q){ return !q || (entry.name || '').toLowerCase().includes(q); }
// 검색 결과 = 모든 탭의 엔트리(탭 순서 → 각 탭의 정렬 순서), 각 엔트리에 속한 탭(tab/tabLabel)을 붙임.
function invBoxSearchResults(q){
  const out = [];
  INV_BOX_TABS.forEach(t => {
    invBoxSortEntries(invBoxBuildEntries(t.id), t.id).forEach(e => { if(invBoxMatches(e, q)) out.push(Object.assign({}, e, { tab: t.id, tabLabel: t.label })); });
  });
  return out;
}
function invBoxRenderResults(){
  const box = el('invBoxResults');
  if(!box) return;
  const q = invBoxQueryNorm();
  invBoxUI.searchByKey = {};
  if(!q || !invBoxUI.resultsOpen){ box.style.display = 'none'; return; }
  const results = invBoxSearchResults(q);
  if(results.length === 0){
    box.innerHTML = '<div class="codex-result-empty">검색 결과가 없습니다.</div>';
  } else {
    box.innerHTML = results.slice(0, CODEX_SEARCH_MAX_RESULTS).map(e => {
      invBoxUI.searchByKey[e.key] = e;
      const color = String(e.borderColor || '').startsWith('var(--forge-line') ? 'var(--forge-cream)' : e.borderColor;
      return `<button class="codex-result" data-key="${e.key}"><span style="color:${color};">${codexHighlightHtml(e.name, invBoxUI.query)}${codexEsc(e.nameSuffix || '')}</span>`
        + `<span class="codex-result-cat">${codexEsc(e.tabLabel)}</span></button>`;
    }).join('');
  }
  box.style.display = 'block';
}
// 검색 결과에서 아이템을 고르면 그 아이템이 속한 탭으로 이동(검색어는 유지)하고 슬롯을 강조함.
function invBoxGoToEntry(key){
  const e = invBoxUI.searchByKey[key];
  if(!e) return;
  invBoxClosePopup();
  if(typeof codexHideTip === 'function') codexHideTip();
  if(invCompare.on) invCompare.targetKey = null; // 탭 이동과 같은 처리(비교 팝업이 열려 있었다면 대상 선택 상태로)
  invBoxUI.tab = e.tab;
  invBoxUI.focusKey = e.key;
  invBoxUI.resultsOpen = false;
  renderInventoryBox();
}
// 인벤토리 메뉴를 나가면(navigation.js showView) 검색어·결과 상태를 초기화함.
function invBoxSearchReset(){
  invBoxUI.query = '';
  invBoxUI.resultsOpen = false;
  invBoxUI.focusKey = null;
  const input = document.getElementById('invBoxSearchInput');
  if(input) input.value = '';
  const box = document.getElementById('invBoxResults');
  if(box){ box.style.display = 'none'; box.innerHTML = ''; }
}
// 슬롯 영역: 칸 수가 8줄 표시 영역(64칸)을 넘을 때만 .scrollable을 붙여 그 안에서 스크롤함(넘지 않으면 스크롤바·클리핑이 전혀 생기지 않음).
// 슬롯은 칸 폭에 맞춰 줄어들 수 있으므로 도감(codexSyncGridHeight)처럼 실제 슬롯 높이를 측정해 8줄 높이를 계산함.
function invBoxSyncScroll(total){
  const sc = el('invBoxGridScroll'), grid = el('invBoxGrid');
  if(!sc || !grid) return;
  const need = total > INV_BOX_SLOTS_PER_PAGE;
  sc.classList.toggle('scrollable', need);
  sc.style.maxHeight = '';
  if(!need) return;
  const slot = grid.querySelector('.inv-box-slot');
  const h = slot ? slot.getBoundingClientRect().height : 0;
  if(!h) return; // 화면이 숨겨진 상태 — 다시 그리거나 크기가 바뀔 때 계산됨
  const cs = getComputedStyle(grid);
  const gap = parseFloat(cs.rowGap) || 4;
  const padTop = parseFloat(cs.paddingTop) || 0, padBottom = parseFloat(cs.paddingBottom) || 0;
  sc.style.maxHeight = Math.round(INV_BOX_ROWS * h + (INV_BOX_ROWS - 1) * gap + padTop + padBottom) + 'px';
}
function renderInventoryBox(){
  const wrap = el('invBoxWrap');
  if(!wrap) return; // 인벤토리 화면 DOM이 아직 없는 초기 타이밍 방어
  const tab = INV_BOX_TABS.some(t => t.id === invBoxUI.tab) ? invBoxUI.tab : 'equipment';
  invBoxUI.tab = tab;

  let entries = invBoxBuildEntries(tab);
  entries = invBoxSortEntries(entries, tab); // 탭별로 저장된 정렬 기준(없으면 기본 정렬: 높은 등급 먼저)
  invBoxUI.entriesByKey = {};
  entries.forEach(e => { invBoxUI.entriesByKey[e.key] = e; });

  // 슬롯 영역: 현재 탭의 아이템만 표시(검색어가 있어도 다른 탭 아이템은 가져오지 않음). 페이지 대신 스크롤 — 칸 수는 기본 64칸(8×8)이고,
  // 아이템 수/카테고리 슬롯 용량(inventorySlotMax)이 그보다 커지면(슬롯 확장 대비) 8칸 단위로 늘어나 스크롤됨. 용량 자체는 제한 그대로.
  const q = invBoxQueryNorm();
  const total = Math.max(INV_BOX_SLOTS_PER_PAGE, Math.ceil(Math.max(entries.length, inventorySlotMax(tab)) / INV_BOX_COLUMNS) * INV_BOX_COLUMNS);

  el('invBoxTabs').innerHTML = INV_BOX_TABS.map(t =>
    `<button class="inv-box-tab ${t.id === tab ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('');

  let cells = '';
  for(let i = 0; i < total; i++){
    cells += i < entries.length ? invBoxSlotHtml(entries[i], q) : '<div class="inv-box-slot empty"></div>';
  }
  const scroller = el('invBoxGridScroll');
  const keepScroll = invBoxUI.lastTab === tab && !invBoxUI.resetScroll; // 같은 탭을 다시 그릴 때(판매/착용 등)는 스크롤 위치 유지
  const prevScroll = scroller.scrollTop;
  el('invBoxGrid').innerHTML = cells;
  invBoxUI.cellCount = total;
  invBoxSyncScroll(total);
  scroller.scrollTop = keepScroll ? prevScroll : 0;
  if(invBoxUI.focusKey){ // 검색 결과로 이동한 아이템이 보이도록 스크롤(강조는 이번 렌더에서만)
    const fs = el('invBoxGrid').querySelector(`[data-key="${invBoxUI.focusKey}"]`);
    if(fs) scroller.scrollTop = Math.max(0, fs.offsetTop - 4);
    invBoxUI.focusKey = null;
  }
  invBoxUI.lastTab = tab;
  invBoxUI.resetScroll = false;
  invBoxRenderResults();
  invBoxRenderSortControls(tab);
  // 잠금 버튼: 잠금 모드 상태(active)를 반영해 매번 다시 그림. 잠금은 장비 탭에서만 쓸 수 있으므로 잠금 불가 탭에서는 (모드가 꺼져 있을 때) 비활성 —
  // 잠금 모드가 켜진 채 탭을 옮겨도 모드는 유지되고(요구사항 5번), 버튼은 계속 눌러 끌 수 있음.
  const lockWrap = el('invBoxLockWrap');
  if(lockWrap){
    // 비교 모드 중에는 잠금 버튼 자리를 \'종료\' 버튼(아이템 비교 모드 종료)으로 재활용함 — 비교 모드와 잠금 모드는 동시에 쓸 수 없으므로 같은 위치를 공유.
    // 모바일에서도 Esc 없이 비교 모드를 끝낼 수 있고, 버튼을 누르면 [닫기]/Esc와 같은 초기화(invCompareReset)가 실행됨.
    lockWrap.innerHTML = invCompare.on ? '<button class="inv-box-btn inv-compare-end" data-cmp="end" aria-label="종료" title="종료">종료</button>' : invLockButtonHtml();
    const lb = lockWrap.querySelector('button[data-lock-toggle]');
    if(lb && !invBoxTabLockable(tab) && !invLockMode) lb.disabled = true;
  }

  // 현재 보고 있는 카테고리의 슬롯 사용량(실제 인벤토리 용량 규칙 — formulas.js의 inventorySlotsUsed/inventorySlotMax를 구버전과
  // 똑같이 사용함). 탭 id가 인벤토리 카테고리 id와 같아 그대로 넘김. 골드 표시는 기존 그대로 유지.
  el('invBoxSlotCount').innerHTML = `<b>${inventorySlotsUsed(tab)}</b> / ${inventorySlotMax(tab)}`;
  el('invBoxGold').innerHTML = `소유 골드 <span class="inv-box-gold-val"><b>${state.gold.toLocaleString()}</b>${uiIconHtml('gold', 'ui-icon-inline')}</span>`;
  invBoxRefreshPopup();
  invCompareRenderPanel();
}

// 비교 행 목록(invCompareBuildRows 결과) → 행 HTML. 인벤토리 비교 팝업과 도감 아이템 상세 정보(codex.js)가 같은 출력 방식을 쓰도록 공용으로 분리함.
function invCompareRowsHtml(rows){
  return rows.map(r => {
    const cls = r.sell ? 'cmp-sell' : '';
    const val = (html, reduced) => r.sell ? `<span class="cmp-sellval ${reduced ? 'reduced' : ''}">${html}</span>` : html;
    const dl = d => d ? ` <span class="cmp-delta ${d.good ? 'good' : 'bad'}">${d.text}</span>` : ''; // 색은 좋아짐/나빠짐 기준
    return `<div class="cmp-row ${cls}"><div class="cmp-label">${r.label}</div><div class="cmp-val">${val(r.aHtml, r.aReduced)}${dl(r.deltaA)}</div><div class="cmp-val">${val(r.bHtml, r.bReduced)}${dl(r.delta)}</div></div>`;
  }).join('');
}
// ---- 비교 팝업(아이템 그리드 영역 위에 표시) ----
// 항목은 툴팁에서 읽은 invCompareBuildRows(formulas.js)를 그대로 그림 — 항목명 열 하나에 기준 장비(왼쪽)/비교 대상(오른쪽) 값을 대응시키고,
// 수치 항목만 오른쪽 값 뒤에 A 대비 ▲(초록)/▼(빨강)를 붙임. 상단에 양쪽 장비 아이콘(B 옆 [변경]), 하단에 [닫기]만 있음.
function invCompareRenderPanel(){
  const panel = document.getElementById('invBoxCompare');
  if(!panel) return;
  if(!invCompare.on || !invCompare.targetKey){ panel.style.display = 'none'; panel.innerHTML = ''; return; }
  const all = {};
  invBoxBuildEntries('equipment').forEach(e => { all[e.key] = e; }); // 정렬/탭과 무관하게 현재 보유 장비 전체에서 A/B를 다시 찾음(상태 변경 반영)
  const a = all[invCompare.baseKey], b = all[invCompare.targetKey];
  if(!a || !b || invCompareGroup(b) !== invCompare.group){ invCompareReset(); return; } // 대상 아이템이 사라진 경우 안전하게 종료
  // A/B의 표시 단계(없으면 실제 단계)로 도감 정보와 같은 방식(codexDisplayFor: 실제 장비 표시 함수가 단계에 맞춰 아이콘·툴팁 생성)으로 표시용 엔트리를 만듦.
  // 실제 아이템(a.item/b.item)은 복사본으로만 쓰므로 인벤토리의 강화 단계는 바뀌지 않음.
  const lvA = invCompare.levelA != null ? invCompare.levelA : (a.item.level || 0), lvB = invCompare.levelB != null ? invCompare.levelB : (b.item.level || 0);
  const da = codexDisplayFor(a.type, lvA, a.item), db = codexDisplayFor(b.type, lvB, b.item);
  const icon = e => `<div class="inv-box-slot filled cmp-slot" style="border-color:${e.borderColor};">${e.iconHtml}</div>`;
  const rowsData = invCompareBuildRows(da, db);
  // '강화' 항목: 도감 정보와 같은 단계 선택 UI(codexEnhCell), 이름 아래 / 등급 위. 강화 불가 장비는 '-'
  const enhRow = { label: '강화', aHtml: codexEnhCell('a', lvA, codexEnhanceable(a.src)), bHtml: codexEnhCell('b', lvB, codexEnhanceable(b.src)) };
  const nameIdx = rowsData.findIndex(r => r.label === INV_COMPARE_TIP_LABELS.name);
  rowsData.splice(nameIdx + 1, 0, enhRow);
  const rows = invCompareRowsHtml(rowsData);
  // 아이콘 머리글은 스크롤 영역(.cmp-body) 안에 두고 CSS sticky로 맨 위에 고정함 — 항목 행과 같은 폭을 쓰기 때문에, 스크롤바가 생겨
  // 행의 열 폭이 줄어들어도 아이콘이 이름/값 열의 가운데에 계속 맞음(머리글이 스크롤 영역 밖이면 오른쪽 열이 스크롤바 폭만큼 어긋남).
  const prevBody = panel.querySelector('.cmp-body');
  const prevTop = prevBody ? prevBody.scrollTop : 0; // 단계를 바꿔도 보고 있던 스크롤 위치 유지
  panel.innerHTML = `<div class="cmp-body"><div class="cmp-head"><div class="cmp-head-label"></div><div class="cmp-head-side">${icon(da)}</div>`
    + `<div class="cmp-head-side">${icon(db)}<button class="inv-box-btn cmp-change" data-cmp="change">변경</button></div></div>${rows}</div>`
    + `<div class="cmp-foot"><button class="inv-box-btn" data-cmp="close">닫기</button></div>`;
  const nb = panel.querySelector('.cmp-body');
  if(nb) nb.scrollTop = prevTop;
  panel.style.display = 'flex';
}

// ---- 이벤트 ----
(function bindInventoryBoxEvents(){
  const wrap = el('invBoxWrap');
  if(!wrap) return;
  wrap.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.inv-box-tab[data-tab]');
    if(tabBtn){
      invBoxClosePopup();
      if(invCompare.on) invCompare.targetKey = null; // 비교 팝업이 열려 있었다면 닫고 대상 선택 상태로 돌아감(비교 모드는 유지)
      invBoxUI.tab = tabBtn.dataset.tab;
      renderInventoryBox();
      return;
    }
    // 잠금 버튼([data-lock-toggle])과 잠금 모드 중 슬롯 클릭은 main.js의 공용 잠금 처리(캡처 단계)가 먼저 처리함.
    // 비교 화면의 강화 단계 ◀▶(도감 정보와 같은 버튼 마크업 codexEnhCell): A/B 표시 단계만 바꾸고 실제 장비는 그대로 둠
    const enhBtn = e.target.closest('button[data-cdx="enh"]');
    if(enhBtn){
      if(enhBtn.disabled || !invCompare.on || !invCompare.targetKey) return;
      const d = Number(enhBtn.dataset.d);
      const clamp = v => Math.max(0, Math.min(MAX_LEVEL, v));
      if(enhBtn.dataset.side === 'a') invCompare.levelA = clamp((invCompare.levelA || 0) + d);
      else invCompare.levelB = clamp((invCompare.levelB || 0) + d);
      invCompareRenderPanel();
      return;
    }
    const cmpBtn = e.target.closest('button[data-cmp]');
    if(cmpBtn){
      if(cmpBtn.dataset.cmp === 'close' || cmpBtn.dataset.cmp === 'end') invCompareReset(); // 닫기/종료: 팝업·비교 모드·기준/대상·커서 모두 초기화
      else invCompare.targetKey = null;                              // 변경: 기준 A는 유지하고 비교 대상 B만 다시 고르는 상태로(비교 모드 유지)
      if(typeof invCompareCursorSync === 'function') invCompareCursorSync();
      render();
      return;
    }
    const slotEl = e.target.closest('.inv-box-slot.filled');
    if(!slotEl) return;
    const key = slotEl.dataset.key;
    const entry = invBoxUI.entriesByKey[key];
    if(!entry) return;
    if(invCompare.on){
      // 비교 모드: 일반 클릭 동작(액션 팝업/더블 클릭 착용 등)은 실행하지 않음. 기준 장비를 다시 누르면 비교 모드 취소,
      // 같은 장비 대분류의 다른 장비를 누르면 비교 팝업, 그 외(비활성 표시)는 무시.
      invBoxClosePopup();
      invBoxUI.lastClick = { key: null, time: 0 };
      if(invCompare.targetKey) return; // 비교 팝업이 열려 있는 동안은 아래 그리드가 눌리지 않음(안전장치)
      if(key === invCompare.baseKey){ invCompareReset(); render(); return; }
      if(invCompareGroup(entry) !== invCompare.group) return;
      invCompare.targetKey = key;
      invCompare.levelB = entry.item.level || 0; // B의 시작 단계 = 그 장비의 실제 강화 단계
      if(typeof invCompareCursorSync === 'function') invCompareCursorSync(); // 팝업이 열려 있는 동안은 일반 커서(버튼을 누를 수 있게)
      render();
      return;
    }
    const now = Date.now();
    const last = invBoxUI.lastClick;
    if(last.key === key && now - last.time < INV_BOX_DOUBLE_CLICK_MS){
      // 더블 클릭: 장비 빠른 착용/해제(토글). 착용 대상이 아닌 아이템에는 아무 동작도 하지 않음(열려 있던 팝업도 그대로 둠).
      invBoxUI.lastClick = { key: null, time: 0 };
      if(invBoxHasQuickEquip(entry)){
        invBoxClosePopup();
        invBoxQuickEquip(entry);
      }
      return;
    }
    invBoxUI.lastClick = { key, time: now };
    if(invBoxUI.popupKey === key) invBoxClosePopup();
    else invBoxOpenPopup(key, slotEl);
  });
  // ---- 검색 ----
  const input = el('invBoxSearchInput');
  input.addEventListener('input', () => {
    invBoxUI.query = input.value;
    invBoxUI.resultsOpen = true;
    invBoxClosePopup();
    renderInventoryBox();
  });
  // 검색어가 입력된 상태에서 검색창을 다시 선택하면 입력 내용을 비우고 새로 검색할 수 있게 함(탭 이동만으로는 지우지 않음).
  input.addEventListener('focus', () => {
    if(!input.value && !invBoxUI.query) return;
    input.value = '';
    invBoxUI.query = '';
    invBoxUI.resultsOpen = false;
    invBoxClosePopup();
    renderInventoryBox();
  });
  el('invBoxResults').addEventListener('click', (e) => {
    const b = e.target.closest('.codex-result');
    if(b) invBoxGoToEntry(b.dataset.key);
  });
  // ---- 스크롤 모드(슬롯이 64칸을 넘을 때)에서는 슬롯 안 CSS 툴팁이 잘리므로 도감과 같은 고정 위치 툴팁(#codexTip)을 사용 ----
  const gridEl = el('invBoxGrid');
  gridEl.addEventListener('mouseover', (e) => {
    if(!el('invBoxGridScroll').classList.contains('scrollable')) return;
    const s = e.target.closest('.inv-box-slot.filled');
    const entry = s && invBoxUI.entriesByKey[s.dataset.key];
    if(entry && typeof codexShowTipHtml === 'function') codexShowTipHtml(s, entry.tooltipHtml, entry.key);
  });
  gridEl.addEventListener('mouseout', (e) => {
    if(e.target.closest('.inv-box-slot') && typeof codexHideTip === 'function') codexHideTip();
  });
  el('invBoxGridScroll').addEventListener('scroll', () => { if(typeof codexHideTip === 'function') codexHideTip(); });
  // 팝업/슬롯 밖을 누르거나 Esc, 화면 크기 변경, 스크롤 시 팝업을 닫음
  document.addEventListener('click', (e) => { // 검색창/결과 밖을 누르면 결과 드롭다운만 닫음(검색어는 유지)
    if(invBoxUI.resultsOpen && !e.target.closest('#invBoxSearch')){
      invBoxUI.resultsOpen = false;
      el('invBoxResults').style.display = 'none';
    }
  });
  document.addEventListener('click', (e) => {
    if(!invBoxUI.popupKey) return;
    if(e.target.closest('#invBoxPopup') || e.target.closest('.inv-box-slot.filled')) return;
    invBoxClosePopup();
  });
  document.addEventListener('keydown', (e) => {
    if(e.key !== 'Escape') return;
    invBoxClosePopup();
    if(invCompare.on){ invCompareReset(); render(); } // Esc = 아이템 비교 모드 종료(대상 선택 중이든 비교 팝업이 열려 있든 동일)
  });
  window.addEventListener('resize', () => { invBoxClosePopup(); if(invBoxUI.cellCount) invBoxSyncScroll(invBoxUI.cellCount); });
  window.addEventListener('scroll', () => { if(invBoxUI.popupKey) invBoxClosePopup(); }, true);
})();

// 설정의 인벤토리 UI가 '신버전(박스)'일 때 render.js의 분기(renderInventoryByUiVariant)가 이 렌더러를 사용함.
INVENTORY_UI_RENDERERS.box = renderInventoryBox;
