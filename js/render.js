// ============================================================
// render.js — 화면(DOM) 렌더링
// state를 읽어서 화면에 반영하는 함수들. 여기서 state를 직접
// 바꾸는 경우는 render() 안의 charmActive/blessingActive 자동
// 해제처럼 "표시 조건이 깨졌을 때 정리"하는 최소한의 경우뿐임(원본 그대로 유지).
// ============================================================

function render(){
  const equipped = getEquipped();
  const stage = el('swordStage');

  renderHuntCharPanel();
  renderQuickSlots();
  el('goldText').textContent = state.gold.toLocaleString();
  el('goldLedger').textContent = state.gold.toLocaleString() + ' G';

  // 아티팩트 장비 슬롯 (최대 ARTIFACT_SLOT_MAX개) — 장착 중인 아티팩트만 표시
  el('equipRow').innerHTML = Array.from({ length: ARTIFACT_SLOT_MAX }, (_, i) => {
    const id = state.equippedArtifacts[i];
    if(!id) return `<div class="equip-slot"></div>`;
    const a = ARTIFACTS[id];
    return `<div class="equip-slot filled">${a.icon}<span class="tooltip">${buildArtifactTooltipHtml(id)}</span></div>`;
  }).join('');

  if(!equipped){
    el('emptyNotice').style.display = 'block';
    el('quickBuySwordBtn').textContent = `🗡️ 검 구매 (${weaponBuyPrice('longsword').toLocaleString()} G)`;
    el('quickBuySwordBtn').disabled = state.gold < weaponBuyPrice('longsword') || state.inventory.length >= INV_MAX;
    el('tierLabel').textContent = '장착된 무기 없음';
    el('levelDisplay').textContent = '-';
    el('levelDisplay').style.color = 'var(--forge-cream-dim)';
    el('itemName').textContent = '';
    el('atkText').textContent = '-';
    el('atkSpeedText').textContent = '-';
    el('atkSpeedTooltip').textContent = '장착된 무기가 없습니다';
    el('critStatWrap').style.display = 'none';
    el('uniqueOptionWrap').style.display = 'none';
    el('oddsRow').innerHTML = '';
    stage.classList.add('empty');
    applySwordGlow(0);
    setBladeShape('longsword');
    updateAuraSmoke(false);
    el('enhanceBtn').disabled = true;
    el('enhanceBtn').textContent = '강화하기';
    el('costLine').innerHTML = '장착된 무기가 없습니다';
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
    el('itemName').textContent = weaponName(type) + ' +' + level;
    el('itemName').style.color = weaponNameColor(type, level);
    const atkNext = level < MAX_LEVEL ? atkFor(type, level+1) : null;
    el('atkText').innerHTML = formatStatDelta(atkFor(type, level), atkNext, null, '');

    const speedNow = atkSpeedFor(type, level);
    const speedNext = level < MAX_LEVEL ? atkSpeedFor(type, level+1) : null;
    el('atkSpeedText').innerHTML = formatStatDelta(speedNow, speedNext, 2, '');
    el('atkSpeedTooltip').textContent = `1초에 ${speedNow.toFixed(2)}만큼 공격`;

    const critNow = critChanceFor(type, level);
    const critNext = level < MAX_LEVEL ? critChanceFor(type, level+1) : null;
    const showCrit = critNow > 0 || (critNext !== null && critNext > 0);
    el('critStatWrap').style.display = showCrit ? '' : 'none';
    if(showCrit){
      el('critText').innerHTML = formatStatDelta(critNow, critNext, null, '%');
    }

    // 고유 옵션(에픽/유니크 전용) — 무기 데이터에 uniqueOption이 없으면 자동으로 숨겨짐
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

    const noEnhanceData = !wpn(type).cost || wpn(type).cost.length === 0; // 아직 강화 단계별 데이터가 없는 무기(숏소드/대거 등)
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
      el('costLine').innerHTML = '이 무기는 아직 강화 데이터가 준비되지 않았습니다';
    } else if(atMax){
      oddsRow.innerHTML = '';
      el('enhanceBtn').disabled = true;
      el('enhanceBtn').textContent = '최대 강화 완료';
      el('costLine').innerHTML = '판매하여 새 무기를 시작하세요';
    } else {
      let chips = `<span class="odds-chip success">성공 ${odds[0]}%</span><span class="odds-chip stay">유지 ${odds[1]}%</span>`;
      if(odds[2] > 0) chips += `<span class="odds-chip down">하락 ${odds[2]}%</span>`;
      if(odds[3] > 0) chips += `<span class="odds-chip destroy">파괴 ${odds[3]}%</span>`;
      oddsRow.innerHTML = chips;
      el('enhanceBtn').disabled = state.gold < costFor(type, level);
      el('enhanceBtn').textContent = '강화하기';
      el('costLine').innerHTML = `비용: ${costFor(type, level).toLocaleString()} G · <span class="sell-part">판매가: ${sellValueFor(type, level).toLocaleString()} G</span>`;
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
  el('invCount').textContent = state.inventory.length + ' / ' + INV_MAX;
  renderInventoryList();
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
  } else {
    el('openShopBtn').disabled = false;
    el('openInventoryBtn').disabled = false;
    el('openDungeonBtn').disabled = false;
    el('openCharacterBtn').disabled = false;
  }
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
  const totalPageCount = pageCount(state.inventory.length, pageSize);
  pageState.invWeapon = clampPage(pageState.invWeapon, totalPageCount);
  if(pagerWrap) pagerWrap.innerHTML = pagerHtml('invWeapon', pageState.invWeapon, totalPageCount);
  const pageItems = pageSlice(state.inventory, pageState.invWeapon, pageSize);
  wrap.innerHTML = pageItems.map(item=>{
    const type = item.type || 'longsword';
    const tier = tierOf(item.level);
    const meta = TIER_META[tier];
    const itemColor = weaponNameColor(type, item.level);
    const isEquipped = item.id === state.equippedId;
    const sellVal = sellValueFor(type, item.level);
    const reqOk = meetsWeaponEquipRequirements(type, state.playerLevel, state.stats);
    const equipDisabled = isEquipped || !reqOk;
    const equipBtnHtml = `<button class="inv-btn equip ${isEquipped?'active':''}" data-action="equip" data-id="${item.id}" ${equipDisabled?'disabled':''}>${isEquipped?'장착 중':'강화 선택'}</button>`;
    const equipBtnFinal = (!isEquipped && !reqOk)
      ? `<span class="equip-req-wrap">${equipBtnHtml}<span class="tooltip">착용 조건을 만족해야 장착할 수 있습니다.${weaponRequirementText(type) ? `<br>(${weaponRequirementText(type)})` : ''}</span></span>`
      : equipBtnHtml;
    return `
      <div class="inv-card ${isEquipped?'equipped':''}">
        <div class="inv-icon" style="border-color:${itemColor};">${weaponIconHtml(type, 'inv-icon-img')}</div>
        <div class="inv-info">
          <span class="weapon-name-wrap">
            <span class="inv-name" style="color:${itemColor};">${weaponName(type)} <span class="inv-level" style="color:${itemColor};">+${item.level}</span></span> ${isEquipped?'<span class="inv-badge">장착 중</span>':''}
            <span class="tooltip">${buildWeaponTooltipHtml(type, item.level)}</span>
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

function renderArtifactList(){
  el('artifactCount').textContent = state.equippedArtifacts.length + ' / ' + ARTIFACT_SLOT_MAX;
  const wrap = el('artifactList');
  if(state.artifacts.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 아티팩트가 없습니다.<br>던전에서 몬스터를 처치하거나 상점에서 구매해보세요.</div>`;
    return;
  }
  wrap.innerHTML = state.artifacts.map(id => {
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
        <div class="inv-icon" style="border-color:${nameColor};">${a.icon}</div>
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
      <div class="inv-icon" style="border-color: var(--forge-line);">${item.icon}</div>
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

  if(scrolls.length === 0 && flasks.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 소비 아이템이 없습니다.<br>대장간 강화 화면이나 상점에서 구매할 수 있어요.</div>`;
    return;
  }

  let html = scrolls.map(it => `
    <div class="inv-card">
      <div class="inv-icon" style="border-color: var(--forge-line);">${it.icon}</div>
      <div class="inv-info">
        <div class="inv-name">${it.name} ×${it.count}</div>
        <div class="inv-sub">${it.desc}</div>
        <div class="inv-sub">효과: ${it.effect}</div>
        <div class="inv-sub">${it.note}</div>
      </div>
    </div>`).join('');

  html += flasks.map(({ item, count }) => `
    <div class="inv-card">
      <div class="inv-icon" style="border-color: var(--forge-line);">${item.icon}</div>
      <div class="inv-info">
        <div class="inv-name">${item.name} ×${count}</div>
        <div class="inv-sub">${item.desc}</div>
      </div>
      <div class="inv-actions">
        <button class="inv-btn" data-action="use-flask" data-id="${item.id}">사용하기</button>
      </div>
    </div>`).join('');

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
  el('huntHpText').textContent = hp.toLocaleString() + ' / ' + maxHp.toLocaleString();
  el('huntHpBar').style.width = (hp / maxHp * 100) + '%';
  el('huntMpText').textContent = mp.toLocaleString() + ' / ' + maxMp.toLocaleString();
  el('huntMpBar').style.width = (mp / maxMp * 100) + '%';
  el('huntExpText').textContent = lv >= PLAYER_MAX_LEVEL ? 'MAX' : expPct.toFixed(1) + '%';
  el('huntExpBar').style.width = expPct + '%';
}

// 플라스크 퀵슬롯이 표시되는 모든 위치. 사냥 화면(quickSlotRow)에 있던 기존 UI를 그대로 재사용해
// 캐릭터 메뉴 스킬 탭(skillTabFlaskRow, "오른쪽: 기존 플라스크 퀵슬롯 그대로 사용")에도 동일하게 출력함 —
// 같은 state.quickSlots를 보여주는 것뿐이라 여기 목록에 id만 추가하면 다른 코드 수정 없이 그대로 반영됨.
const QUICK_SLOT_ROW_IDS = ['quickSlotRow', 'skillTabFlaskRow'];
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
          <span class="quickslot-icon" style="${onCooldown ? 'visibility:hidden;' : ''}">${item.icon}</span>
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

// 슬롯 키 → 현재 장착 중인 아이템 표시 정보(이름/강화단계/색상/아이콘/툴팁) 조회.
// 무기는 기존 장착 시스템(getEquipped)을 그대로 사용해 조회하고, 아직 실제 장비 데이터가 없는 슬롯
// (투구/갑옷/장신구1/장신구2)은 항상 null을 반환해 빈 슬롯으로 표시됨 — 해당 장비 타입이 실제로 추가되면
// 이 함수에 조회 분기 하나만 추가하면 되고, 장비창을 그리는 나머지 코드는 수정할 필요가 없음.
function equippedItemForSlot(slotKey){
  if(slotKey === 'weapon'){
    const equipped = getEquipped();
    if(!equipped) return null;
    const type = equipped.type || 'longsword';
    const level = equipped.level;
    return {
      name: weaponName(type), level,
      color: weaponNameColor(type, level),
      iconHtml: weaponIconHtml(type, 'eq-slot-icon-img'),
      tooltipHtml: buildWeaponTooltipHtml(type, level),
    };
  }
  return null; // 투구 / 갑옷 / 장신구1 / 장신구2 — 아직 등록된 장비 데이터 없음
}
function equipSlotHtml(slot){
  const item = equippedItemForSlot(slot.key);
  if(!item){
    return `<div class="eq-slot ${slot.cellClass}"><span class="eq-slot-empty-label">${slot.label}</span></div>`;
  }
  return `<div class="eq-slot filled ${slot.cellClass}">${item.iconHtml}<span class="tooltip">${item.tooltipHtml}</span></div>`;
}
// 아티팩트 슬롯 — 현재 최대 슬롯 수(ARTIFACT_SLOT_MAX)만큼 자동 생성되므로, 이 숫자가 바뀌면
// 장비창의 아티팩트 칸 개수도 코드 수정 없이 그대로 함께 바뀜.
function equipArtifactSlotsHtml(){
  return Array.from({ length: ARTIFACT_SLOT_MAX }, (_, i) => {
    const id = state.equippedArtifacts[i];
    if(!id) return `<div class="eq-slot eq-slot-artifact"><span class="eq-slot-empty-label">아티팩트</span></div>`;
    const a = ARTIFACTS[id];
    return `<div class="eq-slot eq-slot-artifact filled">${a.icon}<span class="tooltip">${buildArtifactTooltipHtml(id)}</span></div>`;
  }).join('');
}
// 장비창 아래 "장착 아이템 정보" — 현재 장착 중인 장비만 한 줄씩 출력(EQUIPMENT_SLOTS 기반이라
// 새 장비 타입이 추가돼도 자동으로 반영됨). 무기(및 향후 강화 가능한 장비)는 이름+강화 단계를,
// 아티팩트는 강화 개념이 없으므로 이름만 출력함.
function equippedItemInfoLinesHtml(){
  const lines = [];
  EQUIPMENT_SLOTS.forEach(slot => {
    const item = equippedItemForSlot(slot.key);
    if(item) lines.push(`<div class="char-equip-info-line" style="color:${item.color};">${item.name} +${item.level}</div>`);
  });
  state.equippedArtifacts.forEach(id => {
    const a = ARTIFACTS[id];
    lines.push(`<div class="char-equip-info-line" style="color:${artifactNameColor(id)};">${a.icon} ${a.name}</div>`);
  });
  return lines.length > 0 ? lines.join('') : `<div class="char-stat-empty">장착 중인 장비가 없습니다.</div>`;
}
// 좌측 "장비창" 전체(슬롯 그리드 + 아티팩트 칸 + 장착 아이템 정보 목록) HTML 조립.
function buildEquipPanelHtml(){
  const byKey = key => EQUIPMENT_SLOTS.find(s => s.key === key);
  const gridHtml = equipSlotHtml(byKey('weapon')) + equipSlotHtml(byKey('helmet')) + equipSlotHtml(byKey('armor'))
    + `<div class="eq-slot-accessories area-accessories">${equipSlotHtml(byKey('accessory1'))}${equipSlotHtml(byKey('accessory2'))}</div>`;
  return `
    <div class="equip-panel">
      <div class="equip-slots-grid">${gridHtml}</div>
      <div class="equip-artifact-col">${equipArtifactSlotsHtml()}</div>
    </div>
    <div class="char-stat-divider"></div>
    <div class="char-stat-sub-title">장착 아이템 정보</div>
    <div class="equipped-item-info">${equippedItemInfoLinesHtml()}</div>
  `;
}
// 캐릭터 정보 모달 — 인벤토리와 동일한 페이지네이션 시스템(pageState/pagerHtml/goPage)을 그대로 재사용해
// 1페이지(장비창+캐릭터 정보) / 2페이지(적용 중인 아티팩트 효과)를 전환함.
function renderCharStats(){
  ensurePlayerVitals();
  pageState.charStats = clampPage(pageState.charStats, CHAR_STATS_PAGE_COUNT);
  const pagerWrap = el('charStatsPager');
  if(pagerWrap) pagerWrap.innerHTML = pagerHtml('charStats', pageState.charStats, CHAR_STATS_PAGE_COUNT);
  if(pageState.charStats === 2){
    renderCharStatsPage2();
  } else {
    renderCharStatsPage1();
  }
}
// 캐릭터 정보(레벨/체력/마나/경험치 → 스탯 배분 → 전투 능력치) HTML 조립. 캐릭터 정보 모달(1페이지 우측)과
// 캐릭터 메뉴(신규, "캐릭터 정보" 탭 1페이지)가 이 함수를 그대로 공유해서 쓰므로, 기능/데이터가 항상 동일함.
function buildCharStatsInfoHtml(){
  const equipped = getEquipped();

  const lv = state.playerLevel;
  const maxHp = effectiveMaxHp(lv);
  const maxMp = effectiveMaxMp(lv);
  const hp = Math.min(state.playerHp, maxHp);
  const mp = Math.min(state.playerMp, maxMp);
  const expReq = lv >= PLAYER_MAX_LEVEL ? 0 : requiredExp(lv);
  const expPct = lv >= PLAYER_MAX_LEVEL ? 100 : Math.min(100, Math.round(state.playerExp / expReq * 1000) / 10);

  let rightHtml = `
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

  if(!equipped){
    rightHtml += `<div class="char-stat-empty">장착한 무기가 없습니다.</div>`;
  } else {
    const type = equipped.type || 'longsword';
    const level = equipped.level;
    const totalAtk = effectiveAtk(type, level);
    const baseSpeed = atkSpeedFor(type, level);
    const totalSpeed = effectiveAtkSpeed(type, level);
    const totalCrit = effectiveCritChance(type, level);
    const hasSpeedBonus = isArtifactEquipped('batwing');

    rightHtml += `
      <div class="char-stat-row"><span>장착 무기</span><span class="v">${weaponName(type)} +${level}</span></div>
      <div class="char-stat-divider"></div>
      <div class="char-stat-row big"><span>총 공격력</span><span class="v">${totalAtk}</span></div>
      <div class="char-stat-row big"><span>공격속도</span><span class="v">${totalSpeed.toFixed(2)}회/초</span></div>
      <div class="char-stat-row big"><span>치명타 확률</span><span class="v">${totalCrit}%</span></div>
    `;
    if(hasSpeedBonus){
      rightHtml += `<div class="char-stat-note">공격속도 = 무기 기본 ${baseSpeed.toFixed(2)} + 박쥐 날개 5%</div>`;
    }
  }

  return rightHtml;
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
  const equipped = getEquipped();
  if(!equipped){
    return `<div class="char-stat-empty">장착한 무기가 없습니다.</div>`;
  }
  if(state.equippedArtifacts.length === 0){
    return `<div class="char-stat-empty">적용 중인 아티팩트가 없습니다.</div>`;
  }
  let html = `<div class="char-stat-sub-title">적용 중인 아티팩트 효과</div>`;
  html += state.equippedArtifacts.map(id => {
    const a = ARTIFACTS[id];
    return `<div class="char-stat-artifact"><b style="color:${artifactNameColor(id)};">${a.icon} ${a.name}</b><br>${a.effectText}</div>`;
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

// ---- 스킬 탭 ----
// 상단: 스킬 퀵슬롯(5칸) + 기존 플라스크 퀵슬롯 + 초기화 버튼 → 하위 탭(공용/특화/기연, SKILL_CATEGORIES
// 기반) → 페이지 이동 → 하위 탭별 본문(buildSkillCategoryBodyHtml). 하위 탭 버튼도 인벤토리와 동일한
// inv-tabs 클래스를 그대로 사용함(요구사항: "탭 UI는 현재 인벤토리에서 사용하는 탭 구조를 그대로 사용").
function buildSkillTabHtml(){
  const catTabsHtml = SKILL_CATEGORIES.map(c =>
    `<button class="inv-tab-btn${c.id === activeSkillCategory ? ' active' : ''}" data-skill-cat="${c.id}">${c.label}</button>`
  ).join('');
  const page = clampPage(pageState.skillPage, SKILL_PAGES.length);
  pageState.skillPage = page;
  return `
    <div class="inv-tab-panel">
      <div class="skill-quickslot-row">
        <div class="quickslot-row" id="skillTabQuickSlotRow"></div>
        <div class="quickslot-row" id="skillTabFlaskRow"></div>
        <button class="nav-btn" data-action="reset-skill-quickslots">초기화</button>
      </div>
      <div class="inv-tabs">${catTabsHtml}</div>
      <div class="char-menu-info-head">${pagerHtml('skillPage', page, SKILL_PAGES.length)}</div>
      ${buildSkillCategoryBodyHtml(activeSkillCategory)}
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
}
// 스킬 퀵슬롯이 표시되는 모든 위치 — 쿨타임 실시간 표시를 가볍게 갱신할 때 순회 대상(플라스크의
// QUICK_SLOT_ROW_IDS와 동일한 패턴).
const SKILL_QUICK_SLOT_ROW_IDS = ['skillTabQuickSlotRow', 'huntSkillQuickSlotRow'];
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
// 하위 탭(공용/특화/기연) 한 개의 본문: 미사용 포인트 표시 + 레벨별 스킬 목록(현재 페이지 구간).
function buildSkillCategoryBodyHtml(categoryId){
  const isAwakening = categoryId === 'awakening';
  const pointsLabel = isAwakening ? '미사용 깨달음' : '미사용 스킬 포인트';
  const pointsValue = isAwakening ? (state.awakeningPoints || 0) : (state.skillPoints || 0);
  const levels = levelsForSkillPage(categoryId, pageState.skillPage);
  const rowsHtml = levels.map(lv => buildSkillLevelRowHtml(categoryId, lv)).join('');
  return `
    <div class="skill-points-row"><span>${pointsLabel}</span><span class="v">${pointsValue}</span></div>
    <div class="skill-level-grid">${rowsHtml || `<div class="char-stat-empty">표시할 레벨이 없습니다.</div>`}</div>
  `;
}
// 레벨 한 줄: 좌측에 레벨 라벨(고정 폭, 좌측 정렬), 우측에 그 레벨에 등록된 스킬 아이콘들(중앙 정렬 유지는
// CSS에서 처리). SKILLS를 순회해 이 레벨·분류에 해당하는 항목만 자동으로 모으므로, 나중에 스킬을 추가해도
// 이 함수는 손댈 필요가 없음(요구사항: "앞으로 스킬을 추가하면 자동으로 해당 레벨에 표시").
function buildSkillLevelRowHtml(categoryId, level){
  const ids = Object.keys(SKILLS).filter(id => SKILLS[id].category === categoryId && SKILLS[id].levelReq === level);
  const iconsHtml = ids.map(id => buildSkillIconBtnHtml(id)).join('');
  return `<div class="skill-level-row"><span class="skill-level-label">LV${level}</span><span class="skill-level-icons">${iconsHtml}</span></div>`;
}
// 스킬 한 칸: 습득 전이면 흑백(50% 밝기), 습득했으면 원본 그대로. 클릭하면 학습을 시도함(learnSkill).
// 습득 불가(등급 미구현/포인트 부족/공용·특화 습득 제한 충돌)면 버튼 자체를 비활성화함(요구사항 4번:
// "이미 하나를 습득한 경우 나머지 스킬은 습득 버튼을 비활성화합니다").
function buildSkillIconBtnHtml(id){
  const s = SKILLS[id];
  const learned = isSkillLearned(id);
  const grade = WEAPON_GRADES[s.grade];
  return `
    <button class="skill-icon-btn${learned ? '' : ' locked'}" data-learn-skill="${id}" ${(!learned && !canLearnSkill(id)) ? 'disabled' : ''} style="border-color:${grade ? grade.color : '#fff'};">
      <span class="skill-icon">${skillIconHtml(s)}</span>
      <span class="tooltip">${buildSkillTooltipHtml(id)}</span>
    </button>`;
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

  // 4. 장비 아이템 — 몬스터 드랍 테이블에 직접 등록된 무기(weaponId, 모험가의 유해와는 별개의 확정 드랍)가
  //    있다면 무기 툴팁/PNG 아이콘 공식을 그대로 사용해 표시. 현재 등록된 몬스터 중에는 이런 항목이 없어
  //    지금은 아무 것도 표시되지 않지만, 몬스터 drops에 { weaponId, chance } 항목이 추가되는 즉시 자동 반영됨.
  const seenWeaponIds = new Set();
  d.monsters.forEach(id => {
    (MONSTERS[id].drops || []).forEach(drop => {
      if(!drop.weaponId || seenWeaponIds.has(drop.weaponId)) return;
      seenWeaponIds.add(drop.weaponId);
      icons.push({
        iconHtml: weaponIconHtml(drop.weaponId, 'drop-icon-img'),
        borderColor: weaponGradeColor(drop.weaponId),
        tooltip: buildWeaponTooltipHtml(drop.weaponId, 0),
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
        icon: ARTIFACTS[drop.artifactId].icon,
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
      icons.push({ icon: item.icon, borderColor: 'var(--forge-line)', tooltip: buildMiscTooltipHtml(item.id) });
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

  return icons.map(it => `
    <span class="drop-icon-wrap">
      <span class="drop-icon" style="border-color:${it.borderColor};">${it.iconHtml || it.icon}</span>
      <span class="tooltip">${it.tooltip}</span>
    </span>
  `).join('');
}

function renderDungeonList(){
  const equipped = getEquipped();
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

// ---- 던전(사냥) 전투 화면 ----
function renderHunt(){
  const d = hunt.dungeon;
  if(!d) return;
  el('huntDungeonName').textContent = d.name + ' - ' + stageLabel(hunt.stage);

  const equipped = getEquipped();
  if(equipped){
    const lv = equipped.level;
    const type = equipped.type || 'longsword';
    const nameHtml = `<span class="weapon-name-wrap">${weaponName(type)} +${lv}<span class="tooltip">${buildWeaponTooltipHtml(type, lv)}</span></span>`;
    let info = `장착 무기: ${nameHtml} (공격력 ${effectiveAtk(type, lv)}, 공격속도 ${effectiveAtkSpeed(type, lv).toFixed(2)}회/초`;
    const crit = effectiveCritChance(type, lv);
    if(crit > 0) info += `, 치명타 ${crit}%`;
    info += ')';
    el('hunterInfo').innerHTML = info;
  } else {
    el('hunterInfo').textContent = '장착 무기 없음';
  }

  const isTreasureStage = hunt.stage === DUNGEON_TREASURE_STAGE;
  const chestEl = el('treasureChest');
  const hintEl = el('treasureHint');
  const combatPanel = el('huntCombatPanel');
  const showChest = isTreasureStage && !hunt.chestOpened;
  if(chestEl) chestEl.style.display = showChest ? 'block' : 'none';
  if(hintEl) hintEl.style.display = showChest ? 'block' : 'none';
  // 몬스터 정보(이름/체력/능력치)는 몬스터가 실제로 존재할 때만 표시 — 입장 메시지 대기 중엔 숨겨져 있다가
  // 몬스터 이미지가 등장하는 순간(spawnMonsters) 함께 나타남
  if(combatPanel) combatPanel.style.display = (isTreasureStage || hunt.monsters.length === 0) ? 'none' : 'block';
}

// 개체 하나의 몬스터 슬롯 HTML을 생성(이름/등급색/레벨·공격력/체력바/체력텍스트/상태배지 틀).
// 새로 등장할 때만 사용(전투 중 매 틱마다 이걸로 다시 그리면 진행 중이던 애니메이션이 끊기므로,
// 이미 떠 있는 슬롯의 체력 등은 updateMonsterSlot()으로 가볍게만 갱신함).
function buildMonsterSlotHtml(instance){
  const monsterDef = MONSTERS[instance.monsterId];
  const grade = MONSTER_GRADES[monsterDef.grade];
  const pct = Math.max(0, Math.min(100, (instance.hp / instance.maxHp) * 100));
  const targetedClass = instance.instanceId === hunt.targetId ? ' targeted' : '';
  return `
    <div class="monster-slot${targetedClass}" id="monster-slot-${instance.instanceId}" data-instance-id="${instance.instanceId}">
      <div class="target-marker">▼</div>
      <div class="hp-bar-wrap">
        <div class="hp-bar-fill" id="monster-hpfill-${instance.instanceId}" style="width:${pct}%"></div>
        <div class="hp-text" id="monster-hptext-${instance.instanceId}">${Math.max(0, instance.hp)} / ${instance.maxHp}</div>
      </div>
      <div class="monster-icon spawn-in" id="monster-icon-${instance.instanceId}">${monsterIconHtml(monsterDef)}</div>
      <div class="monster-name-row">
        <span class="monster-name" style="color:${grade.color};">${monsterDef.name}</span>
        <span class="monster-lv" id="monster-lv-${instance.instanceId}">Lv.${instance.level} · 공격력 ${instance.atk}</span>
      </div>
      <div class="status-badge-row" id="monster-status-${instance.instanceId}"></div>
    </div>`;
}
// 몬스터 그룹 전체를 새로 그림. 스폰 시(spawnMonsters) 1회만 호출 — 전투 중 체력 갱신 등은
// updateMonsterSlot()이 개별 요소만 건드리므로 이 함수를 다시 호출하지 않음.
function renderMonsterRow(){
  const row = el('monsterRow');
  if(!row) return;
  row.className = 'monster-row count-' + hunt.monsters.length;
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
  if(text) text.textContent = Math.max(0, instance.hp) + ' / ' + instance.maxHp;
}
// 공격 대상 선택 표시(빨간 테두리)만 갱신 — 슬롯을 다시 그리지 않고 클래스만 토글함
function updateTargetHighlight(){
  document.querySelectorAll('#monsterRow .monster-slot').forEach(slot => {
    slot.classList.toggle('targeted', Number(slot.dataset.instanceId) === hunt.targetId);
  });
}

function renderStatusBadges(){
  hunt.monsters.forEach(instance => {
    const row = el('monster-status-' + instance.instanceId);
    if(!row) return;
    if(!instance.statusEffects || instance.statusEffects.length === 0){
      row.innerHTML = '';
      return;
    }
    row.innerHTML = instance.statusEffects.map(s => {
      const def = STATUS_EFFECTS[s.key];
      return `<span class="status-badge" style="color:${def.color}; border-color:${def.color};">${def.icon} ${def.name} ${s.ticksRemaining}s</span>`;
    }).join('');
  });
}

// 킬 결과 모달에 보여줄 인벤토리 미리보기 HTML
function buildInvPeekHtml(){
  if(state.inventory.length === 0){
    return `인벤토리 (0/${INV_MAX})<br>비어있음`;
  }
  const lines = state.inventory.map(it => {
    const eq = it.id === state.equippedId ? ' <b style="color:var(--forge-gold);">(장착 중)</b>' : '';
    return `${weaponIconHtml(it.type || 'longsword', 'inv-peek-icon-img')} ${weaponName(it.type || 'longsword')} +${it.level}${eq}`;
  }).join('<br>');
  return `인벤토리 (${state.inventory.length}/${INV_MAX})<br>${lines}`;
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
    return ''; // 새로운 설정 타입이 생기면 여기 분기만 추가하면 됨
  }).join('');
}

// ---- 사망 패널티(망자의 저주) 뱃지 ----
// 마을(대장간)/던전 화면 양쪽에 있는 뱃지(curseBadgeForge, curseBadgeHunt)를 동일한 값으로 갱신.
function renderDeathCurseBadge(){
  const active = isDeathCurseActive();
  const remainingSec = active ? Math.max(0, Math.ceil((state.deathCurseUntil - Date.now()) / 1000)) : 0;
  const timeText = Math.floor(remainingSec / 60) + ':' + String(remainingSec % 60).padStart(2, '0');
  const descText = remainingSec + '초 동안 획득 골드, 경험치량 50% 감소';
  [
    { badge: 'curseBadgeForge', time: 'curseBadgeForgeTime', desc: 'curseBadgeForgeDesc' },
    { badge: 'curseBadgeHunt', time: 'curseBadgeHuntTime', desc: 'curseBadgeHuntDesc' },
  ].forEach(ids => {
    const badge = el(ids.badge);
    if(!badge) return;
    badge.style.display = active ? 'flex' : 'none';
    if(active){
      el(ids.time).textContent = timeText;
      el(ids.desc).textContent = descText;
    }
  });
}

// ============================================================
// ---- 상점: 탭/정렬 통합 렌더링 ----
// 새 아이템은 각 도감(WEAPON_TYPES/ARMOR_TYPES/CONSUMABLES/ARTIFACTS/MISC_ITEMS)에
// purchasable:true(또는 기타 탭은 그냥 등록)로 추가하기만 하면 이 함수들이 알아서 상점에 표시함.
// 아이템 이름/ID로 분기하는 하드코딩은 없음 — 카드 템플릿만 탭별로 다를 뿐, 목록 자체는
// formulas.js의 shopEntriesForTab()이 데이터 기반으로 뽑아줌.
// ============================================================

function renderShopTab(){
  if(!el('shopItemsList')) return; // 상점 화면 DOM이 아직 없는 초기 타이밍 방어

  SHOP_TABS.forEach(t => {
    const btn = document.querySelector(`.shop-tab-btn[data-tab="${t.id}"]`);
    if(btn) btn.classList.toggle('active', shopUI.tab === t.id);
  });
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
    wrap.innerHTML = `<div class="inv-empty">${shopUI.tab === 'armor' ? '아직 준비된 방어구가 없습니다.' : '표시할 아이템이 없습니다.'}</div>`;
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
  const capOk = state.inventory.length < INV_MAX;
  // 아이템 레벨(levelReq)은 "착용" 조건일 뿐이라 구매를 막지 않음 — 인벤토리 공간/골드만 확인.
  const disabled = !capOk || state.gold < buyPrice;
  const tag = !capOk ? '인벤토리 가득참' : (w.levelReq && w.levelReq > 1 ? `아이템 Lv.${w.levelReq}` : '');
  const nameColor = weaponNameColor(id, 0);
  return `
    <div class="scroll-card">
      <div class="scroll-head">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="artifact-icon-box" style="background:#242424; border-color:${nameColor};">${weaponIconHtml(id, 'shop-icon-img')}</div>
          <span class="weapon-name-wrap">
            <span class="scroll-name" style="color:${nameColor};">${w.name}</span>
            <span class="tooltip">${buildWeaponTooltipHtml(id, 0)}</span>
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
          <div class="artifact-icon-box" style="background:#2a1414; border-color:#c13c3c;">${item.icon}</div>
          <span class="scroll-name-wrap">
            <span class="scroll-name" style="color:var(--forge-cream);">${item.name}</span>
            <span class="tooltip">${item.desc}</span>
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
          <div class="artifact-icon-box">${a.icon}</div>
          <span class="scroll-name-wrap">
            <span class="scroll-name artifact" style="color:${artifactNameColor(id)};">${a.name}</span>
            <span class="tooltip">${buildArtifactTooltipHtml(id)}</span>
          </span>
        </div>
        <span class="scroll-count">${owned ? '보유함' : ''}</span>
      </div>
      <div class="effect-line">${a.effectText}</div>
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
          <div class="artifact-icon-box" style="background:#1c2b2c; border-color:#4fa3d1;">${item.icon}</div>
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
