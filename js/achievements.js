// ============================================================
// 업적 (일반 화면 + 던전 화면(데스크탑) 메뉴 팝업)
// ------------------------------------------------------------
// ■ 구조: 업적을 코드에 하나씩 만들지 않고 "표(ACHIEVEMENT_DEFS)" 한 줄로 정의함. 업적을 늘리려면 표에 한 줄만 추가하면 됨.
//     { id, cat(분류), title(제목), goal(목표 문장, {n}=이번 단계 목표 수치 — fmt가 단위까지 붙여 주므로 문장에는 단위를 또 쓰지 않음), value(현재 누적 수치를 돌려주는 함수),
//       fmt(수치 표기, 선택), tiers(단계별 목표 수치 배열 — 길이가 최대 단계, 1개면 한 번만 달성하는 업적), reward(보상, 선택) }
//   · 진행도(value)는 수령 여부와 상관없이 항상 실제 게임 기록(state의 기존 카운터 등)을 그대로 읽음 → 보상을 받지 않아도 누적/달성 표기가 실제로 됨.
//   · 수령한 단계 수만 state.achv.claimed[업적 id]에 저장함(숫자 하나). 화면에는 "수령한 단계 + 1"번째 단계를 보여주고,
//     목표를 넘겼으면 "달성"으로 표시 → 수령하면 곧바로 다음 단계가 열림(이미 넘긴 단계는 연달아 수령 가능). 단계를 늘려도 저장 데이터는 영향 없음.
// ■ 카운터: 업적용 누적 기록은 state.counters{ 키: 숫자 } 한 곳에 모으고, 게임 코드는 achvCount('키', 증가량) 한 줄만 호출함(저장은 호출한 곳의 saveState가 함께 함).
//   키 규칙: enhanceSuccess/enhanceFail/enhanceGold, traceRestore/damageRestore, craftEquip/craftConsumable/craftMaterial, kill:<몬스터 등급>,
//            relicGet/catalystGet/scrollGet, equipGet:<장비 등급>, skillUse, shopBought/shopSold. (기존 기록부 카운터 6개는 state의 원래 필드를 그대로 읽음)
//   기존 세이브에는 없던 기록이라 새 카운터는 업데이트 시점부터 쌓임(shopSold만 기존 누적 판매액으로 시작 — ACHIEVEMENT_COUNTER_BACKFILL).
// ■ 보상: 틀만 있음. reward = { kind: ACHIEVEMENT_REWARD_KINDS의 키, amount: 수량(null이면 "?" 표기) }. 실제 지급은 ACHIEVEMENT_CLAIM_ENABLED를 true로 바꾸고
//   achvGrantReward를 채우면 켜짐(지금은 [수령] 버튼이 항상 비활성).
// ■ 분류 탭은 표에 있는 분류만 자동으로 만들어짐(ACHIEVEMENT_CATEGORIES 순서). 새 분류는 CATEGORIES에 한 줄 + 표에 업적 추가.
// ■ 처음부터 다시 시작하면 업적(수령 기록)도 함께 초기화됨(state.js resetGame → ensureAchievementDefaults).
// ============================================================

const ACHIEVEMENT_CLAIM_ENABLED = false; // 보상 수령 가능 여부 — 보상 밸런스가 잡힌 뒤 true로

const ACHIEVEMENT_CATEGORIES = [
  { id: 'forge', label: '장비' },
  { id: 'craft', label: '제작·복구' },
  { id: 'dungeon', label: '던전' },
  { id: 'trade', label: '구매·판매' },
  // { id: 'once', label: '한 번만' }, // 한 번만 달성하는 업적(단계 1개)을 추가하면 이 줄을 켬
];

// 보상 종류별 표기(아이콘). 새 종류(아이템·경험치 등)를 쓰려면 여기에 한 줄 추가.
const ACHIEVEMENT_REWARD_KINDS = {
  gold: { name: '골드', icon: () => uiIconHtml('gold', 'achv-reward-img') },
};
const ACHIEVEMENT_REWARD_PLACEHOLDER = { kind: 'gold', amount: null }; // 보상을 따로 안 정한 업적의 기본 표기(수량 미정)

