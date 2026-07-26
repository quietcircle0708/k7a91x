// ============================================================
// actions.js — 강화/상점 관련 사용자 액션
// 버튼 클릭 등으로 state를 바꾸는 함수들. 던전 전투 관련 액션은
// dungeon.js, 화면 전환/모달은 navigation.js를 참고.
// ============================================================

// ---- 강화 ----
function startEnhance(){
  if(isEnhancing) return;
  const equipped = getEquipped();
  if(!equipped) return;
  const level = equipped.level;
  const type = equipped.type || 'longsword';
  if(level >= MAX_LEVEL) return;
  const cost = costFor(type, level);
  if(cost === undefined) return; // 아직 강화 데이터가 없는 무기(숏소드/대거 등)
  if(state.gold < cost) return;

  isEnhancing = true;
  state.gold -= cost;
  state.totalAttempts++;
  showMsg('', '');
  render();

  if(state.skipEffects){
    resolveEnhance(equipped.id, level);
    return;
  }

  const stage = el('swordStage');
  stage.classList.remove('shake','shake-hard','strike');
  stage.classList.add('charging');
  startEmbers();

  const highRisk = oddsFor(type, level)[3] > 0; // 파괴 확률이 있는 단계는 긴장감 있게 연출을 더 길게
  const delay = highRisk ? 1000 : 700;
  setTimeout(()=> resolveEnhance(equipped.id, level), delay);
}

function resolveEnhance(itemId, level){
  isEnhancing = false;
  const item = state.inventory.find(i => i.id === itemId);
  if(!item){ render(); saveState(); return; }
  const type = item.type || 'longsword';

  const odds = oddsFor(type, level);
  let outcome = weightedOutcome(odds);

  const stage = el('swordStage');
  stopEmbers();
  stage.classList.remove('shake','shake-hard','strike','charging');
  void stage.offsetWidth;

  let blessingTriggered = false, charmTriggered = false, ringTriggered = false, popLevelDisplay = false;

  if(outcome === 'destroy' && state.blessingActive && state.blessingCount > 0){
    state.blessingCount--;
    state.blessingActive = false;
    outcome = 'down';
    blessingTriggered = true;
  }
  if(outcome === 'down' && ownsArtifact('ring')){
    if(Math.random()*100 < RING_CHANCE){ outcome = 'stay'; ringTriggered = true; }
  }
  if(outcome === 'down' && state.charmActive && state.charmCount > 0){
    state.charmCount--;
    state.charmActive = false;
    outcome = 'stay';
    charmTriggered = true;
  }

  if(outcome === 'success'){
    item.level++;
    if(item.level > state.bestLevel) state.bestLevel = item.level;
    stage.classList.add('strike');
    successRing('#ffb37a');
    setTimeout(()=>successRing('#ffe9a8'), 130);
    burstRays('#ffd76a', 12);
    burstSparks('#ff6a3d', 24);
    flashCard('rgba(255,106,61,0.5)');
    popLevelDisplay = true;
    if(item.level >= MAX_LEVEL){
      state.legendCount++;
      successRing('#e0b13c');
      burstRays('#ffffff', 14);
      showMsg('✨ 전설의 검 완성! 판매하여 다음 검을 만드세요', 'legend');
    } else {
      showMsg('강화 성공! +' + item.level, 'success');
    }
  } else if(outcome === 'stay'){
    if(ringTriggered){
      vortexBurst('#ffd76a');
      burstSparks('#ffd76a', 14);
      flashCard('rgba(255,215,106,0.5)');
      showMsg('🌾 아주르의 강아지풀 반지 효과 발동! 하락을 막았습니다', 'artifact');
    } else if(charmTriggered){
      vortexBurst('var(--forge-green)');
      showMsg('쇠조각의 집념이 하락을 막아냈습니다', 'stay');
    } else {
      smokePuff();
      showMsg('실패... 레벨 유지', 'stay');
    }
  } else if(outcome === 'down'){
    item.level = Math.max(0, level - 1);
    stage.classList.add('shake');
    smokePuff(8);
    if(blessingTriggered){
      vortexBurst('var(--forge-blue)');
      showMsg('보석이 부서지며 파괴를 막아냈습니다 (+' + item.level + ')', 'down');
    } else {
      showMsg('실패! 레벨이 하락했습니다 (+' + item.level + ')', 'down');
    }
  } else if(outcome === 'destroy'){
    item.level = 0;
    state.totalDestroys++;
    stage.classList.add('shake-hard');
    burstSparks('#c13c3c', 14);
    shatterBurst(18);
    flashCard('rgba(193,60,60,0.55)');
    showMsg('💥 아이템이 파괴되었습니다...', 'destroy');
  }

  render();
  saveState();
  if(popLevelDisplay){
    const ld = el('levelDisplay');
    ld.classList.remove('pop'); void ld.offsetWidth;
    ld.classList.add('pop');
    setTimeout(()=>ld.classList.remove('pop'), 500);
  }
}

