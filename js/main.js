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
el('buyRingBtn').addEventListener('click', (e)=> buyRing(e.currentTarget));
el('sellShardBtn').addEventListener('click', sellAllShards);
el('sellShardPieceBtn').addEventListener('click', sellAllManaShards);
el('invTabBtnWeapon').addEventListener('click', ()=> switchInvTab('weapon'));
el('invTabBtnArtifact').addEventListener('click', ()=> switchInvTab('artifact'));
el('invTabBtnConsumable').addEventListener('click', ()=> switchInvTab('consumable'));
el('invTabBtnMisc').addEventListener('click', ()=> switchInvTab('misc'));
el('weaponShopList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action="buy-weapon"]');
  if(!btn || btn.disabled) return;
  buyWeapon(btn.dataset.type, btn);
});
el('buyHpFlaskBtn').addEventListener('click', (e)=> buyFlask('hpFlask', e.currentTarget));
el('buyMpFlaskBtn').addEventListener('click', (e)=> buyFlask('mpFlask', e.currentTarget));
el('sellHpFlaskBtn').addEventListener('click', (e)=> sellAllFlask('hpFlask', e.currentTarget));
el('sellMpFlaskBtn').addEventListener('click', (e)=> sellAllFlask('mpFlask', e.currentTarget));
el('skipToggleBtn').addEventListener('click', toggleSkip);
el('autoRebuyToggleBtn').addEventListener('click', toggleAutoRebuy);
el('openShopBtn').addEventListener('click', openShop);
el('openInventoryBtn').addEventListener('click', openInventory);
el('openDungeonBtn').addEventListener('click', openDungeonList);
el('goInventoryBtn').addEventListener('click', openInventory);
el('quickBuySwordBtn').addEventListener('click', (e)=> buyWeapon('longsword', e.currentTarget));
el('resetLink').addEventListener('click', resetGame);
document.querySelector('.back-from-shop').addEventListener('click', closeToForge);
document.querySelector('.back-from-inv').addEventListener('click', closeToForge);
document.querySelector('.back-from-dlist').addEventListener('click', closeToForge);
el('exitHuntBtn').addEventListener('click', ()=> guardedNav('dungeonlist'));
el('startExploreBtn').addEventListener('click', startExploration);
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
  if(statBtn && !statBtn.disabled){ allocateStat(statBtn.dataset.stat); return; }
  const actionBtn = e.target.closest('button[data-action]');
  if(!actionBtn || actionBtn.disabled) return;
  if(actionBtn.dataset.action === 'apply-stats') applyStatAlloc();
  else if(actionBtn.dataset.action === 'reset-stats') resetStatAlloc();
  else if(actionBtn.dataset.action === 'reset-stats-full') resetStatAllocFull();
});
el('respawnBtn').addEventListener('click', respawnAtVillage);
el('sellConfirmYesBtn').addEventListener('click', confirmSell);
el('sellConfirmNoBtn').addEventListener('click', cancelSell);
el('krStopBtn').addEventListener('click', killResultStop);
el('krContinueBtn').addEventListener('click', killResultContinue);
el('dungeonList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-id]');
  if(!btn || btn.disabled) return;
  enterDungeon(btn.dataset.id);
});
el('inventoryList').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  const id = Number(btn.dataset.id);
  if(btn.dataset.action === 'equip') equipItem(id);
  else if(btn.dataset.action === 'sell') sellItem(id);
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

loadState();
