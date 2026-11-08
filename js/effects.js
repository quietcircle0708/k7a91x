// ============================================================
// effects.js — 시각 연출(애니메이션) 전용 함수
// DOM에 파티클/이펙트 엘리먼트를 만들었다 지우는 함수들.
// 게임 상태(state)를 바꾸지 않음 — 순수하게 "보여주기"만 담당.
// ============================================================

// 스킬 사용 시 퀵슬롯 버튼에 적용하는 빛나는 효과 — 요구사항: "구매 버튼에서 사용하는 빛나는 효과를
// 적용합니다". 코인 파티클 없이 purchaseEffect와 동일한 시각 효과(.purchase-flash)만 재사용함.
// 실제 사용(useSkill)은 사냥 화면(hunt)에서만 가능하므로 huntSkillQuickSlotRow 안에서만 찾음 —
// 캐릭터 메뉴 스킬 탭 쪽에 같은 스킬이 배정돼 있어도(숨겨진 화면일 수 있음) 그쪽을 잘못 반짝이지 않게 함.
function skillUseFlash(skillId){
  const row = document.getElementById('huntSkillQuickSlotRow');
  const btn = row && row.querySelector(`.quickslot-btn[data-item="${skillId}"]`);
  if(!btn) return;
  btn.classList.remove('purchase-flash'); void btn.offsetWidth;
  btn.classList.add('purchase-flash');
  setTimeout(() => btn.classList.remove('purchase-flash'), 600);
}
function purchaseEffect(target){
  if(!target) return;
  target.classList.remove('purchase-flash'); void target.offsetWidth;
  target.classList.add('purchase-flash');
  setTimeout(()=>target.classList.remove('purchase-flash'), 600);
  for(let i=0;i<8;i++){
    const p = document.createElement('div');
    p.className = 'coin-particle fly';
    const angle = Math.random()*Math.PI*2;
    const dist = 26 + Math.random()*26;
    p.style.setProperty('--fly', `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist-16}px)`);
    p.style.left = '50%'; p.style.top = '50%';
    target.appendChild(p);
    setTimeout(()=>p.remove(), 620);
  }
}

// ---- 던전 전투 연출 ----
function playerHitEffect(dmg){
  // (던전 상단 HUD에는 피격 연출을 두지 않음 — 전투 영역의 플레이어 이미지·체력바 쪽에서만 보여줌)
  // 전투 화면 중앙 플레이어 아이콘도 몬스터와 동일한 피격 애니메이션(.hit, monster-hit 키프레임)을 재사용.
  const combatIcon = el('combatPlayerIcon');
  if(combatIcon){
    combatIcon.classList.remove('hit'); void combatIcon.offsetWidth; combatIcon.classList.add('hit');
  }
  // 플레이어 이미지(전투 화면 중앙)에서도 몬스터 피해량 출력과 완전히 동일한 로직/서식(spawnDmgPopupIn)으로
  // 피해량을 띄움 — 실제 체력 계산에는 영향 없는 순수 표시 전용 팝업.
  spawnDmgPopupIn(el('combatPlayerSlot'), dmg, false);
}

// 회피 성공 시 연출 — 전투 화면 중앙 플레이어 이미지에 같은 dmg-float 애니메이션으로 "회피!" 문구만 띄움.
// 정상 피격 때와 달리 캐릭터
// 아이콘 피격 모션(.hit)은 재생하지 않음 — 실제로 맞지 않았으므로(요구사항 5·6번: 새 연출 시스템을 만들지
// 않고 기존 피해 숫자 출력 구조만 재활용, 정상 피격 처리와는 분리).
function playerDodgeEffect(){
  spawnDmgPopupIn(el('combatPlayerSlot'), 0, false, true);
}

// 플레이어 사망 시 전투 화면 중앙 아이콘에 몬스터와 동일한 사망 애니메이션(.dead, monster-dead 키프레임)을
// 재생함. 새로 만들지 않고 기존 클래스/키프레임을 그대로 재사용(요구사항: 플레이어 전용 기능 신규 제작 지양).
function playerDeathEffect(){
  clearSpeechBubbles(); // 사망하면 떠 있던 말풍선은 즉시 제거
  const combatIcon = el('combatPlayerIcon');
  if(!combatIcon) return;
  combatIcon.classList.remove('hit');
  void combatIcon.offsetWidth;
  combatIcon.classList.add('dead');
}

