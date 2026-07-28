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

  // 아티팩트 장비 슬롯 (최대 ARTIFACT_SLOT_MAX개)
  el('equipRow').innerHTML = Array.from({ length: ARTIFACT_SLOT_MAX }, (_, i) => {
    const id = state.artifacts[i];
    if(!id) return `<div class="equip-slot"></div>`;
    const a = ARTIFACTS[id];
    return `<div class="equip-slot filled">${a.icon}<span class="tooltip">${a.name} — ${a.desc} (${a.effectText})</span></div>`;
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
  } else {
    el('openShopBtn').disabled = false;
    el('openInventoryBtn').disabled = false;
    el('openDungeonBtn').disabled = false;
  }
}

function renderInventoryList(){
  const wrap = el('inventoryList');
  if(state.inventory.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 무기가 없습니다.<br>상점에서 <b>검</b>을 구매해보세요 (100 G).</div>`;
    return;
  }
  wrap.innerHTML = state.inventory.map(item=>{
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
        <div class="inv-icon" style="border-color:${itemColor};">🗡️</div>
        <div class="inv-info">
          <span class="weapon-name-wrap">
            <span class="inv-name">${weaponName(type)} <span class="inv-level" style="color:${itemColor};">+${item.level}</span> ${isEquipped?'<span class="inv-badge">장착 중</span>':''}</span>
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
  el('artifactCount').textContent = state.artifacts.length + ' / ' + ARTIFACT_SLOT_MAX;
  const wrap = el('artifactList');
  if(state.artifacts.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 아티팩트가 없습니다.<br>던전에서 몬스터를 처치하거나 상점에서 구매해보세요.</div>`;
    return;
  }
  wrap.innerHTML = state.artifacts.map(id => {
    const a = ARTIFACTS[id];
    return `
      <div class="inv-card">
        <div class="inv-icon" style="border-color: var(--forge-gold);">${a.icon}</div>
        <div class="inv-info">
          <div class="inv-name">${a.name}</div>
          <div class="inv-sub">${a.desc}</div>
          <div class="inv-sub" style="color: var(--forge-gold);">${a.effectText}</div>
        </div>
      </div>`;
  }).join('');
}

