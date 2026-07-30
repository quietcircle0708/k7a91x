// ============================================================
// dungeon.js — 던전 전투 흐름 (11스테이지 시스템)
// 던전 입장 → 스테이지 입장 메시지 → 몬스터 생성 → 조우 메시지 → 전투(자동 시작)
// → 처치 → 행동 선택(마을 귀환/탐험 계속) → 다음 스테이지 ... → 11스테이지(숨겨진 장소, 보물 상자)
// ============================================================

function enterDungeon(id){
  const d = DUNGEONS.find(x => x.id === id);
  if(!d || !getEquipped()) return;
  hunt.dungeon = d;
  hunt.monster = null;
  hunt.paused = true;
  hunt.started = false;
  showView('hunt');
  enterStage(1);
}

// 스테이지 진입: 입장 메시지를 DUNGEON_MSG_DURATION_MS(1초)만큼 보여준 뒤,
// 전투 스테이지(1~10)면 몬스터를 생성하고, 11스테이지(숨겨진 장소)면 보물 상자를 연다.
function enterStage(stageNum){
  hunt.stage = stageNum;
  hunt.monster = null;
  hunt.chestOpened = false;
  hunt.paused = true;
  hunt.started = false;
  renderHunt();
  const icon = el('monsterIcon');
  if(icon){
    icon.classList.remove('dead', 'spawn-in');
    icon.classList.add('spawn-hidden'); // 입장 메시지가 끝나기 전에는 몬스터가 보이지 않도록 숨김
  }
  showDungeonMsg(stageEnterMessage(stageNum, hunt.dungeon.name));
  hunt.stageEnterTimeout = setTimeout(() => {
    if(stageNum === DUNGEON_TREASURE_STAGE){
      openTreasureStage();
    } else {
      spawnMonster();
    }
  }, DUNGEON_MSG_DURATION_MS);
}

function spawnMonster(){
  const d = hunt.dungeon;
  if(!d) return;
  const monsterId = pickSpawnMonsterForStage(d, hunt.stage);
  const monsterDef = MONSTERS[monsterId];
  // 일반 등급: 몬스터 레벨 ~ (몬스터 레벨 + 던전 레벨범위) 구간에서 균등 추첨 / 그 외 등급: 고정 레벨
  const level = monsterDef.grade === 'normal'
    ? pickSpawnLevel(monsterDef.level, monsterDef.level + (d.levelRange || 0))
    : monsterDef.level;
  const maxHp = monsterHPFor(monsterDef, level);
  // 몬스터 공격속도가 0.5→1.0(2초→1초당 1회)로 빨라진 밸런스 보정으로, 공격 빈도가 2배가 된 만큼
  // 최종 공격력에만 0.5배를 곱해서 DPS를 맞춤(monsterAtkFor 공식 자체는 변경하지 않음).
  const atk = Math.round(monsterAtkFor(monsterDef, level) * 0.5);
  hunt.monster = { monsterId: monsterDef.id, level, hp: maxHp, maxHp, atk, statusEffects: [] };
  renderHunt();
  renderStatusBadges();
  const icon = el('monsterIcon');
  if(icon){
    icon.classList.remove('dead');
    icon.classList.remove('spawn-hidden');
    icon.classList.remove('spawn-in');
    void icon.offsetWidth; // 리플로우를 강제해 애니메이션이 매번 처음부터 재생되도록 함
    icon.classList.add('spawn-in'); // 0.5초 동안 페이드 인
  }
  const combatPanel = el('huntCombatPanel');
  if(combatPanel){
    combatPanel.classList.remove('spawn-in');
    void combatPanel.offsetWidth;
    combatPanel.classList.add('spawn-in'); // 몬스터 이미지와 동시에 0.5초 페이드 인
  }
  showEncounterToast(monsterDef);
  // 조우 메시지 노출이 끝나면 전투를 자동으로 시작함(수동 "탐험 시작" 버튼 없음)
  hunt.encounterTimeout = setTimeout(() => {
    beginStageCombat();
  }, DUNGEON_MSG_DURATION_MS);
}

