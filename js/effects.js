// ============================================================
// effects.js — 시각 연출(애니메이션) 전용 함수
// DOM에 파티클/이펙트 엘리먼트를 만들었다 지우는 함수들.
// 게임 상태(state)를 바꾸지 않음 — 순수하게 "보여주기"만 담당.
// ============================================================

let auraSmokeInterval = null;
let auraSmokeColor = null;
function setBladeShape(type){
  const img = el('swordImg');
  img.onerror = function(){
    this.onerror = null; // 폴백 이미지 자체도 실패할 경우 무한 루프 방지
    this.src = weaponImageFallbackPath();
  };
  img.src = weaponImagePath(type);
  // 무기 종류가 단검이면 강화 화면 이미지 크기를 30% 축소해서 출력
  // (다른 화면의 무기 아이콘과 동일한 축소 비율 — weaponIconHtml의 kind-dagger 클래스 참고)
  img.style.transform = wpn(type).weaponKind === 'dagger' ? 'scale(0.7)' : '';
}

// 강화 단계(level, 0~9)에 맞는 발광 효과를 무기 이미지(swordVisual)에만 적용.
// ENHANCE_LEVEL_EFFECTS(data.js)가 설정값을 가지고 있어서, 단계별 색상/강도를 바꾸려면
// 그 배열만 수정하면 됨 — PNG 원본이나 이 함수는 건드릴 필요 없음.
function applySwordGlow(level){
  const effect = ENHANCE_LEVEL_EFFECTS[level] || ENHANCE_LEVEL_EFFECTS[0];
  el('swordVisual').style.filter = effect.glow;
}

function updateAuraSmoke(active, color){
  if(active){
    if(auraSmokeInterval && auraSmokeColor === color) return;
    stopAuraSmoke();
    auraSmokeColor = color;
    auraSmokeInterval = setInterval(() => spawnSmokeWisp(color), 260);
  } else {
    stopAuraSmoke();
  }
}
function stopAuraSmoke(){
  if(auraSmokeInterval){ clearInterval(auraSmokeInterval); auraSmokeInterval = null; }
  auraSmokeColor = null;
}
function spawnSmokeWisp(color){
  const stage = el('swordStage');
  if(!stage) return;
  const w = document.createElement('div');
  w.className = 'aura-smoke rise';
  w.style.left = (38 + Math.random() * 24) + '%';
  w.style.top = (25 + Math.random() * 45) + '%';
  w.style.background = color;
  w.style.setProperty('--dx', (Math.random() * 30 - 15) + 'px');
  stage.appendChild(w);
  setTimeout(() => w.remove(), 1750);
}

