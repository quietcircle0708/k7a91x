// ============================================================
// main.js — 이벤트 바인딩 + 진입점
// 모든 <script> 파일이 로드된 뒤 가장 마지막에 실행되어야 함.
// DOM 요소에 이벤트 리스너를 걸고, loadState()로 게임을 시작함.
// ============================================================

el('enhanceBtn').addEventListener('click', startEnhance);
el('sellBtn').addEventListener('click', doSell);
el('toggleCharmBtn').addEventListener('click', toggleCharm);
el('toggleBlessingBtn').addEventListener('click', toggleBlessing);
el('buyCharmBtn').addEventListener('click', (e)=> buyCharm(e.currentTarget));
el('buyBlessingBtn').addEventListener('click', (e)=> buyBlessing(e.currentTarget));
el('invTabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-tab]');
  if(!btn) return;
  switchInvTab(btn.dataset.tab);
});
el('invEquipSubTabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-tab]');
  if(!btn) return;
  switchInvTab(btn.dataset.tab);
});
// ---- 대장간 강화/수리 탭(내구도 시스템 15번 요구사항) ----
el('forgeTabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-tab]');
  if(!btn) return;
  switchForgeTab(btn.dataset.tab);
});
// ---- 수리 탭: 장비창 슬롯 클릭(요구사항 2번) — 내구도가 있는 장착 장비만 개별 수리 팝업을 엶.
// 빈 슬롯/아티팩트(데이터 속성 자체가 없음)/내구도 시스템이 없는 장비는 아무 반응 없음.
el('repairEquipPanel').addEventListener('click', (e)=>{
  const slotEl = e.target.closest('.eq-slot[data-slot]');
  if(!slotEl) return;
  const slotKey = slotEl.dataset.slot;
  const found = equippedInstanceForSlot(slotKey);
  if(!found || !hasDurabilitySystem(found.type)) return;
  openRepairIndividualPopup({ source: 'equipped', slotKey });
});
el('repairAllBtn').addEventListener('click', openRepairAllPopup);
// ---- 수리 탭: "인벤토리에서 선택" 팝업(요구사항 4~11·18~19번) ----
el('repairSelectBtn').addEventListener('click', openRepairSelectPopup);
el('closeRepairSelectBtn').addEventListener('click', closeRepairSelectPopup);
el('repairSelectList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action="select-repair-target"]');
  if(!btn) return;
  selectRepairFromInventory(btn.dataset.kind, Number(btn.dataset.id));
});
el('repairSelectPager').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  if(btn.dataset.action === 'page-prev') goPage(btn.dataset.pageTarget, -1);
  else if(btn.dataset.action === 'page-next') goPage(btn.dataset.pageTarget, 1);
});
// ---- 수리 탭: 개별 수리 팝업 ----
el('repairIndivCancelBtn').addEventListener('click', closeRepairIndividualPopup);
el('repairIndivConfirmBtn').addEventListener('click', openRepairConfirmFromIndividual);
el('repairIndivAmountInput').addEventListener('input', (e)=> setRepairIndividualAmount(e.target.value));
el('repairIndivMaxBtn').addEventListener('click', ()=> applyRepairQuickAmount('max'));
el('repairIndivTenPctBtn').addEventListener('click', ()=> applyRepairQuickAmount('10pct'));
el('repairIndivOnePctBtn').addEventListener('click', ()=> applyRepairQuickAmount('1pct'));
el('repairIndivResetBtn').addEventListener('click', ()=> applyRepairQuickAmount('reset'));
// ---- 수리 탭: 모두 수리 팝업 ----
el('repairAllCancelBtn').addEventListener('click', closeRepairAllPopup);
el('repairAllConfirmBtn').addEventListener('click', openRepairConfirmFromAll);
// ---- 수리 탭: 최종 확인 팝업(요구사항 19~21번) ----
el('repairConfirmCancelBtn').addEventListener('click', closeRepairConfirmPopup);
el('repairConfirmProceedBtn').addEventListener('click', confirmRepairProceed);
// ---- 제작소 탭 ----
el('craftTabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-tab]');
  if(!btn) return;
  switchCraftTab(btn.dataset.tab);
});
el('craftSubTabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-tab]');
  if(!btn) return;
  switchCraftTab(btn.dataset.tab);
});
['craftWeaponPager', 'craftArmorPager', 'craftSubPager', 'craftAccessoryPager'].forEach(pagerId => {
  el(pagerId).addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;
    if(btn.dataset.action === 'page-prev') goPage(btn.dataset.pageTarget, -1);
    else if(btn.dataset.action === 'page-next') goPage(btn.dataset.pageTarget, 1);
  });
});
// 제작 아이템 목록(4개 탭 패널) 공통 클릭 위임 — [제작 재료] 토글 / [제작] 버튼
['craftTabWeaponList', 'craftTabArmorList', 'craftTabSubList', 'craftTabAccessoryList'].forEach(listId => {
  el(listId).addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;
    if(btn.dataset.action === 'toggle-craft-mat-info') toggleCraftMaterialInfo(btn.dataset.category, btn.dataset.id);
    else if(btn.dataset.action === 'open-craft-popup') openCraftPopup(btn.dataset.category, btn.dataset.id);
  });
});
// ---- 제작 진행 팝업 ----
el('craftPopupCancelBtn').addEventListener('click', closeCraftPopup);
el('craftPopupSlots').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action="open-craft-material-qty"]');
  if(!btn) return;
  openCraftMaterialQty(btn.dataset.name);
});
// ---- 촉매 선택창(요청사항 4번) ----
el('craftPopupModal').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action="open-craft-catalyst"]');
  if(!btn) return;
  openCraftCatalystSelect();
});
el('closeCraftCatalystBtn').addEventListener('click', closeCraftCatalystSelect);
// ---- 제작 최종 확인 UI ----
el('craftPopupMakeBtn').addEventListener('click', openCraftConfirm);
el('craftConfirmCancelBtn').addEventListener('click', closeCraftConfirm);
el('craftConfirmProceedBtn').addEventListener('click', proceedCraftConfirm);
el('craftAnimConfirmBtn').addEventListener('click', closeCraftAnim);
// ---- 투입 개수 선택 팝업 ----
el('craftMaterialQtyCancelBtn').addEventListener('click', closeCraftMaterialQty);
el('craftMaterialQtyConfirmBtn').addEventListener('click', confirmCraftMaterialQty);
el('craftMaterialQtyUpBtn').addEventListener('click', ()=> stepCraftMaterialQty('up'));
el('craftMaterialQtyDownBtn').addEventListener('click', ()=> stepCraftMaterialQty('down'));
el('craftMaterialQtyInput').addEventListener('input', (e)=> setCraftMaterialQty(e.target.value));
// ---- 상점 탭 / 정렬 ----
el('shopTabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-tab]');
  if(!btn) return;
  switchShopTab(btn.dataset.tab);
});
el('shopEquipSubTabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-tab]');
  if(!btn) return;
  switchShopTab(btn.dataset.tab);
});
el('shopFilterBtn').addEventListener('click', toggleShopFilterMenu);
el('shopFilterMenu').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-filter]');
  if(!btn) return;
  setShopFilter(btn.dataset.filter);
});
el('shopSortDirBtn').addEventListener('click', toggleShopSortDir);
el('shopPager').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  if(btn.dataset.action === 'page-prev') goPage(btn.dataset.pageTarget, -1);
  else if(btn.dataset.action === 'page-next') goPage(btn.dataset.pageTarget, 1);
});
el('charStatsPager').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  if(btn.dataset.action === 'page-prev') goPage(btn.dataset.pageTarget, -1);
  else if(btn.dataset.action === 'page-next') goPage(btn.dataset.pageTarget, 1);
});
document.addEventListener('click', (e)=>{
  if(!shopFilterMenuOpen) return;
  if(e.target.closest('.shop-filter-wrap')) return;
  closeShopFilterMenu();
});
// 상점 품목 목록: 탭에 관계없이 data-action으로 구매/판매를 한 번에 위임 처리
// (새 탭/아이템이 추가돼도 render.js가 알맞은 data-action을 붙여주므로 여기는 수정할 필요 없음)
// 구매(buy-*) 세 종류는 즉시 구매하지 않고 개수 지정 구매 팝업(openBuyQtyModal)을 먼저 띄움 — 실제
// 구매는 팝업의 "구매" 버튼(confirmBuyQty)에서 이뤄짐.
el('shopItemsList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn || btn.disabled) return;
  const type = btn.dataset.type;
  switch(btn.dataset.action){
    case 'buy-weapon': openBuyQtyModal('buy-weapon', type); break;
    case 'buy-consumable': openBuyQtyModal('buy-consumable', type); break;
    case 'sell-consumable': sellAllFlask(type, btn); break;
    case 'buy-artifact': openBuyQtyModal('buy-artifact', type); break;
    case 'sell-misc': sellAllMisc(type, btn); break;
  }
});
el('skipToggleBtn').addEventListener('click', toggleSkip);
el('autoRebuyToggleBtn').addEventListener('click', toggleAutoRebuy);
el('openShopBtn').addEventListener('click', openShop);
el('openInventoryBtn').addEventListener('click', openInventory);
el('openDungeonBtn').addEventListener('click', openDungeonList);
el('openCharacterBtn').addEventListener('click', openCharacterMenu);
el('openCraftBtn').addEventListener('click', openCraft);
el('goInventoryBtn').addEventListener('click', openInventory);
el('quickBuySwordBtn').addEventListener('click', (e)=> buyWeapon('longsword', e.currentTarget));
el('resetLink').addEventListener('click', resetGame);
document.querySelector('.back-from-shop').addEventListener('click', closeToForge);
document.querySelector('.back-from-inv').addEventListener('click', closeToForge);
document.querySelector('.back-from-craft').addEventListener('click', closeToForge);
document.querySelector('.back-from-character').addEventListener('click', closeToForge);
document.querySelector('.back-from-dlist').addEventListener('click', closeToForge);
el('exitHuntBtn').addEventListener('click', ()=> guardedNav('dungeonlist'));
el('huntTopToggleBtn').addEventListener('click', toggleHuntTopUi);
el('treasureChest').addEventListener('click', clickTreasureChest);
el('monsterRow').addEventListener('click', (e)=>{
  const slot = e.target.closest('.monster-slot[data-instance-id]');
  if(!slot) return;
  selectTarget(Number(slot.dataset.instanceId));
});
el('leaveConfirmStopBtn').addEventListener('click', confirmLeaveBattle);
el('leaveConfirmContinueBtn').addEventListener('click', cancelLeaveBattle);
el('openStatsBtn').addEventListener('click', openCharStats);
el('closeStatsBtn').addEventListener('click', closeCharStats);
el('openBlacksmithBtn').addEventListener('click', openForgeSelect);
el('closeForgeSelectBtn').addEventListener('click', closeForgeSelect);
el('forgeSelectList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action="select-forge-target"]');
  if(!btn) return;
  selectForgeTarget(Number(btn.dataset.id));
});
el('forgeSelectPager').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  if(btn.dataset.action === 'page-prev') goPage(btn.dataset.pageTarget, -1);
  else if(btn.dataset.action === 'page-next') goPage(btn.dataset.pageTarget, 1);
});
el('openPatchNoteBtn').addEventListener('click', openPatchNote);
el('closePatchNoteBtn').addEventListener('click', closePatchNote);
el('patchNotePager').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  if(btn.dataset.action === 'page-prev') goPage(btn.dataset.pageTarget, -1);
  else if(btn.dataset.action === 'page-next') goPage(btn.dataset.pageTarget, 1);
});
el('openSettingsBtn').addEventListener('click', openSettings);
el('closeSettingsBtn').addEventListener('click', closeSettings);
el('settingsCategoryList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-cat]');
  if(!btn) return;
  switchSettingsCategory(btn.dataset.cat);
});
el('settingsBody').addEventListener('click', (e)=>{
  const toggleBtn = e.target.closest('button[data-setting]');
  if(toggleBtn){ toggleSetting(toggleBtn.dataset.setting); return; }
  const stepperBtn = e.target.closest('button[data-stepper]');
  if(stepperBtn && !stepperBtn.disabled){ adjustSetting(stepperBtn.dataset.stepper, stepperBtn.dataset.dir); return; }
  const radioBtn = e.target.closest('button[data-radio]');
  if(radioBtn && !radioBtn.disabled){ selectSettingRadio(radioBtn.dataset.radio, radioBtn.dataset.value); }
});
el('charStatsBody').addEventListener('click', (e)=>{
  const statBtn = e.target.closest('button[data-stat]');
  if(statBtn && !statBtn.disabled){
    const statKey = statBtn.dataset.stat;
    const statAction = statBtn.dataset.statAction;
    if(statAction === 'add-bulk') allocateStatBulk(statKey);
    else if(statAction === 'sub') deallocateStat(statKey);
    else allocateStat(statKey);
    return;
  }
  const actionBtn = e.target.closest('button[data-action]');
  if(!actionBtn || actionBtn.disabled) return;
  if(actionBtn.dataset.action === 'apply-stats') applyStatAlloc();
  else if(actionBtn.dataset.action === 'reset-stats') resetStatAlloc();
  else if(actionBtn.dataset.action === 'reset-stats-full') resetStatAllocFull();
});
// ---- 캐릭터 메뉴 ----
el('charTabsRow').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-char-tab]');
  if(!btn) return;
  switchCharTab(btn.dataset.charTab);
});
// 캐릭터 메뉴(정보 탭 + 스킬 탭)와 던전 우측 카드(같은 [캐릭터 정보]/[스킬] 콘텐츠를 재사용하는 화면)
// 양쪽 안에서 일어나는 클릭을 전부 이 한 함수로 위임 처리함(둘 다 페이지 전체가 매번 다시 그려지는
// 구조라 charStatsBody/charStatsPager처럼 따로 나눌 필요가 없고, 두 화면이 완전히 동일한 콘텐츠/버튼
// 구조를 재사용하므로 핸들러도 공유함 — 요구사항: "기존 캐릭터 메뉴의 기능을 그대로 재사용").
// - 캐릭터 정보 탭: 스탯 배분 버튼 + 페이지 이동
// - 스킬 탭: 하위 탭 전환 + 스킬 습득 + 스킬 퀵슬롯(배정/사용/제거) + 플라스크 퀵슬롯(기존 로직 그대로,
//   skillTabFlaskRow가 quickSlotRow와 동일한 data-action 이름을 그대로 씀) + 퀵슬롯 초기화 + 페이지 이동
function handleCharPanelClick(e){
  const skillCatBtn = e.target.closest('button[data-skill-cat]');
  if(skillCatBtn){ switchSkillCategory(skillCatBtn.dataset.skillCat); return; }

  const skillKindBtn = e.target.closest('button[data-skill-kind]');
  if(skillKindBtn){ switchSkillKind(skillKindBtn.dataset.skillKind); return; }

  const learnBtn = e.target.closest('button[data-learn-skill]');
  if(learnBtn){ openSkillLearnConfirm(learnBtn.dataset.learnSkill); return; }

  const skillUseBtn = e.target.closest('button[data-action="use-skill"]');
  const skillAssignBtn = e.target.closest('button[data-action="assign-skill"]');
  const skillClearBtn = e.target.closest('button[data-action="clear-skill"]');
  if(skillUseBtn || skillAssignBtn || skillClearBtn){
    handleSkillQuickSlotClick(skillUseBtn, skillAssignBtn, skillClearBtn);
    return;
  }

  // 스킬 탭의 플라스크 퀵슬롯(skillTabFlaskRow) — 사냥 화면 퀵슬롯과 완전히 동일한 로직 재사용
  const flaskUseBtn = e.target.closest('button[data-action="use"]');
  const flaskAssignBtn = e.target.closest('button[data-action="assign"]');
  const flaskClearBtn = e.target.closest('button[data-action="clear"]');
  if(flaskUseBtn || flaskAssignBtn || flaskClearBtn){
    handleFlaskQuickSlotClick(flaskUseBtn, flaskAssignBtn, flaskClearBtn);
    return;
  }

  const statBtn = e.target.closest('button[data-stat]');
  if(statBtn && !statBtn.disabled){
    const statKey = statBtn.dataset.stat;
    const statAction = statBtn.dataset.statAction;
    if(statAction === 'add-bulk') allocateStatBulk(statKey);
    else if(statAction === 'sub') deallocateStat(statKey);
    else allocateStat(statKey);
    return;
  }
  const actionBtn = e.target.closest('button[data-action]');
  if(!actionBtn || actionBtn.disabled) return;
  if(actionBtn.dataset.action === 'apply-stats') applyStatAlloc();
  else if(actionBtn.dataset.action === 'reset-stats') resetStatAlloc();
  else if(actionBtn.dataset.action === 'reset-stats-full') resetStatAllocFull();
  else if(actionBtn.dataset.action === 'reset-skill-quickslots') resetSkillQuickSlots();
  else if(actionBtn.dataset.action === 'reset-skills') openSkillResetConfirm();
  else if(actionBtn.dataset.action === 'page-prev') goPage(actionBtn.dataset.pageTarget, -1);
  else if(actionBtn.dataset.action === 'page-next') goPage(actionBtn.dataset.pageTarget, 1);
}
el('charTabPanels').addEventListener('click', handleCharPanelClick);
el('huntCharTabPanels').addEventListener('click', handleCharPanelClick);
el('huntCharTabsRow').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-hunt-char-tab]');
  if(!btn) return;
  switchHuntCharTab(btn.dataset.huntCharTab);
});
el('respawnBtn').addEventListener('click', respawnAtVillage);
el('sellConfirmYesBtn').addEventListener('click', confirmSell);
el('sellConfirmNoBtn').addEventListener('click', cancelSell);
el('buyQtyCancelBtn').addEventListener('click', closeBuyQtyModal);
el('buyQtyConfirmBtn').addEventListener('click', confirmBuyQty);
el('buyQtyUpBtn').addEventListener('click', ()=> adjustBuyQty('up'));
el('buyQtyDownBtn').addEventListener('click', ()=> adjustBuyQty('down'));
el('buyQtyInput').addEventListener('input', (e)=> setBuyQty(e.target.value));
el('skillLearnCancelBtn').addEventListener('click', cancelSkillLearn);
el('skillLearnConfirmBtn').addEventListener('click', confirmSkillLearn);
el('traceRestoreCancelBtn').addEventListener('click', closeTraceRestoreConfirm);
el('traceRestoreConfirmBtn').addEventListener('click', confirmTraceRestore);
el('traceRestoreResultOkBtn').addEventListener('click', closeTraceRestoreResult);
el('traceSlotFullOkBtn').addEventListener('click', closeTraceSlotFullModal);
el('skillResetCancelBtn').addEventListener('click', cancelSkillReset);
el('skillResetConfirmBtn').addEventListener('click', confirmSkillReset);
el('krStopBtn').addEventListener('click', returnToVillage);
el('krContinueBtn').addEventListener('click', advanceStage);
el('krRetryBtn').addEventListener('click', retryDungeon);
el('dungeonListPager').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  if(btn.dataset.action === 'page-prev') goPage(btn.dataset.pageTarget, -1);
  else if(btn.dataset.action === 'page-next') goPage(btn.dataset.pageTarget, 1);
});
el('dungeonList').addEventListener('click', (e)=>{
  // 던전 카드 내부의 "획득 가능 아이템 안내" 페이지 전환 버튼(다음/이전) — 입장하기 버튼과 같은
  // 컨테이너 안에 있어서 같은 리스너에서 data-action으로 구분해 처리함.
  const pageBtn = e.target.closest('button[data-action]');
  if(pageBtn){
    if(pageBtn.dataset.action === 'page-prev') goPage(pageBtn.dataset.pageTarget, -1);
    else if(pageBtn.dataset.action === 'page-next') goPage(pageBtn.dataset.pageTarget, 1);
    return;
  }
  const btn = e.target.closest('button[data-id]');
  if(!btn || btn.disabled) return;
  enterDungeon(btn.dataset.id);
});
el('invWeaponPager').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  if(btn.dataset.action === 'page-prev') goPage(btn.dataset.pageTarget, -1);
  else if(btn.dataset.action === 'page-next') goPage(btn.dataset.pageTarget, 1);
});
el('invArmorPager').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  if(btn.dataset.action === 'page-prev') goPage(btn.dataset.pageTarget, -1);
  else if(btn.dataset.action === 'page-next') goPage(btn.dataset.pageTarget, 1);
});
el('invAccessoryPager').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  if(btn.dataset.action === 'page-prev') goPage(btn.dataset.pageTarget, -1);
  else if(btn.dataset.action === 'page-next') goPage(btn.dataset.pageTarget, 1);
});
el('invSubPager').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  if(btn.dataset.action === 'page-prev') goPage(btn.dataset.pageTarget, -1);
  else if(btn.dataset.action === 'page-next') goPage(btn.dataset.pageTarget, 1);
});
el('inventoryList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  const id = Number(btn.dataset.id);
  if(btn.dataset.action === 'equip') equipItem(id);
  else if(btn.dataset.action === 'sell') sellItem(id);
});
el('armorInventoryList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn || btn.disabled) return;
  const id = Number(btn.dataset.id);
  if(btn.dataset.action === 'wear-armor') equipArmorPiece(id);
  else if(btn.dataset.action === 'unwear-armor') unequipArmorPiece(id);
  else if(btn.dataset.action === 'equip') equipItem(id); // 강화 선택(대장간 화면에 표시) — 무기 인벤토리와 동일한 함수 재사용
  else if(btn.dataset.action === 'sell-armor') sellArmorItem(id);
});
el('accessoryInventoryList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn || btn.disabled) return;
  const id = Number(btn.dataset.id);
  if(btn.dataset.action === 'wear-accessory') equipAccessoryPiece(id);
  else if(btn.dataset.action === 'unwear-accessory') unequipAccessoryPiece(id);
  else if(btn.dataset.action === 'equip') equipItem(id);
  else if(btn.dataset.action === 'sell-accessory') sellAccessoryItem(id);
});
el('subInventoryList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn || btn.disabled) return;
  const id = Number(btn.dataset.id);
  // 보조 아이템은 "강화 선택" 버튼 자체가 없음(문서 2번 규칙) — wear-sub/unwear-sub/sell-sub만 처리.
  if(btn.dataset.action === 'wear-sub') equipSubPiece(id);
  else if(btn.dataset.action === 'unwear-sub') unequipSubPiece(id);
  else if(btn.dataset.action === 'sell-sub') sellSubItem(id);
});
el('artifactList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn || btn.disabled) return;
  const id = btn.dataset.artifactId;
  if(btn.dataset.action === 'equip-artifact') equipArtifact(id);
  else if(btn.dataset.action === 'unequip-artifact') unequipArtifact(id);
});
el('consumableList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  if(btn.dataset.action === 'use-flask') useFlask(btn.dataset.id);
  else if(btn.dataset.action === 'use-trace') useTraceItem(Number(btn.dataset.id));
});
el('quickSlotRow').addEventListener('click', (e)=>{
  const useBtn = e.target.closest('button[data-action="use"]');
  const assignBtn = e.target.closest('button[data-action="assign"]');
  const clearBtn = e.target.closest('button[data-action="clear"]');
  handleFlaskQuickSlotClick(useBtn, assignBtn, clearBtn);
});
// 플라스크 퀵슬롯 사용/배정/제거 — 사냥 화면(quickSlotRow)과 캐릭터 메뉴 스킬 탭(skillTabFlaskRow) 두
// 곳에서 동일하게 재사용(요구사항: "오른쪽: 기존 플라스크 퀵슬롯 그대로 사용").
function handleFlaskQuickSlotClick(useBtn, assignBtn, clearBtn){
  if(useBtn && !useBtn.disabled){
    useFlask(useBtn.dataset.item);
    return;
  }
  if(assignBtn){
    openQuickSlotPicker(Number(assignBtn.dataset.slot));
    return;
  }
  if(clearBtn){
    state.quickSlots[Number(clearBtn.dataset.slot)] = null;
    renderQuickSlots();
    saveState();
  }
}
// 스킬 퀵슬롯 사용/배정/제거 — 캐릭터 메뉴 스킬 탭(skillTabQuickSlotRow)과 던전 사냥 화면
// (huntSkillQuickSlotRow) 두 곳에서 동일하게 재사용(요구사항: "던전과 스킬 탭은 동일한 데이터를 공유").
// 사냥 화면 쪽 마크업에는 제거(×) 버튼이 없어 clearBtn 분기에 도달할 일이 없을 뿐, 나머지는 동일함.
function handleSkillQuickSlotClick(useBtn, assignBtn, clearBtn){
  if(useBtn && !useBtn.disabled){
    useSkill(useBtn.dataset.item);
    return;
  }
  if(assignBtn){
    openSkillQuickSlotPicker(Number(assignBtn.dataset.slot));
    return;
  }
  if(clearBtn){
    state.skillQuickSlots[Number(clearBtn.dataset.slot)] = null;
    renderSkillQuickSlots();
    saveState();
  }
}
el('huntSkillQuickSlotRow').addEventListener('click', (e)=>{
  const useBtn = e.target.closest('button[data-action="use-skill"]');
  const assignBtn = e.target.closest('button[data-action="assign-skill"]');
  const clearBtn = e.target.closest('button[data-action="clear-skill"]');
  handleSkillQuickSlotClick(useBtn, assignBtn, clearBtn);
});
el('quickSlotPickerList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-item]');
  if(!btn || pendingQuickSlotIndex === null) return;
  if(pendingQuickSlotKind === 'skill'){
    state.skillQuickSlots[pendingQuickSlotIndex] = btn.dataset.item;
    closeQuickSlotPicker();
    renderSkillQuickSlots();
    saveState();
    return;
  }
  state.quickSlots[pendingQuickSlotIndex] = btn.dataset.item;
  closeQuickSlotPicker();
  renderQuickSlots();
  saveState();
});
el('closeQuickSlotPickerBtn').addEventListener('click', closeQuickSlotPicker);

