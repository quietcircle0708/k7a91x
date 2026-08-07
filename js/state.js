// ============================================================
// state.js — 게임 상태 및 저장/불러오기
// 게임의 유일한 진실 소스(state 객체)와, 그 상태를 안전하게
// 읽고 쓰는 헬퍼 함수들. window.storage 우선, localStorage 폴백.
// ============================================================

let state = {
  gold: 1000,
  // (강화 장비 선택 기능 추가 시 제거) 예전엔 새 게임 시작 시 견습 모험가의 대검(양손검, 착용 요구
  // 힘 3)을 무조건 지급하고 자동으로 장착했지만, 착용 요구 스탯을 만족 못한 채로 장착되는 모순이
  // 있었음. 이제는 인벤토리를 비운 채로 시작하고, 시작 골드(1000G)로 상점에서 직접 무기를 사고
  // 대장간 버튼(또는 인벤토리)에서 직접 강화 대상으로 선택하도록 함.
  inventory: [],
  equippedId: null,
  nextItemId: 1,
  charmCount: 0, charmPrice: 1500, charmActive: false,
  blessingCount: 0, blessingPrice: 15000, blessingActive: false,
  artifacts: [],       // 보유 아티팩트 id 목록 (최대 ARTIFACT_SLOT_MAX)
  equippedArtifacts: [], // 장착 중인 아티팩트 id 목록(최대 ARTIFACT_SLOT_MAX) — 이전엔 저장된 데이터를
                          // 불러올 때(applyLoadedRaw)만 채워졌는데, 저장 데이터가 아예 없는 최초 실행
                          // 시점(신규 게임)엔 채워지지 않아 ensurePlayerVitals()가 곧바로 죽는 문제가
                          // 있어서 기본 state 자체에도 초기값을 추가함(다른 필드들과 동일한 방식)
  manaFragments: 0,    // 마석 파편 보유 개수
  manaShards: 0,       // 마석 조각 보유 개수
  manaCrystals: 0,     // 마석 결정 보유 개수
  manaStones: 0,       // 마석 보유 개수
  acorns: 0, ratMeats: 0, batMeats: 0, snakeMeats: 0, deerMeats: 0, deerAntlers: 0, bearHides: 0, bearBiles: 0, // 기타(재료) 아이템 보유 개수
  skipEffects: false,
  autoRebuy: false,
  playerLevel: 1, playerExp: 0, playerHp: null, playerMp: null, // 캐릭터 레벨/경험치/체력/마나
  statPoints: 4, stats: { str: 0, agi: 0, int: 0 }, // 미할당 스탯 포인트 및 투자한 스탯
  skillPoints: 1, awakeningPoints: 0, // 미사용 스킬 포인트(공용·특화 공유) / 미사용 깨달음(기연 전용) — 레벨1 기준 공식값
  learnedSkills: [], learnedAwakeningSkills: [], // 습득한 스킬 id 목록(공용·특화 공용 / 기연 별도)
  skillQuickSlots: [null, null, null, null, null], // 스킬 퀵슬롯(왼쪽 5칸)에 등록된 스킬 id
  consumables: { hpFlask: 0, mpFlask: 0 }, // 보유 플라스크 개수
  quickSlots: [null, null], // 사냥 화면 퀵슬롯에 등록된 소비 아이템 id
  settings: {}, // 설정값 저장 (키: SETTINGS_SCHEMA의 항목 id). ensureSettingsDefaults()가 누락된 키를 기본값으로 채움
  deathCurseUntil: null, // 망자의 저주(사망 패널티) 만료 시각(epoch ms). null이면 미적용
  bestLevel: 0, totalAttempts: 0, totalDestroys: 0, totalSold: 0, legendCount: 0, totalKills: 0,
};
let isEnhancing = false;
let currentView = 'forge';
let hunt = { dungeon: null, monsters: [], targetId: null, nextInstanceId: 1, stage: 1, chestOpened: false, timerId: null, paused: false, started: false, stageEnterTimeout: null, encounterTimeout: null, treasureShakeTimeout: null, deathAnimTimeouts: [], rewardModalTimeout: null };
// 상점 탭/정렬 UI 상태. 저장하지 않는 화면 전용 상태(재접속하면 기본값으로 초기화됨).
// equipTab: "장비" 최상위 탭 안에서 마지막으로 보고 있던 하위탭(weapon/armor/accessory/artifact)을
// 기억해뒀다가, "장비" 최상위 버튼을 다시 눌렀을 때 그 탭으로 돌아가기 위한 값.
let shopUI = { tab: 'weapon', equipTab: 'weapon', filter: 'price', dir: 'asc' };
// 인벤토리 탭 UI 상태. shopUI와 동일한 이유로 equipTab을 따로 기억함(저장 대상 아님).
let invUI = { tab: 'weapon', equipTab: 'weapon' };
// 페이지네이션: 화면(또는 탭)별 "현재 페이지" 번호(1부터 시작). PAGE_SIZE(data.js)와 키를 공유함 —
// 새 화면을 추가할 때 여기 초기값 1과 PAGE_SIZE에 같은 키만 추가하면 동일한 페이지 시스템을 그대로 재사용함.
let pageState = {
  invWeapon: 1,
  forgeSelect: 1,
  shopWeapon: 1, shopArmor: 1, shopAccessory: 1, shopConsumable: 1, shopArtifact: 1,
  dungeonList: 1,
  charStats: 1,
  charMenuInfo: 1,
  skillPage: 1,
};
let shopFilterMenuOpen = false;

