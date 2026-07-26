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
  const pick = pickSpawnMonster(d);
  const monsterDef = MONSTERS[pick.id];
  const level = pickSpawnLevel(pick.levelMin, pick.levelMax);
  const maxHp = monsterHPFor(monsterDef, level);
  const atk = monsterAtkFor(monsterDef, level);
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
  const monsterIntervalMs = Math.round(1000 / MONSTER_ATTACK_SPEED);

  // 플레이어 첫 공격: 전투 시작 0.5초 후, 이후 무기 공격속도 주기로 반복
  hunt.playerFirstAttackTimeout = setTimeout(() => {
    attackTick();
    hunt.timerId = setInterval(attackTick, intervalMs);
  }, 500);

  // 몬스터 첫 공격: 전투 시작 1초 후, 이후 몬스터 공격속도(2초) 주기로 반복
  hunt.monsterFirstAttackTimeout = setTimeout(() => {
    monsterAttackTick();
    hunt.monsterTimerId = setInterval(monsterAttackTick, monsterIntervalMs);
  }, 1000);

  startStatusTicker();
}
function stopHuntLoop(){
  if(hunt.timerId){ clearInterval(hunt.timerId); hunt.timerId = null; }
  if(hunt.playerFirstAttackTimeout){ clearTimeout(hunt.playerFirstAttackTimeout); hunt.playerFirstAttackTimeout = null; }
  if(hunt.monsterTimerId){ clearInterval(hunt.monsterTimerId); hunt.monsterTimerId = null; }
  if(hunt.monsterFirstAttackTimeout){ clearTimeout(hunt.monsterFirstAttackTimeout); hunt.monsterFirstAttackTimeout = null; }
  stopStatusTicker();
  stopFlaskHealTimers();
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
  stopHuntLoop();
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

  const result = resolveDrops(monsterDef, dungeon, level);
  const curseActive = isDeathCurseActive();
  if(curseActive) result.gold = Math.round(result.gold * DEATH_CURSE_MULTIPLIER);
  state.gold += result.gold;

  if(result.weaponDropLevel !== null){
    if(state.inventory.length < INV_MAX){
      state.inventory.push({ id: state.nextItemId++, level: result.weaponDropLevel, type: 'longsword' });
    } else {
      result.weaponDropLevel = null; // 인벤토리가 가득 차 드랍 무산
    }
  }
  if(result.manaFragmentQty > 0){
    state.manaFragments = (state.manaFragments || 0) + result.manaFragmentQty;
  }
  if(result.manaShardQty > 0){
    state.manaShards = (state.manaShards || 0) + result.manaShardQty;
  }
  if(result.artifactDropId){
    grantArtifactSafe(result.artifactDropId);
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
  if(result.weaponDropLevel !== null){
    const itemName = `${weaponName('longsword')} +${result.weaponDropLevel}`;
    rewardsHtml += `<div>${monsterDef.name}에게서 <span class="txt-relic">모험가의 유해</span>를 발견했습니다!<br>${itemName}</div>`;
  }
  if(result.manaFragmentQty > 0){
    rewardsHtml += `<div><span class="txt-shard">${MISC_ITEMS.manaFragment.name}</span> +${result.manaFragmentQty} 획득</div>`;
  }
  if(result.manaShardQty > 0){
    rewardsHtml += `<div><span class="txt-shard">${MISC_ITEMS.manaShard.name}</span> +${result.manaShardQty} 획득</div>`;
  }
  if(result.artifactDropId){
    const art = ARTIFACTS[result.artifactDropId];
    rewardsHtml += `<div><span class="reward-artifact">${monsterDef.name}${josaEulReul(monsterDef.name)} 처치하고 신비로운 ${art.name}${josaEulReul(art.name)} 획득했습니다!</span></div>`;
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
