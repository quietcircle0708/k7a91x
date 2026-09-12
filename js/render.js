// ============================================================
// render.js — 화면(DOM) 렌더링
// state를 읽어서 화면에 반영하는 함수들. 여기서 state를 직접
// 바꾸는 경우는 render() 안의 charmActive/blessingActive 자동
// 해제처럼 "표시 조건이 깨졌을 때 정리"하는 최소한의 경우뿐임(원본 그대로 유지).
// ============================================================

function render(){
  const equipped = getEquipped();
  const stage = el('swordStage');

  renderForgeTabs(); // 대장간 강화/수리 탭(내구도 시스템 15번 요구사항) — 정적 토글이라 render() 매 사이클 갱신
  renderHuntCharPanel();
  renderQuickSlots();
  // 플라스크 퀵슬롯(renderQuickSlots)과 동일한 이유로 여기서 항상 호출함 — 예전에는 캐릭터 메뉴의
  // 스킬 탭을 열거나 스킬을 실제로 사용할 때만 renderSkillQuickSlots()가 불려서, 게임 시작 후 스킬
  // 탭을 한 번도 안 연 채로 곧장 던전에 들어가면 huntSkillQuickSlotRow가 비어있는 채로 남는 버그가
  // 있었음(캐릭터 메뉴를 한 번 열면 그 뒤로는 정상 출력됐던 것도 이 때문). render()에서 항상 채워주면
  // 화면 전환과 무관하게 처음부터 정상 출력됨.
  renderSkillQuickSlots();
  el('goldText').textContent = state.gold.toLocaleString();
  el('goldLedger').textContent = state.gold.toLocaleString() + ' G';

  // 아티팩트 장비 슬롯 (최대 ARTIFACT_SLOT_MAX개) — 장착 중인 아티팩트만 표시
  el('equipRow').innerHTML = Array.from({ length: ARTIFACT_SLOT_MAX }, (_, i) => {
    const id = state.equippedArtifacts[i];
    if(!id) return `<div class="equip-slot"></div>`;
    const a = ARTIFACTS[id];
    return `<div class="equip-slot filled">${itemIconHtml(a)}<span class="tooltip">${buildArtifactTooltipHtml(id)}</span></div>`;
  }).join('');

  if(!equipped){
    el('emptyNotice').style.display = 'block';
    el('quickBuySwordBtn').textContent = `🗡️ 검 구매 (${weaponBuyPrice('longsword').toLocaleString()} G)`;
    el('quickBuySwordBtn').disabled = state.gold < weaponBuyPrice('longsword') || equipInventoryFull();
    el('tierLabel').textContent = '장착된 장비 없음';
    el('levelDisplay').textContent = '-';
    el('levelDisplay').style.color = 'var(--forge-cream-dim)';
    el('itemName').textContent = '';
    el('statRowsWrap').innerHTML = '';
    el('uniqueOptionWrap').style.display = 'none';
    el('oddsRow').innerHTML = '';
    stage.classList.add('empty');
    applySwordGlow(0);
    setBladeShape('longsword');
    updateAuraSmoke(false);
    el('enhanceBtn').disabled = true;
    el('enhanceBtn').textContent = '강화하기';
    el('costLine').innerHTML = '장착된 장비가 없습니다';
    el('sellBtn').disabled = true;
    el('charmCount').textContent = state.charmCount;
    el('charmPrice').textContent = state.charmPrice.toLocaleString();
    el('blessingCount').textContent = state.blessingCount;
    el('blessingPrice').textContent = state.blessingPrice.toLocaleString();
    el('toggleCharmBtn').disabled = true; el('toggleCharmBtn').textContent = '사용 안 함'; el('toggleCharmBtn').classList.remove('on');
    el('toggleBlessingBtn').disabled = true; el('toggleBlessingBtn').textContent = '사용 안 함'; el('toggleBlessingBtn').classList.remove('on');
    el('buyCharmBtn').disabled = state.gold < state.charmPrice;
    el('buyBlessingBtn').disabled = state.gold < state.blessingPrice;
  } else {
    el('emptyNotice').style.display = 'none';
    stage.classList.remove('empty');
    const level = equipped.level;
    const type = equipped.type || 'longsword';
    const tier = tierOf(level);
    const meta = TIER_META[tier];
    const levelEffect = ENHANCE_LEVEL_EFFECTS[level] || ENHANCE_LEVEL_EFFECTS[0];

    el('levelDisplay').textContent = '+' + level;
    el('levelDisplay').style.color = weaponNameColor(type, level);
    el('tierLabel').textContent = meta.label;
    el('itemName').textContent = weaponName(type) + levelSuffix(level);
    el('itemName').style.color = weaponNameColor(type, level);

    // 강화 화면 스탯: 무기/방어구 구분 없이 데이터에 실제로 존재하는 옵션(공격력/공격속도/치명타 확률/
    // 방어도/체력/마나)만 자동으로 표시(하드코딩 없음, buildForgeStatRowsHtml 참고).
    el('statRowsWrap').innerHTML = buildForgeStatRowsHtml(type, level);

    // 고유 옵션(에픽/유니크 전용) — 무기 데이터에 uniqueOption이 없으면 자동으로 숨겨짐. 기존 로직 그대로 재사용.
    const uniqueOptionHtml = weaponUniqueOptionForgeHtml(type, level);
    el('uniqueOptionWrap').style.display = uniqueOptionHtml ? '' : 'none';
    if(uniqueOptionHtml) el('uniqueOptionText').innerHTML = uniqueOptionHtml;

    applySwordGlow(level);
    setBladeShape(type);

    updateAuraSmoke(!!levelEffect.smoke, levelEffect.glowColor || '#ffffff');

    el('charmCount').textContent = state.charmCount;
    el('charmPrice').textContent = state.charmPrice.toLocaleString();
    el('blessingCount').textContent = state.blessingCount;
    el('blessingPrice').textContent = state.blessingPrice.toLocaleString();

    const noEnhanceData = !wpn(type).cost || wpn(type).cost.length === 0; // 아직 강화 단계별 데이터가 없는 장비(숏소드/대거 등)
    const atMax = noEnhanceData || level >= MAX_LEVEL;
    const odds = atMax ? null : oddsFor(type, level);
    const downPossible = odds && odds[2] > 0;
    const destroyPossible = odds && odds[3] > 0;

    const charmToggle = el('toggleCharmBtn');
    const canToggleCharm = downPossible && (state.charmCount > 0 || state.charmActive);
    charmToggle.disabled = !canToggleCharm;
    charmToggle.textContent = state.charmActive ? '사용 중' : '사용 안 함';
    charmToggle.classList.toggle('on', state.charmActive);
    el('buyCharmBtn').disabled = state.gold < state.charmPrice;

    const blessingToggle = el('toggleBlessingBtn');
    const canToggleBlessing = destroyPossible && (state.blessingCount > 0 || state.blessingActive);
    blessingToggle.disabled = !canToggleBlessing;
    blessingToggle.textContent = state.blessingActive ? '사용 중' : '사용 안 함';
    blessingToggle.classList.toggle('on', state.blessingActive);
    el('buyBlessingBtn').disabled = state.gold < state.blessingPrice;

    if(!downPossible && state.charmActive) state.charmActive = false;
    if(!destroyPossible && state.blessingActive) state.blessingActive = false;

    const oddsRow = el('oddsRow');
    if(noEnhanceData){
      oddsRow.innerHTML = '';
      el('enhanceBtn').disabled = true;
      el('enhanceBtn').textContent = '강화 준비 중';
      el('costLine').innerHTML = '이 장비는 아직 강화 데이터가 준비되지 않았습니다';
    } else if(atMax){
      oddsRow.innerHTML = '';
      el('enhanceBtn').disabled = true;
      el('enhanceBtn').textContent = '최대 강화 완료';
      el('costLine').innerHTML = '판매하여 새 장비를 시작하세요';
    } else {
      let chips = `<span class="odds-chip success">성공 ${odds[0]}%</span><span class="odds-chip stay">유지 ${odds[1]}%</span>`;
      if(odds[2] > 0) chips += `<span class="odds-chip down">하락 ${odds[2]}%</span>`;
      if(odds[3] > 0) chips += `<span class="odds-chip destroy">파괴 ${odds[3]}%</span>`;
      oddsRow.innerHTML = chips;
      el('enhanceBtn').disabled = state.gold < costFor(type, level);
      el('enhanceBtn').textContent = '강화하기';
      el('costLine').innerHTML = `비용: ${costFor(type, level).toLocaleString()} G · <span class="sell-part">판매가: ${durabilityAdjustedSellValue(sellValueFor(type, level), equipped).toLocaleString()} G</span>`;
    }
    el('sellBtn').disabled = false;
  }

  el('bestLevel').textContent = '+' + state.bestLevel;
  el('legendCount').textContent = state.legendCount + '회';
  el('totalAttempts').textContent = state.totalAttempts + '회';
  el('totalDestroys').textContent = state.totalDestroys + '회';
  el('totalKills').textContent = (state.totalKills||0) + '마리';
  el('totalSold').textContent = state.totalSold.toLocaleString() + ' G';

  el('skipToggleBtn').textContent = '⏭ 연출 스킵: ' + (state.skipEffects ? '켜짐' : '꺼짐');
  el('skipToggleBtn').classList.toggle('on', state.skipEffects);
  el('autoRebuyToggleBtn').textContent = '🗡️ 판매 후 자동 구매: ' + (state.autoRebuy ? '켜짐' : '꺼짐');
  el('autoRebuyToggleBtn').classList.toggle('on', state.autoRebuy);

  // 상점 (탭/정렬 포함 통합 렌더링)
  renderShopTab();

  // 인벤토리
  // 무기/방어구/장신구가 INV_MAX(50)를 공용으로 나눠 쓰므로, 이 카운트도 무기 탭에 있지만
  // totalEquipInventoryCount()로 세 종류를 합산해 표시함(무기 개수만 보여주면 실제 남은 공용 슬롯과
  // 어긋나 보일 수 있음).
  el('invCount').textContent = totalEquipInventoryCount() + ' / ' + INV_MAX;
  if(el('invCountArmor')) el('invCountArmor').textContent = totalEquipInventoryCount() + ' / ' + INV_MAX;
  if(el('invCountSub')) el('invCountSub').textContent = totalEquipInventoryCount() + ' / ' + INV_MAX;
  if(el('invCountAccessory')) el('invCountAccessory').textContent = totalEquipInventoryCount() + ' / ' + INV_MAX;
  renderInvTabs();
  renderInventoryList();
  renderArmorInventoryList();
  renderSubInventoryList();
  renderAccessoryInventoryList();
  renderArtifactList();
  renderConsumableList();
  renderStoneList();
  renderMiscList();

  // 강화 진행 중에는 다른 조작 잠금
  if(isEnhancing){
    el('enhanceBtn').disabled = true;
    el('enhanceBtn').textContent = '강화 중...';
    el('sellBtn').disabled = true;
    el('buyCharmBtn').disabled = true;
    el('buyBlessingBtn').disabled = true;
    el('toggleCharmBtn').disabled = true;
    el('toggleBlessingBtn').disabled = true;
    el('openShopBtn').disabled = true;
    el('openInventoryBtn').disabled = true;
    el('openDungeonBtn').disabled = true;
    el('openCharacterBtn').disabled = true;
    el('openCraftBtn').disabled = true;
  } else {
    el('openShopBtn').disabled = false;
    el('openInventoryBtn').disabled = false;
    el('openDungeonBtn').disabled = false;
    el('openCharacterBtn').disabled = false;
    el('openCraftBtn').disabled = false;
  }
}

// ---- 대장간 "강화 장비 선택" 팝업 ----
// forgeSelectableItems()(formulas.js)가 "소유+착용가능+강화가능" 조건으로 이미 걸러준 목록을 그대로
// 인벤토리 무기 탭과 동일한 페이지 시스템(PAGE_SIZE.forgeSelect=6)으로 잘라서 보여줌. 클릭하면
// selectForgeTarget(id)(actions.js)가 기존 equipItem과 동일한 로직으로 강화 대상을 설정함.
function renderForgeSelectList(){
  const wrap = el('forgeSelectList');
  if(!wrap) return;
  const pagerWrap = el('forgeSelectPager');
  const entries = forgeSelectableItems();
  if(entries.length === 0){
    wrap.innerHTML = `<div class="inv-empty">강화 가능한 장비가 없습니다.<br>상점에서 장비를 구매해보세요.</div>`;
    if(pagerWrap) pagerWrap.innerHTML = '';
    return;
  }
  const pageSize = PAGE_SIZE.forgeSelect;
  const totalPageCount = pageCount(entries.length, pageSize);
  pageState.forgeSelect = clampPage(pageState.forgeSelect, totalPageCount);
  if(pagerWrap) pagerWrap.innerHTML = pagerHtml('forgeSelect', pageState.forgeSelect, totalPageCount);
  const pageEntries = pageSlice(entries, pageState.forgeSelect, pageSize);
  wrap.innerHTML = `<div class="forge-select-list">${pageEntries.map(entry => {
    const isCurrent = entry.id === state.forgeTargetId;
    const itemColor = weaponNameColor(entry.type, entry.level);
    const display = equipInstanceDisplayInfo(entry.item, entry.type); // 아이콘 hover 시 기존 장비 툴팁(요구사항 1번)
    return `
      <button class="forge-select-item ${isCurrent ? 'active' : ''}" data-action="select-forge-target" data-id="${entry.id}">
        <span class="inv-icon weapon-name-wrap" style="border-color:${itemColor};">${weaponIconHtml(entry.type, 'inv-icon-img', entry.level)}<span class="tooltip">${display.tooltipHtml}</span></span>
        <span class="forge-select-info">
          <span class="forge-select-name" style="color:${itemColor};">${weaponName(entry.type)}${levelSuffix(entry.level)}</span>
          ${isCurrent ? '<span class="inv-badge">선택됨</span>' : ''}
        </span>
      </button>`;
  }).join('')}</div>`;
}

