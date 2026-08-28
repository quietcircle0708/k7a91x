// ============================================================
// dungeon.js — 던전 전투 흐름 (11스테이지 시스템 + 복수 몬스터 동시 등장)
// 던전 입장 → 스테이지 입장 메시지 → 몬스터 생성(최대 3마리, 개별 개체) → 조우 메시지 → 전투(자동 시작)
// → 전멸 시 처치한 모든 몬스터의 보상을 합산해 표시 → 행동 선택(마을 귀환/탐험 계속)
// → 다음 스테이지 ... → 11스테이지(숨겨진 장소, 보물 상자)
// ============================================================

function enterDungeon(id){
  const d = DUNGEONS.find(x => x.id === id);
  if(!d || !getEquippedWeapon()) return; // 던전 입장은 실제 착용 무기 기준(대장간 화면 선택 대상과 무관)
  hunt.dungeon = d;
  hunt.monsters = [];
  hunt.targetId = null;
  hunt.paused = true;
  hunt.started = false;
  hunt.player = { statusEffects: [] }; // 새 던전 진입 시 플레이어의 전투용 상태 이상(기절/둔화 등)도 초기화
  hunt.topUiExpanded = false; // 던전 입장 시 상단 UI는 항상 접힌 상태로 시작
  updateHuntTopUiToggle();
  showView('hunt');
  enterStage(1);
}

// 스테이지 진입: 입장 메시지를 DUNGEON_MSG_DURATION_MS(1초)만큼 보여준 뒤,
// 전투 스테이지(1~10)면 몬스터를 생성하고, 11스테이지(숨겨진 장소)면 보물 상자를 연다.
function enterStage(stageNum){
  hunt.stage = stageNum;
  hunt.monsters = [];
  hunt.targetId = null;
  hunt.chestOpened = false;
  hunt.paused = true;
  hunt.started = false;
  renderHunt();
  const row = el('monsterRow');
  if(row) row.innerHTML = ''; // 이전 스테이지의 몬스터 슬롯 잔재 제거 — 입장 메시지가 끝나기 전엔 아무것도 안 보임
  const playerIcon = el('combatPlayerIcon');
  if(playerIcon){ playerIcon.classList.remove('hit', 'dead'); } // 이전 전투의 피격/사망 애니메이션 잔재 제거
  showDungeonMsg(stageEnterMessage(stageNum, hunt.dungeon.name));
  hunt.stageEnterTimeout = setTimeout(() => {
    if(stageNum === DUNGEON_TREASURE_STAGE){
      openTreasureStage();
    } else {
      spawnMonsters();
    }
  }, DUNGEON_MSG_DURATION_MS);
}

