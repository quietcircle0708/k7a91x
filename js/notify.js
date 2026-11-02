// ================= 알림 점(빨간 원) =================
// 인벤토리의 새 아이템 / 습득 가능한 스킬 / 투자 가능한 스탯처럼 "확인해 볼 것이 있다"는 표시를 탭과 아이콘 슬롯에 작은 빨간 원으로 띄워 줌.
// 메뉴마다 따로 만들지 않도록 아래 세 가지로 일반화해 둠 — 새 메뉴에 같은 효과를 붙일 때는 ①에 규칙 한 줄 + HTML에 속성 한두 개만 추가하면 됨.
//
// ① 규칙(NOTIFY_RULES): { id, path, mode, keys() }
//    - path : 점이 속한 위치("메뉴/탭/소탭", 예: 'inventory/equipment'). 하위 경로에 점이 있으면 상위 경로(inventory, '*'=전체)에도 자동으로 점이 붙음.
//    - keys(): 지금 알릴 항목의 키 목록(비어 있으면 알림 없음). 키는 슬롯의 data-notify-key 값과 같은 문자열(예: 'inv:weapon:12', 'skill:five_strike').
//    - mode : 'seen'  = 처음 알린 항목은 "확인했다"고 처리될 때까지 표시(확인: 그 슬롯에 마우스를 올리거나 터치 / 그 탭에 들어갔다가 다른 탭·화면으로 이동 —
//                       이동 확인은 규칙의 path와 같은 범위를 떠났을 때만 처리되므로, 규칙의 path는 화면에서 실제로 "들어가는" 가장 안쪽 탭 단위로 둘 것),
//             'state' = 조건이 참인 동안 계속 표시(확인 처리 없음, 예: 남은 스탯 포인트).
// ② 화면 범위(NOTIFY_SCOPE_PROVIDERS): 지금 화면에 "들어와 있는" 경로 목록(바깥 탭부터 안쪽 탭까지)을 돌려주는 함수들. 범위에서 빠져나가면(다른 탭/화면으로 이동)
//    path가 그 범위와 같은 'seen' 규칙의 항목이 확인 처리됨(들어간 적 없는 다른 안쪽 탭의 항목은 그대로 남음).
// ③ HTML 속성: 탭/메뉴 버튼에는 data-notify-path="경로", 슬롯에는 data-notify-key="키"를 붙이면 됨. 점은 CSS(.has-notify::after)가 그리고,
//    notifySync()가 상태에 맞춰 .has-notify 클래스를 켜고 끔 — 각 화면이 HTML을 어떻게 다시 그리든(캐시/통째 교체) 마지막에 한 번에 맞춰짐.
// ④ 수량(선택): 규칙에 qtys() { 키: 현재 수량 }을 주면 스택 아이템은 "확인한 뒤 수량이 늘어도" 다시 알림. 확인 시점의 수량을 state.notifySeenQty에 기억해 두고,
//    수량이 줄면 기준도 같이 낮춤(쓰고 다시 얻은 것도 알림). 수량이 없는 키(장비/스킬 등)는 기존처럼 처음 알릴 때만 표시됨.
// 저장되는 값은 확인한 키 목록(state.notifySeen)과 스택 아이템의 확인 당시 수량(state.notifySeenQty)뿐이고 나머지는 모두 현재 상태에서 계산한 값임.

const NOTIFY_MIN_INTERVAL_MS = 120; // 동기화 최소 간격 — render()가 자주 불려도 이 간격보다 촘촘하게 계산하지 않음
const NOTIFY_SAVE_DELAY_MS = 800;   // 확인 처리 후 저장을 모아서 한 번만