function renderInventoryList(){
  const wrap = el('inventoryList');
  const pagerWrap = el('invWeaponPager');
  if(state.inventory.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 무기가 없습니다.<br>상점에서 <b>검</b>을 구매해보세요 (100 G).</div>`;
    if(pagerWrap) pagerWrap.innerHTML = '';
    return;
  }
  const pageSize = PAGE_SIZE.invWeapon;
  const sorted = sortEquippedFirst(state.inventory, item => item.id === state.equippedId);
  const totalPageCount = pageCount(sorted.length, pageSize);
  pageState.invWeapon = clampPage(pageState.invWeapon, totalPageCount);
  if(pagerWrap) pagerWrap.innerHTML = pagerHtml('invWeapon', pageState.invWeapon, totalPageCount);
  const pageItems = pageSlice(sorted, pageState.invWeapon, pageSize);
  wrap.innerHTML = pageItems.map(item=>{
    const type = item.type || 'longsword';
    const tier = tierOf(item.level);
    const meta = TIER_META[tier];
    const itemColor = weaponNameColor(type, item.level);
    const isEquipped = item.id === state.equippedId;
    const sellVal = durabilityAdjustedSellValue(sellValueFor(type, item.level), item);
    const reqOk = meetsWeaponEquipRequirements(type, state.playerLevel, effectiveStats());
    // 양손 무기는 보조 아이템을 착용 중이면 장착(강화 선택)할 수 없음(문서 3번 상호 배타 조건).
    // 양손이 아닌 무기는 이 조건과 무관하게 항상 착용 가능. handType 기준 판정(요청사항 10번).
    const blockedByTwoHandedRule = !isEquipped && wpn(type).handType === 'two_hand' && !canEquipTwoHandedWeapon();
    const equipDisabled = isEquipped || !reqOk || blockedByTwoHandedRule;
    const equipBtnHtml = `<button class="inv-btn equip ${isEquipped?'active':''}" data-action="equip" data-id="${item.id}" ${equipDisabled?'disabled':''}>${isEquipped?'장착 중':'강화 선택'}</button>`;
    const equipBtnFinal = (!isEquipped && !reqOk)
      ? `<span class="equip-req-wrap">${equipBtnHtml}<span class="tooltip">착용 조건을 만족해야 장착할 수 있습니다.${weaponRequirementText(type) ? `<br>(${weaponRequirementText(type)})` : ''}</span></span>`
      : (blockedByTwoHandedRule
        ? `<span class="equip-req-wrap">${equipBtnHtml}<span class="tooltip">보조 아이템을 장착 중에는 양손 무기를 장착할 수 없습니다.</span></span>`
        : equipBtnHtml);
    return `
      <div class="inv-card ${isEquipped?'equipped':''}">
        <div class="inv-icon" style="border-color:${itemColor};">${weaponIconHtml(type, 'inv-icon-img', item.level)}</div>
        <div class="inv-info">
          <span class="weapon-name-wrap">
            <span class="inv-name" style="color:${itemColor};">${weaponName(type)}${item.damaged ? '(손상)' : ''}${item.level > 0 ? ` <span class="inv-level" style="color:${itemColor};">+${item.level}</span>` : ''}</span> ${isEquipped?'<span class="inv-badge">장착 중</span>':''}
            <span class="tooltip">${buildWeaponTooltipHtml(type, item.level, item.damaged, item.currentDurability)}</span>
          </span>
          <div class="inv-sub">${meta.label}</div>
        </div>
        <div class="inv-actions">
          ${equipBtnFinal}
          <button class="inv-btn sell" data-action="sell" data-id="${item.id}">판매 (${sellVal.toLocaleString()}G)</button>
        </div>
      </div>`;
  }).join('');
}

// 방어구 인벤토리 목록. 무기 인벤토리 카드(renderInventoryList)와 동일한 레이아웃/공용 함수
// (weaponNameColor/weaponIconHtml/meetsWeaponEquipRequirements/sellValueFor — 전부 "장비 전역 설정"에
// 해당하는 범용 함수라 방어구에도 그대로 재사용됨)를 쓰되, 버튼 구성은 다름:
// - "착용/착용 해제": 무기의 "강화 선택"(=대장간 표시 대상 지정)과는 별개 개념. 방어구는 투구+갑옷을
//   동시에 착용할 수 있어서(state.equippedArmor.helmet / .armor), 착용 여부가 실제 능력치(방어도/체력/
//   마나)에 곧바로 반영됨(equipArmorPiece/unequipArmorPiece, actions.js).
// - "강화": 대장간 swordStage 화면을 거치지 않고 카드에서 바로 강화(startEnhanceArmor, actions.js) —
//   swordStage는 공격력/공격속도 등 무기 전용 필드 기반이라 방어구를 그 화면으로 보내지 않음.
function renderArmorInventoryList(){
  const wrap = el('armorInventoryList');
  if(!wrap) return;
  const pagerWrap = el('invArmorPager');
  const items = state.armorInventory || [];
  if(items.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 방어구가 없습니다.<br>상점에서 <b>방어구</b>를 구매해보세요.</div>`;
    if(pagerWrap) pagerWrap.innerHTML = '';
    return;
  }
  const pageSize = PAGE_SIZE.invArmor;
  const sorted = sortEquippedFirst(items, item => {
    const def = ARMOR_TYPES[item.type];
    return !!(def && state.equippedArmor && state.equippedArmor[def.armorKind] === item.id);
  });
  const totalPageCount = pageCount(sorted.length, pageSize);
  pageState.invArmor = clampPage(pageState.invArmor, totalPageCount);
  if(pagerWrap) pagerWrap.innerHTML = pagerHtml('invArmor', pageState.invArmor, totalPageCount);
  const pageItems = pageSlice(sorted, pageState.invArmor, pageSize);
  wrap.innerHTML = pageItems.map(item => {
    const type = item.type;
    const def = ARMOR_TYPES[type];
    if(!def) return '';
    const itemColor = weaponNameColor(type, item.level);
    const isWorn = !!(state.equippedArmor && state.equippedArmor[def.armorKind] === item.id);
    const sellVal = durabilityAdjustedSellValue(sellValueFor(type, item.level), item);
    const reqOk = meetsWeaponEquipRequirements(type, state.playerLevel, effectiveStats());
    const wearBtnHtml = isWorn
      ? `<button class="inv-btn equip active" data-action="unwear-armor" data-id="${item.id}">착용 해제</button>`
      : `<button class="inv-btn equip" data-action="wear-armor" data-id="${item.id}" ${reqOk ? '' : 'disabled'}>착용</button>`;
    const wearBtnFinal = (!isWorn && !reqOk)
      ? `<span class="equip-req-wrap">${wearBtnHtml}<span class="tooltip">착용 조건을 만족해야 장착할 수 있습니다.${weaponRequirementText(type) ? `<br>(${weaponRequirementText(type)})` : ''}</span></span>`
      : wearBtnHtml;
    // "강화 선택" — 대장간 화면(swordStage)에 이 방어구를 강화 대상으로 올림(무기 인벤토리 카드의
    // "강화 선택" 버튼과 동일한 equipItem() 재사용). 실제 강화는 대장간 화면의 "강화하기" 버튼에서 진행.
    const isForgeTarget = item.id === state.forgeTargetId;
    const forgeBtnHtml = `<button class="inv-btn equip ${isForgeTarget ? 'active' : ''}" data-action="equip" data-id="${item.id}" ${(isForgeTarget || !reqOk) ? 'disabled' : ''}>${isForgeTarget ? '강화 대상' : '강화 선택'}</button>`;
    return `
      <div class="inv-card ${isWorn ? 'equipped' : ''}">
        <div class="inv-icon" style="border-color:${itemColor};">${weaponIconHtml(type, 'inv-icon-img', item.level)}</div>
        <div class="inv-info">
          <span class="weapon-name-wrap">
            <span class="inv-name" style="color:${itemColor};">${def.name}${item.damaged ? '(손상)' : ''}${item.level > 0 ? ` <span class="inv-level" style="color:${itemColor};">+${item.level}</span>` : ''}</span> ${isWorn ? '<span class="inv-badge">착용 중</span>' : ''}
            <span class="tooltip">${buildArmorTooltipHtml(type, item.level, item.damaged, item.currentDurability)}</span>
          </span>
          <div class="inv-sub">${ARMOR_KINDS[def.armorKind] || ''}</div>
        </div>
        <div class="inv-actions">
          ${wearBtnFinal}
          ${forgeBtnHtml}
          <button class="inv-btn sell" data-action="sell-armor" data-id="${item.id}">판매 (${sellVal.toLocaleString()}G)</button>
        </div>
      </div>`;
  }).join('');
}
// 보조 인벤토리 목록. 방어구 인벤토리 카드(renderArmorInventoryList)와 동일한 구조를 재사용하되:
// - "강화 선택" 버튼이 아예 없음(보조 아이템은 강화 대상으로 선택할 수 없음 — 문서 2번 규칙, EQUIP_
//   INVENTORY_POOLS의 sub 항목에 cost가 없어 forgeSelectableItems에서도 자동으로 걸러짐과는 별개로,
//   애초에 이 카드에 그 버튼 자체를 그리지 않음).
// - "착용" 가능 여부는 레벨 조건(reqOk)뿐 아니라 양손 무기 상호 배타 조건(canEquipSubItem, 문서 3번)도
//   함께 검사함 — 이미 보조 아이템을 착용 중인 경우는 항상 "착용 해제" 버튼이 뜨므로 그 경우는 이
//   조건과 무관(해제는 항상 가능).
function renderSubInventoryList(){
  const wrap = el('subInventoryList');
  if(!wrap) return;
  const pagerWrap = el('invSubPager');
  const items = state.subInventory || [];
  if(items.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 보조 아이템이 없습니다.<br>아직 준비 중인 아이템 분류입니다.</div>`;
    if(pagerWrap) pagerWrap.innerHTML = '';
    return;
  }
  const pageSize = PAGE_SIZE.invSub;
  const sorted = sortEquippedFirst(items, item => state.equippedSubId === item.id);
  const totalPageCount = pageCount(sorted.length, pageSize);
  pageState.invSub = clampPage(pageState.invSub, totalPageCount);
  if(pagerWrap) pagerWrap.innerHTML = pagerHtml('invSub', pageState.invSub, totalPageCount);
  const pageItems = pageSlice(sorted, pageState.invSub, pageSize);
  wrap.innerHTML = pageItems.map(item => {
    const type = item.type;
    const def = SUB_TYPES[type];
    if(!def) return '';
    const itemColor = weaponNameColor(type, item.level);
    const isWorn = state.equippedSubId === item.id;
    const sellVal = durabilityAdjustedSellValue(sellValueFor(type, item.level), item);
    const reqOk = meetsWeaponEquipRequirements(type, state.playerLevel, effectiveStats());
    const canWear = !isWorn && reqOk && canEquipSubItem();
    const wearBtnHtml = isWorn
      ? `<button class="inv-btn equip active" data-action="unwear-sub" data-id="${item.id}">착용 해제</button>`
      : `<button class="inv-btn equip" data-action="wear-sub" data-id="${item.id}" ${canWear ? '' : 'disabled'}>착용</button>`;
    let wearTooltipText = null;
    if(!isWorn && !reqOk) wearTooltipText = `착용 조건을 만족해야 장착할 수 있습니다.${weaponRequirementText(type) ? `<br>(${weaponRequirementText(type)})` : ''}`;
    else if(!isWorn && reqOk && !canEquipSubItem()) wearTooltipText = '양손 무기를 장착 중에는 보조 아이템을 장착할 수 없습니다.';
    const wearBtnFinal = wearTooltipText
      ? `<span class="equip-req-wrap">${wearBtnHtml}<span class="tooltip">${wearTooltipText}</span></span>`
      : wearBtnHtml;
    return `
      <div class="inv-card ${isWorn ? 'equipped' : ''}">
        <div class="inv-icon" style="border-color:${itemColor};">${weaponIconHtml(type, 'inv-icon-img', item.level)}</div>
        <div class="inv-info">
          <span class="weapon-name-wrap">
            <span class="inv-name" style="color:${itemColor};">${def.name}${item.damaged ? '(손상)' : ''}</span> ${isWorn ? '<span class="inv-badge">착용 중</span>' : ''}
            <span class="tooltip">${buildSubTooltipHtml(type, item.level, item.damaged, item.currentDurability)}</span>
          </span>
          <div class="inv-sub">${SUB_KINDS[def.subKind] || ''}</div>
        </div>
        <div class="inv-actions">
          ${wearBtnFinal}
          <button class="inv-btn sell" data-action="sell-sub" data-id="${item.id}">판매 (${sellVal.toLocaleString()}G)</button>
        </div>
      </div>`;
  }).join('');
}
// 장신구 인벤토리 목록. 방어구 인벤토리 카드(renderArmorInventoryList)와 거의 동일한 구조를 재사용하되,
// "착용"은 단일 슬롯이 아니라 장신구1/장신구2 두 슬롯 중 빈 곳에 들어감(반지는 같은 종류를 2개까지
// 동시 착용 가능 — 문서 1번 규칙). isWorn 판정도 armorKind 매칭이 아니라 state.equippedAccessories
// 배열에 이 아이템 id가 포함되어 있는지로 확인함.
function renderAccessoryInventoryList(){
  const wrap = el('accessoryInventoryList');
  if(!wrap) return;
  const pagerWrap = el('invAccessoryPager');
  const items = state.accessoryInventory || [];
  if(items.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 장신구가 없습니다.<br>상점에서 <b>장신구</b>를 구매해보세요.</div>`;
    if(pagerWrap) pagerWrap.innerHTML = '';
    return;
  }
  const pageSize = PAGE_SIZE.invAccessory;
  const wornList = Array.isArray(state.equippedAccessories) ? state.equippedAccessories : [];
  const sorted = sortEquippedFirst(items, item => wornList.includes(item.id));
  const totalPageCount = pageCount(sorted.length, pageSize);
  pageState.invAccessory = clampPage(pageState.invAccessory, totalPageCount);
  if(pagerWrap) pagerWrap.innerHTML = pagerHtml('invAccessory', pageState.invAccessory, totalPageCount);
  const pageItems = pageSlice(sorted, pageState.invAccessory, pageSize);
  const slotsFull = wornList.filter(id => id != null).length >= ACCESSORY_SLOT_MAX;
  wrap.innerHTML = pageItems.map(item => {
    const type = item.type;
    const def = ACCESSORY_TYPES[type];
    if(!def) return '';
    const itemColor = weaponNameColor(type, item.level);
    const isWorn = wornList.includes(item.id);
    const sellVal = durabilityAdjustedSellValue(sellValueFor(type, item.level), item);
    const reqOk = meetsWeaponEquipRequirements(type, state.playerLevel, effectiveStats());
    const canWear = !isWorn && reqOk && !slotsFull;
    const wearBtnHtml = isWorn
      ? `<button class="inv-btn equip active" data-action="unwear-accessory" data-id="${item.id}">착용 해제</button>`
      : `<button class="inv-btn equip" data-action="wear-accessory" data-id="${item.id}" ${canWear ? '' : 'disabled'}>${slotsFull && reqOk ? '슬롯 가득참' : '착용'}</button>`;
    const wearBtnFinal = (!isWorn && !reqOk)
      ? `<span class="equip-req-wrap">${wearBtnHtml}<span class="tooltip">착용 조건을 만족해야 장착할 수 있습니다.${weaponRequirementText(type) ? `<br>(${weaponRequirementText(type)})` : ''}</span></span>`
      : wearBtnHtml;
    // "강화 선택" — 무기/방어구 인벤토리 카드와 동일하게 equipItem()을 재사용해 대장간 화면(forgeTargetId)에 올림.
    const isForgeTarget = item.id === state.forgeTargetId;
    const forgeBtnHtml = `<button class="inv-btn equip ${isForgeTarget ? 'active' : ''}" data-action="equip" data-id="${item.id}" ${(isForgeTarget || !reqOk) ? 'disabled' : ''}>${isForgeTarget ? '강화 대상' : '강화 선택'}</button>`;
    return `
      <div class="inv-card ${isWorn ? 'equipped' : ''}">
        <div class="inv-icon" style="border-color:${itemColor};">${weaponIconHtml(type, 'inv-icon-img', item.level)}</div>
        <div class="inv-info">
          <span class="weapon-name-wrap">
            <span class="inv-name" style="color:${itemColor};">${def.name}${item.damaged ? '(손상)' : ''}${item.level > 0 ? ` <span class="inv-level" style="color:${itemColor};">+${item.level}</span>` : ''}</span> ${isWorn ? '<span class="inv-badge">착용 중</span>' : ''}
            <span class="tooltip">${buildAccessoryTooltipHtml(type, item.level, item.damaged, item.currentDurability)}</span>
          </span>
          <div class="inv-sub">${ACCESSORY_KINDS[def.accessoryKind] || ''}</div>
        </div>
        <div class="inv-actions">
          ${wearBtnFinal}
          ${forgeBtnHtml}
          <button class="inv-btn sell" data-action="sell-accessory" data-id="${item.id}">판매 (${sellVal.toLocaleString()}G)</button>
        </div>
      </div>`;
  }).join('');
}

// ---- 대장간 강화/수리 탭 표시 갱신(내구도 시스템 15번 요구사항) ----
// invUI/craftUI의 renderXxxTabs()와 동일한 구조. "수리" 탭은 이번 작업에서는 안내 문구만 있는 빈
// 화면(forgeTabRepair)이라 별도 렌더링 함수 없이 표시/숨김만 전환함.
function renderForgeTabs(){
  document.querySelectorAll('#forgeTabs .inv-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === forgeUI.tab);
  });
  el('forgeTabEnhance').style.display = forgeUI.tab === 'enhance' ? '' : 'none';
  el('forgeTabRepair').style.display = forgeUI.tab === 'repair' ? '' : 'none';
  if(forgeUI.tab === 'repair') renderRepairTab();
}

// ---- 인벤토리: 탭(장비 최상위+하위탭 / 소비 / 마석 / 기타) 표시 상태 갱신 ----
// 상점의 renderShopTab() 앞부분(탭 active 표시 + 하위탭 행 노출)과 동일한 구조. invUI.tab이 실제 보여줄
// leaf 탭(weapon/armor/accessory/artifact/consumable/stone/misc)이고, invUI.equipTab은 장비 그룹 안에서
// 마지막으로 선택했던 하위탭을 기억해뒀다가 "장비" 최상위 버튼을 다시 눌렀을 때 그 탭으로 복귀시키는 데 씀.
function renderInvTabs(){
  if(!el('invTabWeapon')) return; // 인벤토리 화면 DOM이 아직 없는 초기 타이밍 방어
  const topId = topTabIdFor(INVENTORY_TABS, invUI.tab);
  INVENTORY_TABS.forEach(t => {
    const btn = document.querySelector(`.inv-tab-btn[data-tab="${t.id}"]`);
    if(btn) btn.classList.toggle('active', topId === t.id);
  });
  const equipTop = INVENTORY_TABS.find(t => t.id === 'equipment');
  const subWrap = el('invEquipSubTabs');
  if(subWrap) subWrap.style.display = topId === 'equipment' ? 'flex' : 'none';
  if(equipTop && equipTop.subTabs){
    equipTop.subTabs.forEach(st => {
      const btn = document.querySelector(`.inv-subtab-btn[data-tab="${st.id}"]`);
      if(btn) btn.classList.toggle('active', invUI.tab === st.id);
    });
  }
  el('invTabWeapon').style.display = invUI.tab === 'weapon' ? 'block' : 'none';
  el('invTabArmor').style.display = invUI.tab === 'armor' ? 'block' : 'none';
  el('invTabSub').style.display = invUI.tab === 'sub' ? 'block' : 'none';
  el('invTabAccessory').style.display = invUI.tab === 'accessory' ? 'block' : 'none';
  el('invTabArtifact').style.display = invUI.tab === 'artifact' ? 'block' : 'none';
  el('invTabConsumable').style.display = invUI.tab === 'consumable' ? 'block' : 'none';
  el('invTabStone').style.display = invUI.tab === 'stone' ? 'block' : 'none';
  el('invTabMisc').style.display = invUI.tab === 'misc' ? 'block' : 'none';
}

// ---- 제작소: 탭(제작 최상위+하위탭) 표시 상태 갱신 ----
// renderInvTabs()와 동일한 구조. 지금은 최상위 탭이 "제작" 하나뿐이라 항상 active로 표시됨.
function renderCraftTabs(){
  if(!el('craftTabWeapon')) return; // 제작소 화면 DOM이 아직 없는 초기 타이밍 방어
  const topId = topTabIdFor(CRAFT_TABS, craftUI.tab);
  CRAFT_TABS.forEach(t => {
    const btn = document.querySelector(`.craft-tab-btn[data-tab="${t.id}"]`);
    if(btn) btn.classList.toggle('active', topId === t.id);
  });
  const craftTop = CRAFT_TABS.find(t => t.id === 'craft');
  if(craftTop && craftTop.subTabs){
    craftTop.subTabs.forEach(st => {
      const btn = document.querySelector(`.craft-subtab-btn[data-tab="${st.id}"]`);
      if(btn) btn.classList.toggle('active', craftUI.tab === st.id);
    });
  }
  CRAFT_SUB_TABS.forEach(st => {
    const panel = el('craftTab' + st.id.charAt(0).toUpperCase() + st.id.slice(1));
    if(panel) panel.style.display = craftUI.tab === st.id ? 'block' : 'none';
  });
}
// ---- 제작소: 소분류(무기/방어구/보조/장신구) 탭별 아이템 목록 ----
// 이번 작업 범위는 UI 골격까지라 CRAFTABLE_ITEMS[kind]가 항상 빈 배열이므로 매번 빈 안내문만 표시됨.
// 페이지네이션 자체는 인벤토리와 완전히 동일한 공용 시스템(pageCount/clampPage/pagerHtml/pageSlice)을
// 그대로 사용해서 미리 붙여둠 — 나중에 CRAFTABLE_ITEMS에 실제 아이템이 채워지면(별도 작업) 이 함수의
// 목록 렌더 부분만 채우면 되고, 탭 전환/페이지 이동 로직은 전혀 손댈 필요가 없음.
function renderCraftList(kind){
  const panelId = 'craftTab' + kind.charAt(0).toUpperCase() + kind.slice(1);
  const wrap = el(panelId + 'List');
  if(!wrap) return;
  const pagerWrap = el('craft' + kind.charAt(0).toUpperCase() + kind.slice(1) + 'Pager');
  const items = CRAFTABLE_ITEMS[kind] || [];
  if(items.length === 0){
    wrap.innerHTML = `<div class="inv-empty">제작 가능한 아이템이 없습니다.<br>추후 업데이트를 통해 추가될 예정입니다.</div>`;
    if(pagerWrap) pagerWrap.innerHTML = '';
    return;
  }
  const pageKey = CRAFT_PAGE_KEY[kind];
  const pageSize = PAGE_SIZE[pageKey];
  const totalPageCount = pageCount(items.length, pageSize);
  pageState[pageKey] = clampPage(pageState[pageKey], totalPageCount);
  if(pagerWrap) pagerWrap.innerHTML = pagerHtml(pageKey, pageState[pageKey], totalPageCount);
  const pageItems = pageSlice(items, pageState[pageKey], pageSize);
  // 목록 행 자체는 인벤토리 장비 탭 카드(renderInventoryList)와 동일한 클래스(inv-card/inv-icon/
  // inv-info/inv-name/inv-sub/inv-actions/inv-btn)를 그대로 재사용함 — 아이콘 크기, 등급 색상, 툴팁,
  // 이름 표시 방식이 자동으로 인벤토리와 완전히 동일해짐(요청사항 1번). 버튼만 기존 장비 탭의 착용/판매
  // 대신 제작소 전용 두 버튼(제작 재료/제작)으로 교체하되, 동일한 .inv-btn 크기·스타일을 그대로 씀.
  wrap.innerHTML = pageItems.map(item => {
    const color = craftItemNameColor(item);
    const infoKey = kind + ':' + item.id;
    const infoOpen = craftUI.openMaterialIds.has(infoKey);
    const materialsHtml = item.materials.map(m => {
      const resource = findCraftResource(m.name);
      if(!resource) return '';
      const owned = craftResourceOwnedCount(resource);
      const shortCls = owned < m.need ? 'craft-mat-short' : 'craft-mat-ok';
      const matColor = craftResourceColor(resource);
      return `
        <div class="craft-mat-info-item">
          <div class="craft-mat-info-icon-col">
            <span class="inv-icon craft-mat-info-icon weapon-name-wrap" style="border-color:${matColor};">
              ${craftResourceIconHtml(resource, 'inv-icon-img')}
              <span class="tooltip">${craftResourceTooltipHtml(resource)}</span>
            </span>
            <div class="craft-mat-info-name" style="color:${matColor};">${resource.def.name}</div>
          </div>
          <span class="${shortCls} craft-mat-info-count">${owned}/${m.need}</span>
        </div>`;
    }).join('');
    return `
      <div class="craft-item-row">
        <div class="inv-card">
          <div class="inv-icon" style="border-color:${color};">${craftItemIconHtml(item, 'inv-icon-img')}</div>
          <div class="inv-info">
            <span class="weapon-name-wrap">
              <span class="inv-name" style="color:${color};">${item.name}</span>
              <span class="tooltip">${craftItemTooltipHtml(item)}</span>
            </span>
          </div>
          <div class="inv-actions">
            <button class="inv-btn" data-action="toggle-craft-mat-info" data-category="${kind}" data-id="${item.id}">제작 재료</button>
            <button class="inv-btn" data-action="open-craft-popup" data-category="${kind}" data-id="${item.id}">제작</button>
          </div>
        </div>
        <div class="craft-mat-info-panel" style="display:${infoOpen ? 'flex' : 'none'};">${materialsHtml}</div>
      </div>`;
  }).join('');
}

// ---- 제작소: 제작 진행 팝업(요청사항 3~10번) ----
function renderCraftPopup(){
  if(!craftPopup) return;
  const item = findCraftItem(craftPopup.category, craftPopup.itemId);
  if(!item) return;
  const color = craftItemNameColor(item);

  el('craftPopupIconBox').innerHTML = craftItemIconHtml(item, 'inv-icon-img');
  el('craftPopupIconBox').style.borderColor = color;
  // 제작 아이템 이름 아래에 툴팁을 정상 출력(요청사항 3-2) — weapon-name-wrap+.tooltip 패턴을
  // 그대로 재사용해서 이름에 마우스를 올리면 기존 아이템 툴팁 규칙 그대로 표시됨.
  el('craftPopupNameWrap').innerHTML =
    `<span class="inv-name" style="color:${color};">${item.name}</span>` +
    `<span class="tooltip">${craftItemTooltipHtml(item)}</span>`;

  // 재료 슬롯: 더 이상 플레이어가 재료를 직접 고르지 않고, 제작 아이템 데이터에 등록된 재료를
  // 등급 높은 순으로 자동 배치함(요청사항 3-1). 슬롯 클릭 시 바로 그 재료의 투입 개수 팝업으로 감.
  const sortedMaterials = craftMaterialsSortedByGradeDesc(item.materials);
  el('craftPopupSlots').innerHTML = sortedMaterials.map(material => {
    const slot = craftPopup.slots.find(s => s.name === material.name);
    const resource = findCraftResource(material.name);
    if(!resource) return '';
    const matColor = craftResourceColor(resource);
    const qtyCls = slot.qty < material.need ? 'craft-slot-qty-short' : 'craft-slot-qty-ok';
    // 요청사항 3-3: 아이콘 / 투입개수 / 이름을 하나의 슬롯에 뭉치지 않고 각각 분리된 줄로 표시.
    // 투입 개수가 0(아직 손대지 않음)일 때는 "+" 아이콘, 1 이상 투입했으면 실제 재료 아이콘으로 전환.
    const iconInner = slot.qty > 0
      ? `${craftResourceIconHtml(resource, 'inv-icon-img')}<span class="tooltip">${craftResourceTooltipHtml(resource)}</span>`
      : `<span class="craft-slot-plus">+</span>`;
    return `
      <button class="craft-slot" data-action="open-craft-material-qty" data-name="${material.name}">
        <span class="inv-icon craft-slot-icon-box weapon-name-wrap" style="border-color:${slot.qty > 0 ? matColor : ''};">${iconInner}</span>
        <span class="${qtyCls}">${slot.qty}/${material.need}</span>
        <span class="craft-slot-name" style="color:${matColor};">${resource.def.name}</span>
      </button>`;
  }).join('');

  el('craftPopupSuccessRate').textContent = `성공 확률 ${item.successChance}%`;
  el('craftPopupCurrentGold').textContent = '🪙 ' + state.gold.toLocaleString();
  el('craftPopupCost').textContent = '🪙 ' + (item.craftCost || 0).toLocaleString();

  el('craftPopupMakeBtn').disabled = !craftPopupCanCraft(craftPopup);
}

