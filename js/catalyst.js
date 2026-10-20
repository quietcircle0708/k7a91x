// ===== 촉매 시스템(요청글 4~7번) =====
// 촉매 아이템 데이터(MISC_ITEMS[id].catalyst)와 공통 표(CATALYST_LEVEL_EXTRA)만 읽어 계산함 — 효과 수치/소모량을 코드에 고정하지 않음.
// 촉매 슬롯 = { id: 촉매 아이템 id(없으면 null), qty: 투입 수량 }. qty는 소생석처럼 수량을 직접 정하는 촉매에서만 의미가 있고,
// 강화석(필요 수량 자동 계산)·창조의 파편(1개 고정)은 필요 수량이 계산으로 정해짐.
// 컨텍스트 ctx: { mode: 'enhance', type, level } 강화 / { mode: 'craft', item } 제작 / { mode: 'restore', type } 손상 복구

function catalystDef(id){ const it = id != null ? MISC_ITEMS[id] : null; return it && it.catalyst ? it : null; }
function catalystOwned(id){ const it = catalystDef(id); return it ? (state[it.stateKey] || 0) : 0; }
// 소생석처럼 투입 수량을 플레이어가 위아래 버튼으로 정하는 촉매인지
function catalystQtyAdjustable(id){ const it = catalystDef(id); return !!it && it.catalyst.kind === 'reviveStone'; }
// 이 컨텍스트에서 쓸 수 있는 촉매 종류(kind) — 강화: 강화석/소생석, 제작: 창조의 파편, 손상 복구: 소생석
function catalystKindsFor(mode){
  return mode === 'craft' ? ['creationShard'] : mode === 'restore' ? ['reviveStone'] : ['enchantStone', 'reviveStone'];
}

function catalystEquipInfo(type){
  const w = type ? wpn(type) : null;
  return w ? { grade: w.grade, levelReq: w.levelReq || 0 } : null;
}
function catalystLevelExtra(levelReq){
  let extra = 0;
  CATALYST_LEVEL_EXTRA.forEach(([minLv, n]) => { if(levelReq >= minLv) extra = n; });
  return extra;
}
// 장비 정보가 없는 컨텍스트(장비 미선택)에서도 선택 목록에는 보여야 하므로 usable은 장비가 정해졌을 때만 판단함.
function catalystUsable(id, ctx){
  const it = catalystDef(id); if(!it) return false;
  const c = it.catalyst;
  if(!catalystKindsFor(ctx.mode).includes(c.kind)) return false;
  if(c.kind === 'enchantStone'){
    const eq = catalystEquipInfo(ctx.type);
    return !eq || c.baseCost[eq.grade] != null;
  }
  return true;
}
// 이 슬롯 촉매의 이번 작업 필요 수량(계산 불가면 null)
function catalystRequiredQty(slot, ctx){
  const it = catalystDef(slot && slot.id); if(!it) return null;
  const c = it.catalyst;
  if(c.kind === 'enchantStone'){
    const eq = catalystEquipInfo(ctx.type);
    if(!eq || c.baseCost[eq.grade] == null) return null; // 장비가 없거나 사용 불가 등급
    // 최종 소모량 = 기본 소모량 + (촉매 등급 = 장비 등급일 때만) 강화 단계별 추가 + 장비 요구 레벨별 추가.
    // 표의 +N은 강화 '목표' 단계: 현재 단계(ctx.level) → ctx.level + 1 시도에는 표의 +(level+1) 행을 씀(+8 → +9 시도 = +9 행).
    const step = it.grade === eq.grade ? (c.stepExtra[ctx.level + 1] || 0) : 0;
    return c.baseCost[eq.grade] + step + catalystLevelExtra(eq.levelReq);
  }
  if(c.kind === 'creationShard') return (c.craftMaxPerAttempt || 1) * (ctx.mode === 'craft' ? Math.max(1, ctx.qty || 1) : 1); // 제작 개수만큼 비례(기본 필요량은 아이템 1개 제작 기준)
  return Math.max(0, slot.qty || 0); // 소생석: 플레이어가 정한 수량
}
// 소생석 1개당 효과(%)와 합산 상한 — 장비 등급 기준. 강화: 파괴 확률 감소 / 수리: 성공 확률 증가(%p)
function reviveEnhanceReduceEach(it, grade){ return (it.catalyst.enhanceDestroyReducePct[grade]) || 0; }
function reviveRestoreBonusEach(it, grade){ return (it.catalyst.restoreBonusPct[grade]) || 0; }
// 소생석을 더 추가할 수 있는지(요청글 5번: 효과가 상한에 도달하면 더 추가할 수 없음). 강화는 합산 감소율 90%, 수리는 최종 확률 100%.
function reviveCanAddMore(slot, ctx){
  const it = catalystDef(slot && slot.id); if(!it || it.catalyst.kind !== 'reviveStone') return false; // 수량을 직접 정하는 촉매(소생석)만 해당
  const eq = catalystEquipInfo(ctx.type); if(!eq) return true;
  const qty = slot.qty || 0;
  if(ctx.mode === 'enhance'){
    return qty * reviveEnhanceReduceEach(it, eq.grade) < it.catalyst.enhanceDestroyReduceMaxPct;
  }
  if(ctx.mode === 'restore'){
    return ctx.baseChance + qty * reviveRestoreBonusEach(it, eq.grade) < 100;
  }
  return true;
}

