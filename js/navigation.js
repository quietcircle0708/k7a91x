// ============================================================
// navigation.js — 화면 전환, 인벤토리 탭, 캐릭터 정보/퀵슬롯 모달
// 어느 화면(view)을 보여줄지, 전투 중 이탈 확인 등 내비게이션과
// 모달 열고 닫기를 담당. 실제 게임 로직 변경은 없음.
// ============================================================

function showView(name){
  if(currentView === 'hunt' && name !== 'hunt'){
    stopHuntLoop();
    closeKillResultModal();
    hunt.dungeon = null;
    hunt.monsters = [];
    hunt.targetId = null;
    hunt.stage = 1;
    hunt.chestOpened = false;
    hunt.paused = false;
    hunt.started = false;
    // 던전 화면 좌우 패널 레이아웃(레이아웃 개편 요구사항 13번) — 패널이 열린 채로 화면을 벗어나도
    // .wrap의 확장 클래스가 남아 다른 화면에 영향을 주지 않도록 항상 제거함.
    const wrapEl = document.querySelector('.wrap');
    if(wrapEl) wrapEl.classList.remove('hunt-panel-open');
  }
  if(currentView === 'character' && name !== 'character'){
    // 캐릭터 메뉴를 벗어날 때는 캐릭터 정보 모달을 닫을 때(closeCharStats)와 동일하게
    // 적용하지 않은 임시 스탯 배분을 버림(둘이 draftStats를 공유하는 데이터이므로 규칙도 동일해야 함).
    draftStats = null;
    draftStatPoints = null;
    statAllocActive = { str: false, agi: false, int: false };
  }
  if(currentView === 'craft' && name !== 'craft'){
    // 제작소를 벗어나면 [제작 재료] 토글 안내를 전부 닫고(요청사항 1번), 제작 진행 팝업 관련 상태도
    // 함께 정리함(팝업이 열린 채로 화면을 벗어나는 경로는 없지만, 혹시 모를 상태 잔류를 방지).
    craftUI.openMaterialIds = new Set();
    craftPopup = null;
    craftMaterialQtyState = null;
    if(craftAnim){
      restoreHeldCraftEquip(); // 이탈로 중단되는 경우 홀딩 장비를 잃지 않도록 되돌림
      clearInterval(craftAnim.tickInterval);
      clearInterval(craftAnim.orbInterval);
      craftAnim = null;
    }
    el('craftPopupModal').style.display = 'none';
    el('craftMaterialQtyModal').style.display = 'none';
    el('craftCatalystModal').style.display = 'none';
    el('craftConfirmModal').style.display = 'none';
    el('craftAnimModal').style.display = 'none';
  }
  if(currentView === 'forge' && name !== 'forge'){
    // 대장간(강화/수리 탭)을 벗어날 때 수리 관련 팝업 상태도 함께 정리(요청사항 없음이지만, craft와
    // 동일한 이유로 팝업이 열린 채 화면을 벗어나는 잔류 상태를 방지).
    repairIndividualPopup = null;
    repairAllPopupOpen = false;
    repairConfirmState = null;
    el('repairIndividualModal').style.display = 'none';
    el('repairAllModal').style.display = 'none';
    el('repairConfirmModal').style.display = 'none';
    el('repairSelectModal').style.display = 'none';
  }
  el('forgeView').style.display = name === 'forge' ? 'block' : 'none';
  el('shopView').style.display = name === 'shop' ? 'block' : 'none';
  el('inventoryView').style.display = name === 'inventory' ? 'block' : 'none';
  el('craftView').style.display = name === 'craft' ? 'block' : 'none';
  el('dungeonListView').style.display = name === 'dungeonlist' ? 'block' : 'none';
  el('characterView').style.display = name === 'character' ? 'block' : 'none';
  el('huntView').style.display = name === 'hunt' ? 'block' : 'none';
  currentView = name;
  if(name === 'dungeonlist') renderDungeonList();
  if(name === 'hunt') renderHunt();
  if(name === 'craft'){ renderCraftTabs(); renderCraftList(craftUI.tab); }
  if(name === 'character'){
    // 캐릭터 정보 모달을 열 때(openCharStats)와 동일한 초기화 규칙: 매번 진입할 때마다
    // state 기준으로 draft를 새로 세팅하고, 항상 첫 탭·1페이지부터 보여줌.
    draftStats = { str: state.stats.str, agi: state.stats.agi, int: state.stats.int };
    draftStatPoints = state.statPoints || 0;
    statAllocActive = { str: false, agi: false, int: false };
    pageState.charMenuInfo = 1;
    activeCharTab = CHARACTER_TABS.length > 0 ? CHARACTER_TABS[0].id : null;
    // 스킬 탭 상태도 캐릭터 정보 탭과 동일하게 진입할 때마다 첫 하위탭·1페이지로 초기화
    activeSkillCategory = SKILL_CATEGORIES.length > 0 ? SKILL_CATEGORIES[0].id : null;
    activeSkillKind = SKILL_KIND_TABS.length > 0 ? SKILL_KIND_TABS[0].id : null; // 요구사항 3번: 진입할 때마다 항상 "공격" 탭부터
    pageState.skillPage = 1;
    renderCharacterMenu();
  }
  render();
}

let pendingNavTarget = null;
function isActivelyFighting(){
  return currentView === 'hunt' && hunt.started && hunt.monsters.length > 0 && el('killResultModal').style.display !== 'flex';
}
function guardedNav(name){
  if(isActivelyFighting()){
    pendingNavTarget = name;
    hunt.paused = true;
    el('leaveConfirmModal').style.display = 'flex';
    return;
  }
  showView(name);
}
function confirmLeaveBattle(){
  el('leaveConfirmModal').style.display = 'none';
  const target = pendingNavTarget || 'dungeonlist';
  pendingNavTarget = null;
  showView(target);
}
function cancelLeaveBattle(){
  el('leaveConfirmModal').style.display = 'none';
  pendingNavTarget = null;
  if(currentView === 'hunt') hunt.paused = false;
}

function openShop(){ if(isEnhancing) return; guardedNav('shop'); }
function openInventory(){ if(isEnhancing) return; guardedNav('inventory'); }
function openDungeonList(){ if(isEnhancing) return; guardedNav('dungeonlist'); }
function openCharacterMenu(){ if(isEnhancing) return; guardedNav('character'); }
function openCraft(){ if(isEnhancing) return; guardedNav('craft'); }
function closeToForge(){ showView('forge'); }

// ---- 인벤토리 탭 ----
// 상점(switchShopTab)과 동일한 규칙: "장비" 최상위 탭(subTabs를 가진 탭)을 클릭하면 마지막으로 보던
// 하위탭(invUI.equipTab, 없으면 첫 하위탭)으로 이동하고, 하위탭(무기/방어구/장신구/아티팩트)이나
// 다른 최상위 탭(소비/마석/기타)을 클릭하면 그 탭을 그대로 보여줌. 실제 화면 갱신은 renderInvTabs()가
// 담당(render() 매 사이클마다도 호출되므로 여기서 직접 DOM을 건드리지 않아도 항상 최신 상태로 반영됨).
function switchInvTab(tabId){
  const top = INVENTORY_TABS.find(t => t.id === tabId);
  if(top && top.subTabs){
    invUI.tab = invUI.equipTab || top.subTabs[0].id;
  } else {
    invUI.tab = tabId;
    const equipTop = INVENTORY_TABS.find(t => t.id === 'equipment');
    if(equipTop && equipTop.subTabs.some(st => st.id === tabId)) invUI.equipTab = tabId;
  }
  renderInvTabs();
}

// ---- 제작소 "제작" 탭 소분류 전환 ----
// switchInvTab/switchShopTab과 동일한 구조. 지금은 최상위 탭이 "제작" 하나뿐이라 top.subTabs 분기
// (최상위 탭 클릭)은 항상 첫 하위탭으로 이동하지만, 나중에 CRAFT_TABS에 최상위 탭이 늘어나면
// invUI.equipTab과 동일한 "마지막 하위탭 기억" 패턴을 그대로 추가하면 됨.
function switchCraftTab(tabId){
  const top = CRAFT_TABS.find(t => t.id === tabId);
  craftUI.tab = (top && top.subTabs) ? top.subTabs[0].id : tabId;
  renderCraftTabs();
  renderCraftList(craftUI.tab);
}

// ---- 대장간 강화/수리 탭 전환(내구도 시스템 15번 요구사항) ----
// "강화" 탭은 기존 화면을 그대로 보여주고, "수리" 탭은 장비창을 재사용한 실제 수리 기능 화면임.
function switchForgeTab(tabId){
  forgeUI.tab = tabId === 'repair' ? 'repair' : 'enhance';
  renderForgeTabs();
}

