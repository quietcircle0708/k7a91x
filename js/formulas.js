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
// 착용(장착) 조건 충족 여부 — 아이템 레벨(플레이어 레벨 이상 필요) + 무기 종류별 요구 스탯 모두 확인.
// playerStats는 { str, agi, int } 형태. 구매/강화는 이 조건과 무관하게 항상 가능하며, 이 함수는 "장착" 액션에서만 사용됨.
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

  // 1. 이름 (+강화단계) — 무기 이름 색상 효과 적용
  const nameLine = w.name + ' +' + lvl;
  html += `<div style="color:${weaponNameColor(type, lvl)}; font-weight:700; margin-bottom:2px;">${nameLine}</div>`;

  // 1-2. 등급 — 이름과 별도 줄, 등급 색상 효과 적용
  if(grade) html += `<div style="color:${weaponGradeColor(type)}; font-weight:700; margin-bottom:4px;">${grade.label}</div>`;

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
// ---- 아티팩트 이름 색상 · 툴팁 ----
// 등급 가치 시스템(WEAPON_GRADES)을 그대로 재사용. 아티팩트는 강화 단계가 없으므로 무기처럼
// "강화 단계 색상과 비교해 더 높은 쪽" 로직 없이 등급 색상을 그대로 이름에 적용함.
function artifactGradeLabel(id){ const g = WEAPON_GRADES[ARTIFACTS[id].grade]; return g ? g.label : ''; }
function artifactGradeColor(id){ const g = WEAPON_GRADES[ARTIFACTS[id].grade]; return g ? g.color : '#ffffff'; }
function artifactNameColor(id){ return artifactGradeColor(id); }
// 아티팩트 툴팁: 레이아웃/줄바꿈/서식(라벨-값 구성 등)은 buildWeaponTooltipHtml과 동일하게 유지하고,
// 표시 항목만 이름 / 장비 설명 / 장비 타입 / 등급 / 효과 설명(라벨은 "효과") / 상점 구매 가격으로 구성함.
// 등급에 따른 색상 효과는 요구사항대로 "이름"에만 적용하고, 등급 행 자체는 다른 항목과 동일한 서식을 사용함.
function buildArtifactTooltipHtml(id){
  const a = ARTIFACTS[id];
  if(!a) return '';
  let html = `<div style="text-align:center;">`;

  // 1. 이름 — 아티팩트 등급 색상 효과 적용
  html += `<div style="color:${artifactNameColor(id)}; font-weight:700; margin-bottom:2px;">${a.name}</div>`;

  // 2. 장비 설명
  if(a.desc) html += `<div style="color:var(--forge-cream-dim); margin-bottom:4px;">${a.desc}</div>`;

  // 3. 장비 타입
  html += wtipRow('장비 타입', EQUIPMENT_TYPES[a.equipType] || '');

  // 4. 등급
  html += wtipRow('등급', artifactGradeLabel(id));

  // 5. 효과 설명 (툴팁에는 "효과"로 표시)
  if(a.effectText) html += wtipRow('효과', a.effectText);

  // 6. 상점 구매 가격 (공란이면 표시하지 않음)
  if(a.buyPrice != null) html += wtipRow('상점 구매 가격', a.buyPrice.toLocaleString() + ' G');

  html += `</div>`;
  return html;
}
// ---- 마석(재료) 이름 색상 · 툴팁 ----
// 마석은 강화 단계가 없으므로 무기처럼 이름 색상을 등급/강화 단계 중 더 높은 쪽으로 섞지 않고,
// 무기 등급 색상 공식(WEAPON_GRADES)을 그대로 재사용해 등급 색상만 적용함.
function stoneGradeInfo(id){ return WEAPON_GRADES[MISC_ITEMS[id].grade]; }
function stoneNameColor(id){ const g = stoneGradeInfo(id); return g ? g.color : '#ffffff'; }
// 마석 툴팁: 레이아웃/줄바꿈/서식은 buildWeaponTooltipHtml과 동일하게 유지하고, 표시 항목만
// 이름/등급/아이템 분류/설명/판매 가격으로 구성함.
function buildStoneTooltipHtml(id){
  const item = MISC_ITEMS[id];
  const grade = stoneGradeInfo(id);
  let html = `<div style="text-align:center;">`;

  // 1. 이름 — 등급 색상 효과 적용
  html += `<div style="color:${stoneNameColor(id)}; font-weight:700; margin-bottom:2px;">${item.name}</div>`;

  // 2. 등급 — 이름과 별도 줄, 등급 색상 효과 적용
  if(grade) html += `<div style="color:${grade.color}; font-weight:700; margin-bottom:4px;">${grade.label}</div>`;

  // 3. 설명
  if(item.desc) html += `<div style="color:var(--forge-cream-dim); margin-bottom:2px;">${item.desc}</div>`;

  // 4. 아이템 분류
  html += wtipRow('아이템 분류', ITEM_CLASS_LABELS[item.itemClass] || '');

  // 5. 판매 가격 — 기존 아이템과 동일한 형식(G 단위, 천단위 구분)
  html += wtipRow('판매 가격', item.sellPrice.toLocaleString() + 'G');

  html += `</div>`;
  return html;
}
// 기타(misc) 아이템 툴팁: 마석과 달리 등급이 없으므로 이름 색상은 기본색을 사용하고,
// 표시 항목은 이름/아이템 분류/설명/판매 가격으로 구성함(레이아웃/서식은 buildWeaponTooltipHtml과 동일).
function buildMiscTooltipHtml(id){
  const item = MISC_ITEMS[id];
  let html = `<div style="text-align:center;">`;

  // 1. 이름
  html += `<div style="color:var(--forge-cream); font-weight:700; margin-bottom:2px;">${item.name}</div>`;

  // 2. 설명
  if(item.desc) html += `<div style="color:var(--forge-cream-dim); margin-bottom:2px;">${item.desc}</div>`;

  // 3. 아이템 분류
  html += wtipRow('아이템 분류', ITEM_CLASS_LABELS[item.itemClass] || '');

  // 4. 판매 가격 — 기존 아이템과 동일한 형식(G 단위, 천단위 구분)
  html += wtipRow('판매 가격', item.sellPrice.toLocaleString() + 'G');

  html += `</div>`;
  return html;
}
function atkFor(type, level){ return wpn(type).atk[level]; }
function atkSpeedFor(type, level){ return wpn(type).speed[level]; }
function critChanceFor(type, level){ return wpn(type).crit[level]; }
function costFor(type, level){ return wpn(type).cost[level]; }
function sellValueFor(type, level){ return wpn(type).sell[level]; }
function oddsFor(type, level){ return wpn(type).odds[level]; }

