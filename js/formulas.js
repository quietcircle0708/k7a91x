// ============================================================
// formulas.js — 순수 계산 함수
// data.js의 데이터 테이블을 참조하는 계산 함수들. DOM을 직접
// 건드리지 않음 (일부 함수는 전역 state를 참조함).
// 밸런스 공식을 수정할 때는 이 파일을 보면 됨.
// ============================================================

// ---- 무기 스탯 조회 ----
function wpn(type){ return WEAPON_TYPES[type] || WEAPON_TYPES.longsword; }
function weaponKindLabel(type){ return WEAPON_KINDS[wpn(type).weaponKind] || ''; }
function weaponGradeLabel(type){ const g = WEAPON_GRADES[wpn(type).grade]; return g ? g.label : ''; }
function weaponGradeColor(type){ const g = WEAPON_GRADES[wpn(type).grade]; return g ? g.color : '#ffffff'; }
// 무기 이름 색상: 등급 색상이 기본, 강화 단계 색상의 가치가 더 높으면 그 색으로 대체.
// 하드코딩 없이 GRADE_NAME_COLOR_KEY/ENHANCE_NAME_COLOR_KEY 표만 보고 계산 — 새 무기/등급 추가해도 그대로 동작.
function weaponNameColor(type, level){
  const w = wpn(type);
  const gradeKey = GRADE_NAME_COLOR_KEY[w.grade] || 'white';
  const levelKey = ENHANCE_NAME_COLOR_KEY[level] || 'white';
  const finalKey = NAME_COLOR_RANK[levelKey] > NAME_COLOR_RANK[gradeKey] ? levelKey : gradeKey;
  return NAME_COLOR_HEX[finalKey];
}
function weaponName(type){ return wpn(type).name; }
// 상점 구매가 = 판매가(sellPrice) × 2
function weaponBuyPrice(type){ return (wpn(type).sellPrice || 0) * 2; }
// 레벨 제한 충족 여부 (levelReq 이상이어야 함)
function meetsWeaponLevelReq(type, playerLevel){ return playerLevel >= (wpn(type).levelReq || 1); }
// 무기 이미지 경로(파일명 기준). 실제로 파일이 있는지는 <img onerror>에서 최종 확인/대체함.
function weaponImagePath(type){ return WEAPON_IMAGE_DIR + wpn(type).image + WEAPON_IMAGE_EXT; }
function weaponImageFallbackPath(){ return WEAPON_IMAGE_DIR + WEAPON_IMAGE_FALLBACK + WEAPON_IMAGE_EXT; }

// ---- 착용 제한(레벨 + 무기 종류별 요구 스탯) ----
// 무기 종류에 따른 요구 스탯 목록을 계산 (레벨 제한 × 배율, 소수점 반올림, 강화 단계와 무관)
function weaponStatRequirements(type){
  const w = wpn(type);
  const formula = WEAPON_KIND_STAT_REQ[w.weaponKind];
  if(!formula || !w.levelReq) return [];
  return formula
    .map(f => ({ stat: f.stat, amount: Math.round(w.levelReq * f.mult) }))
    .filter(r => r.amount > 0);
}
// 착용 제한 안내 문구. 필요한 조건이 없으면 null 반환.
function weaponRequirementText(type){
  const w = wpn(type);
  const parts = [];
  if(w.levelReq && w.levelReq > 1) parts.push(`레벨 ${w.levelReq} 이상`);
  weaponStatRequirements(type).forEach(r => parts.push(`${STAT_LABELS[r.stat]} ${r.amount} 이상`));
  return parts.length ? parts.join(', ') : null;
}
// 착용(장착) 조건 충족 여부 — 레벨 + 무기 종류별 요구 스탯 모두 확인.
// playerStats는 { str, agi, int } 형태. 상점 구매 가능 여부(meetsWeaponLevelReq, 레벨만 확인)와는 별개.
function meetsWeaponEquipRequirements(type, playerLevel, playerStats){
  const w = wpn(type);
  if(w.levelReq && playerLevel < w.levelReq) return false;
  const stats = playerStats || {};
  return weaponStatRequirements(type).every(r => (stats[r.stat] || 0) >= r.amount);
}