// ---- 플레이어 전투 포즈(방향+모션) 상태 관리(신규) ----
// hunt.playerDirection('up'/'left'/'right')과 hunt.playerMotion('idle'/'attack'/'buff') 두 값만으로
// 표시할 이미지가 정해짐(요구사항 7번) — 화면마다 개별 분기를 만들지 않고 이 두 상태를 갱신하기만 하면
// renderPlayerPose가 알아서 올바른 파일을 그림.
let playerMotionRevertTimeout = null;

// 몬스터 타겟팅이 바뀔 때마다 호출(render.js의 updateTargetHighlight, dungeon.js의 spawnMonsters에서
// 호출됨) — 기존 타겟팅 로직(selectTarget 등)은 전혀 건드리지 않고, 이미 결정된 hunt.targetId를 읽어서
// 그 몬스터의 출현 슬롯(pos: top/left/right)을 플레이어가 바라볼 방향으로 변환해 즉시 반영함(요구사항
// 3·4번: 타겟 변경 시 방향도 즉시 변경).
function syncPlayerDirectionToTarget(){
  const target = hunt.monsters && hunt.monsters.find(m => m.instanceId === hunt.targetId);
  if(!target || !target.pos) return;
  const dir = MONSTER_POS_TO_PLAYER_DIRECTION[target.pos];
  if(dir && dir !== hunt.playerDirection){
    hunt.playerDirection = dir;
    renderPlayerPose();
  }
}

// 공격/버프 모션을 잠깐 보여준 뒤 자동으로 idle로 되돌림(요구사항 5·6번: 모션 종료 시 해당 방향의 기본
// 자세로 복귀). 재생 도중 같은 모션이 다시 발생하면(예: 공격속도가 빨라 연타) 타이머를 새로 잡아 매번
// 처음부터 재생되게 함.
function triggerPlayerMotion(motion, durationMs){
  hunt.playerMotion = motion;
  renderPlayerPose();
  if(playerMotionRevertTimeout) clearTimeout(playerMotionRevertTimeout);
  playerMotionRevertTimeout = setTimeout(() => {
    hunt.playerMotion = 'idle';
    playerMotionRevertTimeout = null;
    renderPlayerPose();
  }, durationMs);
}
// 공격 모션 트리거(요구사항 5번) — 기본 공격(dungeon.js attackTick)과 단일/광역 타겟 스킬(actions.js
// resolveSkillEffect, 등급과 무관) 양쪽에서 호출됨.
function triggerPlayerAttackMotion(){ triggerPlayerMotion('attack', PLAYER_ATTACK_MOTION_MS); }
// 버프 모션 트리거(요구사항 6번) — 스킬의 target이 'buff'인 경우(actions.js resolveSkillEffect) 호출됨.
function triggerPlayerBuffMotion(){ triggerPlayerMotion('buff', PLAYER_BUFF_MOTION_MS); }

// 현재 hunt.playerDirection/playerMotion 값을 그대로 화면에 반영. 이미 <img>가 있으면 새로 만들지 않고
// src만 바꿔서(요소 자체를 재사용) #combatPlayerIcon에 붙는 피격/사망 애니메이션 클래스(.hit/.dead,
// playerHitEffect·playerDeathEffect 참고)를 건드리지 않음 — 애니메이션 도중에 포즈가 바뀌어도 끊기지 않음.
function renderPlayerPose(){
  const box = el('combatPlayerIcon');
  if(!box) return;
  const direction = hunt.playerDirection || 'up';
  const motion = hunt.playerMotion || 'idle';
  const img = box.querySelector('img');
  if(img){
    img.src = PLAYER_POSE_IMAGE_DIR + motion + '_' + direction + PLAYER_IMAGE_EXT;
  } else {
    box.innerHTML = playerCombatIconHtml(direction, motion);
    box.dataset.filled = '1';
  }
}

