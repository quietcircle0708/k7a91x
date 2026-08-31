// ============================================================
// formulas.js — 순수 계산 함수
// data.js의 데이터 테이블을 참조하는 계산 함수들. DOM을 직접
// 건드리지 않음 (일부 함수는 전역 state를 참조함).
// 밸런스 공식을 수정할 때는 이 파일을 보면 됨.
// ============================================================

// ---- 피해량 계산 순서 (전역 기준) ----
// 앞으로 추가되는 치명타/방어도/상태 이상 및 조건부 피해 증가 효과는 아래 순서를 기준으로 삼는다.
// 기존에 이미 정상 동작 중인 계산 로직(dungeon.js attackTick, actions.js resolveSkillEffect/
// applyDelayedSkillHits 등)은 이 기준에 맞춰 임의로 재배열하지 않는다 — 신규 피해 관련 효과를
// 추가하거나 기존 계산 로직을 직접 수정할 때 참고하는 순서.
//   1. 기본 피해량 계산       — 공격력 또는 스킬 피해량%을 기준으로 최초 피해량을 계산.
//   2. 공격/스킬 자체 피해량 배율 적용 — 스킬 데미지%, 기본 공격 피해 증가 등 공격 자체에 직접
//      적용되는 배율.
//   3. 치명타 판정             — 타격마다 치명타 확률을 기준으로 개별 판정.
//   4. 치명타 피해 배율 적용   — 치명타로 판정된 경우 기존 치명타 피해 배율(1.5배) 적용.
//   5. 방어도에 따른 피해 보정 — defenseDamageMultiplier(defense) = {(200+방어도)/20}²×0.01.
//      방어도는 음수/양수 모두 가능(양수면 피해 증가).
//   6. 상태 이상 및 조건부 피해 증가 적용 — 방어도 계산까지 끝난 피해량을 기준으로 적용
//      (예: "중독 상태 적 피해 +10%" → 방어도 적용 후 피해량에 ×1.10).
//   7. 최종 피해량 반올림       — 모든 보정을 적용한 뒤 반올림해 실제 피해량으로 사용.

// ---- 무기 스탯 조회 ----
// 방어구 시스템 추가 이후: WEAPON_TYPES에 없으면 ARMOR_TYPES(→ACCESSORY_TYPES)도 찾아봄. 아이템 id는
// 도감 간에 겹치지 않으므로 기존 무기 id 조회 동작은 완전히 그대로 유지됨(항상 WEAPON_TYPES가 먼저
// 검사됨). 이렇게 하면 이름/등급색상/아이콘/툴팁 등 "장비 전역 설정"에 해당하는 함수들을 방어구에도
// 그대로 재사용할 수 있음 — 단, atk/speed/crit 등 무기 전용 필드를 쓰는 함수(atkFor 등)는 방어구
// id로 호출하면 안 됨(호출부에서 equipType으로 구분해서 사용).
function wpn(type){ return WEAPON_TYPES[type] || ARMOR_TYPES[type] || ACCESSORY_TYPES[type] || SUB_TYPES[type] || WEAPON_TYPES.longsword; }
function weaponKindLabel(type){ return WEAPON_KINDS[wpn(type).weaponKind] || ''; }
function weaponGradeLabel(type){ const g = WEAPON_GRADES[wpn(type).grade]; return g ? g.label : ''; }
function weaponGradeColor(type){ const g = WEAPON_GRADES[wpn(type).grade]; return g ? g.color : '#ffffff'; }
// ---- 아이템 등급별 아이콘 슬롯 배경색(공통) ----
// PNG 이미지 자체는 절대 건드리지 않고, PNG가 담기는 "슬롯" 영역에만 등급별 배경색을 적용하기 위한
// 공용 클래스 계산 함수. 새로운 색상 값을 만들지 않고 기존 등급 텍스트 색상 시스템(WEAPON_GRADES.color)이
// 쓰는 것과 동일한 등급 키만 그대로 재사용함 — 실제 배경 색상값 자체는 css/style.css의
// .icon-grade-bg.grade-* 규칙에서 관리(텍스트 색상 로직인 weaponNameColor 등과는 완전히 별개 시스템).
// grade가 없거나(플라스크 등 등급 없는 소비 아이템) WEAPON_GRADES에 없는 값이면 빈 문자열을 반환해
// 슬롯의 기존 기본 배경을 그대로 둠(강제로 등급을 만들어 씌우지 않음).
function gradeIconBgClass(grade){
  return (grade && WEAPON_GRADES[grade]) ? ('icon-grade-bg grade-' + grade) : '';
}
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
// 강화 단계 표시 문구: +0이면 빈 문자열(문구 자체를 숨김), +1 이상이면 기존과 동일하게 " +N"으로 표시.
// 강화 수치(level) 자체는 전혀 건드리지 않고, 화면에 붙이는 접미사 문구만 여기서 통일해서 관리함 —
// 이름 옆에 강화 단계를 표시하는 모든 화면(인벤토리/강화선택/툴팁/장착정보/판매문구/드랍알림 등)이
// 전부 이 함수를 거치므로, 표시 규칙을 바꿀 일이 생기면 여기 한 곳만 고치면 됨.
function levelSuffix(level){ return (level > 0) ? ' +' + level : ''; }
// 상점 구매가 = 판매가(sellPrice) × 2
function weaponBuyPrice(type){ return (wpn(type).sellPrice || 0) * 2; }
// 무기 이미지 경로(파일명 기준). 실제로 파일이 있는지는 <img onerror>에서 최종 확인/대체함.
// 방어구(equipType:'armor')는 별도 디렉토리(ARMOR_IMAGE_DIR)를 쓰고, image 필드가 비어 있으면
// 방어구 종류별 기본 이미지(ARMOR_DEFAULT_IMAGE)를 자동 적용함(방어구 데이터 스키마 규칙).
function weaponImagePath(type){
  const w = wpn(type);
  if(w.equipType === 'armor'){
    const file = w.image || ARMOR_DEFAULT_IMAGE[w.armorKind] || 'armorbase';
    return ARMOR_IMAGE_DIR + file + ARMOR_IMAGE_EXT;
  }
  if(w.equipType === 'accessory'){
    const file = w.image || ACCESSORY_DEFAULT_IMAGE[w.accessoryKind] || 'ringbase';
    return ACCESSORY_IMAGE_DIR + file + ACCESSORY_IMAGE_EXT;
  }
  if(w.equipType === 'sub'){
    const file = w.image || SUB_DEFAULT_IMAGE[w.subKind] || 'shieldbase';
    return SUB_IMAGE_DIR + file + SUB_IMAGE_EXT;
  }
  return WEAPON_IMAGE_DIR + w.image + WEAPON_IMAGE_EXT;
}
function weaponImageFallbackPath(){ return WEAPON_IMAGE_DIR + WEAPON_IMAGE_FALLBACK + WEAPON_IMAGE_EXT; }

// 몬스터 아이콘 HTML 생성(무기 아이콘 출력 구조를 그대로 재사용). image 필드가 있으면 PNG를 출력하고,
// 없으면 기존과 동일하게 icon(이모지)을 그대로 반환함(HTML 이스케이프 불필요한 순수 이모지 문자열).
// className은 화면별 크기 클래스를 넘겨받아 CSS로만 크기를 조절함(monster-icon-img는 부모의 font-size를
// 1em 기준으로 그대로 물려받으므로, 기존 이모지가 쓰던 font-size 기반 크기 규칙에 자동으로 맞춰짐).
// PNG 파일이 없거나 로드에 실패하면 monsterImgError(onerror)가 img를 이모지 텍스트로 즉시 대체함 —
// 오류 없이 항상 무언가는 표시됨. monsterDefLike는 { icon, image } 형태면 되므로 MONSTERS[id] 전체뿐 아니라
// killedMonsters처럼 필요한 필드만 담은 객체를 넘겨도 동일하게 동작함.
function monsterIconHtml(monsterDefLike, className){
  if(!monsterDefLike || !monsterDefLike.image) return monsterDefLike ? monsterDefLike.icon : '';
  const cls = 'monster-icon-img' + (className ? ' ' + className : '');
  const path = MONSTER_IMAGE_DIR + monsterDefLike.image + MONSTER_IMAGE_EXT;
  return `<img src="${path}" class="${cls}" alt="" data-fallback-emoji="${monsterDefLike.icon}" onerror="monsterImgError(this)">`;
}
// monsterIconHtml의 <img onerror>에서 호출됨: PNG 로드 실패 시 오류 없이 이모지 텍스트로 즉시 대체.
function monsterImgError(img){
  img.replaceWith(document.createTextNode(img.dataset.fallbackEmoji || ''));
}

// 던전 전투 화면 중앙에 표시되는 플레이어 아이콘 HTML(monsterIconHtml과 완전히 동일한 구조 재사용).
// direction('up'/'left'/'right')+motion('idle'/'attack'/'buff') 두 값으로 파일을 고름(요구사항 7번,
// PLAYER_POSE_* 데이터 참고) — 인자를 생략하거나 잘못된 값이 들어오면 기본값(상 방향, 기본 자세)으로
// 안전하게 대체됨. 로드 실패 시에도 기존 몬스터 아이콘과 동일하게 monsterImgError로 이모지로 즉시 대체됨.
function playerCombatIconHtml(direction, motion){
  const dir = PLAYER_POSE_DIRECTIONS.includes(direction) ? direction : 'up';
  const mo = PLAYER_POSE_MOTIONS.includes(motion) ? motion : 'idle';
  const path = PLAYER_POSE_IMAGE_DIR + mo + '_' + dir + PLAYER_IMAGE_EXT;
  return `<img src="${path}" class="monster-icon-img" alt="" data-fallback-emoji="${PLAYER_IMAGE_FALLBACK_EMOJI}" onerror="monsterImgError(this)">`;
}