const el = id => document.getElementById(id);
function getEquipped(){ return state.inventory.find(i => i.id === state.equippedId) || null; }

// SETTINGS_SCHEMA를 순회하며 state.settings에 없는 키를 기본값으로 채움.
// 새 설정 메뉴가 추가돼도 기존 저장 데이터를 불러올 때 자동으로 기본값이 채워짐.
function ensureSettingsDefaults(){
  if(!state.settings) state.settings = {};
  SETTINGS_SCHEMA.forEach(cat => {
    cat.items.forEach(item => {
      if(item.type === 'stepper-row'){
        item.fields.forEach(f => { if(!(f.id in state.settings)) state.settings[f.id] = f.default; });
      } else if(!(item.id in state.settings)){
        state.settings[item.id] = item.default;
      }
    });
  });
}

// ---- 사망 패널티(망자의 저주) ----
const DEATH_CURSE_DURATION_MS = 3 * 60 * 1000; // 3분
const DEATH_CURSE_MULTIPLIER = 0.5; // 골드/경험치 50% 감소
function isDeathCurseActive(){
  return !!(state.deathCurseUntil && Date.now() < state.deathCurseUntil);
}
let deathCurseTickInterval = null;
// 1초마다 뱃지(아이콘+남은시간)를 갱신하고, 만료되면 스스로 정리됨. 화면(마을/던전) 전환과 무관하게 동작.
function startDeathCurseTicker(){
  stopDeathCurseTicker();
  renderDeathCurseBadge();
  deathCurseTickInterval = setInterval(() => {
    if(!isDeathCurseActive()){
      state.deathCurseUntil = null;
      renderDeathCurseBadge();
      stopDeathCurseTicker();
      saveState();
      return;
    }
    renderDeathCurseBadge();
  }, 1000);
}
function stopDeathCurseTicker(){
  if(deathCurseTickInterval){ clearInterval(deathCurseTickInterval); deathCurseTickInterval = null; }
}

// 레벨업 시(혹은 최초 진입 시) 체력/마나를 최대치로 채움
function ensurePlayerVitals(){
  if(state.playerHp == null) state.playerHp = effectiveMaxHp(state.playerLevel);
  if(state.playerMp == null) state.playerMp = effectiveMaxMp(state.playerLevel);
}
// 경험치 획득 처리. 레벨업하면 몇 레벨이 올랐는지 반환(안 올랐으면 0)
function gainExp(amount){
  ensurePlayerVitals();
  if(state.playerLevel >= PLAYER_MAX_LEVEL){ state.playerExp = 0; return 0; }
  state.playerExp += amount;
  let levelsGained = 0;
  while(state.playerLevel < PLAYER_MAX_LEVEL && state.playerExp >= requiredExp(state.playerLevel)){
    state.playerExp -= requiredExp(state.playerLevel);
    state.playerLevel++;
    levelsGained++;
    state.playerHp = effectiveMaxHp(state.playerLevel); // 레벨업 시 완전 회복
    state.playerMp = effectiveMaxMp(state.playerLevel);
    state.statPoints = (state.statPoints || 0) + STAT_POINTS_PER_LEVEL;
    // 스킬/깨달음 포인트는 스탯 포인트처럼 매 레벨 고정 지급이 아니라 특정 레벨(마일스톤)에서만 지급되므로,
    // "이 레벨까지 누적 지급량 - 직전 레벨까지 누적 지급량"만큼만 더해줌(공식이 바뀌어도 이 코드는 그대로 동작함).
    state.skillPoints = (state.skillPoints || 0) + skillPointsGrantedAtLevel(state.playerLevel);
    state.awakeningPoints = (state.awakeningPoints || 0) + awakeningPointsGrantedAtLevel(state.playerLevel);
  }
  if(state.playerLevel >= PLAYER_MAX_LEVEL){
    state.playerLevel = PLAYER_MAX_LEVEL;
    state.playerExp = 0;
  }
  return levelsGained;
}