// ---- 상점 품목 목록 (탭별) ----
// 각 아이템을 정렬에 필요한 최소 정보 { id, price, levelReq }로 정규화해서 반환.
// price/levelReq를 어떻게 뽑는지만 여기서 관리하고, 실제 카드 HTML은 render.js가 그림.
// 장비류(무기/방어구) 공통: purchasable:true인 항목만, 가격은 상점 구매가, levelReq는 착용 레벨 제한.
function shopEquipmentEntries(typesTable){
  return Object.values(typesTable)
    .filter(w => w.purchasable)
    .map(w => ({ id: w.id, price: (w.sellPrice || 0) * 2, levelReq: w.levelReq || 1 }));
}
// 소비 아이템: 상점 구매가(buyPrice) 기준. 착용 레벨 제한 개념이 없으므로 levelReq는 null.
function shopConsumableEntries(){
  return Object.values(CONSUMABLES).map(c => ({ id: c.id, price: c.buyPrice, levelReq: null }));
}
// 아티팩트: 상점 구매 가격(buyPrice)이 있는 항목만 상점에 노출. 공란(null)이면 상점 목록에서 제외됨.
function shopArtifactEntries(){
  return Object.values(ARTIFACTS).filter(a => a.buyPrice != null).map(a => ({ id: a.id, price: a.buyPrice, levelReq: null }));
}
// 마석 탭: 판매 전용 탭. 아이템 분류(itemClass)가 'stone'이고 보유한(개수>0) 아이템만 노출, 판매가 기준 정렬.
function shopStoneEntries(){
  return Object.values(MISC_ITEMS)
    .filter(m => m.itemClass === 'stone' && (state[m.stateKey] || 0) > 0)
    .map(m => ({ id: m.id, price: m.sellPrice, levelReq: null }));
}
// 기타 아이템: 판매 전용 탭. 아이템 분류(itemClass)가 'misc'이고 보유한(개수>0) 아이템만 노출, 판매가 기준 정렬.
function shopMiscEntries(){
  return Object.values(MISC_ITEMS)
    .filter(m => m.itemClass === 'misc' && (state[m.stateKey] || 0) > 0)
    .map(m => ({ id: m.id, price: m.sellPrice, levelReq: null }));
}
// 탭 id로 해당 탭에 표시할 정규화된 아이템 목록을 조회. 새 탭이 SHOP_TABS에 추가되면 이 분기도 함께 추가.
function shopEntriesForTab(tabId){
  if(tabId === 'weapon') return shopEquipmentEntries(WEAPON_TYPES);
  if(tabId === 'armor') return shopEquipmentEntries(ARMOR_TYPES);
  if(tabId === 'consumable') return shopConsumableEntries();
  if(tabId === 'artifact') return shopArtifactEntries();
  if(tabId === 'stone') return shopStoneEntries();
  if(tabId === 'misc') return shopMiscEntries();
  return [];
}
// 필터(price/levelReq) + 방향(asc/desc)에 따라 엔트리 목록을 정렬해서 새 배열로 반환.
// levelReq가 없는 아이템(소비/아티팩트/기타)에 레벨 필터를 적용해도 에러 없이 동작하도록 null은 맨 뒤로 취급.
function sortShopEntries(entries, filterId, dir){
  const sorted = [...entries].sort((a, b) => {
    const av = filterId === 'levelReq' ? (a.levelReq == null ? Infinity : a.levelReq) : a.price;
    const bv = filterId === 'levelReq' ? (b.levelReq == null ? Infinity : b.levelReq) : b.price;
    return av - bv;
  });
  if(dir === 'desc') sorted.reverse();
  return sorted;
}

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
// 아티팩트로 증가하는 원시 스탯(힘/민첩/지능) 보너스. 캐릭터 정보창에서 기본값과 구분해
// 초록색 "(+N)"으로 표시하는 데도 사용됨(render.js renderStatAllocRow 참고).
function artifactStatBonus(stat){
  let bonus = 0;
  if(stat === 'str' && isArtifactEquipped('antlerflag')) bonus += 2;
  return bonus;
}
// 스탯 보너스가 반영된 실질 최대 체력/마나
function effectiveMaxHp(level){
  const s = state.stats || { str: 0, agi: 0, int: 0 };
  const str = (s.str || 0) + artifactStatBonus('str');
  let hp = playerBaseHp(level) + str * 20 + (s.agi || 0) * 5;
  if(isArtifactEquipped('antlerflag')) hp += 500; // 힘 보너스와 별개로 적용되는 고정 체력 보너스
  return hp;
}
function effectiveMaxMp(level){
  const s = state.stats || { str: 0, agi: 0, int: 0 };
  let mp = playerBaseMp(level) + (s.int || 0) * 30;
  if(isArtifactEquipped('ring')) mp += 500;
  return mp;
}
function effectiveAtkSpeed(type, level){
  let s = atkSpeedFor(type, level);
  if(isArtifactEquipped('batwing')) s *= 1.05;
  const agi = (state.stats && state.stats.agi) || 0;
  s *= 1 + agi * 0.001; // 민첩 1당 공격속도 +0.1%
  return s;
}
function effectiveAtk(type, level){
  const str = ((state.stats && state.stats.str) || 0) + artifactStatBonus('str');
  const agi = (state.stats && state.stats.agi) || 0;
  return atkFor(type, level) + str * 2 + agi * 1; // 힘 1당 공격력 +2, 민첩 1당 공격력 +1
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
// 마석 등급 선택(전역 공식). STONE_GRADE_RULES(data.js)를 위에서부터 순서대로 검사해 몬스터 레벨이
// 속하는 첫 구간의 등급을 반환함 — 레벨 구간이나 등급을 바꾸고 싶으면 데이터(STONE_GRADE_RULES)만
// 수정하면 되고, 이 함수나 드랍 판정 로직은 건드릴 필요가 없음.
function pickStoneGrade(level){
  const rule = STONE_GRADE_RULES.find(r => level >= r.minLevel && (r.maxLevel == null || level <= r.maxLevel));
  return rule ? rule.grade : STONE_GRADE_RULES[STONE_GRADE_RULES.length - 1].grade;
}
// 마석 드랍 판정(전역 공식). 1) STONE_DROP_CHANCE 확률로 드랍 판정 → 2) 성공 시 pickStoneGrade로 등급 결정
// → 3) 해당 등급의 마석 아이템(MISC_ITEMS 중 itemClass:'stone')을 조회 → 4) 기본 수량(STONE_DROP_BASE_QTY),
// 단 에픽 등급 몬스터는 수량 2배. 실패하면 null을 반환.
function rollStoneDrop(level, monsterGrade){
  if(Math.random() * 100 >= STONE_DROP_CHANCE) return null;
  const grade = pickStoneGrade(level);
  const item = Object.values(MISC_ITEMS).find(m => m.itemClass === 'stone' && m.grade === grade);
  if(!item) return null;
  const qty = monsterGrade === 'epic' ? STONE_DROP_BASE_QTY * 2 : STONE_DROP_BASE_QTY;
  return { itemId: item.id, qty };
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
  const gradeApplied = monsterDef.grade === 'epic' ? Math.round(base * 3) : base;
  return Math.round(gradeApplied * (monsterDef.hpMult != null ? monsterDef.hpMult : 1));
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
  const gradeApplied = monsterDef.grade === 'epic' ? Math.round(base * 1.3) : base;
  return Math.round(gradeApplied * (monsterDef.atkMult != null ? monsterDef.atkMult : 1));
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
// 던전 화면에 표시할 "등장 몬스터 레벨" 범위. 일반 등급은 몬스터레벨~몬스터레벨+levelRange,
// 에픽(그 외 등급)은 몬스터 고정 레벨 하나만 가지므로 그 값 자체가 min=max가 됨.
function dungeonLevelRange(d){
  const levels = [];
  d.monsters.forEach(id => {
    const m = MONSTERS[id];
    if(m.grade === 'normal'){
      levels.push(m.level, m.level + (d.levelRange || 0));
    } else {
      levels.push(m.level);
    }
  });
  return { min: Math.min(...levels), max: Math.max(...levels) };
}
// 던전 아이콘: 비어있으면 등장 몬스터 중 첫 번째의 아이콘을 그대로 사용
function dungeonIcon(d){
  return d.icon || (d.monsters.length ? MONSTERS[d.monsters[0]].icon : '');
}
// 등장 레벨 추첨: 구간 내 모든 레벨이 동일한 확률(균등 분포)
function pickSpawnLevel(levelMin, levelMax){
  return levelMin + Math.floor(Math.random() * (levelMax - levelMin + 1));
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
// 목록 중 targetLevel과 아이템 레벨 차이가 가장 작은 무기들만 남김(동률이면 전부 후보로 남음)
function nearestLevelCandidates(list, targetLevel){
  if(list.length === 0) return [];
  let minDiff = Infinity;
  list.forEach(w => { const diff = Math.abs(w.levelReq - targetLevel); if(diff < minDiff) minDiff = diff; });
  return list.filter(w => Math.abs(w.levelReq - targetLevel) === minDiff);
}
// 모험가의 유해(무기) 드랍 판정.
// 1) RELIC_DROP_CHANCE 확률로 드랍 판정 → 2) RELIC_GRADE_CHANCE로 장비 등급 선택 →
// 3) 그 등급 중 아이템 레벨이 [max(1, 몬스터레벨-RELIC_LEVEL_WINDOW), 몬스터레벨] 구간인 후보만 필터 →
//    (후보가 없으면 폴백: ① 같은 등급 안에서 레벨 구간 제한 없이 몬스터 레벨과 가장 가까운 아이템 레벨로 대체
//     ② 그래도 없으면(해당 등급 무기가 아예 없음) 등급 상관없이 몬스터 레벨과 가장 가까운 무기로 대체) →
// 4) 후보의 "등록된 레벨" 종류를 내림차순으로 최고 레벨 가중치 100, 한 단계 낮아질 때마다 ×RELIC_LEVEL_WEIGHT_DECAY로 레벨 추첨 →
// 5) 그 레벨(+같은 등급, 폴백된 경우는 폴백된 등급)에 해당하는 무기 중 하나를 무작위로 선택 →
// 6) RELIC_ENHANCE_LEVEL_CHANCE 확률표로 강화 단계(+0~+5)를 등급과 무관하게 별도로 추첨.
function resolveWeaponRelicDrop(monsterLevel){
  if(Math.random() * 100 >= RELIC_DROP_CHANCE) return null;

  const grade = pickWeighted(Object.entries(RELIC_GRADE_CHANCE));

  const minLevel = Math.max(1, monsterLevel - RELIC_LEVEL_WINDOW);
  const maxLevel = monsterLevel;
  let candidates = Object.values(WEAPON_TYPES).filter(w =>
    w.grade === grade && w.levelReq >= minLevel && w.levelReq <= maxLevel
  );
  if(candidates.length === 0){
    // 폴백 ①: 레벨 구간 제한을 풀고, 같은 등급 안에서 가장 가까운 레벨로 대체
    candidates = nearestLevelCandidates(Object.values(WEAPON_TYPES).filter(w => w.grade === grade), monsterLevel);
  }
  if(candidates.length === 0){
    // 폴백 ②: 이 등급에 등록된 무기가 아예 없으면(현재 에픽처럼), 등급도 무시하고 가장 가까운 레벨로 대체
    candidates = nearestLevelCandidates(Object.values(WEAPON_TYPES), monsterLevel);
  }
  if(candidates.length === 0) return null; // 등록된 무기가 하나도 없는 극단적인 경우

  const levels = [...new Set(candidates.map(w => w.levelReq))].sort((a, b) => b - a); // 높은 레벨부터
  let weight = 100;
  const levelWeightPairs = levels.map(lv => {
    const pair = [lv, weight];
    weight *= RELIC_LEVEL_WEIGHT_DECAY;
    return pair;
  });
  const chosenLevel = pickWeighted(levelWeightPairs);

  const pool = candidates.filter(w => w.levelReq === chosenLevel);
  const weaponType = pool[Math.floor(Math.random() * pool.length)];
  const enhanceLevel = pickWeighted(RELIC_ENHANCE_LEVEL_CHANCE);
  return { type: weaponType.id, level: enhanceLevel };
}
// 몬스터 데이터의 drops 항목(name) 중 재료성 아이템(MISC_ITEMS)에 등록된 이름과 일치하는 것을 찾음.
// 이름 기반으로 매칭하므로, MISC_ITEMS에 새 재료 아이템을 추가하고 몬스터의 drops에 같은 이름만
// 등록하면 별도 코드 수정 없이 자동으로 연결됨.
function miscItemByName(name){
  return Object.values(MISC_ITEMS).find(it => it.name === name) || null;
}

// 몬스터 처치 시 모든 드랍(골드/모험가의 유해/마석/몬스터 고유 드랍/재료 아이템)을 판정
function resolveDrops(monsterDef, dungeon, level){
  const grade = monsterDef.grade;
  const gradeInfo = MONSTER_GRADES[grade];

  const goldMultiplier = 1 + gradeInfo.goldBonus + (monsterDef.extraGoldBonus || 0);
  const gold = rollGoldDrop(level, goldMultiplier);

  const weaponDrop = resolveWeaponRelicDrop(level); // { type, level } 또는 null

  const stoneDrop = rollStoneDrop(level, grade); // { itemId, qty } 또는 null(전역 공식, 던전/등급별 개별 설정 없음)

  // drops 중 artifactId가 있는 항목만 실제 아티팩트 지급 판정 대상.
  let artifactDropId = null;
  for(const drop of (monsterDef.drops || [])){
    if(drop.artifactId && canGrantArtifact(drop.artifactId) && Math.random() * 100 < drop.chance){
      artifactDropId = drop.artifactId;
      break;
    }
  }

  // drops 중 artifactId가 없는 항목(도토리/쥐고기 등 재료류)은 MISC_ITEMS에 등록된 재료 아이템으로 취급하여,
  // 각 항목마다 독립적으로 확률을 판정함(하나의 몬스터가 여러 개를 동시에 드랍할 수도, 하나도 드랍 안 할 수도 있음).
  const miscDrops = [];
  for(const drop of (monsterDef.drops || [])){
    if(drop.artifactId) continue; // 아티팩트 드랍은 위에서 이미 별도 처리됨
    if(Math.random() * 100 < drop.chance){
      const item = miscItemByName(drop.name);
      if(item) miscDrops.push({ itemId: item.id, name: item.name, icon: item.icon, qty: 1 });
    }
  }

  return { gold, weaponDrop, stoneDrop, artifactDropId, miscDrops };
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
function josaWaGwa(word){ return hasBatchim(word) ? '과' : '와'; }

// ---- 던전 스테이지 시스템: 메시지 생성 ----
// 스테이지 입장 메시지(STAGE_ENTER_MSG, data.js)를 실제 문구로 변환.
// stageNum이 1이면 첫 입장 문구(던전 이름 치환), 2~10이면 공통 문구, 11(숨겨진 장소)이면 전용 문구.
function stageEnterMessage(stageNum, dungeonName){
  if(stageNum === DUNGEON_TREASURE_STAGE) return STAGE_ENTER_MSG.treasure;
  if(stageNum === 1) return STAGE_ENTER_MSG.first.replace('{name}', dungeonName);
  return STAGE_ENTER_MSG.mid;
}
// 전투 스테이지(1~10) 표시 라벨. 예) 1굴, 8굴. 숨겨진 장소는 별도 처리.
function stageLabel(stageNum){
  return stageNum === DUNGEON_TREASURE_STAGE ? '숨겨진 장소' : `${stageNum}굴`;
}
// 몬스터 조우 메시지(MONSTER_ENCOUNTER_MSGS, data.js) 중 하나를 랜덤으로 골라 조사까지 채워서 반환.
function pickEncounterMessage(monsterName){
  const entry = MONSTER_ENCOUNTER_MSGS[Math.floor(Math.random() * MONSTER_ENCOUNTER_MSGS.length)];
  const josa = entry.josaType === 'wagwa' ? josaWaGwa(monsterName) : josaIGa(monsterName);
  return entry.text.replace('{name}', monsterName).replace('{josa}', josa);
}
// 스테이지 번호를 기준으로 몬스터 등급(일반/에픽)을 추첨(STAGE_GRADE_CHANCE, data.js 전역 설정).
function pickStageGrade(stageNum){
  const chance = STAGE_GRADE_CHANCE[stageNum] || { normal: 100, epic: 0 };
  return Math.random() * 100 < chance.epic ? 'epic' : 'normal';
}
// 전투 시작 시 등장할 몬스터 수(1~MONSTER_COUNT_MAX)를 스테이지 기준으로 추첨.
// 에픽 몬스터가 확정 스폰되는 스테이지(MONSTER_COUNT_FORCED_SINGLE_STAGES)는 항상 1마리만 반환함.
function pickMonsterCount(stageNum){
  if(MONSTER_COUNT_FORCED_SINGLE_STAGES.includes(stageNum)) return 1;
  const pairs = Object.entries(MONSTER_COUNT_CHANCE).map(([count, chance]) => [Number(count), chance]);
  return pickWeighted(pairs);
}
// 몬스터 개체 수(pickMonsterCount 결과)만큼 등급(일반/에픽)을 순서대로 결정.
// 에픽 등급은 한 전투 그룹에 최대 1마리만 허용되므로, 먼저 에픽이 결정되면 그 이후 등장분은
// 등급 추첨 없이 전부 일반 등급으로 고정함(기존 pickStageGrade 확률 공식 자체는 그대로 사용).
function pickStageMonsterGrades(stageNum, count){
  const grades = [];
  let epicUsed = false;
  for(let i = 0; i < count; i++){
    if(epicUsed){
      grades.push('normal');
      continue;
    }
    const grade = pickStageGrade(stageNum);
    if(grade === 'epic') epicUsed = true;
    grades.push(grade);
  }
  return grades;
}
// 던전의 최소 레벨(가장 낮은 등장 몬스터 레벨) 기준 골드에 배율/편차를 적용한 숨겨진 장소 보상 골드 계산.
function rollTreasureGold(minLevel){
  const base = monsterGoldBase(minLevel) * TREASURE_GOLD_MULT;
  const spread = base * TREASURE_GOLD_VARIANCE;
  return Math.round(base - spread + Math.random() * spread * 2);
}

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
