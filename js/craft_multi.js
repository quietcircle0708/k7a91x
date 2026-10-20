// ============================================================
// 제작소: 비장비(소비/재료/마석) 반복 제작 — 연출·회차별 처리·중단·최종 결과
// 장비 제작(navigation.js openCraftAnim/finishCraftAnimProgress/clickCraftAnimIcon/closeCraftAnim, craftAnim 상태)과 완전히 분리된 상태(craftMultiRun)와
// 처리로 동작하며, 같은 모달(#craftAnimModal = modal-box craft-anim-box)의 아이콘·이름·로딩바·결과 아이콘 카드·[확인] 영역만 재활용함.
//
// 처리 규칙
// - 제작은 1개씩 개별 처리. 한 회차는 연출(로딩바 0→100%, CRAFT_MULTI_ROUND_MS) 동안 진행한 뒤, 회차 끝에서 "재료·골드·공간 확인 → 재료·골드 차감 → 촉매 효과 계산·소모
//   → 개별 성공/실패 판정 → 결과 즉시 지급 → 통계 갱신 → 저장"을 한 번에(동기적으로) 처리함. 저장이 끝나야 다음 회차가 시작됨.
//   (차감과 지급이 한 덩어리라 회차 도중 새로고침해도 재료만 사라지고 지급이 안 되는 상태가 생기지 않음 — 진행 중이던 회차는 취소된 것과 같음)
// - 천장(pityLimit)은 비장비 제작에 적용하지 않음(craftPityLimit이 0을 돌려줌 / 이 파일은 craftPityRecordResult를 호출하지 않음).
// - [중단]: 진행 중인 1회를 끝까지 마무리(처리·지급·저장)한 뒤 남은 회차를 취소함. 중복 클릭은 무시.
// - 결과는 회차마다 이미 지급·저장된 상태이며, 최종 결과 화면과 [확인]은 내역 표시/닫기만 함(다시 지급하지 않음).
// ============================================================

let craftMultiRun = null;
// run: { gapTimer(회차 사이 대기 타이머), category, itemId, total, done, success, fail, gained: [{ key, kind:'item'|'res', name?, damaged?, qty }], slots(장비 재료 등록 복사본),
//        phase: 'running'|'revealing'|'result', progress, roundStart, stopRequested, stopReason, ready, timer, orbTimer }

// ---- 인벤토리 공간 확인 ----
// 한 회차가 낼 수 있는 모든 결과(성공 시 제작 아이템 / 실패 시 반환 후보)를 지금 인벤토리가 안전하게 받을 수 있는지 판단해, 받을 수 없으면 막히는 카테고리를 반환(없으면 null).
// 기존 용량 규칙 그대로 — 이미 보유 중인 종류는 스택에 합쳐져 새 슬롯이 필요 없고, 새 종류만 카테고리 슬롯(inventorySlotsUsed/Max)을 차지함.
// 이번 회차에서 재료로 전부 소모돼 비게 되는 슬롯(일반 재료가 정확히 바닥나거나 재료 장비)은 빈 슬롯으로 계산함. slots는 장비 재료 등록 정보(제작 팝업 또는 진행 중 복사본).
function craftMultiSpaceBlock(item){
  const gain = {};   // 카테고리 → 새로 슬롯이 필요한 종류 키 집합
  const freed = {};  // 카테고리 → 이번 회차 재료 소모로 비는 슬롯 수
  let freedEquip = 0, foreignEquipReturn = false;
  const consumedEquip = new Set();
  const addKind = (cat, key, owned) => { if(owned) return; (gain[cat] = gain[cat] || new Set()).add(key); };
  if(item.iconType === 'consumable'){
    addKind('consumable', 'c:' + item.iconRef, ((state.consumables && state.consumables[item.iconRef]) || 0) > 0);
  } else {
    const def = craftItemDef(item);
    if(def) addKind(miscItemCategory(def), 'm:' + def.id, (state[def.stateKey] || 0) > 0);
  }
  (item.materials || []).forEach(m => {
    const r = findCraftResource(m.name);
    if(!r) return;
    if(r.kind === 'equip'){ freedEquip += m.need; consumedEquip.add(r.equipType + ':' + r.typeId); }
    else {
      const owned = state[r.def.stateKey] || 0, cat = miscItemCategory(r.def);
      if(owned > 0 && owned <= m.need) freed[cat] = (freed[cat] || 0) + 1;
    }
  });
  (item.failReturns || []).forEach(fr => {
    if(fr.none || !(fr.chance > 0)) return;
    const r = findCraftResource(fr.name);
    if(!r) return;
    if(r.kind === 'misc') addKind(miscItemCategory(r.def), 'm:' + r.def.id, (state[r.def.stateKey] || 0) > 0);
    else if(!consumedEquip.has(r.equipType + ':' + r.typeId)) foreignEquipReturn = true; // 투입했던 장비와 다른 장비가 반환되면 새 장비 슬롯이 필요
  });
  for(const cat of Object.keys(gain)){
    if(inventorySlotsUsed(cat) - (freed[cat] || 0) + gain[cat].size > inventorySlotMax(cat)) return cat;
  }
  if(foreignEquipReturn && inventorySlotsUsed('equipment') - freedEquip + 1 > inventorySlotMax('equipment')) return 'equipment';
  return null;
}