// 단계 수치 묶음(자주 쓰는 모양 — 표에서 이름으로 가져다 씀)
const ACHV_T_COUNT_SMALL = [1, 5, 10, 30, 50, 100, 300, 500, 1000];                 // 드물게 일어나는 일(횟수)
const ACHV_T_COUNT = [10, 50, 100, 300, 500, 1000, 3000, 5000, 10000];              // 흔한 일(횟수)
const ACHV_T_COUNT_LARGE = [10, 50, 100, 300, 500, 1000, 3000, 5000, 10000, 30000]; // 아주 흔한 일(횟수)
const ACHV_T_GOLD = [10000, 100000, 500000, 1000000, 5000000, 10000000, 50000000, 100000000]; // 누적 골드
const achvFmtCount = unit => v => `${v.toLocaleString()}${unit}`;
const achvFmtGold = v => `${v.toLocaleString()} G`;

// 업적 표. value는 현재 누적 수치: 기존 기록부 카운터는 state 필드를, 새 기록은 achvCounter('키')를 읽음.
const ACHIEVEMENT_DEFS = [
  // ---- 장비(강화) ----
  { id: 'enhanceAttempts', cat: 'forge', title: '끈기 있는 대장장이', goal: '강화를 {n} 시도하기',
    value: () => state.totalAttempts || 0, fmt: achvFmtCount('회'), tiers: ACHV_T_COUNT },
  { id: 'enhanceSuccess', cat: 'forge', title: '불꽃이 깃든 망치', goal: '강화에 {n} 성공하기',
    value: () => achvCounter('enhanceSuccess'), fmt: achvFmtCount('회'), tiers: ACHV_T_COUNT },
  { id: 'enhanceFail', cat: 'forge', title: '다시 한 번', goal: '강화에 {n} 실패하기 (파괴 제외)',
    value: () => achvCounter('enhanceFail'), fmt: achvFmtCount('회'), tiers: ACHV_T_COUNT },
  { id: 'enhanceDestroy', cat: 'forge', title: '부서진 꿈', goal: '장비를 {n} 파괴시키기',
    value: () => state.totalDestroys || 0, fmt: achvFmtCount('회'), tiers: ACHV_T_COUNT_SMALL },
  { id: 'enhanceBest', cat: 'forge', title: '더 높은 곳으로', goal: '장비를 {n}까지 강화하기',
    value: () => state.bestLevel || 0, fmt: v => `+${v}`,
    tiers: [...new Set([3, 5, 7, MAX_LEVEL])].filter(n => n <= MAX_LEVEL) },
  { id: 'enhanceLegend', cat: 'forge', title: '전설을 벼리는 자', goal: '전설 장비를 {n} 완성하기',
    value: () => state.legendCount || 0, fmt: achvFmtCount('회'), tiers: [1, 3, 5, 10, 30, 50, 100] },
  { id: 'enhanceGold', cat: 'forge', title: '아낌없는 투자', goal: '강화에 {n} 사용하기',
    value: () => achvCounter('enhanceGold'), fmt: achvFmtGold, tiers: ACHV_T_GOLD },
  // ---- 제작·복구 ----
  { id: 'traceRestore', cat: 'craft', title: '꺼지지 않는 흔적', goal: '흔적을 {n} 복구하기',
    value: () => achvCounter('traceRestore'), fmt: achvFmtCount('회'), tiers: ACHV_T_COUNT_SMALL },
  { id: 'damageRestore', cat: 'craft', title: '되살리는 손길', goal: '손상된 아이템을 {n} 복구하기 (성공 기준)',
    value: () => achvCounter('damageRestore'), fmt: achvFmtCount('회'), tiers: ACHV_T_COUNT_SMALL },
  { id: 'craftEquip', cat: 'craft', title: '장인의 첫걸음', goal: '장비 아이템을 {n} 제작하기 (성공 기준)',
    value: () => achvCounter('craftEquip'), fmt: achvFmtCount('회'), tiers: ACHV_T_COUNT_SMALL },
  { id: 'craftConsumable', cat: 'craft', title: '연금술사', goal: '소비 아이템을 {n} 제작하기 (성공 기준)',
    value: () => achvCounter('craftConsumable'), fmt: achvFmtCount('회'), tiers: ACHV_T_COUNT },
  { id: 'craftMaterial', cat: 'craft', title: '재료 가공사', goal: '재료 아이템을 {n} 제작하기 (성공 기준)',
    value: () => achvCounter('craftMaterial'), fmt: achvFmtCount('회'), tiers: ACHV_T_COUNT },
  // ---- 던전 ----
  { id: 'monsterKills', cat: 'dungeon', title: '굴 속의 사냥꾼', goal: '몬스터를 {n} 처치하기',
    value: () => state.totalKills || 0, fmt: achvFmtCount('마리'), tiers: ACHV_T_COUNT_LARGE },
  { id: 'killNormal', cat: 'dungeon', title: '사냥의 기본', goal: '일반 몬스터를 {n} 처치하기',
    value: () => achvCounter('kill:normal'), fmt: achvFmtCount('마리'), tiers: ACHV_T_COUNT_LARGE },
  { id: 'killEpic', cat: 'dungeon', title: '강자 사냥꾼', goal: '에픽 몬스터를 {n} 처치하기',
    value: () => achvCounter('kill:epic'), fmt: achvFmtCount('마리'), tiers: ACHV_T_COUNT_SMALL },
  { id: 'killUnique', cat: 'dungeon', title: '전설을 쓰러뜨린 자', goal: '유니크 몬스터를 {n} 처치하기',
    value: () => achvCounter('kill:unique'), fmt: achvFmtCount('마리'), tiers: [1, 3, 5, 10, 30, 50, 100] },
  { id: 'relicGet', cat: 'dungeon', title: '유해 수색가', goal: '모험가의 유해를 {n} 발견하기',
    value: () => achvCounter('relicGet'), fmt: achvFmtCount('개'), tiers: [1, 5, 10, 30, 50, 100, 300, 500] },
  { id: 'equipNormal', cat: 'dungeon', title: '낡은 장비 수집가', goal: '던전에서 일반 등급 장비를 {n} 획득하기',
    value: () => achvCounter('equipGet:normal'), fmt: achvFmtCount('개'), tiers: ACHV_T_COUNT },
  { id: 'equipRare', cat: 'dungeon', title: '쓸만한 장비', goal: '던전에서 레어 등급 장비를 {n} 획득하기',
    value: () => achvCounter('equipGet:rare'), fmt: achvFmtCount('개'), tiers: ACHV_T_COUNT_SMALL },
  { id: 'equipEpic', cat: 'dungeon', title: '빛나는 보물', goal: '던전에서 에픽 등급 장비를 {n} 획득하기',
    value: () => achvCounter('equipGet:epic'), fmt: achvFmtCount('개'), tiers: [1, 5, 10, 30, 50, 100, 300] },
  { id: 'equipUnique', cat: 'dungeon', title: '유일한 보물', goal: '던전에서 유니크 등급 장비를 {n} 획득하기',
    value: () => achvCounter('equipGet:unique'), fmt: achvFmtCount('개'), tiers: [1, 3, 5, 10, 30, 50, 100] },
  { id: 'catalystGet', cat: 'dungeon', title: '촉매 수집가', goal: '던전에서 촉매 아이템을 {n} 획득하기',
    value: () => achvCounter('catalystGet'), fmt: achvFmtCount('개'), tiers: [1, 5, 10, 30, 50, 100, 300] },
  { id: 'scrollGet', cat: 'dungeon', title: '기연의 서', goal: '던전에서 비급을 {n} 획득하기',
    value: () => achvCounter('scrollGet'), fmt: achvFmtCount('개'), tiers: [1, 3, 5, 10, 30, 50, 100] },
  { id: 'skillUse', cat: 'dungeon', title: '전투의 달인', goal: '스킬을 {n} 사용하기',
    value: () => achvCounter('skillUse'), fmt: achvFmtCount('회'), tiers: [10, 50, 100, 500, 1000, 3000, 5000, 10000, 30000, 50000] },
  // ---- 구매·판매 ----
  { id: 'shopBought', cat: 'trade', title: '단골 손님', goal: '상점에서 {n} 구매하기',
    value: () => achvCounter('shopBought'), fmt: achvFmtGold, tiers: ACHV_T_GOLD },
  { id: 'goldSold', cat: 'trade', title: '장사의 시작', goal: '상점에 판매해 누적 {n} 벌기', // 종류 상관없이 모든 판매 수익(achvCount('shopSold'))
    value: () => achvCounter('shopSold'), fmt: achvFmtGold, tiers: ACHV_T_GOLD },
];