// 조우 메시지 노출이 끝난 뒤 실제 전투(공격 루프)를 시작함
function beginStageCombat(){
  if(!hunt.dungeon || !hunt.monster || hunt.started) return;
  hunt.started = true;
  hunt.paused = false;
  startHuntLoop();
  renderHunt();
}

// ---- 전투 루프 ----
function startHuntLoop(){
  stopHuntLoop();
  const equipped = getEquipped();
  const speed = equipped ? effectiveAtkSpeed(equipped.type || 'longsword', equipped.level) : 0.5;
  const intervalMs = Math.round(1000 / speed);
  // 몬스터 공격속도 = 기본 몬스터 공격속도(MONSTER_ATTACK_SPEED) × 이 몬스터의 speedMult 계수
  const monsterDef = hunt.monster ? MONSTERS[hunt.monster.monsterId] : null;
  const monsterSpeedMult = (monsterDef && monsterDef.speedMult != null) ? monsterDef.speedMult : 1;
  const monsterSpeed = MONSTER_ATTACK_SPEED * monsterSpeedMult;
  const monsterIntervalMs = Math.round(1000 / monsterSpeed);

  // 플레이어 첫 공격: 전투 시작 0.5초 후, 이후 무기 공격속도 주기로 반복
  hunt.playerFirstAttackTimeout = setTimeout(() => {
    attackTick();
    hunt.timerId = setInterval(attackTick, intervalMs);
  }, 500);

  // 몬스터 첫 공격: 전투 시작 1초 후, 이후 이 몬스터의 공격속도 주기로 반복
  hunt.monsterFirstAttackTimeout = setTimeout(() => {
    monsterAttackTick();
    hunt.monsterTimerId = setInterval(monsterAttackTick, monsterIntervalMs);
  }, 1000);

  startStatusTicker();
}
// flaskEndMode: 'flush'(기본, 생존 상태로 전투 종료 — 남은 회복량 즉시 적용 후 종료) |
//               'discard'(사망으로 전투 종료 — 남은 회복량 적용 없이 폐기, HP 변경 없음)
function stopHuntLoop(flaskEndMode = 'flush'){
  if(hunt.timerId){ clearInterval(hunt.timerId); hunt.timerId = null; }
  if(hunt.playerFirstAttackTimeout){ clearTimeout(hunt.playerFirstAttackTimeout); hunt.playerFirstAttackTimeout = null; }
  if(hunt.monsterTimerId){ clearInterval(hunt.monsterTimerId); hunt.monsterTimerId = null; }
  if(hunt.monsterFirstAttackTimeout){ clearTimeout(hunt.monsterFirstAttackTimeout); hunt.monsterFirstAttackTimeout = null; }
  if(hunt.stageEnterTimeout){ clearTimeout(hunt.stageEnterTimeout); hunt.stageEnterTimeout = null; }
  if(hunt.encounterTimeout){ clearTimeout(hunt.encounterTimeout); hunt.encounterTimeout = null; }
  if(hunt.treasureShakeTimeout){ clearTimeout(hunt.treasureShakeTimeout); hunt.treasureShakeTimeout = null; }
  stopStatusTicker();
  if(flaskEndMode === 'discard') resetFlaskStateOnDeath();
  else stopFlaskHealTimers();
}

