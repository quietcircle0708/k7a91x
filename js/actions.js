// ============================================================
// actions.js — 강화/상점 관련 사용자 액션
// 버튼 클릭 등으로 state를 바꾸는 함수들. 던전 전투 관련 액션은
// dungeon.js, 화면 전환/모달은 navigation.js를 참고.
// ============================================================

// ---- 상점 "개수 지정 구매" 팝업: 확정 구매 ----
// 팝업(navigation.js의 buyQtyState)에 설정된 개수만큼 기존 단건 구매 함수를 그대로 반복 호출함
// (골드 차감/인벤토리 지급 로직은 100% 재사용, 여기서는 반복 횟수만 담당). silent=true로 호출해
// 매번 render/saveState/구매 이펙트를 띄우지 않다가, 전부 끝난 뒤 한 번만 갱신·저장하고 팝업을 닫음.
function confirmBuyQty(){
  if(!buyQtyState) return;
  const { action, typeId, qty } = buyQtyState;
  let bought = 0;
  for(let i = 0; i < qty; i++){
    let ok = false;
    if(action === 'buy-weapon') ok = buyWeapon(typeId, null, true);
    else if(action === 'buy-consumable') ok = buyFlask(typeId, null, true);
    else if(action === 'buy-artifact') ok = buyArtifact(typeId, null, true);
    if(!ok) break; // 방어적 처리(정상 흐름에서는 maxQty 계산 덕분에 도중에 실패하지 않음)
    bought++;
  }
  closeBuyQtyModal();
  if(bought > 0){
    render();
    saveState();
  }
}

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
  // 대장간 화면에 지금 표시된 대상은 무기/방어구/장신구 인벤토리 중 하나이므로 전부 검색함(getEquipped()와 동일한 검색 범위).
  let item = state.inventory.find(i => i.id === itemId);
  if(!item) item = (state.armorInventory || []).find(i => i.id === itemId);
  if(!item) item = (state.accessoryInventory || []).find(i => i.id === itemId);
  if(!item){ render(); saveState(); return; }
  const type = item.type || 'longsword';
  const equipTypeNow = wpn(type).equipType;
  const isArmorItem = equipTypeNow === 'armor';
  const isAccessoryItem = equipTypeNow === 'accessory';

  const odds = oddsFor(type, level);
  let outcome = weightedOutcome(odds);

  const stage = el('swordStage');
  stopEmbers();
  stage.classList.remove('shake','shake-hard','strike','charging');
  void stage.offsetWidth;

  let blessingTriggered = false, charmTriggered = false, popLevelDisplay = false;

  if(outcome === 'destroy' && state.blessingActive && state.blessingCount > 0){
    state.blessingCount--;
    state.blessingActive = false;
    outcome = 'down';
    blessingTriggered = true;
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
      showMsg(isArmorItem ? '✨ 전설의 방어구 완성! 판매하여 다음 방어구를 준비하세요'
        : isAccessoryItem ? '✨ 전설의 장신구 완성! 판매하여 다음 장신구를 준비하세요'
        : '✨ 전설의 검 완성! 판매하여 다음 검을 만드세요', 'legend');
    } else {
      showMsg('강화 성공! +' + item.level, 'success');
    }
  } else if(outcome === 'stay'){
    if(charmTriggered){
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
    state.totalDestroys++;
    stage.classList.add('shake-hard');
    burstSparks('#c13c3c', 14);
    shatterBurst(18);
    flashCard('rgba(193,60,60,0.55)');
    const rewardMsg = processDestroyReward(itemId, type, level, isArmorItem, isAccessoryItem);
    showMsg('💥 아이템이 파괴되었습니다...' + (rewardMsg ? ' ' + rewardMsg : ''), 'destroy');
  }

  clampPlayerVitals(); // 방어구 강화로 체력/마나 보너스가 바뀌었을 수 있으므로 현재값을 새 최대치에 맞춰 정리
  render();
  saveState();
  if(popLevelDisplay){
    const ld = el('levelDisplay');
    ld.classList.remove('pop'); void ld.offsetWidth;
    ld.classList.add('pop');
    setTimeout(()=>ld.classList.remove('pop'), 500);
  }
}

// 강화 파괴 처리: 파괴된 장비를 (+0으로 되돌리는 대신) 인벤토리에서 완전히 소멸시킨 뒤, 장비 등급에
// 따라 파괴 보상(흔적/쇠조각/반짝이는 돌)을 판정해 지급함. level 파라미터는 파괴 판정이 발생한 강화
// 시도의 "이전" 강화 단계(예: +7 강화 시도 중 파괴 = level 7)이며, 쇠조각/반짝이는 돌 개수 계산에서
// "강화 단계에 따른 개수" 구간표 조회값으로 그대로 재사용됨(요구사항 4/5의 예시와 동일한 값). 강화
// 성공/실패/하락 확률과 강화 비용 등 기존 강화 로직은 이 함수와 무관하게 전혀 건드리지 않음 — 파괴
// 판정이 발생한 "이후"의 처리(소멸+보상)만 담당함. 반환값은 showMsg에 이어붙일 보상 안내 문구(보상이
// 없으면 null — 일반 등급이거나, 등급별 확률 판정에서 재료 보상이 뽑혔는데 개수 구간표가 0인 경우도
// 정상적으로 0개 획득 문구를 반환함, 별도로 숨기지 않음).
function processDestroyReward(itemId, type, level, isArmorItem, isAccessoryItem){
  const w = wpn(type);
  const displayName = w.name;

  // 1. 파괴된 장비를 소속 인벤토리에서 완전히 제거 + 착용/대장간 강화대상 참조 정리
  //    (sellItem/sellArmorItem/sellAccessoryItem의 정리 패턴과 동일)
  if(isArmorItem){
    const idx = (state.armorInventory || []).findIndex(i => i.id === itemId);
    if(idx !== -1) state.armorInventory.splice(idx, 1);
    if(w.armorKind && state.equippedArmor && state.equippedArmor[w.armorKind] === itemId) state.equippedArmor[w.armorKind] = null;
  } else if(isAccessoryItem){
    const idx = (state.accessoryInventory || []).findIndex(i => i.id === itemId);
    if(idx !== -1) state.accessoryInventory.splice(idx, 1);
    if(Array.isArray(state.equippedAccessories)){
      const slotIdx = state.equippedAccessories.indexOf(itemId);
      if(slotIdx !== -1) state.equippedAccessories[slotIdx] = null;
    }
  } else {
    const idx = state.inventory.findIndex(i => i.id === itemId);
    if(idx !== -1) state.inventory.splice(idx, 1);
    if(state.equippedId === itemId) state.equippedId = null;
  }
  if(state.forgeTargetId === itemId) state.forgeTargetId = null;

  // 2. 등급별 파괴 보상 판정. 일반 등급은 DESTROY_REWARD_ODDS에 항목 자체가 없어 여기서 판정 없이 종료.
  const odds = DESTROY_REWARD_ODDS[w.grade];
  if(!odds) return null;
  const rewardKind = pickWeighted(odds);

  if(rewardKind === 'trace'){
    state.traceInventory.push({ id: state.nextItemId++, forType: type });
    return `'${displayName}의 흔적'을 획득했습니다.`;
  }
  const isScrap = rewardKind === 'scrapmetal';
  const qty = tierQty(isScrap ? DESTROY_SCRAPMETAL_LEVEL_QTY : DESTROY_SHINYSTONE_LEVEL_QTY, w.levelReq || 1)
            + tierQty(isScrap ? DESTROY_SCRAPMETAL_ENHANCE_QTY : DESTROY_SHINYSTONE_ENHANCE_QTY, level);
  const rewardItem = MISC_ITEMS[isScrap ? 'rareScrapmetal' : 'epicShinystone'];
  state[rewardItem.stateKey] = (state[rewardItem.stateKey] || 0) + qty;
  return `${rewardItem.name} ${qty}개를 획득했습니다.`;
}

