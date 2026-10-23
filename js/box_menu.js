// ============================================================
// 상자 시스템 — 소비 아이템 class '상자'의 사용(오픈) 절차와 화면.
//   · 데이터 = data.js CONSUMABLES의 상자 항목(boxType 'random'|'select', contents) + 공통 상수(BOX_* — 규칙·연출 시간·문구)
//   · 툴팁 = formulas.js buildConsumableTooltipHtml(상자 분기) / 판매 = 기존 상점 판매(sellPrice 100G 고정, 오픈 없이 판매 가능)
//   · 인벤토리 [사용] = inventory_box.js(신버전)·render.js(구버전) → openBoxModal(boxId)
// 절차: [사용] → 구성품 안내 UI(랜덤형: 획득 가능 아이템·확률 / 선택형: 선택 가능 아이템) → [사용]
//   → (랜덤형) 추첨 연출 / (선택형) 곧바로 결과 → 지급 아이템·당첨 텍스트 → [확인].
// 지급·저장 타이밍: [사용]을 누르는 순간 "추첨(랜덤형) → 상자 1개 차감 → 아이템 지급 → 저장"을 한 번에 끝냄. 연출/결과 화면은
//   이미 저장된 결과를 보여 주기만 하므로, 연출 중 브라우저를 닫아도 지급 결과는 달라지지 않음.
// 공간 부족: 랜덤형은 구성품 중 하나라도 넣을 수 없으면 추첨 전에 막고(상자 미소모), 선택형은 고른 아이템만 검사함 — 추첨 후 못 받는
//   결과가 나오면 재시도로 원하는 결과를 고를 수 있게 되는 문제를 막기 위함. 상자 자신이 마지막 1개라 비워지는 소비 슬롯은 용량 계산에 포함됨.
// 새 화면은 index.html의 #boxUseModal 하나이며, 단계(목록 → 대기 → 연출 → 결과)만 안에서 바꿈(새 창을 띄우지 않음).
// ============================================================

const BOX_EQUIP_KINDS = ['weapon', 'armor', 'sub', 'accessory'];
let boxUI = null; // { itemId, stage: 'list'|'wait'|'rolling'|'result', entries, selectedKey, result, msg, timers[], slotInfo } — 화면 상태(저장하지 않음)