// 피해량 숫자를 특정 컨테이너(위치 기준 요소, position:relative 필요) 안에 띄우는 공용 로직.
// 실제 피해 계산(hp -= dmg)과 화면 표시값은 완전히 분리되어 있음 — 여기서 받는 dmg는 이미 양수이므로
// 그대로 숫자만 표시함('-' 기호·'치명타!' 문구 없이). monsterHitEffect·playerHitEffect가 공통으로 사용.
// isDodge: 회피 시 숫자 대신 "회피!" 문구를 같은 위치·타이밍(dmg-float 애니메이션)으로 띄움(dmg 인자는
// 이때 쓰이지 않음) — 회피 전용 팝업을 새로 만들지 않고 기존 피해 숫자 출력 구조를 그대로 재활용.
// ---- 같은 칸에서 거의 동시에 뜨는 숫자가 한 자리에 겹치지 않게 배치 ----
// 숫자는 뜬 직후 DMG_POPUP_FLOAT_PX만큼 DMG_POPUP_FLOAT_MS 동안 위로 올라감(dmg-float 키프레임과 같은 값). 새 숫자는 같은 칸에서 아직 살아 있는
// 다른 숫자들의 "지금 위치"와 DMG_POPUP_MIN_GAP_PX 이상 떨어지도록, 시작 위치를 필요한 만큼만 아래로 내려서 띄움(겹치지 않으면 내리지 않음).
const DMG_POPUP_LIFE_MS = 850;      // 숫자가 화면에 남아 있는 시간
const DMG_POPUP_FLOAT_MS = 800;     // 위로 올라가는 애니메이션 시간(style.css dmg-float)
const DMG_POPUP_FLOAT_PX = 45;      // 위로 올라가는 거리(style.css dmg-float)
const DMG_POPUP_MIN_GAP_PX = 5;    // 숫자끼리 최소 세로 간격(글자 높이 17~18px보다 조금 크게)
const DMG_POPUP_STAGGER_STEP_PX = 4;
function dmgPopupStartOffset(container){
  const now = performance.now();
  const alive = (container._dmgPopups || []).filter(q => now - q.t < DMG_POPUP_LIFE_MS);
  let off = 0;
  for(let i = 0; i < 40; i++){
    const clash = alive.some(q => Math.abs(off - (q.off - DMG_POPUP_FLOAT_PX * Math.min(1, (now - q.t) / DMG_POPUP_FLOAT_MS))) < DMG_POPUP_MIN_GAP_PX);
    if(!clash) break;
    off += DMG_POPUP_STAGGER_STEP_PX;
  }
  alive.push({ t: now, off });
  container._dmgPopups = alive;
  return off;
}
function spawnDmgPopupIn(container, dmg, isCrit, isDodge, label){
  if(!container) return;
  const p = document.createElement('div');
  p.className = 'dmg-popup float' + (isCrit ? ' crit' : '') + (isDodge ? ' dodge' : '');
  p.textContent = label || (isDodge ? '회피!' : String(dmg)); // label: 회피 팝업을 재활용하는 다른 문구(예: 상태이상 저항)
  p.style.left = (42 + Math.random() * 16) + '%';
  const off = dmgPopupStartOffset(container);
  if(off > 0) p.style.top = `calc(20% + ${off}px)`;
  container.appendChild(p);
  setTimeout(() => p.remove(), DMG_POPUP_LIFE_MS);
}

// 플레이어에게 걸린 지속 피해형 상태이상(중독 등)의 틱 피해 숫자 — 몬스터용 statusTickEffect와 같은 모양으로 플레이어 칸 위에 띄움(피해 계산은 dungeon.js tickPlayerStatusEffects).
function playerStatusTickEffect(dmg, color){
  const slot = el('combatPlayerSlot');
  if(!slot) return;
  const p = document.createElement('div');
  p.className = 'dmg-popup float';
  p.style.color = color;
  p.textContent = String(dmg);
  p.style.left = (42 + Math.random() * 16) + '%';
  const off = dmgPopupStartOffset(slot);
  if(off > 0) p.style.top = `calc(20% + ${off}px)`;
  slot.appendChild(p);
  setTimeout(() => p.remove(), DMG_POPUP_LIFE_MS);
}
// 상태이상 저항 연출 — 회피와 같은 팝업(같은 색·위치·타이밍)에 "[상태이상 이름] 저항" 문구를 띄움. target: 몬스터 개체 또는 플레이어(hunt.player).
function statusResistEffect(target, statusName){
  const slot = target && target.instanceId ? el('monster-slot-' + target.instanceId) : el('combatPlayerSlot');
  spawnDmgPopupIn(slot, 0, false, true, `${statusName} 저항`);
}