function attackTick(){
  if(hunt.paused || !hunt.monster) return;
  const equipped = getEquipped();
  if(!equipped){
    showHuntMsg('장착한 무기가 없어 사냥을 중단합니다.');
    stopHuntLoop();
    return;
  }
  const type = equipped.type || 'longsword';
  const atk = effectiveAtk(type, equipped.level);
  const critChance = critChanceFor(type, equipped.level);
  const isCrit = Math.random() * 100 < critChance;
  const baseDmg = isCrit ? Math.round(atk * 1.5) : atk;
  const levelDiff = state.playerLevel - hunt.monster.level;
  const dmg = Math.max(1, Math.round(baseDmg * playerDamageMultiplier(levelDiff)));
  hunt.monster.hp -= dmg;
  monsterHitEffect(dmg, isCrit);
  if(hunt.monster.hp <= 0){
    killMonster();
  } else {
    renderHunt();
  }
}

function monsterAttackTick(){
  if(hunt.paused || !hunt.monster) return;
  ensurePlayerVitals();
  if(state.playerHp <= 0) return; // 이미 쓰러진 상태면 추가 피해 없음
  const levelDiff = state.playerLevel - hunt.monster.level;
  const dmg = Math.max(1, Math.round((hunt.monster.atk || 0) * monsterDamageMultiplier(levelDiff)));
  state.playerHp = Math.max(0, state.playerHp - dmg);
  playerHitEffect(dmg);
  renderHuntCharPanel();
  if(state.playerHp <= 0){
    playerDied();
  } else {
    checkAutoHeal();
  }
}