function notifySkillKeys(categoryId, kindId){
  // 지금 한 번 눌러 배울 수 있는 스킬(레벨·포인트·선행 스킬 조건 충족) 중 이 분류·세로 탭에 속한 것
  return Object.keys(SKILLS)
    .filter(id => SKILLS[id].category === categoryId && skillVerticalTabOf(SKILLS[id]) === kindId && canLearnSkill(id))
    .map(id => 'skill:' + id);
}
// 스킬 탭 안에서 지금 보고 있는 분류·세로 탭까지의 범위 목록(캐릭터 메뉴와 던전 우측 카드가 같은 activeSkillCategory/activeSkillKind를 공유함)
function notifySkillScopes(){
  return ['character/skill', 'character/skill/' + activeSkillCategory, 'character/skill/' + activeSkillCategory + '/' + activeSkillKind];
}
function notifyRules(){
  return [
    // 인벤토리: 탭마다 규칙 하나(탭이 추가되면 INV_BOX_TABS/invBoxKeys만 맞추면 자동으로 따라옴). 키는 슬롯 data-key와 같은 형식에 'inv:'를 붙인 것.
    ...INV_BOX_TABS.map(t => ({ id: 'inv-' + t.id, path: 'inventory/' + t.id, mode: 'seen', keys: () => invBoxKeys(t.id).map(k => 'inv:' + k),
      qtys: () => { const m = invBoxQtys(t.id), o = {}; Object.keys(m).forEach(k => { o['inv:' + k] = m[k]; }); return o; } })),
    // 스킬: 분류(공용/특화/기연) × 세로 탭(공격/버프/패시브)마다 규칙 하나 — 각 탭 버튼에 점이 붙고, 보고 있던 탭만 이동할 때 확인 처리됨.
    ...SKILL_CATEGORIES.flatMap(c => SKILL_KIND_TABS.map(k => ({
      id: 'skill-' + c.id + '-' + k.id, path: 'character/skill/' + c.id + '/' + k.id, mode: 'seen', keys: () => notifySkillKeys(c.id, k.id),
    }))),
    { id: 'stat-points', path: 'character/info/info', mode: 'state', keys: () => (state.statPoints || 0) > 0 ? ['stat:points'] : [] },
  ];
}
const NOTIFY_SCOPE_PROVIDERS = [
  // 인벤토리 화면: 보고 있는 탭
  () => viewIsActive('inventory') ? ['inventory/' + invBoxUI.tab] : [], // 전체 화면 또는 메뉴 팝업으로 열려 있을 때
  // 캐릭터 메뉴: 보고 있는 탭(+캐릭터 정보 탭이면 소탭)
  () => {
    if(!viewIsActive('character') || !activeCharTab) return []; // 전체 화면 또는 메뉴 팝업으로 열려 있을 때
    if(activeCharTab === 'skill') return notifySkillScopes();
    return ['character/' + activeCharTab].concat(activeCharTab === 'info' ? ['character/info/' + activeCharInfoSubtab] : []);
  },
  // 던전 우측 카드: 화면에 보일 때만(모바일에서 접혀 있으면 제외). 스킬 탭은 스킬 목록이 있는 2페이지일 때만 "들어와 있는" 것으로 봄.
  () => {
    if(currentView !== 'hunt') return [];
    const panel = el('huntCharTabPanels');
    if(!panel || panel.clientWidth === 0) return [];
    if(huntCharTab === 'skill') return pageState.huntCharSkill === 2 ? notifySkillScopes() : [];
    if(huntCharTab === 'info') return ['character/info', 'character/info/' + huntCharInfoSubtab];
    return [];
  },
];

let notifyLastScopes = [];
let notifyTimer = 0, notifyLastRun = 0, notifySaveTimer = 0;