// ---- 누적 기록(state.counters) ----
function achvCounter(key){ return (state.counters && state.counters[key]) || 0; }
function achvCount(key, n){
  const add = n == null ? 1 : Number(n);
  if(!Number.isFinite(add) || add <= 0) return;
  if(!state.counters || typeof state.counters !== 'object') state.counters = {};
  state.counters[key] = (state.counters[key] || 0) + add;
}
// 던전에서 지급이 확정된 획득 항목({kind:'equip'|'item'|'consumable'|'artifact', type, level, qty, relic, catalyst, scroll})을 한 번에 집계 — 몬스터 처치/11스테이지 보물 상자 공용
function achvCountDrops(drops){
  (drops || []).forEach(d => {
    if(d.kind === 'equip'){
      const grade = wpn(d.type).grade;
      if(grade) achvCount('equipGet:' + grade);
      if(d.relic) achvCount('relicGet');
    } else if(d.catalyst) achvCount('catalystGet', d.qty || 1);
    else if(d.scroll) achvCount('scrollGet', d.qty || 1);
  });
}

// ---- 저장 데이터(수령한 단계 수만 저장) ----
// 기존 세이브에 해당 키가 없을 때 시작값을 기존 기록으로 채우는 표(새 기록은 대부분 0부터 시작함)
const ACHIEVEMENT_COUNTER_BACKFILL = {
  shopSold: () => state.totalSold || 0, // 예전 누적 판매액(장비 판매분)을 시작값으로 이어받음
};
function ensureAchievementDefaults(){
  if(!state.achv || typeof state.achv !== 'object') state.achv = {};
  if(!state.achv.claimed || typeof state.achv.claimed !== 'object') state.achv.claimed = {};
  const claimed = state.achv.claimed;
  Object.keys(claimed).forEach(id => {
    const def = ACHIEVEMENT_DEFS.find(d => d.id === id);
    if(!def || !Number.isFinite(claimed[id]) || claimed[id] < 0) delete claimed[id]; // 표에서 사라졌거나 이상한 값은 정리
    else claimed[id] = Math.min(Math.floor(claimed[id]), def.tiers.length);
  });
  if(!state.counters || typeof state.counters !== 'object') state.counters = {};
  Object.keys(state.counters).forEach(k => { if(!Number.isFinite(state.counters[k]) || state.counters[k] < 0) delete state.counters[k]; });
  Object.keys(ACHIEVEMENT_COUNTER_BACKFILL).forEach(k => {
    if(!(k in state.counters)) state.counters[k] = Math.max(0, Number(ACHIEVEMENT_COUNTER_BACKFILL[k]()) || 0);
  });
}