// ---- 제작소: 제작 최종 확인 UI ----
// 성공/실패 영역 모두 "아이콘/이름을 하나의 슬롯으로 묶지 않는다"(요청사항)는 원칙에 따라,
// 아이콘과 이름을 각각 별도의 줄(craft-confirm-icon-row / craft-confirm-item-name)로 렌더링함.
function renderCraftConfirmModal(){
  if(!craftPopup) return;
  const item = findCraftItem(craftPopup.category, craftPopup.itemId);
  if(!item) return;
  const color = craftItemNameColor(item);

  // 제작 성공 영역: 제작 아이템 본인이 곧 성공 시 지급되는 아이템이므로 craftItem* 헬퍼를 그대로 재사용.
  el('craftConfirmSuccessIconBox').innerHTML = craftItemIconHtml(item, 'inv-icon-img');
  el('craftConfirmSuccessIconBox').style.borderColor = color;
  el('craftConfirmSuccessName').innerHTML =
    `<span style="color:${color};">${item.name}</span>` +
    `<span class="tooltip">${craftItemTooltipHtml(item)}</span>`;

  // 제작 실패 영역: 데이터에 failReturns가 없으면(요청사항 4번) 영역 전체를 숨김.
  const failHtml = craftItemFailReturnHtml(item);
  el('craftConfirmFailWrap').style.display = failHtml ? 'block' : 'none';
  el('craftConfirmFailArea').innerHTML = failHtml;

  el('craftConfirmCost').textContent = '🪙 ' + (item.craftCost || 0).toLocaleString();
}

// ---- 제작소: 제작 연출 UI(요청사항 1~11번) ----
// phase별로 같은 모달 안의 요소 표시/숨김만 전환함(모달을 여러 개로 쪼개지 않음) — animating과
// awaitClick은 실루엣 아이콘을 그대로 쓰고, revealed에서만 결과 전용 아이콘 영역으로 바뀜.
function renderCraftAnimModal(){
  if(!craftAnim) return;
  const item = findCraftItem(craftAnim.category, craftAnim.itemId);
  if(!item) return;
  const color = craftItemNameColor(item);

  el('craftAnimHeader').textContent = craftAnim.phase === 'animating' ? '' : '제작 결과';

  if(craftAnim.phase === 'revealed'){
    el('craftAnimIconBox').style.display = 'none';
    el('craftAnimName').style.display = 'none';
    el('craftAnimStageText').textContent = '';
    el('craftAnimBarWrap').style.display = 'none';
    el('craftAnimClickHint').style.display = 'none';
    const resultIcons = el('craftAnimResultIcons');
    resultIcons.style.display = 'flex';
    resultIcons.innerHTML = craftAnimResultIconsHtml(item, craftAnim.resultSuccess, craftAnim.resultReturn);
    // 아이템 이름과 결과 문구 사이의 빈 공간에 "제작 성공!"/"제작 실패.." 한 줄을 추가로 표시(요청사항).
    el('craftAnimResultHeadline').style.display = 'block';
    el('craftAnimResultHeadline').textContent = craftAnim.resultSuccess ? '제작 성공!' : '제작 실패..';
    el('craftAnimResultHeadline').classList.toggle('success', craftAnim.resultSuccess);
    el('craftAnimResultHeadline').classList.toggle('fail', !craftAnim.resultSuccess);
    el('craftAnimResultText').style.display = 'block';
    el('craftAnimResultText').textContent = craftAnim.resultSuccess
      ? `${item.name}이 인벤토리로 지급되었습니다!`
      : '제작에 실패하였습니다.';
    el('craftAnimConfirmWrap').style.display = 'flex';
    return;
  }

  // animating / awaitClick 공통: 실루엣 아이콘 + 이름
  el('craftAnimIconBox').style.display = 'flex';
  el('craftAnimIconBox').innerHTML = craftItemIconHtml(item, 'inv-icon-img');
  el('craftAnimIconBox').style.borderColor = color;
  el('craftAnimIconBox').classList.add('craft-anim-silhouette');
  el('craftAnimName').style.display = 'block';
  el('craftAnimName').textContent = item.name;
  el('craftAnimName').style.color = color;
  el('craftAnimResultIcons').style.display = 'none';
  el('craftAnimResultHeadline').style.display = 'none';
  el('craftAnimResultText').style.display = 'none';
  el('craftAnimConfirmWrap').style.display = 'none';

  if(craftAnim.phase === 'animating'){
    el('craftAnimBarWrap').style.display = 'block';
    el('craftAnimClickHint').style.display = 'none';
    el('craftAnimIconBox').classList.remove('craft-anim-clickable');
    el('craftAnimIconBox').onclick = null;
    el('craftAnimStageText').textContent = craftAnimStageText(craftAnim.progress);
    renderCraftAnimProgress();
  } else { // awaitClick
    el('craftAnimBarWrap').style.display = 'none';
    el('craftAnimStageText').textContent = '';
    el('craftAnimClickHint').style.display = 'block';
    el('craftAnimIconBox').classList.add('craft-anim-clickable');
    el('craftAnimIconBox').onclick = clickCraftAnimIcon;
  }
}
function renderCraftAnimProgress(){
  if(!craftAnim) return;
  el('craftAnimBarFill').style.width = craftAnim.progress + '%';
  el('craftAnimBarText').textContent = craftAnim.progress.toFixed(2) + '%';
  // 버그 수정: 이전엔 연출 시작 시 renderCraftAnimModal()에서 딱 한 번만 문구를 세팅해서, 이후
  // 0.5초마다 진행률이 바뀌어도 문구가 갱신되지 않고 "재료를 가공하는 중..."에 고정되어 있었음.
  // tick마다 호출되는 이 함수에서 진행률에 맞는 문구를 매번 다시 계산해서 갱신하도록 수정.
  el('craftAnimStageText').textContent = craftAnimStageText(craftAnim.progress);
}
// 1초마다 빛 구체 하나를 생성(요청사항 3번) — CSS 애니메이션(craftOrbSpiral)이 바깥에서 중앙으로
// 소용돌이치며 빨려들어가는 이동을 전부 처리하고, 애니메이션이 끝나는 순간(animationend)에만 이
// 함수가 개입해 구체를 제거하고 아이템 아이콘에 0.2초 흔들림 클래스를 붙였다 뗌.
function spawnCraftAnimOrb(){
  const field = el('craftAnimIconStage');
  if(!field) return;
  const orb = document.createElement('div');
  orb.className = 'craft-anim-orb';
  orb.style.setProperty('--angle', Math.floor(Math.random() * 360) + 'deg');
  field.appendChild(orb);
  orb.addEventListener('animationend', () => {
    orb.remove();
    const iconBox = el('craftAnimIconBox');
    if(!iconBox) return;
    iconBox.classList.add('craft-anim-icon-shake');
    setTimeout(() => iconBox.classList.remove('craft-anim-icon-shake'), 200);
  });
}

// ---- 제작소: 투입 개수 선택 팝업(상점 buyQtyModal 재사용/개조) ----
function renderCraftMaterialQtyModal(){
  if(!craftMaterialQtyState) return;
  const { name, qty, maxQty } = craftMaterialQtyState;
  const resource = findCraftResource(name);
  if(!resource) return;
  const color = craftResourceColor(resource);
  el('craftMaterialQtyIconBox').innerHTML = craftResourceIconHtml(resource, 'inv-icon-img');
  el('craftMaterialQtyName').textContent = resource.def.name;
  el('craftMaterialQtyName').style.color = color;
  el('craftMaterialQtyInput').value = qty;
  el('craftMaterialQtyInput').max = maxQty;
  el('craftMaterialQtyOwned').textContent = craftResourceOwnedCount(resource).toLocaleString();
  el('craftMaterialQtyUpBtn').disabled = qty >= maxQty;
  el('craftMaterialQtyDownBtn').disabled = qty <= 0;
}

function renderArtifactList(){
  el('artifactCount').textContent = state.equippedArtifacts.length + ' / ' + ARTIFACT_SLOT_MAX;
  const wrap = el('artifactList');
  if(state.artifacts.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 아티팩트가 없습니다.<br>던전에서 몬스터를 처치하거나 상점에서 구매해보세요.</div>`;
    return;
  }
  wrap.innerHTML = state.artifacts.filter(id => ARTIFACTS[id]).map(id => {
    const a = ARTIFACTS[id];
    const nameColor = artifactNameColor(id);
    const equipped = isArtifactEquipped(id);
    const slotFull = state.equippedArtifacts.length >= ARTIFACT_SLOT_MAX;
    const equipBtnHtml = equipped
      ? `<button class="inv-btn equip active" data-action="unequip-artifact" data-artifact-id="${id}">해제</button>`
      : `<button class="inv-btn equip" data-action="equip-artifact" data-artifact-id="${id}" ${slotFull ? 'disabled' : ''}>장착</button>`;
    const equipBtnFinal = (!equipped && slotFull)
      ? `<span class="equip-req-wrap">${equipBtnHtml}<span class="tooltip">장착 슬롯이 모두 사용 중입니다. 다른 아티팩트를 먼저 해제해주세요.</span></span>`
      : equipBtnHtml;
    return `
      <div class="inv-card ${equipped?'equipped':''}">
        <div class="inv-icon" style="border-color:${nameColor};">${itemIconHtml(a)}</div>
        <div class="inv-info">
          <span class="weapon-name-wrap">
            <span class="inv-name" style="color:${nameColor};">${a.name}</span> ${equipped?'<span class="inv-badge">장착 중</span>':''}
            <span class="tooltip">${buildArtifactTooltipHtml(id)}</span>
          </span>
          <div class="inv-sub">${artifactGradeLabel(id)}</div>
        </div>
        <div class="inv-actions">
          ${equipBtnFinal}
        </div>
      </div>`;
  }).join('');
}

// 기타 탭: 아이템 분류(itemClass)가 'misc'인 재료성 아이템만 표시. 아이템 이름으로 분기하지 않으므로
// 새 기타 아이템을 MISC_ITEMS에 등록하기만 하면 자동으로 여기 노출됨.
// 이름에는 무기 툴팁과 동일한 레이아웃/서식의 전용 툴팁(hover)을 붙임.
function renderMiscList(){
  const wrap = el('miscList');
  const entries = Object.values(MISC_ITEMS)
    .filter(item => item.itemClass === 'misc')
    .map(item => ({ item, count: state[item.stateKey] || 0 }))
    .filter(e => e.count > 0);
  if(entries.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 기타 아이템이 없습니다.</div>`;
    return;
  }
  wrap.innerHTML = entries.map(({ item, count }) => `
    <div class="inv-card">
      <div class="inv-icon" style="border-color:${stoneNameColor(item.id)};">${itemIconHtml(item)}</div>
      <div class="inv-info">
        <div class="inv-name weapon-name-wrap">
          <span class="txt-shard">${item.name}</span> ×${count}
          <span class="tooltip">${buildMiscTooltipHtml(item.id)}</span>
        </div>
        <div class="inv-sub">상점에서 개당 ${item.sellPrice}G에 판매할 수 있어요.</div>
      </div>
    </div>`).join('');
}

// 마석 탭: 아이템 분류가 'stone'인 아이템만 표시(기타 탭과 동일한 UI 구조).
// 이름에는 등급 색상을 적용하고, 무기 툴팁과 동일한 레이아웃/서식의 전용 툴팁(hover)을 붙임.
function renderStoneList(){
  const wrap = el('stoneList');
  const entries = Object.values(MISC_ITEMS)
    .filter(item => item.itemClass === 'stone')
    .map(item => ({ item, count: state[item.stateKey] || 0 }))
    .filter(e => e.count > 0);
  if(entries.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 마석 아이템이 없습니다.</div>`;
    return;
  }
  wrap.innerHTML = entries.map(({ item, count }) => `
    <div class="inv-card">
      <div class="inv-icon" style="border-color: var(--forge-line);">${item.icon}</div>
      <div class="inv-info">
        <div class="inv-name weapon-name-wrap">
          <span style="color:${stoneNameColor(item.id)};">${item.name}</span> ×${count}
          <span class="tooltip">${buildStoneTooltipHtml(item.id)}</span>
        </div>
        <div class="inv-sub">상점에서 개당 ${item.sellPrice}G에 판매할 수 있어요.</div>
      </div>
    </div>`).join('');
}

function renderConsumableList(){
  const wrap = el('consumableList');
  const scrolls = [
    { name: '네레스의 집념이 서린 쇠조각', icon: '🧿', count: state.charmCount,
      desc: '전설의 대장장이 네레스의 집념이 담겨졌던 파편.', effect: '강화 실패 시 단계가 하락되지 않는다.',
      note: '강화 화면에서 사용할 수 있어요.' },
    { name: '네레스의 축복이 서린 보석', icon: '💎', count: state.blessingCount,
      desc: '전설의 대장장이 네레스가 축복을 담아 세공한 보석.', effect: '강화 실패 시 무기가 파괴되지 않는다.',
      note: '강화 화면에서 사용할 수 있어요.' },
  ].filter(it => it.count > 0);

  const flasks = Object.values(CONSUMABLES)
    .map(item => ({ item, count: (state.consumables && state.consumables[item.id]) || 0 }))
    .filter(({ count }) => count > 0);

  // 흔적(강화 파괴 보상) — CONSUMABLES처럼 정적 데이터표가 아니라 state.traceInventory에 개별 인스턴스로
  // 저장됨(같은 장비의 흔적이라도 서로 다른 id를 가진 별개 아이템). 아이콘은 복구 대상 장비의 실제 아이콘을
  // weaponIconHtml로 그대로 재사용함(별도 흔적 전용 이미지 없이도 어떤 장비의 흔적인지 한눈에 구분됨).
  const traces = state.traceInventory || [];

  if(scrolls.length === 0 && flasks.length === 0 && traces.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 소비 아이템이 없습니다.<br>대장간 강화 화면이나 상점에서 구매할 수 있어요.</div>`;
    return;
  }

  let html = scrolls.map(it => `
    <div class="inv-card">
      <div class="inv-icon" style="border-color: var(--forge-line);">${it.icon}</div>
      <div class="inv-info">
        <div class="inv-name">${it.name} ×${it.count}</div>
        <div class="inv-sub">${it.desc}</div>
        <div class="inv-sub">효과: ${resolveGlossaryTermsHtml(it.effect)}</div>
        <div class="inv-sub">${it.note}</div>
      </div>
    </div>`).join('');

  html += flasks.map(({ item, count }) => `
    <div class="inv-card">
      <div class="inv-icon" style="border-color: var(--forge-line);">${itemIconHtml(item)}</div>
      <div class="inv-info">
        <div class="inv-name">${item.name} ×${count}</div>
        <div class="inv-sub">${item.desc}</div>
      </div>
      <div class="inv-actions">
        <button class="inv-btn" data-action="use-flask" data-id="${item.id}">사용하기</button>
      </div>
    </div>`).join('');

  html += traces.map(t => {
    const name = `${weaponName(t.forType)}의 흔적`;
    return `
    <div class="inv-card">
      <div class="inv-icon" style="border-color: var(--forge-line);">${weaponIconHtml(t.forType, 'inv-icon-img')}</div>
      <div class="inv-info">
        <div class="inv-name">${name}</div>
        <div class="inv-sub">단련의 힘을 견디지 못한 ${weaponName(t.forType)}의 흔적</div>
      </div>
      <div class="inv-actions">
        <button class="inv-btn" data-action="use-trace" data-id="${t.id}">사용하기</button>
      </div>
    </div>`;
  }).join('');

  wrap.innerHTML = html;
}

function showMsg(text, cls){
  const m = el('msgText');
  m.textContent = text;
  m.className = 'msg ' + cls;
}

function showHuntMsg(text){
  const m = el('huntMsg');
  m.textContent = text;
  m.className = 'msg success';
}

// ---- 던전(사냥) 화면 ----
function renderHuntCharPanel(){
  const elLv = el('huntPlayerLevel');
  if(!elLv) return; // huntView가 아직 DOM에 없는 초기 타이밍 방어
  ensurePlayerVitals();
  const lv = state.playerLevel;
  const maxHp = effectiveMaxHp(lv);
  const maxMp = effectiveMaxMp(lv);
  const hp = Math.min(state.playerHp, maxHp);
  const mp = Math.min(state.playerMp, maxMp);
  const expReq = lv >= PLAYER_MAX_LEVEL ? 0 : requiredExp(lv);
  const expPct = lv >= PLAYER_MAX_LEVEL ? 100 : Math.min(100, Math.round(state.playerExp / expReq * 1000) / 10);

  elLv.textContent = 'Lv.' + lv;
  // 던전 전투 화면(상단 패널 + 전투 영역)에서는 요청에 따라 체력/마나 텍스트에 현재 수치만 표시함
  // (최대치는 표시하지 않음 — 실제 계산·최대치 데이터 자체는 변경 없이 표시 형식만 다름).
  el('huntHpText').textContent = hp.toLocaleString();
  el('huntHpBar').style.width = (hp / maxHp * 100) + '%';
  el('huntMpText').textContent = mp.toLocaleString();
  el('huntMpBar').style.width = (mp / maxMp * 100) + '%';
  el('huntExpText').textContent = lv >= PLAYER_MAX_LEVEL ? 'MAX' : expPct.toFixed(1) + '%';
  el('huntExpBar').style.width = expPct + '%';

  // 전투 화면 중앙(플레이어 슬롯)의 체력/마나 바도 동일한 값으로 함께 갱신(기존 몬스터 체력바와 같은
  // .hp-bar-wrap/.hp-bar-fill 구조를 재사용하므로, 감소 시 자연스러운 전환 애니메이션도 그대로 적용됨).
  const combatHpFill = el('combatPlayerHpFill');
  if(combatHpFill){
    combatHpFill.style.width = Math.max(0, Math.min(100, hp / maxHp * 100)) + '%';
    el('combatPlayerHpText').textContent = Math.max(0, hp).toLocaleString();
    el('combatPlayerMpFill').style.width = Math.max(0, Math.min(100, mp / maxMp * 100)) + '%';
    el('combatPlayerMpText').textContent = Math.max(0, mp).toLocaleString();
  }
  const combatLv = el('combatPlayerLevel');
  if(combatLv) combatLv.textContent = 'Lv.' + lv;
  // 토글 메뉴(캐릭터 정보 카드)가 펼쳐진 상태라면 그 안의 체력/마나/공격력 등도 전투 중 실시간으로 갱신.
  if(hunt.topUiExpanded) renderHuntSidePanel();
}

// 플라스크 퀵슬롯이 표시되는 모든 위치. 사냥 화면(quickSlotRow)에 있던 기존 UI를 그대로 재사용해
// 캐릭터 메뉴 스킬 탭(skillTabFlaskRow, "오른쪽: 기존 플라스크 퀵슬롯 그대로 사용")에도 동일하게 출력함 —
// 같은 state.quickSlots를 보여주는 것뿐이라 여기 목록에 id만 추가하면 다른 코드 수정 없이 그대로 반영됨.
const QUICK_SLOT_ROW_IDS = ['quickSlotRow', 'skillTabFlaskRow', 'huntPanelSkillFlaskRow'];
function renderQuickSlots(){
  if(!Array.isArray(state.quickSlots) || state.quickSlots.length !== QUICK_SLOT_COUNT){
    const prev = Array.isArray(state.quickSlots) ? state.quickSlots : [];
    state.quickSlots = Array.from({ length: QUICK_SLOT_COUNT }, (_, i) => prev[i] || null);
  }
  const html = state.quickSlots.map((itemId, idx) => {
    if(!itemId){
      return `<div class="quickslot-wrap"><button class="quickslot-btn empty" data-action="assign" data-slot="${idx}">+</button></div>`;
    }
    const item = CONSUMABLES[itemId];
    if(!item){
      return `<div class="quickslot-wrap"><button class="quickslot-btn empty" data-action="assign" data-slot="${idx}">+</button></div>`;
    }
    const count = (state.consumables && state.consumables[itemId]) || 0;
    const cooldownLeft = flaskCooldownRemainingSec(itemId);
    const onCooldown = cooldownLeft > 0;
    return `
      <div class="quickslot-wrap">
        <button class="quickslot-btn filled" data-action="use" data-item="${itemId}" ${(count <= 0 || onCooldown) ? 'disabled' : ''} title="${item.name}">
          <span class="quickslot-icon" style="${onCooldown ? 'visibility:hidden;' : ''}">${itemIconHtml(item)}</span>
          <span class="quickslot-count" style="${onCooldown ? 'visibility:hidden;' : ''}">${count}</span>
          <span class="quickslot-cooldown" style="display:${onCooldown ? 'flex' : 'none'};">${cooldownLeft.toFixed(1)}</span>
        </button>
        <button class="quickslot-clear" data-action="clear" data-slot="${idx}" title="슬롯 비우기">×</button>
      </div>`;
  }).join('');
  QUICK_SLOT_ROW_IDS.forEach(id => { const row = el(id); if(row) row.innerHTML = html; });
}