// ---- 판매/장착 ----
function sellItem(id){
  if(isEnhancing) return;
  const item = state.inventory.find(i => i.id === id);
  if(!item) return;
  const type = item.type || 'longsword';
  const value = sellValueFor(type, item.level);
  const label = `${weaponName(type)} +${item.level}`;
  openSellConfirm(label, value, () => performSellItem(id));
}
function performSellItem(id){
  const idx = state.inventory.findIndex(i => i.id === id);
  if(idx === -1) return;
  const item = state.inventory[idx];
  const type = item.type || 'longsword';
  const value = sellValueFor(type, item.level);
  state.gold += value;
  state.totalSold += value;
  showMsg(('+' + item.level) + ' ' + weaponName(type) + '를 ' + value.toLocaleString() + ' G에 판매했습니다', 'success');
  state.inventory.splice(idx, 1);
  if(state.equippedId === id){
    state.equippedId = null;
    if(state.autoRebuy && state.gold >= weaponBuyPrice('longsword') && state.inventory.length < INV_MAX){
      state.gold -= weaponBuyPrice('longsword');
      const newItem = { id: state.nextItemId++, level: 0, type: 'longsword' };
      state.inventory.push(newItem);
      state.equippedId = newItem.id;
    }
  }
  render();
  saveState();
}
function doSell(){
  const equipped = getEquipped();
  if(!equipped) return;
  sellItem(equipped.id);
}
function equipItem(id){
  if(isEnhancing) return;
  const item = state.inventory.find(i => i.id === id);
  if(!item) return;
  const type = item.type || 'longsword';
  if(!meetsWeaponEquipRequirements(type, state.playerLevel, state.stats)) return;
  state.equippedId = id;
  showMsg('', '');
  render();
  saveState();
}

// ---- 보호 장치(쇠조각/보석) ----
function toggleCharm(){
  if(isEnhancing || !getEquipped() || !(state.charmCount > 0 || state.charmActive)) return;
  state.charmActive = !state.charmActive;
  render(); saveState();
}
function toggleBlessing(){
  if(isEnhancing || !getEquipped() || !(state.blessingCount > 0 || state.blessingActive)) return;
  state.blessingActive = !state.blessingActive;
  render(); saveState();
}
function buyCharm(btn){
  if(isEnhancing || state.gold < state.charmPrice) return;
  state.gold -= state.charmPrice;
  state.charmCount++;
  purchaseEffect(btn || null);
  render(); saveState();
}
function buyBlessing(btn){
  if(isEnhancing || state.gold < state.blessingPrice) return;
  state.gold -= state.blessingPrice;
  state.blessingCount++;
  purchaseEffect(btn || null);
  render(); saveState();
}

