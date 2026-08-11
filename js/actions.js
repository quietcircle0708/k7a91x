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
    item.level = 0;
    state.totalDestroys++;
    stage.classList.add('shake-hard');
    burstSparks('#c13c3c', 14);
    shatterBurst(18);
    flashCard('rgba(193,60,60,0.55)');
    showMsg('💥 아이템이 파괴되었습니다...', 'destroy');
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
// 강화 대상 선택. 무기를 선택하면 "착용 무기"(equippedId, 전투에 실제 사용)와 "대장간 표시 대상"
// (forgeTargetId)을 함께 갱신함(기존 동작과 동일 — 무기는 강화 선택이 곧 착용). 방어구를 선택하면
// forgeTargetId만 바뀌고 equippedId(착용 무기)는 그대로 유지됨 — 방어구는 별도의 "착용"(equipArmorPiece)
// 상태가 실제 능력치를 결정하므로, 대장간에 올려놓는 것만으로 전투 중인 무기가 바뀌면 안 됨.
function equipItem(id){
  if(isEnhancing) return;
  const weaponItem = state.inventory.find(i => i.id === id);
  if(weaponItem){
    if(!meetsWeaponEquipRequirements(weaponItem.type, state.playerLevel, state.stats)) return;
    state.equippedId = id;
    state.forgeTargetId = id;
    showMsg('', '');
    render();
    saveState();
    return;
  }
  const armorItem = (state.armorInventory || []).find(i => i.id === id);
  if(armorItem){
    if(!meetsWeaponEquipRequirements(armorItem.type, state.playerLevel, state.stats)) return;
    state.forgeTargetId = id;
    showMsg('', '');
    render();
    saveState();
    return;
  }
  const accessoryItem = (state.accessoryInventory || []).find(i => i.id === id);
  if(accessoryItem){
    if(!meetsWeaponEquipRequirements(accessoryItem.type, state.playerLevel, state.stats)) return;
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
  if(state.equippedArtifacts.length < ARTIFACT_SLOT_MAX) state.equippedArtifacts.push(id);
  if(!silent){ purchaseEffect(btn || null); render(); saveState(); }
  return true;
}
// 인벤토리에서 아티팩트를 직접 장착. 빈 슬롯이 없거나 이미 장착 중이면 아무 동작도 하지 않음
// (동일한 아티팩트를 동시에 두 번 장착할 수 없음 — 애초에 아티팩트는 종류별로 1개만 보유 가능).
function equipArtifact(id){
  if(!ownsArtifact(id) || isArtifactEquipped(id)) return;
  if(state.equippedArtifacts.length >= ARTIFACT_SLOT_MAX) return;
  state.equippedArtifacts.push(id);
  render(); saveState();
}
// 인벤토리에서 장착 중인 아티팩트를 해제. 해제 즉시 해당 능력치/효과가 사라짐
// (ownsArtifact/isArtifactEquipped를 사용하는 모든 효과 판정이 이 배열을 직접 참조하므로 별도 처리 불필요).
function unequipArtifact(id){
  const idx = state.equippedArtifacts.indexOf(id);
  if(idx === -1) return;
  state.equippedArtifacts.splice(idx, 1);
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
  if(!meetsWeaponEquipRequirements(item.type, state.playerLevel, state.stats)) return;
  if(!Array.isArray(state.equippedAccessories)) state.equippedAccessories = [null, null];
  if(state.equippedAccessories.includes(id)) return; // 이미 착용 중
  const emptyIdx = state.equippedAccessories.indexOf(null);
  if(emptyIdx === -1) return; // 슬롯 가득참
  state.equippedAccessories[emptyIdx] = id;
  clampPlayerVitals();
  render(); saveState();
}
function unequipAccessoryPiece(id){
  if(!Array.isArray(state.equippedAccessories)) return;
  const idx = state.equippedAccessories.indexOf(id);
  if(idx === -1) return;
  state.equippedAccessories[idx] = null;
  clampPlayerVitals();
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
  if(!meetsWeaponEquipRequirements(item.type, state.playerLevel, state.stats)) return;
  if(!state.equippedArmor) state.equippedArmor = { helmet: null, armor: null };
  state.equippedArmor[def.armorKind] = id;
  clampPlayerVitals();
  render(); saveState();
}
function unequipArmorPiece(id){
  const item = (state.armorInventory || []).find(i => i.id === id);
  if(!item || !state.equippedArmor) return;
  const def = ARMOR_TYPES[item.type];
  if(!def) return;
  if(state.equippedArmor[def.armorKind] === id) state.equippedArmor[def.armorKind] = null;
  clampPlayerVitals();
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
  if(!state.consumables) state.consumables = { hpFlask: 0, mpFlask: 0 };
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
  flaskCooldownUntil[id] = Date.now() + FLASK_COOLDOWN_MS;
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
  const atk = effectiveAtk(type, equipped.level);
  const perHit = Math.max(1, Math.round(atk * (s.damagePercent || 0) / 100));
  const hits = s.hits || 1;
  const targets = s.target === 'aoe'
    ? hunt.monsters.slice()
    : [hunt.monsters.find(m => m.instanceId === hunt.targetId) || hunt.monsters[0]];
  targets.forEach(t => {
    if(!t) return;
    for(let i = 0; i < hits; i++){
      if(t.hp <= 0) break;
      const levelDiff = state.playerLevel - t.level;
      const dmg = Math.max(1, Math.round(perHit * playerDamageMultiplier(levelDiff)));
      t.hp -= dmg;
      monsterHitEffect(t.instanceId, dmg, false);
      // 적중(=피해를 입혀 대상이 생존)한 경우에만 상태 이상 부여(예: 소드 스트라이크의 기절). 처치되는
      // 순간의 히트에는 부여하지 않음 — s.onHitStatus가 없는 기존 스킬들은 전혀 영향받지 않음.
      if(t.hp > 0 && s.onHitStatus) applyStatusEffectToMonster(t, s.onHitStatus.key, s.onHitStatus.durationMs);
    }
    if(t.hp <= 0) killMonsterInstance(t.instanceId);
    else updateMonsterSlot(t);
  });
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
  if(!state.consumables) state.consumables = { hpFlask: 0, mpFlask: 0 };
  if((state.consumables[id] || 0) <= 0) return;
  state.consumables[id]--;
  startFlaskCooldown(id);
  ensurePlayerVitals();
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