// ---- 무기 툴팁(인벤토리/상점/던전 등 모든 화면 공통) ----
// 플레이어 스탯/버프는 전혀 반영하지 않고, 무기 데이터에 저장된 기본값만 표시함.
function wtipRow(label, value){
  return `<div>${label ? `<span style="color:var(--forge-cream-dim);">${label}</span> ` : ''}<span style="color:var(--forge-gold);">${value}</span></div>`;
}
function buildWeaponTooltipHtml(type, level){
  const w = wpn(type);
  const grade = WEAPON_GRADES[w.grade];
  const lvl = level != null ? level : 0;
  let html = `<div style="text-align:center;">`;

  // 1. 등급 + 이름 (+강화단계)
  const nameLine = (grade ? `[${grade.label}] ` : '') + w.name + ' +' + lvl;
  html += `<div style="color:${weaponNameColor(type, lvl)}; font-weight:700; margin-bottom:4px;">${nameLine}</div>`;

  // 2. 장비 설명
  if(w.desc) html += `<div style="color:var(--forge-cream-dim); margin-bottom:2px;">${w.desc}</div>`;

  // 3. 무기 종류
  const kindLabel = weaponKindLabel(type);
  if(kindLabel) html += wtipRow('무기 종류', kindLabel);

  // 4. 공격력
  const atk = atkFor(type, lvl);
  if(atk != null) html += wtipRow('공격력', atk);

  // 5. 공격 속도
  const speed = atkSpeedFor(type, lvl);
  if(speed != null) html += wtipRow('공격 속도', speed);

  // 6. 치명타 확률 (0%면 표시 안 함 — 강화 화면과 동일한 규칙)
  const crit = critChanceFor(type, lvl);
  if(crit) html += wtipRow('치명타 확률', crit + '%');

  // 7. 착용 제한 (필요한 조건이 있을 때만)
  const reqText = weaponRequirementText(type);
  if(reqText) html += wtipRow('착용 제한 :', reqText);

  html += `</div>`;
  return html;
}
function atkFor(type, level){ return wpn(type).atk[level]; }
function atkSpeedFor(type, level){ return wpn(type).speed[level]; }
function critChanceFor(type, level){ return wpn(type).crit[level]; }
function costFor(type, level){ return wpn(type).cost[level]; }
function sellValueFor(type, level){ return wpn(type).sell[level]; }
function oddsFor(type, level){ return wpn(type).odds[level]; }

// ---- 캐릭터 레벨 시스템 ----
function playerBaseHp(level){
  return Math.round(100 + 4900 * Math.pow((level - 1) / 98, 1.35));
}
function playerBaseMp(level){
  return Math.round(50 + 450 * Math.pow((level - 1) / 98, 1.35));
}
function monsterExp(level){
  return Math.round(1000 * Math.pow(1.08, level - 1));
}
function requiredKills(level){
  return Math.round(10 + Math.pow(level - 1, 1.65));
}
function requiredExp(level){
  return monsterExp(level) * requiredKills(level);
}
// 스탯 보너스가 반영된 실질 최대 체력/마나
function effectiveMaxHp(level){
  const s = state.stats || { str: 0, agi: 0, int: 0 };
  return playerBaseHp(level) + (s.str || 0) * 20 + (s.agi || 0) * 10;
}
function effectiveMaxMp(level){
  const s = state.stats || { str: 0, agi: 0, int: 0 };
  return playerBaseMp(level) + (s.int || 0) * 10;
}
function effectiveAtkSpeed(type, level){
  let s = atkSpeedFor(type, level);
  if(ownsArtifact('batwing')) s *= 1.05;
  const agi = (state.stats && state.stats.agi) || 0;
  s *= 1 + agi * 0.0005; // 민첩 1당 공격속도 +0.05%
  return s;
}
function effectiveAtk(type, level){
  const str = (state.stats && state.stats.str) || 0;
  return atkFor(type, level) + str * 2; // 힘 1당 공격력 +2
}

