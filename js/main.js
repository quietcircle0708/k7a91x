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
el('goInventoryBtn').addEventListener('click', openInventory);
el('quickBuySwordBtn').addEventListener('click', (e)=> buyWeapon('longsword', e.currentTarget));
el('resetLink').addEventListener('click', resetGame);
document.querySelector('.back-from-shop').addEventListener('click', closeToForge);
document.querySelector('.back-from-inv').addEventListener('click', closeToForge);
document.querySelector('.back-from-character').addEventListener('click', closeToForge);
document.querySelector('.back-from-dlist').addEventListener('click', closeToForge);
el('exitHuntBtn').addEventListener('click', ()=> guardedNav('dungeonlist'));
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
  if(stepperBtn && !stepperBtn.disabled){ adjustSetting(stepperBtn.dataset.stepper, stepperBtn.dataset.dir); }
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
// 캐릭터 메뉴 안(정보 탭 + 스킬 탭)에서 일어나는 클릭을 전부 한 컨테이너에서 위임 처리함(둘 다 페이지
// 전체가 매번 다시 그려지는 구조라 charStatsBody/charStatsPager처럼 따로 나눌 필요가 없음).
// - 캐릭터 정보 탭: 스탯 배분 버튼 + 페이지 이동
// - 스킬 탭: 하위 탭 전환 + 스킬 습득 + 스킬 퀵슬롯(배정/사용/제거) + 플라스크 퀵슬롯(기존 로직 그대로,
//   skillTabFlaskRow가 quickSlotRow와 동일한 data-action 이름을 그대로 씀) + 퀵슬롯 초기화 + 페이지 이동
el('charTabPanels').addEventListener('click', (e)=>{
  const skillCatBtn = e.target.closest('button[data-skill-cat]');
  if(skillCatBtn){ switchSkillCategory(skillCatBtn.dataset.skillCat); return; }

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
el('skillResetCancelBtn').addEventListener('click', cancelSkillReset);
el('skillResetConfirmBtn').addEventListener('click', confirmSkillReset);
el('krStopBtn').addEventListener('click', returnToVillage);
el('krContinueBtn').addEventListener('click', advanceStage);
el('dungeonListPager').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  if(btn.dataset.action === 'page-prev') goPage(btn.dataset.pageTarget, -1);
  else if(btn.dataset.action === 'page-next') goPage(btn.dataset.pageTarget, 1);
});
el('dungeonList').addEventListener('click', (e)=>{
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
el('artifactList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn || btn.disabled) return;
  const id = btn.dataset.artifactId;
  if(btn.dataset.action === 'equip-artifact') equipArtifact(id);
  else if(btn.dataset.action === 'unequip-artifact') unequipArtifact(id);
});
el('consumableList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action="use-flask"]');
  if(!btn) return;
  useFlask(btn.dataset.id);
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

loadState();
