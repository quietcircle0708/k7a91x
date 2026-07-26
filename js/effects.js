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
  // 무기 종류가 단검이면 강화 화면 이미지 크기를 40% 축소해서 출력
  img.style.transform = wpn(type).weaponKind === 'dagger' ? 'scale(0.6)' : '';
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

function monsterHitEffect(dmg, isCrit){
  const icon = el('monsterIcon');
  icon.classList.remove('hit'); void icon.offsetWidth; icon.classList.add('hit');
  const stage = el('monsterStage');
  const p = document.createElement('div');
  p.className = 'dmg-popup float' + (isCrit ? ' crit' : '');
  p.textContent = (isCrit ? '치명타! -' : '-') + dmg;
  p.style.left = (42 + Math.random() * 16) + '%';
  stage.appendChild(p);
  setTimeout(() => p.remove(), 850);
}

// 상태이상(중독 등) 틱 데미지 숫자를 화면에 띄움 (실제 데미지 계산/처치 판정은 dungeon.js의 startStatusTicker가 담당)
function statusTickEffect(dmg, color){
  const stage = el('monsterStage');
  const p = document.createElement('div');
  p.className = 'dmg-popup float';
  p.style.color = color;
  p.textContent = '-' + dmg;
  p.style.left = (42 + Math.random() * 16) + '%';
  stage.appendChild(p);
  setTimeout(() => p.remove(), 850);
}

let spawnToastTimeout = null;
function showSpawnToast(monsterDef, level){
  const grade = MONSTER_GRADES[monsterDef.grade];
  const toast = el('spawnToast');
  if(!toast) return;
  toast.textContent = `${grade.label}몬스터인 ${monsterDef.name}${josaIGa(monsterDef.name)} 출현했습니다!`;
  toast.style.color = grade.color;
  toast.classList.remove('show'); void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(spawnToastTimeout);
  spawnToastTimeout = setTimeout(() => toast.classList.remove('show'), 1000);
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