// ---- 골드/드랍 관련 계산 ----
function monsterGoldBase(level){
  return MONSTER_BASE_GOLD * Math.pow(1 + MONSTER_GOLD_GROWTH, level - 1);
}
function rollGoldDrop(level, multiplier){
  const base = monsterGoldBase(level) * (multiplier || 1);
  const spread = base * MONSTER_GOLD_VARIANCE;
  return Math.round(base - spread + Math.random() * spread * 2);
}
// 에픽 몬스터는 마석 파편/조각을 확정적으로 드랍한다 (레벨에 따라 종류/개수가 달라짐)
function epicShardDrop(level){
  if(level <= 10) return { item: 'manaFragment', qty: 1 };
  if(level <= 19) return { item: 'manaShard', qty: 1 };
  if(level <= 29) return { item: 'manaShard', qty: 2 };
  return { item: 'manaShard', qty: 4 }; // 30레벨 이상
}

// ---- 몬스터 체력/공격력 ----
// 일반: Lv1=150, 이후 (이전 레벨 HP + 50) x 1.12 / 에픽: 같은 레벨 일반 몬스터의 3배
function normalMonsterHP(level){
  let hp = 150;
  for(let l = 2; l <= level; l++){
    hp = (hp + 50) * 1.12;
  }
  return Math.round(hp);
}
function monsterHPFor(monsterDef, level){
  const base = normalMonsterHP(level);
  return monsterDef.grade === 'epic' ? Math.round(base * 3) : base;
}
// 몬스터 공격력: 플레이어가 레벨업마다 힘 1포인트를 투자한다고 가정했을 때의 예상 체력을 기준으로,
// 동레벨 일반 몬스터에게 평균 8대를 맞으면 쓰러지도록 역산. 에픽은 동레벨 일반의 1.3배.
function monsterAtk(level){
  const assumedStr = level - 1; // 1레벨 시작, 레벨업마다 힘 1포인트 투자
  const expectedHp = playerBaseHp(level) + assumedStr * 20; // 힘 1당 체력 +20 (effectiveMaxHp 공식과 동일)
  return Math.round(expectedHp / 8);
}

function monsterAtkFor(monsterDef, level){
  const base = monsterAtk(level);
  return monsterDef.grade === 'epic' ? Math.round(base * 1.3) : base;
}

// ---- 레벨 차이 보정 ----
// levelDiff = 플레이어 레벨 - 몬스터 레벨. ±5까지는 보정 없음(100%), 그 밖은 1레벨당 3%씩 보정.
// 플레이어 → 몬스터 피해: 플레이어가 높을수록 증가(최대 130%), 몬스터가 높을수록 감소(최소 40%)
function playerDamageMultiplier(levelDiff){
  if(levelDiff >= 6){
    const excess = levelDiff - 5;
    return Math.min(1.30, 1 + excess * 0.03);
  }
  if(levelDiff <= -6){
    const excess = -levelDiff - 5;
    return Math.max(0.40, 1 - excess * 0.03);
  }
  return 1;
}
// 몬스터 → 플레이어 피해: 플레이어가 높을수록 감소(최소 70%), 몬스터가 높을수록 증가(최대 160%)
function monsterDamageMultiplier(levelDiff){
  if(levelDiff >= 6){
    const excess = levelDiff - 5;
    return Math.max(0.70, 1 - excess * 0.03);
  }
  if(levelDiff <= -6){
    const excess = -levelDiff - 5;
    return Math.min(1.60, 1 + excess * 0.03);
  }
  return 1;
}