// renderQuickSlots()는 전체 innerHTML을 다시 그리므로 매 프레임 부르기엔 무겁다.
// 쿨타임 초 단위 실시간 표시(2.0→1.9→…→0.1)를 위해, 이미 그려진 버튼의 쿨타임 표시 영역만
// 가볍게 갱신하는 전용 함수. main.js에서 짧은 주기로 반복 호출됨.
function updateQuickSlotCooldowns(){
  QUICK_SLOT_ROW_IDS.forEach(id => {
    const row = el(id);
    if(!row) return;
    row.querySelectorAll('.quickslot-btn.filled').forEach(btn => {
      const itemId = btn.dataset.item;
      const remain = flaskCooldownRemainingSec(itemId);
      const cooldownEl = btn.querySelector('.quickslot-cooldown');
      const iconEl = btn.querySelector('.quickslot-icon');
      const countEl = btn.querySelector('.quickslot-count');
      if(!cooldownEl) return;
      if(remain > 0){
        cooldownEl.textContent = remain.toFixed(1);
        cooldownEl.style.display = 'flex';
        if(iconEl) iconEl.style.visibility = 'hidden';
        if(countEl) countEl.style.visibility = 'hidden';
        btn.disabled = true;
      } else {
        cooldownEl.style.display = 'none';
        if(iconEl) iconEl.style.visibility = '';
        if(countEl) countEl.style.visibility = '';
        const count = (state.consumables && state.consumables[itemId]) || 0;
        btn.disabled = count <= 0;
      }
    });
  });
}

// draft(임시 배분)가 마지막으로 적용된 state.stats와 다른지 여부 — 적용/초기화 버튼 활성화 판단용
function hasStatDraftChanges(){
  if(!draftStats) return false;
  return draftStats.str !== state.stats.str || draftStats.agi !== state.stats.agi || draftStats.int !== state.stats.int
    || draftStatPoints !== state.statPoints;
}
// 이미 적용된 스탯이든 draft에 임시로 찍은 값이든, 되돌릴 게 하나라도 있는지 — 전체 초기화 버튼 활성화 판단용
function hasAnyStatInvestment(){
  const appliedSum = (state.stats.str || 0) + (state.stats.agi || 0) + (state.stats.int || 0);
  const draftSum = draftStats ? (draftStats.str || 0) + (draftStats.agi || 0) + (draftStats.int || 0) : 0;
  return appliedSum > 0 || draftSum > 0;
}

function renderStatAllocRow(key, label, value){
  const canAlloc = (draftStatPoints || 0) > 0;
  const bulkVisible = statAllocActive[key] && (draftStatPoints || 0) >= STAT_POINTS_PER_LEVEL;
  const subVisible = pendingStatPoints(key) >= 1;
  const bonus = artifactStatBonus(key);
  const valueHtml = bonus > 0
    ? `${value + bonus} <span style="color:var(--forge-green);">(+${bonus})</span>`
    : `${value}`;
  return `
    <div class="stat-alloc-row">
      <span class="stat-alloc-label">${label}</span>
      <span class="stat-alloc-value">${valueHtml}</span>
      <div class="stat-alloc-btn-group">
        <button class="stat-alloc-btn" data-stat="${key}" data-stat-action="add" ${canAlloc ? '' : 'disabled'}>+</button>
        ${bulkVisible ? `<button class="stat-alloc-btn wide" data-stat="${key}" data-stat-action="add-bulk">+${STAT_POINTS_PER_LEVEL}</button>` : ''}
        ${subVisible ? `<button class="stat-alloc-btn" data-stat="${key}" data-stat-action="sub">-</button>` : ''}
      </div>
    </div>
  `;
}

// 인벤토리 인스턴스(item)와 종류(type)로부터 "인벤토리 장비 탭과 동일한" 표시 정보를 만듦(수리
// 시스템 요구사항 5·11번 + 강화 장비 선택/수리 장비 선택 팝업 툴팁 요구사항 — 기존 장비 툴팁/이름/등급
// 표시를 그대로 재사용하고 새 툴팁 데이터를 만들지 않기 위한 공용 헬퍼). 아이콘/툴팁을 쓰는 화면이면
// 어디서든(수리 품목 목록, 강화 장비 선택 팝업, 수리 장비 선택 팝업 등) 이 함수 하나로 통일해서 씀.
// equippedItemForSlot과 달리 아이콘 크기를 인벤토리 카드 크기(inv-icon-img)로 맞춰서, 인벤토리 장비
// 탭의 세로 카드와 완전히 동일하게 보이도록 함(장비창 슬롯 아이콘 크기와는 별개).
function equipInstanceDisplayInfo(item, type){
  const level = item.level;
  const color = weaponNameColor(type, level);
  const iconHtml = weaponIconHtml(type, 'inv-icon-img', level);
  const equipType = wpn(type).equipType;
  let tooltipHtml;
  if(equipType === 'armor') tooltipHtml = buildArmorTooltipHtml(type, level, item.damaged, item.currentDurability);
  else if(equipType === 'accessory') tooltipHtml = buildAccessoryTooltipHtml(type, level, item.damaged, item.currentDurability);
  else if(equipType === 'sub') tooltipHtml = buildSubTooltipHtml(type, level, item.damaged, item.currentDurability);
  else tooltipHtml = buildWeaponTooltipHtml(type, level, item.damaged, item.currentDurability);
  return { name: weaponName(type), level, color, iconHtml, tooltipHtml };
}
// 슬롯 키 → 현재 장착 중인 아이템 표시 정보(이름/강화단계/색상/아이콘/툴팁) 조회.
// 무기는 기존 장착 시스템(getEquipped)을 그대로 사용해 조회하고, 아직 실제 장비 데이터가 없는 슬롯
// (투구/갑옷/장신구1/장신구2)은 항상 null을 반환해 빈 슬롯으로 표시됨 — 해당 장비 타입이 실제로 추가되면
// 이 함수에 조회 분기 하나만 추가하면 되고, 장비창을 그리는 나머지 코드는 수정할 필요가 없음.
// 장비창의 각 슬롯(무기/투구/갑옷/장신구1/장신구2)에 대해, 현재 그 슬롯에 장착된 아이템의 표시 정보를
// { name, level, color, iconHtml, tooltipHtml } 형태로 통일해서 반환. 무기는 실제 착용 무기(getEquippedWeapon,
// state.equippedId) 기준, 투구/갑옷은 착용 방어구(state.equippedArmor, state.armorInventory) 기준 —
// 대장간 화면에 무엇이 선택되어 있는지(state.forgeTargetId)와는 무관함.
function equippedItemForSlot(slotKey){
  if(slotKey === 'weapon'){
    const equipped = getEquippedWeapon();
    if(!equipped) return null;
    const type = equipped.type || 'longsword';
    const level = equipped.level;
    return {
      name: weaponName(type), level,
      color: weaponNameColor(type, level),
      iconHtml: weaponIconHtml(type, 'eq-slot-icon-img', level),
      tooltipHtml: buildWeaponTooltipHtml(type, level, undefined, equipped.currentDurability),
    };
  }
  if(slotKey === 'helmet' || slotKey === 'armor'){
    const id = state.equippedArmor && state.equippedArmor[slotKey];
    if(!id) return null;
    const item = (state.armorInventory || []).find(i => i.id === id);
    if(!item) return null;
    const type = item.type;
    const level = item.level;
    return {
      name: weaponName(type), level,
      color: weaponNameColor(type, level),
      iconHtml: weaponIconHtml(type, 'eq-slot-icon-img', level),
      tooltipHtml: buildArmorTooltipHtml(type, level, undefined, item.currentDurability),
    };
  }
  if(slotKey === 'sub'){
    if(state.equippedSubId == null) return null;
    const item = (state.subInventory || []).find(i => i.id === state.equippedSubId);
    if(!item) return null;
    const type = item.type;
    const level = item.level;
    return {
      name: weaponName(type), level,
      color: weaponNameColor(type, level),
      iconHtml: weaponIconHtml(type, 'eq-slot-icon-img', level),
      tooltipHtml: buildSubTooltipHtml(type, level, undefined, item.currentDurability),
    };
  }
  if(slotKey === 'accessory1' || slotKey === 'accessory2'){
    const slotIdx = slotKey === 'accessory1' ? 0 : 1;
    const id = Array.isArray(state.equippedAccessories) ? state.equippedAccessories[slotIdx] : null;
    if(!id) return null;
    const item = (state.accessoryInventory || []).find(i => i.id === id);
    if(!item) return null;
    const type = item.type;
    const level = item.level;
    return {
      name: weaponName(type), level,
      color: weaponNameColor(type, level),
      iconHtml: weaponIconHtml(type, 'eq-slot-icon-img', level),
      tooltipHtml: buildAccessoryTooltipHtml(type, level, undefined, item.currentDurability),
    };
  }
  return null;
}
function equipSlotHtml(slot){
  const item = equippedItemForSlot(slot.key);
  if(!item){
    return `<div class="eq-slot ${slot.cellClass}" data-slot="${slot.key}"><span class="eq-slot-empty-label">${slot.label}</span></div>`;
  }
  return `<div class="eq-slot filled ${slot.cellClass}" data-slot="${slot.key}">${item.iconHtml}<span class="tooltip">${item.tooltipHtml}</span></div>`;
}
// 아티팩트 슬롯 — 현재 최대 슬롯 수(ARTIFACT_SLOT_MAX)만큼 자동 생성되므로, 이 숫자가 바뀌면
// 장비창의 아티팩트 칸 개수도 코드 수정 없이 그대로 함께 바뀜(단, 상단 가로 배치 그리드 영역
// area-art1/2/3은 3칸을 전제로 한 이름이라, ARTIFACT_SLOT_MAX가 3이 아니게 되면 CSS 그리드 영역도
// 함께 손봐야 함 — 현재는 정확히 3이라 별도 처리 없이 그대로 사용).
function equipArtifactSlotsHtml(){
  return Array.from({ length: ARTIFACT_SLOT_MAX }, (_, i) => {
    const cellClass = `area-art${i + 1}`;
    const id = state.equippedArtifacts[i];
    if(!id) return `<div class="eq-slot eq-slot-artifact ${cellClass}"><span class="eq-slot-empty-label">아티팩트</span></div>`;
    const a = ARTIFACTS[id];
    return `<div class="eq-slot eq-slot-artifact ${cellClass} filled">${itemIconHtml(a)}<span class="tooltip">${buildArtifactTooltipHtml(id)}</span></div>`;
  }).join('');
}
// 장비창 아래 "장착 아이템 정보" — 현재 장착 중인 장비만 한 줄씩 출력(EQUIPMENT_SLOTS 기반이라
// 새 장비 타입이 추가돼도 자동으로 반영됨). 무기(및 향후 강화 가능한 장비)는 이름+강화 단계를,
// 아티팩트는 강화 개념이 없으므로 이름만 출력함.
function equippedItemInfoLinesHtml(){
  const lines = [];
  EQUIPMENT_SLOTS.forEach(slot => {
    const item = equippedItemForSlot(slot.key);
    if(item) lines.push(`<div class="char-equip-info-line" style="color:${item.color};">${item.name}${levelSuffix(item.level)}</div>`);
  });
  state.equippedArtifacts.forEach(id => {
    const a = ARTIFACTS[id];
    lines.push(`<div class="char-equip-info-line" style="color:${artifactNameColor(id)};">${itemIconHtml(a)} ${a.name}</div>`);
  });
  return lines.length > 0 ? lines.join('') : `<div class="char-stat-empty">장착 중인 장비가 없습니다.</div>`;
}
// 좌측 "장비창" 전체(슬롯 그리드 + 장착 아이템 정보 목록) HTML 조립. 요청된 새 레이아웃(문서 5번):
//   [아티팩트][아티팩트][아티팩트]  (기존보다 30% 작은 크기)
//         [투구]
//   [무기]  [갑옷]   [보조]
//       [장신구][장신구]
// 아티팩트가 더 이상 별도 세로 칸(equip-artifact-col)이 아니라 최상단 가로 3칸으로 합쳐져서, 슬롯
// 그리드 하나(equip-slots-grid)에 전부 포함됨(CSS 그리드 영역만 이 구조에 맞게 재정의 — style.css 참고).
// includeInfo=false면 "장착 아이템 정보" 목록(구분선 포함)을 생략하고 슬롯 그리드만 반환함 —
// 던전 전투 화면(renderHunt)에서만 이 목록을 표시하지 않기 위한 옵션이며, 기존 호출부(캐릭터 정보창,
// 캐릭터 메뉴)는 인자를 넘기지 않으므로 기본값(true)으로 기존과 완전히 동일하게 동작함.
function buildEquipPanelHtml(includeInfo){
  if(includeInfo === undefined) includeInfo = true;
  const byKey = key => EQUIPMENT_SLOTS.find(s => s.key === key);
  const gridHtml = equipArtifactSlotsHtml()
    + equipSlotHtml(byKey('helmet'))
    + equipSlotHtml(byKey('weapon')) + equipSlotHtml(byKey('armor')) + equipSlotHtml(byKey('sub'))
    + `<div class="eq-slot-accessories area-accessories">${equipSlotHtml(byKey('accessory1'))}${equipSlotHtml(byKey('accessory2'))}</div>`;
  const panelHtml = `
    <div class="equip-panel">
      <div class="equip-slots-grid">${gridHtml}</div>
    </div>`;
  if(!includeInfo) return panelHtml;
  return panelHtml + `
    <div class="char-stat-divider"></div>
    <div class="char-stat-sub-title">장착 아이템 정보</div>
    <div class="equipped-item-info">${equippedItemInfoLinesHtml()}</div>
  `;
}

// ---- 수리 탭(요구사항 1~2번) ----
// 장비창(buildEquipPanelHtml)을 그대로 재사용해 배치하고("모두 수리" 버튼/안내 문구는 index.html에
// 이미 고정 배치됨), "모두 수리" 버튼은 수리할 대상이 하나도 없으면 비활성화함(요구사항 1번 마지막
// 문장 — 기존 코드베이스 전반의 "지금 할 수 없는 행동은 버튼을 비활성화" 관례를 그대로 따름).
function renderRepairTab(){
  el('repairEquipPanel').innerHTML = buildEquipPanelHtml(true);
  el('repairAllBtn').disabled = repairAllTargetList().length === 0;
}
// ---- 수리 탭: 개별 수리 팝업(요구사항 9~18번) ----
function renderRepairIndividualModal(){
  if(!repairIndividualPopup) return;
  const found = resolveRepairTarget(repairIndividualPopup);
  if(!found){ closeRepairIndividualPopup(); return; } // 팝업이 열려있는 사이 대상 장비가 사라진 예외 상황 방어
  const { item, type } = found;
  const display = equipInstanceDisplayInfo(item, type);
  const max = maxDurabilityFor(type);
  const cur = item.currentDurability != null ? item.currentDurability : max;
  const pct = durabilityPercent(cur, max);
  const costPerPoint = repairCostPerPointFor(type);
  const amount = repairIndividualPopup.amount;
  const cost = repairCostForAmount(type, amount);

  el('repairIndivIconBox').innerHTML = display.iconHtml;
  el('repairIndivIconBox').style.borderColor = display.color;
  el('repairIndivNameWrap').innerHTML =
    `<span class="inv-name" style="color:${display.color};">${display.name}${levelSuffix(display.level)}</span>` +
    `<span class="tooltip">${display.tooltipHtml}</span>`;
  el('repairIndivDurabilityLine').textContent = `내구도 ${cur}/${max} (${pct}%)`;
  el('repairIndivCostPerPointLine').innerHTML =
    `수리 비용 : 내구도 1당 <span class="repair-cost-per-point-value">${costPerPoint.toLocaleString()}골드</span>`;
  el('repairIndivAmountInput').max = repairAmountToFull(item);
  el('repairIndivAmountInput').value = amount;
  el('repairIndivGold').textContent = '🪙 ' + state.gold.toLocaleString();
  el('repairIndivCost').textContent = '🪙 ' + cost.toLocaleString();
  el('repairIndivConfirmBtn').disabled = amount <= 0 || state.gold < cost;
}
// ---- 수리 탭: 모두 수리 팝업(요구사항 3~8번) ----
// 수리 품목 목록은 인벤토리 장비 탭의 세로 카드(.inv-card)를 그대로 재사용 — 품목 개수만큼만
// 자연스럽게 늘어나고(요구사항 4번 "영역 유동적 구성"), 아이템 툴팁도 기존 툴팁 함수를 그대로 씀.
function renderRepairAllList(targets){
  if(targets.length === 0) return `<div class="inv-empty">수리가 필요한 장비가 없습니다.</div>`;
  return targets.map(entry => {
    const display = equipInstanceDisplayInfo(entry.item, entry.type);
    const max = maxDurabilityFor(entry.type);
    const cur = entry.item.currentDurability != null ? entry.item.currentDurability : max;
    const pct = durabilityPercent(cur, max);
    return `
      <div class="inv-card">
        <div class="inv-icon" style="border-color:${display.color};">${display.iconHtml}</div>
        <div class="inv-info">
          <span class="weapon-name-wrap">
            <span class="inv-name" style="color:${display.color};">${display.name}${levelSuffix(display.level)}</span>
            <span class="tooltip">${display.tooltipHtml}</span>
          </span>
          <div class="inv-sub">내구도 ${cur}/${max} (${pct}%)</div>
        </div>
        <div class="inv-actions">
          <span class="txt-gold">🪙 ${entry.cost.toLocaleString()}</span>
        </div>
      </div>`;
  }).join('');
}
function renderRepairAllModal(){
  if(!repairAllPopupOpen) return;
  const targets = repairAllTargetList();
  const totalCost = repairAllTotalCost(targets);
  el('repairAllList').innerHTML = renderRepairAllList(targets);
  el('repairAllGold').textContent = '🪙 ' + state.gold.toLocaleString();
  el('repairAllCost').textContent = '🪙 ' + totalCost.toLocaleString();
  el('repairAllConfirmBtn').disabled = targets.length === 0 || state.gold < totalCost;
}
// ---- 수리 탭: "인벤토리에서 선택" 팝업(요구사항 5~11·18~19번) ----
// 대장간 renderForgeSelectList()와 완전히 동일한 구조(페이지 시스템·목록 스타일·아이콘·이름 표시 재사용,
// 요구사항 5·9·23번) — 후보 목록만 repairSelectableInventoryItems()(장착 여부 무관, formulas.js)로
// 교체하고, 클릭 시 selectForgeTarget 대신 selectRepairFromInventory를 호출함. 장착 중 표시는 기존
// 인벤토리 탭의 [장착 중] 배지(.inv-badge)를 그대로 재사용(요구사항 7번).
function renderRepairSelectList(){
  const wrap = el('repairSelectList');
  if(!wrap) return;
  const pagerWrap = el('repairSelectPager');
  const entries = repairSelectableInventoryItems();
  if(entries.length === 0){
    wrap.innerHTML = `<div class="inv-empty">수리 가능한 장비가 없습니다.</div>`; // 요구사항 19번
    if(pagerWrap) pagerWrap.innerHTML = '';
    return;
  }
  const pageSize = PAGE_SIZE.repairSelect;
  const totalPageCount = pageCount(entries.length, pageSize);
  pageState.repairSelect = clampPage(pageState.repairSelect, totalPageCount);
  if(pagerWrap) pagerWrap.innerHTML = pagerHtml('repairSelect', pageState.repairSelect, totalPageCount);
  const pageEntries = pageSlice(entries, pageState.repairSelect, pageSize);
  wrap.innerHTML = `<div class="forge-select-list">${pageEntries.map(entry => {
    const itemColor = weaponNameColor(entry.type, entry.level);
    const display = equipInstanceDisplayInfo(entry.item, entry.type); // 아이콘 hover 시 기존 장비 툴팁(요구사항 10번)
    return `
      <button class="forge-select-item" data-action="select-repair-target" data-kind="${entry.kind}" data-id="${entry.id}">
        <span class="inv-icon weapon-name-wrap" style="border-color:${itemColor};">${weaponIconHtml(entry.type, 'inv-icon-img', entry.level)}<span class="tooltip">${display.tooltipHtml}</span></span>
        <span class="forge-select-info">
          <span class="forge-select-name" style="color:${itemColor};">${weaponName(entry.type)}${levelSuffix(entry.level)}</span>
          ${entry.worn ? '<span class="inv-badge">장착 중</span>' : ''}
        </span>
      </button>`;
  }).join('')}</div>`;
}
// ---- 수리 탭: 최종 확인 UI(요구사항 19~21번) ----
function renderRepairConfirmModal(){
  if(!repairConfirmState) return;
  el('repairConfirmCost').textContent = repairConfirmState.totalCost.toLocaleString();
  el('repairConfirmProceedBtn').disabled = state.gold < repairConfirmState.totalCost;
}