function renderMiscList(){
  const wrap = el('miscList');
  const entries = [
    { item: MISC_ITEMS.manaFragment, count: state.manaFragments || 0 },
    { item: MISC_ITEMS.manaShard, count: state.manaShards || 0 },
  ].filter(e => e.count > 0);
  if(entries.length === 0){
    wrap.innerHTML = `<div class="inv-empty">보유한 기타 아이템이 없습니다.</div>`;
    return;
  }
  wrap.innerHTML = entries.map(({ item, count }) => `
    <div class="inv-card">
      <div class="inv-icon" style="border-color: var(--forge-line);">${item.icon}</div>
      <div class="inv-info">
        <div class="inv-name"><span class="txt-shard">${item.name}</span> ×${count}</div>
        <div class="inv-sub">${item.desc}</div>
        <div class="inv-sub">획득 장소: ${item.source}</div>
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

function renderQuickSlots(){
  const row = el('quickSlotRow');
  if(!row) return;
  if(!Array.isArray(state.quickSlots) || state.quickSlots.length !== QUICK_SLOT_COUNT){
    const prev = Array.isArray(state.quickSlots) ? state.quickSlots : [];
    state.quickSlots = Array.from({ length: QUICK_SLOT_COUNT }, (_, i) => prev[i] || null);
  }
  row.innerHTML = state.quickSlots.map((itemId, idx) => {
    if(!itemId){
      return `<div class="quickslot-wrap"><button class="quickslot-btn empty" data-action="assign" data-slot="${idx}">+</button></div>`;
    }
    const item = CONSUMABLES[itemId];
    if(!item){
      return `<div class="quickslot-wrap"><button class="quickslot-btn empty" data-action="assign" data-slot="${idx}">+</button></div>`;
    }
    const count = (state.consumables && state.consumables[itemId]) || 0;
    return `
      <div class="quickslot-wrap">
        <button class="quickslot-btn filled" data-action="use" data-item="${itemId}" ${count <= 0 ? 'disabled' : ''} title="${item.name}">
          <span class="quickslot-icon">${item.icon}</span>
          <span class="quickslot-count">${count}</span>
        </button>
        <button class="quickslot-clear" data-action="clear" data-slot="${idx}" title="슬롯 비우기">×</button>
      </div>`;
  }).join('');
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
  return `
    <div class="stat-alloc-row">
      <span class="stat-alloc-label">${label}</span>
      <span class="stat-alloc-value">${value}</span>
      <button class="stat-alloc-btn" data-stat="${key}" ${canAlloc ? '' : 'disabled'}>+</button>
    </div>
  `;
}

function renderCharStats(){
  ensurePlayerVitals();
  const equipped = getEquipped();
  const body = el('charStatsBody');

  const lv = state.playerLevel;
  const maxHp = effectiveMaxHp(lv);
  const maxMp = effectiveMaxMp(lv);
  const hp = Math.min(state.playerHp, maxHp);
  const mp = Math.min(state.playerMp, maxMp);
  const expReq = lv >= PLAYER_MAX_LEVEL ? 0 : requiredExp(lv);
  const expPct = lv >= PLAYER_MAX_LEVEL ? 100 : Math.min(100, Math.round(state.playerExp / expReq * 1000) / 10);

  let html = `
    <div class="char-stat-row big"><span>캐릭터 레벨</span><span class="v">Lv.${lv}</span></div>
    <div class="player-bar-label">체력 <span>${hp.toLocaleString()} / ${maxHp.toLocaleString()}</span></div>
    <div class="player-bar-wrap"><div class="player-bar-fill hp" style="width:${(hp/maxHp*100)}%;"></div></div>
    <div class="player-bar-label">마나 <span>${mp.toLocaleString()} / ${maxMp.toLocaleString()}</span></div>
    <div class="player-bar-wrap"><div class="player-bar-fill mp" style="width:${(mp/maxMp*100)}%;"></div></div>
    <div class="player-bar-label">경험치 <span>${lv >= PLAYER_MAX_LEVEL ? 'MAX' : expPct.toFixed(1) + '%'}</span></div>
    <div class="player-bar-wrap"><div class="player-bar-fill exp" style="width:${expPct}%;"></div></div>
    <div class="char-stat-divider"></div>
    <div class="char-stat-row"><span>사용 가능 포인트</span><span class="v" style="color:var(--forge-gold);">${draftStatPoints || 0}</span></div>
    ${renderStatAllocRow('str', '힘', draftStats.str)}
    ${renderStatAllocRow('agi', '민첩', draftStats.agi)}
    ${renderStatAllocRow('int', '지능', draftStats.int)}
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
    html += `<div class="char-stat-empty">장착한 무기가 없습니다.</div>`;
    body.innerHTML = html;
    return;
  }

  const type = equipped.type || 'longsword';
  const level = equipped.level;
  const totalAtk = effectiveAtk(type, level);
  const baseSpeed = atkSpeedFor(type, level);
  const totalSpeed = effectiveAtkSpeed(type, level);
  const totalCrit = critChanceFor(type, level);
  const hasSpeedBonus = ownsArtifact('batwing');

  html += `
    <div class="char-stat-row"><span>장착 무기</span><span class="v">${weaponName(type)} +${level}</span></div>
    <div class="char-stat-divider"></div>
    <div class="char-stat-row big"><span>총 공격력</span><span class="v">${totalAtk}</span></div>
    <div class="char-stat-row big"><span>공격속도</span><span class="v">${totalSpeed.toFixed(2)}회/초</span></div>
    <div class="char-stat-row big"><span>치명타 확률</span><span class="v">${totalCrit}%</span></div>
  `;
  if(hasSpeedBonus){
    html += `<div class="char-stat-note">공격속도 = 무기 기본 ${baseSpeed.toFixed(2)} + 박쥐 날개 5%</div>`;
  }

  if(state.artifacts.length > 0){
    html += `<div class="char-stat-divider"></div><div class="char-stat-sub-title">적용 중인 아티팩트 효과</div>`;
    html += state.artifacts.map(id => {
      const a = ARTIFACTS[id];
      return `<div class="char-stat-artifact"><b>${a.icon} ${a.name}</b><br>${a.effectText}</div>`;
    }).join('');
  }

  body.innerHTML = html;
}