// 슬롯 목록 → 이번 작업에 "실제로 적용될" 촉매 목록. 보유량이 필요 수량보다 부족하면 그 촉매의 효과만 적용하지 않음(작업은 계속 진행).
// 반환: [{ slotIndex, id, need, owned, applied }]
function catalystPlan(slots, ctx){
  const out = [];
  (slots || []).forEach((slot, i) => {
    const it = catalystDef(slot && slot.id); if(!it) return;
    const need = catalystUsable(slot.id, ctx) ? catalystRequiredQty(slot, ctx) : null;
    const owned = catalystOwned(slot.id);
    out.push({ slotIndex: i, id: slot.id, need, owned, applied: need != null && need > 0 && owned >= need });
  });
  return out;
}
// 적용된 촉매들을 소모(실제 작업 실행 시 보유량을 다시 확인해 모자라면 건너뜀 — 보유 수량보다 많이 소모하지 않음)
function catalystConsume(plan){
  plan.forEach(p => {
    if(!p.applied) return;
    const it = catalystDef(p.id);
    const have = state[it.stateKey] || 0;
    if(have >= p.need) state[it.stateKey] = have - p.need;
  });
}

// ---- 강화 확률 반영 ----
// 강화석: 성공 확률 × (1 + 증가율)을 촉매마다 차례로 적용(최대 100%), 늘어난 만큼은 "유지" 확률에서만 차감(파괴 확률은 건드리지 않음 — 집중의 기도와 같은 방식).
// 소생석: 적용 개수 × 장비 등급별 감소율을 합산(최대 enhanceDestroyReduceMaxPct)해 파괴 확률 × (1 − 감소율), 줄어든 만큼은 "유지"로 이동(보호의 기도와 같은 방식).
function catalystAdjustedOdds(baseOdds, plan, ctx){
  if(!baseOdds) return baseOdds;
  let [success, stay, destroy] = baseOdds;
  const eq = catalystEquipInfo(ctx.type);
  plan.forEach(p => {
    if(!p.applied) return;
    const it = catalystDef(p.id);
    if(it.catalyst.kind !== 'enchantStone') return;
    const next = Math.min(100, success * (1 + it.catalyst.successRatePct / 100));
    const inc = Math.max(0, next - success);
    const used = Math.min(inc, stay); // 유지가 모자라는 극단적인 경우에도 파괴는 건드리지 않음
    success += used; stay -= used;
  });
  let reducePct = 0, maxPct = 0;
  plan.forEach(p => {
    if(!p.applied) return;
    const it = catalystDef(p.id);
    if(it.catalyst.kind !== 'reviveStone' || !eq) return;
    reducePct += p.need * reviveEnhanceReduceEach(it, eq.grade);
    maxPct = Math.max(maxPct, it.catalyst.enhanceDestroyReduceMaxPct);
  });
  if(reducePct > 0){
    reducePct = Math.min(reducePct, maxPct);
    const newDestroy = destroy * (1 - reducePct / 100);
    stay += destroy - newDestroy; destroy = newDestroy;
  }
  return [success, stay, destroy];
}
// 강화 화면 컨텍스트(현재 선택된 강화 장비 기준)
function catalystEnhanceCtx(type, level){ return { mode: 'enhance', type, level }; }
// 강화 화면은 슬롯이 고정(왼쪽 강화석 / 오른쪽 소생석)이라 그 상태에서 직접 계획을 만듦. 켜짐(ON)인 것만 대상이고, 보유량이 필요 수량보다 모자라면 적용되지 않음.
function catalystEnhancePlan(type, level){
  if(state.forgeMode !== 'catalyst' || !type) return [];
  const ctx = catalystEnhanceCtx(type, level);
  const plan = [];
  const st = state.forgeStone;
  if(st.on && st.id && catalystUsable(st.id, ctx)){
    const need = catalystRequiredQty({ id: st.id, qty: 1 }, ctx), owned = catalystOwned(st.id);
    plan.push({ slotIndex: 0, id: st.id, need, owned, applied: need != null && need > 0 && owned >= need });
  }
  const rOwned = catalystOwned('reviveStone');
  if(state.forgeRevive > 0) plan.push({ slotIndex: 1, id: 'reviveStone', need: state.forgeRevive, owned: rOwned, applied: rOwned >= state.forgeRevive });
  return plan;
}