// ---- 판매/장착 ----
function sellItem(id){
  if(isEnhancing) return;
  const item = state.inventory.find(i => i.id === id);
  if(!item) return;
  const type = item.type || 'longsword';
  const value = sellValueFor(type, item.level);
  const label = `${weaponName(type)}${levelSuffix(item.level)}`;
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
  showMsg(`${weaponName(type)}${levelSuffix(item.level)}를 ` + value.toLocaleString() + ' G에 판매했습니다', 'success');
  state.inventory.splice(idx, 1);
  if(state.forgeTargetId === id) state.forgeTargetId = null; // 대장간에 표시 중이었다면 함께 정리
  if(state.equippedId === id){
    state.equippedId = null;
    // "판매 후 자동 구매"는 인벤토리에 새 검을 채워주는 기능이지 강화 대상을 대신 골라주는 기능이
    // 아님(구조 변경 5번: 강화 화면은 항상 플레이어가 직접 선택한 장비만 표시) — 그래서 구매까지는
    // 자동으로 하되, 강화 대상으로 자동 지정(forgeTargetId 대입)하지는 않음. 이후 대장간 버튼이나
    // 인벤토리에서 직접 "강화 선택"해야 강화 화면에 표시됨.
    if(state.autoRebuy && state.gold >= weaponBuyPrice('longsword') && !equipInventoryFull()){
      state.gold -= weaponBuyPrice('longsword');
      const newItem = { id: state.nextItemId++, level: 0, type: 'longsword' };
      state.inventory.push(newItem);
    }
  }
  render();
  saveState();
}
// 대장간 화면 하단 "판매" 버튼 — 지금 대장간에 표시된 대상(getEquipped(), 무기/방어구/장신구)을 판매함.
function doSell(){
  const equipped = getEquipped();
  if(!equipped) return;
  if(state.inventory.some(i => i.id === equipped.id)) sellItem(equipped.id);
  else if((state.armorInventory || []).some(i => i.id === equipped.id)) sellArmorItem(equipped.id);
  else sellAccessoryItem(equipped.id);
}
// ---- 착용 요구 스탯 재검사(장비/아티팩트 착용상태 변경, 스탯 초기화 등으로 effectiveStats가 바뀔 때) ----
// 현재 착용 중인 무기(equippedId)/방어구(equippedArmor.helmet, .armor)/장신구(equippedAccessories 각 슬롯)
// 전부에 대해 착용 조건(meetsWeaponEquipRequirements — 레벨 조건은 그대로, 스탯 조건만 effectiveStats로
// 재계산됨)을 다시 검사해서, 더 이상 조건을 만족하지 못하는 장비는 즉시 장착 해제함. 레벨 조건은 플레이어
// 레벨이 낮아지는 경우가 없으므로 재검사로 새로 불만족되는 일이 없음(스탯 변화만으로 충분).
// 아티팩트 자체는 착용 요구 조건이 없어 이 함수의 재검사 대상은 아니지만(artifacts는 buyArtifact/
// equipArtifact/unequipArtifact 어디서도 meetsWeaponEquipRequirements를 거치지 않음), 아티팩트
// 착용상태 변경이 이 함수를 호출하는 트리거는 됨(effectiveStats의 artifactStatBonus에 반영되므로).
// 무기/방어구/장신구가 실제로 해제되면 clampPlayerVitals로 체력/마나도 즉시 새 최대치에 맞춰 잘라줌.
function recheckEquipRequirements(){
  const stats = effectiveStats();
  if(state.equippedId != null){
    const equippedWeapon = state.inventory.find(i => i.id === state.equippedId);
    if(equippedWeapon && !meetsWeaponEquipRequirements(equippedWeapon.type, state.playerLevel, stats)){
      state.equippedId = null;
    }
  }
  if(state.equippedArmor){
    ['helmet', 'armor'].forEach(kind => {
      const id = state.equippedArmor[kind];
      if(id == null) return;
      const item = (state.armorInventory || []).find(i => i.id === id);
      if(item && !meetsWeaponEquipRequirements(item.type, state.playerLevel, stats)){
        state.equippedArmor[kind] = null;
      }
    });
  }
  if(Array.isArray(state.equippedAccessories)){
    state.equippedAccessories = state.equippedAccessories.map(id => {
      if(id == null) return null;
      const item = (state.accessoryInventory || []).find(i => i.id === id);
      if(item && !meetsWeaponEquipRequirements(item.type, state.playerLevel, stats)) return null;
      return id;
    });
  }
  if(state.equippedSubId != null){
    const item = (state.subInventory || []).find(i => i.id === state.equippedSubId);
    // 레벨 조건 재검사(방어구/장신구와 동일)에 더해, 이 시점에 양손 검이 장착돼 있으면(이론상 불가능한
    // 상태지만 방어적으로) 보조 아이템도 함께 해제함 — 문서 3번 상호 배타 조건을 항상 보장하기 위함.
    if(item && (!meetsWeaponEquipRequirements(item.type, state.playerLevel, stats) || isTwoHandedWeaponEquipped())){
      state.equippedSubId = null;
    }
  }
  clampPlayerVitals();
}
// 강화 대상 선택. 무기를 선택하면 "착용 무기"(equippedId, 전투에 실제 사용)와 "대장간 표시 대상"
// (forgeTargetId)을 함께 갱신함(기존 동작과 동일 — 무기는 강화 선택이 곧 착용). 방어구를 선택하면
// forgeTargetId만 바뀌고 equippedId(착용 무기)는 그대로 유지됨 — 방어구는 별도의 "착용"(equipArmorPiece)
// 상태가 실제 능력치를 결정하므로, 대장간에 올려놓는 것만으로 전투 중인 무기가 바뀌면 안 됨.
function equipItem(id){
  if(isEnhancing) return;
  const weaponItem = state.inventory.find(i => i.id === id);
  if(weaponItem){
    if(!meetsWeaponEquipRequirements(weaponItem.type, state.playerLevel, effectiveStats())) return;
    // 양손 검은 보조 아이템을 착용 중이면 장착할 수 없음(문서 3번 상호 배타 조건). 양손 검이 아닌
    // 무기는 이 조건과 무관하게 항상 장착 가능.
    if(wpn(weaponItem.type).weaponKind === 'two_handed_sword' && !canEquipTwoHandedWeapon()) return;
    state.equippedId = id;
    state.forgeTargetId = id;
    recheckEquipRequirements(); // 무기 교체로 무기 고유 옵션의 스탯 보너스가 바뀌었을 수 있어 재검사
    showMsg('', '');
    render();
    saveState();
    return;
  }
  const armorItem = (state.armorInventory || []).find(i => i.id === id);
  if(armorItem){
    if(!meetsWeaponEquipRequirements(armorItem.type, state.playerLevel, effectiveStats())) return;
    state.forgeTargetId = id;
    showMsg('', '');
    render();
    saveState();
    return;
  }
  const accessoryItem = (state.accessoryInventory || []).find(i => i.id === id);
  if(accessoryItem){
    if(!meetsWeaponEquipRequirements(accessoryItem.type, state.playerLevel, effectiveStats())) return;
    state.forgeTargetId = id;
    showMsg('', '');
    render();
    saveState();
  }
}
// 대장간 "강화 장비 선택" 팝업에서 아이템을 클릭했을 때 호출됨. 기존 equipItem(인벤토리의 "강화 선택"
// 버튼과 동일 로직)을 그대로 재사용해서 강화 대상을 설정하고, 선택 즉시 팝업만 닫음 — 강화 공식/비용
// 등 기존 강화 로직은 전혀 건드리지 않음.
function selectForgeTarget(id){
  equipItem(id);
  closeForgeSelect();
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
// 상점에서 구매 가능한(purchasable:true) 아티팩트를 구매. 특정 아티팩트 이름/ID에 의존하지 않음 —
// ARTIFACTS 데이터에 purchasable:true + buyPrice만 넣으면 이 함수가 그대로 처리함.
// silent 파라미터는 buyWeapon과 동일한 역할(개수 지정 구매 팝업에서 반복 호출용).
function buyArtifact(id, btn, silent){
  const a = ARTIFACTS[id];
  if(!a || a.buyPrice == null) return false;
  if(ownsArtifact(id) || state.gold < a.buyPrice) return false;
  state.gold -= a.buyPrice;
  state.artifacts.push(id);
  // 빈 장착 슬롯이 있을 때만 자동 장착(기존 장착 중인 아티팩트를 교체하지 않음).
  if(state.equippedArtifacts.length < ARTIFACT_SLOT_MAX){
    state.equippedArtifacts.push(id);
    recheckEquipRequirements(); // 자동 장착도 착용상태 변경이므로 동일하게 재검사(스탯이 느는 방향이라 실제로 해제될 일은 없음)
  }
  if(!silent){ purchaseEffect(btn || null); render(); saveState(); }
  return true;
}
// 인벤토리에서 아티팩트를 직접 장착. 빈 슬롯이 없거나 이미 장착 중이면 아무 동작도 하지 않음
// (동일한 아티팩트를 동시에 두 번 장착할 수 없음 — 애초에 아티팩트는 종류별로 1개만 보유 가능).
function equipArtifact(id){
  if(!ownsArtifact(id) || isArtifactEquipped(id)) return;
  if(state.equippedArtifacts.length >= ARTIFACT_SLOT_MAX) return;
  state.equippedArtifacts.push(id);
  recheckEquipRequirements(); // 아티팩트 스탯 보너스가 늘어 요구 스탯 재계산이 필요할 수 있음(다른 장비에는 항상 유리한 방향)
  render(); saveState();
}
// 인벤토리에서 장착 중인 아티팩트를 해제. 해제 즉시 해당 능력치/효과가 사라짐
// (ownsArtifact/isArtifactEquipped를 사용하는 모든 효과 판정이 이 배열을 직접 참조하므로 별도 처리 불필요).
function unequipArtifact(id){
  const idx = state.equippedArtifacts.indexOf(id);
  if(idx === -1) return;
  state.equippedArtifacts.splice(idx, 1);
  recheckEquipRequirements(); // 아티팩트 스탯 보너스가 사라져 다른 장비의 요구 스탯을 더 이상 만족 못 할 수 있음
  render(); saveState();
}
// 상점에 등록된(purchasable) 무기를 구매. 가격은 sellPrice×2. 아이템 레벨(levelReq)은 "착용" 조건일 뿐
// 구매/강화와는 무관하므로, 레벨이 낮아도 구매해서 인벤토리에 넣고 강화할 수 있음.
// silent가 true면 이펙트 연출/화면 갱신/저장을 생략하고 성공 여부(boolean)만 반환함 — 개수 지정 구매
// 팝업(confirmBuyQty)이 이 함수를 N번 반복 호출한 뒤 마지막에 한 번만 render/saveState 하기 위함.
// 기존 방식대로 단건 구매(버튼 클릭 → 즉시 1개 구매)로 호출할 때는 silent를 생략하면 기존과 동일하게 동작함.
function buyWeapon(typeId, btn, silent){
  const w = WEAPON_TYPES[typeId];
  if(w){
    if(!w.purchasable) return false;
    const price = weaponBuyPrice(typeId);
    if(state.gold < price || equipInventoryFull()) return false;
    state.gold -= price;
    const newItem = { id: state.nextItemId++, level: 0, type: typeId };
    state.inventory.push(newItem);
    // (구조 변경 5번) 예전에는 장착 중인 무기가 없으면 방금 구매한 무기를 자동으로 강화 대상으로
    // 지정했지만, 이제는 대장간 버튼/인벤토리에서 플레이어가 직접 "강화 선택"해야만 강화 화면에
    // 표시되도록 자동 지정을 제거함. 구매 자체(인벤토리에 추가)는 그대로 동작함.
    if(!silent){ purchaseEffect(btn || null); render(); saveState(); }
    return true;
  }
  // 상점 "장비 > 방어구/장신구" 탭 카드도 동일한 data-action="buy-weapon"을 공유해서 호출하므로(buildWeaponShopCardHtml
  // 참고) 여기서 분기해서 처리함. 방어구/장신구는 각각 별도 인벤토리 배열에 담김.
  const a = ARMOR_TYPES[typeId];
  if(a){
    if(!a.purchasable) return false;
    const price = (a.sellPrice || 0) * 2;
    if(!state.armorInventory) state.armorInventory = [];
    if(state.gold < price || equipInventoryFull()) return false;
    state.gold -= price;
    state.armorInventory.push({ id: state.nextItemId++, level: 0, type: typeId });
    if(!silent){ purchaseEffect(btn || null); render(); saveState(); }
    return true;
  }
  // 상점 "장비 > 보조" 탭도 동일한 data-action="buy-weapon"을 공유해서 호출함(buildWeaponShopCardHtml
  // 참고) — 방어구/장신구와 같은 방식이나, 보조는 강화가 없어 level은 항상 0 그대로 유지됨.
  const sub = SUB_TYPES[typeId];
  if(sub){
    if(!sub.purchasable) return false;
    const price = (sub.sellPrice || 0) * 2;
    if(!state.subInventory) state.subInventory = [];
    if(state.gold < price || equipInventoryFull()) return false;
    state.gold -= price;
    state.subInventory.push({ id: state.nextItemId++, level: 0, type: typeId });
    if(!silent){ purchaseEffect(btn || null); render(); saveState(); }
    return true;
  }
  const acc = ACCESSORY_TYPES[typeId];
  if(!acc || !acc.purchasable) return false;
  const accPrice = (acc.sellPrice || 0) * 2;
  if(!state.accessoryInventory) state.accessoryInventory = [];
  if(state.gold < accPrice || equipInventoryFull()) return false;
  state.gold -= accPrice;
  state.accessoryInventory.push({ id: state.nextItemId++, level: 0, type: typeId });
  if(!silent){ purchaseEffect(btn || null); render(); saveState(); }
  return true;
}

// ---- 장신구: 판매/착용/강화 ----
// 강화는 방어구와 마찬가지로 대장간 화면(startEnhance/resolveEnhance)을 그대로 재사용함 — 별도 함수 없음.
function sellAccessoryItem(id){
  if(isEnhancing) return;
  const item = (state.accessoryInventory || []).find(i => i.id === id);
  if(!item) return;
  const value = sellValueFor(item.type, item.level);
  const label = `${ACCESSORY_TYPES[item.type].name}${levelSuffix(item.level)}`;
  openSellConfirm(label, value, () => performSellAccessoryItem(id));
}
function performSellAccessoryItem(id){
  const idx = (state.accessoryInventory || []).findIndex(i => i.id === id);
  if(idx === -1) return;
  const item = state.accessoryInventory[idx];
  const def = ACCESSORY_TYPES[item.type];
  const value = sellValueFor(item.type, item.level);
  state.gold += value;
  state.totalSold += value;
  showMsg(`${def.name}${levelSuffix(item.level)}를 ` + value.toLocaleString() + ' G에 판매했습니다', 'success');
  state.accessoryInventory.splice(idx, 1);
  if(Array.isArray(state.equippedAccessories)){
    const slotIdx = state.equippedAccessories.indexOf(id);
    if(slotIdx !== -1) state.equippedAccessories[slotIdx] = null;
  }
  if(state.forgeTargetId === id) state.forgeTargetId = null; // 대장간에 표시 중이었다면 함께 정리
  clampPlayerVitals();
  render(); saveState();
}
// 장신구 착용 — 장신구1/장신구2 두 슬롯 중 빈 곳에 들어감(반지는 같은 아이템을 2개까지 동시 착용
// 가능하므로 방어구처럼 종류로 슬롯을 구분하지 않음). 두 슬롯이 모두 차 있으면 아무 동작도 하지 않음
// (렌더링 쪽에서 이 경우 버튼을 비활성화해서 "슬롯 가득참"으로 안내함).
function equipAccessoryPiece(id){
  const item = (state.accessoryInventory || []).find(i => i.id === id);
  if(!item) return;
  if(!meetsWeaponEquipRequirements(item.type, state.playerLevel, effectiveStats())) return;
  if(!Array.isArray(state.equippedAccessories)) state.equippedAccessories = [null, null];
  if(state.equippedAccessories.includes(id)) return; // 이미 착용 중
  const emptyIdx = state.equippedAccessories.indexOf(null);
  if(emptyIdx === -1) return; // 슬롯 가득참
  state.equippedAccessories[emptyIdx] = id;
  recheckEquipRequirements();
  render(); saveState();
}
function unequipAccessoryPiece(id){
  if(!Array.isArray(state.equippedAccessories)) return;
  const idx = state.equippedAccessories.indexOf(id);
  if(idx === -1) return;
  state.equippedAccessories[idx] = null;
  recheckEquipRequirements();
  render(); saveState();
}

// ---- 방어구: 판매/착용/강화 ----
function sellArmorItem(id){
  if(isEnhancing) return;
  const item = (state.armorInventory || []).find(i => i.id === id);
  if(!item) return;
  const value = sellValueFor(item.type, item.level);
  const label = `${ARMOR_TYPES[item.type].name}${levelSuffix(item.level)}`;
  openSellConfirm(label, value, () => performSellArmorItem(id));
}
function performSellArmorItem(id){
  const idx = (state.armorInventory || []).findIndex(i => i.id === id);
  if(idx === -1) return;
  const item = state.armorInventory[idx];
  const def = ARMOR_TYPES[item.type];
  const value = sellValueFor(item.type, item.level);
  state.gold += value;
  state.totalSold += value;
  showMsg(`${def.name}${levelSuffix(item.level)}를 ` + value.toLocaleString() + ' G에 판매했습니다', 'success');
  state.armorInventory.splice(idx, 1);
  if(def && state.equippedArmor && state.equippedArmor[def.armorKind] === id){
    state.equippedArmor[def.armorKind] = null;
  }
  if(state.forgeTargetId === id) state.forgeTargetId = null; // 대장간에 표시 중이었다면 함께 정리
  clampPlayerVitals();
  render(); saveState();
}
// 방어구 착용 — 종류(투구/갑옷)당 한 개만 착용 가능하므로, 같은 종류를 착용 중이면 자동 교체됨.
// "강화 선택"(state.forgeTargetId, equipItem)과는 완전히 별개 개념 — 착용은 실제 능력치(방어도/체력/
// 마나)에 곧바로 반영되고, 대장간 화면에 무엇이 표시되는지와는 무관함.
function equipArmorPiece(id){
  const item = (state.armorInventory || []).find(i => i.id === id);
  if(!item) return;
  const def = ARMOR_TYPES[item.type];
  if(!def) return;
  if(!meetsWeaponEquipRequirements(item.type, state.playerLevel, effectiveStats())) return;
  if(!state.equippedArmor) state.equippedArmor = { helmet: null, armor: null };
  state.equippedArmor[def.armorKind] = id;
  recheckEquipRequirements();
  render(); saveState();
}
function unequipArmorPiece(id){
  const item = (state.armorInventory || []).find(i => i.id === id);
  if(!item || !state.equippedArmor) return;
  const def = ARMOR_TYPES[item.type];
  if(!def) return;
  if(state.equippedArmor[def.armorKind] === id) state.equippedArmor[def.armorKind] = null;
  recheckEquipRequirements();
  render(); saveState();
}

// ---- 보조(방패/보조 무기): 판매/착용/해제 ----
// 강화는 아예 없음(문서 2번 규칙) — startEnhance/resolveEnhance 어느 쪽도 호출할 일이 없고, 인벤토리
// 카드에도 "강화 선택" 버튼 자체가 없음(renderSubInventoryList 참고).
function sellSubItem(id){
  if(isEnhancing) return;
  const item = (state.subInventory || []).find(i => i.id === id);
  if(!item) return;
  const value = sellValueFor(item.type, item.level);
  const label = `${SUB_TYPES[item.type].name}${levelSuffix(item.level)}`;
  openSellConfirm(label, value, () => performSellSubItem(id));
}
function performSellSubItem(id){
  const idx = (state.subInventory || []).findIndex(i => i.id === id);
  if(idx === -1) return;
  const item = state.subInventory[idx];
  const def = SUB_TYPES[item.type];
  const value = sellValueFor(item.type, item.level);
  state.gold += value;
  state.totalSold += value;
  showMsg(`${def.name}${levelSuffix(item.level)}를 ` + value.toLocaleString() + ' G에 판매했습니다', 'success');
  state.subInventory.splice(idx, 1);
  if(state.equippedSubId === id) state.equippedSubId = null;
  clampPlayerVitals();
  render(); saveState();
}
// 보조 아이템 착용 — 동시에 1개만 착용 가능(같은 종류 구분 없이 슬롯 1개, 방어구의 투구/갑옷과 달리
// 종류별 슬롯이 아니라 통째로 1개). 레벨 조건과, 양손 검을 장착하지 않은 경우에만 착용 가능하다는
// 상호 배타 조건(canEquipSubItem, 문서 3번)을 함께 확인함.
function equipSubPiece(id){
  const item = (state.subInventory || []).find(i => i.id === id);
  if(!item) return;
  if(!meetsWeaponEquipRequirements(item.type, state.playerLevel, effectiveStats())) return;
  if(!canEquipSubItem()) return; // 양손 검 장착 중에는 착용 불가
  state.equippedSubId = id;
  recheckEquipRequirements();
  render(); saveState();
}
function unequipSubPiece(id){
  if(state.equippedSubId !== id) return;
  state.equippedSubId = null;
  recheckEquipRequirements();
  render(); saveState();
}
// 방어구 강화는 대장간 화면(startEnhance/resolveEnhance)을 무기와 완전히 동일하게 재사용함(사용자
// 요청: 강화 화면에서 강화 가능한 모든 장비를 선택해서 사용). 인벤토리 카드의 "강화 선택" 버튼은
// equipItem(id)을 그대로 호출해 forgeTargetId만 지정하고, 실제 강화는 대장간 화면의 "강화하기" 버튼으로
// 진행됨 — 별도의 즉시 강화 함수를 두지 않음.
// silent 파라미터는 buyWeapon과 동일한 역할(개수 지정 구매 팝업에서 반복 호출용).
function buyFlask(id, btn, silent){
  const item = CONSUMABLES[id];
  if(!item || state.gold < item.buyPrice) return false;
  if(!state.consumables) state.consumables = { hpFlask6: 0, mpFlask6: 0 };
  state.gold -= item.buyPrice;
  state.consumables[id] = (state.consumables[id] || 0) + 1;
  if(!silent){
    purchaseEffect(btn ? (btn.closest('.scroll-card') || btn) : null);
    render(); saveState();
  }
  return true;
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
// 기타 아이템(MISC_ITEMS)을 전부 판매. stateKey로 보유 수량이 저장된 state 필드를 조회하므로
// 새 기타 아이템이 추가돼도 이 함수는 수정할 필요 없음.
function sellAllMisc(id, btn){
  const item = MISC_ITEMS[id];
  if(!item) return;
  const count = state[item.stateKey] || 0;
  if(count <= 0) return;
  const total = count * item.sellPrice;
  state.gold += total;
  state[item.stateKey] = 0;
  purchaseEffect(btn || null);
  render(); saveState();
}

// ---- 회복 설정 (설정 > 전투 > 회복 설정) ----
// 전투 중에만 동작. 체력/마나가 각각의 발동 비율 이하로 떨어지면, 퀵슬롯에 등록된
// 해당 회복 플라스크를 기존 useFlask() 함수로 1개만 자동 사용한다.
function checkAutoHeal(){
  if(!state.settings || !state.settings.autoHeal) return;
  if(currentView !== 'hunt' || !hunt.started || hunt.monsters.length === 0) return; // 마을/상점/인벤토리 등 전투 외 상태에서는 동작 안 함
  ensurePlayerVitals();
  // 특정 플라스크 id를 하드코딩하지 않고, 퀵슬롯에 실제 등록된 각 아이템의 effect.type을 보고
  // 체력 회복류(healHp/healHpInstant)/마나 회복류(healMp/healMpInstant)인지만 판별함 — 회복 방식
  // (지속/즉시)과 무관하게 동일한 자동 사용 조건이 적용되며, 앞으로 새 회복 방식이 추가돼도
  // effect.type 분류만 맞으면 이 함수 수정 없이 자동으로 대상에 포함됨.
  (state.quickSlots || []).forEach(id => {
    const item = CONSUMABLES[id];
    if(!item || !item.effect) return;
    const type = item.effect.type;
    if(type === 'healHp' || type === 'healHpInstant'){
      autoHealTry(id, 'autoHealThreshold', state.playerHp, effectiveMaxHp(state.playerLevel));
    } else if(type === 'healMp' || type === 'healMpInstant'){
      autoHealTry(id, 'autoManaThreshold', state.playerMp, effectiveMaxMp(state.playerLevel));
    }
  });
}
// checkAutoHeal 전용 공통 체크 헬퍼 (체력/마나 각각에 대해 동일한 판단 로직을 재사용 — 중복 코드 방지)
function autoHealTry(flaskId, thresholdKey, current, max){
  const thresholdPct = state.settings[thresholdKey] != null ? state.settings[thresholdKey] : 50;
  if(current > max * (thresholdPct / 100)) return; // 아직 발동 비율 이상이면 동작 안 함
  const inQuickSlot = Array.isArray(state.quickSlots) && state.quickSlots.includes(flaskId);
  if(!inQuickSlot) return; // 퀵슬롯에 등록돼 있지 않으면 동작 안 함
  if(!(state.consumables && state.consumables[flaskId] > 0)) return; // 보유 수량이 없으면 동작 안 함
  useFlask(flaskId); // 기존 사용 함수 재사용 — 1회 호출 = 1개만 사용, 수동 사용과 동일한 경로.
  // 쿨타임 중이면 useFlask 내부에서 조용히 무시되므로, 자동 회복도 쿨타임이 끝날 때까지 자연히 대기하게 됨.
}

// ---- 플라스크 공통 사용 쿨타임 ----
// 아이템 id별로 관리(플라스크별 쿨타임은 독립적). 특정 id를 하드코딩하지 않으므로 새 플라스크가
// CONSUMABLES에 추가되면 별도 코드 수정 없이 동일하게 적용됨. 저장 대상 아님(런타임 전용 — 새로고침 시 초기화되어도 무방).
let flaskCooldownUntil = {};
function isFlaskOnCooldown(id){
  return (flaskCooldownUntil[id] || 0) > Date.now();
}
function flaskCooldownRemainingSec(id){
  const remainMs = (flaskCooldownUntil[id] || 0) - Date.now();
  return remainMs > 0 ? remainMs / 1000 : 0;
}
function startFlaskCooldown(id){
  const item = CONSUMABLES[id];
  const isInstant = item && (item.effect.type === 'healHpInstant' || item.effect.type === 'healMpInstant');
  flaskCooldownUntil[id] = Date.now() + (isInstant ? FLASK_INSTANT_COOLDOWN_MS : FLASK_COOLDOWN_MS);
}

// ---- 스킬 쿨타임/버프 (기존 플라스크 쿨타임 방식을 그대로 재사용) ----
// 스킬 id별로 독립 관리하며, 플라스크와 마찬가지로 저장 대상이 아닌 런타임 전용 값. 요구사항: "전투 종료
// 및 마을 귀환 시에도 초기화하지 않는다" — resetFlaskStateOnDeath 등 어디에서도 이 값을 지우지 않으므로
// 새로고침 전까지는 자연히 만료될 때까지(시간 경과) 유지됨.
let skillCooldownUntil = {};
function isSkillOnCooldown(id){
  return (skillCooldownUntil[id] || 0) > Date.now();
}
function skillCooldownRemainingSec(id){
  const remainMs = (skillCooldownUntil[id] || 0) - Date.now();
  return remainMs > 0 ? remainMs / 1000 : 0;
}
function startSkillCooldown(id){
  const s = SKILLS[id];
  if(!s || !s.cooldown) return;
  skillCooldownUntil[id] = Date.now() + s.cooldown * 1000;
}
// 지금 활성화된 버프 스킬 효과들. { [skillId]: { ...buffEffect, until } } — activeBuffBonus(formulas.js)가
// 읽어서 합산함. 스킬 쿨타임과 마찬가지로 런타임 전용(저장 대상 아님).
let activeSkillBuffs = {};
function applySkillBuff(id){
  const s = SKILLS[id];
  if(!s || !s.buffEffect) return;
  activeSkillBuffs[id] = { ...s.buffEffect, until: Date.now() + s.buffEffect.durationMs };
}

// ---- 스킬 사용 (요구사항: "전투에서의 스킬 사용") ----
// 지금 이 스킬을 사용할 수 있는지 — 퀵슬롯 버튼 disabled 판정과 실제 사용(useSkill) 양쪽에서 공유해서 씀.
function canUseSkillNow(id){
  const s = SKILLS[id];
  if(!s) return false;
  if(skillKindOf(s) === 'passive') return false; // 패시브는 항상 자동 적용이라 "사용" 개념이 없음
  if(currentView !== 'hunt' || !hunt.started || hunt.paused || hunt.monsters.length === 0) return false;
  if(isStunned(hunt.player)) return false; // 기절 중에는 스킬 사용 불가
  if(isSkillOnCooldown(id)) return false;
  const pool = s.resourceType === 'hp' ? (state.playerHp || 0) : (state.playerMp || 0);
  return pool >= (s.resourceAmount || 0);
}
// 퀵슬롯의 스킬 아이콘을 클릭했을 때 실제로 발동시키는 함수. 자원 소모/쿨타임 시작은 시전 시간과 무관하게
// 사용한 순간 바로 적용하고, 실제 효과(데미지/버프)는 시전 시간이 지난 뒤에 적용함(요구사항 1번).
function useSkill(id){
  if(!canUseSkillNow(id)) return;
  const s = SKILLS[id];
  if(s.resourceType === 'hp') state.playerHp = Math.max(0, (state.playerHp || 0) - s.resourceAmount);
  else state.playerMp = Math.max(0, (state.playerMp || 0) - s.resourceAmount);
  startSkillCooldown(id);
  renderHuntCharPanel();
  renderSkillQuickSlots();
  skillUseFlash(id);
  saveState();
  if(s.castTime && s.castTime > 0){
    setTimeout(() => resolveSkillEffect(id), Math.round(s.castTime * 1000));
  } else {
    resolveSkillEffect(id);
  }
}
// 시전 시간이 끝난 뒤 실제 효과를 적용. 시전 중에 전투가 끝나버렸을 수 있으므로(사망/던전 이탈 등) 그 사이
// 상태를 다시 확인함 — 이미 전투가 아니면 조용히 무시(자원 소모와 쿨타임은 사용 시점에 이미 적용됐으므로 유지).
function resolveSkillEffect(id){
  const s = SKILLS[id];
  if(!s) return;
  if(currentView !== 'hunt' || !hunt.started || hunt.monsters.length === 0) return;
  // 버프 모션(요구사항 6번): target이 'buff'인 스킬은 회복형(healFlat)이어도 skillKindOf가 그대로 'buff'를
  // 반환하므로 여기서 한 번에 처리함(아래 healFlat 조기 반환보다 먼저 판정) — 현재 바라보고 있는 방향
  // 그대로 버프 이미지를 잠깐 보여주고 자동으로 기본 자세로 복귀함(effects.js triggerPlayerBuffMotion).
  if(skillKindOf(s) === 'buff') triggerPlayerBuffMotion();
  if(s.healFlat){
    // 회복형 스킬(예: 대지의 기운) — 데미지 계산 없이 시전 완료 시점에 고정량 회복, 최대체력 초과 회복 안 함
    state.playerHp = Math.min(effectiveMaxHp(state.playerLevel), (state.playerHp || 0) + s.healFlat);
    refreshCharDisplays();
    renderHuntCharPanel();
    saveState();
    return;
  }
  if(skillKindOf(s) === 'buff'){
    applySkillBuff(id);
    refreshCharDisplays();
    renderHuntCharPanel();
    return;
  }
  // 공격 스킬 데미지 공식(요구사항 3번): 플레이어의 총 공격력 x 데미지% — 대장간 화면에 방어구가
  // 선택되어 있어도 스킬 데미지는 항상 실제 착용 무기 기준이어야 하므로 getEquippedWeapon() 사용.
  const equipped = getEquippedWeapon();
  if(!equipped) return;
  const type = equipped.type || 'longsword';
  const atk = effectiveAtk(type, equipped.level, equipped.damaged);
  const perHit = Math.max(1, Math.round(atk * (s.damagePercent || 0) / 100));
  const hits = s.hits || 1;
  // 스킬 피해에도 기본 공격(dungeon.js attackTick)과 동일한 치명타 확률/배율을 적용함(요청사항) — 단,
  // 기본 공격은 "전체 공격에 1회" 판정인 반면 스킬은 "타수마다 독립적으로" 판정해야 하므로, 확률 자체는
  // 스킬 시전 시점(무기·레벨 고정)에 한 번만 계산해 두고, 실제 치명타 여부(Math.random())는 아래 각
  // 타격(및 지연 타격)마다 매번 새로 굴림. 치명타 배율(1.5배)은 기본 공격과 동일한 값을 그대로 사용.
  const critChance = effectiveCritChance(type, equipped.level);
  const targets = s.target === 'aoe'
    ? hunt.monsters.slice()
    : [hunt.monsters.find(m => m.instanceId === hunt.targetId) || hunt.monsters[0]];
  // 공격 모션(요구사항 5번): 스킬의 타겟이 단일(single)/광역(aoe)인 경우 등급과 무관하게 공격 모션으로
  // 처리함 — 현재 타겟 방향의 공격 이미지를 잠깐 보여주고 자동으로 기본 자세로 복귀함(기본 공격과 동일한
  // effects.js triggerPlayerAttackMotion 재사용, 새 로직 아님).
  triggerPlayerAttackMotion();
  // hitDelayMs가 지정된 스킬(예: 이연격)은 타수 사이에 지연을 두는 별도 경로로 처리하고 여기서 끝냄 —
  // 지정되지 않은 스킬은 아래 기존 동기 루프를 그대로 타므로 다른 스킬은 전혀 영향받지 않음.
  if(s.hitDelayMs){
    targets.forEach(t => { if(t) applyDelayedSkillHits(t, s, perHit, critChance); });
    return;
  }
  targets.forEach(t => {
    if(!t) return;
    for(let i = 0; i < hits; i++){
      if(t.hp <= 0) break;
      const isCrit = Math.random() * 100 < critChance; // 타수마다 독립적으로 치명타 판정
      const hitDmg = isCrit ? Math.round(perHit * critMultiplierFor(t)) : perHit;
      const levelDiff = state.playerLevel - t.level;
      let dmg = Math.max(1, Math.round(hitDmg * playerDamageMultiplier(levelDiff)));
      // 대상 몬스터의 방어도를 최종 피해 감소/증가 공식에 적용(몬스터 방어도 시스템).
      dmg = Math.max(1, Math.round(dmg * defenseDamageMultiplier(monsterDefenseFor(t))));
      // 대상의 상태 이상에 따른 조건부 피해 증가 적용(예: 팔각비도 — 중독 대상 추가 피해).
      dmg = Math.max(1, Math.round(dmg * targetStatusDamageMultiplier(t)));
      t.hp -= dmg;
      monsterHitEffect(t.instanceId, dmg, isCrit);
      // 적중(=피해를 입혀 대상이 생존)한 경우에만 상태 이상 부여(예: 소드 스트라이크의 기절). 처치되는
      // 순간의 히트에는 부여하지 않음 — s.onHitStatus가 없는 기존 스킬들은 전혀 영향받지 않음.
      if(t.hp > 0 && s.onHitStatus) applyStatusEffectToMonster(t, s.onHitStatus.key, s.onHitStatus.durationMs);
    }
    if(t.hp <= 0) killMonsterInstance(t.instanceId);
    else updateMonsterSlot(t);
  });
}
// hitDelayMs가 지정된 다타수 공격 스킬 전용 처리(예: 이연격 — 1타 즉시 + 2타는 hitDelayMs초 뒤).
// 데미지 계산·상태이상 부여·처치 판정 공식은 위 동기 루프(resolveSkillEffect)와 완전히 동일하게 유지함
// (치명타 판정도 동일하게 타격마다 독립적으로 이뤄짐 — critChance는 스킬 시전 시점에 고정해 넘겨받고,
// 실제 치명타 여부는 즉시타/지연타 각각 실행되는 시점에 새로 판정함).
// 1타는 즉시 적용하고, 이후 타수는 hitDelayMs*순번(ms) 뒤에 setTimeout으로 순차 적용함. 지연된 타수는
// 실행 시점에 전투가 여전히 진행 중이고 대상이 아직 hunt.monsters에 남아있는지(=생존) 다시 확인한 뒤 적용함 —
// 그 사이 전투 종료/대상 처치/화면 이동 가능성이 있으므로 target 객체를 그대로 붙들지 않고 instanceId로 매번 재조회함.
function applyDelayedSkillHits(target, s, perHit, critChance){
  const instanceId = target.instanceId;
  const hits = s.hits || 1;
  const applyOneHit = () => {
    const t = hunt.monsters.find(m => m.instanceId === instanceId);
    if(!t || t.hp <= 0) return;
    const isCrit = Math.random() * 100 < critChance; // 타수마다 독립적으로 치명타 판정
    const hitDmg = isCrit ? Math.round(perHit * critMultiplierFor(t)) : perHit;
    const levelDiff = state.playerLevel - t.level;
    let dmg = Math.max(1, Math.round(hitDmg * playerDamageMultiplier(levelDiff)));
    // 대상 몬스터의 방어도를 최종 피해 감소/증가 공식에 적용(몬스터 방어도 시스템).
    dmg = Math.max(1, Math.round(dmg * defenseDamageMultiplier(monsterDefenseFor(t))));
    // 대상의 상태 이상에 따른 조건부 피해 증가 적용(예: 팔각비도 — 중독 대상 추가 피해).
    dmg = Math.max(1, Math.round(dmg * targetStatusDamageMultiplier(t)));
    t.hp -= dmg;
    monsterHitEffect(t.instanceId, dmg, isCrit);
    if(t.hp > 0 && s.onHitStatus) applyStatusEffectToMonster(t, s.onHitStatus.key, s.onHitStatus.durationMs);
    if(t.hp <= 0) killMonsterInstance(t.instanceId);
    else updateMonsterSlot(t);
  };
  applyOneHit();
  for(let i = 1; i < hits; i++){
    setTimeout(() => {
      if(currentView !== 'hunt' || !hunt.started || hunt.monsters.length === 0) return;
      applyOneHit();
    }, Math.round(s.hitDelayMs * i * 1000));
  }
}

// ---- 소비 아이템 사용 ----
// 플라스크 사용: 1초 간격 여러 틱으로 나눠 최대치의 일부를 서서히 회복.
// hp/mp 각각 진행 중인 회복 상태(healState)를 추적 — 겹침 방지 및 전투 종료 시 잔여 회복량 즉시 지급에 사용.
let hpFlaskHeal = null; // { timerId, perTick, ticksLeft, isHp } 또는 null(진행 중인 회복 없음)
let mpFlaskHeal = null;
function useFlask(id){
  const item = CONSUMABLES[id];
  if(!item) return;
  if(isFlaskOnCooldown(id)) return; // 쿨타임 중이면 수동/자동 사용 모두 무시
  // 전투 중 기절 상태면 회복(플라스크 사용)도 정지 — 마을/상점 등 전투 밖에서는 기절 상태가 아니므로 영향 없음
  if(currentView === 'hunt' && hunt.started && !hunt.paused && isStunned(hunt.player)) return;
  if(!state.consumables) state.consumables = { hpFlask6: 0, mpFlask6: 0 };
  if((state.consumables[id] || 0) <= 0) return;
  state.consumables[id]--;
  startFlaskCooldown(id);
  ensurePlayerVitals();

  // 즉시 회복류(healHpInstant/healMpInstant): 지속 회복(healHp/healMp)과 다른 종류의 회복 아이템이라
  // 틱 진행 없이 고정값(amount)을 사용 즉시 전부 적용하고 끝냄 — 진행 중인 지속 회복(hpFlaskHeal/
  // mpFlaskHeal)과는 서로 간섭하지 않고 별개로 더해짐(같은 종류 지속 회복이 있어도 flush하지 않음).
  if(item.effect.type === 'healHpInstant' || item.effect.type === 'healMpInstant'){
    const isHpInstant = item.effect.type === 'healHpInstant';
    if(isHpInstant){
      state.playerHp = Math.min(effectiveMaxHp(state.playerLevel), (state.playerHp || 0) + item.effect.amount);
    } else {
      state.playerMp = Math.min(effectiveMaxMp(state.playerLevel), (state.playerMp || 0) + item.effect.amount);
    }
    renderHuntCharPanel();
    refreshCharDisplays();
    render();
    saveState();
    return;
  }

  render();
  saveState();

  const isHp = item.effect.type === 'healHp';
  // 같은 종류의 회복이 이미 진행 중이면, 버리지 않고 남은 회복량을 먼저 즉시 전부 적용한 뒤 새 회복을 시작함
  // (플레이어는 언제나 사용한 플라스크의 전체 회복량을 보장받아야 하므로).
  flushFlaskHeal(isHp ? 'hp' : 'mp');

  const ticks = Math.max(1, Math.round(item.effect.durationMs / 1000));
  const maxVal = isHp ? effectiveMaxHp(state.playerLevel) : effectiveMaxMp(state.playerLevel);
  const totalHeal = Math.round(maxVal * item.effect.percent / 100);
  const perTick = Math.round(totalHeal / ticks);
  const healState = { timerId: null, perTick, ticksLeft: ticks, isHp };
  healState.timerId = setInterval(() => {
    applyFlaskHealTick(healState);
    healState.ticksLeft--;
    if(healState.ticksLeft <= 0){
      clearInterval(healState.timerId);
      if(isHp) hpFlaskHeal = null; else mpFlaskHeal = null;
    }
  }, 1000);
  if(isHp) hpFlaskHeal = healState; else mpFlaskHeal = healState;
}

// 회복 상태(healState) 기준으로 1틱만큼 실제 체력/마나를 채움
function applyFlaskHealTick(healState){
  if(healState.isHp){
    state.playerHp = Math.min(effectiveMaxHp(state.playerLevel), (state.playerHp || 0) + healState.perTick);
  } else {
    state.playerMp = Math.min(effectiveMaxMp(state.playerLevel), (state.playerMp || 0) + healState.perTick);
  }
  renderHuntCharPanel();
  refreshCharDisplays();
  saveState();
}

// 진행 중인 회복 효과가 있다면, 남은 틱의 회복량을 전부 즉시 적용한 뒤 타이머/상태를 종료함.
// type: 'hp' | 'mp' | 'all'. 설정된 회복량은 항상 전부 보장되어야 하므로(강제 취소로 회복량을 버리지 않음),
// 전투 종료 시점(사망/던전 나가기/몬스터 처치)과 같은 종류 회복을 재사용하는 시점 모두 이 함수로 정리함.
function flushFlaskHeal(type){
  if((type === 'hp' || type === 'all') && hpFlaskHeal){
    clearInterval(hpFlaskHeal.timerId);
    for(let i = 0; i < hpFlaskHeal.ticksLeft; i++) applyFlaskHealTick(hpFlaskHeal);
    hpFlaskHeal = null;
  }
  if((type === 'mp' || type === 'all') && mpFlaskHeal){
    clearInterval(mpFlaskHeal.timerId);
    for(let i = 0; i < mpFlaskHeal.ticksLeft; i++) applyFlaskHealTick(mpFlaskHeal);
    mpFlaskHeal = null;
  }
}

// 전투가 끝나거나(던전 나가기/사망/몬스터 처치) 새로 시작될 때(startHuntLoop가 항상 그 시작점에서
// stopHuntLoop를 호출함) 진행 중이던 플라스크 회복을 정리. 강제로 버리지 않고, 남아있는 회복량을
// 먼저 전부 적용한 뒤(flushFlaskHeal) 종료함으로써 플레이어가 전체 회복량을 보장받도록 함.
// (생존 상태로 전투가 끝난 경우에만 사용 — 사망으로 전투가 끝난 경우는 discardFlaskHeal을 사용)
function stopFlaskHealTimers(){
  flushFlaskHeal('all');
}

// 사망으로 전투가 종료된 경우 전용: 남은 회복량을 적용하지 않고 즉시 폐기하며, HP는 건드리지 않음.
// type: 'hp' | 'mp' | 'all'
function discardFlaskHeal(type){
  if((type === 'hp' || type === 'all') && hpFlaskHeal){
    clearInterval(hpFlaskHeal.timerId);
    hpFlaskHeal = null;
  }
  if((type === 'mp' || type === 'all') && mpFlaskHeal){
    clearInterval(mpFlaskHeal.timerId);
    mpFlaskHeal = null;
  }
}
// 사망 시 플라스크 관련 상태값(회복 진행 상태 + 쿨타임)을 모두 초기화
function resetFlaskStateOnDeath(){
  discardFlaskHeal('all');
  flaskCooldownUntil = {};
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