// ---- 진행도 계산 ----
function achvStatus(def){
  const value = Math.max(0, Number(def.value()) || 0);
  const claimed = Math.min((state.achv && state.achv.claimed && state.achv.claimed[def.id]) || 0, def.tiers.length);
  const reached = def.tiers.filter(t => value >= t).length;     // 지금까지 달성한 단계 수(수령과 무관)
  const done = claimed >= def.tiers.length;                      // 모든 단계 수령 완료
  const tierIdx = Math.min(claimed, def.tiers.length - 1);       // 화면에 보여줄 단계(수령한 단계 + 1)
  const target = def.tiers[tierIdx];
  return { value, claimed, reached, pending: Math.max(0, reached - claimed), done, tierIdx, target };
}
function achvFmt(def, v){ return def.fmt ? def.fmt(v) : v.toLocaleString(); }
function achvGoalText(def, target){ return def.goal.replace('{n}', achvFmt(def, target)); }
function achvReward(def, tierIdx){
  const r = typeof def.reward === 'function' ? def.reward(tierIdx) : def.reward;
  return r || ACHIEVEMENT_REWARD_PLACEHOLDER;
}

// ---- 수령 ----
function achvGrantReward(def, tierIdx){
  // 보상 지급 자리(지금은 비어 있음): achvReward(def, tierIdx)의 kind/amount대로 골드·아이템 등을 지급하도록 채우면 됨.
}
function achvClaim(id){
  if(!ACHIEVEMENT_CLAIM_ENABLED) return;
  const def = ACHIEVEMENT_DEFS.find(d => d.id === id);
  if(!def) return;
  const st = achvStatus(def);
  if(st.done || st.pending <= 0) return;
  achvGrantReward(def, st.claimed);
  state.achv.claimed[id] = st.claimed + 1;
  saveState();
  achvRender(true);
}