// 지금 이 회차 1개를 제작할 수 있는지(재료·골드·공간). 막히면 { reason:'material'|'space', category? }, 가능하면 null.
function craftMultiRoundBlock(run, item){
  if(state.gold < (item.craftCost || 0)) return { reason: 'material' };
  for(const m of item.materials){
    const resource = findCraftResource(m.name);
    if(craftResourceIsAutoMaterial(resource)){
      if(craftResourceOwnedCount(resource) < m.need) return { reason: 'material' };
    } else {
      const slot = run.slots.find(s => s.name === m.name);
      if(!slot || craftSlotValidPicks(slot, resource).length < m.need) return { reason: 'material' };
    }
  }
  const cat = craftMultiSpaceBlock(item);
  return cat ? { reason: 'space', category: cat } : null;
}

// ---- 지급(기존 지급 함수 재사용 + 유실 방지) ----
// 공간은 회차 시작 전에 확인하므로 정상 흐름에선 항상 지급에 성공함. 만에 하나 지급 함수가 실패해도 아이템이 사라지지 않도록 마지막 수단으로 용량을 무시하고 수량에 더함.
function craftMultiGiveConsumable(id, qty){
  if(grantConsumableStack(id, qty)) return;
  if(!state.consumables) state.consumables = {};
  state.consumables[id] = (state.consumables[id] || 0) + qty;
}
function craftMultiGiveMisc(def, qty){
  if(grantMiscStack(def, qty)) return;
  state[def.stateKey] = (state[def.stateKey] || 0) + qty;
}
function craftMultiRecordGain(run, key, entry){
  const found = run.gained.find(g => g.key === key);
  if(found) found.qty += entry.qty;
  else run.gained.push(Object.assign({ key }, entry));
}
// 이번 회차 결과 지급 — 성공: 제작 아이템 1개 / 실패: 추첨된 반환 아이템(장비 재료와 같은 종류면 투입했던 개체를 손상 상태로 반환). 투입 장비 중 반환되지 않은 것은 소모됨(장비 제작 규칙과 동일).
function craftMultiGrantRound(run, item, success, ret, held){
  if(success){
    if(item.iconType === 'consumable') craftMultiGiveConsumable(item.iconRef, 1);
    else craftMultiGiveMisc(craftItemDef(item), 1);
    craftMultiRecordGain(run, 'item', { kind: 'item', qty: 1 });
    return;
  }
  if(!ret) return;
  const resource = findCraftResource(ret.name);
  if(!resource) return;
  if(resource.kind === 'misc'){
    const qty = ret.need || 1;
    craftMultiGiveMisc(resource.def, qty);
    craftMultiRecordGain(run, 'res:' + ret.name + ':0', { kind: 'res', name: ret.name, damaged: false, qty });
    return;
  }
  const pool = EQUIP_INVENTORY_POOLS.find(p => p.kind === resource.equipType);
  const heldIdx = held.findIndex(h => h.equipType === resource.equipType && h.typeId === resource.typeId);
  if(heldIdx !== -1){
    const h = held.splice(heldIdx, 1)[0];
    pool.items().push({ id: state.nextItemId++, type: h.typeId, level: h.level, damaged: true, currentDurability: freshCurrentDurability(h.typeId, true) });
    craftMultiRecordGain(run, 'res:' + ret.name + ':1', { kind: 'res', name: ret.name, damaged: true, qty: 1 });
  } else {
    if(!grantRelicEquipDrop({ type: resource.typeId, level: 0, equipType: resource.equipType })){
      pool.items().push({ id: state.nextItemId++, level: 0, type: resource.typeId, currentDurability: freshCurrentDurability(resource.typeId) }); // 유실 방지(마지막 수단)
    }
    craftMultiRecordGain(run, 'res:' + ret.name + ':0', { kind: 'res', name: ret.name, damaged: false, qty: 1 });
  }
}