// ---- 구성품 정규화 ----
function boxEquipDef(id){
  return WEAPON_TYPES[id] || ARMOR_TYPES[id] || ACCESSORY_TYPES[id] || SUB_TYPES[id] || null; // wpn()은 없는 id를 낡은 대검으로 대체하므로 직접 조회
}
// 구성품 하나 → 화면/지급에 필요한 정보. 데이터에 없는 아이템이면 null(목록에서 빠짐).
function boxContentInfo(c, idx){
  if(!c) return null;
  const qty = Math.max(1, Math.floor(c.qty || 1));
  const weight = c.weight > 0 ? c.weight : 1;
  if(BOX_EQUIP_KINDS.includes(c.kind)){
    const def = boxEquipDef(c.id);
    if(!def) return null;
    const tip = def.equipType === 'armor' ? buildArmorTooltipHtml(c.id, 0)
      : def.equipType === 'accessory' ? buildAccessoryTooltipHtml(c.id, 0)
      : def.equipType === 'sub' ? buildSubTooltipHtml(c.id, 0)
      : buildWeaponTooltipHtml(c.id, 0);
    return { key: 'k' + idx, c, kind: c.kind, id: c.id, qty, weight, category: 'equipment', name: def.name, gradeKey: def.grade,
      color: weaponNameColor(c.id, 0), price: (def.sell && def.sell[0]) || def.sellPrice || 0,
      iconHtml: weaponIconHtml(c.id, 'box-icon-img'), tooltipHtml: tip };
  }
  if(c.kind === 'consumable'){
    const def = CONSUMABLES[c.id];
    if(!def) return null;
    const g = consumableGradeInfo(def);
    return { key: 'k' + idx, c, kind: c.kind, id: c.id, qty, weight, category: 'consumable', name: def.name, gradeKey: def.grade,
      color: g ? g.color : '#ffffff', price: def.sellPrice || 0,
      iconHtml: itemIconHtml(def, 'box-icon-img'), tooltipHtml: buildConsumableTooltipHtml(c.id) };
  }
  if(c.kind === 'misc'){
    const def = MISC_ITEMS[c.id];
    if(!def) return null;
    const isStone = def.itemClass === 'stone';
    return { key: 'k' + idx, c, kind: c.kind, id: c.id, qty, weight, category: miscItemCategory(def), name: def.name, gradeKey: def.grade,
      color: isStone ? stoneNameColor(c.id) : miscNameColor(c.id), price: def.sellPrice || 0,
      iconHtml: itemIconHtml(def, 'box-icon-img'), tooltipHtml: isStone ? buildStoneTooltipHtml(c.id) : buildMiscTooltipHtml(c.id) };
  }
  return null;
}
// 표시 순서 — 랜덤형: 당첨 확률 낮은 순 → 등급 높은 순 → 판매 가격 높은 순 → 가나다 순 / 선택형: 등급 높은 순 → 판매 가격 높은 순 → 가나다 순.
function boxSortedEntries(item){
  const isRandom = item.boxType === 'random';
  return (item.contents || []).map((c, i) => boxContentInfo(c, i)).filter(Boolean).sort((a, b) =>
    (isRandom ? (a.weight - b.weight) : 0) // 같은 구성품 합계로 나눈 확률이므로 가중치 비교 = 확률 비교
    || ((WEAPON_GRADE_RANK[b.gradeKey] ?? -1) - (WEAPON_GRADE_RANK[a.gradeKey] ?? -1))
    || (b.price - a.price)
    || a.name.localeCompare(b.name, 'ko'));
}
function boxGradeTag(info){ const g = WEAPON_GRADES[info.gradeKey]; return g ? `[${g.label}]` : ''; }
function boxQtyText(info){ return info.qty > 1 ? ` ×${info.qty}` : ''; }
function boxProbText(info, entries){
  const total = entries.reduce((s, e) => s + e.weight, 0) || 1;
  return `${+(info.weight / total * 100).toFixed(2)}%`; // 소수점 둘째 자리까지(뒤의 0은 생략)
}
function boxJosaEulReul(word){
  const code = (word || '').charCodeAt((word || '').length - 1);
  if(code >= 0xAC00 && code <= 0xD7A3) return ((code - 0xAC00) % 28) !== 0 ? '을' : '를';
  return '를';
}

// ---- 지급 가능 여부 / 지급 / 추첨 ----
// 상자 1개를 먼저 차감한 상태를 기준으로 용량을 봄(마지막 1개면 소비 슬롯이 비므로). 호출하는 쪽이 차감/복구를 책임짐.
function boxCanReceiveRaw(info){
  if(info.category === 'equipment') return totalEquipInventoryCount() + info.qty <= INV_MAX;
  if(info.category === 'consumable') return canAcquireInCategory('consumable', ((state.consumables && state.consumables[info.id]) || 0) > 0);
  const def = MISC_ITEMS[info.id];
  return canAcquireInCategory(info.category, (state[def.stateKey] || 0) > 0);
}
function boxCanReceive(boxId, info){
  const owned = (state.consumables && state.consumables[boxId]) || 0;
  if(!state.consumables) return false;
  state.consumables[boxId] = owned - 1;
  try{ return boxCanReceiveRaw(info); }
  finally{ state.consumables[boxId] = owned; }
}
function boxGrantRaw(info){
  if(info.category === 'equipment'){
    for(let i = 0; i < info.qty; i++) if(!grantRelicEquipDrop({ equipType: info.kind, level: 0, type: info.id })) return false;
    return true;
  }
  if(info.category === 'consumable') return grantConsumableStack(info.id, info.qty);
  return grantMiscStack(MISC_ITEMS[info.id], info.qty);
}
// 상자 1개 차감 + 지급을 한 번에 처리. 지급할 수 없으면 아무것도 바꾸지 않고 false.
function boxConsumeAndGrant(boxId, info){
  const owned = (state.consumables && state.consumables[boxId]) || 0;
  if(owned <= 0) return false;
  state.consumables[boxId] = owned - 1;
  if(!boxCanReceiveRaw(info) || !boxGrantRaw(info)){ state.consumables[boxId] = owned; return false; }
  return true;
}
function boxRollEntry(entries){
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for(const e of entries){ r -= e.weight; if(r < 0) return e; }
  return entries[entries.length - 1];
}