function notifySeenMap(){
  if(!state.notifySeen || typeof state.notifySeen !== 'object') state.notifySeen = {};
  return state.notifySeen;
}
function notifyQtySeenMap(){
  if(!state.notifySeenQty || typeof state.notifySeenQty !== 'object') state.notifySeenQty = {};
  return state.notifySeenQty;
}
// 키 하나를 "확인함"으로 기록: 확인 플래그 + (스택 아이템이면) 그때의 수량. 바뀐 게 있으면 true.
function notifyAck(k, qtys){
  const seen = notifySeenMap(), qs = notifyQtySeenMap();
  let changed = false;
  if(!seen[k]){ seen[k] = 1; changed = true; }
  if(qtys && qtys[k] != null && qs[k] !== qtys[k]){ qs[k] = qtys[k]; changed = true; }
  return changed;
}
// 지금 점을 켜야 하는 'seen' 키인지: 아직 확인 안 했거나, 스택 아이템인데 확인한 수량보다 늘었으면 true.
function notifyIsLive(k, qtys){
  const seen = notifySeenMap();
  if(!seen[k]) return true;
  if(qtys && qtys[k] != null){
    const base = notifyQtySeenMap()[k];
    return base !== undefined && qtys[k] > base;
  }
  return false;
}
function notifyScopes(){
  const out = [];
  NOTIFY_SCOPE_PROVIDERS.forEach(p => { try{ p().forEach(s => { if(!out.includes(s)) out.push(s); }); }catch(_){} });
  return out;
}
// 현재 상태에서 규칙별 키를 계산함: [{ rule, keys }]
function notifyEvaluate(){
  return notifyRules().map(rule => ({ rule, keys: rule.keys(), qtys: rule.qtys ? rule.qtys() : null }));
}
// 범위를 떠났을 때: path가 그 범위와 같은 'seen' 규칙의 현재 키를 전부 확인 처리. 바뀐 게 있으면 true.
function notifyMarkScope(scope, evaluated){
  let changed = false;
  evaluated.forEach(({ rule, keys, qtys }) => {
    if(rule.mode !== 'seen' || rule.path !== scope) return;
    keys.forEach(k => { if(notifyAck(k, qtys)) changed = true; });
  });
  return changed;
}
// 처음 도입된 세이브(notifySeen 없음)는 지금 보유한 것을 모두 확인한 것으로 시작해서, 업데이트 직후 모든 곳에 점이 뜨지 않게 함(state.js applyLoadedRaw).
function notifySeedSeen(){
  notifyEvaluate().forEach(({ rule, keys, qtys }) => { if(rule.mode === 'seen') keys.forEach(k => { notifyAck(k, qtys); }); });
}
function notifySaveSoon(){
  clearTimeout(notifySaveTimer);
  notifySaveTimer = setTimeout(() => { if(typeof saveState === 'function') saveState(); }, NOTIFY_SAVE_DELAY_MS);
}
function notifySync(){
  notifyLastRun = performance.now();
  const evaluated = notifyEvaluate();
  const seen = notifySeenMap();
  let changed = false;
  // 1) 화면 범위를 떠난 곳의 'seen' 항목 확인 처리
  const cur = notifyScopes();
  notifyLastScopes.forEach(s => { if(!cur.includes(s) && notifyMarkScope(s, evaluated)) changed = true; });
  notifyLastScopes = cur;
  // 2) 더 이상 존재하지 않는 키는 확인 목록에서 제거 — 목록이 계속 커지지 않고, 아이템을 다 쓴 뒤 다시 얻으면 다시 새 아이템으로 표시됨
  const all = new Set();
  evaluated.forEach(({ keys }) => keys.forEach(k => all.add(k)));
  const qs = notifyQtySeenMap();
  Object.keys(seen).forEach(k => { if(!all.has(k)){ delete seen[k]; delete qs[k]; changed = true; } });
  Object.keys(qs).forEach(k => { if(!all.has(k)){ delete qs[k]; changed = true; } });
  // 스택 아이템의 확인 수량 보정: 수량이 줄었으면 기준도 낮춤, 수량 기능 도입 전 세이브(확인 표시만 있고 기준 수량 없음)는 지금 수량을 기준으로 시작
  evaluated.forEach(({ rule, qtys }) => {
    if(rule.mode !== 'seen' || !qtys) return;
    Object.keys(qtys).forEach(k => {
      if(!seen[k]) return;
      if(qs[k] === undefined || qs[k] > qtys[k]){ qs[k] = qtys[k]; changed = true; }
    });
  });
  // 3) 표시: 알림이 있는 키/경로(상위 경로 포함)를 모으고 DOM의 점 클래스를 맞춤
  const keySet = new Set(), pathSet = new Set();
  evaluated.forEach(({ rule, keys, qtys }) => {
    const live = rule.mode === 'state' ? keys : keys.filter(k => notifyIsLive(k, qtys));
    if(!live.length) return;
    live.forEach(k => keySet.add(k));
    const seg = rule.path.split('/');
    for(let i = 1; i <= seg.length; i++) pathSet.add(seg.slice(0, i).join('/'));
    pathSet.add('*');
  });
  document.querySelectorAll('[data-notify-path]').forEach(e => e.classList.toggle('has-notify', pathSet.has(e.dataset.notifyPath)));
  document.querySelectorAll('[data-notify-key]').forEach(e => e.classList.toggle('has-notify', keySet.has(e.dataset.notifyKey)));
  document.body.classList.toggle('notify-off', !(state.settings && state.settings.notifyDots !== false)); // 설정에서 끄면 점만 숨김(확인 처리는 그대로 진행)
  if(changed) notifySaveSoon();
}
// 화면을 다시 그리는 곳들에서 부르는 진입점 — 짧은 시간에 여러 번 불려도 최소 간격(NOTIFY_MIN_INTERVAL_MS)마다 한 번만 계산함.
function notifyRequestSync(){
  if(notifyTimer) return;
  const wait = Math.max(0, NOTIFY_MIN_INTERVAL_MS - (performance.now() - notifyLastRun));
  notifyTimer = setTimeout(() => { notifyTimer = 0; notifySync(); }, wait);
}
// 확인 처리(슬롯 단위): 점이 켜진 슬롯에 마우스를 올리거나(mouseover) 터치/클릭(pointerdown)하면 그 키만 확인한 것으로 함.
function notifyOnSlotTouch(e){
  const slot = e.target.closest && e.target.closest('[data-notify-key].has-notify');
  if(!slot) return;
  const key = slot.dataset.notifyKey;
  const rule = notifyRules().find(r => r.mode === 'seen' && r.keys().includes(key));
  if(!rule) return; // 'state' 규칙의 키는 확인 처리 대상이 아님
  notifyAck(key, rule.qtys ? rule.qtys() : null);
  slot.classList.remove('has-notify');
  notifySaveSoon();
  notifyRequestSync(); // 상위 탭/메뉴의 점도 함께 갱신
}
document.addEventListener('mouseover', notifyOnSlotTouch);
document.addEventListener('pointerdown', notifyOnSlotTouch);