// ---- 강화 화면 고정 촉매 슬롯 조작 ----
// 선택된 강화 장비(없으면 null)
function catalystEnhanceTarget(){ const eq = getEquipped(); return eq ? { id: eq.id, type: eq.type || 'longsword', level: eq.level } : null; }
// 이 장비에서 사용 가능한 강화석 목록 — 아이템 등급 순서(WEAPON_GRADE_RANK, 낮은 등급 → 높은 등급). 등급을 코드에 고정하지 않고 데이터(MISC_ITEMS)와 등급 순서 표를 씀.
function catalystEnhanceStoneList(type){
  const ctx = { mode: 'enhance', type, level: 0 };
  return Object.values(MISC_ITEMS)
    .filter(it => it.catalyst && it.catalyst.kind === 'enchantStone' && catalystUsable(it.id, ctx))
    .sort((a, b) => WEAPON_GRADE_RANK[a.grade] - WEAPON_GRADE_RANK[b.grade]);
}
// 장비 등급과 같은 등급의 강화석(자동 선택 대상) — 사용 가능 목록에 없으면 null
function catalystEnhanceAutoStone(type){
  const eq = catalystEquipInfo(type);
  const hit = catalystEnhanceStoneList(type).find(it => it.grade === eq.grade);
  return hit ? hit.id : null;
}
// 화면을 그리기 전에 상태를 현재 장비/보유량에 맞춤: 장비가 바뀌었으면(또는 처음 선택) 그 장비 등급의 강화석을 자동 선택(켜짐은 OFF로 시작),
// 장비가 없으면 비움, 켜져 있는데 보유량이 모자라면 OFF, 소생석 투입 수량은 실제 보유량을 넘지 않게.
function catalystEnhanceSync(){
  if(isEnhancing) return; // 강화 진행 중에는 상태를 바꾸지 않음(연출이 끝난 뒤 반영)
  const tg = catalystEnhanceTarget(), st = state.forgeStone;
  if(!tg){ st.id = null; st.on = false; st.forId = null; }
  else if(st.forId !== tg.id){ st.id = catalystEnhanceAutoStone(tg.type); st.on = false; st.forId = tg.id; }
  if(tg && st.id){
    const need = catalystRequiredQty({ id: st.id, qty: 1 }, catalystEnhanceCtx(tg.type, tg.level));
    if(st.on && (need == null || catalystOwned(st.id) < need)) st.on = false;
  }
  state.forgeRevive = Math.min(state.forgeRevive, catalystOwned('reviveStone'));
}
function catalystEnhanceToggleStone(){
  const tg = catalystEnhanceTarget(), st = state.forgeStone;
  if(isEnhancing || state.forgeMode !== 'catalyst' || !tg || !st.id) return;
  if(st.on) st.on = false;
  else {
    const need = catalystRequiredQty({ id: st.id, qty: 1 }, catalystEnhanceCtx(tg.type, tg.level));
    if(need == null || catalystOwned(st.id) < need) return; // 보유 수량이 필요 수량보다 적으면 ON으로 바뀌지 않음
    st.on = true;
  }
  saveState(); render();
}
// 위(+1)/아래(-1): 이 장비에서 사용 가능한 강화석 중 한 단계 높은/낮은 등급으로 변경(사용 조건은 그대로 — 사용 불가인 강화석으로는 바꿀 수 없음)
function catalystEnhanceStoneNeighbor(dir){
  const tg = catalystEnhanceTarget(), st = state.forgeStone;
  if(!tg || !st.id) return null;
  const list = catalystEnhanceStoneList(tg.type);
  const i = list.findIndex(it => it.id === st.id);
  return i < 0 ? null : (list[i + dir] ? list[i + dir].id : null);
}
function catalystEnhanceShiftStone(dir){
  const tg = catalystEnhanceTarget(), st = state.forgeStone;
  if(isEnhancing || state.forgeMode !== 'catalyst' || !tg) return;
  const next = catalystEnhanceStoneNeighbor(dir);
  if(!next) return;
  st.id = next;
  const need = catalystRequiredQty({ id: next, qty: 1 }, catalystEnhanceCtx(tg.type, tg.level));
  if(st.on && (need == null || catalystOwned(next) < need)) st.on = false;
  saveState(); render();
}
// 소생석 투입 수량: 실제 보유량을 넘을 수 없고 0 미만 불가, 파괴 확률 감소 상한(90%)에 도달하면 더 늘릴 수 없음. 1개 이상이면 자동 ON, 0개면 OFF.
function catalystEnhanceCanAddRevive(){
  const tg = catalystEnhanceTarget();
  if(state.forgeRevive >= catalystOwned('reviveStone')) return false;
  return !tg || reviveCanAddMore({ id: 'reviveStone', qty: state.forgeRevive }, { mode: 'enhance', type: tg.type, level: tg.level });
}
function catalystEnhanceAdjustRevive(delta){
  if(isEnhancing || state.forgeMode !== 'catalyst') return;
  if(delta > 0 && !catalystEnhanceCanAddRevive()) return;
  if(delta < 0 && state.forgeRevive <= 0) return;
  state.forgeRevive += delta > 0 ? 1 : -1;
  saveState(); render();
}

