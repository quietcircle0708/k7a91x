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
  equippedId: null,   // 실제 전투에 사용되는 착용 무기(대장간 화면과 무관하게 항상 무기만 가리킴)
  // 대장간 화면(swordStage)에 지금 표시된 "강화 대상" — 무기든 방어구든 상관없이 여기에 지정된 아이템이
  // 표시됨. 무기를 강화 선택하면 equipItem()이 이 값과 equippedId를 함께 갱신(=강화 선택이 곧 착용)하지만,
  // 방어구를 강화 선택할 때는 equippedId(착용 무기)는 건드리지 않고 이 값만 바뀜 — 방어구의 실제 능력치
  // 적용은 이 값과 무관하게 별도의 equippedArmor(착용) 상태를 따름.
  forgeTargetId: null,
  nextItemId: 1,
  armorInventory: [],                          // 보유 방어구 목록({id,type,level}, 무기 인벤토리와 동일한 형태)
  equippedArmor: { helmet: null, armor: null }, // 착용 중인 방어구(종류당 1개) — 강화 대상(forgeTargetId)과는 별개 개념
  subInventory: [],                             // 보유 보조(방패/보조 무기) 목록({id,type,level} — level은 강화가 없어 항상 0)
  equippedSubId: null,                          // 착용 중인 보조 아이템 id(동시에 1개만, 양손 검 장착 중이면 착용 불가)
  accessoryInventory: [],                       // 보유 장신구 목록({id,type,level})
  equippedAccessories: [null, null],            // 착용 중인 장신구(장신구1/장신구2 슬롯, 최대 ACCESSORY_SLOT_MAX개) — 같은 아이템 2개 착용 가능
  traceInventory: [],                           // 보유 흔적 목록({id,forType} — forType은 복구할 장비의 WEAPON_TYPES/
                                                  // ARMOR_TYPES/ACCESSORY_TYPES 키. 강화 파괴 시 processDestroyReward가
                                                  // 지급하고, useTraceItem→confirmTraceRestore로 소모해 +0 장비로 복구함)
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
  acorns: 0, ratMeats: 0, batMeats: 0, snakeMeats: 0, deerMeats: 0, deerAntlers: 0, bearHides: 0, bearBiles: 0, mountainBoarMeats: 0, forestBoarMeats: 0, foxFurs: 0, tigerHides: 0, ambers: 0, purpleAmbers: 0, // 기타(재료) 아이템 보유 개수
  skipEffects: false,
  autoRebuy: false,
  playerLevel: 1, playerExp: 0, playerHp: null, playerMp: null, // 캐릭터 레벨/경험치/체력/마나
  statPoints: 4, stats: { str: 0, agi: 0, int: 0 }, // 미할당 스탯 포인트 및 투자한 스탯
  skillPoints: 1, awakeningPoints: 0, // 미사용 스킬 포인트(공용·특화 공유) / 미사용 깨달음(기연 전용) — 레벨1 기준 공식값
  learnedSkills: [], learnedAwakeningSkills: [], // 습득한 스킬 id 목록(공용·특화 공용 / 기연 별도)
  skillQuickSlots: [null, null, null, null, null], // 스킬 퀵슬롯(왼쪽 5칸)에 등록된 스킬 id
  consumables: { hpFlask6: 0, mpFlask6: 0 }, // 보유 플라스크 개수
  quickSlots: [null, null], // 사냥 화면 퀵슬롯에 등록된 소비 아이템 id
  settings: {}, // 설정값 저장 (키: SETTINGS_SCHEMA의 항목 id). ensureSettingsDefaults()가 누락된 키를 기본값으로 채움
  deathCurseUntil: null, // 망자의 저주(사망 패널티) 만료 시각(epoch ms). null이면 미적용
  bestLevel: 0, totalAttempts: 0, totalDestroys: 0, totalSold: 0, legendCount: 0, totalKills: 0,
};
let isEnhancing = false;
let currentView = 'forge';
let hunt = { dungeon: null, monsters: [], targetId: null, nextInstanceId: 1, stage: 1, chestOpened: false, timerId: null, paused: false, started: false, stageEnterTimeout: null, encounterTimeout: null, treasureShakeTimeout: null, deathAnimTimeouts: [], rewardModalTimeout: null, player: { statusEffects: [] }, topUiExpanded: false };
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
  invArmor: 1,
  invSub: 1,
  invAccessory: 1,
  forgeSelect: 1,
  shopWeapon: 1, shopArmor: 1, shopSub: 1, shopAccessory: 1, shopConsumable: 1, shopArtifact: 1,
  dungeonList: 1,
  charStats: 1,
  charMenuInfo: 1,
  skillPage: 1,
  huntCharStats: 1,
  // dungeonDrop 페이지는 던전마다 따로 관리해야 해서 고정 키 하나가 아니라, 던전 카드를 그릴 때
  // `dungeonDrop:<던전id>` 형태의 동적 키를 이 오브젝트에 필요할 때마다 추가해서 씀(goPage의 범용
  // "pageState[target] = ..." 로직을 그대로 재사용하기 위함, render.js buildDungeonDropIcons 참고).
};
let shopFilterMenuOpen = false;