// ---- 수리 탭: 개별 수리 팝업(요구사항 9~18번) ----
// target: { source:'equipped', slotKey } — 장비창 슬롯 클릭(기존 방식) | { source:'inventory', kind,
// itemId } — "인벤토리에서 선택" 팝업에서 고른 경우(요구사항 15·16번). 실제 대상 조회는 항상
// resolveRepairTarget(state.js) 하나로 통일해서 처리하므로, 아래 함수들은 source를 직접 분기하지 않음.
function openRepairIndividualPopup(target){
  repairIndividualPopup = Object.assign({}, target, { amount: 0 });
  el('repairIndividualModal').style.display = 'flex';
  renderRepairIndividualModal();
}
function closeRepairIndividualPopup(){
  repairIndividualPopup = null;
  el('repairIndividualModal').style.display = 'none';
}
// 입력창 직접 입력(요구사항 14번) — 항상 clampRepairAmount로 0~최대수리가능량 사이로 강제함.
function setRepairIndividualAmount(rawValue){
  if(!repairIndividualPopup) return;
  const found = resolveRepairTarget(repairIndividualPopup);
  if(!found) return;
  repairIndividualPopup.amount = clampRepairAmount(found.item, rawValue);
  renderRepairIndividualModal();
}
// [최대]/[10%]/[1%]/[초기화] 버튼(요구사항 15번). 10%/1%는 "최대 내구도의 비율"이 기준이며, 그 값이
// 현재 수리 가능한 최대치를 넘으면 clampRepairAmount가 자동으로 잘라줌(요구사항 15번 예외 조건).
function applyRepairQuickAmount(kind){
  if(!repairIndividualPopup) return;
  const found = resolveRepairTarget(repairIndividualPopup);
  if(!found) return;
  const max = maxDurabilityFor(found.type);
  let raw = 0;
  if(kind === 'max') raw = repairAmountToFull(found.item);
  else if(kind === '10pct') raw = Math.floor(max * 0.1);
  else if(kind === '1pct') raw = Math.floor(max * 0.01);
  else if(kind === 'reset') raw = 0;
  setRepairIndividualAmount(raw);
}
// ---- 수리 탭: 모두 수리 팝업(요구사항 3~8번, 기존 그대로 — 장착 장비만 대상, 요구사항 21번) ----
function openRepairAllPopup(){
  if(repairAllTargetList().length === 0){
    showMsg('이미 모든 장비가 최대 내구도 상태입니다', 'info'); // 수리 대상 없음(요구사항 1번 마지막 문장)
    return;
  }
  repairAllPopupOpen = true;
  el('repairAllModal').style.display = 'flex';
  renderRepairAllModal();
}
function closeRepairAllPopup(){
  repairAllPopupOpen = false;
  el('repairAllModal').style.display = 'none';
}
// ---- 수리 탭: "인벤토리에서 선택" 팝업(요구사항 3~11·18~19번) ----
// 대장간 "강화 장비 선택" 팝업(openForgeSelect/closeForgeSelect)과 완전히 동일한 구조 — 목록이 비어도
// 팝업 자체는 열고 renderRepairSelectList()가 forgeSelectList와 동일한 방식으로 빈 안내 문구를 보여줌
// (요구사항 19번 "기존 게임의 빈 목록 UI 스타일" 재사용).
function openRepairSelectPopup(){
  pageState.repairSelect = 1; // 열 때마다 항상 1페이지부터(강화 장비 선택과 동일한 관례)
  renderRepairSelectList();
  el('repairSelectModal').style.display = 'flex';
}
function closeRepairSelectPopup(){
  el('repairSelectModal').style.display = 'none';
}
// 선택 목록에서 장비를 클릭했을 때(요구사항 11·13·14번) — 선택 팝업을 닫고, 그 장비를 대상으로 기존
// 개별 수리 팝업을 그대로 엶(장착/강화 대상 변경 없음 — resolveRepairTarget이 인벤토리 인스턴스를
// 직접 참조하므로 equipItem/selectForgeTarget 같은 장착 로직을 전혀 호출하지 않음, 요구사항 14번).
function selectRepairFromInventory(kind, itemId){
  closeRepairSelectPopup();
  openRepairIndividualPopup({ source: 'inventory', kind, itemId });
}
// ---- 수리 탭: 최종 확인 UI(요구사항 19~21번) — 개별/모두 수리 공용 ----
// 여기서는 아직 골드를 차감하거나 내구도를 바꾸지 않음(실제 실행은 confirmRepairProceed에서만).
function openRepairConfirmFromIndividual(){
  if(!repairIndividualPopup) return;
  const found = resolveRepairTarget(repairIndividualPopup);
  if(!found) return;
  const amount = repairIndividualPopup.amount;
  if(amount <= 0) return;
  const cost = repairCostForAmount(found.type, amount);
  if(state.gold < cost) return; // 골드 부족 시 확인창으로 넘어가지 않음(버튼도 disabled 처리되어 있음)
  repairConfirmState = { mode: 'individual', target: repairIndividualPopup, amount, totalCost: cost };
  el('repairIndividualModal').style.display = 'none';
  el('repairConfirmModal').style.display = 'flex';
  renderRepairConfirmModal();
}
function openRepairConfirmFromAll(){
  const targets = repairAllTargetList();
  if(targets.length === 0) return;
  const totalCost = repairAllTotalCost(targets);
  if(state.gold < totalCost) return;
  repairConfirmState = { mode: 'all', totalCost };
  el('repairAllModal').style.display = 'none';
  el('repairConfirmModal').style.display = 'flex';
  renderRepairConfirmModal();
}
// [취소] — 확인창만 닫고 원래 열려있던 팝업(개별/모두)으로 되돌아감. 입력했던 수리량/선택 상태는
// repairIndividualPopup/repairAllPopupOpen을 그대로 유지해뒀으므로 별도 복원 처리가 필요 없음(요구사항 20번).
// 인벤토리에서 선택해 들어온 개별 수리도 취소하면 "인벤토리에서 선택" 팝업이 아니라 수리 탭으로 바로
// 돌아간다(요구사항 20번 — 개별 수리의 [취소]는 항상 수리 탭으로 복귀, source와 무관하게 동일 동작).
function closeRepairConfirmPopup(){
  if(!repairConfirmState) return;
  const mode = repairConfirmState.mode;
  repairConfirmState = null;
  el('repairConfirmModal').style.display = 'none';
  if(mode === 'individual'){
    el('repairIndividualModal').style.display = 'flex';
    renderRepairIndividualModal();
  }else{
    el('repairAllModal').style.display = 'flex';
    renderRepairAllModal();
  }
}
// [확인] — 실제 수리 실행(actions.js) 후 수리 탭 메인 화면으로 완전히 복귀(요구사항 21번).
function confirmRepairProceed(){
  if(!repairConfirmState) return;
  const { mode, target, amount } = repairConfirmState;
  const ok = mode === 'individual' ? executeIndividualRepair(target, amount) : executeRepairAll();
  if(!ok) return; // 골드 부족 등으로 실패 — 확인창을 그대로 유지해 상태를 보여줌(버튼도 이미 disabled 상태)
  repairConfirmState = null;
  repairIndividualPopup = null;
  repairAllPopupOpen = false;
  el('repairConfirmModal').style.display = 'none';
  el('repairIndividualModal').style.display = 'none';
  el('repairAllModal').style.display = 'none';
  // executeIndividualRepair/executeRepairAll이 이미 render()를 호출해 renderForgeTabs()→renderRepairTab()
  // 체인으로 장비창/모두수리 버튼 상태가 갱신됨(요구사항 21번) — 별도 재호출 불필요.
}

// ---- 제작소: [제작 재료] 안내 토글(요청사항 1~2번) ----
// 아이템별로 독립적으로 켜고 끌 수 있게 "category:id" 키의 Set으로 관리. 다시 클릭하면 숨김(토글).
function toggleCraftMaterialInfo(category, itemId){
  const key = category + ':' + itemId;
  if(craftUI.openMaterialIds.has(key)) craftUI.openMaterialIds.delete(key);
  else craftUI.openMaterialIds.add(key);
  renderCraftList(category);
}

// ---- 제작소: 제작 진행 팝업(요청사항 3번) ----
function openCraftPopup(category, itemId){
  const item = findCraftItem(category, itemId);
  if(!item) return;
  // 재료를 직접 고르지 않고, 제작 아이템 데이터에 등록된 재료를 자동으로 전부 배정한 채로 팝업을 염
  // (투입 개수만 0부터 직접 설정). 슬롯은 이름(name) 기준으로 관리 — findCraftResource가 이름으로
  // 무기/방어구/장신구/보조/MISC_ITEMS 어디에 있는지 자동으로 찾아줌.
  craftPopup = {
    category, itemId,
    slots: item.materials.map(m => ({ name: m.name, qty: 0 })),
  };
  renderCraftPopup();
  el('craftPopupModal').style.display = 'flex';
}
function closeCraftPopup(){
  el('craftPopupModal').style.display = 'none';
  craftPopup = null;
}