// 플라스크 쿨타임 표시(2.0→1.9→…→0.1)를 위한 실시간 갱신. 퀵슬롯이 없는 화면에서는
// updateQuickSlotCooldowns() 내부에서 el('quickSlotRow')가 조용히 무시하므로 항상 켜둬도 무방함.
setInterval(updateQuickSlotCooldowns, 100);
setInterval(updateSkillQuickSlotCooldowns, 100);
// 던전 전투화면 버프 지속시간 UI(요구사항) 실시간 갱신 — renderHuntBuffUi 내부에서 el('huntBuffUi')가
// 없으면(던전 화면이 아닐 때) 조용히 무시하므로 위 두 타이머와 동일하게 항상 켜둬도 무방함.
setInterval(renderHuntBuffUi, 100);

// ---- 툴팁 위치 자동 보정 ----
// 모든 툴팁(class="tooltip")은 CSS(:hover)만으로 위치가 고정되어 있어서, 화면 위/아래/좌우 경계에
// 가까운 요소(예: 상단 망자의 저주 뱃지, 우측 끝 아티팩트 슬롯 등)에서는 툴팁이 화면 밖으로
// 잘려나가는 문제가 있었음. 특정 클래스에 하드코딩하지 않고 "호버 대상의 직계 자식으로 .tooltip이
// 있는 가장 가까운 조상"을 찾는 범용 방식이라, 향후 새로운 툴팁 UI가 추가돼도 그대로 자동 적용됨.
// 기본 동작은 항상 기존 CSS 위치를 그대로 쓰고(요구사항 1), 실제로 화면을 벗어날 때만 인라인
// style(position:fixed)로 좌표를 덮어써 보정한다 — 툴팁의 내용·크기·기존 디자인은 전혀 건드리지 않음
// (요구사항 5·6). 마우스가 벗어나면 다음 호버 때 다시 기본 위치부터 재측정하므로 상태가 남지 않는다.
const TOOLTIP_EDGE_MARGIN = 6; // 화면 경계에서 확보할 최소 여백(px)