// ---- 아티팩트 보유/장착/지급 ----
// "보유"(state.artifacts)와 "장착"(state.equippedArtifacts)은 서로 다른 개념임.
// 보유 아티팩트 수는 제한이 없고(인벤토리에 계속 쌓임), 동시에 장착 가능한 개수만 ARTIFACT_SLOT_MAX로 제한됨.
function ownsArtifact(id){ return state.artifacts.includes(id); }
function isArtifactEquipped(id){ return state.equippedArtifacts.includes(id); }
function canGrantArtifact(id){ return !ownsArtifact(id); }
function grantArtifactSafe(id){
  if(!canGrantArtifact(id)) return false;
  state.artifacts.push(id);
  // 빈 장착 슬롯이 있을 때만 자동 장착. 슬롯이 가득 차 있으면 장착하지 않고 보유 목록에만 추가하며,
  // 이미 장착 중인 다른 아티팩트를 교체하지 않음.
  if(state.equippedArtifacts.length < ARTIFACT_SLOT_MAX) state.equippedArtifacts.push(id);
  return true;
}

// ---- 상태 이상(디버프) 적용 ----
function statusEffectById(id){
  return Object.values(STATUS_EFFECTS).find(e => e.id === id) || null;
}
// 대상(target: {maxHp, statusEffects:[]})에게 상태 이상을 적용(이미 걸려있으면 지속시간 갱신)
function applyStatusEffect(target, key){
  const def = STATUS_EFFECTS[key];
  if(!def) return;
  if(!target.statusEffects) target.statusEffects = [];
  const existing = target.statusEffects.find(s => s.key === key);
  if(existing){
    existing.ticksRemaining = def.maxTicks;
  } else {
    target.statusEffects.push({ key, ticksRemaining: def.maxTicks });
  }
}
// 대상에게 걸린 모든 상태 이상을 1틱 진행시키고, 이번 틱에 발생한 총 피해를 반환
function tickStatusEffects(target){
  if(!target.statusEffects || target.statusEffects.length === 0) return 0;
  let totalDamage = 0;
  target.statusEffects = target.statusEffects.filter(s => {
    const def = STATUS_EFFECTS[s.key];
    totalDamage += Math.max(1, Math.round(target.maxHp * def.damagePercentOfMaxHp / 100));
    s.ticksRemaining--;
    return s.ticksRemaining > 0;
  });
  return totalDamage;
}

// ---- 저장/불러오기 ----
function hasClaudeStorage(){
  return typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function';
}
function applyLoadedRaw(raw){
  if(!raw) return;
  const loaded = JSON.parse(raw);
  state = Object.assign(state, loaded);
  if(!Array.isArray(state.artifacts)) state.artifacts = [];
  // 구버전(ringOwned/batwingOwned) 마이그레이션
  if(loaded.ringOwned && !state.artifacts.includes('ring')) state.artifacts.push('ring');
  if(loaded.batwingOwned && !state.artifacts.includes('batwing')) state.artifacts.push('batwing');
  delete state.ringOwned;
  delete state.batwingOwned;
  // 장착 시스템 개편 이전 세이브 마이그레이션: 그때는 "보유 = 장착"이었으므로, 보유 중이던
  // 아티팩트를 장착 슬롯 최대치까지 그대로 장착 상태로 옮겨 기존 효과가 끊기지 않게 함.
  if(!Array.isArray(state.equippedArtifacts)) state.equippedArtifacts = state.artifacts.slice(0, ARTIFACT_SLOT_MAX);
  // 구버전 인벤토리(type 필드 없음) 마이그레이션: 전부 롱소드였음
  if(Array.isArray(state.inventory)){
    state.inventory.forEach(it => { if(!it.type) it.type = 'longsword'; });
  }
  // 구버전(스탯 시스템 이전) 마이그레이션: 이미 얻은 레벨만큼 포인트 소급 지급
  if(loaded.statPoints === undefined){
    state.statPoints = 4 * (state.playerLevel || 1);
    state.stats = { str: 0, agi: 0, int: 0 };
  }
  // 구버전(스킬 시스템 이전) 마이그레이션: 스탯 포인트와 동일한 방식으로, 이미 도달한 레벨 기준
  // 공식(totalSkillPointsForLevel/totalAwakeningPointsForLevel)으로 포인트를 소급 지급함.
  if(loaded.skillPoints === undefined) state.skillPoints = totalSkillPointsForLevel(state.playerLevel);
  if(loaded.awakeningPoints === undefined) state.awakeningPoints = totalAwakeningPointsForLevel(state.playerLevel);
  if(!Array.isArray(state.learnedSkills)) state.learnedSkills = [];
  if(!Array.isArray(state.learnedAwakeningSkills)) state.learnedAwakeningSkills = [];
  if(!Array.isArray(state.skillQuickSlots) || state.skillQuickSlots.length !== SKILL_QUICK_SLOT_COUNT){
    const prevSkillSlots = Array.isArray(state.skillQuickSlots) ? state.skillQuickSlots : [];
    state.skillQuickSlots = Array.from({ length: SKILL_QUICK_SLOT_COUNT }, (_, i) => prevSkillSlots[i] || null);
  }
  if(!state.consumables) state.consumables = { hpFlask: 0, mpFlask: 0 };
  if(!Array.isArray(state.quickSlots) || state.quickSlots.length !== QUICK_SLOT_COUNT){
    const prev = Array.isArray(state.quickSlots) ? state.quickSlots : [];
    state.quickSlots = Array.from({ length: QUICK_SLOT_COUNT }, (_, i) => prev[i] || null);
  }
  ensureSettingsDefaults();
}
async function loadState(){
  try{
    if(hasClaudeStorage()){
      const res = await window.storage.get(STORAGE_KEY, false);
      if(res && res.value) applyLoadedRaw(res.value);
    } else {
      applyLoadedRaw(localStorage.getItem(STORAGE_KEY));
    }
  }catch(e){
    // window.storage를 쓸 수 없는 환경(다운로드해서 직접 연 파일 등)이면 localStorage로 폴백
    try{ applyLoadedRaw(localStorage.getItem(STORAGE_KEY)); }
    catch(e2){ /* 저장된 값 없음: 새 게임 */ }
  }
  ensurePlayerVitals();
  ensureSettingsDefaults();
  if(isDeathCurseActive()) startDeathCurseTicker(); else renderDeathCurseBadge();
  render();
}
async function saveState(){
  const payload = JSON.stringify(state);
  if(hasClaudeStorage()){
    try{
      await window.storage.set(STORAGE_KEY, payload, false);
      return;
    }catch(e){
      await new Promise(res => setTimeout(res, 600));
      try{
        await window.storage.set(STORAGE_KEY, payload, false);
        return;
      }catch(e2){ /* Claude storage 실패 시 아래 localStorage로 폴백 */ }
    }
  }
  try{ localStorage.setItem(STORAGE_KEY, payload); }
  catch(e){ console.error('저장 실패', e); }
}

