// ============================================================
// dungeon.js — 던전 전투 흐름 (11스테이지 시스템 + 복수 몬스터 동시 등장)
// 던전 입장 → 스테이지 입장 메시지 → 몬스터 생성(최대 3마리, 개별 개체) → 조우 메시지 → 전투(자동 시작)
// → 전멸 시 처치한 모든 몬스터의 보상을 합산해 표시 → 행동 선택(마을 귀환/탐험 계속)
// → 다음 스테이지 ... → 11스테이지(숨겨진 장소, 보물 상자)
// ============================================================

function enterDungeon(id){
  const d = DUNGEONS.find(x => x.id === id);
  if(!d || !getEquipped()) return;
  hunt.dungeon = d;
  hunt.monsters = [];
  hunt.targetId = null;
  hunt.paused = true;
  hunt.started = false;
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
  hunt.targetId = hunt.monsters.length ? hunt.monsters[0].instanceId : null;
  // 이번 전투(그룹 전멸까지)에서 처치한 모든 몬스터의 보상을 합산해 담아둘 그릇
  hunt.pendingRewards = {
    gold: 0, expGained: 0, levelsGained: 0, newPlayerLevel: state.playerLevel,
    weaponDrops: [], weaponIdDrops: [], stoneDrops: {}, artifactDrops: [], miscDrops: {}, killedMonsters: [],
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
  // 최종 공격력에만 0.5배를 곱해서 DPS를 맞춤(monsterAtkFor 공식 자체는 변경하지 않음).
  const atk = Math.round(monsterAtkFor(monsterDef, level) * 0.5);
  return {
    instanceId: hunt.nextInstanceId++,
    monsterId: monsterDef.id, level, hp: maxHp, maxHp, atk, statusEffects: [],
    atkIntervalId: null, atkFirstTimeout: null,
  };
}
// 주어진 등급에 해당하는 이 던전의 몬스터 종류 중 하나를 균등 추첨.
// 해당 등급 몬스터가 이 던전에 하나도 없으면(예: 다람쥐굴처럼 에픽 몬스터가 없는 던전) 등급 제한 없이 폴백.
function pickSpawnMonsterOfGrade(dungeon, grade){
  let candidates = dungeon.monsters.filter(id => MONSTERS[id].grade === grade);
  if(candidates.length === 0) candidates = dungeon.monsters;
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
  const equipped = getEquipped();
  const speed = equipped ? effectiveAtkSpeed(equipped.type || 'longsword', equipped.level) : 0.5;
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
  const monsterSpeed = MONSTER_ATTACK_SPEED * speedMult;
  const intervalMs = Math.round(1000 / monsterSpeed);
  instance.atkFirstTimeout = setTimeout(() => {
    monsterAttackTick(instance.instanceId);
    instance.atkIntervalId = setInterval(() => monsterAttackTick(instance.instanceId), intervalMs);
  }, 1000);
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
  const equipped = getEquipped();
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
  const atk = effectiveAtk(type, equipped.level);
  const critChance = critChanceFor(type, equipped.level);
  const isCrit = Math.random() * 100 < critChance;
  const baseDmg = isCrit ? Math.round(atk * 1.5) : atk;
  const levelDiff = state.playerLevel - target.level;
  const dmg = Math.max(1, Math.round(baseDmg * playerDamageMultiplier(levelDiff)));
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
  ensurePlayerVitals();
  if(state.playerHp <= 0) return; // 이미 쓰러진 상태면 추가 피해 없음
  const levelDiff = state.playerLevel - instance.level;
  const dmg = Math.max(1, Math.round((instance.atk || 0) * monsterDamageMultiplier(levelDiff)));
  state.playerHp = Math.max(0, state.playerHp - dmg);
  playerHitEffect(dmg);
  renderHuntCharPanel();
  if(state.playerHp <= 0){
    playerDied(instance);
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

// 상태이상(중독 등) 데미지 판정 — 1초마다 실행, 살아있는 모든 몬스터 개체에 대해 각자 독립적으로 처리
let statusTickInterval = null;
function startStatusTicker(){
  stopStatusTicker();
  statusTickInterval = setInterval(() => {
    if(hunt.paused || hunt.monsters.length === 0) return;
    // 순회 중 killMonsterInstance가 hunt.monsters를 변경할 수 있으므로 스냅샷을 떠서 순회
    const snapshot = hunt.monsters.slice();
    for(const instance of snapshot){
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
    renderStatusBadges();
  }, 1000);
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
  const curseActive = isDeathCurseActive();
  if(curseActive) result.gold = Math.round(result.gold * DEATH_CURSE_MULTIPLIER);
  state.gold += result.gold;
  hunt.pendingRewards.gold += result.gold;

  if(result.weaponDrop){
    if(state.inventory.length < INV_MAX){
      state.inventory.push({ id: state.nextItemId++, level: result.weaponDrop.level, type: result.weaponDrop.type });
      hunt.pendingRewards.weaponDrops.push(result.weaponDrop);
    } // 인벤토리가 가득 차면 기존과 동일하게 드랍 자체가 무산됨(합산 목록에도 반영 안 함)
  }
  if(result.weaponIdDrops && result.weaponIdDrops.length){
    for(const drop of result.weaponIdDrops){
      if(state.inventory.length < INV_MAX){
        state.inventory.push({ id: state.nextItemId++, level: drop.level, type: drop.type });
        hunt.pendingRewards.weaponIdDrops.push(drop);
      } // 인벤토리가 가득 차면 기존 무기 드랍과 동일하게 드랍 자체가 무산됨
    }
  }
  if(result.stoneDrop){
    const item = MISC_ITEMS[result.stoneDrop.itemId];
    state[item.stateKey] = (state[item.stateKey] || 0) + result.stoneDrop.qty;
    hunt.pendingRewards.stoneDrops[result.stoneDrop.itemId] = (hunt.pendingRewards.stoneDrops[result.stoneDrop.itemId] || 0) + result.stoneDrop.qty;
  }
  if(result.artifactDropId){
    grantArtifactSafe(result.artifactDropId);
    hunt.pendingRewards.artifactDrops.push(result.artifactDropId);
  }
  if(result.miscDrops && result.miscDrops.length){
    for(const drop of result.miscDrops){
      const item = MISC_ITEMS[drop.itemId];
      state[item.stateKey] = (state[item.stateKey] || 0) + drop.qty;
      if(!hunt.pendingRewards.miscDrops[drop.itemId]) hunt.pendingRewards.miscDrops[drop.itemId] = { icon: drop.icon, name: drop.name, qty: 0 };
      hunt.pendingRewards.miscDrops[drop.itemId].qty += drop.qty;
    }
  }

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
    const itemName = `${weaponName(w.type)} +${w.level}`;
    rewardsHtml += `<div><span class="txt-relic">모험가의 유해</span>를 발견했습니다!<br>${itemName}</div>`;
  });
  rewards.weaponIdDrops.forEach(w => {
    const itemName = `${weaponName(w.type)} +${w.level}`;
    rewardsHtml += `<div><span style="color:${weaponGradeColor(w.type)}; font-weight:700;">${itemName}</span>${josaEulReul(itemName)} 획득했습니다!</div>`;
  });
  Object.keys(rewards.stoneDrops).forEach(itemId => {
    const item = MISC_ITEMS[itemId];
    rewardsHtml += `<div><span style="color:${stoneNameColor(item.id)}; font-weight:700;">${item.name}</span> +${rewards.stoneDrops[itemId]} 획득</div>`;
  });
  rewards.artifactDrops.forEach(artId => {
    const art = ARTIFACTS[artId];
    rewardsHtml += `<div><span class="reward-artifact">신비로운 ${art.name}${josaEulReul(art.name)} 획득했습니다!</span></div>`;
  });
  Object.keys(rewards.miscDrops).forEach(itemId => {
    const drop = rewards.miscDrops[itemId];
    rewardsHtml += `<div><span class="txt-shard">${drop.icon} ${drop.name}</span> +${drop.qty} 획득</div>`;
  });
  if(state.inventory.length >= INV_MAX){
    rewardsHtml += `<div class="reward-note">무기 인벤토리가 가득 찼습니다.</div>`;
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
// 던전의 최소 레벨(가장 낮은 등장 몬스터 레벨) 기준으로 보상을 산정해 지급.
// 골드는 확정 지급(×5, ±25%)이고, 모험가의 유해/마석은 각각의 전역 드랍 확률을 그대로 적용하므로 드랍되지 않을 수도 있음.
function grantTreasureRewards(){
  const minLevel = dungeonLevelRange(hunt.dungeon).min;
  const gold = rollTreasureGold(minLevel);
  state.gold += gold;

  let weaponDrop = resolveWeaponRelicDrop(minLevel);
  if(weaponDrop){
    if(state.inventory.length < INV_MAX){
      state.inventory.push({ id: state.nextItemId++, level: weaponDrop.level, type: weaponDrop.type });
    } else {
      weaponDrop = null; // 인벤토리가 가득 차 드랍 무산
    }
  }
  const stoneDrop = rollStoneDrop(minLevel, 'normal');
  if(stoneDrop){
    const item = MISC_ITEMS[stoneDrop.itemId];
    state[item.stateKey] = (state[item.stateKey] || 0) + stoneDrop.qty;
  }

  render();
  saveState();
  return { gold, weaponDrop, stoneDrop };
}
function openTreasureResultModal(result){
  el('krIcon').textContent = '🎁';
  el('krTitle').textContent = '숨겨진 보물을 발견했습니다!';
  el('krTitle').style.color = 'var(--forge-gold)';
  el('krLevel').textContent = '';

  let rewardsHtml = `<div><span class="txt-gold">골드</span> +${result.gold.toLocaleString()}G</div>`;
  if(result.weaponDrop){
    const itemName = `${weaponName(result.weaponDrop.type)} +${result.weaponDrop.level}`;
    rewardsHtml += `<div><span class="txt-relic">모험가의 유해</span>를 발견했습니다!<br>${itemName}</div>`;
  }
  if(result.stoneDrop){
    const item = MISC_ITEMS[result.stoneDrop.itemId];
    rewardsHtml += `<div><span style="color:${stoneNameColor(item.id)}; font-weight:700;">${item.name}</span> +${result.stoneDrop.qty} 획득</div>`;
  }
  if(state.inventory.length >= INV_MAX && !result.weaponDrop){
    rewardsHtml += `<div class="reward-note">무기 인벤토리가 가득 찼습니다.</div>`;
  }
  el('krRewards').innerHTML = rewardsHtml;
  el('krInvTooltip').innerHTML = buildInvPeekHtml();
  el('krContinueBtn').style.display = 'none'; // 11스테이지 다음은 없으므로 "탐험 계속" 버튼은 숨김
  el('killResultModal').style.display = 'flex';
}