// ---- 상점 구매/판매 ----
function buyRing(btn){
  if(ownsArtifact('ring') || state.artifacts.length >= ARTIFACT_SLOT_MAX || state.gold < 25000) return;
  state.gold -= 25000;
  state.artifacts.push('ring');
  purchaseEffect(btn || null);
  render(); saveState();
}
// 상점에 등록된(purchasable) 무기를 구매. 가격은 sellPrice×2, 레벨 제한(levelReq)도 함께 확인.
function buyWeapon(typeId, btn){
  const w = WEAPON_TYPES[typeId];
  if(!w || !w.purchasable) return;
  if(!meetsWeaponLevelReq(typeId, state.playerLevel)) return;
  const price = weaponBuyPrice(typeId);
  if(state.gold < price || state.inventory.length >= INV_MAX) return;
  state.gold -= price;
  const newItem = { id: state.nextItemId++, level: 0, type: typeId };
  state.inventory.push(newItem);
  if(state.equippedId === null) state.equippedId = newItem.id;
  purchaseEffect(btn || null);
  render(); saveState();
}
function buyFlask(id, btn){
  const item = CONSUMABLES[id];
  if(!item || state.gold < item.buyPrice) return;
  if(!state.consumables) state.consumables = { hpFlask: 0, mpFlask: 0 };
  state.gold -= item.buyPrice;
  state.consumables[id] = (state.consumables[id] || 0) + 1;
  purchaseEffect(btn ? (btn.closest('.scroll-card') || btn) : null);
  render(); saveState();
}
function sellAllFlask(id, btn){
  const item = CONSUMABLES[id];
  if(!item || !state.consumables) return;
  const count = state.consumables[id] || 0;
  if(count <= 0) return;
  const total = count * item.sellPrice;
  const label = `${item.name} ${count}개`;
  openSellConfirm(label, total, () => performSellAllFlask(id, btn));
}
function performSellAllFlask(id, btn){
  const item = CONSUMABLES[id];
  if(!item || !state.consumables) return;
  const count = state.consumables[id] || 0;
  if(count <= 0) return;
  const total = count * item.sellPrice;
  state.gold += total;
  state.consumables[id] = 0;
  purchaseEffect(btn || null);
  render(); saveState();
}
function sellAllShards(){
  const count = state.manaFragments || 0;
  if(count <= 0) return;
  const total = count * MISC_ITEMS.manaFragment.sellPrice;
  state.gold += total;
  state.manaFragments = 0;
  purchaseEffect(el('sellShardBtn'));
  render(); saveState();
}
function sellAllManaShards(){
  const count = state.manaShards || 0;
  if(count <= 0) return;
  const total = count * MISC_ITEMS.manaShard.sellPrice;
  state.gold += total;
  state.manaShards = 0;
  purchaseEffect(el('sellShardPieceBtn'));
  render(); saveState();
}

// ---- 회복 설정 (설정 > 전투 > 회복 설정) ----
// 전투 중에만 동작. 체력/마나가 각각의 발동 비율 이하로 떨어지면, 퀵슬롯에 등록된
// 해당 회복 플라스크를 기존 useFlask() 함수로 1개만 자동 사용한다.
function checkAutoHeal(){
  if(!state.settings || !state.settings.autoHeal) return;
  if(currentView !== 'hunt' || !hunt.started || !hunt.monster) return; // 마을/상점/인벤토리 등 전투 외 상태에서는 동작 안 함
  ensurePlayerVitals();
  autoHealTry('hpFlask', 'autoHealThreshold', state.playerHp, effectiveMaxHp(state.playerLevel));
  autoHealTry('mpFlask', 'autoManaThreshold', state.playerMp, effectiveMaxMp(state.playerLevel));
}
// checkAutoHeal 전용 공통 체크 헬퍼 (체력/마나 각각에 대해 동일한 판단 로직을 재사용 — 중복 코드 방지)
function autoHealTry(flaskId, thresholdKey, current, max){
  const thresholdPct = state.settings[thresholdKey] != null ? state.settings[thresholdKey] : 50;
  if(current > max * (thresholdPct / 100)) return; // 아직 발동 비율 이상이면 동작 안 함
  const inQuickSlot = Array.isArray(state.quickSlots) && state.quickSlots.includes(flaskId);
  if(!inQuickSlot) return; // 퀵슬롯에 등록돼 있지 않으면 동작 안 함
  if(!(state.consumables && state.consumables[flaskId] > 0)) return; // 보유 수량이 없으면 동작 안 함
  const alreadyHealing = flaskId === 'hpFlask' ? hpFlaskHealTimer : mpFlaskHealTimer;
  if(alreadyHealing) return; // 같은 종류 회복이 이미 진행 중이면 중복 발동 안 함
  useFlask(flaskId); // 기존 사용 함수 재사용 — 1회 호출 = 1개만 사용, 수동 사용과 동일한 경로
}