// ---- 제작소: 투입 개수 선택 팝업(상점 "개수 지정 구매" buyQtyModal 재사용/개조) ----
// 재료가 이미 데이터로 정해져 있으므로 슬롯을 누르면 바로 그 재료의 투입 개수 팝업으로 감.
function openCraftMaterialQty(name){
  const item = findCraftItem(craftPopup.category, craftPopup.itemId);
  const slot = craftPopup.slots.find(s => s.name === name);
  const material = item.materials.find(m => m.name === name);
  const resource = findCraftResource(name);
  // 버그 수정: 이전엔 maxQty를 "필요 개수"로만 잡아서, 실제로 보유하지 않은 개수까지도 투입 개수를
  // 계속 올릴 수 있었음(보유량 검증 없이 슬롯 숫자만 늘어남). 이제 "필요 개수"와 "실제 보유량" 중
  // 더 작은 값으로 제한해서, 가진 만큼만 투입할 수 있도록 함.
  const owned = resource ? craftResourceOwnedCount(resource) : 0;
  const maxQty = Math.min(material.need, owned);
  craftMaterialQtyState = { name, qty: Math.min(slot.qty, maxQty), maxQty };
  el('craftPopupModal').style.display = 'none';
  renderCraftMaterialQtyModal();
  el('craftMaterialQtyModal').style.display = 'flex';
}
// [취소] → 제작 진행 팝업으로 복귀(재료 선택 단계가 없어졌으므로 곧바로 팝업으로 돌아감)
function closeCraftMaterialQty(){
  el('craftMaterialQtyModal').style.display = 'none';
  craftMaterialQtyState = null;
  renderCraftPopup();
  el('craftPopupModal').style.display = 'flex';
}
function setCraftMaterialQty(val){
  if(!craftMaterialQtyState) return;
  const num = parseInt(val, 10);
  const clamped = Number.isFinite(num) ? Math.max(0, Math.min(craftMaterialQtyState.maxQty, num)) : 0;
  craftMaterialQtyState.qty = clamped;
  renderCraftMaterialQtyModal();
}
function stepCraftMaterialQty(dir){
  if(!craftMaterialQtyState) return;
  setCraftMaterialQty(craftMaterialQtyState.qty + (dir === 'up' ? 1 : -1));
}
// 투입 개수 확정 → 제작 진행 팝업으로 복귀
function confirmCraftMaterialQty(){
  if(!craftMaterialQtyState || !craftPopup) return;
  const slot = craftPopup.slots.find(s => s.name === craftMaterialQtyState.name);
  if(slot) slot.qty = craftMaterialQtyState.qty;
  el('craftMaterialQtyModal').style.display = 'none';
  craftMaterialQtyState = null;
  renderCraftPopup();
  el('craftPopupModal').style.display = 'flex';
}

// ---- 제작소: 촉매 선택창(출력만 구현, 실제 촉매 등록/효과는 미구현) ----
function openCraftCatalystSelect(){
  el('craftCatalystModal').style.display = 'flex';
}
function closeCraftCatalystSelect(){
  el('craftCatalystModal').style.display = 'none';
}

// ---- 제작소: 제작 최종 확인 UI ----
// 활성화된 [제작] 버튼을 눌렀을 때만 열림(비활성 상태에선 버튼 자체가 클릭 안 되므로 별도 방어 불필요하나,
// 혹시 모를 직접 호출에 대비해 craftPopupCanCraft로 한 번 더 확인).
function openCraftConfirm(){
  if(!craftPopup || !craftPopupCanCraft(craftPopup)) return;
  el('craftPopupModal').style.display = 'none';
  renderCraftConfirmModal();
  el('craftConfirmModal').style.display = 'flex';
}
// [취소] → 기존 제작 진행 UI로 복귀. craftPopup 상태를 전혀 건드리지 않으므로 재료 등록 상태가
// 그대로 유지된 채(요청사항 7번) 제작 진행 팝업이 다시 표시됨.
function closeCraftConfirm(){
  el('craftConfirmModal').style.display = 'none';
  el('craftPopupModal').style.display = 'flex';
}
// [진행] → 제작 최종 확인 UI를 닫고 제작 연출 화면으로 이동(요청사항: "제작 연출 UI 및 결과 확인
// 기능" 작업에서 실제로 구현됨). 재료차감/성공-실패 최종 반영 등은 여전히 연출이 끝나는 시점에 처리됨.
function proceedCraftConfirm(){
  el('craftConfirmModal').style.display = 'none';
  el('craftPopupModal').style.display = 'none';
  openCraftAnim();
}

// ---- 제작소: 제작 연출 UI ----
// 요청사항 1~11번 전체 흐름: 7초 연출(실루엣+빛 구체+흔들림+로딩바+연출 텍스트) → 100% 완료 →
// "아이템을 클릭하여 결과 확인" → 클릭 시 1초 화이트 플래시와 함께 결과 아이콘 공개 → 결과 텍스트 +
// 인벤토리 지급 → [확인]으로 제작소 복귀.
function openCraftAnim(){
  if(!craftPopup) return;
  const item = findCraftItem(craftPopup.category, craftPopup.itemId);
  if(!item) return;
  // 버그 수정: 제작 비용이 실제로는 전혀 차감되지 않고 있었음(craftPopupCanCraft는 "충분한지 확인"만
  // 하고, 정작 차감하는 코드가 어디에도 없었음) — 재료가 소모되는 시점(연출 시작)과 동일하게 이 시점에
  // 골드를 차감하도록 추가.
  state.gold -= (item.craftCost || 0);
  // 버그 수정: 제작 플로우 전체에 saveState() 호출이 한 곳도 없어서, 골드/재료를 이미 차감한 뒤에도
  // 저장이 전혀 안 된 상태였음 — 연출 도중(7초 사이) 새로고침하면 방금 차감된 골드/재료가 저장 시점의
  // 값으로 되돌아가 버림(사실상 무료로 재시도 가능한 허점이기도 했음). 차감이 확정되는 이 시점에
  // 곧바로 저장해 새로고침해도 차감 상태가 유지되도록 함.
  // 요청사항 6번: 연출이 시작되는 순간부터 투입된 재료가 사용되는 것으로 처리함.
  // - 일반 재료(MISC_ITEMS)는 이 시점에 영구 소모.
  // - 장비 재료는 즉시 삭제하지 않고 "홀딩"만 함(인벤토리에서 빼내되 아직 완전히 버리지 않음) —
  //   결과가 확정될 때(성공→소모 완료/실패→반환 시 손상 변환)까지 craftAnim.heldEquip에 보관.
  const heldEquip = [];
  item.materials.forEach(m => {
    const resource = findCraftResource(m.name);
    if(!resource) return;
    if(resource.kind === 'misc'){
      state[resource.def.stateKey] = Math.max(0, (state[resource.def.stateKey] || 0) - m.need);
    } else {
      const pool = EQUIP_INVENTORY_POOLS.find(p => p.kind === resource.equipType);
      const arr = pool.items();
      for(let i = 0; i < m.need; i++){
        const idx = arr.findIndex(it => it.type === resource.typeId && !it.damaged && !isEquipInstanceWorn(resource.equipType, it.id));
        if(idx === -1) break; // craftPopupCanCraft가 이미 보유량을 검증했으므로 이론상 발생하지 않음
        const [inst] = arr.splice(idx, 1); // 홀딩: 인벤토리에서 제거
        heldEquip.push({ equipType: resource.equipType, typeId: inst.type, level: inst.level });
      }
    }
  });
  craftAnim = {
    category: craftPopup.category, itemId: craftPopup.itemId,
    phase: 'animating', progress: 0, startTime: Date.now(),
    resultSuccess: null, resultReturn: null, heldEquip,
    tickInterval: null, orbInterval: null,
  };
  saveState(); // 골드/재료 차감 확정 직후 저장(위 주석 참고)
  renderCraftAnimModal();
  el('craftAnimModal').style.display = 'flex';
  spawnCraftAnimOrb(); // 연출 시작과 동시에 첫 빛 구체 생성(이후 1초마다 반복, 요청사항 3번)
  craftAnim.orbInterval = setInterval(spawnCraftAnimOrb, 1000);
  craftAnim.tickInterval = setInterval(tickCraftAnimProgress, 500);
}
// 0.5초마다 호출 — 7초(=elapsed 7000ms)가 되기 전까지는 최소 0.01%씩 증가하며 99.99%를 넘지 않고,
// 7초가 되는 순간에만 finishCraftAnimProgress()가 정확히 100%로 확정함(요청사항 1·5번).
function tickCraftAnimProgress(){
  if(!craftAnim) return;
  const elapsed = Date.now() - craftAnim.startTime;
  if(elapsed >= 7000){
    finishCraftAnimProgress();
    return;
  }
  const target = (elapsed / 7000) * 99.99;
  const jitter = Math.random() * 1.5;
  const next = Math.min(99.99, Math.max(craftAnim.progress + 0.01, target + jitter));
  craftAnim.progress = Math.round(next * 100) / 100;
  renderCraftAnimProgress();
}
// 7초 완료 시점: 로딩바/빛구체 정지, 제작 성공확률로 성공·실패를 이 시점에 확정(요청사항 5·11번 —
// "결과는 연출 완료 시점에 결정하고, 결과 확인 단계에서는 이미 결정된 결과만 보여줌"), 클릭 대기 상태로 전환.
function finishCraftAnimProgress(){
  clearInterval(craftAnim.tickInterval);
  clearInterval(craftAnim.orbInterval);
  craftAnim.tickInterval = null;
  craftAnim.orbInterval = null;
  craftAnim.progress = 100;
  const item = findCraftItem(craftAnim.category, craftAnim.itemId);
  // 기존 제작 데이터에 등록된 성공 확률(item.successChance)을 그대로 사용 — 새 판정 공식을 만들지 않음.
  craftAnim.resultSuccess = Math.random() * 100 < (item.successChance || 0);
  // 실패라면 반환 결과도 이 시점에 함께 확정(요청사항 — 결과는 연출 완료 시점에 결정하고, 결과 확인
  // 단계에서는 이미 결정된 결과만 보여줌). 성공이면 반환 추첨 자체가 필요 없음(반환은 실패 전용).
  craftAnim.resultReturn = craftAnim.resultSuccess ? null : craftRollFailReturn(item);
  craftAnim.phase = 'awaitClick';
  renderCraftAnimModal();
}
// 실루엣 아이템 이미지를 클릭하면(클릭 대기 단계에서만 유효) 결과를 공개하고 인벤토리 지급까지 즉시 처리함.
function clickCraftAnimIcon(){
  if(!craftAnim || craftAnim.phase !== 'awaitClick') return;
  const item = findCraftItem(craftAnim.category, craftAnim.itemId);
  // craftGrantResultItems가 매칭된 홀딩 항목을 heldEquip에서 즉시 제거(splice)하므로, "이번 반환이
  // 투입했던 장비와 같은 종류라 손상으로 돌아오는가" 여부는 지급 처리 전에 미리 판정해서 저장해둬야
  // 함(그렇지 않으면 이후 결과 화면(craftAnimResultIconsHtml)이 항상 "손상 아님"으로 잘못 표시됨).
  if(craftAnim.resultReturn){
    const resource = findCraftResource(craftAnim.resultReturn.name);
    craftAnim.resultReturnDamaged = !!(resource && resource.kind === 'equip'
      && craftAnim.heldEquip.some(h => h.equipType === resource.equipType && h.typeId === resource.typeId));
  } else {
    craftAnim.resultReturnDamaged = false;
  }
  craftGrantResultItems(item); // 기존 인벤토리 지급 로직 재사용, craftAnim.resultSuccess/resultReturn을 그대로 적용
  craftAnim.phase = 'revealed';
  // 버그 수정: 제작 성공(또는 실패 반환) 아이템이 인벤토리에 지급된 뒤에도 저장이 안 되고 있었음
  // → 결과 공개 직후 새로고침하면 지급된 아이템이 그대로 증발했던 원인. 지급이 확정되는 이 시점에
  // 곧바로 저장해 새로고침해도 결과 아이템이 유지되도록 함.
  saveState();
  renderCraftAnimModal();
  triggerCraftAnimFlash(); // 1초 화이트 플래시(요청사항 7번) — 표시 전환 자체는 위 렌더에서 이미 완료됨
}
function triggerCraftAnimFlash(){
  const stage = el('craftAnimIconStage');
  if(!stage) return;
  const flash = document.createElement('div');
  flash.className = 'craft-anim-flash';
  stage.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove());
}
// [확인] → 제작 연출/결과 UI를 닫고 제작소 화면으로 복귀(요청사항 11번). 제작 진행 팝업은 이미
// proceedCraftConfirm에서 닫혔으므로 다시 열지 않음(제작소 목록이 그대로 뒤에 있음).
function closeCraftAnim(){
  if(craftAnim){
    restoreHeldCraftEquip(); // 정상 흐름에선 이미 비어있지만, 혹시 모를 잔여 홀딩분 방어적으로 복구
    clearInterval(craftAnim.tickInterval);
    clearInterval(craftAnim.orbInterval);
  }
  craftAnim = null;
  el('craftAnimModal').style.display = 'none';
}