function monsterHitEffect(instanceId, dmg, isCrit){
  const icon = el('monster-icon-' + instanceId);
  const slot = el('monster-slot-' + instanceId);
  if(icon){ icon.classList.remove('hit'); void icon.offsetWidth; icon.classList.add('hit'); }
  spawnDmgPopupIn(slot, dmg, isCrit);
}

// 상태이상(중독 등) 틱 데미지 숫자를 화면에 띄움 (실제 데미지 계산/처치 판정은 dungeon.js의 startStatusTicker가 담당).
// 색상(color)은 상태 이상별로 그대로 유지하되, 표시 형식은 기존 다른 피해량 출력(spawnDmgPopupIn)과 동일하게
// '-' 기호 없이 숫자만 표시함(예전엔 '-'+dmg로 표시했었음).
function statusTickEffect(instanceId, dmg, color){
  const slot = el('monster-slot-' + instanceId);
  if(!slot) return;
  const p = document.createElement('div');
  p.className = 'dmg-popup float';
  p.style.color = color;
  p.textContent = String(dmg);
  p.style.left = (42 + Math.random() * 16) + '%';
  const off = dmgPopupStartOffset(slot); // 같은 몬스터에 틱/피격이 동시에 뜰 때 겹치지 않게
  if(off > 0) p.style.top = `calc(20% + ${off}px)`;
  slot.appendChild(p);
  setTimeout(() => p.remove(), DMG_POPUP_LIFE_MS);
}