// ---- 초기화(리셋) ----
let resetArmed = false;
let resetArmTimeout = null;
function resetGame(){
  if(!resetArmed){
    resetArmed = true;
    el('resetLink').textContent = '정말 초기화하려면 한 번 더 클릭하세요';
    el('resetLink').style.color = 'var(--forge-blood)';
    el('resetLink').style.opacity = '1';
    clearTimeout(resetArmTimeout);
    resetArmTimeout = setTimeout(()=>{
      resetArmed = false;
      el('resetLink').textContent = '처음부터 다시 시작';
      el('resetLink').style.color = '';
      el('resetLink').style.opacity = '';
    }, 3000);
    return;
  }
  clearTimeout(resetArmTimeout);
  resetArmed = false;
  el('resetLink').textContent = '처음부터 다시 시작';
  el('resetLink').style.color = '';
  el('resetLink').style.opacity = '';
  stopHuntLoop();
  stopDeathCurseTicker();
  hunt = { dungeon: null, monsters: [], targetId: null, nextInstanceId: 1, stage: 1, chestOpened: false, timerId: null, paused: false, started: false, stageEnterTimeout: null, encounterTimeout: null, treasureShakeTimeout: null };

  state = {
    gold: 1000, inventory: [], equippedId: null, nextItemId: 1,
    charmCount:0, charmPrice:1500, charmActive:false,
    blessingCount:0, blessingPrice:15000, blessingActive:false,
    artifacts: [], equippedArtifacts: [], manaFragments: 0, manaShards: 0, manaCrystals: 0, manaStones: 0,
    acorns: 0, ratMeats: 0, batMeats: 0, snakeMeats: 0, deerMeats: 0, deerAntlers: 0, bearHides: 0, bearBiles: 0,
    skipEffects:false, autoRebuy:false,
    playerLevel: 1, playerExp: 0, playerHp: null, playerMp: null,
    statPoints: 4, stats: { str: 0, agi: 0, int: 0 },
    skillPoints: 1, awakeningPoints: 0, learnedSkills: [], learnedAwakeningSkills: [],
    skillQuickSlots: [null, null, null, null, null],
    consumables: { hpFlask: 0, mpFlask: 0 },
    quickSlots: [null, null],
    settings: {},
    deathCurseUntil: null,
    bestLevel:0, totalAttempts:0, totalDestroys:0, totalSold:0, legendCount:0, totalKills:0
  };
  ensurePlayerVitals();
  ensureSettingsDefaults();
  renderDeathCurseBadge();
  showMsg('', '');
  showView('forge');
  saveState();
}