// ---- 던전 입구 목록 ----
function gradeSpan(grade){
  const g = MONSTER_GRADES[grade];
  return `<span style="color:${g.color}; font-weight:700;">${g.label}</span>`;
}
function relicTooltipLine(dropCfg){
  const tmpl = RELIC_TEMPLATES[dropCfg.relicTemplate];
  const levels = tmpl.levelWeights.map(([lvl]) => lvl);
  const min = Math.min(...levels), max = Math.max(...levels);
  const range = min === max ? `+${min}` : `+${min}~+${max}`;
  return `${weaponName('longsword')} ${range} 중 획득`;
}
function buildDungeonDropIcons(d){
  const icons = [];

  // 골드 (항상 드랍)
  icons.push({
    icon: '🪙',
    tooltip: `<span class="txt-gold">골드</span><br>몬스터 처치 시 골드를 획득합니다.`,
  });

  // 모험가의 유해 (무기 드랍) - 등급별로 다른 템플릿을 쓸 수 있어 등급별로 나열
  const grades = Object.keys(d.dropTable);
  const relicLines = grades.map(g => `${gradeSpan(g)}: ${relicTooltipLine(d.dropTable[g])}`).join('<br>');
  icons.push({
    icon: '💀',
    tooltip: `<span class="txt-relic">모험가의 유해</span><br>${relicLines}`,
  });

  // 마석 파편 / 마석 조각: 일반 등급은 확률 드랍, 에픽 등급은 레벨에 따라 확정 드랍
  const manaNotes = {}; // itemId -> [note, ...]
  grades.forEach(g => {
    if(g === 'epic'){
      d.monsters.filter(m => MONSTERS[m.id].grade === 'epic').forEach(m => {
        const epicLevel = m.levelMin; // 현재 에픽 몬스터는 모두 고정 레벨로 등장
        const drop = epicShardDrop(epicLevel);
        const item = MISC_ITEMS[drop.item];
        (manaNotes[item.id] = manaNotes[item.id] || []).push(
          `${gradeSpan('epic')} ${MONSTERS[m.id].name} 처치 시 확정 획득 (${drop.qty}개)`
        );
      });
    } else {
      (manaNotes[MISC_ITEMS.manaFragment.id] = manaNotes[MISC_ITEMS.manaFragment.id] || []).push(
        `${gradeSpan(g)} 몬스터 처치 시 획득할 수 있습니다.`
      );
    }
  });
  Object.keys(manaNotes).forEach(itemId => {
    const item = MISC_ITEMS[itemId];
    icons.push({
      icon: item.icon,
      tooltip: `<span class="txt-shard">${item.name}</span><br>${manaNotes[itemId].join('<br>')}`,
    });
  });

  // 몬스터별 고유 드랍(아티팩트 등)
  d.monsters.forEach(m => {
    const monsterDef = MONSTERS[m.id];
    (monsterDef.uniqueDrops || []).forEach(drop => {
      if(drop.type === 'artifact'){
        const a = ARTIFACTS[drop.artifactId];
        icons.push({
          icon: a.icon,
          tooltip: `${a.name}<br>${monsterDef.name} 처치 시 획득할 수 있습니다.<br>효과: ${a.effectText}`,
        });
      }
    });
  });

  return icons.map(it => `
    <span class="drop-icon-wrap">
      <span class="drop-icon">${it.icon}</span>
      <span class="tooltip">${it.tooltip}</span>
    </span>
  `).join('');
}