// ---- 몬스터 처치 시 드랍 아이템 연출(시각 효과 전용, 실제 지급 로직과 완전히 분리됨) ----
// 연출 전체 재생 시간(등장→위로 튀어오름→낙하→착지 튕김→잠시 유지→페이드아웃)을 이 값 하나로 관리함.
// 특정 아이템/몬스터에 하드코딩하지 않으므로, 이 값만 바꾸면 모든 드랍 연출에 자동으로 반영됨.
const DROP_EFFECT_DURATION_MS = 1000;
// 연출 한 항목의 이미지/등급을 결정 — 무기·방어구·장신구는 기존 weaponIconHtml(장비 전역 설정)을 그대로
// 재사용해 PNG 이미지를 그리고, 아티팩트·마석·재료처럼 이미지가 없는 아이템은 기존 UI에서 쓰는 이모지
// 아이콘을 그대로 사용함. 새 아이템이 추가되어도 이 함수를 손댈 필요 없이 기존 데이터(WEAPON_TYPES 계열/
// ARTIFACTS/MISC_ITEMS)에 등록만 되어 있으면 자동으로 반영됨.
// 등급별 발광 필터는 기본적으로 적용하지 않음(요청: 드랍 연출에서 발광 효과 제거, 연출 자체와 등급
// 판정·아이콘 선택 로직은 그대로 유지) — 단, 이름에 "호박"이 포함된 기타 아이템(DROP_GLOW_ITEM_KEYWORD)만
// 범위를 좁혀 등급별 발광을 재적용함(아래 'item' 분기 참고, 다른 종류는 전부 원본 그대로).
function dropItemVisualInner(item){
  if(item.kind === 'equip'){
    return `<span class="drop-item-visual-inner">${weaponIconHtml(item.type, 'drop-item-visual-img')}</span>`;
  }
  if(item.kind === 'artifact'){
    const a = ARTIFACTS[item.id];
    return `<span class="drop-item-visual-inner drop-item-visual-emoji">${itemIconHtml(a)}</span>`;
  }
  if(item.kind === 'consumable'){
    // 플라스크(CONSUMABLES) 드랍 연출 — 마석/재료(MISC_ITEMS)와는 다른 데이터 테이블이라 별도 분기.
    const it = CONSUMABLES[item.itemId];
    return `<span class="drop-item-visual-inner drop-item-visual-emoji">${itemIconHtml(it)}</span>`;
  }
  // item.kind === 'item' — 마석/재료 등 MISC_ITEMS
  const it = MISC_ITEMS[item.itemId];
  const iconHtml = itemIconHtml(it);
  // 예외: 이름에 "호박"이 포함된 기타 아이템만 등급별 발광 효과를 재적용함(DROP_GLOW_ITEM_KEYWORD,
  // data.js 참고). 그 외 기타아이템/장비/아티팩트/플라스크는 바로 위에서 전부 발광 없이 원본 그대로 반환됨 —
  // 다른 분기는 건드리지 않음.
  if(it && it.name && it.name.includes(DROP_GLOW_ITEM_KEYWORD)){
    const glowLevel = DROP_GLOW_GRADE_LEVEL[it.grade];
    const levelEffect = (glowLevel != null) ? ENHANCE_LEVEL_EFFECTS[glowLevel] : null;
    const hasGlow = !!(levelEffect && levelEffect.glow && levelEffect.glow !== 'none');
    const glowed = hasGlow ? `<span class="icon-enhance-glow" style="filter:${levelEffect.glow};">${iconHtml}</span>` : iconHtml;
    return `<span class="drop-item-visual-inner drop-item-visual-emoji">${glowed}</span>`;
  }
  return `<span class="drop-item-visual-inner drop-item-visual-emoji">${iconHtml}</span>`;
}
// 실제로 이 이미지 하나를 등장→낙하→튕김→유지→소멸 애니메이션으로 재생함.
// container는 실제 좌표 기준(position:relative)이 되는 .combat-arena를 받음(아래 playMonsterDropEffect
// 참고 — #monsterRow는 display:contents라 좌표 기준으로 쓸 수 없음). combat-arena는 몬스터 슬롯이
// 재렌더링되어도(renderMonsterRow가 #monsterRow의 innerHTML만 교체함) 그 자체는 사라지지 않는 안정적인
// 상위 요소라, 몬스터 사망 애니메이션이 끝나 slot이 사라진 뒤에도(0.4초) 연출(기본 1초)이 끊기지 않음.
function spawnDropItemVisual(container, left, top, item){
  if(!container.isConnected) return; // 화면이 이미 전환된 경우 등 — 조용히 무시(연출 실패가 지급에 영향 없음)
  const wrap = document.createElement('div');
  wrap.className = 'drop-item-visual';
  wrap.style.left = left + 'px';
  wrap.style.top = top + 'px';
  // DROP_EFFECT_DURATION_MS를 인라인으로 지정해, CSS 애니메이션의 각 구간(%)이 이 값 하나에 맞춰
  // 자동으로 늘어나거나 줄어들도록 함(키프레임 자체는 CSS에 %로만 정의되어 있음).
  wrap.style.animationDuration = DROP_EFFECT_DURATION_MS + 'ms';
  wrap.innerHTML = dropItemVisualInner(item);
  container.appendChild(wrap);
  setTimeout(() => wrap.remove(), DROP_EFFECT_DURATION_MS + 50);
}
// 몬스터 한 마리가 처치되어 실제로 지급이 확정된 아이템 목록(items)을 받아 연출만 재생함.
// 실제 아이템 객체를 생성하거나 상태를 바꾸지 않으며(순수 시각 연출), 이 함수 호출 시점엔 이미 지급이
// 전부 끝나 있어야 함 — 연출이 실패하거나 생략돼도 지급 결과에는 전혀 영향이 없음.
function playMonsterDropEffect(instanceId, items){
  if(!items || !items.length) return;
  const slot = el('monster-slot-' + instanceId);
  // 던전 전투 화면 개편(플레이어 중앙 고정 레이아웃) 이후 #monsterRow는 display:contents로 바뀌어 그
  // 자체로는 박스를 만들지 않음 — getBoundingClientRect()가 항상 0에 가까운 값을 반환하고,
  // position:absolute 자식의 실제 위치 기준(containing block)도 monsterRow를 건너뛰어 그 다음 조상인
  // .combat-arena가 되어버림. 좌표 계산 기준과 실제 렌더링 기준이 어긋나 연출이 화면 밖에 그려지던
  // 문제가 있었음 — 좌표 계산과 부착 대상을 실제 위치 기준 요소인 combat-arena로 통일해서 수정함.
  const arena = el('combatArena');
  if(!slot || !arena) return;
  const slotRect = slot.getBoundingClientRect();
  const arenaRect = arena.getBoundingClientRect();
  // "몬스터 이미지 중앙 부근"을 기준 좌표로 잡음(슬롯 가로 중앙, 세로로는 살짝 위쪽 — 아이콘이 위치한
  // 지점). 좌표는 slot이 살아있는 지금 시점에 한 번만 계산해서 combat-arena 기준 절대 px로 고정해둠.
  const baseLeft = slotRect.left - arenaRect.left + slotRect.width / 2;
  const baseTop = slotRect.top - arenaRect.top + slotRect.height * 0.32;
  // 여러 아이템이 동시에 드랍되면 완전히 겹치지 않도록 항목마다 가로 위치를 살짝 흩뿌리고, 짧은
  // 시간차(90ms)를 두고 순서대로 등장시켜 각각 드랍되었음을 구분할 수 있게 함.
  items.forEach((item, i) => {
    const jitter = (i - (items.length - 1) / 2) * 14 + (Math.random() * 8 - 4);
    setTimeout(() => spawnDropItemVisual(arena, baseLeft + jitter, baseTop, item), i * 90);
  });
}