// 캐릭터 정보 모달 — 인벤토리와 동일한 페이지네이션 시스템(pageState/pagerHtml/goPage)을 그대로 재사용해
// 1페이지(장비창+캐릭터 정보) / 2페이지(적용 중인 아티팩트 효과)를 전환함.
function renderCharStats(){
  ensurePlayerVitals();
  // 모바일 UI 개편 2단계(수정판): 데스크톱 전용 renderCharacterMenu()가 아니라 대장간 [캐릭터 정보]
  // 팝업(#charStatsModal) 쪽에 모바일 분기를 둠 — 상단/마을 "캐릭터" 메뉴(renderCharacterMenu)와 던전
  // 우측 패널(renderHuntSidePanel)은 이 변경과 완전히 무관하게 기존 그대로 동작한다.
  const isMobile = !!(state.settings && state.settings.screenPreset === 'mobile');
  const totalPages = isMobile ? CHAR_STATS_MOBILE_PAGE_COUNT : CHAR_STATS_PAGE_COUNT;
  pageState.charStats = clampPage(pageState.charStats, totalPages);
  const pagerWrap = el('charStatsPager');
  if(pagerWrap) pagerWrap.innerHTML = pagerHtml('charStats', pageState.charStats, totalPages);

  if(isMobile){
    // 던전 우측 카드([캐릭터 정보])와 완전히 같은 콘텐츠 빌더를 그대로 재사용(buildEquipPanelHtml/
    // buildCharLevelStatsHtml/buildCombatStatsHtml) — HTML을 새로 복사하지 않음. 장착 아이템 상세
    // 정보·아티팩트 정보는 던전 우측 패널과 동일하게 1페이지에서 제외함(buildEquipPanelHtml(false)).
    const page = pageState.charStats;
    el('charStatsBody').innerHTML = page === 1 ? buildEquipPanelHtml(false)
      : page === 2 ? buildCharLevelStatsHtml()
      : buildCombatStatsHtml();
    return;
  }

  if(pageState.charStats === 2){
    renderCharStatsPage2();
  } else {
    renderCharStatsPage1();
  }
}
// 캐릭터 정보(레벨/체력/마나/경험치 → 스탯 배분 → 전투 능력치) HTML 조립. 캐릭터 정보 모달(1페이지 우측)과
// 캐릭터 메뉴(신규, "캐릭터 정보" 탭 1페이지)가 이 함수를 그대로 공유해서 쓰므로, 기능/데이터가 항상 동일함.
// 캐릭터 정보 중 "레벨~스탯 배분" 구간만(요구사항: 던전 우측 카드 2페이지). 캐릭터 레벨/체력/마나/
// 경험치 + 스탯 포인트 배분 UI까지 — buildCharStatsInfoHtml()의 앞부분을 그대로 뺀 것.
function buildCharLevelStatsHtml(){
  const lv = state.playerLevel;
  const maxHp = effectiveMaxHp(lv);
  const maxMp = effectiveMaxMp(lv);
  const hp = Math.min(state.playerHp, maxHp);
  const mp = Math.min(state.playerMp, maxMp);
  const expReq = lv >= PLAYER_MAX_LEVEL ? 0 : requiredExp(lv);
  const expPct = lv >= PLAYER_MAX_LEVEL ? 100 : Math.min(100, Math.round(state.playerExp / expReq * 1000) / 10);

  return `
    <div class="char-stat-row big"><span>캐릭터 레벨</span><span class="v">Lv.${lv}</span></div>
    <div class="player-bar-label">체력 <span>${hp.toLocaleString()} / ${maxHp.toLocaleString()}</span></div>
    <div class="player-bar-wrap"><div class="player-bar-fill hp" style="width:${(hp/maxHp*100)}%;"></div></div>
    <div class="player-bar-label">마나 <span>${mp.toLocaleString()} / ${maxMp.toLocaleString()}</span></div>
    <div class="player-bar-wrap"><div class="player-bar-fill mp" style="width:${(mp/maxMp*100)}%;"></div></div>
    <div class="player-bar-label">경험치 <span>${lv >= PLAYER_MAX_LEVEL ? 'MAX' : expPct.toFixed(1) + '%'}</span></div>
    <div class="player-bar-wrap"><div class="player-bar-fill exp" style="width:${expPct}%;"></div></div>
    <div class="char-stat-divider"></div>
    <div class="char-stat-row"><span>사용 가능 포인트</span><span class="v" style="color:var(--forge-gold);">${draftStatPoints || 0}</span></div>
    ${renderStatAllocRow('str', '힘', (draftStats || state.stats).str)}
    ${renderStatAllocRow('agi', '민첩', (draftStats || state.stats).agi)}
    ${renderStatAllocRow('int', '지능', (draftStats || state.stats).int)}
    <div class="stat-alloc-actions">
      <button class="nav-btn" data-action="reset-stats-full" ${hasAnyStatInvestment() ? '' : 'disabled'}>전체 초기화</button>
      <div class="stat-alloc-actions-right">
        <button class="nav-btn" data-action="reset-stats" ${hasStatDraftChanges() ? '' : 'disabled'}>초기화</button>
        <button class="btn btn-main" data-action="apply-stats" style="width:auto; padding:8px 16px;" ${hasStatDraftChanges() ? '' : 'disabled'}>적용</button>
      </div>
    </div>
    <div class="char-stat-divider"></div>
  `;
}
// 캐릭터 정보 중 "전투 능력치" 구간만(요구사항: 던전 우측 카드 3페이지). 장착 무기/총 공격력~치명타 +
// 총 방어도~장신구 요약까지 — buildCharStatsInfoHtml()의 뒷부분을 그대로 뺀 것.
function buildCombatStatsHtml(){
  const equipped = getEquippedWeapon();
  let html = '';

  if(!equipped){
    html += `<div class="char-stat-empty">장착한 무기가 없습니다.</div>`;
  } else {
    const type = equipped.type || 'longsword';
    const level = equipped.level;
    const durabilityZero = isEquipDurabilityZero(equipped);
    const totalAtk = effectiveAtk(type, level, equipped.damaged, durabilityZero);
    const baseSpeed = atkSpeedFor(type, level);
    const totalSpeed = effectiveAtkSpeed(type, level, durabilityZero);
    const totalCrit = effectiveCritChance(type, level, durabilityZero);
    const hasSpeedBonus = isArtifactEquipped('batwing');

    html += `
      <div class="char-stat-row"><span>장착 무기</span><span class="v">${weaponName(type)}${equipped.damaged ? '(손상)' : ''}${levelSuffix(level)}</span></div>
      <div class="char-stat-divider"></div>
      <div class="char-stat-row big"><span>총 공격력</span><span class="v">${totalAtk}</span></div>
      <div class="char-stat-row big"><span>공격속도</span><span class="v">${totalSpeed.toFixed(2)}회/초</span></div>
      <div class="char-stat-row big"><span>치명타 확률</span><span class="v">${totalCrit}%</span></div>
    `;
    if(hasSpeedBonus){
      html += `<div class="char-stat-note">공격속도 = 무기 기본 ${baseSpeed.toFixed(2)} + 박쥐 날개 5%</div>`;
    }
  }

  // 착용 중인 방어구(투구/갑옷)+보조+장신구(반지 등) 요약 — 아무것도 착용하지 않았으면 이 블록 자체를 표시하지 않음.
  const wornHelmet = state.equippedArmor && state.equippedArmor.helmet
    ? (state.armorInventory || []).find(i => i.id === state.equippedArmor.helmet) : null;
  const wornBody = state.equippedArmor && state.equippedArmor.armor
    ? (state.armorInventory || []).find(i => i.id === state.equippedArmor.armor) : null;
  const wornSub = wornSubItems()[0] || null;
  const wornAccessories = wornAccessoryItems();
  if(wornHelmet || wornBody || wornSub || wornAccessories.length > 0){
    html += `<div class="char-stat-divider"></div>`;
    html += `<div class="char-stat-row big"><span>총 방어도</span><span class="v">${playerTotalDefense()}</span></div>`;
    if(wornHelmet) html += `<div class="char-stat-row"><span>투구</span><span class="v">${ARMOR_TYPES[wornHelmet.type].name}${levelSuffix(wornHelmet.level)}</span></div>`;
    if(wornBody) html += `<div class="char-stat-row"><span>갑옷</span><span class="v">${ARMOR_TYPES[wornBody.type].name}${levelSuffix(wornBody.level)}</span></div>`;
    if(wornSub) html += `<div class="char-stat-row"><span>보조</span><span class="v">${SUB_TYPES[wornSub.type].name}${levelSuffix(wornSub.level)}</span></div>`;
    wornAccessories.forEach(acc => {
      const accDef = ACCESSORY_TYPES[acc.type];
      html += `<div class="char-stat-row"><span>${accDef ? ACCESSORY_KINDS[accDef.accessoryKind] || '장신구' : '장신구'}</span><span class="v">${accDef ? accDef.name : acc.type}${levelSuffix(acc.level)}</span></div>`;
    });
  }

  return html;
}
// 캐릭터 정보 모달/캐릭터 메뉴 1페이지가 쓰는 공용 함수 — 위 두 함수를 그대로 이어붙인 것과 완전히
// 동일한 결과를 냄(기존 호출부는 전혀 수정하지 않아도 됨).
function buildCharStatsInfoHtml(){
  return buildCharLevelStatsHtml() + buildCombatStatsHtml();
}
// 1페이지 — 좌: 장비창, 우: 캐릭터 정보(buildCharStatsInfoHtml 공용 함수).
function renderCharStatsPage1(){
  const body = el('charStatsBody');
  body.innerHTML = `
    <div class="char-stats-page1">
      <div class="char-stats-left">${buildEquipPanelHtml()}</div>
      <div class="char-stats-right">${buildCharStatsInfoHtml()}</div>
    </div>
  `;
}
// "적용 중인 아티팩트 효과" HTML 조립. 기존에는 무기가 장착돼 있을 때만 표시되던 블록이라 그 조건은 그대로
// 유지하고(무기 미장착 시 동일한 안내 문구), 장착 아티팩트가 0개일 때만 기존에는 아무것도 출력되지 않았던 것을
// 빈 페이지로 보이지 않도록 동일한 안내 문구 스타일로 보완함. 캐릭터 정보 모달 2페이지와 캐릭터 메뉴 3페이지가 공유.
function buildArtifactEffectsHtml(){
  const equipped = getEquippedWeapon();
  if(!equipped){
    return `<div class="char-stat-empty">장착한 무기가 없습니다.</div>`;
  }
  if(state.equippedArtifacts.length === 0){
    return `<div class="char-stat-empty">적용 중인 아티팩트가 없습니다.</div>`;
  }
  let html = `<div class="char-stat-sub-title">적용 중인 아티팩트 효과</div>`;
  html += state.equippedArtifacts.map(id => {
    const a = ARTIFACTS[id];
    return `<div class="char-stat-artifact"><b style="color:${artifactNameColor(id)};">${itemIconHtml(a)} ${a.name}</b><br>${resolveGlossaryTermsHtml(a.effectText)}</div>`;
  }).join('');
  return html;
}
// 2페이지 — 기존 "적용 중인 아티팩트 효과" 화면 그대로(buildArtifactEffectsHtml 공용 함수).
function renderCharStatsPage2(){
  el('charStatsBody').innerHTML = buildArtifactEffectsHtml();
}

// ---- 캐릭터 메뉴(좌측 상단바 "캐릭터") ----
// CHARACTER_TABS(data.js)를 그대로 순회해 탭 버튼을 그리므로, 새 탭이 추가돼도 이 함수는 수정할 필요 없음
// (설정 화면 renderSettings와 동일한 방식). "info"(캐릭터 정보)와 "skill"(스킬)만 실제 내용이 있고,
// 그 외 탭이 추가되면 기본적으로 빈 화면만 출력함.
function renderCharacterMenu(){
  const tabsRow = el('charTabsRow');
  const panelsWrap = el('charTabPanels');
  if(!tabsRow || !panelsWrap) return;

  tabsRow.innerHTML = CHARACTER_TABS.map(t =>
    `<button class="inv-tab-btn${t.id === activeCharTab ? ' active' : ''}" data-char-tab="${t.id}">${t.label}</button>`
  ).join('');

  const tab = CHARACTER_TABS.find(t => t.id === activeCharTab) || CHARACTER_TABS[0];
  if(!tab){ panelsWrap.innerHTML = ''; return; }

  if(tab.id === 'skill'){
    panelsWrap.innerHTML = buildSkillTabHtml();
    renderSkillQuickSlots();
    renderQuickSlots(); // 스킬 탭에 새로 생긴 skillTabFlaskRow도 함께 채움
    return;
  }

  if(tab.id !== 'info'){
    // 아직 콘텐츠가 없는 탭 — 탭 이름만 표시되고 화면은 비워둠.
    panelsWrap.innerHTML = `<div class="inv-tab-panel"></div>`;
    return;
  }

  // "캐릭터 정보" 탭 — 캐릭터 정보 모달과 동일한 데이터를 쓰되, 화면 폭이 좁아 1페이지(캐릭터 정보) /
  // 2페이지(장비창) / 3페이지(아티팩트 효과)로 완전히 분리함(모달은 1페이지에 장비창+캐릭터 정보를 좌우 배치).
  ensurePlayerVitals();
  pageState.charMenuInfo = clampPage(pageState.charMenuInfo, CHAR_MENU_INFO_PAGE_COUNT);
  const page = pageState.charMenuInfo;
  const pageBodyHtml = page === 2 ? buildEquipPanelHtml()
    : page === 3 ? buildArtifactEffectsHtml()
    : buildCharStatsInfoHtml();

  panelsWrap.innerHTML = `
    <div class="inv-tab-panel">
      <div class="char-menu-info-head">${pagerHtml('charMenuInfo', page, CHAR_MENU_INFO_PAGE_COUNT)}</div>
      <div>${pageBodyHtml}</div>
    </div>
  `;
}