// ---- 소비 아이템 사용 ----
// 플라스크 사용: 1초 간격 2틱으로 나눠 최대치의 일부를 서서히 회복
// 플라스크 회복 타이머(체력/마나 각각) 추적용. 겹침/누적을 막고 전투 종료 시 확실히 정리하기 위함.
let hpFlaskHealTimer = null;
let mpFlaskHealTimer = null;
function useFlask(id){
  const item = CONSUMABLES[id];
  if(!item) return;
  if(!state.consumables) state.consumables = { hpFlask: 0, mpFlask: 0 };
  if((state.consumables[id] || 0) <= 0) return;
  state.consumables[id]--;
  ensurePlayerVitals();
  render();
  saveState();

  const isHp = item.effect.type === 'healHp';
  // 같은 종류의 회복이 이미 진행 중이면 먼저 정리 — 회복 타이머가 겹쳐 쌓이며 계속 회복되는 것처럼 보이는 버그 방지
  if(isHp && hpFlaskHealTimer){ clearInterval(hpFlaskHealTimer); hpFlaskHealTimer = null; }
  if(!isHp && mpFlaskHealTimer){ clearInterval(mpFlaskHealTimer); mpFlaskHealTimer = null; }

  const ticks = Math.max(1, Math.round(item.effect.durationMs / 1000));
  const maxVal = isHp ? effectiveMaxHp(state.playerLevel) : effectiveMaxMp(state.playerLevel);
  const totalHeal = Math.round(maxVal * item.effect.percent / 100);
  const perTick = Math.round(totalHeal / ticks);
  let ticksLeft = ticks;
  const timer = setInterval(() => {
    if(isHp){
      state.playerHp = Math.min(effectiveMaxHp(state.playerLevel), (state.playerHp || 0) + perTick);
    } else {
      state.playerMp = Math.min(effectiveMaxMp(state.playerLevel), (state.playerMp || 0) + perTick);
    }
    renderHuntCharPanel();
    renderCharStats();
    saveState();
    ticksLeft--;
    if(ticksLeft <= 0){
      clearInterval(timer);
      if(isHp) hpFlaskHealTimer = null; else mpFlaskHealTimer = null;
    }
  }, 1000);
  if(isHp) hpFlaskHealTimer = timer; else mpFlaskHealTimer = timer;
}

// 전투가 끝나거나(던전 나가기/사망) 새로 시작될 때(stopHuntLoop가 항상 그 시작점에서 호출됨) 진행 중이던
// 플라스크 회복 타이머를 정리. 이걸 안 하면 예전 회복 타이머가 백그라운드에 남아 계속 체력을 채우는 버그가 생김.
function stopFlaskHealTimers(){
  if(hpFlaskHealTimer){ clearInterval(hpFlaskHealTimer); hpFlaskHealTimer = null; }
  if(mpFlaskHealTimer){ clearInterval(mpFlaskHealTimer); mpFlaskHealTimer = null; }
}

// ---- 강화 화면 토글 옵션 ----
function toggleSkip(){
  if(isEnhancing) return;
  state.skipEffects = !state.skipEffects;
  render(); saveState();
}
function toggleAutoRebuy(){
  if(isEnhancing) return;
  state.autoRebuy = !state.autoRebuy;
  render(); saveState();
}