const el = id => document.getElementById(id);
// 대장간 화면(swordStage)에 지금 표시된 "강화 대상" — 무기든 방어구든 상관없이 state.forgeTargetId가
// 가리키는 아이템을 반환함(사용자 요청: 강화 화면에서 강화 가능한 모든 장비를 선택해서 쓸 수 있어야 함).
function getEquipped(){
  return state.inventory.find(i => i.id === state.forgeTargetId)
    || (state.armorInventory || []).find(i => i.id === state.forgeTargetId)
    || (state.accessoryInventory || []).find(i => i.id === state.forgeTargetId)
    || null;
}
// 공격력 등 "실제 전투에 쓰이는 착용 무기"가 필요한 곳 전용(스킬 데미지 계산, 던전 입장 조건, 전투 자동
// 공격, 캐릭터 정보창의 "장착 무기" 패널 등) — 대장간 화면에 방어구가 선택되어 있어도 이 함수는 항상
// state.equippedId(착용 무기)만 반환함. 방어구 시스템 추가 이전의 원래 getEquipped()와 동일한 동작.
function getEquippedWeapon(){ return state.inventory.find(i => i.id === state.equippedId) || null; }

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
// 방어구 착용/해제/강화처럼 최대 체력·마나(effectiveMaxHp/Mp)가 즉시 바뀔 수 있는 동작 이후 호출.
// 현재 체력/마나가 새 최대치를 넘지 않도록 잘라줌(레벨업 때처럼 꽉 채우지는 않음 — 착용 해제로 체력이
// 줄어드는 경우를 자연스럽게 처리하기 위함).
function clampPlayerVitals(){
  ensurePlayerVitals();
  const maxHp = effectiveMaxHp(state.playerLevel);
  const maxMp = effectiveMaxMp(state.playerLevel);
  if(state.playerHp > maxHp) state.playerHp = maxHp;
  if(state.playerMp > maxMp) state.playerMp = maxMp;
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
// 대상(target: {maxHp?, statusEffects:[]})에게 상태 이상을 적용(이미 걸려있으면 지속시간 갱신).
// - 중독(type:'dot')처럼 틱 기반 상태 이상은 def.maxTicks를 그대로 사용(durationMs는 무시 — 기존 로직과 100% 동일)
// - 기절/둔화처럼 지속시간형(type:'disable'|'atkSpeedMult') 상태 이상은 호출부(스킬/아이템 등)가 durationMs(밀리초)를
//   넘겨서 그때그때 지속시간을 지정함(요구사항 4번). 만료 시각(expiresAt)을 저장해두고 매번 실시간으로 판정하므로
//   1.25초처럼 1초 틱 간격에 맞아떨어지지 않는 지속시간도 정확하게 처리됨.
function applyStatusEffect(target, key, durationMs){
  const def = STATUS_EFFECTS[key];
  if(!def) return;
  if(!target.statusEffects) target.statusEffects = [];
  const existing = target.statusEffects.find(s => s.key === key);
  if(def.type === 'dot'){
    // lastTickAt: 이 상태 이상 자신의 tickIntervalMs 간격을 실시간으로 재는 기준 시각.
    // 틱 판정 자체는 tickStatusEffects가 담당(아래 참고) — 여기서는 갱신/신규 부여 시 기준 시각만 초기화.
    if(existing){ existing.ticksRemaining = def.maxTicks; existing.lastTickAt = Date.now(); }
    else target.statusEffects.push({ key, ticksRemaining: def.maxTicks, lastTickAt: Date.now() });
    return;
  }
  const expiresAt = Date.now() + Math.max(0, durationMs || 0);
  if(existing) existing.expiresAt = expiresAt;
  else target.statusEffects.push({ key, expiresAt });
}
// 대상에게 걸린 상태 이상 중 "지속 피해형(중독 등, type:'dot')"만 판정해, 이번 호출 시점까지 실제로 발생한
// 총 피해를 반환. 예전에는 이 함수가 호출될 때마다(=dungeon.js의 1초 고정 루프가 돌 때마다) 무조건 1틱씩
// 진행시켰는데, 그러면 STATUS_EFFECTS 데이터의 tickIntervalMs 값이 실제로는 전혀 읽히지 않고 항상 "루프
// 주기(1초)"로만 틱이 도는 문제가 있었음(중독의 tickIntervalMs를 500으로 바꿔도 아무 효과가 없었을 것).
// 지금은 각 상태 이상 인스턴스가 자신의 lastTickAt을 갖고, "이번 호출 시점 - lastTickAt >= 그 상태 이상의
// tickIntervalMs"일 때만 실제로 1틱을 진행시키도록 바꿔서, 호출 주기(dungeon.js 루프의 실제 해상도)와
// 무관하게 데이터에 적힌 tickIntervalMs가 그대로 반영됨 — 앞으로 tickIntervalMs가 다른 dot 상태 이상이
// 추가돼도(예: 어떤 상태이상은 0.5초마다, 어떤 상태이상은 2초마다) 동시에 정확히 처리됨.
function tickStatusEffects(target){
  if(!target.statusEffects || target.statusEffects.length === 0) return 0;
  const now = Date.now();
  let totalDamage = 0;
  target.statusEffects = target.statusEffects.filter(s => {
    const def = STATUS_EFFECTS[s.key];
    if(!def || def.type !== 'dot') return true;
    if(now - (s.lastTickAt || 0) < def.tickIntervalMs) return true; // 아직 이 상태 이상 자신의 틱 간격이 안 지남
    totalDamage += Math.max(1, Math.round(target.maxHp * def.damagePercentOfMaxHp / 100));
    s.lastTickAt = now;
    s.ticksRemaining--;
    return s.ticksRemaining > 0;
  });
  return totalDamage;
}
// 지속시간형 상태 이상(기절/둔화 등) 중 만료된 것을 정리. 중독(틱 기반)은 tickStatusEffects가 별도로
// 제거를 처리하므로 여기서는 건드리지 않음(dot 타입은 항상 유지).
function pruneExpiredStatusEffects(target){
  if(!target.statusEffects || target.statusEffects.length === 0) return;
  const now = Date.now();
  target.statusEffects = target.statusEffects.filter(s => {
    const def = STATUS_EFFECTS[s.key];
    if(!def || def.type === 'dot') return true;
    return s.expiresAt > now;
  });
}
// 대상이 특정 상태 이상에 지금 걸려있는지(지속시간형은 만료 여부까지 실시간으로 판정 — 배열 정리 주기와
// 무관하게 항상 정확함)
function hasActiveStatusEffect(target, key){
  if(!target || !target.statusEffects) return false;
  const s = target.statusEffects.find(x => x.key === key);
  if(!s) return false;
  const def = STATUS_EFFECTS[key];
  if(!def) return false;
  if(def.type === 'dot') return true; // 배열에 남아있으면 곧 살아있는 중독(만료 제거는 tickStatusEffects 담당)
  return s.expiresAt > Date.now();
}
// 기절 여부 — 기절 중에는 기본공격/스킬사용/회복 등 모든 전투 행동을 정지시켜야 하므로, 각 행동 함수의
// 진입부에서 이 함수로 분기함(dungeon.js attackTick/monsterAttackTick, actions.js canUseSkillNow/useFlask)
function isStunned(target){
  return hasActiveStatusEffect(target, 'stun');
}
// 현재 적용 중인 공격속도 배율(둔화 등 type:'atkSpeedMult'인 상태 이상을 전부 곱산). 아무것도 없으면 1(배율 없음).
// 공격 간격을 직접 늘리는 방식이 아니라, 공격속도(초당 공격 횟수) 값 자체에 곱해서 쓰는 방식(요구사항 5번)이라
// 호출부는 "기존 공격속도 x 이 배율"만 계산하면 됨.
function attackSpeedMultiplier(target){
  if(!target || !target.statusEffects || target.statusEffects.length === 0) return 1;
  const now = Date.now();
  let mult = 1;
  target.statusEffects.forEach(s => {
    const def = STATUS_EFFECTS[s.key];
    if(def && def.type === 'atkSpeedMult' && s.expiresAt > now) mult *= def.atkSpeedMultiplier;
  });
  return mult;
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
  // 이후 데이터에서 완전히 삭제된 아티팩트(예: 사각 방패/squareshield — 보조 아이템으로 재구성 예정이라
  // ARTIFACTS에서 제거됨)를 예전에 보유·장착해둔 세이브가 있으면, ARTIFACTS[id]가 undefined인 채로
  // 남아 인벤토리·강화 화면 렌더링이 전부 그 지점에서 예외로 멈춰버림(인벤토리 빈 화면, 던전 진입
  // 실패 등 연쇄 증상). 더 이상 존재하지 않는 id는 보유·장착 목록 양쪽에서 조용히 제거해 정리함.
  state.artifacts = state.artifacts.filter(id => ARTIFACTS[id]);
  state.equippedArtifacts = state.equippedArtifacts.filter(id => ARTIFACTS[id]);
  // 구버전 인벤토리(type 필드 없음) 마이그레이션: 전부 롱소드였음
  if(Array.isArray(state.inventory)){
    state.inventory.forEach(it => { if(!it.type) it.type = 'longsword'; });
  }
  // 방어구 시스템 추가 이전 세이브 마이그레이션: 필드 자체가 없었으므로 빈 값으로 채움
  if(!Array.isArray(state.armorInventory)) state.armorInventory = [];
  if(!state.equippedArmor || typeof state.equippedArmor !== 'object') state.equippedArmor = { helmet: null, armor: null };
  if(state.equippedArmor.helmet === undefined) state.equippedArmor.helmet = null;
  if(state.equippedArmor.armor === undefined) state.equippedArmor.armor = null;
  // 장신구 시스템 추가 이전 세이브 마이그레이션: 필드 자체가 없었으므로 빈 값으로 채움
  if(!Array.isArray(state.accessoryInventory)) state.accessoryInventory = [];
  if(!Array.isArray(state.equippedAccessories)) state.equippedAccessories = [null, null];
  while(state.equippedAccessories.length < ACCESSORY_SLOT_MAX) state.equippedAccessories.push(null);
  // 보조(방패/보조 무기) 시스템 추가 이전 세이브 마이그레이션: 필드 자체가 없었으므로 빈 값으로 채움
  if(!Array.isArray(state.subInventory)) state.subInventory = [];
  if(state.equippedSubId === undefined) state.equippedSubId = null;
  // 강화 파괴/흔적 시스템 추가 이전 세이브 마이그레이션: 필드 자체가 없었으므로 빈 값으로 채움
  if(!Array.isArray(state.traceInventory)) state.traceInventory = [];
  // 대장간 강화 대상(forgeTargetId) 추가 이전 세이브 마이그레이션: 예전엔 equippedId 하나가 "착용
  // 무기"와 "대장간 표시 대상"을 겸했으므로, 없으면 기존 equippedId 값을 그대로 이어받음.
  if(state.forgeTargetId === undefined) state.forgeTargetId = state.equippedId != null ? state.equippedId : null;
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
  if(!state.consumables) state.consumables = { hpFlask6: 0, mpFlask6: 0 };
  // 구버전(플라스크 리네임 이전) 마이그레이션: 기존 hpFlask/mpFlask로 저장된 보유 수량을
  // 동일한 지속 회복 플라스크인 hpFlask6/mpFlask6로 그대로 이전(수량 손실 없이 합산).
  if(state.consumables.hpFlask){
    state.consumables.hpFlask6 = (state.consumables.hpFlask6 || 0) + state.consumables.hpFlask;
    delete state.consumables.hpFlask;
  }
  if(state.consumables.mpFlask){
    state.consumables.mpFlask6 = (state.consumables.mpFlask6 || 0) + state.consumables.mpFlask;
    delete state.consumables.mpFlask;
  }
  if(Array.isArray(state.quickSlots)){
    state.quickSlots = state.quickSlots.map(id => id === 'hpFlask' ? 'hpFlask6' : id === 'mpFlask' ? 'mpFlask6' : id);
  }
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
    gold: 1000, inventory: [], equippedId: null, forgeTargetId: null, nextItemId: 1,
    armorInventory: [], equippedArmor: { helmet: null, armor: null },
    subInventory: [], equippedSubId: null,
    accessoryInventory: [], equippedAccessories: [null, null],
    traceInventory: [],
    charmCount:0, charmPrice:1500, charmActive:false,
    blessingCount:0, blessingPrice:15000, blessingActive:false,
    artifacts: [], equippedArtifacts: [], manaFragments: 0, manaShards: 0, manaCrystals: 0, manaStones: 0,
    acorns: 0, ratMeats: 0, batMeats: 0, snakeMeats: 0, deerMeats: 0, deerAntlers: 0, bearHides: 0, bearBiles: 0, mountainBoarMeats: 0, forestBoarMeats: 0, foxFurs: 0, tigerHides: 0, ambers: 0, purpleAmbers: 0,
    skipEffects:false, autoRebuy:false,
    playerLevel: 1, playerExp: 0, playerHp: null, playerMp: null,
    statPoints: 4, stats: { str: 0, agi: 0, int: 0 },
    skillPoints: 1, awakeningPoints: 0, learnedSkills: [], learnedAwakeningSkills: [],
    skillQuickSlots: [null, null, null, null, null],
    consumables: { hpFlask6: 0, mpFlask6: 0 },
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