// ---- 사망 처리 ----
function playerDied(){
  stopHuntLoop('discard'); // 사망 시에는 남은 플라스크 회복량을 적용하지 않고 폐기(HP 변경 없음)
  hunt.paused = true;
  const monsterDef = hunt.monster ? MONSTERS[hunt.monster.monsterId] : null;
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

// 상태이상(중독 등) 데미지 판정 — 1초마다 실행, 필요 시 몬스터 처치까지 이어짐
let statusTickInterval = null;
function startStatusTicker(){
  stopStatusTicker();
  statusTickInterval = setInterval(() => {
    if(hunt.paused || !hunt.monster) return;
    if(!hunt.monster.statusEffects || hunt.monster.statusEffects.length === 0) return;
    const activeKeys = hunt.monster.statusEffects.map(s => s.key);
    const dmg = tickStatusEffects(hunt.monster);
    if(dmg > 0){
      hunt.monster.hp -= dmg;
      const color = STATUS_EFFECTS[activeKeys[0]] ? STATUS_EFFECTS[activeKeys[0]].color : '#7fd67f';
      statusTickEffect(dmg, color);
      if(hunt.monster.hp <= 0){
        killMonster();
        return;
      }
      renderHunt();
    }
    renderStatusBadges();
  }, 1000);
}
function stopStatusTicker(){
  if(statusTickInterval){ clearInterval(statusTickInterval); statusTickInterval = null; }
}

// ---- 몬스터 처치 & 결과 모달 ----
function killMonster(){
  const monsterDef = MONSTERS[hunt.monster.monsterId];
  const dungeon = hunt.dungeon;
  const level = hunt.monster.level;
  const icon = el('monsterIcon');
  icon.classList.add('dead');
  hunt.paused = true;
  // 몬스터 처치 = 이번 전투의 종료 시점. 보상 창에 머무는 동안 회복 틱이 계속 반복되던 버그 수정:
  // 진행 중인 플라스크 회복이 있으면 남은 회복량을 즉시 전부 적용한 뒤 확실히 종료함.
  stopFlaskHealTimers();

  const result = resolveDrops(monsterDef, dungeon, level);
  const curseActive = isDeathCurseActive();
  if(curseActive) result.gold = Math.round(result.gold * DEATH_CURSE_MULTIPLIER);
  state.gold += result.gold;

  if(result.weaponDrop){
    if(state.inventory.length < INV_MAX){
      state.inventory.push({ id: state.nextItemId++, level: result.weaponDrop.level, type: result.weaponDrop.type });
    } else {
      result.weaponDrop = null; // 인벤토리가 가득 차 드랍 무산
    }
  }
  if(result.stoneDrop){
    const item = MISC_ITEMS[result.stoneDrop.itemId];
    state[item.stateKey] = (state[item.stateKey] || 0) + result.stoneDrop.qty;
  }
  if(result.artifactDropId){
    grantArtifactSafe(result.artifactDropId);
  }
  if(result.miscDrops && result.miscDrops.length){
    for(const drop of result.miscDrops){
      const item = MISC_ITEMS[drop.itemId];
      state[item.stateKey] = (state[item.stateKey] || 0) + drop.qty;
    }
  }

  let expGained = monsterExp(level);
  if(curseActive) expGained = Math.round(expGained * DEATH_CURSE_MULTIPLIER);
  const levelsGained = gainExp(expGained);
  result.expGained = expGained;
  result.levelsGained = levelsGained;
  result.newPlayerLevel = state.playerLevel;

  state.totalKills = (state.totalKills || 0) + 1;
  render();
  saveState();

  setTimeout(() => openKillResultModal(monsterDef, level, result), 400);
}

function openKillResultModal(monsterDef, level, result){
  const grade = MONSTER_GRADES[monsterDef.grade];
  el('krIcon').textContent = monsterDef.icon;
  el('krTitle').textContent = monsterDef.name + ' 처치!';
  el('krTitle').style.color = grade.color;
  el('krLevel').textContent = 'Lv.' + level;

  let rewardsHtml = `<div><span class="txt-gold">골드</span> +${result.gold.toLocaleString()}G</div>`;
  rewardsHtml += `<div><span class="txt-exp">경험치</span> +${result.expGained.toLocaleString()}</div>`;
  if(result.levelsGained > 0){
    rewardsHtml += `<div class="reward-levelup">🎉 레벨업! Lv.${result.newPlayerLevel - result.levelsGained} → Lv.${result.newPlayerLevel}</div>`;
  }
  if(result.weaponDrop){
    const itemName = `${weaponName(result.weaponDrop.type)} +${result.weaponDrop.level}`;
    rewardsHtml += `<div>${monsterDef.name}에게서 <span class="txt-relic">모험가의 유해</span>를 발견했습니다!<br>${itemName}</div>`;
  }
  if(result.stoneDrop){
    const item = MISC_ITEMS[result.stoneDrop.itemId];
    rewardsHtml += `<div><span style="color:${stoneNameColor(item.id)}; font-weight:700;">${item.name}</span> +${result.stoneDrop.qty} 획득</div>`;
  }
  if(result.artifactDropId){
    const art = ARTIFACTS[result.artifactDropId];
    rewardsHtml += `<div><span class="reward-artifact">${monsterDef.name}${josaEulReul(monsterDef.name)} 처치하고 신비로운 ${art.name}${josaEulReul(art.name)} 획득했습니다!</span></div>`;
  }
  if(result.miscDrops && result.miscDrops.length){
    for(const drop of result.miscDrops){
      rewardsHtml += `<div><span class="txt-shard">${drop.icon} ${drop.name}</span> +${drop.qty} 획득</div>`;
    }
  }
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

// ---- 던전 등장 몬스터 선택(스테이지 기준) ----
// 스테이지 번호로 등급(일반/에픽)을 먼저 정하고, 그 등급에 해당하는 이 던전의 몬스터 중 하나를 균등 추첨.
// 해당 등급 몬스터가 이 던전에 하나도 없으면(예: 다람쥐굴처럼 에픽 몬스터가 없는 던전에서 에픽 스테이지가 걸린 경우)
// 등급 제한 없이 이 던전의 몬스터 전체 중에서 균등 추첨하는 것으로 폴백함.
function pickSpawnMonsterForStage(dungeon, stageNum){
  const grade = pickStageGrade(stageNum);
  let candidates = dungeon.monsters.filter(id => MONSTERS[id].grade === grade);
  if(candidates.length === 0) candidates = dungeon.monsters;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ---- 11스테이지: 숨겨진 장소(보물 상자) ----
function openTreasureStage(){
  hunt.monster = null;
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