// 스킬 퀵슬롯 섹션(퀵슬롯 5칸+플라스크 퀵슬롯+초기화 버튼)만 따로 뺀 것 — 요구사항: 던전 우측 카드
// 스킬 탭 1페이지("퀵슬롯 설정 ~ 초기화 버튼"). rowId/flaskRowId를 인자로 받는 이유는 캐릭터 메뉴
// 스킬 탭과 던전 우측 카드 두 곳에서 동시에 이 섹션을 쓰기 때문(같은 id를 중복 사용할 수 없어 각자
// 다른 id를 넘겨 받음) — renderSkillQuickSlots()/renderQuickSlots()가 두 id를 모두 채워줌.
function buildSkillQuickSlotSectionHtml(quickSlotRowId, flaskRowId){
  return `
    <div class="skill-quickslot-row">
      <div class="quickslot-row skill-quickslot-grid" id="${quickSlotRowId}"></div>
      <div class="quickslot-row" id="${flaskRowId}"></div>
      <button class="nav-btn" data-action="reset-skill-quickslots">초기화</button>
    </div>
  `;
}
// 스킬 분류 탭(공용/특화/기연)+페이지 이동+스킬 목록만 따로 뺀 것 — 요구사항: 던전 우측 카드 스킬 탭
// 2페이지("공용/특화/기연 ~ 스킬 목록").
function buildSkillListSectionHtml(){
  const catTabsHtml = SKILL_CATEGORIES.map(c =>
    `<button class="inv-tab-btn${c.id === activeSkillCategory ? ' active' : ''}" data-skill-cat="${c.id}">${c.label}</button>`
  ).join('');
  const page = clampPage(pageState.skillPage, SKILL_PAGES.length);
  pageState.skillPage = page;
  return `
    <div class="inv-tabs">${catTabsHtml}</div>
    <div class="skill-menu-info-head">
      <button class="nav-btn skill-reset-btn" data-action="reset-skills" title="스킬 초기화">⟲</button>
      ${pagerHtml('skillPage', page, SKILL_PAGES.length)}
    </div>
    ${buildSkillCategoryBodyHtml(activeSkillCategory)}
  `;
}
// ---- 스킬 탭 ----
// 상단: 스킬 퀵슬롯(5칸) + 기존 플라스크 퀵슬롯 + 초기화 버튼 → 하위 탭(공용/특화/기연, SKILL_CATEGORIES
// 기반) → 페이지 이동 → 하위 탭별 본문(buildSkillCategoryBodyHtml). 하위 탭 버튼도 인벤토리와 동일한
// inv-tabs 클래스를 그대로 사용함(요구사항: "탭 UI는 현재 인벤토리에서 사용하는 탭 구조를 그대로 사용").
// 위 두 섹션 빌더를 그대로 이어붙인 것과 완전히 동일한 결과(기존 호출부는 전혀 수정하지 않아도 됨).
function buildSkillTabHtml(){
  return `
    <div class="inv-tab-panel">
      ${buildSkillQuickSlotSectionHtml('skillTabQuickSlotRow', 'skillTabFlaskRow')}
      ${buildSkillListSectionHtml()}
    </div>
  `;
}
// 스킬 퀵슬롯(왼쪽 5칸) HTML. showRemove가 false면 X(제거) 버튼을 숨김(요구사항: "던전에서는 X 버튼을
// 표시하지 않습니다"). 아이콘 아래에 등급 색상으로 스킬 이름을 표시하고(요구사항 6번 "퀵슬롯 UI"), 사용
// 가능 여부(canUseSkillNow: 사냥 중 + 쿨타임 아님 + 자원 충분)에 따라 버튼을 비활성화함.
function buildSkillQuickSlotsHtml(showRemove){
  return state.skillQuickSlots.map((skillId, idx) => {
    const s = skillId ? SKILLS[skillId] : null;
    if(!s){
      return `<div class="quickslot-wrap skill-quickslot-wrap"><button class="quickslot-btn empty" data-action="assign-skill" data-slot="${idx}">+</button></div>`;
    }
    const grade = WEAPON_GRADES[s.grade];
    const remain = skillCooldownRemainingSec(skillId);
    const onCooldown = remain > 0;
    const usable = canUseSkillNow(skillId);
    return `
      <div class="quickslot-wrap skill-quickslot-wrap">
        <button class="quickslot-btn filled" data-action="use-skill" data-item="${skillId}" ${usable ? '' : 'disabled'} title="${s.name}">
          <span class="quickslot-icon" style="${onCooldown ? 'visibility:hidden;' : ''}">${skillIconHtml(s)}</span>
          <span class="quickslot-cooldown" style="display:${onCooldown ? 'flex' : 'none'};">${remain.toFixed(1)}</span>
        </button>
        <div class="skill-quickslot-name" style="color:${grade ? grade.color : '#fff'};">${s.name}</div>
        ${showRemove ? `<button class="quickslot-clear" data-action="clear-skill" data-slot="${idx}" title="슬롯 비우기">×</button>` : ''}
      </div>`;
  }).join('');
}
// 스킬 퀵슬롯이 표시되는 두 위치(캐릭터 메뉴 스킬 탭 / 던전 사냥 화면)를 한 번에 갱신.
function renderSkillQuickSlots(){
  if(!Array.isArray(state.skillQuickSlots) || state.skillQuickSlots.length !== SKILL_QUICK_SLOT_COUNT){
    const prev = Array.isArray(state.skillQuickSlots) ? state.skillQuickSlots : [];
    state.skillQuickSlots = Array.from({ length: SKILL_QUICK_SLOT_COUNT }, (_, i) => prev[i] || null);
  }
  const skillTabRow = el('skillTabQuickSlotRow');
  if(skillTabRow) skillTabRow.innerHTML = buildSkillQuickSlotsHtml(true);
  const huntRow = el('huntSkillQuickSlotRow');
  if(huntRow) huntRow.innerHTML = buildSkillQuickSlotsHtml(false);
  // 던전 우측 카드 스킬 탭 1페이지의 퀵슬롯 섹션(설정 가능 — showRemove:true, 캐릭터 메뉴와 동일).
  // 해당 페이지가 열려 있을 때만 실제로 DOM에 존재하므로, 없으면 조용히 무시함(다른 두 위치와 동일 패턴).
  const huntPanelRow = el('huntPanelSkillQuickSlotRow');
  if(huntPanelRow) huntPanelRow.innerHTML = buildSkillQuickSlotsHtml(true);
}
// 스킬 퀵슬롯이 표시되는 모든 위치 — 쿨타임 실시간 표시를 가볍게 갱신할 때 순회 대상(플라스크의
// QUICK_SLOT_ROW_IDS와 동일한 패턴).
const SKILL_QUICK_SLOT_ROW_IDS = ['skillTabQuickSlotRow', 'huntSkillQuickSlotRow', 'huntPanelSkillQuickSlotRow'];
// updateQuickSlotCooldowns(플라스크용)와 동일한 목적의 가벼운 갱신 — 매번 전체를 다시 그리지 않고
// 쿨타임 표시/비활성화 상태만 갱신함. main.js에서 짧은 주기로 반복 호출됨.
function updateSkillQuickSlotCooldowns(){
  SKILL_QUICK_SLOT_ROW_IDS.forEach(id => {
    const row = el(id);
    if(!row) return;
    row.querySelectorAll('.quickslot-btn.filled').forEach(btn => {
      const skillId = btn.dataset.item;
      const remain = skillCooldownRemainingSec(skillId);
      const cooldownEl = btn.querySelector('.quickslot-cooldown');
      const iconEl = btn.querySelector('.quickslot-icon');
      if(!cooldownEl) return;
      if(remain > 0){
        cooldownEl.textContent = remain.toFixed(1);
        cooldownEl.style.display = 'flex';
        if(iconEl) iconEl.style.visibility = 'hidden';
        btn.disabled = true;
      } else {
        cooldownEl.style.display = 'none';
        if(iconEl) iconEl.style.visibility = '';
        btn.disabled = !canUseSkillNow(skillId);
      }
    });
  });
}
// 하위 탭(공용/특화/기연) 한 개의 본문: 미사용 포인트 표시 + 세로 탭(공격/버프/패시브, 요구사항 1번) +
// 레벨별 스킬 목록(현재 페이지 구간, 선택된 세로 탭 기준).
function buildSkillCategoryBodyHtml(categoryId){
  const isAwakening = categoryId === 'awakening';
  const pointsLabel = isAwakening ? '미사용 깨달음' : '미사용 스킬 포인트';
  const pointsValue = isAwakening ? (state.awakeningPoints || 0) : (state.skillPoints || 0);
  const kindTabsHtml = SKILL_KIND_TABS.map(k =>
    `<button class="skill-kind-tab-btn${k.id === activeSkillKind ? ' active' : ''}" data-skill-kind="${k.id}">${k.label}</button>`
  ).join('');
  return `
    <div class="skill-points-row"><span>${pointsLabel}</span><span class="v">${pointsValue}</span></div>
    <div class="skill-kind-layout">
      <div class="skill-kind-tabs">${kindTabsHtml}</div>
      ${buildSkillTreeHtml(categoryId, activeSkillKind)}
    </div>
  `;
}
// 스킬 트리 렌더: buildSkillTreeLayout(formulas.js)이 계산한 열(레벨)·행(체인 세로줄) 좌표를 그대로
// px 좌표로 옮겨서, 레벨 라벨 줄(상단, 가로) + 스킬 아이콘들(절대좌표) + 선행→후속 연결선(가로 막대 div)을
// 그림. 아이콘 자체는 buildSkillIconBtnHtml을 그대로 재사용하므로 아이콘/등급색/툴팁/습득·잠금 표시는
// 완전히 기존 그대로이고(요구사항 4번), 여기서 바뀌는 건 그 아이콘을 배치하는 좌표뿐임.
const SKILL_TREE_COL_W = 56, SKILL_TREE_ROW_H = 62, SKILL_TREE_ICON = 34, SKILL_TREE_NODE_W = 52;
function buildSkillTreeHtml(categoryId, kindId){
  const layout = buildSkillTreeLayout(categoryId, pageState.skillPage, kindId);
  if(!layout.columns.length){
    return `<div class="char-stat-empty">표시할 레벨이 없습니다.</div>`;
  }
  const center = SKILL_TREE_ICON / 2;
  // 노드(아이콘+이름표)가 아이콘보다 넓어서(이름표가 더 넓을 수 있음) 맨 왼쪽 노드가 컨테이너 밖으로
  // 잘리지 않도록, 전체 좌표를 이 여백만큼 오른쪽으로 밀어줌(레벨 라벨/연결선/노드 전부 동일하게 적용해야
  // 서로 어긋나지 않음).
  const padX = (SKILL_TREE_NODE_W - SKILL_TREE_ICON) / 2;
  const iconCenterX = (col) => padX + col * SKILL_TREE_COL_W + center;
  const labelsHtml = layout.columns.map((lv, i) =>
    `<span class="skill-tree-level-label" style="left:${iconCenterX(i)}px;">LV${lv}</span>`
  ).join('');
  const linesHtml = layout.connections.map(c => {
    const fromX = padX + c.fromCol * SKILL_TREE_COL_W + SKILL_TREE_ICON;
    const toX = padX + c.toCol * SKILL_TREE_COL_W;
    const y = c.row * SKILL_TREE_ROW_H + center - 1;
    return `<div class="skill-tree-line" style="left:${fromX}px; top:${y}px; width:${Math.max(0, toX - fromX)}px;"></div>`;
  }).join('');
  const nodesHtml = layout.items.map(it =>
    `<div class="skill-tree-node" style="left:${iconCenterX(it.col) - SKILL_TREE_NODE_W / 2}px; top:${it.row * SKILL_TREE_ROW_H}px; width:${SKILL_TREE_NODE_W}px;">${buildSkillIconBtnHtml(it.id)}</div>`
  ).join('');
  const treeWidth = padX * 2 + (layout.columns.length - 1) * SKILL_TREE_COL_W + SKILL_TREE_ICON;
  const treeHeight = (layout.maxRow + 1) * SKILL_TREE_ROW_H;
  return `
    <div class="skill-tree-wrap">
      <div class="skill-tree-levels" style="width:${treeWidth}px;">${labelsHtml}</div>
      <div class="skill-tree-body" style="width:${treeWidth}px; height:${treeHeight}px;">
        ${linesHtml}${nodesHtml}
      </div>
    </div>
  `;
}
// 스킬 한 칸: 습득 전이면 흑백(50% 밝기), 습득했으면 원본 그대로. 클릭하면 학습을 시도함(learnSkill).
// 습득 불가(등급 미구현/레벨 미달/포인트 부족/공용·특화 습득 제한 충돌)면 버튼 자체를 비활성화함(요구사항 4번:
// "이미 하나를 습득한 경우 나머지 스킬은 습득 버튼을 비활성화합니다").
function buildSkillIconBtnHtml(id){
  const s = SKILLS[id];
  // 스킬 업그레이드 요구사항 3번 괄호: 상위 스킬로 교체되어 사라진 하위 스킬도 이 화면에서는 "습득됨"으로
  // 표시(isSkillDisplayedAsLearned). 실제 습득 가능 여부 판정(canLearnSkill)은 내부에서 isSkillLearned(진짜
  // 소유 여부)를 그대로 쓰므로, 하위 스킬 아이콘을 다시 눌러도 재습득되지 않음(클릭해도 조용히 무시됨 —
  // 이미 습득된 스킬 아이콘을 눌렀을 때와 동일한 동작).
  const learned = isSkillDisplayedAsLearned(id);
  const grade = WEAPON_GRADES[s.grade];
  const cantLearn = !learned && !canLearnSkill(id);
  // 요청 대응(버그 수정): 예전엔 여기서 실제 HTML `disabled` 속성을 썼는데, disabled 버튼은 그
  // 내부에서 발생하는 click 이벤트 자체를 브라우저가 아예 발생시키지 않아서(캡처/버블 단계 리스너에도
  // 전혀 도달하지 않음) 툴팁 안의 용어(.glossary-term)를 클릭해도 아무 반응이 없었음(습득 가능/이미
  // 습득한 스킬은 disabled가 안 붙어서 문제 없었음). 이제 실제 "습득 가능 여부" 판정은
  // openSkillLearnConfirm() 안의 canLearnSkill(id) 가드가 이미 방어적으로 처리하고 있으므로(원래도
  // 있던 코드, 이번에 새로 추가한 게 아님), 여기서는 disabled 속성 대신 cant-learn 클래스로 시각적
  // 상태만 표현함 — 버튼 자체는 여전히 클릭 가능해서 내부 용어도 정상적으로 클릭됨.
  return `
    <div class="skill-tree-node-inner">
      <button class="skill-icon-btn${learned ? '' : ' locked'}${cantLearn ? ' cant-learn' : ''}" data-learn-skill="${id}" ${cantLearn ? 'aria-disabled="true"' : ''} style="border-color:${grade ? grade.color : '#fff'};">
        <span class="skill-icon">${skillIconHtml(s)}</span>
        <span class="tooltip">${buildSkillTooltipHtml(id)}</span>
      </button>
      <span class="skill-tree-node-name">${s.name}</span>
    </div>`;
}

// ---- 던전 입구 목록 ----
function gradeSpan(grade){
  const g = MONSTER_GRADES[grade];
  return `<span style="color:${g.color}; font-weight:700;">${g.label}</span>`;
}
// (모험가의 유해·마석 드랍 안내는 이제 buildDungeonDropIcons에서 하드코딩 문구 또는 자동 생성 방식으로
// 대체되어, 이 던전별 동적 문구 생성 함수들은 더 이상 쓰이지 않아 정리함)
// 이 던전의 몬스터들이 실제로 등장 가능한 레벨(정상 등급은 레벨~레벨+levelRange 구간, 그 외 등급은 고정 레벨)을
// 전부 모아서, 그 레벨들에서 나올 수 있는 마석 등급(pickStoneGrade, 전역 공식 재사용)을 중복없이 반환.
function dungeonStoneGrades(d){
  const grades = new Set();
  d.monsters.forEach(id => {
    const m = MONSTERS[id];
    const levels = m.grade === 'normal'
      ? Array.from({ length: (d.levelRange || 0) + 1 }, (_, i) => m.level + i)
      : [m.level];
    levels.forEach(lv => grades.add(pickStoneGrade(lv)));
  });
  return grades;
}
// 이 던전의 몬스터들이 실제로 등장 가능한 레벨(dungeonStoneGrades와 동일한 레벨 수집 방식)에서 나올 수
// 있는 플라스크 아이템 id(hpFlask{tier}/mpFlask{tier})를 전부 모아 중복없이 반환. 종류(체력/마나)는
// 레벨과 무관하게 항상 둘 다 나올 수 있으므로, 각 레벨에서 계산된 tier마다 hp/mp 두 id를 모두 후보로 넣음.
function dungeonFlaskItems(d){
  const itemIds = new Set();
  d.monsters.forEach(id => {
    const m = MONSTERS[id];
    const levels = m.grade === 'normal'
      ? Array.from({ length: (d.levelRange || 0) + 1 }, (_, i) => m.level + i)
      : [m.level];
    levels.forEach(lv => {
      const tier = pickFlaskTier(lv);
      itemIds.add('hpFlask' + tier);
      itemIds.add('mpFlask' + tier);
    });
  });
  return itemIds;
}
// 던전 입구 카드의 "획득 가능 아이템 안내" 아이콘 목록 생성.
// - 골드/경험치/모험가의 유해는 하드코딩된 고정 안내(요구사항)이며 던전 데이터와 무관하게 항상 표시됨.
// - 마석/장비/기타/아티팩트는 이 던전의 몬스터 드랍 테이블(MONSTERS[id].drops)과 레벨 구간을 기준으로
//   자동 생성됨 — 새 몬스터·드랍·던전이 추가돼도 이 함수를 손댈 필요 없이 자동으로 반영됨.
// - 같은 아이템이 여러 몬스터의 드랍 테이블에 있어도 아이콘은 한 번만 표시(각 Set으로 중복 제거).
// - 각 카테고리는 분류당 하나로 뭉치지 않고, 실제로 획득 가능한 아이템 각각을 개별 아이콘으로 표시함.
function buildDungeonDropIcons(d){
  const icons = [];

  // 1. 골드 — 하드코딩 고정 안내
  icons.push({ icon: '🪙', borderColor: 'var(--forge-gold)',
    tooltip: `<span class="txt-gold">골드</span><br>몬스터 처치 시 골드를 획득합니다.` });

  // 2. 경험치 — 하드코딩 고정 안내
  icons.push({ icon: '✨', borderColor: 'var(--forge-purple)',
    tooltip: `<span class="txt-exp">경험치</span><br>몬스터 처치 시 경험치를 획득합니다.` });

  // 3. 모험가의 유해 — 하드코딩 고정 안내(어떤 무기가 나올지는 표시하지 않음)
  icons.push({ icon: '💀', borderColor: 'var(--forge-green)',
    tooltip: `<span class="txt-relic">모험가의 유해</span><br>낮은 확률로 쓰러진 모험가의 장비를 획득합니다.` });

  // 4. 장비 아이템 — 몬스터 드랍 테이블에 직접 등록된 장비(weaponId, 모험가의 유해와는 별개의 확정 드랍)가
  //    있다면 해당 장비 종류(무기/방어구/장신구)에 맞는 아이콘/툴팁 공식을 사용해 표시. weaponIconHtml·
  //    weaponGradeColor는 wpn()으로 세 종류를 통합 조회해 이미 범용이지만, 툴팁은 종류별 함수가 따로
  //    있어(buildWeaponTooltipHtml/buildArmorTooltipHtml/buildAccessoryTooltipHtml) equipType으로 분기함.
  const seenWeaponIds = new Set();
  d.monsters.forEach(id => {
    (MONSTERS[id].drops || []).forEach(drop => {
      if(!drop.weaponId || seenWeaponIds.has(drop.weaponId)) return;
      seenWeaponIds.add(drop.weaponId);
      const equipType = wpn(drop.weaponId).equipType;
      const tooltip = equipType === 'armor' ? buildArmorTooltipHtml(drop.weaponId, 0)
        : equipType === 'accessory' ? buildAccessoryTooltipHtml(drop.weaponId, 0)
        : equipType === 'sub' ? buildSubTooltipHtml(drop.weaponId, 0)
        : buildWeaponTooltipHtml(drop.weaponId, 0);
      icons.push({
        iconHtml: weaponIconHtml(drop.weaponId, 'drop-icon-img'),
        borderColor: weaponGradeColor(drop.weaponId),
        tooltip,
      });
    });
  });

  // 5. 아티팩트 — 몬스터 드랍 테이블의 artifactId 항목을 그대로 사용, 아티팩트 툴팁 공식 재사용.
  const seenArtifactIds = new Set();
  d.monsters.forEach(id => {
    (MONSTERS[id].drops || []).forEach(drop => {
      if(!drop.artifactId || seenArtifactIds.has(drop.artifactId)) return;
      seenArtifactIds.add(drop.artifactId);
      icons.push({
        iconHtml: itemIconHtml(ARTIFACTS[drop.artifactId]),
        borderColor: artifactGradeColor(drop.artifactId),
        tooltip: buildArtifactTooltipHtml(drop.artifactId),
      });
    });
  });

  // 6. 기타 아이템 — 몬스터 드랍 테이블 중 artifactId가 없는 항목(이름 기반, 재료류)을 MISC_ITEMS와
  //    매칭해 기타 아이템 툴팁 공식으로 표시. 기타 아이템은 등급 개념이 없어(다른 화면과 동일하게)
  //    var(--forge-line)을 테두리로 사용.
  const seenMiscIds = new Set();
  d.monsters.forEach(id => {
    (MONSTERS[id].drops || []).forEach(drop => {
      if(drop.artifactId || drop.weaponId) return;
      const item = miscItemByName(drop.name);
      if(!item || item.itemClass !== 'misc' || seenMiscIds.has(item.id)) return;
      seenMiscIds.add(item.id);
      icons.push({ iconHtml: itemIconHtml(item), borderColor: 'var(--forge-line)', tooltip: buildMiscTooltipHtml(item.id) });
    });
  });

  // 7. 마석 — 이 던전 몬스터들의 레벨 구간에서 실제로 나올 수 있는 등급의 마석만 자동 선별,
  //    마석 툴팁 공식으로 표시.
  const seenStoneIds = new Set();
  dungeonStoneGrades(d).forEach(grade => {
    const item = Object.values(MISC_ITEMS).find(m => m.itemClass === 'stone' && m.grade === grade);
    if(!item || seenStoneIds.has(item.id)) return;
    seenStoneIds.add(item.id);
    icons.push({ icon: item.icon, borderColor: stoneNameColor(item.id), tooltip: buildStoneTooltipHtml(item.id) });
  });

  // 8. 플라스크 — 마석(7번)과 완전히 동일한 방식으로, 이 던전 몬스터들의 레벨 구간에서 실제로 나올 수
  //    있는 체력/마나 포션만 자동 선별해 기존 소비 아이템 툴팁 공식(buildConsumableTooltipHtml)으로 표시.
  dungeonFlaskItems(d).forEach(itemId => {
    const item = CONSUMABLES[itemId];
    if(!item) return;
    icons.push({ iconHtml: itemIconHtml(item), borderColor: 'var(--forge-line)', tooltip: buildConsumableTooltipHtml(itemId) });
  });

  const iconHtmls = icons.map(it => `
    <span class="drop-icon-wrap">
      <span class="drop-icon" style="border-color:${it.borderColor};">${it.iconHtml || it.icon}</span>
      <span class="tooltip">${it.tooltip}</span>
    </span>
  `);

  // 12개 이하는 기존 그대로(더보기 버튼 없이 전부 출력). 13개 이상인 던전만 페이지 전환 UI 적용 —
  // 한 페이지에 최대 11개 아이템 + 마지막 칸에 다음/이전 버튼 1개(총 12칸)로, 기존에 한 줄에 들어가던
  // 최대 개수(12개)를 그대로 유지해 카드 크기가 커지지 않도록 함.
  // 모바일 UI 개편 4단계: 화면 폭이 좁은 모바일 프리셋에서는 이 12/11 기준을 그대로 쓰면 아이콘 행이
  // 카드 밖으로 넘치므로, 페이지당 표시 개수만 7개로 줄임(데스크톱 PAGE_SIZE.dungeonDrop=11은 그대로
  // 유지 — 전역 값을 바꾸지 않고 여기서 프리셋에 따라 다른 값을 고르기만 함). 페이지네이션 계산
  // 함수(pageCount/pageSlice/clampPage)와 페이지 버튼 로직은 데스크톱과 완전히 동일하게 재사용.
  const isMobile = !!(state.settings && state.settings.screenPreset === 'mobile');
  const pageSize = isMobile ? 7 : PAGE_SIZE.dungeonDrop;
  const showAllThreshold = isMobile ? 7 : 12; // 모바일: 7개까지 전부 표시 / 데스크톱: 기존 12개 그대로
  if(iconHtmls.length <= showAllThreshold) return iconHtmls.join('');

  const target = 'dungeonDrop:' + d.id;
  const totalPageCount = pageCount(iconHtmls.length, pageSize);
  pageState[target] = clampPage(pageState[target] || 1, totalPageCount);
  const page = pageState[target];
  const pageIcons = pageSlice(iconHtmls, page, pageSize);

  const hasNext = page < totalPageCount;
  const pageBtn = `<button class="drop-icon-page-btn" data-action="${hasNext ? 'page-next' : 'page-prev'}" data-page-target="${target}">${hasNext ? '다음' : '이전'}</button>`;

  return pageIcons.join('') + pageBtn;
}

function renderDungeonList(){
  const equipped = getEquippedWeapon();
  el('noWeaponForDungeon').style.display = equipped ? 'none' : 'block';
  const wrap = el('dungeonList');
  const pagerWrap = el('dungeonListPager');

  const pageSize = PAGE_SIZE.dungeonList;
  const totalPageCount = pageCount(DUNGEONS.length, pageSize);
  pageState.dungeonList = clampPage(pageState.dungeonList, totalPageCount);
  if(pagerWrap) pagerWrap.innerHTML = pagerHtml('dungeonList', pageState.dungeonList, totalPageCount);
  const pageDungeons = pageSlice(DUNGEONS, pageState.dungeonList, pageSize);

  wrap.innerHTML = pageDungeons.map(d => {
    const range = dungeonLevelRange(d);
    const monsterNames = d.monsters.map(id => MONSTERS[id].name).join(', ');
    return `
    <div class="dungeon-card">
      <div class="dungeon-head">
        <div class="dungeon-icon">${dungeonIcon(d)}</div>
        <span class="dungeon-name-wrap">
          <span class="dungeon-name">${d.name}</span>
          <span class="tooltip">${d.desc}</span>
        </span>
      </div>
      <div class="dungeon-meta">
        던전 몬스터: <b>${monsterNames}</b><br>
        등장 몬스터 레벨: <b>Lv.${range.min}~${range.max}</b>
      </div>
      <div class="drop-icon-row">${buildDungeonDropIcons(d)}</div>
      <button class="dungeon-enter-btn" data-id="${d.id}" ${equipped ? '' : 'disabled'}>입장하기</button>
    </div>
  `;
  }).join('');
}