// ================= 던전 보상창 알림 점(이번 판 한정) =================
// 던전 한 번 진행 동안 누적되는 보상(hunt.pendingRewards)에서 "아직 확인 안 한 슬롯/수량이 늘어난 슬롯"을 표시함.
// 위 저장형 알림(state.notifySeen)과 달리 던전 입장 때마다 새로 시작하고 저장하지 않음 — 확인한 목록은 hunt.rewardSeen({ 슬롯키: 확인한 수량 }).
//  - 슬롯: data-reward-key(슬롯 키, formulas.js buildRewardDisplayItems의 nkey) / data-reward-qty(스택 수량)를 가진 .reward-item-slot에 .has-notify
//  - 버튼: 던전 화면 하단 [보상창] 버튼(#huntRewardBtn)에 .has-notify — 안 본 슬롯이 하나라도 있으면 켜지고, 전부 확인하면 꺼짐(보상창을 열기만 해서는 꺼지지 않음)
//  - 확인 처리: 점이 켜진 슬롯에 마우스를 올리거나(mouseover) 터치/클릭(pointerdown)하면 그 슬롯만 확인(main.js initRewardGridInteractions)
//  - 점 표시 설정(body.notify-off)은 같은 CSS(.has-notify::after)를 쓰므로 그대로 따라감. 점 클래스는 HTML에 넣지 않고 그린 뒤 붙임(보상창 HTML 비교 캐시에 영향 없음).
function rewardNotifyLive(slot){
  const seen = hunt.rewardSeen || (hunt.rewardSeen = {});
  const base = seen[slot.nkey];
  if(base === undefined) return true;
  return slot.qty != null && slot.qty > base;
}
function rewardNotifySync(){
  const live = new Set();
  if(currentView === 'hunt' && hunt.dungeon && hunt.pendingRewards){
    buildRewardDisplayItems(hunt.pendingRewards).forEach(s => { if(s.nkey && rewardNotifyLive(s)) live.add(s.nkey); });
  }
  const btn = el('huntRewardBtn');
  if(btn) btn.classList.toggle('has-notify', live.size > 0);
  document.querySelectorAll('#krRewards [data-reward-key]').forEach(e => e.classList.toggle('has-notify', live.has(e.dataset.rewardKey)));
}
function rewardNotifyAck(slotEl){
  if(!slotEl || !slotEl.dataset.rewardKey) return;
  if(!hunt.rewardSeen) hunt.rewardSeen = {};
  const q = slotEl.dataset.rewardQty;
  hunt.rewardSeen[slotEl.dataset.rewardKey] = q !== undefined ? Number(q) : 1;
  slotEl.classList.remove('has-notify');
  rewardNotifySync(); // 버튼 점 갱신
}