// 기타/아티팩트/소비 아이템 아이콘 HTML 생성(monsterIconHtml과 완전히 동일한 구조 재사용). image 필드가
// 있으면 PNG를 출력하고, 없으면 기존과 동일하게 icon(이모지)을 그대로 반환함. className은 화면별 크기
// 클래스를 넘겨받지만, item-icon-img 자체가 부모 요소의 font-size를 1em 기준으로 그대로 물려받으므로
// 대부분의 화면(equip-slot/inv-icon/artifact-icon-box/quickslot-icon 등)은 클래스 없이도 기존 이모지가
// 쓰던 font-size 기반 크기 규칙에 자동으로 맞춰짐. PNG 파일이 없거나 로드에 실패하면 itemImgError(onerror)가
// img를 이모지 텍스트로 즉시 대체함 — 오류 없이 항상 무언가는 표시됨. itemDefLike는 { icon, image } 형태면
// 되므로 ARTIFACTS/CONSUMABLES/MISC_ITEMS 항목뿐 아니라 필요한 필드만 담은 객체를 넘겨도 동일하게 동작함.
function itemIconHtml(itemDefLike, className){
  if(!itemDefLike || !itemDefLike.image) return itemDefLike ? itemDefLike.icon : '';
  const cls = 'item-icon-img' + (className ? ' ' + className : '');
  const path = ITEM_IMAGE_DIR + itemDefLike.image + ITEM_IMAGE_EXT;
  const img = `<img src="${path}" class="${cls}" alt="" data-fallback-emoji="${itemDefLike.icon}" onerror="itemImgError(this)">`;
  const bgCls = gradeIconBgClass(itemDefLike.grade);
  return bgCls ? `<span class="${bgCls}">${img}</span>` : img;
}
// itemIconHtml의 <img onerror>에서 호출됨: PNG 로드 실패 시 오류 없이 이모지 텍스트로 즉시 대체.
function itemImgError(img){
  img.replaceWith(document.createTextNode(img.dataset.fallbackEmoji || ''));
}
// 무기 아이콘을 표시하는 모든 화면(강화/인벤토리/상점/보상 등)에서 공통으로 쓰는 <img> HTML 생성 함수.
// PNG가 없거나 로드에 실패하면 onerror로 WEAPON_IMAGE_FALLBACK(common_shortsword)로 자동 대체됨.
// 화면마다 크기가 다르므로 className만 다르게 넘겨서 CSS로 크기만 조절하고, 출력 방식 자체는 항상 동일함.
// 새 무기를 WEAPON_TYPES에 image 필드와 함께 등록하기만 하면 이 함수를 거치는 모든 화면에 자동 반영됨.
// 무기 종류(weaponKind)가 단검이면 실제 이미지 파일은 그대로 두고 kind-dagger 클래스(CSS transform:scale)만
// 추가로 붙여 다른 무기보다 30% 작게 출력함(강화 화면의 setBladeShape와 동일한 축소 비율) — 무기 데이터를
// 개별 수정하는 방식이 아니라 무기 종류 판정만으로 자동 적용되므로, 새로 등록되는 단검에도 자동 반영됨.
// 방어구/장신구(equipType이 armor 또는 accessory)는 종류 구분 없이 전부 20% 작게 출력함(weapon-icon-equip-small,
// dagger와 동일한 CSS transform:scale 패턴) — equipType 판정만으로 자동 적용되므로 새로 추가되는 방어구/장신구
// 종류(투구/갑옷/반지 외 새 종류 포함)에도 데이터 등록만으로 자동 반영됨.
// level(선택): 실제 보유 중인 개별 인스턴스의 강화 단계를 넘기면, 강화 화면(applySwordGlow)이 쓰는 것과
// 동일한 ENHANCE_LEVEL_EFFECTS 규칙을 그대로 재사용해 PNG 위에 별도 레이어(icon-enhance-glow)로 발광 효과를
// 출력함 — PNG 파일이나 등급 배경(icon-grade-bg)과는 완전히 독립적인 세 번째 레이어. level을 넘기지 않거나
// (카탈로그/미리보기 등 특정 인스턴스가 없는 화면) +0이거나 해당 단계에 효과가 없으면(glow==='none')
// 이 레이어 자체를 아예 만들지 않음(빈 span조차 남기지 않음).
function weaponIconHtml(type, className, level){
  const w = wpn(type);
  const kindCls = w.weaponKind === 'dagger' ? ' weapon-icon-dagger' : '';
  const isEquipKind = (w.equipType === 'armor' || w.equipType === 'accessory' || w.equipType === 'sub');
  const equipSmallCls = isEquipKind ? ' weapon-icon-equip-small' : '';
  const cls = 'weapon-icon-img' + (className ? ' ' + className : '') + kindCls + equipSmallCls;
  // 방어구/장신구/보조는 무기용 폴백(공용 숏소드 이미지)으로 대체하면 오히려 혼란스러우므로, 실패 시 그냥
  // 자기 경로를 유지함(이미지가 없으면 빈 아이콘으로 보임 — 해당 종류 PNG 에셋 추가 시 자동 해결됨).
  const fallback = isEquipKind ? weaponImagePath(type) : weaponImageFallbackPath();
  const img = `<img src="${weaponImagePath(type)}" class="${cls}" alt="" onerror="this.onerror=null;this.src='${fallback}';">`;
  const levelEffect = (level != null) ? (ENHANCE_LEVEL_EFFECTS[level] || null) : null;
  const hasGlow = !!(levelEffect && levelEffect.glow && levelEffect.glow !== 'none');
  const withGlow = hasGlow ? `<span class="icon-enhance-glow" style="filter:${levelEffect.glow};">${img}</span>` : img;
  const bgCls = gradeIconBgClass(w.grade);
  return bgCls ? `<span class="${bgCls}">${withGlow}</span>` : withGlow;
}

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
// playerStats는 { str, agi, int } 형태(호출부에서 effectiveStats()를 넘겨 레벨업 투자 스탯 + 장비/아티팩트
// 보너스가 합산된 "최종 스탯" 기준으로 판정함). 구매/강화는 이 조건과 무관하게 항상 가능하며, 이 함수는
// "장착" 액션에서만 사용됨. 함수 자체의 판정 로직(레벨/스탯 비교)은 변경하지 않았고, 호출부가 넘기는
// playerStats의 계산 기준만 바뀜.
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
function buildWeaponTooltipHtml(type, level, damaged){
  const w = wpn(type);
  const grade = WEAPON_GRADES[w.grade];
  const lvl = level != null ? level : 0;
  let html = `<div style="text-align:center;">`;

  // 1. 이름 (+강화단계, +0이면 숨김) — 무기 이름 색상 효과 적용. 손상된 아이템은 이름 바로 뒤,
  // 강화단계 앞에 "(손상)"을 붙임(요청사항 11번 — 띄어쓰기 없이, 강화단계 표기보다 앞).
  const nameLine = w.name + (damaged ? '(손상)' : '') + levelSuffix(lvl);
  html += `<div style="color:${weaponNameColor(type, lvl)}; font-weight:700; margin-bottom:2px;">${nameLine}</div>`;

  // 1-2. 등급 — 이름과 별도 줄, 등급 색상 효과 적용
  if(grade) html += `<div style="color:${weaponGradeColor(type)}; font-weight:700; margin-bottom:4px;">${grade.label}</div>`;

  // 2. 장비 설명
  if(w.desc) html += `<div style="color:var(--forge-cream-dim); margin-bottom:2px;">${w.desc}</div>`;

  // 3. 무기 종류
  const kindLabel = weaponKindLabel(type);
  if(kindLabel) html += wtipRow('무기 종류', kindLabel);

  // 4. 공격력 — 손상된 아이템은 해당 강화단계 공격력의 80%로 표시(요청사항 12번, 다른 수치는 그대로 유지)
  const rawAtk = atkFor(type, lvl);
  const atk = rawAtk != null && damaged ? Math.round(rawAtk * 0.8) : rawAtk;
  if(atk != null) html += wtipRow('공격력', atk);

  // 5. 공격 속도
  const speed = atkSpeedFor(type, lvl);
  if(speed != null) html += wtipRow('공격 속도', speed);

  // 6. 치명타 확률 (0%면 표시 안 함 — 강화 화면과 동일한 규칙)
  const crit = critChanceFor(type, lvl);
  if(crit) html += wtipRow('치명타 확률', crit + '%');

  // 6-2. 고유 옵션 (에픽/유니크 전용, 활성화 단계 미만이면 회색 텍스트 + 활성화 조건 안내)
  html += weaponUniqueOptionTooltipHtml(type, lvl);

  // 7. 착용 제한 (필요한 조건이 있을 때만)
  const reqText = weaponRequirementText(type);
  if(reqText) html += wtipRow('착용 제한 :', reqText);

  html += `</div>`;
  return html;
}
// ---- 방어구 스탯 조회 · 툴팁 ----
function armorKindLabel(type){ return ARMOR_KINDS[wpn(type).armorKind] || ''; }
function defenseFor(type, level){ const w = wpn(type); return w.defArr ? w.defArr[level] : null; }
function armorHpFor(type, level){ const w = wpn(type); return w.hpArr ? w.hpArr[level] : null; }
function armorManaFor(type, level){ const w = wpn(type); return w.manaArr ? w.manaArr[level] : null; }
// 방어구 툴팁: 무기 툴팁(buildWeaponTooltipHtml)과 동일한 레이아웃/서식(이름·등급 색상 효과, wtipRow
// 구조)을 그대로 재사용하되("장비 전역 설정" — 등급 색상/이름 색상/중앙 정렬 서식 공용), 표시 항목만
// 방어구 데이터 스키마에 맞게 구성함: 이름/등급/장비 설명/방어구 종류/방어도/체력/마나/(고유 옵션)/레벨 제한.
function buildArmorTooltipHtml(type, level, damaged){
  const a = wpn(type);
  const grade = WEAPON_GRADES[a.grade];
  const lvl = level != null ? level : 0;
  let html = `<div style="text-align:center;">`;

  const nameLine = a.name + (damaged ? '(손상)' : '') + levelSuffix(lvl);
  html += `<div style="color:${weaponNameColor(type, lvl)}; font-weight:700; margin-bottom:2px;">${nameLine}</div>`;
  if(grade) html += `<div style="color:${weaponGradeColor(type)}; font-weight:700; margin-bottom:4px;">${grade.label}</div>`;
  if(a.desc) html += `<div style="color:var(--forge-cream-dim); margin-bottom:2px;">${a.desc}</div>`;

  const kindLabel = armorKindLabel(type);
  if(kindLabel) html += wtipRow('', kindLabel);

  const def = defenseFor(type, lvl);
  if(def != null) html += wtipRow('방어도', def);
  const hp = armorHpFor(type, lvl);
  if(hp != null) html += wtipRow('체력', hp);
  const mana = armorManaFor(type, lvl);
  if(mana != null) html += wtipRow('마나', mana);

  // 고유 옵션(있으면) — weaponUniqueOptionTooltipHtml은 wpn(type).uniqueOption만 참조하는 범용 함수라
  // 방어구에도 그대로 재사용 가능함(무기 전용 필드 미참조).
  html += weaponUniqueOptionTooltipHtml(type, lvl);

  if(a.levelReq && a.levelReq > 1) html += wtipRow('레벨 제한 :', `레벨 ${a.levelReq} 이상`);

  html += `</div>`;
  return html;
}
// 소비 아이템(플라스크 등) 툴팁: 무기/방어구 툴팁과 동일한 레이아웃/서식(중앙 정렬, wtipRow 구조)을 그대로
// 재사용하되, 표시 항목은 이름/종류(class)/효과(effectText)/구매 가격 4가지로 단순화함(등급·레벨 제한 등
// 장비 전용 필드는 소비 아이템에 없으므로 표시하지 않음).
function buildConsumableTooltipHtml(id){
  const item = CONSUMABLES[id];
  if(!item) return '';
  let html = `<div style="text-align:center;">`;
  html += `<div style="color:var(--forge-cream); font-weight:700; margin-bottom:4px;">${item.name}</div>`;
  if(item.class) html += wtipRow('', item.class);
  if(item.effectText) html += wtipRow('효과', item.effectText);
  if(item.buyPrice != null) html += wtipRow('구매 가격', item.buyPrice);
  html += `</div>`;
  return html;
}
// 최종 데미지 비율 = {(200 + 방어도) / 20}² × 0.01. 방어도는 음수/양수 모두 사용 가능(양수면 피해 증가).
// 결과는 퍼센트 기준 소수 둘째 자리에서 반올림(비율로는 소수 넷째 자리). 플레이어/몬스터 공용 공식으로
// 설계됨 — 플레이어(착용 방어구 합산)와 몬스터(데이터에 등록된 방어도) 양쪽 모두 이 함수를 그대로 사용함.
// ※ 기획 문서의 예시(방어도 -12 → 72.25%)는 이 식을 그대로 계산하면 88.36%가 나와 문서 예시와
// 어긋남 — 식 자체는 문서에 적힌 그대로 구현했고, 예시 쪽 오탈자로 보여 별도로 알려드림.
function defenseDamageMultiplier(defense){
  const raw = Math.pow((200 + (defense || 0)) / 20, 2) * 0.01;
  return Math.round(raw * 10000) / 10000;
}
// 몬스터 개체(전투 인스턴스)의 방어도. 데이터(MONSTERS)에 등록된 값을 그대로 사용하고,
// 방어도가 등록되지 않은 몬스터는 0으로 처리(몬스터 방어도 시스템 — 방어도 기본값 규칙).
function monsterDefenseFor(instance){
  const def = MONSTERS[instance.monsterId];
  return (def && def.defense) || 0;
}
// 현재 착용 중인 방어구(투구/갑옷) 아이템 목록을 반환.
function wornArmorItems(){
  const list = [];
  if(!state.equippedArmor) return list;
  ['helmet', 'armor'].forEach(kind => {
    const id = state.equippedArmor[kind];
    if(!id) return;
    const item = (state.armorInventory || []).find(i => i.id === id);
    if(item) list.push(item);
  });
  return list;
}
// 현재 착용 중인 장신구(반지 등, 최대 2개) 아이템 목록을 반환.
function wornAccessoryItems(){
  if(!Array.isArray(state.equippedAccessories)) return [];
  return state.equippedAccessories
    .filter(id => id != null)
    .map(id => (state.accessoryInventory || []).find(i => i.id === id))
    .filter(Boolean);
}
// 현재 착용 중인 보조 아이템(방패/보조 무기, 최대 1개) — 있으면 배열에 담아 반환(없으면 빈 배열).
// 방어구/장신구와 동일한 "배열로 통일해서 반환" 규칙을 따름(wornEquipmentItems에서 그대로 합쳐 쓰기 위함).
function wornSubItems(){
  if(state.equippedSubId == null) return [];
  const item = (state.subInventory || []).find(i => i.id === state.equippedSubId);
  return item ? [item] : [];
}
// ---- 양손 검 ↔ 보조 아이템 상호 배타 조건 ----
// "양손 검을 장착한 경우에만" 보조 아이템 착용이 막히므로, 현재 착용 무기(실제 전투에 쓰이는 무기,
// state.equippedId)의 weaponKind만 확인함(강화 대상 선택 상태인 forgeTargetId와는 무관).
function isTwoHandedWeaponEquipped(){
  const equipped = getEquippedWeapon();
  return !!(equipped && wpn(equipped.type).weaponKind === 'two_handed_sword');
}
// 보조 아이템을 새로 착용할 수 있는지 — 양손 검을 장착하지 않은 경우에만 가능.
function canEquipSubItem(){ return !isTwoHandedWeaponEquipped(); }
// 양손 검을 장착(강화 선택 = equipItem)할 수 있는지 — 보조 아이템을 착용하지 않은 경우에만 가능.
// 양손 검이 아닌 무기(검/단검/지팡이)는 이 조건과 무관하게 항상 착용 가능함(equipItem에서 무기 종류를
// 먼저 확인한 뒤에만 이 함수를 호출).
function canEquipTwoHandedWeapon(){ return state.equippedSubId == null; }
// 방어도/체력/마나/치명타 보너스에 실제로 기여하는 "착용 중인 모든 방어형 장비"(방어구+보조+장신구) 목록.
// 무기는 포함하지 않음(무기는 별도의 effectiveAtk 등으로 처리됨).
function wornEquipmentItems(){ return wornArmorItems().concat(wornSubItems()).concat(wornAccessoryItems()); }
// 착용 중인 방어구+장신구+아티팩트 전체의 방어도 합산.
function playerTotalDefense(){
  return wornEquipmentItems().reduce((sum, item) => sum + (defenseFor(item.type, item.level) || 0), 0)
    + artifactDefenseBonus(); // 사각 방패 등 방어도를 갖는 아티팩트 합산
}
// 착용 중인 방어구+장신구 전체의 체력/마나/치명타 보너스 합산. key: 'hp' | 'mana' | 'crit'
function armorStatBonus(key){
  return wornEquipmentItems().reduce((sum, item) => {
    let val;
    if(key === 'hp') val = armorHpFor(item.type, item.level);
    else if(key === 'mana') val = armorManaFor(item.type, item.level);
    else if(key === 'crit') val = wpn(item.type).crit ? critChanceFor(item.type, item.level) : null;
    return sum + (val || 0);
  }, 0);
}