// ---- 던전 상단 UI 접기/펼치기 ----
// hunt.topUiExpanded 값만 바꾸고 DOM 반영은 이 함수가 전담 — 토글 버튼 클릭과 던전 재입장(enterDungeon,
// 기본값으로 초기화) 양쪽에서 공통으로 호출됨.
function updateHuntTopUiToggle(){
  const section = el('huntTopSection');
  const btn = el('huntTopToggleBtn');
  if(!section || !btn) return;
  section.style.display = hunt.topUiExpanded ? 'block' : 'none';
  btn.textContent = hunt.topUiExpanded ? '›' : '‹';
  // 패널이 열려 있을 때만 .wrap의 480px 상한을 해제(요구사항 13번) — 닫히면 즉시 원복해서 다른 화면에
  // 영향이 남지 않게 함(추가로 showView()가 던전 화면을 완전히 벗어날 때도 항상 제거함).
  const wrapEl = document.querySelector('.wrap');
  if(wrapEl) wrapEl.classList.toggle('hunt-panel-open', hunt.topUiExpanded);
  if(hunt.topUiExpanded) renderHuntSidePanel(); // 펼치는 시점에 최신 내용으로 갱신
  // 모바일 UI 개편 3단계: 모바일 프리셋에서는 화면 폭이 좁아 huntCard(던전 전투 화면)와 huntTopSection
  // (캐릭터/스킬 패널)을 나란히 배치하지 않고, 패널이 열리면 huntCard 자리를 대신 표시함 — 던전/전투
  // 로직에는 전혀 손대지 않고 순수하게 두 카드 중 하나만 보이도록 display만 전환함(hunt.topUiExpanded
  // 값 자체는 데스크톱과 동일하게 그대로 사용). 데스크톱은 huntCard가 항상 표시된 채로(기존 3열 구조)
  // 유지되도록 별도 처리 없이 그냥 빈 문자열로 되돌려 기존 CSS(grid-column:2)가 그대로 적용되게 함.
  const huntCardEl = el('huntCard');
  if(huntCardEl){
    const isMobile = !!(state.settings && state.settings.screenPreset === 'mobile');
    huntCardEl.style.display = (isMobile && hunt.topUiExpanded) ? 'none' : '';
  }
}
function toggleHuntTopUi(){
  hunt.topUiExpanded = !hunt.topUiExpanded;
  if(hunt.topUiExpanded){
    // 던전 우측 카드를 열 때마다 캐릭터 메뉴 진입/캐릭터 정보 모달을 열 때와 동일한 규칙으로 draftStats를
    // 다시 세팅함(적용하지 않은 이전 임시 배분은 버리고 항상 최신 state.stats 기준으로 시작) — 이게 없으면
    // 던전에 입장한 뒤 캐릭터 메뉴를 한 번도 연 적이 없는 상태에서는 draftStats가 비어 있어(null) 던전
    // 우측 카드의 스탯 배분 버튼이 전혀 동작하지 않는 문제가 있었음(요구사항: 던전에서도 스탯 투자 가능).
    draftStats = { str: state.stats.str, agi: state.stats.agi, int: state.stats.int };
    draftStatPoints = state.statPoints || 0;
    statAllocActive = { str: false, agi: false, int: false };
  }
  updateHuntTopUiToggle();
}
// 던전 우측 카드 — 기존 캐릭터 메뉴(#characterView)와 완전히 동일한 [캐릭터 정보]/[스킬] 탭 구조를
// 그대로 재사용하되(CHARACTER_TABS 그대로 순회), 카드 크기가 정해져 있어 내용을 더 잘게 페이지로
// 나눔(요구사항). 사용하는 콘텐츠 빌더는 전부 기존 것 그대로:
//   [캐릭터 정보] 1p=buildEquipPanelHtml, 2p=buildCharLevelStatsHtml, 3p=buildCombatStatsHtml
//   [스킬]        1p=buildSkillQuickSlotSectionHtml, 2p=buildSkillListSectionHtml
// 탭 선택(huntCharTab)과 정보 탭의 페이지(pageState.huntCharInfo/huntCharSkill)는 캐릭터 메뉴 쪽
// 상태(activeCharTab/pageState.charMenuInfo)와 별개로 관리함(화면마다 독립적인 "지금 보고 있는 페이지"
// 이며, 스탯/스킬 같은 실제 데이터는 전부 공용 state를 그대로 읽으므로 두 화면 값은 항상 자동으로
// 일치함 — 예: 던전에서 스탯을 적용하면 캐릭터 메뉴도 다음에 열었을 때 곧바로 반영되어 있음).
// 이름 주의: 던전 화면 좌상단 상시 HUD(레벨/체력/마나바)는 별도의 renderHuntCharPanel()(위쪽에 먼저
// 정의됨)이 담당함 — 이 함수는 그 오른쪽에 붙는 카드 전체를 가리키는 별개 함수라 이름을 다르게 둠
// (두 함수가 한때 이름이 같아서 이 함수가 저 함수를 덮어써 좌상단 HUD가 갱신되지 않는 버그가 있었음).
function renderHuntSidePanel(){
  const tabsRow = el('huntCharTabsRow');
  const panelsWrap = el('huntCharTabPanels');
  if(!tabsRow || !panelsWrap) return;

  tabsRow.innerHTML = CHARACTER_TABS.map(t =>
    `<button class="inv-tab-btn${t.id === huntCharTab ? ' active' : ''}" data-hunt-char-tab="${t.id}">${t.label}</button>`
  ).join('');

  const tab = CHARACTER_TABS.find(t => t.id === huntCharTab) || CHARACTER_TABS[0];
  if(!tab){ panelsWrap.innerHTML = ''; return; }

  if(tab.id === 'skill'){
    pageState.huntCharSkill = clampPage(pageState.huntCharSkill, HUNT_CHAR_SKILL_PAGE_COUNT);
    const page = pageState.huntCharSkill;
    const pageBodyHtml = page === 2
      ? buildSkillListSectionHtml()
      : buildSkillQuickSlotSectionHtml('huntPanelSkillQuickSlotRow', 'huntPanelSkillFlaskRow');
    panelsWrap.innerHTML = `
      <div class="inv-tab-panel">
        <div class="char-menu-info-head">${pagerHtml('huntCharSkill', page, HUNT_CHAR_SKILL_PAGE_COUNT)}</div>
        <div>${pageBodyHtml}</div>
      </div>
    `;
    renderSkillQuickSlots(); // 1페이지일 때만 실제 존재하는 huntPanelSkillQuickSlotRow를 채움(없으면 조용히 무시됨)
    renderQuickSlots();
    return;
  }

  if(tab.id !== 'info'){
    panelsWrap.innerHTML = `<div class="inv-tab-panel"></div>`;
    return;
  }

  ensurePlayerVitals();
  pageState.huntCharInfo = clampPage(pageState.huntCharInfo, HUNT_CHAR_INFO_PAGE_COUNT);
  const page = pageState.huntCharInfo;
  // 1페이지는 "장비창 레이아웃"만(요구사항: 장착 아이템 정보·아티팩트 정보 생략) — includeInfo=false.
  const pageBodyHtml = page === 1 ? buildEquipPanelHtml(false)
    : page === 2 ? buildCharLevelStatsHtml()
    : buildCombatStatsHtml();

  panelsWrap.innerHTML = `
    <div class="inv-tab-panel">
      <div class="char-menu-info-head">${pagerHtml('huntCharInfo', page, HUNT_CHAR_INFO_PAGE_COUNT)}</div>
      <div>${pageBodyHtml}</div>
    </div>
  `;
}

// ---- 던전(사냥) 전투 화면 ----
function renderHunt(){
  const d = hunt.dungeon;
  if(!d) return;
  el('huntDungeonName').textContent = d.name + ' - ' + stageLabel(hunt.stage);

  // 전투 화면 중앙 플레이어 아이콘 — 매번 새로 그려도 무방하지만(정적 요소라 애니메이션 진행 중에는
  // 굳이 다시 그릴 필요가 없으므로) 비어있을 때만 채워 넣어 진행 중인 hit/dead 애니메이션이 끊기지 않게 함.
  // 방향/모션(hunt.playerDirection/playerMotion)은 renderPlayerPose(effects.js)가 그 이후로 계속 갱신함.
  const playerIcon = el('combatPlayerIcon');
  if(playerIcon && !playerIcon.dataset.filled){
    playerIcon.innerHTML = playerCombatIconHtml(hunt.playerDirection, hunt.playerMotion);
    playerIcon.dataset.filled = '1';
  }

  const isTreasureStage = hunt.stage === DUNGEON_TREASURE_STAGE;
  const chestEl = el('treasureChest');
  const hintEl = el('treasureHint');
  const combatPanel = el('huntCombatPanel');
  const playerSlot = el('combatPlayerSlot');
  const showChest = isTreasureStage && !hunt.chestOpened;
  if(chestEl) chestEl.style.display = showChest ? 'block' : 'none';
  if(hintEl) hintEl.style.display = showChest ? 'block' : 'none';
  // 스테이지 전환 중 전투 영역이 사라졌다 다시 나타나는 현상 수정(요구사항): 1스테이지(던전 첫 입장)는
  // 몬스터가 없는 입장 메시지 대기 구간에 전투 영역 자체를 숨기는 기존 동작을 그대로 유지한다. 2스테이지
  // 이후(스테이지 전환·11스테이지 숨겨진 장소)부터는 몬스터 유무·숨겨진 장소 여부와 무관하게 전투 영역을
  // 항상 표시 상태로 유지해, 이전 스테이지 몬스터만 제거된 채 화면(플레이어·레이아웃)은 계속 보이게 한다.
  if(combatPanel) combatPanel.style.display = (hunt.stage === 1 && hunt.monsters.length === 0) ? 'none' : 'block';
  // 11스테이지(숨겨진 장소)는 전투가 아니므로 플레이어 표시는 숨기되(요구사항), 전투 영역 자체(#combatArena
  // 등)는 위에서 계속 표시 상태이므로 레이아웃 크기는 그대로 유지된다.
  if(playerSlot) playerSlot.style.display = isTreasureStage ? 'none' : '';
  renderHuntBuffUi(); // 던전 진입/스테이지 전환 시 즉시 1회 반영(그 이후 실시간 갱신은 main.js의 100ms 타이머)
}
// 던전 전투화면 버프 지속시간 UI(요구사항) — activeBuffListForUi(formulas.js)가 이미 "지속시간 남은
// 것만 + 남은시간 내림차순"으로 정리해서 주므로 여기선 최대 개수(한 줄5개×3줄=15)로 자르고 그리기만 함.
// 아이콘/툴팁은 기존 스킬 퀵슬롯과 동일하게 skillIconHtml/buildSkillTooltipHtml을 그대로 재사용(요구사항:
// 새 툴팁 시스템을 만들지 않음). main.js에서 100ms마다 이 함수를 다시 부름.
// 망자의 저주(사망 패널티)도 요청에 따라 이 UI 안에 같은 정렬 규칙(남은시간 내림차순)으로 함께 표시함 —
// state.js의 DEATH_CURSE_DURATION_MS을 그대로 초 단위로 환산해서 보여줄 뿐 새 지속시간 계산은 없음.
// 대장간 화면 뱃지(curseBadgeForge)는 이 UI와 무관하게 renderDeathCurseBadge가 그대로 담당함.
// (요청 3번 버그수정) 100ms마다 wrap.innerHTML을 통째로 새로 그리면, 마우스가 올라가 있던 아이콘의
// DOM 노드 자체가 매번 파괴·재생성되어 :hover 상태가 끊기고 그 사이 툴팁이 깜빡였음. 그래서 이제는
// data-key(스킬id 또는 'curse')로 기존 노드를 찾아 재사용하고, 남은시간 텍스트만 갱신함 — 노드 자체는
// 그 버프가 실제로 사라지거나 새로 생길 때만 추가/제거되므로, 마우스가 계속 같은 아이콘 위에 있으면
// hover가 끊기지 않음. 순서가 바뀔 때만 insertBefore로 재배치(그때만 그 노드의 hover가 끊길 수 있는데,
// 이는 실제로 순위가 바뀌었을 때뿐이라 정상적인 동작임).
const HUNT_BUFF_UI_MAX = 15; // 한 줄 5개 × 최대 3줄(CSS .hunt-buff-ui의 고정폭/최대높이와 반드시 같이 맞춰야 함)
function renderHuntBuffUi(){
  const wrap = el('huntBuffUi');
  if(!wrap) return;
  const entries = activeBuffListForUi().map(b => ({ key: b.id, kind: 'skill', id: b.id, remainMs: b.remainMs }));
  if(isDeathCurseActive()){
    entries.push({ key: 'curse', kind: 'curse', remainMs: state.deathCurseUntil - Date.now() });
  }
  entries.sort((a, b) => b.remainMs - a.remainMs);
  const capped = entries.slice(0, HUNT_BUFF_UI_MAX);

  const existing = new Map();
  Array.from(wrap.children).forEach(node => existing.set(node.dataset.key, node));

  capped.forEach((e, idx) => {
    let node = existing.get(e.key);
    if(node){
      existing.delete(e.key); // 계속 살아있는 노드로 확정 — 아래에서 제거 대상에서 빠짐
    } else {
      node = document.createElement('div');
      node.className = 'hunt-buff-icon';
      node.dataset.key = e.key;
      node.innerHTML = e.kind === 'curse'
        ? `<img src="assets/ui/DEATH_CURSE.svg" class="hunt-buff-icon-img" alt="" draggable="false">
           <span class="hunt-buff-time"></span>
           <span class="tooltip">망자의 저주<br><span class="hunt-buff-curse-desc"></span></span>`
        : `${skillIconHtml(SKILLS[e.id], 'hunt-buff-icon-img')}
           <span class="hunt-buff-time"></span>
           <span class="tooltip">${buildSkillTooltipHtml(e.id)}</span>`;
    }
    node.querySelector('.hunt-buff-time').textContent = (e.remainMs / 1000).toFixed(1);
    if(e.kind === 'curse'){
      node.querySelector('.hunt-buff-curse-desc').textContent =
        Math.max(0, Math.ceil(e.remainMs / 1000)) + '초 동안 획득 골드, 경험치량 50% 감소';
    }
    if(wrap.children[idx] !== node) wrap.insertBefore(node, wrap.children[idx] || null);
  });
  existing.forEach(node => node.remove()); // 이번에 더 이상 나오지 않은(만료된) 버프 노드만 제거
}

// 개체 하나의 몬스터 슬롯 HTML을 생성(이름/등급색/레벨·공격력/체력바/체력텍스트/상태배지 틀).
// 새로 등장할 때만 사용(전투 중 매 틱마다 이걸로 다시 그리면 진행 중이던 애니메이션이 끊기므로,
// 이미 떠 있는 슬롯의 체력 등은 updateMonsterSlot()으로 가볍게만 갱신함).
function buildMonsterSlotHtml(instance){
  const monsterDef = MONSTERS[instance.monsterId];
  const grade = MONSTER_GRADES[monsterDef.grade];
  const pct = Math.max(0, Math.min(100, (instance.hp / instance.maxHp) * 100));
  const targetedClass = instance.instanceId === hunt.targetId ? ' targeted' : '';
  const posClass = instance.pos ? ' pos-' + instance.pos : '';
  return `
    <div class="monster-slot${targetedClass}${posClass}" id="monster-slot-${instance.instanceId}" data-instance-id="${instance.instanceId}">
      <div class="target-marker">▼</div>
      <div class="monster-status-row" id="monster-status-${instance.instanceId}"></div>
      <div class="hp-bar-wrap">
        <div class="hp-bar-fill" id="monster-hpfill-${instance.instanceId}" style="width:${pct}%"></div>
        <div class="hp-text" id="monster-hptext-${instance.instanceId}">${Math.max(0, instance.hp)}</div>
      </div>
      <div class="monster-icon spawn-in" id="monster-icon-${instance.instanceId}">${monsterIconHtml(monsterDef)}</div>
      <div class="monster-name-row">
        <span class="monster-name" style="color:${grade.color};">${monsterDef.name}</span>
        <span class="monster-lv" id="monster-lv-${instance.instanceId}">Lv.${instance.level} · 공격력 ${instance.atk}</span>
      </div>
    </div>`;
}
// 상/좌/우 자리를 "몬스터가 있는 것처럼" 자리만 차지하고 화면엔 보이지 않는 자리표시자로 채울 때 씀
// (UI 요구사항 — 스테이지 진입 메시지가 끝나기 전, 몬스터 출현 결정 전에도 항상 3자리가 채워진 것과
// 동일한 화면 크기를 유지하기 위함). buildMonsterSlotHtml과 동일한 뼈대(.monster-slot, hp-bar-wrap,
// monster-icon, monster-name-row)를 그대로 쓰되 실제 데이터 없이 빈 값만 채우고 visibility:hidden으로
// 감춤 — 전투/스폰 로직에는 전혀 관여하지 않는 순수 표시용 함수.
function buildEmptyMonsterSlotHtml(pos){
  return `
    <div class="monster-slot pos-${pos} placeholder-slot">
      <div class="hp-bar-wrap">
        <div class="hp-bar-fill" style="width:0%"></div>
        <div class="hp-text">&nbsp;</div>
      </div>
      <div class="monster-icon">&nbsp;</div>
      <div class="monster-name-row">
        <span class="monster-name">&nbsp;</span>
        <span class="monster-lv">&nbsp;</span>
      </div>
    </div>`;
}
// 몬스터 그룹 전체를 새로 그림. 스폰 시(spawnMonsters) 1회만 호출 — 전투 중 체력 갱신 등은
// updateMonsterSlot()이 개별 요소만 건드리므로 이 함수를 다시 호출하지 않음.
function renderMonsterRow(){
  const row = el('monsterRow');
  if(!row) return;
  row.innerHTML = hunt.monsters.map(buildMonsterSlotHtml).join('');
  // spawn-in은 등장 연출(.5s) 전용 클래스라 재생이 끝나면 더는 필요 없음 — 계속 남겨두면
  // 나중에 hit/dead 클래스가 붙어도 같은 명시도의 css 규칙끼리 소스 순서로 우선순위가 갈려
  // 피격/사망 애니메이션이 가려질 수 있으므로, 재생이 끝나는 시점에 확실히 떼어냄.
  hunt.monsters.forEach(instance => {
    const icon = el('monster-icon-' + instance.instanceId);
    if(icon) setTimeout(() => icon.classList.remove('spawn-in'), 520);
  });
}
// 개체 하나의 체력바/체력텍스트만 갱신(전투 중 매 틱마다 사용 — 슬롯 전체를 다시 그리지 않아
// 진행 중인 피격/사망 애니메이션이 끊기지 않음)
function updateMonsterSlot(instance){
  const fill = el('monster-hpfill-' + instance.instanceId);
  const text = el('monster-hptext-' + instance.instanceId);
  const pct = Math.max(0, Math.min(100, (instance.hp / instance.maxHp) * 100));
  if(fill) fill.style.width = pct + '%';
  if(text) text.textContent = Math.max(0, instance.hp);
}
// 공격 대상 선택 표시(빨간 테두리)만 갱신 — 슬롯을 다시 그리지 않고 클래스만 토글함
function updateTargetHighlight(){
  document.querySelectorAll('#monsterRow .monster-slot').forEach(slot => {
    slot.classList.toggle('targeted', Number(slot.dataset.instanceId) === hunt.targetId);
  });
  // 타겟이 바뀔 때마다 플레이어가 바라보는 방향도 함께 갱신(요구사항 3·4번, effects.js 참고) — 이 함수를
  // 호출하는 모든 곳(공격 대상 클릭/자동 재대상 지정/처치 후 재대상 지정)에 공통 적용됨.
  syncPlayerDirectionToTarget();
}