// 연출 도중 제작소를 벗어나는 등 비정상적으로 중단되는 경우, 홀딩해뒀던 장비 재료가 그대로 사라지지
// 않도록 원래 인벤토리로 되돌려줌(이번 문서에 명시된 케이스는 아니지만, 아이템이 허공으로 사라지는
// 버그를 막기 위한 최소한의 방어 처리 — 정상 흐름의 성공/실패 지급 로직과는 무관).
function restoreHeldCraftEquip(){
  if(!craftAnim || !craftAnim.heldEquip || craftAnim.heldEquip.length === 0) return;
  craftAnim.heldEquip.forEach(h => {
    const pool = EQUIP_INVENTORY_POOLS.find(p => p.kind === h.equipType);
    if(pool) pool.items().push({ id: state.nextItemId++, type: h.typeId, level: h.level });
  });
  craftAnim.heldEquip = [];
}

// ---- 상점 탭/정렬 ----
function switchShopTab(tabId){
  const top = SHOP_TABS.find(t => t.id === tabId);
  if(top && top.subTabs){
    shopUI.tab = shopUI.equipTab || top.subTabs[0].id;
  } else {
    shopUI.tab = tabId;
    const equipTop = SHOP_TABS.find(t => t.id === 'equipment');
    if(equipTop && equipTop.subTabs.some(st => st.id === tabId)) shopUI.equipTab = tabId;
  }
  closeShopFilterMenu();
  renderShopTab();
}
function setShopFilter(filterId){
  shopUI.filter = filterId;
  // 정렬 기준이 바뀌면 목록 순서 자체가 바뀌므로, 지금 탭의 페이지를 1로 되돌림(범위를 벗어난 빈
  // 페이지에 머무는 것을 방지). 페이지네이션이 적용되지 않는 탭(마석/기타)은 SHOP_PAGE_KEY에 키가
  // 없어서 자연스럽게 아무 일도 안 일어남.
  const pageKey = SHOP_PAGE_KEY[shopUI.tab];
  if(pageKey) pageState[pageKey] = 1;
  closeShopFilterMenu();
  renderShopTab();
}
function toggleShopSortDir(){
  shopUI.dir = shopUI.dir === 'asc' ? 'desc' : 'asc';
  const pageKey = SHOP_PAGE_KEY[shopUI.tab];
  if(pageKey) pageState[pageKey] = 1; // setShopFilter와 동일한 이유로 페이지 초기화
  renderShopTab();
}

// ---- 페이지네이션 공통 이동 ----
// target(pageState/PAGE_SIZE의 키)마다 "이동 후 다시 그려야 할 화면"을 매핑해둠. 새 화면을 페이지네이션에
// 추가할 때 PAGE_SIZE·pageState에 키를 추가한 것과 동일하게, 여기에도 한 줄만 추가하면 이동 버튼이 그
// 화면을 자동으로 다시 그려줌(다른 화면의 페이지 이동 로직에는 영향 없음).
const PAGE_RENDER_FN = {
  invWeapon: renderInventoryList,
  invArmor: renderArmorInventoryList,
  invSub: renderSubInventoryList,
  invAccessory: renderAccessoryInventoryList,
  forgeSelect: renderForgeSelectList,
  repairSelect: renderRepairSelectList,
  shopWeapon: renderShopTab, shopArmor: renderShopTab, shopSub: renderShopTab, shopAccessory: renderShopTab, shopConsumable: renderShopTab, shopArtifact: renderShopTab,
  dungeonList: renderDungeonList,
  charStats: renderCharStats,
  charMenuInfo: renderCharacterMenu,
  // skillPage(공용/특화/기연 스킬 목록의 레벨 구간 페이지)는 캐릭터 메뉴 스킬 탭과 던전 우측 카드 스킬
  // 탭 2페이지가 공용 state로 함께 쓰므로, 페이지를 넘기면 둘 다 갱신함(둘 중 실제 존재하는 쪽만 반영됨).
  skillPage: () => { renderCharacterMenu(); renderHuntSidePanel(); },
  huntCharInfo: renderHuntSidePanel,
  huntCharSkill: renderHuntSidePanel,
  craftWeapon: () => renderCraftList('weapon'),
  craftArmor: () => renderCraftList('armor'),
  craftSub: () => renderCraftList('sub'),
  craftAccessory: () => renderCraftList('accessory'),
  patchNote: renderPatchNote,
};
// delta는 -1(이전) 또는 +1(다음). 실제 유효 범위 보정(clampPage)은 각 렌더 함수 내부에서 그 시점의
// 아이템 개수 기준으로 다시 계산하므로, 여기서는 페이지 번호만 옮기고 다시 그리기만 하면 됨.
// dungeonDrop:<던전id> 형태의 동적 타겟(던전 카드별 "획득 가능 아이템 안내" 페이지)은 던전마다 키가
// 달라 PAGE_RENDER_FN에 미리 등록해둘 수 없으므로, prefix로 감지해 renderDungeonList로 보냄.
function goPage(target, delta){
  pageState[target] = (pageState[target] || 1) + delta;
  const renderFn = PAGE_RENDER_FN[target] || (target.startsWith('dungeonDrop:') ? renderDungeonList : null);
  if(renderFn) renderFn();
}
function toggleShopFilterMenu(){
  shopFilterMenuOpen = !shopFilterMenuOpen;
  el('shopFilterMenu').style.display = shopFilterMenuOpen ? 'block' : 'none';
}
function closeShopFilterMenu(){
  shopFilterMenuOpen = false;
  el('shopFilterMenu').style.display = 'none';
}