// ---- 강화 판정 중 확률 고정 ----
// 촉매 소모로 보유량이 줄어도 "이번 시도"의 확률 표시/판정이 바뀌지 않도록 startEnhance가 시도 시작 시점의 확률을 보관하고
// resolveEnhance가 결과를 반영하면서 지움(effectivePrayerOdds가 이 값이 있으면 그대로 돌려줌).
let forgeEnhOddsLock = null;

// ---- 슬롯 저장소 / 등록 / 해제 ----
function catalystSlotsFor(mode){
  return mode === 'craft' ? state.craftCatalysts : state.restoreCatalysts; // 강화 화면은 고정 슬롯(state.forgeStone/forgeRevive)이라 선택창·슬롯 배열을 쓰지 않음
}
// 이 컨텍스트에서 이미 다른 슬롯에 등록된 촉매인지(같은 종류는 한 슬롯에만)
function catalystRegisteredElsewhere(mode, slot, id){
  return catalystSlotsFor(mode).some((s, i) => i !== slot && s.id === id);
}
// 변경 후 화면 갱신 — 강화 화면은 render()가, 제작/손상 복구 팝업은 각 팝업 렌더가 담당
function catalystRefreshUi(mode){
  render();
  if(mode === 'craft' && craftPopup) renderCraftPopup();
  if(mode === 'restore' && restorePopup) renderRestorePopup();
}
// 창조의 파편이 이 컨텍스트에서 아무 효과가 없는 상태인지 — 제작 성공 확률이 이미 100%(천장 도달 등)이면 true. 이때는 등록할 수 없고(ON 불가),
// 이미 등록돼 있어도 '적용 안 됨'으로 표시되며 소모되지 않음(catalystCraftPlan). 90%처럼 100% 미만이면 증가량이 남아돌더라도 정상 적용·소모됨.
function catalystShardPointless(id, ctx){
  const it = catalystDef(id);
  if(!it || it.catalyst.kind !== 'creationShard' || !ctx || ctx.mode !== 'craft' || !ctx.item) return false;
  return craftEffectiveSuccessChance(ctx.item) >= 100;
}
function catalystRegister(mode, slot, id){
  const slots = catalystSlotsFor(mode);
  const s = slots[slot];
  if(!s || !catalystDef(id) || isEnhancing) return false;
  if(catalystRegisteredElsewhere(mode, slot, id)) return false;
  if(s.id !== id && catalystShardPointless(id, catalystPickerCtx(mode))) return false; // 이미 100%라 효과 없는 창조의 파편은 등록(ON) 불가
  if(s.id !== id){ s.id = id; s.qty = catalystQtyAdjustable(id) ? 1 : 0; }
  saveState(); catalystRefreshUi(mode);
  return true;
}
function catalystClearSlot(mode, slot){
  const s = catalystSlotsFor(mode)[slot];
  if(!s || s.id == null || isEnhancing) return;
  s.id = null; s.qty = 0;
  saveState(); catalystRefreshUi(mode);
}