function findTooltipHost(target){
  let node = target;
  while(node && node.nodeType === 1 && node !== document.body){
    const tip = node.querySelector(':scope > .tooltip');
    if(tip) return { host: node, tip };
    node = node.parentElement;
  }
  return null;
}
function resetTooltipPosition(tip){
  tip.style.position = '';
  tip.style.top = '';
  tip.style.left = '';
  tip.style.right = '';
  tip.style.bottom = '';
  tip.style.transform = '';
}
function adjustTooltipPosition(host, tip){
  // 인라인 오버라이드를 전부 지우고 기존 CSS 기본 위치부터 다시 측정
  resetTooltipPosition(tip);
  const rect = tip.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  let top = rect.top;
  let left = rect.left;

  // 위쪽 경계를 넘어가면 커서(호버 대상) 아래쪽으로 출력 전환
  if(top < TOOLTIP_EDGE_MARGIN){
    const hostRect = host.getBoundingClientRect();
    top = hostRect.bottom + 6;
  }
  // 아래쪽 경계를 넘어가면 프레임 안에 들어오도록 세로 위치 보정
  if(top + rect.height > vh - TOOLTIP_EDGE_MARGIN){
    top = Math.max(TOOLTIP_EDGE_MARGIN, vh - TOOLTIP_EDGE_MARGIN - rect.height);
  }
  // 좌우도 동일하게 프레임 밖으로 나가지 않도록 보정
  if(left < TOOLTIP_EDGE_MARGIN){
    left = TOOLTIP_EDGE_MARGIN;
  } else if(left + rect.width > vw - TOOLTIP_EDGE_MARGIN){
    left = Math.max(TOOLTIP_EDGE_MARGIN, vw - TOOLTIP_EDGE_MARGIN - rect.width);
  }

  // 항상 position:fixed로 전환해서 화면 좌표에 그대로 고정한다 — 부모 요소의 overflow(예: 스킬 트리의
  // 가로 스크롤 영역, 카드 테두리 등)에 더 이상 잘리지 않고 그 위로 떠서 출력됨(요구사항: 툴팁이 UI 경계선과
  // 겹쳐도 잘리지 않고 그 위에 그대로 표시). getBoundingClientRect()가 반환하는 좌표는 조상의 overflow
  // 클리핑과 무관하게 실제 레이아웃 위치를 정확히 담고 있으므로, 그 값을 그대로 fixed 좌표로 다시 꽂아주면
  // 화면 경계를 넘지 않는 한 원래 CSS가 의도한 자리에 그대로 보이면서(경계를 넘는 경우에만 위에서 보정된
  // 좌표), 어떤 조상의 overflow에도 클리핑되지 않는다.
  tip.style.position = 'fixed';
  tip.style.transform = 'none'; // left:50%+translateX(-50%) 등 CSS 좌우정렬용 transform과 겹치면 좌표가 이중으로 밀리므로 무효화
  tip.style.top = top + 'px';
  tip.style.bottom = 'auto'; // CSS 클래스가 지정한 bottom(예: .equip-slot .tooltip의 bottom:135%, .curse-badge .tooltip의 bottom:130%)이
  tip.style.left = left + 'px'; // 빈 문자열로는 지워지지 않고 계속 살아있어 top과 충돌해 위치가 어긋나던 버그 수정 — 명시적으로 auto를 줘야 완전히 무효화됨
  tip.style.right = 'auto'; // 마찬가지로 .curse-badge .tooltip의 right:0도 auto로 명시 무효화(안 그러면 left와 충돌해 화면 밖으로 밀려나 완전히 안 보이게 됨)
}
let activeTooltipTip = null;
// 툴팁 안에 클릭 가능한 용어(.glossary-term)가 있을 때만 쓰는 "닫힘 유예" 타이머. host 박스와
// tooltip 박스 사이엔 CSS상 작은 시각적 간격(예: bottom:130%)이 있어서, 마우스가 host에서 tooltip
// 쪽으로 이동하는 도중 그 간격을 지나는 짧은 순간 host도 tooltip도 아닌 지점을 지나며 mouseout이
// 먼저 발생할 수 있음 — 이 타이머로 실제로 완전히 벗어난 경우에만 닫히도록 유예를 둠(요구사항 4번).
let glossaryTooltipHideTimer = null;
document.addEventListener('mouseover', (e) => {
  const found = findTooltipHost(e.target);
  if(!found) return;
  activeTooltipTip = found.tip;
  adjustTooltipPosition(found.host, found.tip);
  // 요구사항 2~4번: 툴팁 안에 .glossary-term(용어)이 있으면, 일반 .tooltip의 pointer-events:none
  // 때문에 마우스가 host를 벗어나 tooltip 쪽으로 이동하는 순간 host:hover가 풀려 CSS로 사라져버리는
  // 문제를 막기 위해 "이 툴팁 하나에 한해서만" pointer-events를 허용하고 표시 상태를 JS로 직접
  // 고정한다. .glossary-term이 없는 일반 툴팁은 이 분기를 타지 않으므로 기존 동작 그대로 유지됨
  // (요구사항: pointer-events를 전체 .tooltip에 일괄 auto로 바꾸지 않음).
  if(found.tip.querySelector('.glossary-term')){
    clearTimeout(glossaryTooltipHideTimer);
    found.tip.style.pointerEvents = 'auto';
    found.tip.style.visibility = 'visible';
    found.tip.style.opacity = '1';
  }
});
document.addEventListener('mouseout', (e) => {
  const found = findTooltipHost(e.target);
  if(!found) return;
  if(e.relatedTarget && found.host.contains(e.relatedTarget)) return; // 여전히 같은 호버 대상 내부(tooltip 포함, DOM상 host의 자손이므로)
  resetTooltipPosition(found.tip);
  if(found.tip.style.pointerEvents === 'auto'){
    const tip = found.tip;
    clearTimeout(glossaryTooltipHideTimer);
    glossaryTooltipHideTimer = setTimeout(() => {
      tip.style.pointerEvents = '';
      tip.style.visibility = '';
      tip.style.opacity = '';
    }, 200); // host→gap→tooltip 이동 중 발생하는 순간적 mouseout을 흡수하기 위한 짧은 유예(ms)
  }
  if(activeTooltipTip === found.tip) activeTooltipTip = null;
});