// 한 회차 처리(동기): 재료·골드 확인 → 차감 → 촉매 → 판정 → 지급 → 통계. 성공적으로 처리하면 true, 확인에 실패해 아무것도 하지 않았으면 false(stopReason 기록).
function craftMultiProcessRound(run){
  const item = findCraftItem(run.category, run.itemId);
  if(!item) { run.stopReason = 'material'; return false; }
  const block = craftMultiRoundBlock(run, item);
  if(block){ run.stopReason = block.reason; run.stopCategory = block.category || null; return false; }
  // 재료·골드 차감(이번 회차 1개 분량)
  state.gold -= (item.craftCost || 0);
  const held = [];
  item.materials.forEach(m => {
    const resource = findCraftResource(m.name);
    if(!resource) return;
    if(resource.kind === 'misc'){
      state[resource.def.stateKey] = Math.max(0, (state[resource.def.stateKey] || 0) - m.need);
      return;
    }
    const arr = EQUIP_INVENTORY_POOLS.find(p => p.kind === resource.equipType).items();
    const slot = run.slots.find(s => s.name === m.name);
    const used = craftSlotValidPicks(slot, resource).slice(0, m.need);
    used.forEach(pickId => {
      const idx = arr.findIndex(it => it.id === pickId);
      if(idx === -1) return;
      const [inst] = arr.splice(idx, 1);
      held.push({ equipType: resource.equipType, typeId: inst.type, level: inst.level });
    });
    slot.picks = slot.picks.filter(id => !used.includes(id)); slot.qty = slot.picks.length;
  });
  // 촉매: 시작 때 ON이었다면 이번 회차에 실제 적용되는 효과(성공 확률 증가)를 반영하고 1개분만 소모. OFF였다면 효과·소모 없음. 회차마다 다시 계산함.
  const plan = run.catalystOn ? catalystCraftPlan(item, 1) : [];
  const bonus = catalystCraftBonusPct(item, plan);
  catalystConsume(plan);
  // 개별 판정(회차당 한 번, 천장 없음) → 즉시 지급
  const success = Math.random() * 100 < Math.min(100, (item.successChance || 0) + bonus);
  const ret = success ? null : craftRollFailReturn(item);
  craftMultiGrantRound(run, item, success, ret, held);
  run.done++;
  if(success) run.success++; else run.fail++;
  return true;
}