// ---- 촉매 선택창(공용) ----
// 열려 있는 동안 { mode, slot }. 목록: 이 컨텍스트에서 쓸 수 있는 촉매만(강화는 장비 등급으로 사용 불가인 강화석 제외).
// 한 번 클릭 = 이 슬롯에 등록/변경, 이미 이 슬롯에 등록된 항목을 데스크톱 우클릭·모바일 더블 클릭 = 등록 취소.
let catalystPicker = null;
let catalystPickerClickTimer = null;
function catalystPickerCtx(mode){
  if(mode === 'enhance'){ const eq = getEquipped(); return { mode, type: eq ? (eq.type || 'longsword') : null, level: eq ? eq.level : 0 }; }
  if(mode === 'craft'){ const item = craftPopup ? findCraftItem(craftPopup.category, craftPopup.itemId) : null; return { mode, item, qty: item ? craftPopupQty(craftPopup, item) : 1 }; }
  const f = restorePopup ? resolveRestoreTarget(restorePopup.target) : null;
  return { mode, type: f ? f.type : null, baseChance: f ? restoreChanceFor(f.type) : 0 };
}
function openCatalystPicker(mode, slot){
  if(isEnhancing) return;
  catalystPicker = { mode, slot };
  renderCatalystPicker();
  document.getElementById('craftCatalystModal').style.display = 'flex';
}
function closeCatalystPicker(){
  catalystPicker = null;
  document.getElementById('craftCatalystModal').style.display = 'none';
}
function renderCatalystPicker(){
  const wrap = document.getElementById('catalystPickList');
  if(!wrap || !catalystPicker) return;
  const { mode, slot } = catalystPicker;
  const ctx = catalystPickerCtx(mode);
  const slots = catalystSlotsFor(mode);
  const kinds = catalystKindsFor(mode);
  const rows = Object.values(MISC_ITEMS).filter(it => it.catalyst && kinds.includes(it.catalyst.kind) && catalystUsable(it.id, ctx));
  if(rows.length === 0){ wrap.innerHTML = '<div class="inv-empty">사용할 수 있는 촉매가 없습니다.</div>'; return; }
  wrap.innerHTML = `<div class="forge-select-list">${rows.map(it => {
    const g = WEAPON_GRADES[it.grade];
    const owned = catalystOwned(it.id);
    const need = catalystRequiredQty({ id: it.id, qty: 1 }, ctx);
    const active = slots[slot] && slots[slot].id === it.id;
    const pointless = !active && catalystShardPointless(it.id, ctx);
    const taken = catalystRegisteredElsewhere(mode, slot, it.id) || pointless;
    return `
      <button class="forge-select-item${active ? ' active' : ''}${owned <= 0 ? ' cat-none' : ''}" data-id="${it.id}"${taken ? ' disabled' : ''}>
        <span class="inv-icon weapon-name-wrap" style="border-color:${g.color};">${itemIconHtml(it, 'inv-icon-img')}<span class="tooltip">${buildMiscTooltipHtml(it.id)}</span></span>
        <span class="forge-select-info">
          <span class="forge-select-name" style="color:${g.color};">${it.name}</span>
          <span class="inv-badge">보유 ${owned}개${need != null && !catalystQtyAdjustable(it.id) && mode === 'enhance' ? ` · 필요 ${need}개` : ''}${pointless ? ' · 성공 확률이 이미 100%' : (taken ? ' · 다른 슬롯에 등록됨' : '')}</span>
        </span>
      </button>`;
  }).join('')}</div>`;
}
(function catalystPickerInit(){
  const wrap = document.getElementById('catalystPickList');
  if(!wrap) return;
  const isMobile = () => document.body.classList.contains('mobile-preset');
  wrap.addEventListener('click', e => {
    const b = e.target.closest('.forge-select-item'); if(!b || !catalystPicker || b.disabled) return;
    const { mode, slot } = catalystPicker;
    const active = catalystSlotsFor(mode)[slot].id === b.dataset.id;
    if(isMobile() && active){ // 모바일: 등록된 항목을 더블 클릭하면 취소(한 번 클릭은 그대로 선택 유지 후 닫힘)
      if(catalystPickerClickTimer){ clearTimeout(catalystPickerClickTimer); catalystPickerClickTimer = null; catalystClearSlot(mode, slot); closeCatalystPicker(); return; }
      catalystPickerClickTimer = setTimeout(() => { catalystPickerClickTimer = null; closeCatalystPicker(); }, 280);
      return;
    }
    if(catalystRegister(mode, slot, b.dataset.id) || active) closeCatalystPicker();
  });
  wrap.addEventListener('contextmenu', e => {
    const b = e.target.closest('.forge-select-item'); if(!b || !catalystPicker || isMobile()) return;
    e.preventDefault();
    const { mode, slot } = catalystPicker;
    if(catalystSlotsFor(mode)[slot].id === b.dataset.id){ catalystClearSlot(mode, slot); closeCatalystPicker(); }
  });
})();