// ---- 용어사전 팝업 ----
// 스킬 설명/고유 옵션 텍스트 안의 {term:id}단어{/term}가 resolveGlossaryTermsHtml(formulas.js)에 의해
// class="glossary-term" span으로 바뀌는데, 그 span을 클릭하면 이름+설명을 보여주는 작은 팝업(요구사항:
// "해당 단어를 클릭하여 설명을 확인"). 위의 hover 전용 .tooltip 체계와는 별개의 클릭 전용 UI라 여기서
// 새로 추가함 — 기존 hover 툴팁의 표시/위치조정 로직은 전혀 건드리지 않음. 팝업 엘리먼트는 최초 클릭
// 시 1회만 body에 추가되고 이후 내용만 갈아끼워 재사용됨.
let glossaryPopupEl = null;
function ensureGlossaryPopup(){
  if(glossaryPopupEl) return glossaryPopupEl;
  glossaryPopupEl = document.createElement('div');
  glossaryPopupEl.className = 'glossary-popup';
  document.body.appendChild(glossaryPopupEl);
  return glossaryPopupEl;
}
function showGlossaryPopup(termId, anchorRect){
  const g = glossaryEntry(termId);
  if(!g) return; // 용어사전에 등록 안 된 id면 아무것도 하지 않음(원문 태그는 이미 resolveGlossaryTermsHtml 단계에서 평문으로 정리됨)
  const popup = ensureGlossaryPopup();
  popup.innerHTML = `<div style="color:${g.color}; font-weight:700; margin-bottom:4px;">${g.name}</div><div>${g.desc}</div>`;
  popup.style.display = 'block';
  popup.style.position = 'fixed';
  popup.style.transform = 'none';
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const rect = popup.getBoundingClientRect();
  let top = anchorRect.bottom + 6;
  let left = anchorRect.left;
  if(top + rect.height > vh - TOOLTIP_EDGE_MARGIN) top = Math.max(TOOLTIP_EDGE_MARGIN, anchorRect.top - rect.height - 6);
  if(left + rect.width > vw - TOOLTIP_EDGE_MARGIN) left = Math.max(TOOLTIP_EDGE_MARGIN, vw - TOOLTIP_EDGE_MARGIN - rect.width);
  if(left < TOOLTIP_EDGE_MARGIN) left = TOOLTIP_EDGE_MARGIN;
  popup.style.top = top + 'px';
  popup.style.left = left + 'px';
}
function hideGlossaryPopup(){
  if(glossaryPopupEl) glossaryPopupEl.style.display = 'none';
}
// 캡처 단계(capture:true)로 등록 — 버블 단계로 등록하면 이 리스너가 실행되기 "전에" 이미
// #charTabPanels 등 하위 요소의 버블 리스너(예: 스킬 습득 확인창을 여는 data-learn-skill 버튼 클릭
// 처리)가 먼저 실행되어 버려서, stopPropagation()을 호출해도 이미 실행된 하위 핸들러를 막을 수 없는
// 문제가 있었음(스킬 아이콘 버튼 안의 용어를 클릭하면 팝업 대신 스킬 습득 확인창이 열리는 버그).
// 캡처 단계는 document→...→target 방향으로 버블보다 먼저 실행되므로, 여기서 먼저 가로채
// stopPropagation()하면 그 뒤의 모든 버블 리스너 실행 자체를 막을 수 있음.
document.addEventListener('click', (e) => {
  const term = e.target.closest('.glossary-term');
  if(term){
    e.stopPropagation();
    showGlossaryPopup(term.dataset.term, term.getBoundingClientRect());
    return;
  }
  if(glossaryPopupEl && glossaryPopupEl.style.display !== 'none' && !glossaryPopupEl.contains(e.target)) hideGlossaryPopup();
}, true);