// ---- 말풍선(speech bubble) ----
// showSpeechBubble(기준 요소, 글, 프리셋 이름, 옵션): 기준 요소의 "머리 위"에 말풍선을 띄움 — 모양/색/시간은 data.js SPEECH_BUBBLE_PRESETS.
// 말풍선은 전투 영역 안이 아니라 화면 전체 위에 겹치는 전용 층(#speechBubbleLayer, body 직속)에 그려서 어떤 영역의 overflow에도 잘리지 않고,
// 화면 가장자리에서 벗어나면 안쪽으로 밀어 넣으며(꼬리는 계속 기준 요소를 가리킴) 플레이어/몬스터 등 어떤 요소에도 같은 방식으로 쓸 수 있음.
//   opts.headTopRatio: 기준 요소 높이 중 "머리 윗부분"이 시작되는 위치 비율(0=요소 맨 위, 기본 0) — 이미지 위쪽에 투명 여백이 있는 요소용
//   (플레이어는 PLAYER_HEAD_TOP_RATIO). 같은 기준 요소에는 말풍선이 하나만 있으며 새로 띄우면 이전 것을 대체함.
// 말풍선이 떠 있는 동안 매 프레임 기준 요소 위치를 따라가고, 기준 요소가 사라지거나 화면에서 안 보이면(던전 이탈 등) 바로 없앰.
const SPEECH_BUBBLE_TAIL_PX = 7; // 꼬리 높이(style.css .speech-bubble::after와 같은 값)
const speechBubbles = new Map(); // 기준 요소 → { el, preset, headTopRatio, startedAt }
let speechBubbleLayer = null;
let speechBubbleRaf = null;
function speechBubbleLayerEl(){
  if(speechBubbleLayer && document.body.contains(speechBubbleLayer)) return speechBubbleLayer;
  speechBubbleLayer = document.createElement('div');
  speechBubbleLayer.id = 'speechBubbleLayer';
  document.body.appendChild(speechBubbleLayer);
  return speechBubbleLayer;
}
// 말풍선 하나의 위치를 기준 요소의 현재 위치에 맞춤. 기준 요소가 사라졌거나 안 보이면 false.
function speechBubbleGapPx(preset){
  return (document.body.classList.contains('mobile-preset') && preset.gapPxMobile != null) ? preset.gapPxMobile : preset.gapPx;
}
// 몸통+꼬리를 "하나의 윤곽선"으로 그림 — 몸통과 꼬리를 따로 그리면 둘 사이에 선이 보이므로, 하나의 경로(path)로 이어서 채우고 테두리를 그림.
// 바깥쪽에 어두운 외곽선(1px)을 한 겹 더 두르고, 좌표는 말풍선 테두리 박스 기준(테두리 선 두께 2px의 가운데 = 안쪽 1px).
// tailX: 꼬리 끝이 가리키는 가로 위치(박스 왼쪽 기준). 꼬리 길이(SPEECH_BUBBLE_TAIL_PX)는 어두운 외곽선까지 포함해 박스 아래로 튀어나오는 길이.
function speechBubbleShapePath(bw, bh, tailX, fontSize){
  const x0 = 1, y0 = 1, x1 = bw - 1, y1 = bh - 1;
  const r = Math.max(2, Math.min(Math.round(fontSize * 0.85), (bh - 2) / 2, (bw - 2) / 2));
  const tw = 5;                                   // 꼬리 밑변의 절반
  const tipY = bh + SPEECH_BUBBLE_TAIL_PX - 2;    // 꼬리 끝(둥근 이음 + 외곽선이 약 2px 더 나감)
  return `M${x0 + r},${y0} H${x1 - r} A${r},${r} 0 0 1 ${x1},${y0 + r} V${y1 - r} A${r},${r} 0 0 1 ${x1 - r},${y1} `
       + `H${tailX + tw} L${tailX},${tipY} L${tailX - tw},${y1} H${x0 + r} A${r},${r} 0 0 1 ${x0},${y1 - r} `
       + `V${y0 + r} A${r},${r} 0 0 1 ${x0 + r},${y0} Z`;
}
function updateSpeechBubbleShape(b, bw, bh, tailX){
  const key = bw + 'x' + bh + '@' + tailX;
  if(b.shapeKey === key) return;
  b.shapeKey = key;
  const svg = b.el.firstChild;
  svg.setAttribute('width', bw); svg.setAttribute('height', bh);
  const d = speechBubbleShapePath(bw, bh, tailX, b.preset.fontSize);
  svg.firstChild.setAttribute('d', d); svg.lastChild.setAttribute('d', d);
}
function placeSpeechBubble(anchor, b){
  if(!anchor.isConnected) return false;
  const r = anchor.getBoundingClientRect();
  if(r.width === 0 && r.height === 0) return false;
  const bw = b.el.offsetWidth, bh = b.el.offsetHeight;
  const m = SPEECH_BUBBLE_VIEWPORT_MARGIN_PX;
  const cx = r.left + r.width / 2;
  const headY = r.top + r.height * b.headTopRatio;
  const left = Math.min(Math.max(cx - bw / 2, m), Math.max(m, (document.documentElement.clientWidth || window.innerWidth) - bw - m));
  const top = Math.max(headY - speechBubbleGapPx(b.preset) - SPEECH_BUBBLE_TAIL_PX - bh, m);
  b.el.style.left = left + 'px';
  b.el.style.top = top + 'px';
  // 밀려도 꼬리는 기준 요소를 가리키되, 꼬리가 둥근 모서리에 걸리지 않도록 직선 구간 안으로 제한
  const tailMin = Math.min(Math.round(b.preset.fontSize * 0.85) + 7, bw / 2);
  const tailX = Math.round(Math.min(Math.max(cx - left, tailMin), Math.max(tailMin, bw - tailMin)));
  b.el.style.setProperty('--tail-x', tailX + 'px');
  updateSpeechBubbleShape(b, bw, bh, tailX);
  return true;
}
function removeSpeechBubble(anchor){
  const b = speechBubbles.get(anchor);
  if(!b) return;
  b.el.remove();
  speechBubbles.delete(anchor);
}
// anchor를 주면 그 요소의 말풍선만, 안 주면 전부 즉시 제거(플레이어 사망 등).
function clearSpeechBubbles(anchor){
  if(anchor){ removeSpeechBubble(anchor); return; }
  Array.from(speechBubbles.keys()).forEach(removeSpeechBubble);
}
function speechBubbleTick(){
  speechBubbleRaf = null;
  const now = performance.now();
  Array.from(speechBubbles.entries()).forEach(([anchor, b]) => {
    const elapsed = now - b.startedAt;
    if(elapsed >= b.preset.durationMs || !placeSpeechBubble(anchor, b)){ removeSpeechBubble(anchor); return; }
    if(elapsed >= b.preset.durationMs - b.preset.fadeOutMs) b.el.classList.add('hide');
  });
  if(speechBubbles.size > 0) speechBubbleRaf = requestAnimationFrame(speechBubbleTick);
}
function showSpeechBubble(anchor, text, presetKey, opts){
  const preset = SPEECH_BUBBLE_PRESETS[presetKey] || SPEECH_BUBBLE_PRESETS[SPEECH_BUBBLE_DEFAULT_PRESET];
  if(!anchor || !preset) return;
  removeSpeechBubble(anchor); // 같은 대상에는 하나만 — 새 말풍선이 이전 것을 대체
  const e = document.createElement('div');
  e.className = 'speech-bubble';
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sb-shape'); svg.setAttribute('aria-hidden', 'true');
  ['sb-outline', 'sb-body'].forEach(c => { const pth = document.createElementNS(NS, 'path'); pth.setAttribute('class', c); svg.appendChild(pth); });
  const label = document.createElement('span');
  label.className = 'sb-text';
  label.textContent = text;
  e.appendChild(svg); e.appendChild(label);
  const st = e.style;
  st.setProperty('--sb-fill', preset.fill); st.setProperty('--sb-border', preset.border); st.setProperty('--sb-text', preset.text);
  st.setProperty('--sb-size', preset.fontSize + 'px'); st.setProperty('--sb-max', preset.maxWidthPx + 'px');
  st.setProperty('--sb-fade-in', preset.fadeInMs + 'ms'); st.setProperty('--sb-fade-out', preset.fadeOutMs + 'ms');
  speechBubbleLayerEl().appendChild(e);
  const b = { el: e, preset, headTopRatio: (opts && opts.headTopRatio) || 0, startedAt: performance.now() };
  speechBubbles.set(anchor, b);
  if(!placeSpeechBubble(anchor, b)){ removeSpeechBubble(anchor); return; }
  void e.offsetWidth; e.classList.add('show'); // 위치를 잡은 뒤 나타나는 전환 시작
  if(!speechBubbleRaf) speechBubbleRaf = requestAnimationFrame(speechBubbleTick);
}