// ---- 퀵슬롯 등록 모달 ----
// 플라스크(state.quickSlots)와 스킬(state.skillQuickSlots) 두 종류의 퀵슬롯이 같은 선택 모달을 공유함 —
// pendingQuickSlotKind로 지금 어느 배열에 등록할지 구분(둘 다 배열 인덱스=슬롯 번호라는 점은 동일).
let pendingQuickSlotIndex = null;
let pendingQuickSlotKind = 'flask'; // 'flask' | 'skill'
function openQuickSlotPicker(idx){
  pendingQuickSlotKind = 'flask';
  pendingQuickSlotIndex = idx;
  const list = el('quickSlotPickerList');
  // 보유 수량이 1개 이상인 플라스크만 후보로 나열함(0개 보유 종류는 제외) — 실제 보유 수량(state.consumables)과
  // 실시간으로 연동되므로, 이 팝업을 다시 열 때마다 그 시점의 최신 보유 현황이 그대로 반영됨.
  const ownedItems = Object.values(CONSUMABLES).filter(item => ((state.consumables && state.consumables[item.id]) || 0) > 0);
  if(ownedItems.length === 0){
    list.innerHTML = `<div class="inv-empty">등록 가능한 플라스크가 없습니다.</div>`;
  } else {
    list.innerHTML = ownedItems.map(item => `
      <button class="quickslot-pick-item" data-item="${item.id}">
        <span style="font-size:20px;">${itemIconHtml(item)}</span>
        <span>${item.name} <span style="color:var(--forge-cream-dim);">×${state.consumables[item.id]}</span></span>
      </button>
    `).join('');
  }
  el('quickSlotPickerModal').style.display = 'flex';
}
// 스킬 퀵슬롯 선택 목록 — 습득한 스킬(공용/특화 + 기연 전부)만 후보로 나열함. 실제 스킬 데이터가
// 없는 지금은 항상 빈 목록으로 표시되며, SKILLS에 항목이 등록되고 습득되는 즉시 자동으로 채워짐.
// 스킬 퀵슬롯 선택 목록 — 습득한 스킬(공용/특화 + 기연) 중 패시브를 제외하고 후보로 나열함(요구사항:
// "패시브 스킬은 퀵슬롯에 등록할 수 없습니다" — 패시브는 습득만 하면 항상 자동 적용되므로 등록 대상이 아님).
function openSkillQuickSlotPicker(idx){
  pendingQuickSlotKind = 'skill';
  pendingQuickSlotIndex = idx;
  const list = el('quickSlotPickerList');
  const learnedIds = [...(state.learnedSkills || []), ...(state.learnedAwakeningSkills || [])]
    .filter(id => SKILLS[id] && skillKindOf(SKILLS[id]) !== 'passive');
  if(learnedIds.length === 0){
    list.innerHTML = `<div class="inv-empty">등록 가능한 스킬이 없습니다.</div>`;
  } else {
    list.innerHTML = learnedIds.map(id => {
      const s = SKILLS[id];
      if(!s) return '';
      const grade = WEAPON_GRADES[s.grade];
      return `
        <button class="quickslot-pick-item" data-item="${id}">
          <span style="font-size:20px;">${skillIconHtml(s, 'quickslot-pick-icon')}</span>
          <span style="color:${grade ? grade.color : '#fff'};">${s.name}</span>
        </button>`;
    }).join('');
  }
  el('quickSlotPickerModal').style.display = 'flex';
}
function closeQuickSlotPicker(){
  el('quickSlotPickerModal').style.display = 'none';
  pendingQuickSlotIndex = null;
}

// ---- 캐릭터 정보 모달 & 스탯 분배 ----
// '적용'을 누르기 전까지는 draftStats/draftStatPoints(임시 값)만 바뀌고 실제 state는 그대로 유지됨.
let draftStats = null;
let draftStatPoints = null;
// 스탯별 "분배 모드" 활성화 여부. 해당 스탯의 +(또는 +N) 버튼을 한 번이라도 누르면 true가 되며,
// 이때부터 +N/- 버튼이 함께 표시됨(캐릭터 정보 모달을 열고 닫을 때마다 초기화됨).
let statAllocActive = { str: false, agi: false, int: false };
// 해당 스탯의 "아직 적용되지 않은 임시 분배 포인트" 수 — 마지막으로 적용(state.stats)된 값 대비
// draftStats가 얼마나 더 찍혀있는지로 계산함. -(마이너스) 버튼의 표시/차감 기준으로 쓰임.
function pendingStatPoints(key){
  if(!draftStats) return 0;
  return (draftStats[key] || 0) - (state.stats[key] || 0);
}
// 캐릭터 정보 모달(charStatsModal)과 캐릭터 메뉴("캐릭터" 탭)는 draftStats 등 동일한 데이터를 공유하며,
// 항상 둘 중 하나만 화면에 보이지만("모달은 대장간 화면에서만, 캐릭터 메뉴는 그 화면을 벗어나야 열림")
// 요구사항대로 "한쪽에서 바뀌면 다른 쪽도 즉시 반영"되도록 스탯이 바뀌는 모든 지점에서 항상 둘 다 다시 그림
// (둘 다 숨겨진 화면을 다시 그리는 건 비용이 거의 없음 — render()가 매번 상점/인벤토리를 다시 그리는 것과 동일한 방식).
function refreshCharDisplays(){
  renderCharStats();
  renderCharacterMenu();
  renderHuntSidePanel(); // 던전 우측 카드에 재사용 중인 캐릭터 정보 UI도 함께 갱신
}
function allocateStat(key){
  if(!draftStats) return;
  if((draftStatPoints || 0) <= 0) return;
  if(!(key in draftStats)) return;
  draftStats[key]++;
  draftStatPoints--;
  statAllocActive[key] = true;
  refreshCharDisplays();
}
// +N(레벨업당 지급 포인트, STAT_POINTS_PER_LEVEL) 버튼 — 분배 모드가 활성화된 스탯에서
// 사용 가능 포인트가 STAT_POINTS_PER_LEVEL 이상일 때만 동작. 이 상수가 바뀌면 한 번에 분배되는
// 양과 버튼 문자(render.js renderStatAllocRow)가 코드 수정 없이 함께 바뀜.
function allocateStatBulk(key){
  if(!draftStats) return;
  if(!statAllocActive[key]) return;
  if((draftStatPoints || 0) < STAT_POINTS_PER_LEVEL) return;
  if(!(key in draftStats)) return;
  draftStats[key] += STAT_POINTS_PER_LEVEL;
  draftStatPoints -= STAT_POINTS_PER_LEVEL;
  refreshCharDisplays();
}
// - 버튼 — 아직 적용되지 않은 해당 스탯의 임시 분배 포인트만 1 차감하고, 그만큼 사용 가능 포인트로 되돌림.
function deallocateStat(key){
  if(!draftStats) return;
  if(!(key in draftStats)) return;
  if(pendingStatPoints(key) <= 0) return;
  draftStats[key]--;
  draftStatPoints++;
  refreshCharDisplays();
}
// 적용: draft 값을 실제 state에 반영하고 저장
function applyStatAlloc(){
  if(!draftStats) return;
  ensurePlayerVitals();
  state.stats = { str: draftStats.str, agi: draftStats.agi, int: draftStats.int };
  state.statPoints = draftStatPoints;
  recheckEquipRequirements(); // 스탯이 바뀌었으므로(전체 초기화 포함) 현재 장착 중인 장비 요구조건 재검사, 만족 못하면 즉시 해제
  // 스탯으로 늘어난 최대 체력/마나만큼 그대로 채워줌 (아직 피해를 입는 시스템이 없으므로 항상 풀피 유지)
  state.playerHp = effectiveMaxHp(state.playerLevel);
  state.playerMp = effectiveMaxMp(state.playerLevel);
  saveState();
  draftStats = { str: state.stats.str, agi: state.stats.agi, int: state.stats.int };
  draftStatPoints = state.statPoints;
  refreshCharDisplays();
}
// 초기화: 이번에 임시로 찍었던 포인트를 되돌려 마지막으로 적용된 상태에서 다시 찍을 수 있게 함
function resetStatAlloc(){
  if(!draftStats) return;
  draftStats = { str: state.stats.str, agi: state.stats.agi, int: state.stats.int };
  draftStatPoints = state.statPoints || 0;
  refreshCharDisplays();
}
// 전체 초기화: 마지막으로 '적용'되어 실제 저장된 스탯까지 포함해 지금까지 찍은 모든 포인트를 되돌림.
// draft만 바뀌므로 실제로 확정되려면 여전히 '적용'을 눌러야 함.
function resetStatAllocFull(){
  if(!draftStats) return;
  const totalPoints = (state.statPoints || 0) + (state.stats.str || 0) + (state.stats.agi || 0) + (state.stats.int || 0);
  draftStats = { str: 0, agi: 0, int: 0 };
  draftStatPoints = totalPoints;
  refreshCharDisplays();
}
function openCharStats(){
  draftStats = { str: state.stats.str, agi: state.stats.agi, int: state.stats.int };
  draftStatPoints = state.statPoints || 0;
  statAllocActive = { str: false, agi: false, int: false };
  pageState.charStats = 1; // 모달을 열 때는 항상 1페이지(장비창+캐릭터 정보)부터 보여줌
  refreshCharDisplays();
  el('charStatsModal').style.display = 'flex';
}
function closeCharStats(){
  // 적용하지 않은 임시 배분은 버림
  draftStats = null;
  draftStatPoints = null;
  statAllocActive = { str: false, agi: false, int: false };
  el('charStatsModal').style.display = 'none';
}