// ---- 던전 화면 좌우 패널 크기 자동 연동(레이아웃 개편 요구사항, 173/174/176 수정요청으로 관찰 대상
// 및 반영 위치를 계속 정확한 값으로 좁혀옴) ----
// "던전 화면"은 huntCard 카드 전체(#huntCard)를 가리킴 — combat-arena(플레이어/몬스터 배치용 내부
// 그리드, 약 300×220px)도 아니고 combat-arena+스킬퀵슬롯을 합친 영역도 아니라, 사용자가 실제로 보는
// 카드 그 자체임(176 수정요청 핵심 지적사항: "패널 안에 UI를 끼워넣는 구조가 아니라 같은 규격의 새
// 패널이 오른쪽에 통째로 추가되는 구조"). huntCard의 실제 렌더링 크기를 CSS 커스텀 속성으로 흘려보내,
// 오른쪽 패널(.hunt-side-panel, huntTopSection)이 항상 그 값을 그대로 따라가도록 함 — 하드코딩된 px
// 값이 전혀 없어서, huntCard의 크기가 나중에 바뀌어도 이 옵저버가 실측값을 계속 갱신하므로 패널 CSS를
// 별도로 다시 손댈 필요가 없음.
// 커스텀 속성은 .wrap(엘리먼트) 위에 심음 — huntCard(하위 요소)에 심으면 그 조상인 .wrap이 값을 읽을
// 수 없어서(CSS 커스텀 속성은 아래로만 상속됨) .wrap.hunt-panel-open의 width 계산식이 항상 기본값
// (480px)으로만 동작하는 버그가 있었음(174 수정요청). .wrap에 심어두면 .wrap 자신과 그 하위의
// #huntViewLayout/.hunt-side-panel 전부가 자연스럽게 상속받아 쓸 수 있음. huntView가 display:none이라
// huntCard에 레이아웃 박스가 없는 동안에는 관찰 자체가 아무 값도 보고하지 않다가, 던전에 실제로
// 진입해 보이게 되는 순간 자동으로 최초 실측값을 흘려보냄 — 별도의 진입 시점 재호출이 필요 없음.
// huntCard는 오른쪽 패널을 담지 않는 별도 요소라서(관찰 대상 자신이 side panel을 포함하지 않음),
// 패널이 열려 커지더라도 관찰값 자체가 그 영향을 받아 되먹임(순환 의존)이 생기지 않음.
if(typeof ResizeObserver !== 'undefined'){
  const huntCardEl = el('huntCard');
  const wrapEl = document.querySelector('.wrap');
  if(huntCardEl && wrapEl){
    const syncHuntCardSize = () => {
      const rect = huntCardEl.getBoundingClientRect();
      if(rect.width > 0) wrapEl.style.setProperty('--hunt-card-width', rect.width + 'px');
      if(rect.height > 0) wrapEl.style.setProperty('--hunt-card-height', rect.height + 'px');
    };
    new ResizeObserver(syncHuntCardSize).observe(huntCardEl);
    syncHuntCardSize(); // 초기 1회 즉시 반영(옵저버 콜백은 다음 프레임부터 발동하므로)
  }
}

loadState();
initPatchNoteSystem();