// ---- 시작 / 진행 ----
function openCraftMulti(){
  if(craftMultiRun || craftAnim || !craftPopup) return;
  const item = findCraftItem(craftPopup.category, craftPopup.itemId);
  if(!item || !craftItemIsMulti(item) || !craftPopupCanCraft(craftPopup)) return;
  craftMultiRun = {
    category: craftPopup.category, itemId: craftPopup.itemId, total: craftPopupQty(craftPopup, item),
    done: 0, success: 0, fail: 0, gained: [],
    slots: craftPopup.slots.map(s => ({ name: s.name, qty: s.qty, picks: (s.picks || []).slice() })),
    phase: 'running', progress: 0, roundStart: 0, stopRequested: false, stopReason: null, stopCategory: null, ready: false, timer: null, orbTimer: null, gapTimer: null,
  };
  // 촉매는 시작 시점 기준으로 ON/OFF를 정함 — 제작 팝업에 표시된 것과 같은 기준(보유 수량 >= 총 필요량이면 ON, 부족하면 OFF: 효과·소모 없음). ON이면 회차마다 1개분씩 소모·적용.
  craftMultiRun.catalystOn = catalystCraftPlan(item, craftMultiRun.total).some(p => p.applied);
  renderCraftMultiModal();
  el('craftAnimModal').style.display = 'flex';
  const orb = () => spawnCraftAnimOrb({ shake: false }); // 비장비 반복 제작은 빛 구체는 그대로 쓰되 아이콘 흔들림은 적용하지 않음
  orb();
  craftMultiRun.orbTimer = setInterval(orb, 1000);
  craftMultiStartRound();
}
function craftMultiStartRound(){
  const run = craftMultiRun; if(!run) return;
  run.roundStart = Date.now();
  run.progress = 0;
  craftMultiBarSet(0, false); // 전환 없이 0%로 맞춘 뒤
  renderCraftMultiProgress();
  craftMultiBarSet(100, true); // 회차 연출 시간(CRAFT_MULTI_ROUND_MS) 동안 선형으로 100%까지 — 매 프레임 브라우저가 그려 부드럽게 차오름
  run.timer = setInterval(craftMultiTick, CRAFT_MULTI_TICK_MS);
}
function craftMultiTick(){
  const run = craftMultiRun; if(!run || run.phase !== 'running') return;
  const elapsed = Date.now() - run.roundStart;
  if(elapsed >= CRAFT_MULTI_ROUND_MS){
    clearInterval(run.timer); run.timer = null;
    craftMultiFinishRound();
    return;
  }
  run.progress = Math.round(elapsed / CRAFT_MULTI_ROUND_MS * 10000) / 100;
  renderCraftMultiProgress(); // 숫자(%)만 갱신 — 막대는 CSS 전환이 그림
}
// 회차 끝: 처리(차감·판정·지급·통계) → 저장 완료 → 다음 회차 / 종료 결정. 다음 회차는 현재 회차의 저장이 끝난 뒤에만 시작함.
async function craftMultiFinishRound(){
  const run = craftMultiRun; if(!run) return;
  run.progress = 100; craftMultiBarSet(100, false); renderCraftMultiProgress();
  const processed = craftMultiProcessRound(run);
  if(processed){ renderCraftMultiModal(); await saveState(); }
  if(craftMultiRun !== run) return; // 저장을 기다리는 사이 화면 이탈 등으로 정리된 경우
  if(!processed) return craftMultiFinalize(run.stopReason || 'material');
  if(run.done >= run.total) return craftMultiFinalize('done');
  if(run.stopRequested) return craftMultiFinalize('stopped');
  const next = craftMultiRoundBlock(run, findCraftItem(run.category, run.itemId)); // 다음 회차 시작 전 재료·골드·공간 재확인
  if(next){ run.stopReason = next.reason; run.stopCategory = next.category || null; return craftMultiFinalize(next.reason); }
  // 회차 사이 대기(CRAFT_MULTI_GAP_MS) — 현재 회차의 처리·저장이 모두 끝난 뒤, 계속 제작할 때만 적용(마지막 회차/중단/재료·공간 부족이면 위에서 이미 결과 화면으로 넘어감).
  // 로딩바는 100%가 한 프레임 그려진 뒤 바로 0%로 초기화되고, 0% 상태로 대기한 다음 다음 회차에서 다시 0%부터 차오름.
  // 대기는 회차 연출 시간에 포함되지 않으며, 대기 중 [중단]을 누르면 craftMultiRequestStop이 타이머를 해제하고 바로 결과 화면으로 전환함.
  await craftMultiNextFrame();
  if(craftMultiRun !== run || run.phase !== 'running') return;
  if(run.stopRequested) return craftMultiFinalize('stopped'); // 프레임을 기다리는 사이 [중단]이 눌린 경우
  run.progress = 0; craftMultiBarSet(0, false); renderCraftMultiProgress(); // 100%가 한 프레임 보인 뒤 즉시 0%로 초기화(전환 없음)
  run.gapTimer = setTimeout(() => {
    run.gapTimer = null;
    if(craftMultiRun !== run || run.phase !== 'running') return;
    if(run.stopRequested) return craftMultiFinalize('stopped');
    craftMultiStartRound();
  }, CRAFT_MULTI_GAP_MS);
}
// 다음 화면 갱신(프레임)까지 대기 — 100%로 그린 로딩바가 실제로 한 번 표시된 뒤 0%로 초기화하기 위함. rAF가 없는 환경은 타이머로 대체.
function craftMultiNextFrame(){
  return new Promise(resolve => {
    if(typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 16);
  });
}
// [중단] — 진행 중인 1회를 마무리한 뒤 남은 회차 취소. 한 번만 처리됨.
function craftMultiRequestStop(){
  const run = craftMultiRun;
  if(!run || run.phase !== 'running' || run.stopRequested) return;
  run.stopRequested = true;
  if(run.gapTimer){ // 회차 사이 대기 중 — 진행 중인 회차가 없으므로 다음 회차를 시작하지 않고 바로 결과 화면으로(finalize가 중복 실행되지 않도록 phase 가드가 있음)
    clearTimeout(run.gapTimer); run.gapTimer = null;
    craftMultiFinalize('stopped');
    return;
  }
  renderCraftMultiModal();
}
function craftMultiFinalize(reason){
  const run = craftMultiRun; if(!run || run.phase !== 'running') return;
  run.stopReason = reason;
  clearInterval(run.timer); clearInterval(run.orbTimer); clearTimeout(run.gapTimer); run.timer = null; run.orbTimer = null; run.gapTimer = null;
  if(run.total === 1 && run.done === 1){ // 1개 제작: 연출 후 실루엣을 자동으로 공개한 뒤 결과 화면으로
    run.phase = 'revealing';
    renderCraftMultiModal();
    triggerCraftAnimFlash();
    setTimeout(() => craftMultiShowResult(run), CRAFT_MULTI_REVEAL_MS);
  } else {
    craftMultiShowResult(run);
  }
}
// 같은 모달을 최종 결과 화면으로 전환. 지급·통계는 회차마다 끝났으므로 여기서는 저장 상태를 한 번 더 확정하고 필수 정보가 갖춰졌을 때만 [확인]을 활성화함(아이템을 다시 지급하지 않음).
async function craftMultiShowResult(run){
  if(craftMultiRun !== run || run.phase === 'result') return;
  run.phase = 'result';
  run.ready = false;
  renderCraftMultiModal();
  await saveState();
  if(craftMultiRun !== run) return;
  run.ready = craftMultiResultComplete(run);
  renderCraftMultiModal();
}
function craftMultiResultComplete(run){
  const item = findCraftItem(run.category, run.itemId);
  return !!item && !!item.name && craftItemIconHtml(item, 'inv-icon-img') !== '' && run.success + run.fail === run.done && run.done <= run.total;
}
// [확인](결과 화면) — 모달을 닫기만 함. 지급은 이미 끝나 있어 추가 지급 없음.
function closeCraftMulti(){
  const run = craftMultiRun;
  if(!run || run.phase !== 'result' || !run.ready) return;
  craftMultiTeardown();
  if(typeof craftMenuRefresh === 'function') craftMenuRefresh();
}
function craftMultiTeardown(){
  if(craftMultiRun){ clearInterval(craftMultiRun.timer); clearInterval(craftMultiRun.orbTimer); clearTimeout(craftMultiRun.gapTimer); }
  craftMultiRun = null;
  el('craftAnimModal').style.display = 'none';
  ['craftMultiStats', 'craftMultiGainedLabel', 'craftMultiGrid'].forEach(id => { el(id).style.display = 'none'; });
  el('craftAnimBarFill').style.transition = ''; // 장비 제작 로딩바는 기존 전환 효과 그대로 쓰도록 복원
}
// 제작소를 벗어나는 등 비정상 종료 — 회차 처리는 한 번에 끝나므로 어느 시점에 정리해도 재료만 사라지거나 중복 지급되는 상태가 없음.
function craftMultiAbort(){ if(craftMultiRun) craftMultiTeardown(); }
// 모달의 큰 버튼: 진행 중이면 [중단], 결과 화면이면 [확인]
function craftMultiOnButton(){
  const run = craftMultiRun; if(!run) return;
  if(run.phase === 'running') craftMultiRequestStop();
  else if(run.phase === 'result') closeCraftMulti();
}

