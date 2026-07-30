// ============================================================
// dungeon.js — 던전 전투 흐름
// 던전 입장, 몬스터 스폰, 공격 루프(플레이어/몬스터/상태이상),
// 처치 처리, 킬 결과 모달까지 전투와 관련된 모든 로직.
// ============================================================

function enterDungeon(id){
  const d = DUNGEONS.find(x => x.id === id);
  if(!d || !getEquipped()) return;
  hunt.dungeon = d;
  hunt.paused = true;
  hunt.started = false;
  spawnMonster();
  showView('hunt');
}

// 탐험 시작 버튼: 이때부터 실제 전투(공격 루프)가 시작됨
function startExploration(){
  if(!hunt.dungeon || !hunt.monster || hunt.started) return;
  hunt.started = true;
  hunt.paused = false;
  startHuntLoop();
  renderHunt();
}

function spawnMonster(){
  const d = hunt.dungeon;
  if(!d) return;
  const monsterId = pickSpawnMonster(d);
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
  const icon = el('monsterIcon');
  if(icon) icon.classList.remove('dead');
  renderHunt();
  renderStatusBadges();
  showSpawnToast(monsterDef, level);
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
  el('killResultModal').style.display = 'flex';
}
function closeKillResultModal(){
  el('killResultModal').style.display = 'none';
}
function killResultContinue(){
  closeKillResultModal();
  hunt.paused = false;
  spawnMonster();
  startHuntLoop(); // 전투 시작마다 플레이어/몬스터 첫공격 타이밍을 초기화
}
function killResultStop(){
  closeKillResultModal();
  exitHunt();
}

function exitHunt(){
  stopHuntLoop();
  hunt.dungeon = null;
  hunt.monster = null;
  hunt.paused = false;
  hunt.started = false;
  closeKillResultModal();
  showView('dungeonlist');
}