// 몬스터별 상태이상 UI(요구사항: 던전 버프 안내 UI와 유사한 아이콘+지속시간 오버레이 방식, 몬스터
// 체력바 바로 위에 독립적으로 표시). 남은시간 계산 공식은 기존 그대로(중독처럼 tickIntervalMs가
// 1초가 아닌 dot형은 남은 틱수×틱간격, 기절/둔화 등은 expiresAt 기준 실시간 계산) — 표시 단위만
// 버프 UI(소수점 1자리)와 달리 정수 초로 반올림 없이 올림(Math.ceil) 처리함(요구사항 5번).
// STATUS_TICK_RESOLUTION_MS(100ms)마다 renderStatusBadges가 호출되므로, hunt-buff-ui(zip161)에서
// 겪었던 것과 동일한 "매번 innerHTML을 통째로 새로 그리면 hover 중인 아이콘 노드가 파괴되어 툴팁이
// 깜빡이는" 문제를 피하기 위해 같은 방식(data-key로 기존 노드 재사용, 시간 텍스트만 갱신, 순서가
// 바뀔 때만 insertBefore)으로 그림.
function renderStatusBadges(){
  hunt.monsters.forEach(instance => {
    const row = el('monster-status-' + instance.instanceId);
    if(!row) return;
    const entries = (instance.statusEffects || []).map(s => {
      const def = STATUS_EFFECTS[s.key];
      if(!def) return null;
      const remainSec = def.type === 'dot'
        ? Math.max(0, Math.ceil(s.ticksRemaining * (def.tickIntervalMs / 1000)))
        : Math.max(0, Math.ceil((s.expiresAt - Date.now()) / 1000));
      return { key: s.key, def, remainSec };
    }).filter(Boolean);
    entries.sort((a, b) => b.remainSec - a.remainSec); // 요구사항 4번: 남은 시간이 긴 순으로 왼쪽부터

    const existing = new Map();
    Array.from(row.children).forEach(node => existing.set(node.dataset.key, node));

    entries.forEach((e, idx) => {
      let node = existing.get(e.key);
      if(node){
        existing.delete(e.key);
      } else {
        node = document.createElement('div');
        node.className = 'monster-status-icon';
        node.dataset.key = e.key;
        // 요구사항 4번: 상태이상 이름은 그대로 유지하고(색상만 새로 적용, "색상 연동" 요구사항) 그 아래에
        // 용어사전(GLOSSARY, data.js)의 설명을 추가. 용어사전에 없는 상태이상(현재는 없음)이면 이름만
        // 기존처럼 표시 — 이름/색상 값 자체(e.def.name/e.def.color)는 STATUS_EFFECTS에서 그대로 가져오며
        // 여기서 새로 만들거나 바꾸지 않음. 노드가 diffing으로 재사용되므로 이 innerHTML은 최초 생성 시
        // 한 번만 구성되고, 이후엔 남은시간 텍스트만 갱신됨(zip163과 동일한 패턴, 툴팁 깜빡임 없음).
        const g = glossaryEntry(e.key);
        const descHtml = g && g.desc ? `<br><span style="font-weight:400;">${g.desc}</span>` : '';
        // 이번 수정: 이름 줄만 가로 중앙 정렬(display:block 컨테이너에 text-align:center) — 설명 줄
        // 서식(descHtml)과 툴팁 전체 레이아웃/디자인은 전혀 손대지 않음(요구사항 1번).
        node.innerHTML = `${statusEffectIconHtml(e.def)}
           <span class="monster-status-time"></span>
           <span class="tooltip"><span style="display:block; text-align:center; color:${e.def.color}; font-weight:700;">${e.def.name}</span>${descHtml}</span>`;
      }
      const timeEl = node.querySelector('.monster-status-time');
      timeEl.textContent = e.remainSec + '초'; // 요구사항 5번: 1초 단위 표시(소수점 없음)
      timeEl.style.color = e.def.color; // 기존 뱃지가 쓰던 상태이상별 color를 그대로 유지
      if(row.children[idx] !== node) row.insertBefore(node, row.children[idx] || null);
    });
    existing.forEach(node => node.remove()); // 더 이상 걸려있지 않은 상태이상 노드만 제거
  });
}

// 킬 결과 모달에 보여줄 인벤토리 미리보기 HTML(목록 자체는 기존처럼 무기만 나열함 — 이번 작업은
// 슬롯 최대 개수만 다루므로 목록 범위는 건드리지 않음). 다만 슬롯 수 표시는 무기/방어구/장신구가
// INV_MAX(50)를 공용으로 나눠 쓰는 새 모델에 맞춰 totalEquipInventoryCount()로 합산해서 보여줌.
function buildInvPeekHtml(){
  if(state.inventory.length === 0){
    return `인벤토리 (${totalEquipInventoryCount()}/${INV_MAX})<br>비어있음`;
  }
  const lines = state.inventory.map(it => {
    const eq = it.id === state.equippedId ? ' <b style="color:var(--forge-gold);">(장착 중)</b>' : '';
    return `${weaponIconHtml(it.type || 'longsword', 'inv-peek-icon-img', it.level)} ${weaponName(it.type || 'longsword')}${levelSuffix(it.level)}${eq}`;
  }).join('<br>');
  return `인벤토리 (${totalEquipInventoryCount()}/${INV_MAX})<br>${lines}`;
}

// ---- 설정 화면 ----
// SETTINGS_SCHEMA를 그대로 순회해서 그리기 때문에, 카테고리나 메뉴가 늘어나도 이 함수는 수정할 필요 없음.
function renderSettings(){
  const catWrap = el('settingsCategoryList');
  if(!catWrap) return;
  catWrap.innerHTML = SETTINGS_SCHEMA.map(cat => `
    <button class="settings-cat-btn ${cat.id === activeSettingsCategory ? 'active' : ''}" data-cat="${cat.id}">${cat.icon || ''} ${cat.label}</button>
  `).join('');

  const cat = SETTINGS_SCHEMA.find(c => c.id === activeSettingsCategory) || SETTINGS_SCHEMA[0];
  const body = el('settingsBody');
  if(!cat){ body.innerHTML = `<div class="inv-empty">설정 항목이 없습니다.</div>`; return; }

  body.innerHTML = cat.items.map(item => {
    if(item.type === 'toggle'){
      const on = !!(state.settings && state.settings[item.id]);
      return `
        <div class="settings-item">
          <div class="settings-item-info">
            <div class="settings-item-label">${item.label}</div>
            ${item.desc ? `<div class="settings-item-desc">${item.desc}</div>` : ''}
          </div>
          <button class="settings-toggle-btn ${on ? 'on' : ''}" data-setting="${item.id}">${on ? '켜짐' : '꺼짐'}</button>
        </div>`;
    }
    if(item.type === 'stepper'){
      const val = (state.settings && state.settings[item.id] != null) ? state.settings[item.id] : item.default;
      const atMin = val <= item.min;
      const atMax = val >= item.max;
      return `
        <div class="settings-item">
          <div class="settings-item-info">
            <div class="settings-item-label">${item.label}</div>
            ${item.desc ? `<div class="settings-item-desc">${item.desc}</div>` : ''}
          </div>
          <div class="settings-stepper">
            <span class="settings-stepper-value">${val}${item.unit || ''}</span>
            <div class="settings-stepper-arrows">
              <button class="settings-stepper-btn" data-stepper="${item.id}" data-dir="up" ${atMax ? 'disabled' : ''}>▲</button>
              <button class="settings-stepper-btn" data-stepper="${item.id}" data-dir="down" ${atMin ? 'disabled' : ''}>▼</button>
            </div>
          </div>
        </div>`;
    }
    if(item.type === 'stepper-row'){
      const fieldsHtml = item.fields.map(f => {
        const val = (state.settings && state.settings[f.id] != null) ? state.settings[f.id] : f.default;
        const atMin = val <= f.min;
        const atMax = val >= f.max;
        return `
          <div class="settings-stepper-field">
            <span class="settings-item-label">${f.label}</span>
            <span class="settings-stepper-value">${val}${f.unit || ''}</span>
            <div class="settings-stepper-arrows">
              <button class="settings-stepper-btn" data-stepper="${f.id}" data-dir="up" ${atMax ? 'disabled' : ''}>▲</button>
              <button class="settings-stepper-btn" data-stepper="${f.id}" data-dir="down" ${atMin ? 'disabled' : ''}>▼</button>
            </div>
          </div>`;
      }).join('');
      return `<div class="settings-item settings-stepper-row">${fieldsHtml}</div>`;
    }
    if(item.type === 'radio'){
      const current = (state.settings && state.settings[item.id] != null) ? state.settings[item.id] : item.default;
      // disabledUnless: 다른 설정값이 특정 값일 때만 선택 가능(예: 화면 프리셋이 모바일일 때만 우측 패널
      // 형식을 고를 수 있음) — 목록엔 항상 표시하되 조건을 만족하지 않으면 버튼을 disabled 처리함.
      let disabled = false;
      if(item.disabledUnless){
        const depValue = state.settings ? state.settings[item.disabledUnless.settingId] : undefined;
        disabled = depValue !== item.disabledUnless.value;
      }
      const optionsHtml = item.options.map(opt => `
        <button class="settings-radio-btn ${current === opt.value ? 'selected' : ''}" data-radio="${item.id}" data-value="${opt.value}" ${disabled ? 'disabled' : ''}>
          <span class="settings-radio-dot"></span>${opt.label}
        </button>
      `).join('');
      return `
        <div class="settings-item settings-item-stacked">
          <div class="settings-item-info">
            <div class="settings-item-label">${item.label}</div>
            ${item.desc ? `<div class="settings-item-desc">${item.desc}</div>` : ''}
          </div>
          <div class="settings-radio-group">${optionsHtml}</div>
        </div>`;
    }
    return ''; // 새로운 설정 타입이 생기면 여기 분기만 추가하면 됨
  }).join('');
}

// ---- 사망 패널티(망자의 저주) 뱃지 ----
// 마을(대장간) 화면의 뱃지(curseBadgeForge)만 갱신 — 던전 전투화면 쪽은 요청에 따라 이 뱃지 대신
// renderHuntBuffUi(아래)가 버프 지속시간 UI 안에 같은 정렬 규칙으로 함께 표시함(중복 표시 방지).
function renderDeathCurseBadge(){
  const active = isDeathCurseActive();
  const remainingSec = active ? Math.max(0, Math.ceil((state.deathCurseUntil - Date.now()) / 1000)) : 0;
  const timeText = Math.floor(remainingSec / 60) + ':' + String(remainingSec % 60).padStart(2, '0');
  const descText = remainingSec + '초 동안 획득 골드, 경험치량 50% 감소';
  const badge = el('curseBadgeForge');
  if(badge){
    badge.style.display = active ? 'flex' : 'none';
    if(active){
      el('curseBadgeForgeTime').textContent = timeText;
      el('curseBadgeForgeDesc').textContent = descText;
    }
  }
}

// ============================================================
// ---- 상점: 탭/정렬 통합 렌더링 ----
// 새 아이템은 각 도감(WEAPON_TYPES/ARMOR_TYPES/CONSUMABLES/ARTIFACTS/MISC_ITEMS)에
// purchasable:true(또는 기타 탭은 그냥 등록)로 추가하기만 하면 이 함수들이 알아서 상점에 표시함.
// 아이템 이름/ID로 분기하는 하드코딩은 없음 — 카드 템플릿만 탭별로 다를 뿐, 목록 자체는
// formulas.js의 shopEntriesForTab()이 데이터 기반으로 뽑아줌.
// ============================================================

// "아직 데이터가 없어 항상 빈 상태로 표시되는" 장비 소분류(방어구/보조/장신구)의 안내 문구. 새 소분류가
// 생겨도 이 표에 항목만 추가하면 자동으로 적용됨(그 소분류에 실제 데이터가 등록되면 entries.length가
// 0이 아니게 되어 이 안내 문구 자체가 더 이상 쓰이지 않게 됨).
const SHOP_EMPTY_EQUIP_LABEL = { armor: '방어구', sub: '보조', accessory: '장신구' };

function renderShopTab(){
  if(!el('shopItemsList')) return; // 상점 화면 DOM이 아직 없는 초기 타이밍 방어

  const topId = topTabIdFor(SHOP_TABS, shopUI.tab);
  SHOP_TABS.forEach(t => {
    const btn = document.querySelector(`.shop-tab-btn[data-tab="${t.id}"]`);
    if(btn) btn.classList.toggle('active', topId === t.id);
  });
  // "장비" 최상위 탭일 때만 하위탭(무기/방어구/장신구/아티팩트) 행을 보여주고, 그 안에서 지금 보고
  // 있는 탭(shopUI.tab)을 active로 표시함. 다른 최상위 탭(소비/마석/기타)은 하위탭이 없으므로 숨김.
  const equipTop = SHOP_TABS.find(t => t.id === 'equipment');
  const subWrap = el('shopEquipSubTabs');
  if(subWrap) subWrap.style.display = topId === 'equipment' ? 'flex' : 'none';
  if(equipTop && equipTop.subTabs){
    equipTop.subTabs.forEach(st => {
      const btn = document.querySelector(`.shop-subtab-btn[data-tab="${st.id}"]`);
      if(btn) btn.classList.toggle('active', shopUI.tab === st.id);
    });
  }
  const filterDef = SHOP_SORT_FIELDS.find(f => f.id === shopUI.filter) || SHOP_SORT_FIELDS[0];
  el('shopFilterLabel').textContent = filterDef.label;
  el('shopSortDirBtn').textContent = shopUI.dir === 'asc' ? '↑ 오름차순' : '↓ 내림차순';
  el('shopFilterMenu').innerHTML = SHOP_SORT_FIELDS.map(f => `
    <button class="shop-filter-item ${shopUI.filter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>
  `).join('');

  const entries = sortShopEntries(shopEntriesForTab(shopUI.tab), shopUI.filter, shopUI.dir);
  const wrap = el('shopItemsList');
  const pagerWrap = el('shopPager');
  if(entries.length === 0){
    const emptyLabel = SHOP_EMPTY_EQUIP_LABEL[shopUI.tab];
    wrap.innerHTML = `<div class="inv-empty">${emptyLabel ? `아직 준비된 ${emptyLabel}가 없습니다.` : '표시할 아이템이 없습니다.'}</div>`;
    if(pagerWrap) pagerWrap.innerHTML = '';
    return;
  }

  // 무기/방어구/소비/아티팩트 탭만 페이지네이션 적용(SHOP_PAGE_KEY에 등록된 탭). 마석/기타 탭은
  // 이 매핑에 키가 없으므로 예전처럼 전체 목록을 그대로 출력함(페이지 UI도 비워둠).
  const pageKey = SHOP_PAGE_KEY[shopUI.tab];
  let pageEntries = entries;
  if(pageKey){
    const pageSize = PAGE_SIZE[pageKey];
    const totalPageCount = pageCount(entries.length, pageSize);
    pageState[pageKey] = clampPage(pageState[pageKey], totalPageCount);
    if(pagerWrap) pagerWrap.innerHTML = pagerHtml(pageKey, pageState[pageKey], totalPageCount);
    pageEntries = pageSlice(entries, pageState[pageKey], pageSize);
  } else if(pagerWrap){
    pagerWrap.innerHTML = '';
  }

  wrap.innerHTML = pageEntries.map(entry => buildShopCardHtml(shopUI.tab, entry.id)).join('');
}

function buildShopCardHtml(tabId, id){
  if(tabId === 'weapon') return buildWeaponShopCardHtml(WEAPON_TYPES, id);
  if(tabId === 'armor') return buildWeaponShopCardHtml(ARMOR_TYPES, id);
  if(tabId === 'sub') return buildWeaponShopCardHtml(SUB_TYPES, id);
  if(tabId === 'accessory') return buildWeaponShopCardHtml(ACCESSORY_TYPES, id);
  if(tabId === 'consumable') return buildConsumableShopCardHtml(id);
  if(tabId === 'artifact') return buildArtifactShopCardHtml(id);
  if(tabId === 'stone') return buildStoneShopCardHtml(id);
  if(tabId === 'misc') return buildMiscShopCardHtml(id);
  return '';
}

// 무기/방어구 공통 카드(장비류). typesTable을 인자로 받아서 방어구 데이터가 생기면 그대로 재사용됨.
function buildWeaponShopCardHtml(typesTable, id){
  const w = typesTable[id];
  const buyPrice = (w.sellPrice || 0) * 2;
  // 무기/방어구/장신구가 INV_MAX(50)를 공용으로 나눠 쓰므로(구매 시 실제로 담기는 배열은 여전히
  // 종류별로 다름 — 무기→state.inventory, 방어구→state.armorInventory, 장신구→state.accessoryInventory),
  // 용량 확인은 개별 배열이 아니라 세 배열의 합계(equipInventoryFull)로 판단함.
  const capOk = !equipInventoryFull();
  // 아이템 레벨(levelReq)은 "착용" 조건일 뿐이라 구매를 막지 않음 — 인벤토리 공간/골드만 확인.
  const disabled = !capOk || state.gold < buyPrice;
  const tag = !capOk ? '인벤토리 가득참' : (w.levelReq && w.levelReq > 1 ? `아이템 Lv.${w.levelReq}` : '');
  const nameColor = weaponNameColor(id, 0);
  // 방어구/장신구 탭은 무기와 동일한 카드를 공유하지만, 툴팁 내용은 장비 종류별 전용 구성을 써야 함
  // (무기 툴팁은 공격력/공격속도 등 방어구·장신구에 없는 필드를 참조하므로).
  const tooltipHtml = w.equipType === 'armor' ? buildArmorTooltipHtml(id, 0)
    : w.equipType === 'accessory' ? buildAccessoryTooltipHtml(id, 0)
    : w.equipType === 'sub' ? buildSubTooltipHtml(id, 0)
    : buildWeaponTooltipHtml(id, 0);
  return `
    <div class="scroll-card">
      <div class="scroll-head">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="artifact-icon-box" style="background:#242424; border-color:${nameColor};">${weaponIconHtml(id, 'shop-icon-img')}</div>
          <span class="weapon-name-wrap">
            <span class="scroll-name" style="color:${nameColor};">${w.name}</span>
            <span class="tooltip">${tooltipHtml}</span>
          </span>
        </div>
        <span class="scroll-count">${tag}</span>
      </div>
      <div class="scroll-body">
        <button class="scroll-buy" data-action="buy-weapon" data-type="${id}" style="flex:1;" ${disabled ? 'disabled' : ''}>구매 (${buyPrice.toLocaleString()} G)</button>
      </div>
    </div>`;
}

function buildConsumableShopCardHtml(id){
  const item = CONSUMABLES[id];
  const owned = (state.consumables && state.consumables[id]) || 0;
  return `
    <div class="scroll-card">
      <div class="scroll-head">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="artifact-icon-box" style="background:#2a1414; border-color:#c13c3c;">${itemIconHtml(item)}</div>
          <span class="scroll-name-wrap">
            <span class="scroll-name" style="color:var(--forge-cream);">${item.name}</span>
            <span class="tooltip">${buildConsumableTooltipHtml(id)}</span>
          </span>
        </div>
        <span class="scroll-count">보유 ${owned}개</span>
      </div>
      <div class="scroll-body">
        <button class="scroll-buy" data-action="buy-consumable" data-type="${id}" style="flex:1;" ${state.gold < item.buyPrice ? 'disabled' : ''}>구매 (${item.buyPrice} G)</button>
        <button class="scroll-buy" data-action="sell-consumable" data-type="${id}" style="flex:1;" ${owned <= 0 ? 'disabled' : ''}>전부 판매 (개당 ${item.sellPrice} G)</button>
      </div>
    </div>`;
}

function buildArtifactShopCardHtml(id){
  const a = ARTIFACTS[id];
  const owned = ownsArtifact(id);
  const disabled = owned || state.gold < a.buyPrice;
  const btnText = owned ? '보유 중' : `구매 (${a.buyPrice.toLocaleString()} G)`;
  return `
    <div class="scroll-card artifact">
      <div class="scroll-head">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="artifact-icon-box">${itemIconHtml(a)}</div>
          <span class="scroll-name-wrap">
            <span class="scroll-name artifact" style="color:${artifactNameColor(id)};">${a.name}</span>
            <span class="tooltip">${buildArtifactTooltipHtml(id)}</span>
          </span>
        </div>
        <span class="scroll-count">${owned ? '보유함' : ''}</span>
      </div>
      <div class="effect-line">${resolveGlossaryTermsHtml(a.effectText)}</div>
      <div class="scroll-body">
        <button class="scroll-buy" data-action="buy-artifact" data-type="${id}" style="flex:1;" ${disabled ? 'disabled' : ''}>${btnText}</button>
      </div>
    </div>`;
}

function buildMiscShopCardHtml(id){
  const item = MISC_ITEMS[id];
  const owned = state[item.stateKey] || 0;
  return `
    <div class="scroll-card">
      <div class="scroll-head">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="artifact-icon-box" style="background:#1c2b2c; border-color:#4fa3d1;">${itemIconHtml(item)}</div>
          <span class="weapon-name-wrap">
            <span class="scroll-name txt-shard">${item.name}</span>
            <span class="tooltip">${buildMiscTooltipHtml(id)}</span>
          </span>
        </div>
        <span class="scroll-count">보유 ${owned}개</span>
      </div>
      <div class="scroll-body">
        <button class="scroll-buy" data-action="sell-misc" data-type="${id}" style="flex:1;" ${owned <= 0 ? 'disabled' : ''}>전부 판매 (개당 ${item.sellPrice} G)</button>
      </div>
    </div>`;
}

// 마석 상점 카드: 기타 탭 카드와 동일한 UI 구조를 사용하되, 이름에 등급 색상을 적용하고
// 무기 툴팁과 동일한 레이아웃/서식의 전용 툴팁(이름/등급/아이템 분류/설명/판매 가격)을 붙임.
function buildStoneShopCardHtml(id){
  const item = MISC_ITEMS[id];
  const owned = state[item.stateKey] || 0;
  return `
    <div class="scroll-card">
      <div class="scroll-head">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="artifact-icon-box" style="background:#1c2b2c; border-color:#4fa3d1;">${item.icon}</div>
          <span class="weapon-name-wrap">
            <span class="scroll-name" style="color:${stoneNameColor(id)};">${item.name}</span>
            <span class="tooltip">${buildStoneTooltipHtml(id)}</span>
          </span>
        </div>
        <span class="scroll-count">보유 ${owned}개</span>
      </div>
      <div class="scroll-body">
        <button class="scroll-buy" data-action="sell-misc" data-type="${id}" style="flex:1;" ${owned <= 0 ? 'disabled' : ''}>전부 판매 (개당 ${item.sellPrice} G)</button>
      </div>
    </div>`;
}