// ---- 대장간 "강화 장비 선택" 팝업 ----
function openForgeSelect(){
  if(isEnhancing) return;
  pageState.forgeSelect = 1; // 열 때마다 항상 1페이지부터
  renderForgeSelectList();
  el('forgeSelectModal').style.display = 'flex';
}
function closeForgeSelect(){
  el('forgeSelectModal').style.display = 'none';
}

// ---- 캐릭터 메뉴(좌측 상단바 "캐릭터") ----
// 탭 전환은 CHARACTER_TABS(data.js)를 그대로 따르므로, 새 탭이 추가돼도 이 함수는 수정할 필요 없음
// (설정 화면의 activeSettingsCategory/switchSettingsCategory와 동일한 패턴).
let activeCharTab = CHARACTER_TABS.length > 0 ? CHARACTER_TABS[0].id : null;
function switchCharTab(tabId){
  activeCharTab = tabId;
  renderCharacterMenu();
}
// 던전 우측 카드 전용 탭 선택 상태 — activeCharTab(캐릭터 메뉴)과는 독립적으로 관리함("지금 보고 있는
// 탭"은 화면마다 다를 수 있는 화면 상태일 뿐이고, 실제 데이터는 공용 state이므로 값 자체는 항상 일치함).
let huntCharTab = CHARACTER_TABS.length > 0 ? CHARACTER_TABS[0].id : null;
function switchHuntCharTab(tabId){
  huntCharTab = tabId;
  renderHuntSidePanel();
}

// ---- 스킬 탭(캐릭터 메뉴 하위) ----
// 하위 탭 전환은 SKILL_CATEGORIES(data.js)를 그대로 따르므로, 새 분류가 추가돼도 이 함수는 수정할 필요 없음.
let activeSkillCategory = SKILL_CATEGORIES.length > 0 ? SKILL_CATEGORIES[0].id : null;
function switchSkillCategory(catId){
  activeSkillCategory = catId;
  renderCharacterMenu();
  renderHuntSidePanel(); // 던전 우측 카드 스킬 탭도 같은 activeSkillCategory를 공유해서 씀
}
// 스킬 탭 세로 탭(공격/버프/패시브) 전환 — 요구사항 3번: 공용/특화/기연 하위 탭을 바꾸거나 페이지를
// 넘겨도 이 값은 별도로 건드리지 않으므로(위 switchSkillCategory와 goPage 어디에도 activeSkillKind를
// 건드리는 코드가 없음) 선택 상태가 그대로 유지되고, 캐릭터 메뉴에 새로 진입할 때만(navigation.js
// showView) 항상 '공격'으로 초기화됨.
let activeSkillKind = SKILL_KIND_TABS.length > 0 ? SKILL_KIND_TABS[0].id : null;
function switchSkillKind(kindId){
  activeSkillKind = kindId;
  renderCharacterMenu();
  renderHuntSidePanel();
}
// 스킬 습득: 포인트를 소비하고 해당 분류의 습득 목록(learnedSkills/learnedAwakeningSkills)에 추가함.
// 에픽/유니크는 아직 해금 방식이 구현되지 않아(비급/깨달음 소비 예정) canLearnSkill이 항상 false를 반환하므로
// 이 함수까지 도달해도 아무 일도 일어나지 않음 — 실제 해금 로직이 추가되면 이 함수만 손보면 됨.
// 실제 데이터 변경(포인트 차감+습득)은 이 함수만 담당하고, 화면에서는 아래 스킬 습득 확인 모달을 거친 뒤에만
// 호출됨(확인을 누르기 전까지는 데이터가 바뀌지 않아야 하므로).
// 스킬 업그레이드 요구사항 3·4번: upgradeFrom이 지정된 스킬을 습득하면 그 하위 스킬을 목록에서 제거하고
// 새 스킬로 교체. 하위 스킬이 등록돼 있던 퀵슬롯이 있으면 그 위치(인덱스)를 그대로 유지한 채 스킬 id만
// 교체하고, 등록돼 있지 않았다면 새로 등록하지 않음(요구사항 4번 "중요한 규칙" 그대로). 기연(awakening)은
// 이 요구사항 대상이 아니므로(업그레이드 체인은 현재 공용/특화 스킬에만 적용) 건드리지 않음 — upgradeFrom을
// 쓰는 기연 스킬이 생기면 이 분기도 필요해질 수 있으나 지금은 범위 밖.
function learnSkill(id){
  if(!canLearnSkill(id)) return;
  const s = SKILLS[id];
  const cost = s.cost || 1;
  if(s.category === 'awakening'){
    state.awakeningPoints -= cost;
    state.learnedAwakeningSkills.push(id);
  } else {
    state.skillPoints -= cost;
    if(s.upgradeFrom){
      const oldId = s.upgradeFrom;
      state.learnedSkills = state.learnedSkills.filter(existingId => existingId !== oldId);
      state.skillQuickSlots = state.skillQuickSlots.map(slotId => slotId === oldId ? id : slotId);
    }
    state.learnedSkills.push(id);
  }
  renderCharacterMenu();
  renderHuntSidePanel(); // 던전 우측 카드 스킬 탭도 습득 가능 여부 등 최신 상태로 갱신
  renderSkillQuickSlots(); // 퀵슬롯이 교체됐을 수 있으므로 명시적으로 다시 갱신(다른 퀵슬롯 변경 함수들과 동일한 패턴)
  saveState();
}
// 스킬 퀵슬롯 초기화 — 등록된 스킬을 전부 제거함(캐릭터 메뉴 스킬 탭에서만 노출되는 버튼).
function resetSkillQuickSlots(){
  state.skillQuickSlots = Array.from({ length: SKILL_QUICK_SLOT_COUNT }, () => null);
  renderSkillQuickSlots();
  saveState();
}

// ---- 스킬 습득 확인 모달 ----
// 상점의 "개수 지정 구매" 팝업(buyQtyModal)과 동일한 레이아웃(아이콘 박스 + 수치 두 줄 + 구분선 +
// 취소/확인 버튼)을 그대로 재사용함. 실제 습득(포인트 차감)은 확인 버튼을 눌러야만 기존 learnSkill이
// 실행되며, 취소하거나 모달을 그냥 닫으면 데이터는 전혀 바뀌지 않음.
let pendingLearnSkillId = null;
function openSkillLearnConfirm(id){
  if(!canLearnSkill(id)) return; // 습득 불가 상태(포인트 부족 등)에서는 버튼 자체가 비활성화되어 있어 방어적 처리
  const s = SKILLS[id];
  pendingLearnSkillId = id;
  el('skillLearnIconBox').innerHTML = skillIconHtml(s) + `<span class="tooltip" id="skillLearnTooltip">${buildSkillTooltipHtml(id)}</span>`;
  const pool = s.category === 'awakening' ? (state.awakeningPoints || 0) : (state.skillPoints || 0);
  el('skillLearnCurrentSp').textContent = pool;
  el('skillLearnUseSp').textContent = s.cost || 1;
  el('skillLearnConfirmModal').style.display = 'flex';
}
function closeSkillLearnConfirm(){
  el('skillLearnConfirmModal').style.display = 'none';
  pendingLearnSkillId = null;
}
function confirmSkillLearn(){
  const id = pendingLearnSkillId;
  closeSkillLearnConfirm();
  if(id) learnSkill(id);
}
function cancelSkillLearn(){
  closeSkillLearnConfirm();
}