function burstSparks(color, count=10){
  const stage = el('swordStage');
  for(let i=0;i<count;i++){
    const s = document.createElement('div');
    s.className = 'spark fire';
    const angle = Math.random()*Math.PI*2;
    const dist = 40 + Math.random()*50;
    s.style.setProperty('--fly', `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist - 20}px)`);
    s.style.background = color;
    s.style.boxShadow = `0 0 6px ${color}`;
    stage.appendChild(s);
    setTimeout(()=>s.remove(), 650);
  }
}
function vortexBurst(color, count=16){
  const stage = el('swordStage');
  for(let i=0;i<count;i++){
    const v = document.createElement('div');
    v.className = 'vortex spin';
    const a0 = Math.random()*Math.PI*2;
    const r0 = 75 + Math.random()*35;
    const a1 = a0 + (Math.PI/1.4) * (Math.random() < .5 ? 1 : -1);
    const r1 = r0 * 0.3;
    v.style.setProperty('--p0', `translate(${Math.cos(a0)*r0}px, ${Math.sin(a0)*r0}px) scale(1)`);
    v.style.setProperty('--p1', `translate(${Math.cos(a1)*r1}px, ${Math.sin(a1)*r1}px) scale(.6)`);
    v.style.background = color;
    v.style.boxShadow = `0 0 8px ${color}`;
    v.style.animationDelay = (Math.random()*120) + 'ms';
    stage.appendChild(v);
    setTimeout(()=>v.remove(), 1050);
  }
}
function flashCard(color){
  const card = el('forgeCard');
  card.style.setProperty('--flash-color', color || 'rgba(255,215,106,0.45)');
  card.classList.remove('flash'); void card.offsetWidth;
  card.classList.add('flash');
  setTimeout(()=>card.classList.remove('flash'), 900);
}
let emberInterval = null;
function startEmbers(){
  stopEmbers();
  emberInterval = setInterval(()=>{
    const stage = el('swordStage');
    const e = document.createElement('div');
    e.className = 'ember rise';
    e.style.left = (44 + Math.random()*12) + '%';
    e.style.setProperty('--dx', (Math.random()*24-12)+'px');
    stage.appendChild(e);
    setTimeout(()=>e.remove(), 760);
  }, 100);
}
function stopEmbers(){ if(emberInterval){ clearInterval(emberInterval); emberInterval = null; } }
function successRing(color){
  const stage = el('swordStage');
  const r = document.createElement('div');
  r.className = 'success-ring';
  r.style.borderColor = color;
  stage.appendChild(r);
  setTimeout(()=>r.remove(), 600);
}
function burstRays(color, count=10){
  const stage = el('swordStage');
  for(let i=0;i<count;i++){
    const angle = (360/count)*i;
    const r = document.createElement('div');
    r.className = 'burst-ray shoot';
    r.style.background = `linear-gradient(to bottom, ${color}, transparent)`;
    r.style.transform = `translate(-50%,-100%) rotate(${angle}deg)`;
    r.style.animationDelay = (Math.random()*60)+'ms';
    stage.appendChild(r);
    setTimeout(()=>r.remove(), 650);
  }
}
function smokePuff(count=6){
  const stage = el('swordStage');
  for(let i=0;i<count;i++){
    const s = document.createElement('div');
    s.className = 'smoke rise';
    s.style.left = (46 + Math.random()*10) + '%';
    s.style.setProperty('--dx', (Math.random()*30-15)+'px');
    stage.appendChild(s);
    setTimeout(()=>s.remove(), 950);
  }
}
function shatterBurst(count=16){
  const stage = el('swordStage');
  const colors = ['#3a3128','#8a8178','#c13c3c','#5a4630'];
  for(let i=0;i<count;i++){
    const f = document.createElement('div');
    f.className = 'frag fly';
    const angle = Math.random()*Math.PI*2;
    const dist = 55 + Math.random()*70;
    f.style.setProperty('--fly', `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`);
    f.style.setProperty('--rot', (Math.random()*720-360)+'deg');
    f.style.background = colors[Math.floor(Math.random()*colors.length)];
    stage.appendChild(f);
    setTimeout(()=>f.remove(), 800);
  }
}

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
  const panel = document.querySelector('.hunt-char-panel');
  if(!panel) return;
  panel.classList.remove('player-hit'); void panel.offsetWidth; panel.classList.add('player-hit');
  const p = document.createElement('div');
  p.className = 'dmg-popup float player-dmg';
  p.textContent = '-' + dmg;
  p.style.left = (42 + Math.random() * 16) + '%';
  panel.appendChild(p);
  setTimeout(() => { panel.classList.remove('player-hit'); p.remove(); }, 850);
}

function monsterHitEffect(instanceId, dmg, isCrit){
  const icon = el('monster-icon-' + instanceId);
  const slot = el('monster-slot-' + instanceId);
  if(icon){ icon.classList.remove('hit'); void icon.offsetWidth; icon.classList.add('hit'); }
  if(!slot) return;
  const p = document.createElement('div');
  p.className = 'dmg-popup float' + (isCrit ? ' crit' : '');
  // 실제 피해 계산(target.hp -= dmg, 음수 반영)과 화면 표시값을 분리 — 여기서 받는 dmg는 이미 양수이므로
  // 그대로 숫자만 표시함('-' 기호·'치명타!' 문구 없이). 몬스터 hp 차감 로직은 호출부에서 그대로 유지됨.
  p.textContent = String(dmg);
  p.style.left = (42 + Math.random() * 16) + '%';
  slot.appendChild(p);
  setTimeout(() => p.remove(), 850);
}

// 상태이상(중독 등) 틱 데미지 숫자를 화면에 띄움 (실제 데미지 계산/처치 판정은 dungeon.js의 startStatusTicker가 담당)
function statusTickEffect(instanceId, dmg, color){
  const slot = el('monster-slot-' + instanceId);
  if(!slot) return;
  const p = document.createElement('div');
  p.className = 'dmg-popup float';
  p.style.color = color;
  p.textContent = '-' + dmg;
  p.style.left = (42 + Math.random() * 16) + '%';
  slot.appendChild(p);
  setTimeout(() => p.remove(), 850);
}