// ---- 장신구 이름/종류 · 툴팁 ----
function accessoryKindLabel(type){ return ACCESSORY_KINDS[wpn(type).accessoryKind] || ''; }
// 장신구 툴팁: 방어구 툴팁(buildArmorTooltipHtml)과 서식은 동일("장비 전역 설정" 공용)하되, 표시
// 항목만 장신구 데이터 스키마에 맞게 구성함: 이름/등급/장비 설명/장신구 종류/방어도/체력/마나/치명타
// 확률/(고유 옵션)/착용 제한(문서에 명시된 그대로 "착용 제한 : 레벨 N 이상" 형식 사용).
function buildAccessoryTooltipHtml(type, level, damaged){
  const a = wpn(type);
  const grade = WEAPON_GRADES[a.grade];
  const lvl = level != null ? level : 0;
  let html = `<div style="text-align:center;">`;

  const nameLine = a.name + (damaged ? '(손상)' : '') + levelSuffix(lvl);
  html += `<div style="color:${weaponNameColor(type, lvl)}; font-weight:700; margin-bottom:2px;">${nameLine}</div>`;
  if(grade) html += `<div style="color:${weaponGradeColor(type)}; font-weight:700; margin-bottom:4px;">${grade.label}</div>`;
  if(a.desc) html += `<div style="color:var(--forge-cream-dim); margin-bottom:2px;">${a.desc}</div>`;

  const kindLabel = accessoryKindLabel(type);
  if(kindLabel) html += wtipRow('', kindLabel);

  const def = defenseFor(type, lvl);
  if(def != null) html += wtipRow('방어도', def);
  const hp = armorHpFor(type, lvl);
  if(hp != null) html += wtipRow('체력', hp);
  const mana = armorManaFor(type, lvl);
  if(mana != null) html += wtipRow('마나', mana);
  const crit = wpn(type).crit ? critChanceFor(type, lvl) : null; // crit 배열이 없는 장신구(예: 무색 반지)는 건너뜀
  if(crit != null) html += wtipRow('치명타 확률', crit + '%');

  html += weaponUniqueOptionTooltipHtml(type, lvl); // wpn(type).uniqueOption만 참조하는 범용 함수라 그대로 재사용

  if(a.levelReq && a.levelReq > 1) html += wtipRow('착용 제한 :', `레벨 ${a.levelReq} 이상`);

  html += `</div>`;
  return html;
}
// ---- 보조(방패/보조 무기) 이름/종류 · 툴팁 ----
function subKindLabel(type){ return SUB_KINDS[wpn(type).subKind] || ''; }
// 보조 툴팁: 장신구 툴팁(buildAccessoryTooltipHtml)과 서식은 동일("장비 전역 설정" 공용)하되, 치명타
// 확률 항목은 보조 아이템 스키마에 없으므로 표시하지 않음. 출력 순서(문서 4번 규칙): 이름/등급/장비
// 설명/보조 종류/방어도/체력/마나/(고유 옵션)/착용 제한.
function buildSubTooltipHtml(type, level, damaged){
  const a = wpn(type);
  const grade = WEAPON_GRADES[a.grade];
  const lvl = level != null ? level : 0;
  let html = `<div style="text-align:center;">`;

  const nameLine = a.name + (damaged ? '(손상)' : '') + levelSuffix(lvl);
  html += `<div style="color:${weaponNameColor(type, lvl)}; font-weight:700; margin-bottom:2px;">${nameLine}</div>`;
  if(grade) html += `<div style="color:${weaponGradeColor(type)}; font-weight:700; margin-bottom:4px;">${grade.label}</div>`;
  if(a.desc) html += `<div style="color:var(--forge-cream-dim); margin-bottom:2px;">${a.desc}</div>`;

  const kindLabel = subKindLabel(type);
  if(kindLabel) html += wtipRow('', kindLabel);

  const def = defenseFor(type, lvl);
  if(def != null) html += wtipRow('방어도', def);
  const hp = armorHpFor(type, lvl);
  if(hp != null) html += wtipRow('체력', hp);
  const mana = armorManaFor(type, lvl);
  if(mana != null) html += wtipRow('마나', mana);

  html += subUniqueOptionTooltipHtml(type, lvl); // 보조 아이템 전용: 고정 옵션 여러 개는 쉼표 기준 한 줄씩 출력(요청사항)

  if(a.levelReq && a.levelReq > 1) html += wtipRow('착용 제한 :', `레벨 ${a.levelReq} 이상`);

  html += `</div>`;
  return html;
}
// ---- 아티팩트 이름 색상 · 툴팁 ----
// 등급 가치 시스템(WEAPON_GRADES)을 그대로 재사용. 아티팩트는 강화 단계가 없으므로 무기처럼
// "강화 단계 색상과 비교해 더 높은 쪽" 로직 없이 등급 색상을 그대로 이름에 적용함.
function artifactGradeLabel(id){ const a = ARTIFACTS[id]; const g = a && WEAPON_GRADES[a.grade]; return g ? g.label : ''; }
function artifactGradeColor(id){ const a = ARTIFACTS[id]; const g = a && WEAPON_GRADES[a.grade]; return g ? g.color : '#ffffff'; }
function artifactNameColor(id){ return artifactGradeColor(id); }
// 아티팩트 툴팁: 레이아웃/줄바꿈/서식(라벨-값 구성 등)은 buildWeaponTooltipHtml과 동일하게 유지하고,
// 표시 항목은 이름 / 장비 설명 / 장비 타입(값만, 라벨 없음) / 효과 설명(값만, 라벨 없음) / 상점 구매 가격으로 구성함.
// 등급 행은 아티팩트 툴팁에서만 표시하지 않음(이름 색상에 이미 등급이 반영되어 있음). 이 규칙은 이 함수(아티팩트)에만
// 적용되며, 무기/마석/기타 아이템 툴팁(buildWeaponTooltipHtml 등)에는 영향을 주지 않음. 새로 추가되는 아티팩트도
// ARTIFACTS 데이터만 등록하면 이 함수를 그대로 거치므로 동일한 규칙이 자동 적용됨.
function buildArtifactTooltipHtml(id){
  const a = ARTIFACTS[id];
  if(!a) return '';
  let html = `<div style="text-align:center;">`;

  // 1. 이름 — 아티팩트 등급 색상 효과 적용
  html += `<div style="color:${artifactNameColor(id)}; font-weight:700; margin-bottom:2px;">${a.name}</div>`;

  // 2. 장비 설명
  if(a.desc) html += `<div style="color:var(--forge-cream-dim); margin-bottom:4px;">${a.desc}</div>`;

  // 3. 장비 타입 (라벨 없이 값만 출력)
  html += wtipRow('', EQUIPMENT_TYPES[a.equipType] || '');

  // 4. 효과 설명 (라벨 없이 값만 출력)
  if(a.effectText) html += wtipRow('', a.effectText);

  // 5. 상점 구매 가격 (공란이면 표시하지 않음)
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
// 기타(misc) 아이템 이름 색상: 마석과 동일하게 무기 등급 색상 공식(WEAPON_GRADES)을 그대로 재사용함.
function miscGradeInfo(id){ return WEAPON_GRADES[MISC_ITEMS[id].grade]; }
function miscNameColor(id){ const g = miscGradeInfo(id); return g ? g.color : '#ffffff'; }
// 기타(misc) 아이템 툴팁: 이름 텍스트 색상에만 등급 공식(miscNameColor)을 적용하고, 나머지 표시 항목
// (설명/아이템 분류/판매 가격)과 레이아웃/서식은 등급 추가 이전과 동일하게 유지함 — 마석 툴팁과 달리
// 등급을 별도 줄로 표시하지 않음.
function buildMiscTooltipHtml(id){
  const item = MISC_ITEMS[id];
  let html = `<div style="text-align:center;">`;

  // 1. 이름 — 등급 색상 효과 적용
  html += `<div style="color:${miscNameColor(id)}; font-weight:700; margin-bottom:2px;">${item.name}</div>`;

  // 2. 설명
  if(item.desc) html += `<div style="color:var(--forge-cream-dim); margin-bottom:2px;">${item.desc}</div>`;

  // 3. 아이템 분류
  html += wtipRow('아이템 분류', ITEM_CLASS_LABELS[item.itemClass] || '');

  // 4. 판매 가격 — 기존 아이템과 동일한 형식(G 단위, 천단위 구분)
  html += wtipRow('판매 가격', item.sellPrice.toLocaleString() + 'G');

  html += `</div>`;
  return html;
}
// ---- 무기 고유 옵션(에픽/유니크 전용) ----
// 활성화 조건(강화 단계)을 만족하는지는 항상 "현재 강화 단계"를 기준으로 그때그때 판단함(별도 상태 저장 없음) —
// 강화 단계가 활성화 조건 아래로 내려가면 즉시 비활성화되고, 다시 조건을 만족하면 다시 활성화됨.
function weaponUniqueOptionActive(type, level){
  const opt = wpn(type).uniqueOption;
  return !!(opt && level >= opt.activateLevel);
}
// 고유 옵션의 현재 발동 수치(%). 아직 활성화 조건(activateLevel) 미만이라면, 툴팁 미리보기용으로
// 활성화 조건 시점의 수치를 대신 반환함(비활성 상태에서도 "몇 %짜리 옵션인지"는 미리 보여줘야 하므로).
// opt.text가 있는 고정형 옵션은 성장 수치 자체가 없으므로 null(호출부는 opt.text로 별도 처리함).
function weaponUniqueOptionChance(type, level){
  const opt = wpn(type).uniqueOption;
  if(!opt || !opt.chanceByLevel) return null;
  const lookupLevel = level >= opt.activateLevel ? level : opt.activateLevel;
  return opt.chanceByLevel[lookupLevel] != null ? opt.chanceByLevel[lookupLevel] : null;
}
// 무기 툴팁에 표시할 고유 옵션 줄. 고유 옵션이 없는 무기는 빈 문자열을 반환(줄 자체가 생기지 않음).
// 활성화 상태: 기존 무기 툴팁 서식(값 노란색)을 그대로 사용하고 활성화 조건 안내는 표시하지 않음.
// 비활성화 상태: 회색 텍스트로 표시하고, "(+N 활성화)" 조건 안내를 아래 줄에 덧붙임.
// opt.text가 있는 "고정형" 고유 옵션(성장치 없이 항상 같은 문구, 반월대도 등)은 chanceByLevel/
// textTemplate 없이 이 문구를 그대로 사용함 — 활성화 여부 판단(activateLevel)과 회색/조건문구 서식은
// 성장형 옵션과 완전히 동일하게 재사용됨.
// simplifyUniqueOptionTooltipText: 툴팁 "표시상"으로만 "최대 " 접두어를 생략(예: "최대 체력"→"체력",
// "최대 마나"→"마나"). 실제 적용되는 능력치(opt.statBonus 등)는 이 함수를 거치지 않으므로 전혀 영향 없음.
// data.js에 등록된 opt.text/textTemplate 원본 문구는 그대로 두고, 여기 한 곳에서만 표시 문구를 가공하므로
// 앞으로 추가되는 고유 옵션도 "최대 XX" 형태로만 적으면 개별 수정 없이 자동으로 이 규칙이 적용됨.
function simplifyUniqueOptionTooltipText(text){
  return text.replace(/최대 /g, '');
}
function weaponUniqueOptionTooltipHtml(type, level){
  const opt = wpn(type).uniqueOption;
  if(!opt) return '';
  const active = weaponUniqueOptionActive(type, level);
  const rawText = opt.text != null ? opt.text : (() => {
    const chance = weaponUniqueOptionChance(type, level);
    return chance != null ? opt.textTemplate.replace('{chance}', chance) : null;
  })();
  if(rawText == null) return '';
  const text = simplifyUniqueOptionTooltipText(rawText);
  if(active) return wtipRow('', text);
  return `<div style="color:var(--forge-cream-dim); margin-bottom:2px;">${text}<br>(+${opt.activateLevel} 활성화)</div>`;
}
// 보조 아이템 전용 고유 옵션 툴팁: weaponUniqueOptionTooltipHtml과 완전히 동일한 로직이되, opt.text가
// 쉼표(,)로 여러 옵션을 나열한 경우(예: "힘 +1, 지능 +1") 한 줄에 몰아 쓰지 않고 쉼표 기준으로 나눠
// 한 줄씩 출력함(요청사항 — 보조 아이템 툴팁에만 적용, 무기/방어구/장신구는 원래 함수를 그대로 씀).
// 옵션이 1개뿐이면(쉼표 없음) split 결과가 1개짜리 배열이라 기존과 동일하게 한 줄로 출력됨.
// 실제 능력치 적용(statBonus 등)이나 활성화 조건(activateLevel)에는 전혀 관여하지 않음 — 표시 문구만 가공.
function subUniqueOptionTooltipHtml(type, level){
  const opt = wpn(type).uniqueOption;
  if(!opt) return '';
  const active = weaponUniqueOptionActive(type, level);
  const rawText = opt.text != null ? opt.text : (() => {
    const chance = weaponUniqueOptionChance(type, level);
    return chance != null ? opt.textTemplate.replace('{chance}', chance) : null;
  })();
  if(rawText == null) return '';
  const text = simplifyUniqueOptionTooltipText(rawText);
  const lines = text.split(',').map(s => s.trim()).filter(Boolean);
  if(active) return lines.map(line => wtipRow('', line)).join('');
  return `<div style="color:var(--forge-cream-dim); margin-bottom:2px;">${lines.join('<br>')}<br>(+${opt.activateLevel} 활성화)</div>`;
}
// 같은 효과(effectId)를 가진 모든 "현재 활성 상태인" 소스(아티팩트 + 장착 무기의 고유 옵션)의 발동 확률을 합산.
// 동일 효과는 소스마다 따로 판정하지 않고, 이렇게 합산된 확률로 단 1회만 판정함.
// 새 효과/소스가 추가될 때는 이 함수에 조건만 덧붙이면 됨(호출하는 쪽 로직은 그대로 유지).
function activeEffectChance(effectId){
  let total = 0;
  if(effectId === 'poison_on_hit' && isArtifactEquipped('poisonflask')) total += 5;
  const equipped = getEquippedWeapon(); // 전투 중 발동하는 무기 고유 옵션이므로 실제 착용 무기 기준
  if(equipped){
    const opt = wpn(equipped.type).uniqueOption;
    if(opt && opt.effectId === effectId && weaponUniqueOptionActive(equipped.type, equipped.level)){
      total += weaponUniqueOptionChance(equipped.type, equipped.level) || 0;
    }
  }
  return total;
}
// 착용 중인 방어구(투구/갑옷)+보조 아이템의 고유 옵션 중 특정 효과(effectId)를 가진 "현재 활성 상태인"
// 소스의 발동 확률을 합산. activeEffectChance(무기 고유 옵션 전용, 공격 적중 시 발동)와 트리거 시점이 달라
// 별도 함수로 둠 — 이 함수는 "피격 시 발동"하는 방어형 장비 계열 효과(백현갑 등)를 대상으로 함. 보조
// 아이템도 방어구와 함께 착용하는 방어형 장비라 동일하게 이 함수의 대상에 포함됨. 여러 부위에 같은
// effectId가 있어도(현재는 사례 없음) 정상적으로 합산됨.
function armorUniqueOptionChance(effectId){
  return wornArmorItems().concat(wornSubItems()).reduce((sum, item) => {
    const opt = wpn(item.type).uniqueOption;
    if(opt && opt.effectId === effectId && weaponUniqueOptionActive(item.type, item.level)){
      return sum + (weaponUniqueOptionChance(item.type, item.level) || 0);
    }
    return sum;
  }, 0);
}
// 착용 무기 고유 옵션 중 "대상 상태 이상 조건부 피해 증가" 계열 효과(예: 팔각비도 — 중독 대상 추가
// 피해)의 배율. 대상이 해당 상태 이상을 갖고 있을 때만 발동하며, 방어도 계산까지 끝난 피해량에 곱하는
// 단계(피해량 계산 순서 6번, formulas.js 상단 "피해량 계산 순서(전역 기준)" 참고)에서 사용됨.
// 조건을 만족하는 무기 고유 옵션이 없으면 1(배율 없음)을 반환 — 무조건 중독 대상에게 추가 피해를
// 주는 것이 아니라, 이 effectId를 가진 무기(팔각비도)를 착용하고 있을 때만 발동함.
function targetStatusDamageMultiplier(target){
  const equipped = getEquippedWeapon();
  if(!equipped) return 1;
  const opt = wpn(equipped.type).uniqueOption;
  if(!opt || opt.effectId !== 'poison_target_damage_percent') return 1;
  if(!weaponUniqueOptionActive(equipped.type, equipped.level)) return 1;
  const hasPoison = !!(target.statusEffects && target.statusEffects.some(s => s.key === 'poison'));
  if(!hasPoison) return 1;
  const percent = weaponUniqueOptionChance(equipped.type, equipped.level) || 0;
  return 1 + percent / 100;
}
// 치명타 피해 배율(기존 로직의 1.5배 고정값을 그대로 가져와 하나로 통합) — 화상처럼 데이터에
// critDamageBonusPercent가 설정된 dot 상태 이상이 대상에게 걸려있으면 해당 값을 합연산(%p)으로
// 가산함(요구사항 4번: 150%+20%p=170%, 곱연산 아님). 화상이 없는 대상은 기존과 완전히 동일하게 150%.
// 다른 상태 이상(중독/기절/둔화)은 이 필드가 없으므로 치명타 배율에 전혀 영향을 주지 않음.
const BASE_CRIT_MULTIPLIER = 1.5;
function critMultiplierFor(target){
  let bonusPercent = 0;
  if(target && target.statusEffects){
    target.statusEffects.forEach(s => {
      const def = STATUS_EFFECTS[s.key];
      if(def && def.critDamageBonusPercent) bonusPercent += def.critDamageBonusPercent;
    });
  }
  return BASE_CRIT_MULTIPLIER + bonusPercent / 100;
}
function atkFor(type, level){ return wpn(type).atk[level]; }

// ---- 강화 화면의 고유 옵션 표시(현재 단계 → 다음 단계 미리보기) ----
// uniqueOption이 있는 무기라면 자동으로 이 함수가 호출되어 강화 화면에 항목이 표시됨(무기별 개별 코드 없음).
// textTemplate 작성 규칙: "{chance}%" 형태로 붙여서 써야 함(예: '...{chance}% 확률로...') — 수치가 다음 단계에서
// 오르는 경우 "{chance}%" 부분 전체를 formatStatDelta 결과(화살표+증가량 표시)로 치환하기 때문.
// opt.text가 있는 "고정형" 고유 옵션(반월대도처럼 강화해도 수치가 오르지 않는 경우)은 성장 로직을 전부
// 건너뛰고 항상 같은 문구만 보여줌 — 활성화 여부(activateLevel) 판단과 회색/안내문구 서식은 성장형과
// 동일하게 재사용됨. 앞으로 추가되는 고정형 고유 옵션 무기도 opt.text만 채우면 자동으로 이 분기를 탐.
// 반환값이 null이면 무기에 고유 옵션이 없다는 뜻 — 호출부(render.js)에서 이 값으로 표시 여부를 결정함.
function weaponUniqueOptionForgeHtml(type, level){
  const opt = wpn(type).uniqueOption;
  if(!opt) return null;

  const activeNow = weaponUniqueOptionActive(type, level);
  const hasNext = level < MAX_LEVEL;
  const activeNext = hasNext ? weaponUniqueOptionActive(type, level+1) : activeNow;

  if(opt.text != null){
    if(activeNow) return `<div style="color:var(--forge-cream);">${opt.text}</div>`;
    const note = activeNext ? '고유 옵션 활성화' : `+${opt.activateLevel} 달성 시 활성화`;
    return `<div style="color:var(--forge-cream-dim);">${opt.text}</div><div style="color:var(--forge-cream-dim); font-size:11.5px; margin-top:2px;">${note}</div>`;
  }

  const chanceNow = weaponUniqueOptionChance(type, level);
  const chanceNext = hasNext ? weaponUniqueOptionChance(type, level+1) : null;

  if(activeNow){
    // 이미 활성화된 상태 — 다음 단계에서 수치가 오르면 값 자리에 화살표+증가량만 표시하고(안내 문구 없음),
    // 수치가 그대로면 평소 무기 툴팁과 동일하게 안내 문구 없이 고정 수치만 표시함.
    const changed = chanceNext != null && chanceNext !== chanceNow;
    const valueHtml = changed
      ? formatStatDelta(chanceNow, chanceNext, 0, '%')
      : (chanceNow + '%');
    const text = opt.textTemplate.replace('{chance}%', valueHtml);
    return `<div style="color:var(--forge-cream);">${text}</div>`;
  }

  // 아직 비활성화 상태 — 활성화 조건 시점의 미리보기 수치를 회색으로 보여줌(무기 툴팁과 동일한 값).
  const text = opt.textTemplate.replace('{chance}', chanceNow);
  const note = activeNext
    ? '고유 옵션 활성화' // 지금 강화하면(다음 단계에서) 바로 활성화되는 경우
    : `+${opt.activateLevel} 달성 시 활성화`; // 아직 활성화까지 강화가 더 필요한 경우
  return `<div style="color:var(--forge-cream-dim);">${text}</div><div style="color:var(--forge-cream-dim); font-size:11.5px; margin-top:2px;">${note}</div>`;
}
function atkSpeedFor(type, level){ return wpn(type).speed[level]; }
function critChanceFor(type, level){ return wpn(type).crit[level]; }
function costFor(type, level){ return wpn(type).cost[level]; }
function sellValueFor(type, level){ return wpn(type).sell[level]; }
function oddsFor(type, level){ return wpn(type).odds[level]; }

// ---- 강화 화면 스탯 표시(데이터 기반, 하드코딩 없음) ----
// 강화 화면에서 선택된 장비가 무기든 방어구든 상관없이, 도감 데이터에 해당 강화단계별 배열이 있는
// 옵션만 자동으로 표시함. arrKey는 wpn(type) 위의 실제 배열 필드명(atkFor 등 기존 접근자와 동일한
// 필드를 그대로 참조 — 새 필드를 만들지 않음). 순서 = 공격력→공격속도→치명타 확률→방어도→체력→마나.
const FORGE_STAT_FIELDS = [
  { arrKey: 'atk',     label: '공격력',      decimals: null, suffix: '' },
  { arrKey: 'speed',   label: '공격속도',    decimals: 2,    suffix: '' },
  { arrKey: 'crit',    label: '치명타 확률', decimals: null, suffix: '%' },
  { arrKey: 'defArr',  label: '방어도',      decimals: null, suffix: '' },
  { arrKey: 'hpArr',   label: '체력',        decimals: null, suffix: '' },
  { arrKey: 'manaArr', label: '마나',        decimals: null, suffix: '' },
];
// 현재 선택된 장비(type, level)에 대해, 데이터에 실제로 존재하는 옵션만 "현재 수치 → 다음 단계 수치"
// 행으로 조립해서 반환. 증가량 색상/기호는 기존 formatStatDelta를 그대로 재사용(요청사항: 그대로 사용).
function buildForgeStatRowsHtml(type, level){
  const w = wpn(type);
  let html = '';
  FORGE_STAT_FIELDS.forEach(f => {
    const arr = w[f.arrKey];
    if(!arr || arr[level] == null) return; // 이 장비 데이터에 해당 옵션이 없으면 행 자체를 생략
    const now = arr[level];
    const next = level < MAX_LEVEL ? (arr[level + 1] != null ? arr[level + 1] : null) : null;
    html += `<div class="stat-row"><span>${f.label} <b>${formatStatDelta(now, next, f.decimals, f.suffix)}</b></span></div>`;
  });
  return html;
}

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
// 탭 id로 해당 탭에 표시할 정규화된 아이템 목록을 조회. 새 탭이 SHOP_TABS(의 subTabs 포함)에
// 추가되면 이 분기도 함께 추가.
function shopEntriesForTab(tabId){
  if(tabId === 'weapon') return shopEquipmentEntries(WEAPON_TYPES);
  if(tabId === 'armor') return shopEquipmentEntries(ARMOR_TYPES);
  if(tabId === 'sub') return shopEquipmentEntries(SUB_TYPES);
  if(tabId === 'accessory') return shopEquipmentEntries(ACCESSORY_TYPES);
  if(tabId === 'consumable') return shopConsumableEntries();
  if(tabId === 'artifact') return shopArtifactEntries();
  if(tabId === 'stone') return shopStoneEntries();
  if(tabId === 'misc') return shopMiscEntries();
  return [];
}
// 상점/인벤토리 공용: leafId(실제 표시 중인 탭, 예: 'weapon')가 속한 최상위 탭 id를 반환(예: 'equipment').
// leafId 자체가 이미 최상위 탭(subTabs가 없는 탭, 예: 'consumable')이면 그대로 반환. 최상위 탭 버튼의
// active 표시와 하위탭 행 노출 여부를 결정하는 데 공용으로 사용됨(SHOP_TABS/INVENTORY_TABS 둘 다 동일한
// { id, label, subTabs? } 구조를 쓰므로 같은 함수로 처리 가능).
function topTabIdFor(topTabsList, leafId){
  for(const t of topTabsList){
    if(t.id === leafId) return t.id;
    if(t.subTabs && t.subTabs.some(st => st.id === leafId)) return t.id;
  }
  return leafId;
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
  let exponent;
  if(level <= 49) exponent = 1.05;
  else if(level <= 79) exponent = 1.10;
  else if(level <= 89) exponent = 1.12;
  else exponent = 1.30;
  return Math.round(10 + Math.pow(level - 1, exponent));
}
function requiredExp(level){
  return monsterExp(level) * requiredKills(level);
}

// ---- 스킬 시스템 — 포인트 공식 ----
// 공용/특화가 공유하는 스킬 포인트의 "레벨까지 누적 지급량"(레벨1 + 5레벨 단위마다 1개: LV1,5,10,15...).
function totalSkillPointsForLevel(lv){
  if(lv < 1) return 0;
  return 1 + Math.floor(lv / 5);
}
// 기연(깨달음)의 "레벨까지 누적 지급량"(10레벨 단위 LV10~90마다 1개 + LV99 도달 시 예외적으로 2개 추가).
function totalAwakeningPointsForLevel(lv){
  if(lv < 1) return 0;
  return Math.floor(Math.min(lv, 90) / 10) + (lv >= 99 ? 2 : 0);
}
// 레벨업 시 이번 레벨에서 실제로 지급되는 증가분(마일스톤이 아닌 레벨이면 0).
function skillPointsGrantedAtLevel(lv){
  return totalSkillPointsForLevel(lv) - totalSkillPointsForLevel(lv - 1);
}
function awakeningPointsGrantedAtLevel(lv){
  return totalAwakeningPointsForLevel(lv) - totalAwakeningPointsForLevel(lv - 1);
}
// 분류(공용/특화/기연)별 스킬 포인트 마일스톤 레벨 목록. 공용/특화는 위 공식과 동일하게 LV1,5,10,...,95,99
// 이고, 기연은 LV10,20,...,90,99. 캐릭터 메뉴 스킬 탭의 "레벨별 스킬 목록" 행이 이 레벨들을 그대로 사용함.
function skillMilestoneLevels(categoryId){
  const levels = [];
  if(categoryId === 'awakening'){
    for(let lv = 10; lv <= 90; lv += 10) levels.push(lv);
  } else {
    levels.push(1);
    for(let lv = 5; lv <= 95; lv += 5) levels.push(lv);
  }
  levels.push(PLAYER_MAX_LEVEL); // 99는 항상 예외적으로 마지막에 단독 포함
  return levels;
}
// 스킬 탭의 한 페이지(SKILL_PAGES[pageIdx-1])에 표시할 레벨 목록(해당 분류의 마일스톤 레벨 중 그 구간에
// 속하는 것만). 페이지가 늘어나거나 마일스톤 공식이 바뀌어도 이 함수는 그대로 동작함.
function levelsForSkillPage(categoryId, pageIdx){
  const range = SKILL_PAGES[pageIdx - 1];
  if(!range) return [];
  return skillMilestoneLevels(categoryId).filter(lv => lv >= range.min && lv <= range.max);
}
// 습득 여부 조회 — 공용/특화는 learnedSkills, 기연은 learnedAwakeningSkills를 봄(분류별로 완전히 별도 목록).
// 스킬 업그레이드(요구사항 3번)로 상위 스킬을 습득하면 하위 스킬은 이 목록에서 제거되므로, 하위 스킬은
// 업그레이드 이후 여기서 false를 반환함(= 진짜 소유 여부). 목록 화면에 "습득된 것처럼" 보여주는 표시는
// 아래 isSkillDisplayedAsLearned가 별도로 처리함 — 습득 가능 판정(canLearnSkill)·퀵슬롯 등록 후보 목록은
// 전부 이 함수(실제 소유 여부)만 그대로 사용해야 하므로 손대지 않음.
function isSkillLearned(id){
  const s = SKILLS[id];
  if(!s) return false;
  const list = s.category === 'awakening' ? state.learnedAwakeningSkills : state.learnedSkills;
  return Array.isArray(list) && list.includes(id);
}
// 이 스킬(id)이 이미 상위 스킬로 교체되어 사라진 상태인지 판정 — 지금 실제로 보유 중인 스킬들의
// upgradeFrom 체인을 거슬러 올라가며 id가 그 체인 안에 있으면 true. 스킬 업그레이드 요구사항 3번(하위
// 스킬 제거+상위 스킬 교체) 이후 하위 스킬 아이콘을 다시 클릭해 재습득하는 것을 막기 위한 용도(아래
// canLearnSkill에서 사용) — 여러 단계 업그레이드(요구사항 5번)도 while로 체인을 끝까지 따라가 자동 처리됨.
function isSkillSupersededByUpgrade(id){
  const s = SKILLS[id];
  const list = s && s.category === 'awakening' ? state.learnedAwakeningSkills : state.learnedSkills;
  if(!Array.isArray(list)) return false;
  return list.some(learnedId => {
    let cur = SKILLS[learnedId];
    while(cur && cur.upgradeFrom){
      if(cur.upgradeFrom === id) return true;
      cur = SKILLS[cur.upgradeFrom];
    }
    return false;
  });
}
// 스킬 목록 화면에서 "습득된 것으로" 표시할지 판정(요구사항 3번 괄호: "스킬 레이아웃에는 하위 스킬도
// 습득된 것으로 표시하나 퀵슬롯에 등록할 수는 없게") — 진짜 소유(isSkillLearned) 또는 상위 스킬로
// 교체되어 사라진 하위 스킬(isSkillSupersededByUpgrade)이면 화면 표시용으로만 true. 퀵슬롯 등록 후보
// 목록(openSkillQuickSlotPicker)은 state.learnedSkills를 직접 훑으므로 교체된 하위 스킬은 애초에
// 목록에 없어 자동으로 등록 불가 상태가 유지됨 — 별도 처리 불필요.
function isSkillDisplayedAsLearned(id){
  return isSkillLearned(id) || isSkillSupersededByUpgrade(id);
}
// 스킬 종류(공격/버프/패시브) 자동 판정 — 요구사항 3번 규칙을 그대로 코드화:
// 1) 소모 자원이 없으면 패시브, 2) target이 'buff'면 버프, 3) 그 외는 전부 공격.
// 이 순서를 그대로 지켜야 하며(패시브 판정이 우선), 새 스킬을 추가해도 이 함수는 손댈 필요가 없음.
function skillKindOf(skill){
  if(!skill) return 'attack';
  if(!skill.resourceType) return 'passive';
  if(skill.target === 'buff') return 'buff';
  return 'attack';
}
// 공용/특화가 스킬 포인트를 공유하기 때문에 생기는 습득 제한(요구사항 4번, 기획문서 20-6 갱신):
// 같은 레벨 제한 + 같은 종류(공격/버프/패시브)의 스킬은 하나만 습득 가능 — 단, 사용자 요청으로 이 제한은
// 이제 패시브에만 적용됨(같은 레벨의 패시브 스킬끼리만 하나 선택). 공격/버프는 레벨이 같고 종류가 같아도
// 전부 습득 가능하도록 완화됨(예: 사연격/발목 가르기처럼 같은 레벨의 공격 스킬 2종을 동시에 배울 수 있음).
// 기연(awakening)은 별도 포인트를 쓰므로 애초에 이 제한 자체가 적용되지 않음(kind 무관하게 항상 false).
function hasConflictingLearnedSkill(id){
  const s = SKILLS[id];
  if(!s || s.category === 'awakening') return false;
  const kind = skillKindOf(s);
  if(kind !== 'passive') return false;
  return (state.learnedSkills || []).some(otherId => {
    if(otherId === id) return false;
    const other = SKILLS[otherId];
    return other && other.levelReq === s.levelReq && skillKindOf(other) === kind;
  });
}
// ---- 스킬 설명(desc) 변수 자동 치환 ----
// skill 객체 안에서 fieldName 값을 찾음. 최상위 필드(damagePercent, hits 등)를 먼저 보고, 없으면
// buffEffect/passiveEffect/onHitStatus처럼 스킬 안에 중첩된 하위 객체(object 타입 필드) 전체를 뒤져서
// 동일한 이름의 값을 찾음 — 어떤 하위 객체 이름을 쓰든(새 효과 객체가 추가되어도) 자동으로 동작함.
function findSkillFieldValue(skill, fieldName){
  if(!skill) return undefined;
  if(skill[fieldName] !== undefined) return skill[fieldName];
  for(const key in skill){
    const val = skill[key];
    if(val && typeof val === 'object' && !Array.isArray(val) && Object.prototype.hasOwnProperty.call(val, fieldName)){
      return val[fieldName];
    }
  }
  return undefined;
}
// desc 문자열 안의 {변수명}을 실제 데이터 값으로 치환. SKILL_DESC_VAR_ALIAS(data.js)에 등록된 축약 이름이면
// 매핑된 필드명을 쓰고, 없으면 변수명 자체를 필드명으로 바로 찾아본다(특정 스킬 하드코딩 없이 모든 스킬에
// 공통 적용). 데이터에 없는 변수는 에러 없이 원문 {변수명} 그대로 남겨둔다. durationMs처럼 ms 단위인 값은
// SKILL_DESC_SECONDS_FIELDS 목록에 따라 초 단위(예: 2500 → "2.5")로 변환해서 보여준다.
// 쿨타임·소모자원·요구레벨 등 기존 툴팁 항목(buildSkillTooltipHtml)에는 전혀 관여하지 않음 — desc 문자열만 대상.
function resolveSkillDescText(skill){
  if(!skill || !skill.desc) return skill ? skill.desc : '';
  return skill.desc.replace(/\{(\w+)\}/g, (match, varName) => {
    const fieldName = SKILL_DESC_VAR_ALIAS[varName] || varName;
    const raw = findSkillFieldValue(skill, fieldName);
    if(raw === undefined || raw === null) return match;
    if(SKILL_DESC_SECONDS_FIELDS.includes(fieldName) && typeof raw === 'number') return String(raw / 1000);
    return String(raw);
  });
}
// ---- 스킬 툴팁 ----
// 레이아웃/서식은 buildWeaponTooltipHtml·buildArtifactTooltipHtml과 동일한 규칙(wtipRow, 라벨 없는 값은
// wtipRow('', 값))을 그대로 따름. 이름/설명/소모 자원/레벨 제한은 항목명을 생략하고 값만 출력하고,
// 쿨타임만 라벨을 함께 표시함(요구사항 표기 예시와 동일).
function buildSkillTooltipHtml(id){
  const s = SKILLS[id];
  if(!s) return '';
  const grade = WEAPON_GRADES[s.grade];
  let html = `<div style="text-align:center;">`;
  html += `<div style="color:${grade ? grade.color : '#ffffff'}; font-weight:700; margin-bottom:2px;">${s.name}</div>`;
  if(s.desc) html += `<div style="color:var(--forge-cream-dim); margin-bottom:4px;">${resolveSkillDescText(s)}</div>`;
  if(s.cooldown != null) html += wtipRow('쿨타임', s.cooldown + '초');
  if(s.resourceType != null){
    const resourceLabel = s.resourceType === 'hp' ? '체력' : '마나';
    html += wtipRow('', `${resourceLabel} ${s.resourceAmount}`);
  }
  if(s.levelReq != null) html += wtipRow('', 'LV' + s.levelReq);
  // 스킬 업그레이드 요구사항 5-1번: upgradeFrom이 지정된 스킬만 레벨 제한 행 아래에 선행 스킬 습득 조건을
  // 한 줄 더 표시(레이아웃/서식은 위 행들과 동일한 wtipRow 재사용). upgradeFrom이 없는 스킬은 이 행이
  // 아예 없으므로 기존 스킬들의 툴팁 출력은 그대로 유지됨(요구사항 6번).
  if(s.upgradeFrom){
    const prereq = SKILLS[s.upgradeFrom];
    if(prereq) html += wtipRow('', `${prereq.name} 습득 상태`);
  }
  html += `</div>`;
  return html;
}
// 스킬 아이콘 <img> HTML — weaponIconHtml/monsterIconHtml과 동일한 방식. icon 필드가 없으면
// 종류(공격/버프/패시브)에 따른 기본 아이콘(SKILL_DEFAULT_ICON)을 자동으로 적용함(요구사항 5번).
function skillIconHtml(skill, className){
  if(!skill) return '';
  const kind = skillKindOf(skill);
  const file = skill.icon || SKILL_DEFAULT_ICON[kind] || SKILL_DEFAULT_ICON.attack;
  const cls = 'skill-icon-img' + (className ? ' ' + className : '');
  return `<img src="${SKILL_IMAGE_DIR}${file}${SKILL_IMAGE_EXT}" class="${cls}" alt="">`;
}
// 습득한 패시브 스킬의 고정 보너스 합산(요구사항: "별도 사용 없이 항상 적용"). 공용/특화/기연 습득 목록을
// 모두 뒤져 passiveEffect[key]가 있는 스킬을 전부 더함 — 새 패시브 스킬을 추가해도 자동으로 합산됨.
function learnedPassiveSkillBonus(key){
  const allLearned = [...(state.learnedSkills || []), ...(state.learnedAwakeningSkills || [])];
  let total = 0;
  allLearned.forEach(id => {
    const s = SKILLS[id];
    if(s && s.passiveEffect && typeof s.passiveEffect[key] === 'number') total += s.passiveEffect[key];
  });
  return total;
}
// 지금 활성화된 버프 스킬 효과의 합산(요구사항: 분노 등 시간제한 버프). activeSkillBuffs(actions.js, 스킬
// id별로 { ...buffEffect, until }를 담는 런타임 전용 저장소, 저장 대상 아님)를 읽어 만료되지 않은 것만 합산.
function activeBuffBonus(key){
  if(typeof activeSkillBuffs !== 'object' || !activeSkillBuffs) return 0;
  const now = Date.now();
  let total = 0;
  Object.values(activeSkillBuffs).forEach(b => {
    if(b && b.until > now && typeof b[key] === 'number') total += b[key];
  });
  return total;
}
// 지금 습득할 수 있는지(레벨 조건 충족 + 포인트 충분 + 아직 미습득 + 습득 제한에 걸리지 않음). 에픽/유니크는
// 해금 방식이 아직 구현되지 않아(비급/깨달음 소비 예정) 항상 불가로 처리 — SKILLS에 실제 항목이 등록되고
// 해금 로직이 추가되면 이 부분만 손보면 됨.
// 스킬 업그레이드(요구사항 2·7번): upgradeFrom이 지정된 스킬은 기존 레벨 조건에 더해 그 upgradeFrom
// 스킬을 실제로 보유(isSkillLearned) 중이어야만 습득 가능. upgradeFrom이 없는 스킬은 기존 방식 그대로
// 동작(요구사항 7번, 조건 추가 없음). isSkillSupersededByUpgrade 체크는 이미 상위 스킬로 교체되어 화면에만
// "습득됨"으로 표시되는 하위 스킬을 다시 클릭해 재습득하는 것을 막음(교체된 하위 스킬 재습득 방지).
function canLearnSkill(id){
  const s = SKILLS[id];
  if(!s || isSkillLearned(id)) return false;
  if(s.grade === 'epic' || s.grade === 'unique') return false;
  if(s.levelReq && (state.playerLevel || 1) < s.levelReq) return false;
  if(hasConflictingLearnedSkill(id)) return false;
  if(s.upgradeFrom && !isSkillLearned(s.upgradeFrom)) return false;
  if(isSkillSupersededByUpgrade(id)) return false;
  const pool = s.category === 'awakening' ? (state.awakeningPoints || 0) : (state.skillPoints || 0);
  return pool >= (s.cost || 1);
}
// 착용 중인 무기의 고유 옵션이 "고정 스탯 보너스"(statBonus)를 갖고 있으면 해당 스탯의 보너스 값을
// 반환. activateLevel 조건을 만족할 때만 적용됨(현재 강화 단계 기준, 무기 자체 판정 그대로 재사용).
// 아티팩트 스탯 보너스(artifactStatBonus)와 동일한 역할 분담 — 반월대도처럼 statBonus를 등록한 무기라면
// 어떤 무기든, 그리고 앞으로 추가되는 무기든 이 함수 하나로 자동 반영됨(개별 무기 코드 없음).
function weaponUniqueOptionStatBonus(stat){
  const equipped = getEquippedWeapon();
  if(!equipped) return 0;
  const opt = wpn(equipped.type).uniqueOption;
  if(!opt || !opt.statBonus) return 0;
  if(!weaponUniqueOptionActive(equipped.type, equipped.level)) return 0;
  return opt.statBonus[stat] || 0;
}
// 착용 중인 방어구(투구/갑옷)+보조 아이템의 고유 옵션 중 "고정 스탯 보너스"(statBonus)를 갖고 있으면
// 해당 스탯 보너스를 전부 합산. weaponUniqueOptionStatBonus(무기 전용)와 armorUniqueOptionChance
// (effectId 발동 확률 전용, 방어구+보조 그룹핑 동일)를 참고해 만든 대응 함수 — 철방패(힘+1)/보라방패
// (힘+1,지능+1)처럼 강화 없이 항상 활성화되는 고정형 고유 옵션을 가진 방어구/보조 아이템이 처음
// 등장해 신설함. 이후 방어구/보조 아이템이 statBonus를 갖는 고유 옵션을 추가로 등록해도 이 함수
// 하나로 자동 반영됨(개별 아이템 코드 없음).
function armorUniqueOptionStatBonus(stat){
  return wornArmorItems().concat(wornSubItems()).reduce((sum, item) => {
    const opt = wpn(item.type).uniqueOption;
    if(opt && opt.statBonus && weaponUniqueOptionActive(item.type, item.level)){
      return sum + (opt.statBonus[stat] || 0);
    }
    return sum;
  }, 0);
}
// 아티팩트로 증가하는 원시 스탯(힘/민첩/지능) 보너스. 캐릭터 정보창에서 기본값과 구분해
// 초록색 "(+N)"으로 표시하는 데도 사용됨(render.js renderStatAllocRow 참고).
// 착용 무기의 고유 옵션 statBonus(예: 반월대도의 힘+5)도 여기서 함께 합산됨 — 이름은 그대로 두지만
// "장비로 인한 원시 스탯 보너스" 전반을 담당하는 함수로 확장됨.
function artifactStatBonus(stat){
  let bonus = 0;
  if(stat === 'str'){
    if(isArtifactEquipped('antlerflag')) bonus += 2;
    if(isArtifactEquipped('oldarmguard')) bonus += 3;
    if(isArtifactEquipped('blackarmguard')) bonus += 5;
    if(isArtifactEquipped('squareshield')) bonus += 3;
  }
  if(stat === 'agi'){
    if(isArtifactEquipped('blackarmguard')) bonus += 3;
  }
  if(stat === 'int'){
    if(isArtifactEquipped('foxorb')) bonus += 10;
  }
  bonus += weaponUniqueOptionStatBonus(stat);
  bonus += armorUniqueOptionStatBonus(stat); // 방어구/보조 아이템의 고정 스탯 보너스(예: 철방패 힘+1) 합산
  return bonus;
}
// 레벨업으로 투자한 기본 스탯 + 현재 장착 중인 무기/방어구/장신구/아티팩트의 스탯 보너스(artifactStatBonus,
// 이름은 그대로 두지만 실제로는 무기 고유 옵션까지 포함해 "장비 전반의 원시 스탯 보너스"를 담당함)를
// 모두 합산한 "최종 스탯". 장비 착용 요구 스탯 판정(meetsWeaponEquipRequirements)에 사용됨 — 장착하지
// 않은 장비의 스탯은 포함되지 않으며(artifactStatBonus가 isArtifactEquipped/weaponUniqueOptionActive로
// "착용/활성화 중"인 것만 골라 더하므로 자동 보장됨), 방어구/장신구가 나중에 원시 스탯 보너스를 갖게
// 되더라도 artifactStatBonus 안에 이어서 추가하기만 하면 이 함수도 코드 수정 없이 자동 반영됨.
function effectiveStats(){
  const s = state.stats || { str: 0, agi: 0, int: 0 };
  return {
    str: (s.str || 0) + artifactStatBonus('str'),
    agi: (s.agi || 0) + artifactStatBonus('agi'),
    int: (s.int || 0) + artifactStatBonus('int'),
  };
}
// 착용 중인 방어구+장신구+아티팩트 전체의 방어도 합산. 아티팩트는 방어형 장비 목록(wornEquipmentItems)에
// 포함되지 않으므로(무기와 동일하게 defArr 기반 계산 대상이 아님) 여기서 별도로 더함 — 현재는 사각
// 방패(squareshield)의 방어도 -5뿐이며, 앞으로 방어도를 갖는 아티팩트가 추가되면 이 자리에 이어서 더하면 됨.
function artifactDefenseBonus(){
  let bonus = 0;
  if(isArtifactEquipped('squareshield')) bonus -= 5;
  return bonus;
}
// 스탯 보너스가 반영된 실질 최대 체력/마나
function effectiveMaxHp(level){
  const s = state.stats || { str: 0, agi: 0, int: 0 };
  const str = (s.str || 0) + artifactStatBonus('str');
  let hp = playerBaseHp(level) + str * 20;
  if(isArtifactEquipped('antlerflag')) hp += 200; // 힘 보너스와 별개로 적용되는 고정 체력 보너스
  if(isArtifactEquipped('squareshield')) hp += 300; // 힘 보너스와 별개로 적용되는 고정 체력 보너스
  hp += learnedPassiveSkillBonus('hpFlat'); // 습득한 패시브 스킬(예: 모험가의 의지)의 고정 체력 보너스
  hp += armorStatBonus('hp'); // 착용 중인 방어구의 체력 보너스 합산
  hp += weaponUniqueOptionStatBonus('maxHp'); // 착용 무기의 고유 옵션 중 고정 체력 보너스(예: 반월대도, 제령도) 합산
  return hp;
}
function effectiveMaxMp(level){
  const s = state.stats || { str: 0, agi: 0, int: 0 };
  const int = (s.int || 0) + artifactStatBonus('int');
  let mp = playerBaseMp(level) + int * 30;
  if(isArtifactEquipped('ring')) mp += 150;
  if(isArtifactEquipped('foxorb')) mp += 500; // 지능 보너스와 별개로 적용되는 고정 마나 보너스
  mp += armorStatBonus('mana'); // 착용 중인 방어구의 마나 보너스 합산
  mp += weaponUniqueOptionStatBonus('maxMana'); // 착용 무기의 고유 옵션 중 고정 마나 보너스(예: 제령도) 합산
  return mp;
}
function effectiveAtkSpeed(type, level){
  let s = atkSpeedFor(type, level);
  if(isArtifactEquipped('batwing')) s *= 1.05;
  const agi = ((state.stats && state.stats.agi) || 0) + artifactStatBonus('agi');
  s *= 1 + agi * 0.0015; // 민첩 1당 공격속도 +0.15%
  s *= 1 + activeBuffBonus('atkSpeedPercent') / 100; // 활성화된 버프 스킬(예: 선공)의 공격속도% 보너스
  s *= 1 + weaponUniqueOptionStatBonus('atkSpeedPercent') / 100; // 착용 무기의 고유 옵션 중 공격속도% 보너스(예: 척호검) 합산
  return s;
}
function effectiveAtk(type, level, damaged){
  const str = ((state.stats && state.stats.str) || 0) + artifactStatBonus('str');
  const agi = ((state.stats && state.stats.agi) || 0) + artifactStatBonus('agi');
  // 힘 1당 공격력 +4, 민첩 1당 공격력 +1, 활성화된 버프 스킬(예: 분노)의 고정 공격력 보너스를 더함.
  // 손상된 아이템(요청사항 12번)은 "아이템 자체"의 공격력만 80%로 줄어들고, 힘/민첩/버프 등 플레이어
  // 쪽 보너스는 전혀 영향받지 않음 — atkFor(type,level) 부분에만 0.8을 곱함.
  const baseAtk = atkFor(type, level);
  const itemAtk = damaged ? Math.round(baseAtk * 0.8) : baseAtk;
  return itemAtk + str * 4 + agi * 1 + activeBuffBonus('atkFlat');
}
// 아티팩트 치명타 확률 보너스가 반영된 실질 치명타 확률. 무기 자체 수치(critChanceFor)는 툴팁/강화화면
// 미리보기에서 그대로 쓰이고(무기 하나만의 값을 보여줘야 하므로), 실제 전투 판정과 캐릭터 정보창의
// "총 치명타 확률"에는 이 함수를 사용함(effectiveAtk와 동일한 역할 분담).
function effectiveCritChance(type, level){
  let bonus = 0;
  if(isArtifactEquipped('oldarmguard')) bonus += 3;
  if(isArtifactEquipped('blackarmguard')) bonus += 8;
  const agi = ((state.stats && state.stats.agi) || 0) + artifactStatBonus('agi');
  bonus += agi * 0.1; // 민첩 1당 치명타 확률 +0.1%(합연산)
  bonus += armorStatBonus('crit'); // 착용 중인 방어구/장신구의 치명타 확률 보너스 합산
  // 무기 자체의 "치명타 확률 증가" 계열 고유 옵션(effectId: crit_chance_bonus)도 합연산 적용.
  // 다른 무기가 같은 effectId로 고유 옵션을 등록해도 이 함수를 수정할 필요 없이 자동으로 반영됨.
  const opt = wpn(type).uniqueOption;
  if(opt && opt.effectId === 'crit_chance_bonus' && weaponUniqueOptionActive(type, level)){
    bonus += weaponUniqueOptionChance(type, level) || 0;
  }
  return critChanceFor(type, level) + bonus;
}

// ---- 상점 "개수 지정 구매" 팝업 공용 헬퍼 ----
// 상점의 모든 구매 가능 아이템은 buy-weapon(무기/방어구/장신구 공용) / buy-consumable / buy-artifact
// 세 data-action 중 하나로 처리되므로(buildShopCardHtml 참고), 이 action 값 + typeId만으로 단가·최대
// 구매 가능 개수·아이콘/툴팁을 구하는 범용 함수만 두면 됨 — 새 무기/방어구/장신구/소비 아이템/아티팩트가
// 추가돼도(즉, 이 세 카테고리 중 하나로 등록되는 한) 별도 코드 없이 개수 지정 구매 UI가 자동으로 적용됨.
function shopBuyUnitPrice(action, typeId){
  if(action === 'buy-weapon') return weaponBuyPrice(typeId); // wpn()이 무기/방어구/장신구 세 테이블을 모두 조회
  if(action === 'buy-consumable') return (CONSUMABLES[typeId] || {}).buyPrice || 0;
  if(action === 'buy-artifact') return (ARTIFACTS[typeId] || {}).buyPrice || 0;
  return 0;
}
// 지금 상태(보유 골드/장비 공용 슬롯 여유분/아티팩트 보유 여부) 기준으로 실제 구매 가능한 최대 개수.
// "최대 100개 / 보유 골드로 가능한 수량 / (장비라면) 남은 인벤토리 슬롯" 중 가장 작은 값.
function shopBuyMaxQty(action, typeId){
  const price = shopBuyUnitPrice(action, typeId);
  if(price <= 0) return 0;
  const goldMax = Math.floor(state.gold / price);
  let cap = 100;
  if(action === 'buy-weapon'){
    // 무기/방어구/장신구는 공용 장비 인벤토리 슬롯(INV_MAX)을 공유함(totalEquipInventoryCount 참고).
    cap = INV_MAX - totalEquipInventoryCount();
  } else if(action === 'buy-artifact'){
    // 아티팩트는 종류당 1개만 보유 가능 — 이미 보유 중이면 애초에 구매 버튼이 비활성화되어 팝업까지
    // 오지 않지만, 방어적으로 한 번 더 확인함.
    if(ownsArtifact(typeId)) return 0;
    cap = 1;
  }
  return Math.max(0, Math.min(100, goldMax, cap));
}
// 개수 지정 구매 팝업 상단에 표시할 아이콘/툴팁 — 기존 상점 카드가 쓰는 아이콘 출력 규칙·툴팁 함수를
// 그대로 재사용함(무기/방어구/장신구는 buildWeaponShopCardHtml과 동일한 분기, 소비 아이템/아티팩트도
// 각자의 기존 아이콘·툴팁을 그대로 사용).
function shopBuyItemDisplay(action, typeId){
  if(action === 'buy-weapon'){
    const w = wpn(typeId);
    const tooltipHtml = w.equipType === 'armor' ? buildArmorTooltipHtml(typeId, 0)
      : w.equipType === 'accessory' ? buildAccessoryTooltipHtml(typeId, 0)
      : w.equipType === 'sub' ? buildSubTooltipHtml(typeId, 0)
      : buildWeaponTooltipHtml(typeId, 0);
    return { iconHtml: weaponIconHtml(typeId, 'shop-icon-img'), tooltipHtml, borderColor: weaponNameColor(typeId, 0) };
  }
  if(action === 'buy-consumable'){
    const item = CONSUMABLES[typeId];
    // 실제 아이템 아이콘(PNG 등록시 자동 대체)과 기존 아이템 툴팁 서식(buildConsumableTooltipHtml)을
    // 그대로 재사용함 — 사용 효과(desc)만 단독으로 보여주던 기존 방식은 여기서 교체됨.
    return { iconHtml: itemIconHtml(item, 'shop-icon-img'), tooltipHtml: buildConsumableTooltipHtml(typeId), borderColor: '#c13c3c' };
  }
  if(action === 'buy-artifact'){
    const a = ARTIFACTS[typeId];
    return { iconHtml: a.icon, tooltipHtml: buildArtifactTooltipHtml(typeId), borderColor: null };
  }
  return { iconHtml: '', tooltipHtml: '', borderColor: null };
}

// ---- 장비(무기/방어구/장신구) 공용 인벤토리 슬롯 ----
// 세 종류가 각자 슬롯을 갖지 않고 INV_MAX(50)를 함께 나눠 쓰므로, "지금 몇 개나 차 있는지"는 항상
// 이 함수로 계산함. EQUIP_INVENTORY_POOLS(data.js)를 그대로 순회하므로, 앞으로 새 장비 타입이 이
// 풀에 등록되기만 하면 이 함수 수정 없이 자동으로 합산 대상에 포함됨.
function totalEquipInventoryCount(){
  return EQUIP_INVENTORY_POOLS.reduce((sum, pool) => sum + pool.items().length, 0);
}
// 공용 슬롯이 가득 찼는지 여부(구매/드랍 등 모든 장비 획득 지점이 이 함수로 통일해서 판단함).
function equipInventoryFull(){
  return totalEquipInventoryCount() >= INV_MAX;
}

// ---- 대장간 "강화 장비 선택" 팝업: 후보 목록 조회 ----
// EQUIP_INVENTORY_POOLS(data.js)를 순회하며 "소유 + 착용 가능 + 강화 가능" 세 조건을 모두 만족하는
// 장비만 모아 하나의 배열로 반환. 장비 종류(무기/방어구/장신구)를 구분하지 않고 섞어서 반환하며,
// 정렬 기준은 없음(원래 인벤토리 등록 순서 그대로) — 요구사항에 정렬 규칙이 없으므로 임의 정렬을
// 추가하지 않음.
// "착용 가능" 조건은 현재 강화 대상으로 지정된 아이템(state.equippedId)에는 적용하지 않음 — 인벤토리
// 목록(render.js의 equipDisabled = isEquipped || !reqOk)과 동일한 안전장치로, 레벨업/스탯초기화 등으로
// 요구 스탯에 일시적으로 못 미치게 되어도 "이미 선택되어 있던" 장비가 목록에서 갑자기 사라지지 않게 함.
function forgeSelectableItems(){
  const list = [];
  EQUIP_INVENTORY_POOLS.forEach(pool => {
    const items = (typeof pool.items === 'function' ? pool.items() : pool.items) || [];
    items.forEach(item => {
      const type = item.type;
      const typeDef = pool.typesTable[type];
      if(!typeDef) return;                          // 도감에 없는 타입은 제외
      if(item.id !== state.forgeTargetId && !pool.meetsReq(type)) return; // 착용 가능 조건
      if(!typeDef.cost || typeDef.cost.length === 0) return; // 강화 가능 조건(강화단계 비용 데이터가 있어야 함) — 무기/방어구 공용
      if(item.damaged) return; // 손상된 아이템은 강화 대상으로 선택할 수 없음(요청사항 13번)
      list.push({ kind: pool.kind, id: item.id, type, level: item.level });
    });
  });
  return list;
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

// 플라스크 단계(tier) 선택(전역 공식). FLASK_TIER_RULES(data.js)를 위에서부터 순서대로 검사해 몬스터
// 레벨이 속하는 첫 구간의 tier를 반환함 — pickStoneGrade와 완전히 동일한 구간 조회 패턴을 재사용함.
function pickFlaskTier(level){
  const rule = FLASK_TIER_RULES.find(r => level >= r.minLevel && (r.maxLevel == null || level <= r.maxLevel));
  return rule ? rule.tier : FLASK_TIER_RULES[FLASK_TIER_RULES.length - 1].tier;
}
// 플라스크 드랍 판정(전역 공식, rollStoneDrop과 동일한 구조). 1) FLASK_DROP_CHANCE 확률로 드랍 판정 →
// 2) 성공 시 FLASK_TYPE_CHANCE로 체력/마나 중 종류 결정 → 3) pickFlaskTier로 레벨 기준 단계 결정 →
// 4) 종류+단계로 CONSUMABLES id(hpFlask{tier}/mpFlask{tier})를 조합해 기본 수량(FLASK_DROP_BASE_QTY) 지급.
// 마석 드랍(rollStoneDrop)과 완전히 독립적으로 호출·판정되며, 몬스터 등급에 따른 수량 보정은 없음
// (요청사항: 기본 드랍 수량은 등급 무관 전부 동일). 실패하면 null을 반환.
function rollFlaskDrop(level){
  if(Math.random() * 100 >= FLASK_DROP_CHANCE) return null;
  const type = Math.random() * 100 < FLASK_TYPE_CHANCE.hp ? 'hp' : 'mp';
  const tier = pickFlaskTier(level);
  const itemId = (type === 'hp' ? 'hpFlask' : 'mpFlask') + tier;
  if(!CONSUMABLES[itemId]) return null;
  return { itemId, qty: FLASK_DROP_BASE_QTY };
}

// 숨겨진 장소(11스테이지) 보상 상자 전용 기타 아이템 추첨(TREASURE_MISC_DROP_TABLE, data.js 참고).
// 기존 마석/플라스크 전역 드랍(rollStoneDrop/rollFlaskDrop)과 완전히 독립적인 별도 로직 — 이 함수가
// 호출되지 않으면 기존 드랍 판정에는 전혀 영향이 없음.
// 1) 던전 최소 몬스터 레벨(minLevel)이 속한 구간을 아이템마다 조회해 확률>0인 것만 후보로 모음.
// 2) 후보를 확률이 낮은 순으로 정렬해 하나씩 순서대로 추첨.
// 3) 처음 성공한 아이템 하나만(개수는 qtyOptions 중 균등 확률로 하나 선택) 반환하고 즉시 종료(한 번의
//    상자에서 최대 1종류만 지급 — 여러 아이템을 동시에 판정해 합산 지급하지 않음).
// 4) 전부 실패하면 null(기타 아이템 없음).
function rollTreasureMiscDrop(minLevel){
  const candidates = [];
  TREASURE_MISC_DROP_TABLE.forEach(entry => {
    const tier = entry.tiers.find(t => minLevel >= t.minLevel && (t.maxLevel == null || minLevel <= t.maxLevel));
    if(!tier || !tier.chance) return; // 구간 없음 또는 확률 0% → 추첨 대상에서 제외
    candidates.push({ itemId: entry.itemId, chance: tier.chance, qtyOptions: tier.qtyOptions });
  });
  candidates.sort((a, b) => a.chance - b.chance); // 확률 낮은 아이템부터 추첨
  for(const c of candidates){
    if(Math.random() * 100 < c.chance){
      const qty = c.qtyOptions[Math.floor(Math.random() * c.qtyOptions.length)];
      return { itemId: c.itemId, qty };
    }
  }
  return null;
}

// ---- 몬스터 체력/공격력 ----
// 일반: Lv1=150, 이후 (이전 레벨 HP + 50) x 1.07 / 에픽: 같은 레벨 일반 몬스터의 3배(수정 없음)
function normalMonsterHP(level){
  let hp = 150;
  for(let l = 2; l <= level; l++){
    hp = (hp + 50) * 1.07;
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
// 던전 아이콘: 비어있으면 등장 몬스터 중 첫 번째의 아이콘을 그대로 사용(그 몬스터에 PNG가 등록돼있으면
// monsterIconHtml을 통해 PNG로, 없으면 기존처럼 이모지로 출력됨). 던전 자체에 지정된 커스텀 아이콘(d.icon)은
// 몬스터 데이터가 아니므로 PNG 대상이 아니라 기존처럼 문자열 그대로 사용함.
function dungeonIcon(d){
  if(d.icon) return d.icon;
  return d.monsters.length ? monsterIconHtml(MONSTERS[d.monsters[0]]) : '';
}
// 등장 레벨 추첨: 구간 내 모든 레벨이 동일한 확률(균등 분포)
function pickSpawnLevel(levelMin, levelMax){
  return levelMin + Math.floor(Math.random() * (levelMax - levelMin + 1));
}
// 가중치 쌍 배열([값, 가중치])에서 하나를 추첨
// ---- 공통 페이지네이션 시스템 ----
// 인벤토리 무기 탭 / 상점(무기·방어구·소비·아티팩트) / 던전 입구가 전부 이 4개 함수를 그대로 공유함.
// 새 화면(또는 탭)에 페이지네이션을 붙이고 싶으면 PAGE_SIZE(data.js)와 pageState(state.js)에 키를
// 하나씩 추가하고, 목록을 그릴 때 이 함수들로 페이지 계산 → 자르기 → UI 출력만 해주면 됨.
function pageCount(itemCount, pageSize){
  return Math.max(1, Math.ceil(itemCount / pageSize));
}
// 아이템 수가 줄어들어(판매 등) 현재 페이지가 범위를 벗어난 경우, [1, 전체페이지] 안으로 자동 보정.
function clampPage(page, totalPages){
  return Math.min(Math.max(1, page), totalPages);
}
// items 배열 중 현재 페이지에 해당하는 구간만 잘라서 반환(정렬/필터는 호출부에서 이미 끝낸 상태여야 함 —
// 이 함수는 "자르기"만 담당하므로, 필터가 바뀌어도 이 함수 자체는 그대로 재사용 가능함).
function pageSlice(items, page, pageSize){
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
// 인벤토리 정렬(신규): 현재 필터(=각 탭이 이미 걸러놓은 items 배열)에 해당하는 목록 안에서, 장착/착용
// 중인 아이템을 최우선으로 앞에 오도록 안정 정렬함. 장착 아이템끼리, 미장착 아이템끼리는 각각 원래
// 배열 순서(=기존 정렬 기준)를 그대로 유지함 — 장착 여부 외의 새로운 정렬 기준은 추가하지 않음.
// 원본 배열(items)은 건드리지 않고 정렬된 새 배열만 반환하므로, pageSlice로 페이지를 나누기 직전에만
// 이 함수를 거치면 필터·페이지네이션·판매/사용 등 다른 로직은 원본 배열 순서 그대로 영향받지 않음.
function sortEquippedFirst(items, isEquippedFn){
  const equipped = [];
  const rest = [];
  items.forEach(item => { (isEquippedFn(item) ? equipped : rest).push(item); });
  return equipped.concat(rest);
}
// 페이지 이동 UI 공통 HTML: "현재 페이지 / 전체 페이지 [이전] [다음]". 첫 페이지는 [이전] 생략,
// 마지막 페이지는 [다음] 생략. target은 어떤 화면의 페이지인지 구분하는 키(pageState의 키와 동일) —
// 클릭 시 data-page-target으로 actions.js가 pageState의 어느 값을 바꿀지 알 수 있음.
function pagerHtml(target, page, totalPageCount){
  const prevBtn = page > 1 ? `<button class="pager-btn" data-action="page-prev" data-page-target="${target}">이전</button>` : '';
  const nextBtn = page < totalPageCount ? `<button class="pager-btn" data-action="page-next" data-page-target="${target}">다음</button>` : '';
  return `<div class="pager"><span class="pager-label">${page} / ${totalPageCount}</span>${prevBtn}${nextBtn}</div>`;
}
function pickWeighted(pairs){
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for(const [v, w] of pairs){
    if(r < w) return v;
    r -= w;
  }
  return pairs[pairs.length - 1][0];
}
// 배열을 제자리에서 무작위로 섞음(Fisher–Yates). 몬스터 전투 위치 배정(assignMonsterPositions) 등
// "겹치지 않게 무작위로 나눠 배정"하는 곳에서 공용으로 재사용.
function shuffleArray(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
// 몬스터 개체 배열에 상/하/좌/우(MONSTER_COMBAT_POSITIONS) 중 서로 겹치지 않는 위치를 하나씩 무작위로
// 배정(instance.pos 필드). 위치 후보 전체를 먼저 무작위로 섞은 뒤 앞에서부터 순서대로 나눠주는 방식이라,
// 몇 마리가 등장하든(1~MONSTER_COUNT_MAX) 항상 서로 다른 슬롯을 받고 이미 배정된 위치는 재사용되지 않음.
function assignMonsterPositions(monsters){
  const positions = shuffleArray(MONSTER_COMBAT_POSITIONS.slice());
  monsters.forEach((m, i) => { m.pos = positions[i]; });
}
// 구간표(min/max/qty 배열)를 위에서부터 순서대로 검사해 value가 속하는 첫 구간의 qty를 반환함
// (STONE_GRADE_RULES와 동일한 구간 조회 패턴). 어느 구간에도 안 걸리면 0(해당 없음)을 반환함.
function tierQty(rules, value){
  const r = rules.find(x => value >= x.min && value <= x.max);
  return r ? r.qty : 0;
}
// 흔적 복구 비용 = 파괴된 장비의 기본 판매 가격(강화 단계·강화 비용과 무관) × TRACE_RECOVERY_COST_MULT.
function traceRecoveryCost(type){
  return (wpn(type).sellPrice || 0) * TRACE_RECOVERY_COST_MULT;
}
// 폴백 후보 선정: 최우선 조건으로 "아이템 레벨이 targetLevel(몬스터 레벨)과 같거나 낮은" 무기만 남긴 뒤,
// 그 중 targetLevel과 아이템 레벨 차이가 가장 작은 무기들만 남김(동률이면 전부 후보로 남음).
function nearestLevelCandidates(list, targetLevel){
  const eligible = list.filter(w => w.levelReq <= targetLevel);
  if(eligible.length === 0) return [];
  let minDiff = Infinity;
  eligible.forEach(w => { const diff = targetLevel - w.levelReq; if(diff < minDiff) minDiff = diff; });
  return eligible.filter(w => (targetLevel - w.levelReq) === minDiff);
}
// 모험가의 유해(장비) 드랍 판정.
// 1) RELIC_DROP_CHANCE 확률로 드랍 판정 → 2) RELIC_EQUIP_TYPE_CHANCE로 장비 타입(무기/방어구/장신구)
//    선택 → 3) 선택된 타입의 RELIC_GRADE_CHANCE로 등급 선택 → 4) 그 등급 중 아이템 레벨이
//    [max(1, 몬스터레벨-RELIC_LEVEL_WINDOW), 몬스터레벨] 구간인 후보만 필터
//    (후보가 없으면 폴백: ① 같은 등급 안에서 레벨 구간 제한 없이 몬스터 레벨과 가장 가까운 아이템
//     레벨로 대체 ② 그래도 없으면(해당 등급 장비가 아예 없음) 등급 상관없이 몬스터 레벨과 가장 가까운
//     장비로 대체) → 5) 후보의 "등록된 레벨" 종류를 내림차순으로 최고 레벨 가중치 100, 한 단계
//    낮아질 때마다 ×RELIC_LEVEL_WEIGHT_DECAY로 레벨 추첨 → 6) 그 레벨(+같은 등급, 폴백된 경우는
//    폴백된 등급)에 해당하는 장비 중 하나를 무작위로 선택 → 7) 강화 단계 결정: 무기는
//    RELIC_ENHANCE_LEVEL_CHANCE 확률표(등급별로 분리)로 추첨(최종 선택된 장비의 등급 기준 — 폴백 ②로
//    등급이 바뀌었을 수 있으므로 최초 추첨된 grade가 아니라 실제 지급 등급을 사용), 방어구/장신구는
//    등급과 무관하게 항상 +0 고정.
// 장비 타입별 도감은 EQUIP_INVENTORY_POOLS(data.js)의 typesTable을 그대로 재사용 — 새 방어구/장신구가
// 거기에 등록되기만 하면 이 함수는 수정 없이 자동으로 후보에 포함시킴.
function resolveWeaponRelicDrop(monsterLevel){
  if(Math.random() * 100 >= RELIC_DROP_CHANCE) return null;

  const equipType = pickWeighted(Object.entries(RELIC_EQUIP_TYPE_CHANCE));
  const typesTable = (EQUIP_INVENTORY_POOLS.find(p => p.kind === equipType) || {}).typesTable;
  if(!typesTable) return null; // 해당 타입의 도감을 찾지 못한 극단적인 경우(정상 데이터에서는 발생하지 않음)

  const grade = pickWeighted(Object.entries(RELIC_GRADE_CHANCE[equipType]));

  const minLevel = Math.max(1, monsterLevel - RELIC_LEVEL_WINDOW);
  const maxLevel = monsterLevel;
  let candidates = Object.values(typesTable).filter(w =>
    w.grade === grade && w.levelReq >= minLevel && w.levelReq <= maxLevel
  );
  if(candidates.length === 0){
    // 폴백 ①: 레벨 구간 제한을 풀고, 같은 등급 안에서 몬스터 레벨 이하 중 가장 가까운 레벨로 대체
    candidates = nearestLevelCandidates(Object.values(typesTable).filter(w => w.grade === grade), monsterLevel);
  }
  if(candidates.length === 0){
    // 폴백 ②: 이 등급에 등록된 장비가 아예 없으면, 등급도 무시하고 몬스터 레벨 이하 중 가장 가까운 장비로 대체
    candidates = nearestLevelCandidates(Object.values(typesTable), monsterLevel);
  }
  if(candidates.length === 0) return null; // 이 타입에 등록된 장비가 하나도 없는 극단적인 경우

  const levels = [...new Set(candidates.map(w => w.levelReq))].sort((a, b) => b - a); // 높은 레벨부터
  let weight = 100;
  const levelWeightPairs = levels.map(lv => {
    const pair = [lv, weight];
    weight *= RELIC_LEVEL_WEIGHT_DECAY;
    return pair;
  });
  const chosenLevel = pickWeighted(levelWeightPairs);

  const pool = candidates.filter(w => w.levelReq === chosenLevel);
  const chosenType = pool[Math.floor(Math.random() * pool.length)];

  // 강화 단계: 무기만 기존 확률표로 추첨하고, 방어구/장신구는 항상 +0 고정.
  const enhanceLevel = equipType === 'weapon'
    ? pickWeighted(RELIC_ENHANCE_LEVEL_CHANCE[chosenType.grade] || RELIC_ENHANCE_LEVEL_CHANCE.normal)
    : 0;
  return { type: chosenType.id, level: enhanceLevel, equipType };
}
// 몬스터 데이터의 drops 항목(name) 중 재료성 아이템(MISC_ITEMS)에 등록된 이름과 일치하는 것을 찾음.
// 이름 기반으로 매칭하므로, MISC_ITEMS에 새 재료 아이템을 추가하고 몬스터의 drops에 같은 이름만
// 등록하면 별도 코드 수정 없이 자동으로 연결됨.
function miscItemByName(name){
  return Object.values(MISC_ITEMS).find(it => it.name === name) || null;
}

// ---- 장비 드랍 우선순위 판정 ----
// "장비" 드랍(모험가의 유해 + drops의 weaponId 확정 드랍 — 무기뿐 아니라 방어구/장신구 id를 weaponId에
// 등록해도 동일하게 취급됨)이 한 몬스터에게서 동시에 여러 개 당첨된 경우, 최종적으로 1개만 지급하기
// 위한 우선순위만 담당함. 개별 드랍 확률 판정 로직/드랍 테이블은 전혀 건드리지 않고, 이미 각자의 확률
// 판정을 통과한 후보들 중에서 고르기만 함. 아티팩트/재료/마석 드랍에는 관여하지 않음.
// 등급 우선순위는 WEAPON_GRADES에 등록된 키 순서(normal < rare < epic < unique)를 그대로 사용 — 새
// 등급을 WEAPON_GRADES 뒤쪽에 추가하면 그 등급이 자동으로 더 높은 우선순위가 됨(하드코딩 없음).
const WEAPON_GRADE_RANK = Object.keys(WEAPON_GRADES).reduce((m, k, i) => { m[k] = i; return m; }, {});
// candidates: [{ type, level, chance, _source }]. 1순위 등급 높은 쪽, 2순위(등급 동률) 드랍확률(chance)이
// 더 낮은(더 희귀한) 쪽, 그래도 동률이면 무작위 선택.
function pickPriorityEquipDrop(candidates){
  if(candidates.length <= 1) return candidates[0] || null;
  let best = candidates[0];
  for(let i = 1; i < candidates.length; i++){
    const c = candidates[i];
    const bestRank = WEAPON_GRADE_RANK[wpn(best.type).grade] ?? -1;
    const cRank = WEAPON_GRADE_RANK[wpn(c.type).grade] ?? -1;
    if(cRank > bestRank){ best = c; continue; }
    if(cRank < bestRank) continue;
    if(c.chance < best.chance){ best = c; continue; }
    if(c.chance > best.chance) continue;
    if(Math.random() < 0.5) best = c;
  }
  return best;
}

// 몬스터 처치 시 모든 드랍(골드/모험가의 유해/마석/몬스터 고유 드랍/재료 아이템)을 판정
function resolveDrops(monsterDef, dungeon, level){
  const grade = monsterDef.grade;
  const gradeInfo = MONSTER_GRADES[grade];

  const goldMultiplier = 1 + gradeInfo.goldBonus + (monsterDef.extraGoldBonus || 0);
  const gold = rollGoldDrop(level, goldMultiplier);

  let weaponDrop = resolveWeaponRelicDrop(level); // { type, level } 또는 null

  const stoneDrop = rollStoneDrop(level, grade); // { itemId, qty } 또는 null(전역 공식, 던전/등급별 개별 설정 없음)
  const flaskDrop = rollFlaskDrop(level); // { itemId, qty } 또는 null(전역 공식, 마석 드랍과 완전히 독립적으로 판정)

  // drops 중 artifactId가 있는 항목은 각 항목마다 독립적으로 확률을 판정함(재료류 미스크 드랍과 동일한
  // 원칙). 과거엔 몬스터마다 아티팩트 드랍 항목이 최대 1개뿐이라 첫 성공에서 멈춰도 차이가 없었지만,
  // 이제 한 몬스터가 아티팩트 드랍을 여러 개 가질 수 있어 전부 독립 판정하도록 배열로 변경함.
  const artifactDropIds = [];
  for(const drop of (monsterDef.drops || [])){
    if(drop.artifactId && canGrantArtifact(drop.artifactId) && Math.random() * 100 < drop.chance){
      artifactDropIds.push(drop.artifactId);
    }
  }

  // drops 중 weaponId가 있는 항목은 몬스터 드랍 테이블에 직접 등록된 확정 무기(모험가의 유해와는 별개의
  // 지정 무기 드랍). artifactId와 동일하게 각 항목마다 독립적으로 확률을 판정하며, 지급되는 무기는
  // 항상 +0 강화 단계로 지급됨(강화 단계 추첨은 모험가의 유해 전용 로직이라 여기선 사용하지 않음).
  let weaponIdDrops = [];
  for(const drop of (monsterDef.drops || [])){
    if(!drop.weaponId) continue;
    if(Math.random() * 100 < drop.chance){
      // weaponId 필드는 이름과 달리 무기 전용이 아니라 wpn()이 통합 조회하는 무기/방어구/장신구 전체를
      // 가리키는 범용 "확정 장비 드랍" 식별자임(자호굴 강철 갑옷/투구 드랍이 최초의 방어구 사례).
      // equipType을 함께 담아 지급 시 올바른 인벤토리(무기/방어구/장신구)로 나뉘어 들어가도록 함.
      weaponIdDrops.push({ type: drop.weaponId, level: 0, chance: drop.chance, equipType: wpn(drop.weaponId).equipType });
    }
  }

  // 장비 드랍 우선순위 판정: 모험가의 유해(weaponDrop)와 확정 장비 드랍(weaponIdDrops)이 동시에
  // 당첨된 경우 이 몬스터에서는 최종적으로 1개만 지급되도록 정리함(1마리당 장비 드랍 1개 제한).
  // weaponDrop의 비교용 확률은 "이 조합(장비 타입+등급)의 모험가의 유해가 나올 실제 확률"
  // (RELIC_DROP_CHANCE × RELIC_EQUIP_TYPE_CHANCE[타입] × RELIC_GRADE_CHANCE[타입][등급])로 환산함 —
  // 폴백으로 등급이 바뀌었을 수 있으므로 최종 지급 등급(wpn(weaponDrop.type).grade) 기준으로 계산
  // (다른 곳의 폴백 등급 처리 규칙과 동일).
  const equipCandidates = [];
  if(weaponDrop){
    const relicEquipType = weaponDrop.equipType;
    const relicGrade = wpn(weaponDrop.type).grade;
    const gradeChanceTable = RELIC_GRADE_CHANCE[relicEquipType] || {};
    const relicChance = RELIC_DROP_CHANCE
      * (RELIC_EQUIP_TYPE_CHANCE[relicEquipType] || 0) / 100
      * (gradeChanceTable[relicGrade] || 0) / 100;
    equipCandidates.push({ type: weaponDrop.type, level: weaponDrop.level, chance: relicChance, _source: 'relic', equipType: relicEquipType });
  }
  weaponIdDrops.forEach(d => equipCandidates.push({ type: d.type, level: d.level, chance: d.chance, equipType: d.equipType, _source: 'weaponId' }));

  if(equipCandidates.length > 1){
    const winner = pickPriorityEquipDrop(equipCandidates);
    weaponDrop = winner._source === 'relic' ? { type: winner.type, level: winner.level, equipType: winner.equipType } : null;
    weaponIdDrops = winner._source === 'weaponId' ? [{ type: winner.type, level: winner.level, equipType: winner.equipType }] : [];
  } else {
    weaponIdDrops = weaponIdDrops.map(d => ({ type: d.type, level: d.level, equipType: d.equipType }));
  }

  // drops 중 artifactId/weaponId가 없는 항목(도토리/쥐고기 등 재료류)은 MISC_ITEMS에 등록된 재료
  // 아이템으로 취급하여, 각 항목마다 독립적으로 확률을 판정함(하나의 몬스터가 여러 개를 동시에
  // 드랍할 수도, 하나도 드랍 안 할 수도 있음).
  const miscDrops = [];
  for(const drop of (monsterDef.drops || [])){
    if(drop.artifactId || drop.weaponId) continue; // 아티팩트/확정 무기 드랍은 위에서 이미 별도 처리됨
    if(Math.random() * 100 < drop.chance){
      const item = miscItemByName(drop.name);
      if(item) miscDrops.push({ itemId: item.id, name: item.name, icon: item.icon, qty: 1 });
    }
  }

  return { gold, weaponDrop, weaponIdDrops, stoneDrop, flaskDrop, artifactDropIds, miscDrops };
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
// 5·10 스테이지도 이 확률표(MONSTER_COUNT_CHANCE)를 동일하게 그대로 사용함 — 예전에는 이 스테이지에서
// 무조건 1마리만 반환하도록 별도 처리했지만, "에픽 몬스터 1마리 확정 출현 + 남은 슬롯은 기존 몬스터 수
// 확률로 추가 추첨"으로 방식이 바뀌면서, 그 "확정 출현 1마리"는 여기가 아니라 pickStageMonsterGrades
// 쪽에서 이미 보장하고 있어(STAGE_GRADE_CHANCE가 5·10에서 epic:100이라 첫 마리는 항상 에픽으로 뽑히고,
// 이후 마리는 epicUsed 플래그로 강제 일반 처리됨) 이 함수는 그냥 매 스테이지 동일한 로직만 타면 됨.
function pickMonsterCount(stageNum){
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
// 에픽 몬스터 출현이 결정된 이후, 이 던전(dungeon)의 등록된 에픽 몬스터 중 이번 굴(stageNum)에
// 실제로 어떤 몬스터가 등장할지 결정. 에픽 몬스터 출현 여부 자체(pickStageGrade)는 이 함수와 무관하며 전혀 변경되지 않음.
// 우선순위: ①이 굴에서 등장 가능한 에픽 몬스터만 남김(monsterDef.epicSpawnStages에 stageNum이 없으면 제외,
// epicSpawnStages 필드가 아예 없으면 모든 굴에서 등장 가능) → ②남은 후보가 전부 monsterDef.epicSpawnWeight를
// 갖고 있으면 그 가중치로 추첨(pickWeighted 재사용) → ③하나라도 가중치가 없으면 남은 후보를 동일 확률로 추첨.
// 에픽 몬스터가 1종만 등록된 던전은 후보가 1개뿐이라 추첨 없이 그 몬스터를 그대로 반환(기존 동작과 완전히 동일).
function pickEpicMonsterId(dungeon, stageNum){
  const allEpic = dungeon.monsters.filter(id => MONSTERS[id].grade === 'epic');
  if(allEpic.length <= 1) return allEpic[0];
  let candidates = allEpic.filter(id => {
    const stages = MONSTERS[id].epicSpawnStages;
    return !stages || stages.includes(stageNum);
  });
  // 굴 제한 데이터 실수 등으로 이 굴에서 등장 가능한 에픽 몬스터가 하나도 안 남는 안전장치: 굴 제한을 무시하고 전체 에픽 후보로 폴백
  if(candidates.length === 0) candidates = allEpic;
  if(candidates.length === 1) return candidates[0];
  const hasAllWeights = candidates.every(id => typeof MONSTERS[id].epicSpawnWeight === 'number');
  if(hasAllWeights){
    return pickWeighted(candidates.map(id => [id, MONSTERS[id].epicSpawnWeight]));
  }
  return candidates[Math.floor(Math.random() * candidates.length)]; // 별도 확률 미설정: 동일 확률 추첨
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

// ---- 제작소: 제작 아이템/재료 공용 헬퍼 ----
// iconType/iconRef로 등록된 기존 아이템 아이콘을 그대로 재사용해서 렌더링함(신규 제작 전용 이미지 없음).
function craftItemIconHtml(item, className){
  if(item.iconType === 'weapon') return weaponIconHtml(item.iconRef, className);
  return ''; // 다른 iconType이 추가되면 여기에 분기만 추가하면 됨
}
// 제작 아이템 이름/아이콘 테두리 색상 — 기존 무기 등급 색상 공식(WEAPON_GRADES)을 그대로 재사용.
function craftItemNameColor(item){
  const g = WEAPON_GRADES[item.grade];
  return g ? g.color : '#ffffff';
}
// 제작 아이템의 툴팁 — iconType에 맞는 기존 툴팁 빌더를 그대로 재사용(신규 제작 전용 툴팁 없음).
// iconType이 'weapon'이면 강화 단계 0으로 간주해 무기 툴팁을 그대로 출력함(기존 아이템 표시 규칙 재사용).
function craftItemTooltipHtml(item){
  if(item.iconType === 'weapon') return buildWeaponTooltipHtml(item.iconRef, 0);
  return ''; // 다른 iconType이 추가되면 여기에 분기만 추가하면 됨
}
function findCraftItem(category, id){
  return (CRAFTABLE_ITEMS[category] || []).find(it => it.id === id);
}

// ---- 제작소: 이름 기반 자원(재료/반환 아이템) 조회(요청사항 1·2번) ----
// 제작 데이터(materials/failReturns)에는 아이템 정보를 중복 등록하지 않고 "이름"만 적어두면, 여기서
// 기존 장비 도감(무기/방어구/장신구/보조) 또는 MISC_ITEMS 중 이름이 일치하는 데이터를 찾아 자동으로
// 연동함. 장비 쪽은 { kind:'equip', equipType, typeId, def }, 일반 재료는 { kind:'misc', itemId, def }
// 형태로 반환 — 이후 아이콘/색상/툴팁/보유량/소모·홀딩 로직이 전부 이 결과 하나로 분기됨.
const CRAFT_EQUIP_TABLES = [
  { equipType: 'weapon', table: WEAPON_TYPES },
  { equipType: 'armor', table: ARMOR_TYPES },
  { equipType: 'accessory', table: ACCESSORY_TYPES },
  { equipType: 'sub', table: SUB_TYPES },
];
function findCraftResource(name){
  for(const { equipType, table } of CRAFT_EQUIP_TABLES){
    const found = Object.values(table).find(d => d.name === name);
    if(found) return { kind: 'equip', equipType, typeId: found.id, def: found };
  }
  const misc = Object.values(MISC_ITEMS).find(d => d.name === name);
  if(misc) return { kind: 'misc', itemId: misc.id, def: misc };
  return null;
}
function craftResourceIconHtml(resource, className){
  if(!resource) return '';
  return resource.kind === 'equip' ? weaponIconHtml(resource.typeId, className) : itemIconHtml(resource.def, className);
}
function craftResourceColor(resource){
  if(!resource) return '#ffffff';
  if(resource.kind === 'equip') return weaponNameColor(resource.typeId, 0);
  return resource.def.itemClass === 'stone' ? stoneNameColor(resource.itemId) : miscNameColor(resource.itemId);
}
function craftResourceTooltipHtml(resource){
  if(!resource) return '';
  if(resource.kind === 'equip'){
    if(resource.equipType === 'weapon') return buildWeaponTooltipHtml(resource.typeId, 0);
    if(resource.equipType === 'armor') return buildArmorTooltipHtml(resource.typeId, 0);
    if(resource.equipType === 'accessory') return buildAccessoryTooltipHtml(resource.typeId, 0);
    if(resource.equipType === 'sub') return buildSubTooltipHtml(resource.typeId, 0);
  }
  return resource.def.itemClass === 'stone' ? buildStoneTooltipHtml(resource.itemId) : buildMiscTooltipHtml(resource.itemId);
}
// 특정 장비 인벤토리 항목(id)이 현재 착용 중인지 — 착용 중인 아이템은 재료로 선택할 수 없음(요청사항 8번).
function isEquipInstanceWorn(equipType, id){
  if(equipType === 'weapon') return state.equippedId === id;
  if(equipType === 'armor') return Object.values(state.equippedArmor || {}).includes(id);
  if(equipType === 'sub') return state.equippedSubId === id;
  if(equipType === 'accessory') return (state.equippedAccessories || []).includes(id);
  return false;
}
// 재료로 쓸 수 있는 장비 인벤토리 항목만(착용 중 제외·손상된 아이템 제외 — 요청사항 8·13번) 반환.
function craftEligibleEquipInstances(resource){
  const pool = EQUIP_INVENTORY_POOLS.find(p => p.kind === resource.equipType);
  if(!pool) return [];
  const items = (typeof pool.items === 'function' ? pool.items() : pool.items) || [];
  return items.filter(it => it.type === resource.typeId && !it.damaged && !isEquipInstanceWorn(resource.equipType, it.id));
}
// 재료 하나(이름 기준)의 "현재 보유량" — 장비면 재료로 쓸 수 있는 인스턴스 개수, 일반 재료면 기존
// state[stateKey] 수량 그대로.
function craftResourceOwnedCount(resource){
  if(!resource) return 0;
  if(resource.kind === 'equip') return craftEligibleEquipInstances(resource).length;
  return state[resource.def.stateKey] || 0;
}

// 제작 최종 확인 UI의 "제작 실패" 영역용 HTML — item.failReturns가 없거나 빈 배열이면 빈 문자열을
// 반환해 그 영역이 통째로 표시되지 않게 함. 등록된 반환 후보를 전부(확률 미리보기 목적) 나열하며,
// "없음" 항목(none:true)은 보여줄 아이콘이 없으므로 건너뜀.
// 제작 최종 확인 UI의 "제작 실패" 영역용 HTML — item.failReturns가 없거나 빈 배열이면 빈 문자열을
// 반환해 그 영역이 통째로 표시되지 않게 함. 등록된 반환 후보를 전부(확률 미리보기 목적) 등급 높은
// 순으로 정렬해 한 줄에 최대 3개씩 나열함(요청사항 — 세로로 한 줄씩 쌓이지 않도록, 3개 초과분은 다음
// 줄에). 카드 구성(아이콘 위/이름 아래)은 제작 연출 결과 화면(craftAnimResultIconsHtml)과 동일한
// 클래스를 그대로 재사용해서 3열 그리드가 자동으로 맞춰지고 별도 CSS를 새로 만들지 않아도 됨.
// "없음" 항목(none:true)은 보여줄 아이콘이 없으므로 건너뜀.
// 반환 항목 표시용 이름 — 반환 개수(need)가 2개 이상으로 등록된 경우에만 "×N"을 붙임(1개면 기존과
// 동일하게 이름만 표시).
function craftFailReturnLabel(entry, resource){
  return resource.def.name + (entry.need > 1 ? ` ×${entry.need}` : '');
}
function craftItemFailReturnHtml(item){
  const returns = (item.failReturns || []).filter(r => !r.none);
  if(returns.length === 0) return '';
  const sorted = [...returns].sort((a, b) => {
    const ra = findCraftResource(a.name), rb = findCraftResource(b.name);
    return craftGradeRank(rb && rb.def.grade) - craftGradeRank(ra && ra.def.grade);
  });
  const cards = sorted.map(r => {
    const resource = findCraftResource(r.name);
    if(!resource) return '';
    const color = craftResourceColor(resource);
    return `
      <div class="craft-anim-result-item">
        <span class="inv-icon craft-anim-result-icon weapon-name-wrap" style="border-color:${color};">
          ${craftResourceIconHtml(resource, 'inv-icon-img')}
          <span class="tooltip">${craftResourceTooltipHtml(resource)}</span>
        </span>
        <div class="craft-anim-result-name" style="color:${color};">${craftFailReturnLabel(r, resource)}</div>
      </div>`;
  }).join('');
  return `<div class="craft-anim-result-icons">${cards}</div>`;
}
// 제작 연출 UI의 진행률 구간별 안내 문구(요청사항 4번) — CRAFT_ANIM_STAGE_TEXT(data.js)에서 현재
// 진행률 이하인 첫 구간을 찾아 반환. 0%도 첫 구간(1~9%) 문구를 그대로 써서 시작하자마자 빈 문구가
// 보이는 어색함을 피함(실제 판정/확률과는 무관, 표시 문구만의 문제).
function craftAnimStageText(progress){
  const p = Math.max(1, Math.min(100, Math.ceil(progress)));
  const found = CRAFT_ANIM_STAGE_TEXT.find(s => p <= s.max);
  return found ? found.text : CRAFT_ANIM_STAGE_TEXT[CRAFT_ANIM_STAGE_TEXT.length - 1].text;
}
// 등록된 확률에 따라 반환 결과를 "하나만" 추첨(요청사항 4번). 0~100 절대 구간으로 굴려서, 등록된
// 확률 합이 100 미만이면 남는 구간은 명시적 "없음"과 동일하게 처리됨(추첨 결과 없음 = 반환 없음).
function craftRollFailReturn(item){
  const entries = item.failReturns || [];
  if(entries.length === 0) return null;
  const roll = Math.random() * 100;
  let cumulative = 0;
  for(const e of entries){
    cumulative += (e.chance || 0);
    if(roll < cumulative) return e.none ? null : e;
  }
  return null;
}
// 제작 결과 UI(요청사항 8번)에 표시할 아이콘+이름 HTML — 아이콘과 이름을 별도 요소로 구성. 성공이면
// 제작 아이템 본인, 실패면 실제로 추첨된 반환 결과(resultReturn, null이면 반환 없음 → 빈 문자열)만
// 보여줌(연출 완료 시점에 이미 확정된 결과를 그대로 보여주는 것 — 새로 굴리지 않음).
function craftAnimResultIconsHtml(item, success, resultReturn){
  if(success){
    const color = craftItemNameColor(item);
    return `
      <div class="craft-anim-result-item">
        <span class="inv-icon craft-anim-result-icon weapon-name-wrap" style="border-color:${color};">
          ${craftItemIconHtml(item, 'inv-icon-img')}
          <span class="tooltip">${craftItemTooltipHtml(item)}</span>
        </span>
        <div class="craft-anim-result-name" style="color:${color};">${item.name}</div>
      </div>`;
  }
  if(!resultReturn) return '';
  const resource = findCraftResource(resultReturn.name);
  if(!resource) return '';
  // 반환 대상이 이번에 실제로 투입했던 장비 재료와 같은 종류라면 "손상" 상태로 돌아옴을 미리 보여줌
  // (요청사항 6·11·12번) — craftGrantResultItems가 같은 조건으로 실제 지급을 처리함. 이 값은
  // clickCraftAnimIcon이 지급 처리(heldEquip 변형) 전에 미리 판정해 craftAnim.resultReturnDamaged에
  // 저장해둔 것을 그대로 씀(지급 후에는 heldEquip에서 이미 빠져 있어 여기서 다시 판정할 수 없음).
  const isDamagedReturn = craftAnim && craftAnim.resultReturnDamaged;
  const name = craftFailReturnLabel(resultReturn, resource) + (isDamagedReturn ? '(손상)' : '');
  const color = craftResourceColor(resource);
  const tooltip = (isDamagedReturn && resource.equipType === 'weapon')
    ? buildWeaponTooltipHtml(resource.typeId, 0, true)
    : craftResourceTooltipHtml(resource);
  return `
    <div class="craft-anim-result-item">
      <span class="inv-icon craft-anim-result-icon weapon-name-wrap" style="border-color:${color};">
        ${craftResourceIconHtml(resource, 'inv-icon-img')}
        <span class="tooltip">${tooltip}</span>
      </span>
      <div class="craft-anim-result-name" style="color:${color};">${name}</div>
    </div>`;
}
// 제작 결과 지급(요청사항 6·7·9·10번) — 새 지급 로직을 만들지 않고 기존 인벤토리 지급 함수를 그대로
// 재사용함. craftAnim.resultSuccess/resultReturn은 연출 완료 시점(finishCraftAnimProgress)에 이미
// 확정되어 있으므로 여기서는 그 결과를 "적용"만 함(다시 굴리지 않음).
// 성공: 제작 아이템을 +0으로 지급(grantRelicEquipDrop, dungeon.js — 모험가의 유해 드랍이 쓰는 바로 그
// 함수). 홀딩해뒀던 장비 재료는 연출 시작 시점에 이미 인벤토리에서 빠진 상태라 별도 처리 없이 그대로
// 소모 완료(요청사항 6번). 실패: 추첨된 반환 결과가 없으면 홀딩 재료도 그대로 소실. 일반 재료가
// 반환되면 기존 재료 보유 수량 갱신 방식(state[stateKey]+=1)을 그대로 재사용. 반환 결과가 이번에 투입한
// 장비 재료와 같은 종류면, 새 장비가 아니라 홀딩해뒀던 "그 개체"를 손상 상태로 되돌려줌(강화 단계 유지).
function craftGrantResultItems(item){
  if(!craftAnim) return;
  if(craftAnim.resultSuccess){
    if(item.iconType === 'weapon'){
      const wdef = wpn(item.iconRef);
      grantRelicEquipDrop({ type: item.iconRef, level: 0, equipType: wdef.equipType });
    }
    craftAnim.heldEquip = [];
    return;
  }
  const picked = craftAnim.resultReturn;
  if(!picked){ craftAnim.heldEquip = []; return; }
  const resource = findCraftResource(picked.name);
  if(!resource){ craftAnim.heldEquip = []; return; }
  if(resource.kind === 'misc'){
    state[resource.def.stateKey] = (state[resource.def.stateKey] || 0) + (picked.need || 1); // 반환 개수(need 생략 시 1개)
    craftAnim.heldEquip = [];
    return;
  }
  const heldIdx = craftAnim.heldEquip.findIndex(h => h.equipType === resource.equipType && h.typeId === resource.typeId);
  const pool = EQUIP_INVENTORY_POOLS.find(p => p.kind === resource.equipType);
  if(heldIdx !== -1){
    const held = craftAnim.heldEquip.splice(heldIdx, 1)[0];
    pool.items().push({ id: state.nextItemId++, type: held.typeId, level: held.level, damaged: true }); // 손상 지급(요청사항 10·11번)
  } else {
    // 문서에 명시되지 않은 경우(반환 아이템이 이번에 투입한 재료와 다른 종류의 장비인 경우) — 홀딩해둔
    // "그 개체"가 없으므로 새 +0 장비로 지급(성공 지급과 동일한 방식).
    grantRelicEquipDrop({ type: resource.typeId, level: 0, equipType: resource.equipType });
  }
  craftAnim.heldEquip = []; // 반환 대상이 아니었던 나머지 홀딩 재료는 그대로 소실(요청사항)
}
// WEAPON_GRADES 키 순서(normal<rare<epic<unique)를 그대로 등급 서열로 재사용 — 별도 순위 데이터 불필요.
function craftGradeRank(grade){
  const idx = Object.keys(WEAPON_GRADES).indexOf(grade);
  return idx === -1 ? 0 : idx;
}
// 제작 진행 팝업의 재료 슬롯 배치 순서(요청사항 3-1): 아이템 등급이 높은 순서대로 왼쪽부터 배치.
// 원본 materials 배열은 건드리지 않고 정렬된 새 배열만 반환함.
function craftMaterialsSortedByGradeDesc(materials){
  return [...materials].sort((a, b) => {
    const ra = findCraftResource(a.name), rb = findCraftResource(b.name);
    return craftGradeRank(rb && rb.def.grade) - craftGradeRank(ra && ra.def.grade);
  });
}
// 제작 팝업의 [제작] 버튼 활성화 조건: 모든 슬롯에 재료가 필요 개수만큼 채워지고, 보유 골드가 제작
// 비용 이상일 때만 활성화. 촉매는 조건에 포함하지 않음.
function craftPopupCanCraft(popup){
  if(!popup) return false;
  const item = findCraftItem(popup.category, popup.itemId);
  if(!item) return false;
  const materialsOk = item.materials.every(m => {
    const slot = popup.slots.find(s => s.name === m.name);
    return slot && slot.qty === m.need;
  });
  const goldOk = state.gold >= (item.craftCost || 0);
  return materialsOk && goldOk;
}