// 수량 조절(소생석) — 0개 미만 불가, 효과가 상한(강화: 파괴 확률 감소 90% / 손상 복구: 성공 확률 100%)에 도달하면 더 늘릴 수 없음
function catalystAdjust(mode, slot, delta){
  const s = catalystSlotsFor(mode)[slot];
  if(isEnhancing || !s || s.id == null || !catalystQtyAdjustable(s.id)) return;
  if(delta > 0 && !reviveCanAddMore(s, catalystPickerCtx(mode))) return;
  s.qty = Math.max(0, s.qty + delta);
  saveState(); catalystRefreshUi(mode);
}

// ---- 제작: 창조의 파편(요청글 6번) ----
// 제작 성공 확률 + craftSuccessBonusPct(%p), 제작 1회당 최대 craftMaxPerAttempt개, 최종 100% 상한. 이미 100%(천장 도달 등)면 효과가 의미 없어 적용·소모하지 않음.
function catalystCraftPlan(item, qty){ // qty: 비장비 제작 개수(생략 시 1 — 장비 제작)
  if(!item) return [];
  const base = craftEffectiveSuccessChance(item);
  let usedShard = false;
  return catalystPlan(state.craftCatalysts, { mode: 'craft', item, qty: qty || 1 }).map(p => {
    const c = catalystDef(p.id).catalyst;
    if(!p.applied || c.kind !== 'creationShard') return p;
    if(base >= 100 || usedShard) return { ...p, applied: false }; // 1회당 1개까지만 / 이미 100%면 소모하지 않음
    usedShard = true;
    return p;
  });
}
function catalystCraftBonusPct(item, plan){
  const base = craftEffectiveSuccessChance(item);
  let bonus = 0;
  plan.forEach(p => { if(p.applied) bonus += catalystDef(p.id).catalyst.craftSuccessBonusPct || 0; });
  return Math.max(0, Math.min(bonus, 100 - base));
}
// 제작 팝업에 표시할 성공 확률(촉매 적용 후). 실제 판정은 finishCraftAnimProgress가 시작 시점에 확정한 보너스를 더해 같은 값을 씀.
function craftSuccessChanceWithCatalyst(item, qty){
  return craftEffectiveSuccessChance(item) + catalystCraftBonusPct(item, catalystCraftPlan(item, qty));
}

// ---- 손상 복구: 소생석(요청글 5번) ----
// 복구 성공 확률 + 소생석 개수 × 장비 등급별 증가량(%p), 최종 100% 상한.
function catalystRestorePlan(type){
  return catalystPlan(state.restoreCatalysts, { mode: 'restore', type, baseChance: type ? restoreChanceFor(type) : 0 });
}
function catalystRestoreChance(type, plan){
  let chance = restoreChanceFor(type);
  const eq = catalystEquipInfo(type);
  plan.forEach(p => {
    const it = catalystDef(p.id);
    if(p.applied && it.catalyst.kind === 'reviveStone' && eq) chance += p.need * reviveRestoreBonusEach(it, eq.grade);
  });
  return Math.min(100, chance);
}

