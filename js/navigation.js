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
  }
  el('forgeView').style.display = name === 'forge' ? 'block' : 'none';
  el('shopView').style.display = name === 'shop' ? 'block' : 'none';
  el('inventoryView').style.display = name === 'inventory' ? 'block' : 'none';
  el('dungeonListView').style.display = name === 'dungeonlist' ? 'block' : 'none';
  el('huntView').style.display = name === 'hunt' ? 'block' : 'none';
  currentView = name;
  if(name === 'dungeonlist') renderDungeonList();
  if(name === 'hunt') renderHunt();
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
function closeToForge(){ showView('forge'); }

// ---- 인벤토리 탭 ----
function switchInvTab(tab){
  el('invTabWeapon').style.display = tab === 'weapon' ? 'block' : 'none';
  el('invTabArtifact').style.display = tab === 'artifact' ? 'block' : 'none';
  el('invTabConsumable').style.display = tab === 'consumable' ? 'block' : 'none';
  el('invTabStone').style.display = tab === 'stone' ? 'block' : 'none';
  el('invTabMisc').style.display = tab === 'misc' ? 'block' : 'none';
  el('invTabBtnWeapon').classList.toggle('active', tab === 'weapon');
  el('invTabBtnArtifact').classList.toggle('active', tab === 'artifact');
  el('invTabBtnConsumable').classList.toggle('active', tab === 'consumable');
  el('invTabBtnStone').classList.toggle('active', tab === 'stone');
  el('invTabBtnMisc').classList.toggle('active', tab === 'misc');
}

// ---- 상점 탭/정렬 ----
function switchShopTab(tabId){
  shopUI.tab = tabId;
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
  shopWeapon: renderShopTab, shopArmor: renderShopTab, shopConsumable: renderShopTab, shopArtifact: renderShopTab,
  dungeonList: renderDungeonList,
};
// delta는 -1(이전) 또는 +1(다음). 실제 유효 범위 보정(clampPage)은 각 렌더 함수 내부에서 그 시점의
// 아이템 개수 기준으로 다시 계산하므로, 여기서는 페이지 번호만 옮기고 다시 그리기만 하면 됨.
function goPage(target, delta){
  pageState[target] = (pageState[target] || 1) + delta;
  const renderFn = PAGE_RENDER_FN[target];
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
let pendingQuickSlotIndex = null;
function openQuickSlotPicker(idx){
  pendingQuickSlotIndex = idx;
  const list = el('quickSlotPickerList');
  list.innerHTML = Object.values(CONSUMABLES).map(item => `
    <button class="quickslot-pick-item" data-item="${item.id}">
      <span style="font-size:20px;">${item.icon}</span>
      <span>${item.name} <span style="color:var(--forge-cream-dim);">×${(state.consumables && state.consumables[item.id]) || 0}</span></span>
    </button>
  `).join('');
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
function allocateStat(key){
  if(!draftStats) return;
  if((draftStatPoints || 0) <= 0) return;
  if(!(key in draftStats)) return;
  draftStats[key]++;
  draftStatPoints--;
  renderCharStats();
}
// 적용: draft 값을 실제 state에 반영하고 저장
function applyStatAlloc(){
  if(!draftStats) return;
  ensurePlayerVitals();
  state.stats = { str: draftStats.str, agi: draftStats.agi, int: draftStats.int };
  state.statPoints = draftStatPoints;
  // 스탯으로 늘어난 최대 체력/마나만큼 그대로 채워줌 (아직 피해를 입는 시스템이 없으므로 항상 풀피 유지)
  state.playerHp = effectiveMaxHp(state.playerLevel);
  state.playerMp = effectiveMaxMp(state.playerLevel);
  saveState();
  draftStats = { str: state.stats.str, agi: state.stats.agi, int: state.stats.int };
  draftStatPoints = state.statPoints;
  renderCharStats();
}
// 초기화: 이번에 임시로 찍었던 포인트를 되돌려 마지막으로 적용된 상태에서 다시 찍을 수 있게 함
function resetStatAlloc(){
  if(!draftStats) return;
  draftStats = { str: state.stats.str, agi: state.stats.agi, int: state.stats.int };
  draftStatPoints = state.statPoints || 0;
  renderCharStats();
}
// 전체 초기화: 마지막으로 '적용'되어 실제 저장된 스탯까지 포함해 지금까지 찍은 모든 포인트를 되돌림.
// draft만 바뀌므로 실제로 확정되려면 여전히 '적용'을 눌러야 함.
function resetStatAllocFull(){
  if(!draftStats) return;
  const totalPoints = (state.statPoints || 0) + (state.stats.str || 0) + (state.stats.agi || 0) + (state.stats.int || 0);
  draftStats = { str: 0, agi: 0, int: 0 };
  draftStatPoints = totalPoints;
  renderCharStats();
}
function openCharStats(){
  draftStats = { str: state.stats.str, agi: state.stats.agi, int: state.stats.int };
  draftStatPoints = state.statPoints || 0;
  renderCharStats();
  el('charStatsModal').style.display = 'flex';
}
function closeCharStats(){
  // 적용하지 않은 임시 배분은 버림
  draftStats = null;
  draftStatPoints = null;
  el('charStatsModal').style.display = 'none';
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
