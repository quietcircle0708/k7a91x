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
  if(currentView === 'character' && name !== 'character'){
    // 캐릭터 메뉴를 벗어날 때는 캐릭터 정보 모달을 닫을 때(closeCharStats)와 동일하게
    // 적용하지 않은 임시 스탯 배분을 버림(둘이 draftStats를 공유하는 데이터이므로 규칙도 동일해야 함).
    draftStats = null;
    draftStatPoints = null;
    statAllocActive = { str: false, agi: false, int: false };
  }
  el('forgeView').style.display = name === 'forge' ? 'block' : 'none';
  el('shopView').style.display = name === 'shop' ? 'block' : 'none';
  el('inventoryView').style.display = name === 'inventory' ? 'block' : 'none';
  el('dungeonListView').style.display = name === 'dungeonlist' ? 'block' : 'none';
  el('characterView').style.display = name === 'character' ? 'block' : 'none';
  el('huntView').style.display = name === 'hunt' ? 'block' : 'none';
  currentView = name;
  if(name === 'dungeonlist') renderDungeonList();
  if(name === 'hunt') renderHunt();
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
  invAccessory: renderAccessoryInventoryList,
  forgeSelect: renderForgeSelectList,
  shopWeapon: renderShopTab, shopArmor: renderShopTab, shopAccessory: renderShopTab, shopConsumable: renderShopTab, shopArtifact: renderShopTab,
  dungeonList: renderDungeonList,
  charStats: renderCharStats,
  charMenuInfo: renderCharacterMenu,
  skillPage: renderCharacterMenu,
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
// 플라스크(state.quickSlots)와 스킬(state.skillQuickSlots) 두 종류의 퀵슬롯이 같은 선택 모달을 공유함 —
// pendingQuickSlotKind로 지금 어느 배열에 등록할지 구분(둘 다 배열 인덱스=슬롯 번호라는 점은 동일).
let pendingQuickSlotIndex = null;
let pendingQuickSlotKind = 'flask'; // 'flask' | 'skill'
function openQuickSlotPicker(idx){
  pendingQuickSlotKind = 'flask';
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

// ---- 스킬 탭(캐릭터 메뉴 하위) ----
// 하위 탭 전환은 SKILL_CATEGORIES(data.js)를 그대로 따르므로, 새 분류가 추가돼도 이 함수는 수정할 필요 없음.
let activeSkillCategory = SKILL_CATEGORIES.length > 0 ? SKILL_CATEGORIES[0].id : null;
function switchSkillCategory(catId){
  activeSkillCategory = catId;
  renderCharacterMenu();
}
// 스킬 습득: 포인트를 소비하고 해당 분류의 습득 목록(learnedSkills/learnedAwakeningSkills)에 추가함.
// 에픽/유니크는 아직 해금 방식이 구현되지 않아(비급/깨달음 소비 예정) canLearnSkill이 항상 false를 반환하므로
// 이 함수까지 도달해도 아무 일도 일어나지 않음 — 실제 해금 로직이 추가되면 이 함수만 손보면 됨.
// 실제 데이터 변경(포인트 차감+습득)은 이 함수만 담당하고, 화면에서는 아래 스킬 습득 확인 모달을 거친 뒤에만
// 호출됨(확인을 누르기 전까지는 데이터가 바뀌지 않아야 하므로).
function learnSkill(id){
  if(!canLearnSkill(id)) return;
  const s = SKILLS[id];
  const cost = s.cost || 1;
  if(s.category === 'awakening'){
    state.awakeningPoints -= cost;
    state.learnedAwakeningSkills.push(id);
  } else {
    state.skillPoints -= cost;
    state.learnedSkills.push(id);
  }
  renderCharacterMenu();
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

// ---- 스킬 초기화 확인 모달 ----
// 습득에 사용한 스킬 포인트 총합을 계산해 확인창에 보여주고, 확인 시 각 분류가 쓰던 풀(공용·특화는
// skillPoints, 기연은 awakeningPoints — 기존 포인트 구조를 그대로 유지하고 새 습득 조건은 만들지 않음)에
// 각각 정확히 되돌려줌. 확인창의 "현재 보유 SP"/"초기화 시 획득 SP"는 두 풀을 합산한 값으로 표시함.
function learnedSkillCost(id){
  const s = SKILLS[id];
  return (s && s.cost) || 1;
}
function totalUnusedSkillPoints(){
  return (state.skillPoints || 0) + (state.awakeningPoints || 0);
}
function totalSpentSkillPoints(){
  const normal = (state.learnedSkills || []).reduce((sum, id) => sum + learnedSkillCost(id), 0);
  const awaken = (state.learnedAwakeningSkills || []).reduce((sum, id) => sum + learnedSkillCost(id), 0);
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
  const normalRefund = (state.learnedSkills || []).reduce((sum, id) => sum + learnedSkillCost(id), 0);
  const awakenRefund = (state.learnedAwakeningSkills || []).reduce((sum, id) => sum + learnedSkillCost(id), 0);
  state.skillPoints = (state.skillPoints || 0) + normalRefund;
  state.awakeningPoints = (state.awakeningPoints || 0) + awakenRefund;
  state.learnedSkills = [];
  state.learnedAwakeningSkills = [];
  resetSkillQuickSlots(); // 습득 스킬이 사라지므로 등록된 스킬 퀵슬롯도 전부 초기화(내부에서 렌더+저장까지 처리)
  renderCharacterMenu();
  saveState();
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