// ---- 몬스터 그룹 생성(최대 3마리) ----
// 1) 스테이지 기준으로 등장 마리 수(1~3)를 추첨 2) 마리 수만큼 등급(에픽은 그룹당 최대 1마리)을 결정
// 3) 등급별로 이 던전에 맞는 몬스터 종류/레벨을 뽑아 개별 개체(instance)로 생성
function spawnMonsters(){
  const d = hunt.dungeon;
  if(!d) return;
  const count = pickMonsterCount(hunt.stage);
  const grades = pickStageMonsterGrades(hunt.stage, count);
  hunt.monsters = grades.map(grade => createMonsterInstance(d, grade));
  assignMonsterPositions(hunt.monsters); // 각 개체에 상/하/좌/우 중 겹치지 않는 위치를 무작위 배정(instance.pos)
  hunt.targetId = hunt.monsters.length ? hunt.monsters[0].instanceId : null;
  // 이번 전투(그룹 전멸까지)에서 처치한 모든 몬스터의 보상을 합산해 담아둘 그릇
  hunt.pendingRewards = {
    gold: 0, expGained: 0, levelsGained: 0, newPlayerLevel: state.playerLevel,
    weaponDrops: [], weaponIdDrops: [], stoneDrops: {}, flaskDrops: {}, artifactDrops: [], miscDrops: {}, killedMonsters: [],
  };

  renderHunt();
  renderMonsterRow();
  renderStatusBadges();
  const combatPanel = el('huntCombatPanel');
  if(combatPanel){
    combatPanel.classList.remove('spawn-in');
    void combatPanel.offsetWidth; // 리플로우를 강제해 애니메이션이 매번 처음부터 재생되도록 함
    combatPanel.classList.add('spawn-in'); // 몬스터 이미지와 동시에 0.5초 페이드 인
  }
  // 조우 메시지는 대표로 첫 번째 몬스터를 기준으로 출력(2마리 이상이어도 안내 문구 자체는 기존과 동일한 형식 사용)
  showEncounterToast(MONSTERS[hunt.monsters[0].monsterId]);
  // 조우 메시지 노출이 끝나면 전투를 자동으로 시작함(수동 "탐험 시작" 버튼 없음)
  hunt.encounterTimeout = setTimeout(() => {
    beginStageCombat();
  }, DUNGEON_MSG_DURATION_MS);
}
// 몬스터 개체 하나 생성(레벨/체력/공격력 계산은 기존 단일 몬스터 로직과 동일, 개체별로 독립된 객체를 만듦)
function createMonsterInstance(dungeon, grade){
  const monsterId = pickSpawnMonsterOfGrade(dungeon, grade);
  const monsterDef = MONSTERS[monsterId];
  // 일반 등급: 몬스터 레벨 ~ (몬스터 레벨 + 던전 레벨범위) 구간에서 균등 추첨 / 그 외 등급: 고정 레벨
  const level = monsterDef.grade === 'normal'
    ? pickSpawnLevel(monsterDef.level, monsterDef.level + (dungeon.levelRange || 0))
    : monsterDef.level;
  const maxHp = monsterHPFor(monsterDef, level);
  // 몬스터 공격속도가 0.5→1.0(2초→1초당 1회)로 빨라진 밸런스 보정으로, 공격 빈도가 2배가 된 만큼
  // 최종 공격력에 배율을 곱해 DPS를 조정함(monsterAtkFor 공식 자체는 변경하지 않음). 배율 0.5→0.8로 상향(밸런스 조정).
  const atk = Math.round(monsterAtkFor(monsterDef, level) * 0.8);
  return {
    instanceId: hunt.nextInstanceId++,
    monsterId: monsterDef.id, level, hp: maxHp, maxHp, atk, statusEffects: [],
    atkIntervalId: null, atkFirstTimeout: null,
  };
}
// 주어진 등급에 해당하는 이 던전의 몬스터 종류 중 하나를 결정.
// - 에픽 등급: 이 던전에 등록된 에픽 몬스터가 2종 이상이면 pickEpicMonsterId로 굴 제한/개별 확률을 적용해 결정,
//   1종뿐이면 그 몬스터를 그대로 반환(추가 로직 없이 기존 동작과 동일).
// - 일반 등급 및 그 외: 기존과 동일하게 균등 추첨.
// 해당 등급 몬스터가 이 던전에 하나도 없으면(예: 다람쥐굴처럼 에픽 몬스터가 없는 던전) 등급 제한 없이 폴백.
function pickSpawnMonsterOfGrade(dungeon, grade){
  let candidates = dungeon.monsters.filter(id => MONSTERS[id].grade === grade);
  if(grade === 'epic' && candidates.length > 0) return pickEpicMonsterId(dungeon, hunt.stage);
  if(candidates.length === 0) candidates = dungeon.monsters; // 이 던전에 해당 등급 몬스터가 아예 없으면(예: 에픽 없는 던전) 등급 제한 없이 폴백
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// 조우 메시지 노출이 끝난 뒤 실제 전투(공격 루프)를 시작함
function beginStageCombat(){
  if(!hunt.dungeon || hunt.monsters.length === 0 || hunt.started) return;
  hunt.started = true;
  hunt.paused = false;
  startHuntLoop();
  renderHunt();
}

// ---- 전투 루프 ----
// 플레이어 공격은 단일 타이머로 진행되며, 매번 현재 지정된 대상(hunt.targetId)을 공격한다.
// 몬스터는 개체마다 자신의 공격속도로 독립된 타이머를 가진다(startMonsterAttackTimer).
function startHuntLoop(){
  stopHuntLoop();
  const equipped = getEquippedWeapon(); // 공격속도는 실제 착용 무기 기준(대장간 선택 대상과 무관)
  const baseSpeed = equipped ? effectiveAtkSpeed(equipped.type || 'longsword', equipped.level) : 0.5;
  const speed = baseSpeed * attackSpeedMultiplier(hunt.player); // 둔화 등 공격속도 배율형 상태 이상 반영
  const intervalMs = Math.round(1000 / speed);

  // 플레이어 첫 공격: 전투 시작 0.5초 후, 이후 무기 공격속도 주기로 반복
  hunt.playerFirstAttackTimeout = setTimeout(() => {
    attackTick();
    hunt.timerId = setInterval(attackTick, intervalMs);
  }, 500);

  hunt.monsters.forEach(startMonsterAttackTimer);
  startStatusTicker();
}
// 몬스터 개체 하나의 공격 타이머 시작: 전투 시작 1초 후 첫 공격, 이후 이 몬스터의 공격속도 주기로 반복
function startMonsterAttackTimer(instance){
  const monsterDef = MONSTERS[instance.monsterId];
  const speedMult = (monsterDef && monsterDef.speedMult != null) ? monsterDef.speedMult : 1;
  const monsterSpeed = MONSTER_ATTACK_SPEED * speedMult * attackSpeedMultiplier(instance); // 둔화 등 반영
  const intervalMs = Math.round(1000 / monsterSpeed);
  instance.atkFirstTimeout = setTimeout(() => {
    monsterAttackTick(instance.instanceId);
    instance.atkIntervalId = setInterval(() => monsterAttackTick(instance.instanceId), intervalMs);
  }, 1000);
}
// ---- 공격속도 배율형 상태 이상(둔화 등) 적용/만료 시 타이머 재계산 ----
// 이미 setInterval로 도는 공격 타이머는 간격이 고정돼있어서, 전투 도중 배율이 바뀌면(둔화가 걸리거나
// 풀리면) 새 간격으로 다시 시작해줘야만 실제로 반영됨. 진행 중이던 타이머의 남은 시간은 보존하지 않고
// 새 간격으로 즉시 재시작하는 단순한 방식(요구사항 5번: 간격을 직접 조작하지 않고 "공격속도 값"에
// 배율을 곱해서 다시 계산하는 방식).
function refreshPlayerAttackTimer(){
  if(!hunt.started || hunt.paused || !hunt.timerId) return; // 아직 첫 공격 대기 중이면 시작될 때 자연히 반영됨
  clearInterval(hunt.timerId);
  const equipped = getEquippedWeapon();
  if(!equipped) return;
  const baseSpeed = effectiveAtkSpeed(equipped.type || 'longsword', equipped.level);
  const speed = baseSpeed * attackSpeedMultiplier(hunt.player);
  hunt.timerId = setInterval(attackTick, Math.round(1000 / speed));
}
function refreshMonsterAttackTimer(instance){
  if(!instance || !instance.atkIntervalId) return; // 아직 첫 공격 전(atkFirstTimeout 대기 중)이면 시작될 때 자연히 반영됨
  clearInterval(instance.atkIntervalId);
  const monsterDef = MONSTERS[instance.monsterId];
  const speedMult = (monsterDef && monsterDef.speedMult != null) ? monsterDef.speedMult : 1;
  const baseSpeed = MONSTER_ATTACK_SPEED * speedMult;
  const speed = baseSpeed * attackSpeedMultiplier(instance);
  instance.atkIntervalId = setInterval(() => monsterAttackTick(instance.instanceId), Math.round(1000 / speed));
}
// 플레이어에게 상태 이상을 부여하는 공통 진입점(기절/둔화를 실제로 부여하는 스킬/아이템 기능은 추후 추가 —
// 그 기능들이 이 함수를 호출하게 될 예정). 공격속도 배율형 상태 이상은 부여 즉시 타이머에 반영하고,
// 지속시간형 상태 이상은 만료되는 정확한 시점에 자동으로 정리 + 타이머 재계산까지 처리함.
function applyStatusEffectToPlayer(key, durationMs){
  applyStatusEffect(hunt.player, key, durationMs);
  const def = STATUS_EFFECTS[key];
  if(!def) return;
  if(def.type === 'atkSpeedMult') refreshPlayerAttackTimer();
  if(def.type !== 'dot' && durationMs > 0){
    setTimeout(() => {
      pruneExpiredStatusEffects(hunt.player);
      if(def.type === 'atkSpeedMult') refreshPlayerAttackTimer();
    }, durationMs);
  }
}
// 몬스터 개체에게 상태 이상을 부여하는 공통 진입점(용도는 위 applyStatusEffectToPlayer와 동일)
function applyStatusEffectToMonster(instance, key, durationMs){
  applyStatusEffect(instance, key, durationMs);
  const def = STATUS_EFFECTS[key];
  if(!def) return;
  if(def.type === 'atkSpeedMult') refreshMonsterAttackTimer(instance);
  if(def.type !== 'dot' && durationMs > 0){
    setTimeout(() => {
      pruneExpiredStatusEffects(instance);
      if(def.type === 'atkSpeedMult') refreshMonsterAttackTimer(instance);
      renderStatusBadges();
    }, durationMs);
  }
  renderStatusBadges();
}
// flaskEndMode: 'flush'(기본, 생존 상태로 전투 종료 — 남은 회복량 즉시 적용 후 종료) |
//               'discard'(사망으로 전투 종료 — 남은 회복량 적용 없이 폐기, HP 변경 없음)
function stopHuntLoop(flaskEndMode = 'flush'){
  if(hunt.timerId){ clearInterval(hunt.timerId); hunt.timerId = null; }
  if(hunt.playerFirstAttackTimeout){ clearTimeout(hunt.playerFirstAttackTimeout); hunt.playerFirstAttackTimeout = null; }
  hunt.monsters.forEach(m => {
    if(m.atkIntervalId){ clearInterval(m.atkIntervalId); m.atkIntervalId = null; }
    if(m.atkFirstTimeout){ clearTimeout(m.atkFirstTimeout); m.atkFirstTimeout = null; }
  });
  if(hunt.stageEnterTimeout){ clearTimeout(hunt.stageEnterTimeout); hunt.stageEnterTimeout = null; }
  if(hunt.encounterTimeout){ clearTimeout(hunt.encounterTimeout); hunt.encounterTimeout = null; }
  if(hunt.treasureShakeTimeout){ clearTimeout(hunt.treasureShakeTimeout); hunt.treasureShakeTimeout = null; }
  // 던전을 도중에 나가거나(전투 중 이탈) 사망한 경우, 아직 재생 중이던 몬스터 사망 애니메이션의
  // 후처리(슬롯 제거)와 예약된 보상 창 표시를 모두 취소해 다음 화면에 뒤늦게 끼어들지 않도록 함.
  hunt.deathAnimTimeouts.forEach(t => clearTimeout(t));
  hunt.deathAnimTimeouts = [];
  if(hunt.rewardModalTimeout){ clearTimeout(hunt.rewardModalTimeout); hunt.rewardModalTimeout = null; }
  stopStatusTicker();
  if(flaskEndMode === 'discard') resetFlaskStateOnDeath();
  else stopFlaskHealTimers();
}

// 플레이어의 자동 공격: 현재 지정된 대상(hunt.targetId)을 우선 공격하고, 대상이 없으면(사망 등) 살아있는 첫 몬스터를 공격
function attackTick(){
  if(hunt.paused || hunt.monsters.length === 0) return;
  if(isStunned(hunt.player)) return; // 기절 중에는 기본 공격도 정지
  const equipped = getEquippedWeapon(); // 실제 공격에 사용되는 착용 무기(대장간 선택 대상과 무관)
  if(!equipped){
    showHuntMsg('장착한 무기가 없어 사냥을 중단합니다.');
    stopHuntLoop();
    return;
  }
  let target = hunt.monsters.find(m => m.instanceId === hunt.targetId);
  if(!target){
    target = hunt.monsters[0];
    hunt.targetId = target.instanceId;
    updateTargetHighlight();
  }
  const type = equipped.type || 'longsword';
  const atk = effectiveAtk(type, equipped.level, equipped.damaged);
  const critChance = effectiveCritChance(type, equipped.level);
  const isCrit = Math.random() * 100 < critChance;
  const baseDmg = isCrit ? Math.round(atk * 1.5) : atk;
  // 기본 공격 전용 피해량 증가 버프(예: 야수의 심장 +25%). effectiveAtk가 아니라 여기서만 곱하는 이유는
  // effectiveAtk를 스킬 데미지 계산(actions.js resolveSkillEffect)도 그대로 쓰기 때문 — 여기서 곱해야
  // 기본 공격에만 적용되고 스킬 데미지에는 전혀 영향을 주지 않음(야수의 심장 요구사항).
  const basicAtkBonusPercent = activeBuffBonus('basicAtkDamagePercent');
  const boostedDmg = Math.round(baseDmg * (1 + basicAtkBonusPercent / 100));
  const levelDiff = state.playerLevel - target.level;
  let dmg = Math.max(1, Math.round(boostedDmg * playerDamageMultiplier(levelDiff)));
  // 대상 몬스터의 방어도를 최종 피해 감소/증가 공식에 적용(몬스터 방어도 시스템).
  dmg = Math.max(1, Math.round(dmg * defenseDamageMultiplier(monsterDefenseFor(target))));
  // 대상의 상태 이상에 따른 조건부 피해 증가 적용(예: 팔각비도 — 중독 대상 추가 피해). 방어도 계산까지
  // 끝난 피해량을 기준으로 곱함(피해량 계산 순서 6번, formulas.js 상단 기준 참고).
  dmg = Math.max(1, Math.round(dmg * targetStatusDamageMultiplier(target)));
  target.hp -= dmg;
  monsterHitEffect(target.instanceId, dmg, isCrit);
  if(target.hp > 0){
    // 독 플라스크(아티팩트)와 무기 고유 옵션 등 "중독 부여" 효과를 가진 모든 활성 소스의 확률을
    // 합산해 1회만 판정(activeEffectChance, formulas.js). 소스가 하나도 없으면 0%로 판정 안 됨.
    const poisonChance = activeEffectChance('poison_on_hit');
    if(poisonChance > 0 && Math.random() * 100 < poisonChance){
      applyStatusEffect(target, 'poison');
      renderStatusBadges();
    }
  }
  if(target.hp <= 0){
    killMonsterInstance(target.instanceId);
  } else {
    updateMonsterSlot(target);
  }
}
// 플레이어가 몬스터를 클릭해 공격 대상을 직접 지정
function selectTarget(instanceId){
  if(hunt.paused) return;
  const instance = hunt.monsters.find(m => m.instanceId === instanceId);
  if(!instance || instanceId === hunt.targetId) return;
  hunt.targetId = instanceId;
  updateTargetHighlight();
}

// 몬스터 개체 하나의 공격: 각 개체는 자신의 공격 타이머로 독립 진행됨
function monsterAttackTick(instanceId){
  if(hunt.paused) return;
  const instance = hunt.monsters.find(m => m.instanceId === instanceId);
  if(!instance) return; // 이미 처치되어 제거된 개체면 무시
  if(isStunned(instance)) return; // 기절 중인 몬스터는 공격하지 못함
  ensurePlayerVitals();
  if(state.playerHp <= 0) return; // 이미 쓰러진 상태면 추가 피해 없음
  const levelDiff = state.playerLevel - instance.level;
  let dmg = Math.max(1, Math.round((instance.atk || 0) * monsterDamageMultiplier(levelDiff)));
  // 착용 중인 방어구(투구+갑옷)의 방어도 합산치를 최종 피해 감소 공식에 적용(방어구 시스템 추가).
  dmg = Math.max(1, Math.round(dmg * defenseDamageMultiplier(playerTotalDefense())));
  state.playerHp = Math.max(0, state.playerHp - dmg);
  playerHitEffect(dmg);
  // 백현갑 등 "피해 입을 시 확률로 중독 부여" 방어구 고유 옵션 판정 — 공격해온 몬스터 개체(instance)를
  // 대상으로 함(activeEffectChance의 무기 고유 옵션 패턴과 동일하게 합산 후 1회만 판정).
  const poisonBackChance = armorUniqueOptionChance('poison_on_taking_damage');
  if(poisonBackChance > 0 && Math.random() * 100 < poisonBackChance){
    applyStatusEffect(instance, 'poison');
    renderStatusBadges();
  }
  renderHuntCharPanel();
  if(state.playerHp <= 0){
    playerDeathEffect(); // 몬스터와 동일한 사망 애니메이션(.dead, monster-dead 키프레임) 재생
    setTimeout(() => playerDied(instance), MONSTER_DEAD_ANIM_MS); // 애니메이션이 끝난 뒤 사망 모달 표시
  } else {
    checkAutoHeal();
  }
}

// ---- 사망 처리 ----
function playerDied(killerInstance){
  stopHuntLoop('discard'); // 사망 시에는 남은 플라스크 회복량을 적용하지 않고 폐기(HP 변경 없음)
  hunt.paused = true;
  const monsterDef = killerInstance ? MONSTERS[killerInstance.monsterId] : null;
  openDeathModal(monsterDef);
}
function openDeathModal(monsterDef){
  const name = monsterDef ? monsterDef.name : '몬스터';
  el('deathModalBody').textContent = `${name}에게 사망하였습니다.`;
  el('deathModal').style.display = 'flex';
}
function closeDeathModal(){
  el('deathModal').style.display = 'none';
}
// 마을에서 부활: 체력/마나를 최대치로 회복하고 메인 화면으로 이동 (showView가 hunt 상태 정리까지 처리)
function respawnAtVillage(){
  closeDeathModal();
  state.playerHp = effectiveMaxHp(state.playerLevel);
  state.playerMp = effectiveMaxMp(state.playerLevel);
  state.deathCurseUntil = Date.now() + DEATH_CURSE_DURATION_MS; // 망자의 저주 부여
  saveState();
  showView('forge');
  startDeathCurseTicker();
  showTownToast('마을로 돌아와 지친 육신을 회복했습니다.');
}

// 상태이상(중독 등) 데미지 판정 — STATUS_TICK_RESOLUTION_MS(현재 100ms)마다 실행해 살아있는 모든 몬스터
// 개체에 대해 각자 독립적으로 처리. 예전엔 이 루프 자체가 1초 고정이라 STATUS_EFFECTS의 tickIntervalMs
// 값이 사실상 무시됐는데(항상 1초마다만 틱), 지금은 훨씬 촘촘한 주기로 돌면서 실제 틱 판정은
// tickStatusEffects(state.js)가 각 상태 이상 자신의 tickIntervalMs를 기준으로 정확히 결정함 — 이 루프
// 주기는 "그 판정을 놓치지 않을 만큼 촘촘하게 확인하는 해상도"일 뿐, 실제 틱 간격을 결정하지 않음.
const STATUS_TICK_RESOLUTION_MS = 100;
let statusTickInterval = null;
function startStatusTicker(){
  stopStatusTicker();
  statusTickInterval = setInterval(() => {
    if(hunt.paused || hunt.monsters.length === 0) return;
    // 순회 중 killMonsterInstance가 hunt.monsters를 변경할 수 있으므로 스냅샷을 떠서 순회
    const snapshot = hunt.monsters.slice();
    for(const instance of snapshot){
      pruneExpiredStatusEffects(instance); // 기절/둔화 등 지속시간형 상태 이상의 실제 만료 처리는 정확한
      // 시점에 applyStatusEffectToMonster의 setTimeout이 이미 처리하므로, 여기서는 배열 정리(뱃지 표시 동기화) 용도
      if(!instance.statusEffects || instance.statusEffects.length === 0) continue;
      const activeKeys = instance.statusEffects.map(s => s.key);
      const dmg = tickStatusEffects(instance);
      if(dmg > 0){
        instance.hp -= dmg;
        const color = STATUS_EFFECTS[activeKeys[0]] ? STATUS_EFFECTS[activeKeys[0]].color : '#7fd67f';
        statusTickEffect(instance.instanceId, dmg, color);
        if(instance.hp <= 0){
          killMonsterInstance(instance.instanceId);
          continue;
        }
        updateMonsterSlot(instance);
      }
    }
    pruneExpiredStatusEffects(hunt.player);
    renderStatusBadges();
  }, STATUS_TICK_RESOLUTION_MS);
}
function stopStatusTicker(){
  if(statusTickInterval){ clearInterval(statusTickInterval); statusTickInterval = null; }
}

// ---- 몬스터 개체 처치 ----
// 개체 하나가 죽을 때마다: 1)전투 로직상 즉시 제거(타이머 정지, 배열/타겟에서 제외, 살아있으면 자동으로 다음 대상 지정)
// 2)사망 애니메이션 재생 후 화면에서도 제거 3)이 개체의 보상을 즉시 지급하고 hunt.pendingRewards에 합산
// 4)그룹 전체가 전멸했으면(hunt.monsters가 비면) 합산된 보상으로 결과 모달을 띄움
function killMonsterInstance(instanceId){
  const idx = hunt.monsters.findIndex(m => m.instanceId === instanceId);
  if(idx === -1) return;
  const instance = hunt.monsters[idx];
  const monsterDef = MONSTERS[instance.monsterId];
  const dungeon = hunt.dungeon;
  const level = instance.level;

  if(instance.atkIntervalId){ clearInterval(instance.atkIntervalId); instance.atkIntervalId = null; }
  if(instance.atkFirstTimeout){ clearTimeout(instance.atkFirstTimeout); instance.atkFirstTimeout = null; }
  hunt.monsters.splice(idx, 1);
  if(hunt.targetId === instanceId){
    // 공격 대상이 사망하면 살아있는 다른 몬스터를 자동으로 선택
    hunt.targetId = hunt.monsters.length ? hunt.monsters[0].instanceId : null;
    updateTargetHighlight();
  }

  const icon = el('monster-icon-' + instanceId);
  if(icon){
    // 피격(hit) 애니메이션이 아직 진행 중인 상태에서 곧바로 사망(dead) 애니메이션을 걸면
    // 두 애니메이션이 겹쳐 사망 연출이 재생되지 않는 경우가 있었음 — hit을 먼저 확실히 제거하고
    // 리플로우를 강제한 뒤 dead를 추가해, 사망 애니메이션이 항상 처음부터 재생되도록 함.
    icon.classList.remove('hit');
    void icon.offsetWidth;
    icon.classList.add('dead');
  }
  const removalTimeout = setTimeout(() => {
    const slot = el('monster-slot-' + instanceId);
    if(slot) slot.remove();
    hunt.deathAnimTimeouts = hunt.deathAnimTimeouts.filter(t => t !== removalTimeout);
  }, MONSTER_DEAD_ANIM_MS);
  hunt.deathAnimTimeouts.push(removalTimeout);

  const result = resolveDrops(monsterDef, dungeon, level);
  // 이번 개체에서 실제로 지급이 확정된 아이템만 담아 연출에 넘김(연출은 이 목록을 "그리기"만 함 — 아래
  // 각 지급 블록에서 실제 지급이 확정된 시점에만 push되므로, 인벤토리가 가득 차 드랍이 무산된 경우 등은
  // 자동으로 연출 대상에서도 제외됨).
  const dropVisualItems = [];
  const curseActive = isDeathCurseActive();
  if(curseActive) result.gold = Math.round(result.gold * DEATH_CURSE_MULTIPLIER);
  state.gold += result.gold;
  hunt.pendingRewards.gold += result.gold;

  if(result.weaponDrop){
    if(grantRelicEquipDrop(result.weaponDrop)){
      hunt.pendingRewards.weaponDrops.push(result.weaponDrop);
      dropVisualItems.push({ kind: 'equip', type: result.weaponDrop.type });
    } // 해당 장비 타입의 인벤토리가 가득 차면 기존과 동일하게 드랍 자체가 무산됨(합산 목록에도 반영 안 함)
  }
  if(result.weaponIdDrops && result.weaponIdDrops.length){
    for(const drop of result.weaponIdDrops){
      // 기존엔 확정 장비 드랍이 전부 무기였어서 state.inventory에 직접 넣었지만, 이제 방어구 확정 드랍도
      // 생겨서(자호굴 강철 갑옷/투구) grantRelicEquipDrop(모험가의 유해와 동일 함수)을 재사용해
      // drop.equipType 기준으로 무기/방어구/장신구 인벤토리에 맞게 나뉘어 들어가도록 함.
      if(grantRelicEquipDrop(drop)){
        hunt.pendingRewards.weaponIdDrops.push(drop);
        dropVisualItems.push({ kind: 'equip', type: drop.type });
      } // 공용 장비 슬롯이 가득 차면 기존 무기 드랍과 동일하게 드랍 자체가 무산됨
    }
  }
  if(result.stoneDrop){
    const item = MISC_ITEMS[result.stoneDrop.itemId];
    state[item.stateKey] = (state[item.stateKey] || 0) + result.stoneDrop.qty;
    hunt.pendingRewards.stoneDrops[result.stoneDrop.itemId] = (hunt.pendingRewards.stoneDrops[result.stoneDrop.itemId] || 0) + result.stoneDrop.qty;
    dropVisualItems.push({ kind: 'item', itemId: result.stoneDrop.itemId });
  }
  if(result.flaskDrop){
    // 플라스크는 마석(state[item.stateKey])과 달리 소비 아이템 전용 보유 수량 저장소(state.consumables)를
    // 사용함 — 상점 구매/사용(actions.js) 등 기존 플라스크 지급 로직과 완전히 동일한 방식으로 지급.
    if(!state.consumables) state.consumables = { hpFlask6: 0, mpFlask6: 0 };
    state.consumables[result.flaskDrop.itemId] = (state.consumables[result.flaskDrop.itemId] || 0) + result.flaskDrop.qty;
    hunt.pendingRewards.flaskDrops[result.flaskDrop.itemId] = (hunt.pendingRewards.flaskDrops[result.flaskDrop.itemId] || 0) + result.flaskDrop.qty;
    dropVisualItems.push({ kind: 'consumable', itemId: result.flaskDrop.itemId });
  }
  if(result.artifactDropIds && result.artifactDropIds.length){
    for(const id of result.artifactDropIds){
      grantArtifactSafe(id);
      hunt.pendingRewards.artifactDrops.push(id);
      dropVisualItems.push({ kind: 'artifact', id });
    }
  }
  if(result.miscDrops && result.miscDrops.length){
    for(const drop of result.miscDrops){
      const item = MISC_ITEMS[drop.itemId];
      state[item.stateKey] = (state[item.stateKey] || 0) + drop.qty;
      if(!hunt.pendingRewards.miscDrops[drop.itemId]) hunt.pendingRewards.miscDrops[drop.itemId] = { icon: drop.icon, name: drop.name, qty: 0 };
      hunt.pendingRewards.miscDrops[drop.itemId].qty += drop.qty;
      dropVisualItems.push({ kind: 'item', itemId: drop.itemId });
    }
  }
  // 실제 지급이 전부 끝난 뒤, 그 결과를 그대로 보여주기만 하는 연출 호출(연출 성패는 위 지급 로직과 완전히 무관함).
  playMonsterDropEffect(instanceId, dropVisualItems);

  let expGained = monsterExp(level);
  if(curseActive) expGained = Math.round(expGained * DEATH_CURSE_MULTIPLIER);
  const levelsGained = gainExp(expGained);
  hunt.pendingRewards.expGained += expGained;
  hunt.pendingRewards.levelsGained += levelsGained;
  hunt.pendingRewards.newPlayerLevel = state.playerLevel;
  hunt.pendingRewards.killedMonsters.push({ name: monsterDef.name, icon: monsterDef.icon, image: monsterDef.image, color: MONSTER_GRADES[monsterDef.grade].color });

  state.totalKills = (state.totalKills || 0) + 1;
  render();
  saveState();

  if(hunt.monsters.length === 0){
    // 그룹 전멸 = 이번 전투의 종료 시점. 보상 창에 머무는 동안 회복 틱이 계속 반복되던 버그 수정:
    // 진행 중인 플라스크 회복이 있으면 남은 회복량을 즉시 전부 적용한 뒤 확실히 종료함.
    hunt.paused = true;
    stopFlaskHealTimers();
    // 보상 창은 마지막으로 죽은 몬스터의 사망 애니메이션이 완전히 끝난 뒤 0.5초 후에 표시함
    // (죽은 몬스터의 사망 애니메이션이 화면에서 잘리지 않고 다 보이도록 보장).
    hunt.rewardModalTimeout = setTimeout(() => {
      hunt.rewardModalTimeout = null;
      openKillResultModal(hunt.pendingRewards);
    }, MONSTER_DEAD_ANIM_MS + REWARD_MODAL_DELAY_MS);
  }
}

function openKillResultModal(rewards){
  const killed = rewards.killedMonsters;
  if(killed.length === 1){
    el('krIcon').innerHTML = monsterIconHtml(killed[0]);
    el('krTitle').textContent = killed[0].name + ' 처치!';
    el('krTitle').style.color = killed[0].color;
  } else {
    el('krIcon').textContent = '⚔️';
    el('krTitle').textContent = `몬스터 ${killed.length}마리 처치!`;
    el('krTitle').style.color = 'var(--forge-gold)';
  }
  el('krLevel').textContent = '';

  let rewardsHtml = `<div><span class="txt-gold">골드</span> +${rewards.gold.toLocaleString()}G</div>`;
  rewardsHtml += `<div><span class="txt-exp">경험치</span> +${rewards.expGained.toLocaleString()}</div>`;
  if(rewards.levelsGained > 0){
    rewardsHtml += `<div class="reward-levelup">🎉 레벨업! Lv.${rewards.newPlayerLevel - rewards.levelsGained} → Lv.${rewards.newPlayerLevel}</div>`;
  }
  rewards.weaponDrops.forEach(w => {
    const itemName = `${weaponName(w.type)}${levelSuffix(w.level)}`;
    rewardsHtml += `<div><span class="txt-relic">모험가의 유해</span>를 발견했습니다!<br>${itemName}</div>`;
  });
  rewards.weaponIdDrops.forEach(w => {
    const itemName = `${weaponName(w.type)}${levelSuffix(w.level)}`;
    rewardsHtml += `<div><span style="color:${weaponGradeColor(w.type)}; font-weight:700;">${itemName}</span>${josaEulReul(itemName)} 획득했습니다!</div>`;
  });
  Object.keys(rewards.stoneDrops).forEach(itemId => {
    const item = MISC_ITEMS[itemId];
    rewardsHtml += `<div><span style="color:${stoneNameColor(item.id)}; font-weight:700;">${item.name}</span> +${rewards.stoneDrops[itemId]} 획득</div>`;
  });
  Object.keys(rewards.flaskDrops).forEach(itemId => {
    const item = CONSUMABLES[itemId];
    rewardsHtml += `<div><span class="txt-shard">${itemIconHtml(item)} ${item.name}</span> +${rewards.flaskDrops[itemId]} 획득</div>`;
  });
  rewards.artifactDrops.forEach(artId => {
    const art = ARTIFACTS[artId];
    rewardsHtml += `<div><span class="reward-artifact">신비로운 ${art.name}${josaEulReul(art.name)} 획득했습니다!</span></div>`;
  });
  Object.keys(rewards.miscDrops).forEach(itemId => {
    const drop = rewards.miscDrops[itemId];
    const item = MISC_ITEMS[itemId];
    rewardsHtml += `<div><span class="txt-shard">${itemIconHtml({ icon: drop.icon, image: item && item.image })} ${drop.name}</span> +${drop.qty} 획득</div>`;
  });
  if(anyEquipInventoryFull()){
    rewardsHtml += `<div class="reward-note">장비 인벤토리가 가득 찼습니다.</div>`;
  }
  el('krRewards').innerHTML = rewardsHtml;
  el('krInvTooltip').innerHTML = buildInvPeekHtml();
  // 10스테이지 이하를 클리어한 경우에만 "탐험 계속"으로 다음 스테이지를 진행할 수 있음(11=숨겨진 장소는 별도 처리)
  el('krContinueBtn').style.display = 'inline-block';
  el('killResultModal').style.display = 'flex';
}
function closeKillResultModal(){
  el('killResultModal').style.display = 'none';
}
// "탐험 계속": 다음 스테이지로 진행 (10스테이지를 클리어했으면 자동으로 11스테이지=숨겨진 장소로 이어짐)
function advanceStage(){
  closeKillResultModal();
  enterStage(hunt.stage + 1);
}
// "마을 귀환": 체력/마나 회복 후 메인 화면(대장간)으로 이동 (스테이지 클리어 후 행동 선택 / 숨겨진 장소 보상 이후 공통)
function returnToVillage(){
  closeKillResultModal();
  state.playerHp = effectiveMaxHp(state.playerLevel);
  state.playerMp = effectiveMaxMp(state.playerLevel);
  saveState();
  showView('forge');
  showTownToast(STAGE_RETURN_MSG);
}

// ---- 11스테이지: 숨겨진 장소(보물 상자) ----
function openTreasureStage(){
  hunt.monsters = [];
  hunt.targetId = null;
  hunt.chestOpened = false;
  hunt.paused = true;
  hunt.started = false;
  renderHunt();
}
// 보물 상자 클릭: 1초 흔들림 애니메이션 후 파괴되며 보상 지급(골드 확정 지급 + 모험가의 유해/마석은 기존 전역 드랍 공식 그대로 적용되어 드랍되지 않을 수도 있음)
function clickTreasureChest(){
  if(hunt.chestOpened || hunt.stage !== DUNGEON_TREASURE_STAGE) return;
  hunt.chestOpened = true;
  const chest = el('treasureChest');
  const hint = el('treasureHint');
  if(hint) hint.style.display = 'none'; // 안내 문구는 즉시 숨김(재클릭 방지 신호). 상자 자체는 흔들림 애니메이션 동안 계속 보여줌
  if(chest) chest.classList.add('shake');
  hunt.treasureShakeTimeout = setTimeout(() => {
    if(chest) chest.classList.remove('shake');
    const result = grantTreasureRewards();
    openTreasureResultModal(result);
  }, TREASURE_SHAKE_MS);
}
// 모험가의 유해로 지급받은 장비를 장비 타입(무기/방어구/장신구)에 맞는 인벤토리에 추가.
// 대상 인벤토리는 EQUIP_INVENTORY_POOLS(data.js)의 items()를 그대로 재사용하므로, 새 장비 타입이
// 추가돼도 이 함수 수정 없이 자동으로 대응됨. 세 인벤토리가 INV_MAX(50)를 공용으로 나눠 쓰므로,
// 용량 판단은 대상 배열 자신의 길이가 아니라 totalEquipInventoryCount()(formulas.js)로 함 — 가득
// 차 있으면 지급하지 않고 false 반환(기존처럼 드랍 자체가 무산됨).
function grantRelicEquipDrop(drop){
  const pool = EQUIP_INVENTORY_POOLS.find(p => p.kind === (drop.equipType || 'weapon'));
  const arr = pool ? pool.items() : state.inventory;
  if(equipInventoryFull()) return false;
  arr.push({ id: state.nextItemId++, level: drop.level, type: drop.type });
  return true;
}
// 장비(무기/방어구/장신구) 공용 인벤토리 슬롯이 가득 찼는지 — 결과 화면의 "인벤토리가 가득 찼습니다"
// 안내에 사용함. equipInventoryFull()(formulas.js)을 그대로 재사용.
function anyEquipInventoryFull(){
  return equipInventoryFull();
}

// 던전의 최소 레벨(가장 낮은 등장 몬스터 레벨) 기준으로 보상을 산정해 지급.
// 골드는 확정 지급(×5, ±25%)이고, 모험가의 유해/마석은 각각의 전역 드랍 확률을 그대로 적용하므로 드랍되지 않을 수도 있음.
function grantTreasureRewards(){
  const minLevel = dungeonLevelRange(hunt.dungeon).min;
  const gold = rollTreasureGold(minLevel);
  state.gold += gold;

  let weaponDrop = resolveWeaponRelicDrop(minLevel);
  if(weaponDrop && !grantRelicEquipDrop(weaponDrop)){
    weaponDrop = null; // 해당 장비 타입의 인벤토리가 가득 차 드랍 무산
  }
  const stoneDrop = rollStoneDrop(minLevel, 'normal');
  if(stoneDrop){
    const item = MISC_ITEMS[stoneDrop.itemId];
    state[item.stateKey] = (state[item.stateKey] || 0) + stoneDrop.qty;
  }
  // 숨겨진 장소 전용 기타 아이템 추첨 — 위 골드/모험가의 유해/마석과 완전히 독립적인 별도 판정
  // (rollTreasureMiscDrop 자체가 기존 전역 드랍 공식과 무관한 로직이라 서로 영향을 주지 않음).
  const miscDrop = rollTreasureMiscDrop(minLevel);
  if(miscDrop){
    const item = MISC_ITEMS[miscDrop.itemId];
    state[item.stateKey] = (state[item.stateKey] || 0) + miscDrop.qty;
  }

  render();
  saveState();
  return { gold, weaponDrop, stoneDrop, miscDrop };
}
function openTreasureResultModal(result){
  el('krIcon').textContent = '🎁';
  el('krTitle').textContent = '숨겨진 보물을 발견했습니다!';
  el('krTitle').style.color = 'var(--forge-gold)';
  el('krLevel').textContent = '';

  let rewardsHtml = `<div><span class="txt-gold">골드</span> +${result.gold.toLocaleString()}G</div>`;
  if(result.weaponDrop){
    const itemName = `${weaponName(result.weaponDrop.type)}${levelSuffix(result.weaponDrop.level)}`;
    rewardsHtml += `<div><span class="txt-relic">모험가의 유해</span>를 발견했습니다!<br>${itemName}</div>`;
  }
  if(result.stoneDrop){
    const item = MISC_ITEMS[result.stoneDrop.itemId];
    rewardsHtml += `<div><span style="color:${stoneNameColor(item.id)}; font-weight:700;">${item.name}</span> +${result.stoneDrop.qty} 획득</div>`;
  }
  if(result.miscDrop){
    const item = MISC_ITEMS[result.miscDrop.itemId];
    rewardsHtml += `<div><span style="color:${stoneNameColor(item.id)}; font-weight:700;">${item.name}</span> +${result.miscDrop.qty} 획득</div>`;
  }
  if(anyEquipInventoryFull() && !result.weaponDrop){
    rewardsHtml += `<div class="reward-note">장비 인벤토리가 가득 찼습니다.</div>`;
  }
  el('krRewards').innerHTML = rewardsHtml;
  el('krInvTooltip').innerHTML = buildInvPeekHtml();
  el('krContinueBtn').style.display = 'none'; // 11스테이지 다음은 없으므로 "탐험 계속" 버튼은 숨김
  el('killResultModal').style.display = 'flex';
}