let spawnToastTimeout = null;
// 던전 내 팝업 공통 표시(스테이지 입장 메시지 등 단순 텍스트용). 노출 시간은 DUNGEON_MSG_DURATION_MS로 통일됨.
function showDungeonMsg(text){
  const toast = el('spawnToast');
  if(!toast) return;
  toast.innerHTML = text;
  toast.style.color = '';
  toast.classList.remove('show'); void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(spawnToastTimeout);
  spawnToastTimeout = setTimeout(() => toast.classList.remove('show'), DUNGEON_MSG_DURATION_MS);
}
// 몬스터 조우 메시지(랜덤 4종 중 1개, formulas.js의 pickEncounterMessage) 표시. 몬스터 이름 부분에만 등급 색상을 적용.
function showEncounterToast(monsterDef){
  const grade = MONSTER_GRADES[monsterDef.grade];
  const msg = pickEncounterMessage(monsterDef.name);
  const coloredName = `<span style="color:${grade.color};">${monsterDef.name}</span>`;
  showDungeonMsg(msg.replace(monsterDef.name, coloredName));
}

// 마을(대장간) 화면 상단에 잠깐 뜨는 팝업 메시지 (예: 부활 후 안내)
let townToastTimeout = null;
function showTownToast(text){
  const toast = el('townToast');
  if(!toast) return;
  toast.textContent = text;
  toast.classList.remove('show'); void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(townToastTimeout);
  townToastTimeout = setTimeout(() => toast.classList.remove('show'), 2200);
}