function renderDungeonList(){
  const equipped = getEquipped();
  el('noWeaponForDungeon').style.display = equipped ? 'none' : 'block';
  const wrap = el('dungeonList');
  wrap.innerHTML = DUNGEONS.map(d => {
    const range = dungeonLevelRange(d);
    const monsterNames = d.monsters.map(m => MONSTERS[m.id].name).join(', ');
    return `
    <div class="dungeon-card">
      <div class="dungeon-head">
        <div class="dungeon-icon">${d.icon}</div>
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
  if(!d || !hunt.monster) return;
  const monsterDef = MONSTERS[hunt.monster.monsterId];
  const grade = MONSTER_GRADES[monsterDef.grade];
  const equipped = getEquipped();
  el('huntDungeonName').textContent = d.name;
  if(equipped){
    const lv = equipped.level;
    const type = equipped.type || 'longsword';
    const nameHtml = `<span class="weapon-name-wrap">${weaponName(type)} +${lv}<span class="tooltip">${buildWeaponTooltipHtml(type, lv)}</span></span>`;
    let info = `장착 무기: ${nameHtml} (공격력 ${effectiveAtk(type, lv)}, 공격속도 ${effectiveAtkSpeed(type, lv).toFixed(2)}회/초`;
    const crit = critChanceFor(type, lv);
    if(crit > 0) info += `, 치명타 ${crit}%`;
    info += ')';
    el('hunterInfo').innerHTML = info;
  } else {
    el('hunterInfo').textContent = '장착 무기 없음';
  }
  el('monsterIcon').textContent = monsterDef.icon;
  el('monsterName').textContent = monsterDef.name;
  el('monsterName').style.color = grade.color;
  el('monsterLv').textContent = 'Lv.' + hunt.monster.level + ' · 공격력 ' + hunt.monster.atk;
  const pct = Math.max(0, Math.min(100, (hunt.monster.hp / hunt.monster.maxHp) * 100));
  el('hpBarFill').style.width = pct + '%';
  el('hpText').textContent = Math.max(0, hunt.monster.hp) + ' / ' + hunt.monster.maxHp;
  const startBtn = el('startExploreBtn');
  if(startBtn) startBtn.style.display = hunt.started ? 'none' : 'block';
}

function renderStatusBadges(){
  const row = el('statusBadgeRow');
  if(!row) return;
  if(!hunt.monster || !hunt.monster.statusEffects || hunt.monster.statusEffects.length === 0){
    row.innerHTML = '';
    return;
  }
  row.innerHTML = hunt.monster.statusEffects.map(s => {
    const def = STATUS_EFFECTS[s.key];
    return `<span class="status-badge" style="color:${def.color}; border-color:${def.color};">${def.icon} ${def.name} ${s.ticksRemaining}s</span>`;
  }).join('');
}

// 킬 결과 모달에 보여줄 인벤토리 미리보기 HTML
function buildInvPeekHtml(){
  if(state.inventory.length === 0){
    return `인벤토리 (0/${INV_MAX})<br>비어있음`;
  }
  const lines = state.inventory.map(it => {
    const eq = it.id === state.equippedId ? ' <b style="color:var(--forge-gold);">(장착 중)</b>' : '';
    return `🗡️ ${weaponName(it.type || 'longsword')} +${it.level}${eq}`;
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
  if(entries.length === 0){
    wrap.innerHTML = `<div class="inv-empty">${shopUI.tab === 'armor' ? '아직 준비된 방어구가 없습니다.' : '표시할 아이템이 없습니다.'}</div>`;
    return;
  }
  wrap.innerHTML = entries.map(entry => buildShopCardHtml(shopUI.tab, entry.id)).join('');
}

function buildShopCardHtml(tabId, id){
  if(tabId === 'weapon') return buildWeaponShopCardHtml(WEAPON_TYPES, id);
  if(tabId === 'armor') return buildWeaponShopCardHtml(ARMOR_TYPES, id);
  if(tabId === 'consumable') return buildConsumableShopCardHtml(id);
  if(tabId === 'artifact') return buildArtifactShopCardHtml(id);
  if(tabId === 'misc') return buildMiscShopCardHtml(id);
  return '';
}

// 무기/방어구 공통 카드(장비류). typesTable을 인자로 받아서 방어구 데이터가 생기면 그대로 재사용됨.
function buildWeaponShopCardHtml(typesTable, id){
  const w = typesTable[id];
  const buyPrice = (w.sellPrice || 0) * 2;
  const levelOk = w.levelReq ? state.playerLevel >= w.levelReq : true;
  const capOk = state.inventory.length < INV_MAX;
  const disabled = !levelOk || !capOk || state.gold < buyPrice;
  const tag = !levelOk ? `Lv.${w.levelReq} 필요` : (!capOk ? '인벤토리 가득참' : '');
  const nameColor = weaponNameColor(id, 0);
  return `
    <div class="scroll-card">
      <div class="scroll-head">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="artifact-icon-box" style="background:#242424; border-color:${nameColor};">🗡️</div>
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
  const slotFull = state.artifacts.length >= ARTIFACT_SLOT_MAX;
  const disabled = owned || slotFull || state.gold < a.buyPrice;
  const btnText = owned ? '보유 중' : (slotFull ? '아티팩트 슬롯 부족' : `구매 (${a.buyPrice.toLocaleString()} G)`);
  return `
    <div class="scroll-card artifact">
      <div class="scroll-head">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="artifact-icon-box">${a.icon}</div>
          <span class="scroll-name-wrap">
            <span class="scroll-name artifact">${a.name}</span>
            <span class="tooltip">${a.desc}</span>
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
          <span class="scroll-name-wrap">
            <span class="scroll-name txt-shard">${item.name}</span>
            <span class="tooltip">${item.desc} (획득: ${item.source})</span>
          </span>
        </div>
        <span class="scroll-count">보유 ${owned}개</span>
      </div>
      <div class="scroll-body">
        <button class="scroll-buy" data-action="sell-misc" data-type="${id}" style="flex:1;" ${owned <= 0 ? 'disabled' : ''}>전부 판매 (개당 ${item.sellPrice} G)</button>
      </div>
    </div>`;
}