// ---- 렌더 ----
// 획득 아이템의 등급 서열(craftGradeRank — 높을수록 값이 큼). 제작 아이템은 item.grade, 반환 아이템은 해당 아이템 정의의 등급.
function craftMultiGainedRank(run, g){
  if(g.kind === 'item'){ const item = findCraftItem(run.category, run.itemId); return craftGradeRank(item && item.grade); }
  const resource = findCraftResource(g.name);
  return craftGradeRank(resource && resource.def.grade);
}
// 획득 아이템 표시는 등급이 높은 순서대로 왼쪽부터 정렬(같은 등급끼리는 획득한 순서 유지). run.gained 원본/누적 수량은 건드리지 않음.
function craftMultiGainedHtml(run){
  const sorted = run.gained.map((g, i) => ({ g, i, rank: craftMultiGainedRank(run, g) }))
    .sort((a, b) => (b.rank - a.rank) || (a.i - b.i)).map(x => x.g);
  return sorted.map(g => {
    let color, icon, tip, label;
    if(g.kind === 'item'){
      const item = findCraftItem(run.category, run.itemId);
      color = craftItemNameColor(item); icon = craftItemIconHtml(item, 'inv-icon-img'); tip = craftItemTooltipHtml(item); label = item.name;
    } else {
      const resource = findCraftResource(g.name);
      if(!resource) return '';
      color = craftResourceColor(resource); icon = craftResourceIconHtml(resource, 'inv-icon-img');
      tip = (g.damaged && resource.equipType === 'weapon') ? buildWeaponTooltipHtml(resource.typeId, 0, true) : craftResourceTooltipHtml(resource);
      label = resource.def.name + (g.damaged ? '(손상)' : '');
    }
    return `
      <div class="craft-anim-result-item">
        <span class="inv-icon craft-anim-result-icon weapon-name-wrap" style="border-color:${color};">${icon}${g.qty > 1 ? `<span class="reward-item-qty">${g.qty}</span>` : ''}<span class="tooltip">${tip}</span></span>
        <div class="craft-anim-result-name" style="color:${color};">${label}</div>
      </div>`;
  }).join('');
}
function craftMultiResultNote(run){
  if(run.stopReason === 'stopped') return '제작을 중단했습니다.';
  if(run.stopReason === 'space') return `${inventoryFullMessage(run.stopCategory || 'misc')} 제작을 중단했습니다.`;
  if(run.stopReason === 'material') return '재료 또는 골드가 부족해 제작을 중단했습니다.';
  return '';
}
// 로딩바 막대 너비 설정. animate=true면 회차 연출 시간 동안 선형 전환(부드럽게 차오름), false면 전환 없이 즉시 적용(0%/100% 초기화·고정).
// .hp-bar-fill의 기본 전환(.25s)은 쓰지 않음 — 그대로 두면 100%→0% 초기화가 되돌아가며 보여 중간 구간만 오가는 것처럼 보였음.
function craftMultiBarSet(percent, animate){
  const bar = el('craftAnimBarFill');
  if(!animate){ bar.style.transition = 'none'; bar.style.width = percent + '%'; return; }
  void bar.offsetWidth; // 직전의 즉시 적용(0%)이 먼저 반영되도록 강제 리플로우 — 이후 전환이 0%에서 시작됨
  bar.style.transition = `width ${CRAFT_MULTI_ROUND_MS}ms linear`;
  bar.style.width = percent + '%';
}
function renderCraftMultiProgress(){
  const run = craftMultiRun; if(!run) return;
  el('craftAnimBarText').textContent = run.progress.toFixed(2) + '%';
}
function renderCraftMultiModal(){
  const run = craftMultiRun; if(!run) return;
  const item = findCraftItem(run.category, run.itemId);
  if(!item) return;
  const color = craftItemNameColor(item);
  const running = run.phase === 'running', result = run.phase === 'result';
  // 장비 제작 전용 요소는 숨기고(상태 잔류 방지) 이 화면에 필요한 요소만 표시
  el('craftAnimResultIcons').style.display = 'none';
  el('craftAnimClickHint').style.display = 'none';
  el('craftAnimResultHeadline').style.display = 'none';
  el('craftAnimIconBox').onclick = null;
  el('craftAnimIconBox').classList.remove('craft-anim-clickable', 'craft-anim-icon-shake'); // 이전 장비 제작에서 남은 흔들림 클래스가 비장비 제작에 영향을 주지 않도록 제거
  el('craftAnimHeader').textContent = result ? '제작 결과' : '';
  // 아이콘: 진행 중엔 실루엣, 1개 제작의 공개 단계와 결과 화면에선 실제 아이콘
  el('craftAnimIconBox').style.display = 'flex';
  el('craftAnimIconBox').innerHTML = craftItemIconHtml(item, 'inv-icon-img');
  el('craftAnimIconBox').style.borderColor = color;
  el('craftAnimIconBox').classList.toggle('craft-anim-silhouette', running);
  el('craftAnimName').style.display = 'block';
  el('craftAnimName').textContent = item.name;
  el('craftAnimName').style.color = color;
  // 진행 화면: "'이름' N개 제작 중..." + 로딩바 + (2개 이상일 때) 획득 아이템 누적 그리드
  el('craftAnimStageText').textContent = running ? `'${item.name}' ${Math.max(0, run.total - run.done)}개 제작 중...` : '';
  el('craftAnimBarWrap').style.display = running ? 'block' : 'none';
  const showGrid = (running && run.total >= 2) || result;
  const grid = el('craftMultiGrid');
  grid.style.display = showGrid ? 'flex' : 'none';
  grid.innerHTML = showGrid ? (craftMultiGainedHtml(run) || (result ? '<div class="craft-multi-none">획득한 아이템이 없습니다.</div>' : '')) : '';
  el('craftMultiGainedLabel').style.display = result ? 'block' : 'none';
  // 결과 화면: 제작/성공/실패 횟수(실제 완료된 회차 기준) + 중단/부족 사유
  const stats = el('craftMultiStats');
  stats.style.display = result ? 'block' : 'none';
  stats.innerHTML = result ? `<div>제작: ${run.done}회</div><div>성공: ${run.success}회</div><div>실패: ${run.fail}회</div>` : '';
  const note = result ? craftMultiResultNote(run) : '';
  el('craftAnimResultText').style.display = note ? 'block' : 'none';
  el('craftAnimResultText').textContent = note;
  // 큰 버튼: 진행 중 [중단](한 번 누르면 비활성) → 결과 화면 [확인](모든 정보·저장이 준비된 뒤에만 활성). 1개 제작의 공개 단계에서는 숨김
  el('craftAnimConfirmWrap').style.display = run.phase === 'revealing' ? 'none' : 'flex';
  const btn = el('craftAnimConfirmBtn');
  btn.textContent = running ? (run.stopRequested ? '중단 중...' : '중단') : '확인';
  btn.disabled = running ? run.stopRequested : !run.ready;
  renderCraftMultiProgress();
}