// ---- 열기/닫기 ----
function openBoxModal(itemId){
  const item = CONSUMABLES[itemId];
  if(!isBoxItem(item) || !BOX_TYPES[item.boxType]) return;
  if(((state.consumables && state.consumables[itemId]) || 0) <= 0) return;
  const entries = boxSortedEntries(item);
  if(entries.length === 0) return; // 구성품이 없는 상자는 열 수 없음(데이터 오류 방어)
  boxClearTimers();
  boxUI = { itemId, stage: 'list', entries, selectedKey: null, result: null, msg: '', timers: [], slotInfo: null };
  renderBoxModal();
  el('boxUseModal').style.display = 'flex';
}
function boxClearTimers(){
  if(boxUI && boxUI.timers) boxUI.timers.forEach(id => clearTimeout(id));
  if(boxUI) boxUI.timers = [];
}
function closeBoxModal(){
  boxClearTimers();
  boxUI = null;
  el('boxUseModal').style.display = 'none';
  render();
}

// ---- 화면 ----
function boxTitleHtml(item){
  const g = consumableGradeInfo(item);
  return `<div class="box-title" style="color:${g ? g.color : 'var(--forge-cream)'};">${item.name}</div>`;
}
function boxBtnHtml(act, label, cls, disabled){
  return `<button class="${cls}${disabled ? ' is-disabled' : ''}" data-box-act="${act}" ${cls.includes('btn-main') ? 'style="width:auto; padding:10px 18px;"' : ''}>${label}</button>`;
}
function boxSlotHtml(info, withTip, extraCls){
  if(!info) return `<span class="box-slot ${extraCls || ''}" id="boxSlot"></span>`;
  return `<span class="box-slot ${extraCls || ''}${withTip ? ' weapon-name-wrap' : ''}" id="boxSlot" style="border-color:${info.color};">${info.iconHtml}${withTip ? `<span class="tooltip">${info.tooltipHtml}</span>` : ''}</span>`;
}
function boxResultTextHtml(info){
  const nameHtml = `<b style="color:${info.color};">${info.name}${boxQtyText(info)}</b>`;
  return BOX_TEXTS.resultTemplate.replace('{name}', nameHtml).replace('{josa}', boxJosaEulReul(info.name));
}
function renderBoxModal(){
  const ui = boxUI;
  if(!ui) return;
  const item = CONSUMABLES[ui.itemId];
  const box = el('boxUseModal').querySelector('.box-modal');
  const scrollTop = (box.querySelector('.box-scroll') || {}).scrollTop || 0;
  const isRandom = item.boxType === 'random';
  let h = boxTitleHtml(item);

  if(ui.stage === 'list' || ui.stage === 'wait'){
    const locked = ui.stage === 'wait'; // 연출 대기 중에는 취소·사용 비활성
    h += `<div class="box-subtitle">${isRandom ? BOX_TEXTS.randomListTitle : BOX_TEXTS.selectListTitle}</div>`;
    if(isRandom){
      h += `<div class="box-scroll">` + ui.entries.map(e => `
        <div class="box-entry">
          <span class="weapon-name-wrap box-entry-name" style="color:${e.color};">${boxGradeTag(e)}${e.name}${boxQtyText(e)}<span class="tooltip">${e.tooltipHtml}</span></span>
          <span class="box-entry-prob">(${boxProbText(e, ui.entries)})</span>
        </div>`).join('') + `</div>`;
    } else {
      h += `<div class="box-scroll">` + ui.entries.map(e => {
        const ok = boxCanReceive(ui.itemId, e);
        return `
        <div class="box-select-row${ui.selectedKey === e.key ? ' active' : ''}${ok ? '' : ' is-unavailable'}" data-box-act="select" data-box-key="${e.key}">
          <span class="box-slot weapon-name-wrap" data-box-icon="1" style="border-color:${e.color};">${e.iconHtml}<span class="tooltip">${e.tooltipHtml}</span></span>
          <span class="box-select-name" style="color:${e.color};">${e.name}${boxQtyText(e)}</span>
          ${ok ? '' : `<span class="box-select-tag">${BOX_TEXTS.fullTag}</span>`}
        </div>`;
      }).join('') + `</div>`;
      h += `<div class="box-guide">${BOX_TEXTS.selectGuide}</div>`;
    }
    h += `<div class="box-msg" id="boxMsg">${ui.msg || ''}</div>`;
    const useDisabled = locked || (!isRandom && !ui.selectedKey);
    h += `<div class="modal-actions">${boxBtnHtml('cancel', BOX_TEXTS.cancel, 'nav-btn', locked)}${boxBtnHtml('use', BOX_TEXTS.use, 'btn btn-main', useDisabled)}</div>`;
  } else {
    // 연출(rolling)·결과(result): 지급 아이템 화면. 연출 중에는 슬롯만 바뀌고 이름·텍스트·확인은 비어 있거나 비활성.
    const done = ui.stage === 'result';
    h += `<div class="box-subtitle">${BOX_TEXTS.grantTitle}</div>`;
    h += `<div class="box-grant-slot">${boxSlotHtml(done ? ui.result : ui.slotInfo, done, 'box-slot-grant')}</div>`;
    h += `<div class="box-grant-name" id="boxGrantName">${done ? `<span style="color:${ui.result.color}; font-weight:700;">${ui.result.name}${boxQtyText(ui.result)}</span>` : ''}</div>`;
    h += `<div class="box-grant-text" id="boxGrantText">${done ? boxResultTextHtml(ui.result) : ''}</div>`;
    h += `<div class="modal-actions">${boxBtnHtml('ok', BOX_TEXTS.ok, 'btn btn-main', !done)}</div>`;
  }
  box.innerHTML = h;
  const sc = box.querySelector('.box-scroll');
  if(sc) sc.scrollTop = scrollTop;
}