// ---- 화면 ----
const achvUI = { cat: null, sig: '' };
function achvCategories(){
  return ACHIEVEMENT_CATEGORIES.filter(c => ACHIEVEMENT_DEFS.some(d => d.cat === c.id));
}
function achvRowHtml(def){
  const st = achvStatus(def);
  const pct = st.done ? 100 : Math.min(100, Math.floor(st.value / st.target * 100));
  const ready = !st.done && st.pending > 0;
  const rw = achvReward(def, st.tierIdx);
  const kind = ACHIEVEMENT_REWARD_KINDS[rw.kind] || ACHIEVEMENT_REWARD_KINDS.gold;
  const amountText = rw.amount == null ? '?' : Number(rw.amount).toLocaleString();
  const tierText = st.done ? '완료' : `${st.tierIdx + 1}/${def.tiers.length}`;
  const goal = st.done ? '모든 단계를 달성했습니다' : achvGoalText(def, st.target);
  const barText = st.done ? achvFmt(def, st.value) : `${achvFmt(def, st.value)} / ${achvFmt(def, st.target)}`;
  const claimTip = ACHIEVEMENT_CLAIM_ENABLED ? '보상 받기' : '보상 수령은 아직 열리지 않았습니다';
  const claimDisabled = !(ACHIEVEMENT_CLAIM_ENABLED && ready);
  return `<div class="achv-row${ready ? ' is-ready' : ''}${st.done ? ' is-done' : ''}" data-id="${def.id}">`
    + `<div class="achv-head"><span class="achv-title">${def.title}</span>`
    + `<span class="achv-tier">${ready ? `<span class="achv-ready-tag">달성${st.pending > 1 ? ' ×' + st.pending : ''}</span> ` : ''}${tierText}</span></div>`
    + `<div class="achv-goal">(${goal})</div>`
    + `<div class="achv-foot">`
    +   `<div class="achv-bar"><div class="achv-bar-fill" style="width:${pct}%"></div><span class="achv-bar-text">${barText}</span></div>`
    +   (st.done ? '' : `<div class="achv-reward" title="보상 준비 중 (${kind.name})">${kind.icon()}<span class="achv-reward-amt">${amountText}</span></div>`)
    +   `<button type="button" class="achv-claim" data-achv="${def.id}" ${claimDisabled ? 'disabled' : ''} title="${st.done ? '모든 보상을 수령했습니다' : claimTip}">`
    +     `${uiIconHtml('achvClaim', 'achv-claim-img')}<span>${st.done ? '완료' : '수령'}</span></button>`
    + `</div></div>`;
}
function achvRenderTabs(){
  const cats = achvCategories();
  if(!cats.some(c => c.id === achvUI.cat)) achvUI.cat = cats.length ? cats[0].id : null;
  el('achvTabs').innerHTML = cats.map(c =>
    `<button class="inv-box-tab ${c.id === achvUI.cat ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>`).join('');
}
function achvCurrentSig(){
  return ACHIEVEMENT_DEFS.map(d => d.value()).join(',') + '|' + JSON.stringify(state.achv && state.achv.claimed);
}
// force=true면 값이 안 바뀌어도 다시 그림. 스크롤 위치는 유지함.
function achvRender(force){
  if(!el('achvList')) return;
  const sig = achvCurrentSig() + '|' + achvUI.cat;
  if(!force && sig === achvUI.sig) return;
  achvUI.sig = sig;
  achvRenderTabs();
  const list = el('achvList');
  const top = list.scrollTop;
  const defs = ACHIEVEMENT_DEFS.filter(d => d.cat === achvUI.cat);
  list.innerHTML = defs.length ? defs.map(achvRowHtml).join('') : '<div class="achv-empty">표시할 업적이 없습니다.</div>';
  list.scrollTop = top;
}
// 화면/팝업을 열 때(navigation.js viewEnterInit): 항상 첫 분류 탭에서 새로 구성
function achvOpen(){
  achvUI.cat = null;
  achvUI.sig = '';
  achvRender(true);
  el('achvList').scrollTop = 0;
}
// render()가 자주 불리므로, 업적 화면(전체 화면 또는 팝업)이 열려 있고 값이 바뀐 경우에만 다시 그림
function achvRefresh(){
  if(typeof viewIsActive === 'function' && viewIsActive('achievements')) achvRender(false);
}

// ---- 클릭 처리(탭 전환 / 수령) ----
el('achvTabs').addEventListener('click', (ev) => {
  const btn = ev.target.closest('.inv-box-tab[data-cat]');
  if(!btn) return;
  achvUI.cat = btn.dataset.cat;
  el('achvList').scrollTop = 0;
  achvRender(true);
});
el('achvList').addEventListener('click', (ev) => {
  const btn = ev.target.closest('.achv-claim[data-achv]');
  if(btn && !btn.disabled) achvClaim(btn.dataset.achv);
});