// ---- 몬스터 처치 시 드랍 아이템 연출(시각 효과 전용, 실제 지급 로직과 완전히 분리됨) ----
// 연출 전체 재생 시간(등장→위로 튀어오름→낙하→착지 튕김→잠시 유지→페이드아웃)을 이 값 하나로 관리함.
// 특정 아이템/몬스터에 하드코딩하지 않으므로, 이 값만 바꾸면 모든 드랍 연출에 자동으로 반영됨.
const DROP_EFFECT_DURATION_MS = 1000;
// 드랍 등급별 이펙트는 새로 만들지 않고 강화 화면에서 쓰는 강화 단계별 발광 효과(ENHANCE_LEVEL_EFFECTS,
// data.js)를 그대로 재사용함 — 실제 강화 단계를 표시하는 게 아니라 "해당 단계의 이펙트"만 빌려 쓰는
// 것이므로, 등급마다 구별이 잘 되는 단계를 하나씩 골라 매핑함(일반=효과없음, 레어=+3, 에픽=+5, 유니크=+7).
const DROP_EFFECT_GLOW_LEVEL = { normal: 0, rare: 3, epic: 5, unique: 7 };
function dropEffectGlowFilter(grade){
  const lvl = DROP_EFFECT_GLOW_LEVEL[grade] != null ? DROP_EFFECT_GLOW_LEVEL[grade] : 0;
  const effect = ENHANCE_LEVEL_EFFECTS[lvl] || ENHANCE_LEVEL_EFFECTS[0];
  return effect.glow === 'none' ? '' : effect.glow;
}
// 연출 한 항목의 이미지/등급을 결정 — 무기·방어구·장신구는 기존 weaponIconHtml(장비 전역 설정)을 그대로
// 재사용해 PNG 이미지를 그리고, 아티팩트·마석·재료처럼 이미지가 없는 아이템은 기존 UI에서 쓰는 이모지
// 아이콘을 그대로 사용함. 새 아이템이 추가되어도 이 함수를 손댈 필요 없이 기존 데이터(WEAPON_TYPES 계열/
// ARTIFACTS/MISC_ITEMS)에 등록만 되어 있으면 자동으로 반영됨.
function dropItemVisualInner(item){
  if(item.kind === 'equip'){
    const grade = wpn(item.type).grade;
    return `<span class="drop-item-visual-inner" style="filter:${dropEffectGlowFilter(grade)}">${weaponIconHtml(item.type, 'drop-item-visual-img')}</span>`;
  }
  if(item.kind === 'artifact'){
    const a = ARTIFACTS[item.id];
    return `<span class="drop-item-visual-inner drop-item-visual-emoji" style="filter:${dropEffectGlowFilter(a.grade)}">${itemIconHtml(a)}</span>`;
  }
  // item.kind === 'item' — 마석/재료 등 MISC_ITEMS
  const it = MISC_ITEMS[item.itemId];
  return `<span class="drop-item-visual-inner drop-item-visual-emoji" style="filter:${dropEffectGlowFilter(it.grade)}">${itemIconHtml(it)}</span>`;
}
// 실제로 이 이미지 하나를 등장→낙하→튕김→유지→소멸 애니메이션으로 재생함.
// container는 monster-slot이 아니라 그보다 오래 살아있는 상위 컨테이너(monsterRow)를 받아서, 몬스터
// 사망 애니메이션이 끝나 slot이 DOM에서 사라진 뒤에도(0.4초) 연출(기본 1초)이 끊기지 않고 끝까지 재생됨.
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
  const row = el('monsterRow');
  if(!slot || !row) return;
  const slotRect = slot.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  // "몬스터 이미지 중앙 부근"을 기준 좌표로 잡음(슬롯 가로 중앙, 세로로는 살짝 위쪽 — 아이콘이 위치한
  // 지점). 좌표는 slot이 살아있는 지금 시점에 한 번만 계산해서 monsterRow 기준 절대 px로 고정해둠.
  const baseLeft = slotRect.left - rowRect.left + slotRect.width / 2;
  const baseTop = slotRect.top - rowRect.top + slotRect.height * 0.32;
  // 여러 아이템이 동시에 드랍되면 완전히 겹치지 않도록 항목마다 가로 위치를 살짝 흩뿌리고, 짧은
  // 시간차(90ms)를 두고 순서대로 등장시켜 각각 드랍되었음을 구분할 수 있게 함.
  items.forEach((item, i) => {
    const jitter = (i - (items.length - 1) / 2) * 14 + (Math.random() * 8 - 4);
    setTimeout(() => spawnDropItemVisual(row, baseLeft + jitter, baseTop, item), i * 90);
  });
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