// ---- 던전/스폰 추첨 ----
function dungeonLevelRange(d){
  const mins = d.monsters.map(m => m.levelMin);
  const maxs = d.monsters.map(m => m.levelMax);
  return { min: Math.min(...mins), max: Math.max(...maxs) };
}
// 등장 레벨 가중 추첨: 레벨이 높을수록 등장 확률이 조금 낮아짐
function pickSpawnLevel(levelMin, levelMax){
  const weights = [];
  let total = 0;
  for(let l = levelMin; l <= levelMax; l++){
    const w = levelMax - l + 1;
    weights.push({ level: l, w });
    total += w;
  }
  let r = Math.random() * total;
  for(const item of weights){
    if(r < item.w) return item.level;
    r -= item.w;
  }
  return levelMax;
}
// 던전 몬스터 목록 중 하나를 확률에 따라 추첨 ({id, chance, levelMin, levelMax} 반환)
function pickSpawnMonster(dungeon){
  const list = dungeon.monsters;
  const total = list.reduce((s, m) => s + m.chance, 0);
  let r = Math.random() * total;
  for(const m of list){
    if(r < m.chance) return m;
    r -= m.chance;
  }
  return list[list.length - 1];
}
// 가중치 쌍 배열([값, 가중치])에서 하나를 추첨
function pickWeighted(pairs){
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for(const [v, w] of pairs){
    if(r < w) return v;
    r -= w;
  }
  return pairs[pairs.length - 1][0];
}
// 몬스터 처치 시 모든 드랍(골드/모험가의 유해/마석 파편/몬스터 고유 드랍)을 판정
function resolveDrops(monsterDef, dungeon, level){
  const grade = monsterDef.grade;
  const gradeInfo = MONSTER_GRADES[grade];
  const dropCfg = (dungeon.dropTable && dungeon.dropTable[grade]) || dungeon.dropTable.normal;

  const goldMultiplier = 1 + gradeInfo.goldBonus + (monsterDef.extraGoldBonus || 0);
  const gold = rollGoldDrop(level, goldMultiplier);

  let weaponDropLevel = null;
  if(dropCfg && Math.random() * 100 < dropCfg.relicChance){
    const tmpl = RELIC_TEMPLATES[dropCfg.relicTemplate];
    weaponDropLevel = pickWeighted(tmpl.levelWeights);
  }

  let manaFragmentQty = 0;
  let manaShardQty = 0;
  if(grade === 'epic'){
    // 에픽 몬스터는 마석 파편/조각을 확정적으로 드랍 (레벨에 따라 종류/개수 결정)
    const drop = epicShardDrop(level);
    if(drop.item === 'manaFragment') manaFragmentQty += drop.qty;
    else manaShardQty += drop.qty;
  } else if(dropCfg && Math.random() * 100 < dropCfg.shardChance){
    manaFragmentQty += 1;
  }

  let artifactDropId = null;
  for(const drop of (monsterDef.uniqueDrops || [])){
    if(drop.type === 'artifact' && canGrantArtifact(drop.artifactId) && Math.random() * 100 < drop.chance){
      artifactDropId = drop.artifactId;
      break;
    }
  }

  return { gold, weaponDropLevel, manaFragmentQty, manaShardQty, artifactDropId };
}

// ---- 한국어 조사 처리 ----
// 한국어 조사(이/가, 을/를) 선택: 받침 유무로 판정
function hasBatchim(word){
  const ch = word[word.length - 1];
  const code = ch.charCodeAt(0) - 0xAC00;
  if(code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}
function josaIGa(word){ return hasBatchim(word) ? '이' : '가'; }
function josaEulReul(word){ return hasBatchim(word) ? '을' : '를'; }

// ---- 표시용 포맷 ----
// "10 → 21(11↑)" 형식으로 증가폭을 함께 표시. 변동이 없으면 괄호를 생략.
function formatStatDelta(now, next, decimals, suffix){
  suffix = suffix || '';
  const fmt = v => decimals != null ? v.toFixed(decimals) : String(v);
  if(next === null) return fmt(now) + suffix;
  const delta = next - now;
  const eps = decimals != null ? Math.pow(10, -decimals) / 2 : 0;
  let out = fmt(now) + suffix + ' → ' + fmt(next) + suffix;
  if(delta > eps){
    out += `<span class="stat-up">(${fmt(delta)}${suffix}↑)</span>`;
  } else if(delta < -eps){
    out += `<span class="stat-down">(${fmt(Math.abs(delta))}${suffix}↓)</span>`;
  }
  return out;
}

function tierOf(level){
  if(level>=9) return 4; if(level>=8) return 3; if(level>=6) return 2; if(level>=3) return 1; return 0;
}

// ---- 강화 결과 추첨 ----
function weightedOutcome(odds){
  const r = Math.random()*100;
  if(r < odds[0]) return 'success';
  if(r < odds[0]+odds[1]) return 'stay';
  if(r < odds[0]+odds[1]+odds[2]) return 'down';
  return 'destroy';
}