// ---- 동작 ----
function boxSelectRow(key){
  const ui = boxUI;
  if(!ui || ui.stage !== 'list') return;
  const info = ui.entries.find(e => e.key === key);
  if(!info || !boxCanReceive(ui.itemId, info)) return;
  ui.selectedKey = key;
  ui.msg = '';
  renderBoxModal(); // 스크롤 위치는 renderBoxModal이 보존함
}
function boxShowMsg(text){
  if(!boxUI) return;
  boxUI.msg = text;
  const m = el('boxMsg');
  if(m) m.textContent = text;
}
function boxPressUse(){
  const ui = boxUI;
  if(!ui || ui.stage !== 'list') return;
  const item = CONSUMABLES[ui.itemId];
  if(((state.consumables && state.consumables[ui.itemId]) || 0) <= 0){ closeBoxModal(); return; }
  let info;
  if(item.boxType === 'random'){
    if(!ui.entries.every(e => boxCanReceive(ui.itemId, e))){ boxShowMsg(BOX_TEXTS.full); return; } // 하나라도 넣을 수 없으면 추첨 전에 막음(상자 미소모)
    info = boxRollEntry(ui.entries);
  } else {
    info = ui.entries.find(e => e.key === ui.selectedKey);
    if(!info) return;
    if(!boxCanReceive(ui.itemId, info)){ boxShowMsg(BOX_TEXTS.full); return; }
  }
  if(!boxConsumeAndGrant(ui.itemId, info)){ boxShowMsg(BOX_TEXTS.full); return; }
  ui.result = info;
  render();
  saveState(); // 추첨·차감·지급이 끝난 이 시점에 곧바로 저장 — 이후 연출은 결과를 보여 주기만 함
  if(item.boxType === 'random'){
    ui.stage = 'wait';
    renderBoxModal();
    ui.timers.push(setTimeout(boxBeginSpin, BOX_ROLL_WAIT_MS));
  } else {
    ui.stage = 'result';
    renderBoxModal();
  }
}
// 연출 스케줄: 빠른 구간(일정 간격) → 점점 느려지는 구간 → 마지막 프레임(당첨 아이템). 슬롯 자체는 가만히 있고 안의 아이콘만 바뀜.
function boxBuildSchedule(){
  const times = [0];
  let t = 0;
  while(t + BOX_ROLL_FAST_INTERVAL_MS <= BOX_ROLL_FAST_MS){ t += BOX_ROLL_FAST_INTERVAL_MS; times.push(t); }
  let iv = BOX_ROLL_SLOW_START_INTERVAL_MS;
  while(t + iv < BOX_ROLL_SPIN_MS - 60){ t += iv; times.push(t); iv *= BOX_ROLL_SLOW_GROWTH; }
  times.push(BOX_ROLL_SPIN_MS);
  return times;
}
function boxSetSlot(info, withTip){
  const slot = el('boxSlot');
  if(!slot) return;
  slot.classList.toggle('weapon-name-wrap', !!withTip);
  slot.style.borderColor = info.color; // 연출 중 바뀌는 아이콘마다 그 아이템의 등급 색 테두리
  slot.innerHTML = info.iconHtml + (withTip ? `<span class="tooltip">${info.tooltipHtml}</span>` : '');
}
function boxBeginSpin(){
  const ui = boxUI;
  if(!ui || ui.stage !== 'wait') return;
  ui.stage = 'rolling';
  const entries = ui.entries;
  const times = boxBuildSchedule();
  const frames = [];
  for(let i = 0; i < times.length - 1; i++){
    let pick = entries[Math.floor(Math.random() * entries.length)];
    const prev = frames[i - 1];
    if(entries.length > 1){
      let guard = 0;
      while((pick === prev || (i === times.length - 2 && pick === ui.result)) && guard++ < 20) pick = entries[Math.floor(Math.random() * entries.length)];
    }
    frames.push(pick);
  }
  frames.push(ui.result); // 마지막 프레임 = 이미 확정·저장된 당첨 아이템
  ui.slotInfo = frames[0];
  renderBoxModal();
  times.forEach((tm, i) => {
    if(i === 0) return;
    ui.timers.push(setTimeout(() => {
      if(!boxUI || boxUI.stage !== 'rolling') return;
      if(i === times.length - 1) boxSetSlot(frames[i], true); // 멈춘 뒤에는 툴팁 연결
      else boxSetSlot(frames[i], false);
    }, tm));
  });
  ui.timers.push(setTimeout(boxReveal, BOX_ROLL_SPIN_MS + BOX_ROLL_RESULT_DELAY_MS));
}
function boxReveal(){
  const ui = boxUI;
  if(!ui || ui.stage === 'result') return;
  boxClearTimers();
  ui.stage = 'result';
  renderBoxModal();
}
// 연출 도중(대기 포함) 화면을 한 번 더 누르면 연출을 건너뛰고 곧바로 결과 표시
function boxSkip(){
  if(!boxUI || (boxUI.stage !== 'wait' && boxUI.stage !== 'rolling')) return;
  boxReveal();
}

document.addEventListener('click', (e) => {
  if(!boxUI) return;
  const modal = el('boxUseModal');
  if(!modal || !modal.contains(e.target)) return;
  if(boxUI.stage === 'wait' || boxUI.stage === 'rolling'){ boxSkip(); return; } // 비활성처럼 보이는 버튼을 눌러도 건너뛰기로 처리
  const act = e.target.closest('[data-box-act]');
  if(!act) return;
  const kind = act.dataset.boxAct;
  if(kind === 'cancel'){ closeBoxModal(); return; }
  if(kind === 'ok'){ if(boxUI.stage === 'result') closeBoxModal(); return; }
  if(kind === 'use'){ boxPressUse(); return; }
  if(kind === 'select'){
    // 모바일에서는 아이콘을 누르면 툴팁만 보이고(선택 안 함), 줄의 나머지를 눌러야 선택됨
    if(document.body.classList.contains('mobile-preset') && e.target.closest('[data-box-icon]')) return;
    boxSelectRow(act.dataset.boxKey);
  }
});
