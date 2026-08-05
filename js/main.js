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
el('invTabBtnWeapon').addEventListener('click', ()=> switchInvTab('weapon'));
el('invTabBtnArtifact').addEventListener('click', ()=> switchInvTab('artifact'));
el('invTabBtnConsumable').addEventListener('click', ()=> switchInvTab('consumable'));
el('invTabBtnStone').addEventListener('click', ()=> switchInvTab('stone'));
el('invTabBtnMisc').addEventListener('click', ()=> switchInvTab('misc'));
// ---- 상점 탭 / 정렬 ----
el('shopTabs').addEventListener('click', (e)=>{
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
el('shopItemsList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn || btn.disabled) return;
  const type = btn.dataset.type;
  switch(btn.dataset.action){
    case 'buy-weapon': buyWeapon(type, btn); break;
    case 'buy-consumable': buyFlask(type, btn); break;
    case 'sell-consumable': sellAllFlask(type, btn); break;
    case 'buy-artifact': buyArtifact(type, btn); break;
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
// "캐릭터 정보" 탭 내용(페이지 이동 버튼 + 스탯 배분 버튼)을 한 컨테이너 안에서 함께 위임 처리함
// (charStatsBody/charStatsPager 두 곳에 나눠 걸린 모달과 달리, 캐릭터 메뉴는 페이지가 통째로 다시
// 그려지는 하나의 컨테이너라 로직도 그대로 합쳐서 재사용함).
el('charTabPanels').addEventListener('click', (e)=>{
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
  else if(actionBtn.dataset.action === 'page-prev') goPage(actionBtn.dataset.pageTarget, -1);
  else if(actionBtn.dataset.action === 'page-next') goPage(actionBtn.dataset.pageTarget, 1);
});
el('respawnBtn').addEventListener('click', respawnAtVillage);
el('sellConfirmYesBtn').addEventListener('click', confirmSell);
el('sellConfirmNoBtn').addEventListener('click', cancelSell);
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
});
el('quickSlotPickerList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-item]');
  if(!btn || pendingQuickSlotIndex === null) return;
  state.quickSlots[pendingQuickSlotIndex] = btn.dataset.item;
  closeQuickSlotPicker();
  renderQuickSlots();
  saveState();
});
el('closeQuickSlotPickerBtn').addEventListener('click', closeQuickSlotPicker);

// 플라스크 쿨타임 표시(2.0→1.9→…→0.1)를 위한 실시간 갱신. 퀵슬롯이 없는 화면에서는
// updateQuickSlotCooldowns() 내부에서 el('quickSlotRow')가 조용히 무시하므로 항상 켜둬도 무방함.
setInterval(updateQuickSlotCooldowns, 100);

loadState();