// ---- 흔적 사용(장비 복구) 확인 모달 ----
// 상점 "개수 지정 구매" 팝업/스킬 습득 확인 모달과 동일한 레이아웃(아이콘 박스 + 골드 두 줄 + 구분선 +
// 취소/확인 버튼)을 그대로 재사용함. 흔적은 개수 개념이 없는 1회성 소비 아이템이라 수량 스텝퍼는 없음.
// "소비 아이템" 탭의 흔적 카드에서 "사용하기"를 누르면 이 흐름이 시작됨(main.js → useTraceItem).
let pendingTraceRestoreId = null;
function useTraceItem(id){
  const trace = (state.traceInventory || []).find(t => t.id === id);
  if(!trace) return;
  // 인벤토리 슬롯이 없으면 복구 확인 팝업 자체를 열지 않고 안내 팝업만 띄움(흔적을 소모하지 않음 — 요구사항 10).
  if(equipInventoryFull()){
    el('traceSlotFullModal').style.display = 'flex';
    return;
  }
  pendingTraceRestoreId = id;
  renderTraceRestoreModal();
  el('traceRestoreModal').style.display = 'flex';
}
function closeTraceRestoreConfirm(){
  el('traceRestoreModal').style.display = 'none';
  pendingTraceRestoreId = null;
}
function renderTraceRestoreModal(){
  const trace = (state.traceInventory || []).find(t => t.id === pendingTraceRestoreId);
  if(!trace) return;
  const cost = traceRecoveryCost(trace.forType);
  el('traceRestoreIconBox').innerHTML = weaponIconHtml(trace.forType, 'shop-icon-img');
  el('traceRestoreName').textContent = `${weaponName(trace.forType)}의 흔적`;
  el('traceRestoreCurrentGold').textContent = '🪙 ' + state.gold.toLocaleString();
  el('traceRestoreCost').textContent = '🪙 ' + cost.toLocaleString();
  el('traceRestoreConfirmBtn').disabled = state.gold < cost;
}
function confirmTraceRestore(){
  const trace = (state.traceInventory || []).find(t => t.id === pendingTraceRestoreId);
  closeTraceRestoreConfirm();
  if(!trace) return;
  // 팝업이 열려있는 사이 골드/슬롯 상황이 바뀌었을 가능성에 대비한 방어적 재확인(정상 흐름에서는
  // 확인 버튼이 이미 골드 부족을 막아주고, 슬롯 부족은 애초에 팝업이 열리지 않으므로 도달하지 않음).
  if(equipInventoryFull()){ el('traceSlotFullModal').style.display = 'flex'; return; }
  const cost = traceRecoveryCost(trace.forType);
  if(state.gold < cost) return;

  state.gold -= cost;
  const idx = state.traceInventory.findIndex(t => t.id === trace.id);
  if(idx !== -1) state.traceInventory.splice(idx, 1);

  // 복구되는 장비는 파괴 당시 강화 단계가 아닌 +0으로 지급됨(요구사항 8) — 능력치/등급/아이템 레벨 등은
  // 원래 장비 데이터(forType의 WEAPON_TYPES/ARMOR_TYPES/ACCESSORY_TYPES 항목)를 그대로 사용함.
  const w = wpn(trace.forType);
  const newItem = { id: state.nextItemId++, level: 0, type: trace.forType, currentDurability: freshCurrentDurability(trace.forType) };
  if(w.equipType === 'armor') state.armorInventory.push(newItem);
  else if(w.equipType === 'accessory') state.accessoryInventory.push(newItem);
  else state.inventory.push(newItem);

  openTraceRestoreResult(trace.forType, w.name);
  render();
  saveState();
}
function closeTraceSlotFullModal(){
  el('traceSlotFullModal').style.display = 'none';
}
function openTraceRestoreResult(type, itemName){
  el('traceRestoreResultIconBox').innerHTML = weaponIconHtml(type, 'shop-icon-img');
  el('traceRestoreResultText').innerHTML = `'${itemName}' 이/가<br>인벤토리로 지급되었습니다.`;
  el('traceRestoreResultModal').style.display = 'flex';
}
function closeTraceRestoreResult(){
  el('traceRestoreResultModal').style.display = 'none';
}

// ---- 스킬 초기화 확인 모달 ----
// 습득에 사용한 스킬 포인트 총합을 계산해 확인창에 보여주고, 확인 시 각 분류가 쓰던 풀(공용·특화는
// skillPoints, 기연은 awakeningPoints — 기존 포인트 구조를 그대로 유지하고 새 습득 조건은 만들지 않음)에
// 각각 정확히 되돌려줌. 확인창의 "현재 보유 SP"/"초기화 시 획득 SP"는 두 풀을 합산한 값으로 표시함.
// 스킬 업그레이드로 교체된 스킬(예: 오연격)은 그 업그레이드 체인 전체(이연격→삼연격→사연격→오연격)에서
// 소모한 포인트를 전부 합산해서 돌려줌(chainSkillCost) — 중간 단계에 썼던 포인트가 사라지지 않도록.
function learnedSkillCost(id){
  const s = SKILLS[id];
  return (s && s.cost) || 1;
}
// 스킬 업그레이드(upgradeFrom) 체인 전체에서 실제로 소모한 포인트 총합 — 예: 오연격을 보유 중이면
// 이연격→삼연격→사연격→오연격 4단계 모두 각각 습득할 때 포인트를 냈으므로 4단계 cost를 전부 합산해서
// 반환함(초기화 시 그 포인트를 전부 돌려받기 위함). upgradeFrom이 없는 일반 스킬은 자기 자신의 cost만
// 반환하므로 기존 방식과 동일(회귀 없음). visited로 순환 참조가 있어도 무한루프에 빠지지 않도록 방어.
function chainSkillCost(id){
  let sum = 0;
  let curId = id;
  const visited = new Set();
  while(curId && SKILLS[curId] && !visited.has(curId)){
    visited.add(curId);
    sum += learnedSkillCost(curId);
    curId = SKILLS[curId].upgradeFrom;
  }
  return sum;
}
function totalUnusedSkillPoints(){
  return (state.skillPoints || 0) + (state.awakeningPoints || 0);
}
function totalSpentSkillPoints(){
  const normal = (state.learnedSkills || []).reduce((sum, id) => sum + chainSkillCost(id), 0);
  const awaken = (state.learnedAwakeningSkills || []).reduce((sum, id) => sum + chainSkillCost(id), 0);
  return normal + awaken;
}
function openSkillResetConfirm(){
  el('skillResetCurrentSp').textContent = totalUnusedSkillPoints();
  el('skillResetGainSp').textContent = totalSpentSkillPoints();
  el('skillResetConfirmModal').style.display = 'flex';
}
function closeSkillResetConfirm(){
  el('skillResetConfirmModal').style.display = 'none';
}
function cancelSkillReset(){
  closeSkillResetConfirm();
}
function confirmSkillReset(){
  closeSkillResetConfirm();
  const normalRefund = (state.learnedSkills || []).reduce((sum, id) => sum + chainSkillCost(id), 0);
  const awakenRefund = (state.learnedAwakeningSkills || []).reduce((sum, id) => sum + chainSkillCost(id), 0);
  state.skillPoints = (state.skillPoints || 0) + normalRefund;
  state.awakeningPoints = (state.awakeningPoints || 0) + awakenRefund;
  state.learnedSkills = [];
  state.learnedAwakeningSkills = [];
  resetSkillQuickSlots(); // 습득 스킬이 사라지므로 등록된 스킬 퀵슬롯도 전부 초기화(내부에서 렌더+저장까지 처리)
  renderCharacterMenu();
  saveState();
}