// ---- 제작/손상 복구 팝업의 촉매 슬롯 3칸(공용 렌더 + 조작) ----
function catalystPopupRowHtml(mode){
  const ctx = catalystPickerCtx(mode);
  return catalystSlotsFor(mode).map((s, i) => {
    const filled = s.id != null;
    const it = filled ? catalystDef(s.id) : null;
    const need = filled && catalystUsable(s.id, ctx) ? catalystRequiredQty(s, ctx) : null;
    const owned = filled ? catalystOwned(s.id) : 0;
    const off = filled && catalystShardPointless(s.id, ctx); // 확률이 이미 100%라 적용되지 않는 창조의 파편 — 비활성 표시, 소모 없음
    const short = filled && !off && (need == null || owned < need);
    const g = it ? WEAPON_GRADES[it.grade] : null;
    const inner = filled
      ? `<span class="inv-icon craft-slot-icon-box weapon-name-wrap" style="border-color:${g.color};${off ? 'opacity:.45;' : ''}">${itemIconHtml(it, 'inv-icon-img')}<span class="tooltip">${buildMiscTooltipHtml(s.id)}</span></span>
         <span class="${off ? 'craft-slot-qty-off' : (short ? 'craft-slot-qty-short' : 'craft-slot-qty-ok')}">${off ? '미적용' : `${owned}/${need == null ? '-' : need}`}</span>
         <span class="craft-slot-name" style="color:${g.color};">${it.name}</span>`
      : '<span class="craft-slot-plus">+</span>';
    const adj = filled && catalystQtyAdjustable(s.id)
      ? `<div class="craft-cat-qty"><button class="craft-cat-qty-btn" data-dir="1" data-slot="${i}"${reviveCanAddMore(s, ctx) ? '' : ' disabled'}>▲</button><button class="craft-cat-qty-btn" data-dir="-1" data-slot="${i}"${s.qty <= 0 ? ' disabled' : ''}>▼</button></div>`
      : '';
    return `<div class="craft-cat-cell"><button class="craft-slot craft-cat-slot${short ? ' short' : ''}" data-slot="${i}">${inner}</button>${adj}</div>`;
  }).join('');
}
function catalystRenderPopupRow(mode){
  const box = document.getElementById(mode === 'craft' ? 'craftPopupCatalysts' : 'restorePopupCatalysts');
  if(!box) return;
  const html = catalystPopupRowHtml(mode);
  if(box.dataset.h !== html){ box.innerHTML = html; box.dataset.h = html; } // 내용이 같으면 다시 그리지 않음(열려 있는 툴팁 유지)
}
(function catalystPopupInit(){
  const isMobile = () => document.body.classList.contains('mobile-preset');
  const timers = {};
  [['craft', 'craftPopupCatalysts'], ['restore', 'restorePopupCatalysts']].forEach(([mode, boxId]) => {
    const box = document.getElementById(boxId); if(!box) return;
    box.addEventListener('click', e => {
      const q = e.target.closest('.craft-cat-qty-btn');
      if(q){ if(!q.disabled) catalystAdjust(mode, Number(q.dataset.slot), Number(q.dataset.dir)); return; }
      const b = e.target.closest('.craft-cat-slot'); if(!b) return;
      const slot = Number(b.dataset.slot);
      const filled = catalystSlotsFor(mode)[slot].id != null;
      if(!isMobile() || !filled){ openCatalystPicker(mode, slot); return; }
      // 모바일: 한 번 = 선택창(더블 클릭과 구분하려고 잠깐 기다림), 더블 클릭 = 등록 취소
      const key = mode + slot;
      if(timers[key]){ clearTimeout(timers[key]); timers[key] = null; catalystClearSlot(mode, slot); return; }
      timers[key] = setTimeout(() => { timers[key] = null; openCatalystPicker(mode, slot); }, 280);
    });
    box.addEventListener('contextmenu', e => { // 데스크톱: 우클릭 = 등록 취소(이 슬롯 위에서만 기본 메뉴를 막음)
      const b = e.target.closest('.craft-cat-slot'); if(!b || isMobile()) return;
      e.preventDefault();
      catalystClearSlot(mode, Number(b.dataset.slot));
    });
  });
})();