// ---- 공지사항(패치노트) 모달 ----
// patchnote1.png부터 연속 번호 이미지가 존재하는 개수만큼만 페이지로 취급함(11~12번 요구사항).
// 폴더 목록을 읽는 방법이 없는 정적 페이지 환경이라, Image 로드 성공/실패로 순차 확인하며 실패하는
// 순간(또는 PATCHNOTE_MAX_PAGES 도달) 멈춰서 무한 요청을 방지함.
let patchNoteTotalPages = 0;
function probePatchNoteImages(){
  return new Promise(resolve => {
    function tryNext(n){
      if(n > PATCHNOTE_MAX_PAGES){ resolve(n - 1); return; }
      const img = new Image();
      img.onload = () => tryNext(n + 1);
      img.onerror = () => resolve(n - 1);
      img.src = `${PATCHNOTE_IMAGE_DIR}patchnote${n}.png`;
    }
    tryNext(1);
  });
}
// "오늘 다시 보지 않음" 값 전용 저장(게임 세이브와 분리, hasClaudeStorage()는 state.js에 이미 정의된
// window.storage 우선+localStorage 폴백 판정 함수를 그대로 재사용함).
async function getPatchNoteHideDate(){
  try{
    if(hasClaudeStorage()){
      const res = await window.storage.get(PATCHNOTE_HIDE_DATE_KEY, false);
      return res && res.value ? res.value : null;
    }
    return localStorage.getItem(PATCHNOTE_HIDE_DATE_KEY);
  }catch(e){
    try{ return localStorage.getItem(PATCHNOTE_HIDE_DATE_KEY); }
    catch(e2){ return null; }
  }
}
async function setPatchNoteHideDateToday(){
  const today = todayDateString();
  try{
    if(hasClaudeStorage()){
      await window.storage.set(PATCHNOTE_HIDE_DATE_KEY, today, false);
      return;
    }
  }catch(e){ /* 아래 localStorage로 폴백 */ }
  try{ localStorage.setItem(PATCHNOTE_HIDE_DATE_KEY, today); }
  catch(e){ /* 저장 실패해도 게임 진행에는 영향 없음 */ }
}
function todayDateString(){
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// 자동 표시든(게임 시작) 수동 열기든(대장간 📣 버튼) 항상 1페이지부터 시작.
function openPatchNote(){
  if(patchNoteTotalPages < 1) return; // patchnote1.png 자체가 없으면 안전하게 무시(11번 요구사항)
  pageState.patchNote = 1;
  el('patchNoteHideTodayCheckbox').checked = false;
  renderPatchNote();
  el('patchNoteModal').style.display = 'flex';
}
function closePatchNote(){
  el('patchNoteModal').style.display = 'none';
  // 체크했을 때만 오늘 날짜 저장(체크 안 했으면 다음 게임 시작 때 다시 자동 표시).
  if(el('patchNoteHideTodayCheckbox').checked) setPatchNoteHideDateToday();
}
// 게임 시작 시 1회 호출: 이미지 개수 확인 후, 오늘 이미 숨김 처리된 게 아니면 자동으로 엶.
// loadState()의 game state(state 객체)와는 무관하게 동작하므로 독립적으로 호출해도 안전함.
async function initPatchNoteSystem(){
  patchNoteTotalPages = await probePatchNoteImages();
  if(patchNoteTotalPages < 1) return;
  const hideDate = await getPatchNoteHideDate();
  if(hideDate === todayDateString()) return;
  openPatchNote();
}

// ---- 설정 모달 ----
let activeSettingsCategory = SETTINGS_SCHEMA.length > 0 ? SETTINGS_SCHEMA[0].id : null;
function openSettings(){
  renderSettings();
  el('settingsModal').style.display = 'flex';
}
function closeSettings(){
  el('settingsModal').style.display = 'none';
}
function switchSettingsCategory(catId){
  activeSettingsCategory = catId;
  renderSettings();
}
function toggleSetting(id){
  if(!state.settings) state.settings = {};
  state.settings[id] = !state.settings[id];
  renderSettings();
  saveState();
}
// radio 타입 설정값 선택(단일 선택) — toggleSetting/adjustSetting과 동일한 패턴(state.settings에 저장 후
// renderSettings+saveState로 화면 갱신·저장, 별도 저장 시스템을 새로 만들지 않음).
function selectSettingRadio(id, value){
  if(!state.settings) state.settings = {};
  if(state.settings[id] === value) return; // 이미 선택된 값이면 아무 것도 하지 않음
  state.settings[id] = value;
  renderSettings();
  saveState();
  // 화면 프리셋 자체를 바꾸거나(전역 body 클래스 갱신) 모바일 우측 패널 형식을 바꿀 때(둘 다 body
  // 클래스로 반영되므로) 즉시 화면에 반영되도록 함.
  if(id === 'screenPreset' || id === 'mobileHuntPanelStyle') applyScreenPreset();
}
// 현재 선택된 화면 프리셋(state.settings.screenPreset)과, 모바일에서 던전 화면의 우측 패널을 여는
// 버튼 형식(state.settings.mobileHuntPanelStyle — '가로바' 또는 '정사각형 버튼')을 문서 최상위(body)에
// 클래스로 반영. desktop-preset이면 기존 화면과 완전히 동일하게 보임. ensureSettingsDefaults()
// (state.js)가 게임 로드/초기화 시마다 호출하므로 새로고침·새 게임 어느 경우에도 항상 현재 값이 반영됨.
function applyScreenPreset(){
  const preset = (state.settings && state.settings.screenPreset) || 'desktop';
  document.body.classList.toggle('desktop-preset', preset === 'desktop');
  document.body.classList.toggle('mobile-preset', preset === 'mobile');
  const panelStyle = (state.settings && state.settings.mobileHuntPanelStyle) || 'bar';
  document.body.classList.toggle('mobile-panel-style-bar', panelStyle === 'bar');
  document.body.classList.toggle('mobile-panel-style-corner', panelStyle === 'corner');
  relocateHuntTopToggleBtn(preset);
}
// 모바일 UI 개편 3단계: #huntTopToggleBtn은 원래 #combatArena 안에 깊이 중첩돼 있어서, 모바일에서
// huntCard 전체를 display:none으로 숨기면 이 버튼도 함께 사라져 패널을 다시 닫을 방법이 없어짐(요구사항:
// 닫기 버튼이 항상 접근 가능해야 함). 그래서 모바일에서는 버튼 노드 자체를(새 버튼을 만들지 않고) huntCard
// 밖으로 — #huntViewLayout 맨 앞으로 — 옮겨서 huntCard가 숨어도 항상 클릭 가능하게 함. 가로바/정사각형
// 두 형식 모두 이 위치를 그대로 공유하고(정사각형은 어차피 position:fixed라 문서상 위치는 시각적으로
// 무관함, 가로바는 문서 흐름상 맨 위에 있어야 해서 이 위치가 필요함) CSS(body.mobile-panel-style-*)만
// 다르게 적용됨. 데스크톱으로 돌아오면 원래 자리(#combatArena 맨 앞)로 되돌려 기존 위치/좌표 계산에
// 전혀 영향이 없도록 함. 버튼 요소 자체(이벤트 리스너 포함)는 그대로 재사용 — appendChild/insertBefore로
// 옮기기만 하므로 main.js의 클릭 리스너는 다시 걸 필요 없음.
function relocateHuntTopToggleBtn(preset){
  const btn = el('huntTopToggleBtn');
  const layout = el('huntViewLayout');
  const combatArena = el('combatArena');
  if(!btn || !layout || !combatArena) return; // 정적 마크업이라 보통 항상 존재하지만, 안전하게 가드
  if(preset === 'mobile'){
    // 실기기 테스트 결과 position:fixed로 화면 한쪽 구석에 띄우는 방식은 버튼을 찾기 어렵다는 피드백에
    // 따라, 문서 흐름 안에 항상 보이는 요소로 바꿈 — #huntViewLayout의 맨 앞(huntCard/패널보다 위)에
    // 배치해 던전 화면에 들어가면 다른 것에 가리거나 화면 밖으로 밀려날 일 없이 항상 눈에 보이게 함.
    if(btn.parentElement !== layout || btn !== layout.firstChild) layout.insertBefore(btn, layout.firstChild);
  } else if(btn.parentElement !== combatArena){
    combatArena.insertBefore(btn, combatArena.firstChild);
  }
}
// stepper 타입 설정값을 증감(min/max/step은 SETTINGS_SCHEMA에서 조회)
function adjustSetting(id, dir){
  let itemDef = null;
  SETTINGS_SCHEMA.forEach(cat => cat.items.forEach(it => {
    if(it.type === 'stepper-row'){
      it.fields.forEach(f => { if(f.id === id) itemDef = f; });
    } else if(it.id === id){
      itemDef = it;
    }
  }));
  if(!itemDef) return;
  if(!state.settings) state.settings = {};
  const current = state.settings[id] != null ? state.settings[id] : itemDef.default;
  const next = dir === 'up' ? current + itemDef.step : current - itemDef.step;
  state.settings[id] = Math.max(itemDef.min, Math.min(itemDef.max, next));
  renderSettings();
  saveState();
}

// ---- 판매 확인 모달 ----
// 장비/소비 아이템 판매 시 공통으로 쓰는 확인창. openSellConfirm(라벨, 가격, 확정시 실행할 함수)로 호출.
let pendingSellAction = null;
function openSellConfirm(itemLabel, price, onConfirm){
  pendingSellAction = onConfirm;
  el('sellConfirmBody').textContent = `정말 ${itemLabel}을(를) ${price.toLocaleString()}G에 판매하시겠습니까? 판매 후 재구매 불가능합니다!`;
  el('sellConfirmModal').style.display = 'flex';
}
function closeSellConfirm(){
  el('sellConfirmModal').style.display = 'none';
  pendingSellAction = null;
}
function confirmSell(){
  const action = pendingSellAction;
  closeSellConfirm();
  if(action) action();
}
function cancelSell(){
  closeSellConfirm();
}

// ---- 상점 "개수 지정 구매" 팝업 ----
// 상점의 buy-weapon(무기/방어구/장신구 공용)/buy-consumable/buy-artifact 세 구매 버튼을 클릭하면
// 즉시 구매하는 대신 이 팝업을 먼저 띄움. 실제 구매(골드 차감/인벤토리 지급)는 기존 구매 함수
// (actions.js의 buyWeapon/buyFlask/buyArtifact)를 그대로 재사용함 — 여기서는 개수만 정하고 확정 시
// 그 함수를 개수만큼 반복 호출함(shopBuyMaxQty로 이미 상한을 계산해두므로 반복 중 실패할 일은 없음).
let buyQtyState = null; // { action, typeId, qty, unitPrice, maxQty }
function openBuyQtyModal(action, typeId){
  const unitPrice = shopBuyUnitPrice(action, typeId);
  const maxQty = shopBuyMaxQty(action, typeId);
  if(maxQty <= 0) return; // 방어적 처리(정상적으로는 버튼 자체가 비활성화되어 있어 여기 도달하지 않음)
  buyQtyState = { action, typeId, qty: 1, unitPrice, maxQty };
  renderBuyQtyModal();
  el('buyQtyModal').style.display = 'flex';
}
function closeBuyQtyModal(){
  el('buyQtyModal').style.display = 'none';
  buyQtyState = null;
}
// 구매 개수를 1~maxQty 범위로 정규화해서 반영(직접 입력/▲▼ 버튼 공용 진입점).
function setBuyQty(n){
  if(!buyQtyState) return;
  const num = Math.floor(Number(n));
  const clamped = Number.isFinite(num) ? Math.max(1, Math.min(buyQtyState.maxQty, num)) : 1;
  buyQtyState.qty = clamped;
  renderBuyQtyModal();
}
function adjustBuyQty(dir){
  if(!buyQtyState) return;
  setBuyQty(buyQtyState.qty + (dir === 'up' ? 1 : -1));
}
function renderBuyQtyModal(){
  if(!buyQtyState) return;
  const { action, typeId, qty, unitPrice, maxQty } = buyQtyState;
  const display = shopBuyItemDisplay(action, typeId);
  const iconBox = el('buyQtyIconBox');
  iconBox.style.background = display.borderColor ? '#242424' : '';
  iconBox.style.borderColor = display.borderColor || '';
  iconBox.innerHTML = display.iconHtml + `<span class="tooltip" id="buyQtyTooltip">${display.tooltipHtml}</span>`;
  el('buyQtyInput').value = qty;
  el('buyQtyInput').max = maxQty;
  el('buyQtyCurrentGold').textContent = '🪙 ' + state.gold.toLocaleString();
  el('buyQtyTotalGold').textContent = '🪙 ' + (unitPrice * qty).toLocaleString();
  el('buyQtyUpBtn').disabled = qty >= maxQty;
  el('buyQtyDownBtn').disabled = qty <= 1;
}

