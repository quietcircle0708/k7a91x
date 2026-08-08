// ============================================================
// formulas.js — 순수 계산 함수
// data.js의 데이터 테이블을 참조하는 계산 함수들. DOM을 직접
// 건드리지 않음 (일부 함수는 전역 state를 참조함).
// 밸런스 공식을 수정할 때는 이 파일을 보면 됨.
// ============================================================

// ---- 무기 스탯 조회 ----
// 방어구 시스템 추가 이후: WEAPON_TYPES에 없으면 ARMOR_TYPES(→ACCESSORY_TYPES)도 찾아봄. 아이템 id는
// 도감 간에 겹치지 않으므로 기존 무기 id 조회 동작은 완전히 그대로 유지됨(항상 WEAPON_TYPES가 먼저
// 검사됨). 이렇게 하면 이름/등급색상/아이콘/툴팁 등 "장비 전역 설정"에 해당하는 함수들을 방어구에도
// 그대로 재사용할 수 있음 — 단, atk/speed/crit 등 무기 전용 필드를 쓰는 함수(atkFor 등)는 방어구
// id로 호출하면 안 됨(호출부에서 equipType으로 구분해서 사용).
function wpn(type){ return WEAPON_TYPES[type] || ARMOR_TYPES[type] || ACCESSORY_TYPES[type] || WEAPON_TYPES.longsword; }
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
// 무기 아이콘을 표시하는 모든 화면(강화/인벤토리/상점/보상 등)에서 공통으로 쓰는 <img> HTML 생성 함수.
// PNG가 없거나 로드에 실패하면 onerror로 WEAPON_IMAGE_FALLBACK(common_shortsword)로 자동 대체됨.
// 화면마다 크기가 다르므로 className만 다르게 넘겨서 CSS로 크기만 조절하고, 출력 방식 자체는 항상 동일함.
// 새 무기를 WEAPON_TYPES에 image 필드와 함께 등록하기만 하면 이 함수를 거치는 모든 화면에 자동 반영됨.
// 무기 종류(weaponKind)가 단검이면 실제 이미지 파일은 그대로 두고 kind-dagger 클래스(CSS transform:scale)만
// 추가로 붙여 다른 무기보다 30% 작게 출력함(강화 화면의 setBladeShape와 동일한 축소 비율) — 무기 데이터를
// 개별 수정하는 방식이 아니라 무기 종류 판정만으로 자동 적용되므로, 새로 등록되는 단검에도 자동 반영됨.
function weaponIconHtml(type, className){
  const w = wpn(type);
  const kindCls = w.weaponKind === 'dagger' ? ' weapon-icon-dagger' : '';
  const cls = 'weapon-icon-img' + (className ? ' ' + className : '') + kindCls;
  // 방어구/장신구는 무기용 폴백(공용 숏소드 이미지)으로 대체하면 오히려 혼란스러우므로, 실패 시 그냥
  // 자기 경로를 유지함(이미지가 없으면 빈 아이콘으로 보임 — 해당 종류 PNG 에셋 추가 시 자동 해결됨).
  const fallback = (w.equipType === 'armor' || w.equipType === 'accessory') ? weaponImagePath(type) : weaponImageFallbackPath();
  return `<img src="${weaponImagePath(type)}" class="${cls}" alt="" onerror="this.onerror=null;this.src='${fallback}';">`;
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
function buildArmorTooltipHtml(type, level){
  const a = wpn(type);
  const grade = WEAPON_GRADES[a.grade];
  const lvl = level != null ? level : 0;
  let html = `<div style="text-align:center;">`;

  const nameLine = a.name + ' +' + lvl;
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
// ---- 방어구 방어력 → 피해 감소 공식 ----
// 최종 데미지 비율 = {(200 + 방어도) / 20}² × 0.01. 방어도는 음수 값(0 이하)만 사용됨.
// 결과는 퍼센트 기준 소수 둘째 자리에서 반올림(비율로는 소수 넷째 자리). 플레이어/몬스터 공용 공식으로
// 설계됨 — 현재는 플레이어(착용 방어구 합산)에만 적용되고, 몬스터 쪽은 이후 별도로 연결될 예정.
// ※ 기획 문서의 예시(방어도 -12 → 72.25%)는 이 식을 그대로 계산하면 88.36%가 나와 문서 예시와
// 어긋남 — 식 자체는 문서에 적힌 그대로 구현했고, 예시 쪽 오탈자로 보여 별도로 알려드림.
function defenseDamageMultiplier(defense){
  const raw = Math.pow((200 + (defense || 0)) / 20, 2) * 0.01;
  return Math.round(raw * 10000) / 10000;
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
// 방어도/체력/마나/치명타 보너스에 실제로 기여하는 "착용 중인 모든 방어형 장비"(방어구+장신구) 목록.
// 무기는 포함하지 않음(무기는 별도의 effectiveAtk 등으로 처리됨).
function wornEquipmentItems(){ return wornArmorItems().concat(wornAccessoryItems()); }
// 착용 중인 방어구+장신구 전체의 방어도 합산.
function playerTotalDefense(){
  return wornEquipmentItems().reduce((sum, item) => sum + (defenseFor(item.type, item.level) || 0), 0);
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
function buildAccessoryTooltipHtml(type, level){
  const a = wpn(type);
  const grade = WEAPON_GRADES[a.grade];
  const lvl = level != null ? level : 0;
  let html = `<div style="text-align:center;">`;

  const nameLine = a.name + ' +' + lvl;
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
// ---- 아티팩트 이름 색상 · 툴팁 ----
// 등급 가치 시스템(WEAPON_GRADES)을 그대로 재사용. 아티팩트는 강화 단계가 없으므로 무기처럼
// "강화 단계 색상과 비교해 더 높은 쪽" 로직 없이 등급 색상을 그대로 이름에 적용함.
function artifactGradeLabel(id){ const g = WEAPON_GRADES[ARTIFACTS[id].grade]; return g ? g.label : ''; }
function artifactGradeColor(id){ const g = WEAPON_GRADES[ARTIFACTS[id].grade]; return g ? g.color : '#ffffff'; }
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
// ---- 무기 고유 옵션(에픽/유니크 전용) ----
// 활성화 조건(강화 단계)을 만족하는지는 항상 "현재 강화 단계"를 기준으로 그때그때 판단함(별도 상태 저장 없음) —
// 강화 단계가 활성화 조건 아래로 내려가면 즉시 비활성화되고, 다시 조건을 만족하면 다시 활성화됨.
function weaponUniqueOptionActive(type, level){
  const opt = wpn(type).uniqueOption;
  return !!(opt && level >= opt.activateLevel);
}
// 고유 옵션의 현재 발동 수치(%). 아직 활성화 조건(activateLevel) 미만이라면, 툴팁 미리보기용으로
// 활성화 조건 시점의 수치를 대신 반환함(비활성 상태에서도 "몇 %짜리 옵션인지"는 미리 보여줘야 하므로).
function weaponUniqueOptionChance(type, level){
  const opt = wpn(type).uniqueOption;
  if(!opt) return null;
  const lookupLevel = level >= opt.activateLevel ? level : opt.activateLevel;
  return opt.chanceByLevel[lookupLevel] != null ? opt.chanceByLevel[lookupLevel] : null;
}
// 무기 툴팁에 표시할 고유 옵션 줄. 고유 옵션이 없는 무기는 빈 문자열을 반환(줄 자체가 생기지 않음).
// 활성화 상태: 기존 무기 툴팁 서식(값 노란색)을 그대로 사용하고 활성화 조건 안내는 표시하지 않음.
// 비활성화 상태: 회색 텍스트로 표시하고, "(+N 활성화)" 조건 안내를 아래 줄에 덧붙임.
function weaponUniqueOptionTooltipHtml(type, level){
  const opt = wpn(type).uniqueOption;
  if(!opt) return '';
  const chance = weaponUniqueOptionChance(type, level);
  if(chance == null) return '';
  const text = opt.textTemplate.replace('{chance}', chance);
  if(weaponUniqueOptionActive(type, level)) return wtipRow('', text);
  return `<div style="color:var(--forge-cream-dim); margin-bottom:2px;">${text}<br>(+${opt.activateLevel} 활성화)</div>`;
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
function atkFor(type, level){ return wpn(type).atk[level]; }

// ---- 강화 화면의 고유 옵션 표시(현재 단계 → 다음 단계 미리보기) ----
// uniqueOption이 있는 무기라면 자동으로 이 함수가 호출되어 강화 화면에 항목이 표시됨(무기별 개별 코드 없음).
// textTemplate 작성 규칙: "{chance}%" 형태로 붙여서 써야 함(예: '...{chance}% 확률로...') — 수치가 다음 단계에서
// 오르는 경우 "{chance}%" 부분 전체를 formatStatDelta 결과(화살표+증가량 표시)로 치환하기 때문.
// 반환값이 null이면 무기에 고유 옵션이 없다는 뜻 — 호출부(render.js)에서 이 값으로 표시 여부를 결정함.
function weaponUniqueOptionForgeHtml(type, level){
  const opt = wpn(type).uniqueOption;
  if(!opt) return null;

  const activeNow = weaponUniqueOptionActive(type, level);
  const hasNext = level < MAX_LEVEL;
  const activeNext = hasNext ? weaponUniqueOptionActive(type, level+1) : activeNow;
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
  return Math.round(10 + Math.pow(level - 1, 1.65));
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
function isSkillLearned(id){
  const s = SKILLS[id];
  if(!s) return false;
  const list = s.category === 'awakening' ? state.learnedAwakeningSkills : state.learnedSkills;
  return Array.isArray(list) && list.includes(id);
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
// 공용/특화가 스킬 포인트를 공유하기 때문에 생기는 습득 제한(요구사항 4번): 같은 레벨 제한 + 같은 종류
// (공격/버프/패시브)의 스킬은 하나만 습득 가능. 기연(awakening)은 별도 포인트를 쓰므로 이 제한을 적용하지 않음.
function hasConflictingLearnedSkill(id){
  const s = SKILLS[id];
  if(!s || s.category === 'awakening') return false;
  const kind = skillKindOf(s);
  return (state.learnedSkills || []).some(otherId => {
    if(otherId === id) return false;
    const other = SKILLS[otherId];
    return other && other.levelReq === s.levelReq && skillKindOf(other) === kind;
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
  if(s.desc) html += `<div style="color:var(--forge-cream-dim); margin-bottom:4px;">${s.desc}</div>`;
  if(s.cooldown != null) html += wtipRow('쿨타임', s.cooldown + '초');
  if(s.resourceType != null){
    const resourceLabel = s.resourceType === 'hp' ? '체력' : '마나';
    html += wtipRow('', `${resourceLabel} ${s.resourceAmount}`);
  }
  if(s.levelReq != null) html += wtipRow('', 'LV' + s.levelReq);
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
// 지금 습득할 수 있는지(포인트 충분 + 아직 미습득 + 습득 제한에 걸리지 않음). 에픽/유니크는 해금 방식이
// 아직 구현되지 않아(비급/깨달음 소비 예정) 항상 불가로 처리 — SKILLS에 실제 항목이 등록되고 해금 로직이
// 추가되면 이 부분만 손보면 됨.
function canLearnSkill(id){
  const s = SKILLS[id];
  if(!s || isSkillLearned(id)) return false;
  if(s.grade === 'epic' || s.grade === 'unique') return false;
  if(hasConflictingLearnedSkill(id)) return false;
  const pool = s.category === 'awakening' ? (state.awakeningPoints || 0) : (state.skillPoints || 0);
  return pool >= (s.cost || 1);
}
// 아티팩트로 증가하는 원시 스탯(힘/민첩/지능) 보너스. 캐릭터 정보창에서 기본값과 구분해
// 초록색 "(+N)"으로 표시하는 데도 사용됨(render.js renderStatAllocRow 참고).
function artifactStatBonus(stat){
  let bonus = 0;
  if(stat === 'str'){
    if(isArtifactEquipped('antlerflag')) bonus += 2;
    if(isArtifactEquipped('oldarmguard')) bonus += 3;
    if(isArtifactEquipped('blackarmguard')) bonus += 5;
  }
  if(stat === 'agi'){
    if(isArtifactEquipped('blackarmguard')) bonus += 3;
  }
  return bonus;
}
// 스탯 보너스가 반영된 실질 최대 체력/마나
function effectiveMaxHp(level){
  const s = state.stats || { str: 0, agi: 0, int: 0 };
  const str = (s.str || 0) + artifactStatBonus('str');
  const agi = (s.agi || 0) + artifactStatBonus('agi');
  let hp = playerBaseHp(level) + str * 20 + agi * 5;
  if(isArtifactEquipped('antlerflag')) hp += 500; // 힘 보너스와 별개로 적용되는 고정 체력 보너스
  hp += learnedPassiveSkillBonus('hpFlat'); // 습득한 패시브 스킬(예: 모험가의 의지)의 고정 체력 보너스
  hp += armorStatBonus('hp'); // 착용 중인 방어구의 체력 보너스 합산
  return hp;
}
function effectiveMaxMp(level){
  const s = state.stats || { str: 0, agi: 0, int: 0 };
  let mp = playerBaseMp(level) + (s.int || 0) * 30;
  if(isArtifactEquipped('ring')) mp += 500;
  mp += armorStatBonus('mana'); // 착용 중인 방어구의 마나 보너스 합산
  return mp;
}
function effectiveAtkSpeed(type, level){
  let s = atkSpeedFor(type, level);
  if(isArtifactEquipped('batwing')) s *= 1.05;
  const agi = ((state.stats && state.stats.agi) || 0) + artifactStatBonus('agi');
  s *= 1 + agi * 0.001; // 민첩 1당 공격속도 +0.1%
  s *= 1 + activeBuffBonus('atkSpeedPercent') / 100; // 활성화된 버프 스킬(예: 선공)의 공격속도% 보너스
  return s;
}
function effectiveAtk(type, level){
  const str = ((state.stats && state.stats.str) || 0) + artifactStatBonus('str');
  const agi = ((state.stats && state.stats.agi) || 0) + artifactStatBonus('agi');
  // 힘 1당 공격력 +2, 민첩 1당 공격력 +1, 활성화된 버프 스킬(예: 분노)의 고정 공격력 보너스를 더함
  return atkFor(type, level) + str * 2 + agi * 1 + activeBuffBonus('atkFlat');
}
// 아티팩트 치명타 확률 보너스가 반영된 실질 치명타 확률. 무기 자체 수치(critChanceFor)는 툴팁/강화화면
// 미리보기에서 그대로 쓰이고(무기 하나만의 값을 보여줘야 하므로), 실제 전투 판정과 캐릭터 정보창의
// "총 치명타 확률"에는 이 함수를 사용함(effectiveAtk와 동일한 역할 분담).
function effectiveCritChance(type, level){
  let bonus = 0;
  if(isArtifactEquipped('oldarmguard')) bonus += 3;
  if(isArtifactEquipped('blackarmguard')) bonus += 8;
  bonus += armorStatBonus('crit'); // 착용 중인 방어구/장신구의 치명타 확률 보너스 합산
  // 무기 자체의 "치명타 확률 증가" 계열 고유 옵션(effectId: crit_chance_bonus)도 합연산 적용.
  // 다른 무기가 같은 effectId로 고유 옵션을 등록해도 이 함수를 수정할 필요 없이 자동으로 반영됨.
  const opt = wpn(type).uniqueOption;
  if(opt && opt.effectId === 'crit_chance_bonus' && weaponUniqueOptionActive(type, level)){
    bonus += weaponUniqueOptionChance(type, level) || 0;
  }
  return critChanceFor(type, level) + bonus;
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

// ---- 몬스터 체력/공격력 ----
// 일반: Lv1=150, 이후 (이전 레벨 HP + 50) x 1.08 / 에픽: 같은 레벨 일반 몬스터의 3배(수정 없음)
function normalMonsterHP(level){
  let hp = 150;
  for(let l = 2; l <= level; l++){
    hp = (hp + 50) * 1.08;
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
// 폴백 후보 선정: 최우선 조건으로 "아이템 레벨이 targetLevel(몬스터 레벨)과 같거나 낮은" 무기만 남긴 뒤,
// 그 중 targetLevel과 아이템 레벨 차이가 가장 작은 무기들만 남김(동률이면 전부 후보로 남음).
function nearestLevelCandidates(list, targetLevel){
  const eligible = list.filter(w => w.levelReq <= targetLevel);
  if(eligible.length === 0) return [];
  let minDiff = Infinity;
  eligible.forEach(w => { const diff = targetLevel - w.levelReq; if(diff < minDiff) minDiff = diff; });
  return eligible.filter(w => (targetLevel - w.levelReq) === minDiff);
}
// 모험가의 유해(무기) 드랍 판정.
// 1) RELIC_DROP_CHANCE 확률로 드랍 판정 → 2) RELIC_GRADE_CHANCE로 장비 등급 선택 →
// 3) 그 등급 중 아이템 레벨이 [max(1, 몬스터레벨-RELIC_LEVEL_WINDOW), 몬스터레벨] 구간인 후보만 필터 →
//    (후보가 없으면 폴백: ① 같은 등급 안에서 레벨 구간 제한 없이 몬스터 레벨과 가장 가까운 아이템 레벨로 대체
//     ② 그래도 없으면(해당 등급 무기가 아예 없음) 등급 상관없이 몬스터 레벨과 가장 가까운 무기로 대체) →
// 4) 후보의 "등록된 레벨" 종류를 내림차순으로 최고 레벨 가중치 100, 한 단계 낮아질 때마다 ×RELIC_LEVEL_WEIGHT_DECAY로 레벨 추첨 →
// 5) 그 레벨(+같은 등급, 폴백된 경우는 폴백된 등급)에 해당하는 무기 중 하나를 무작위로 선택 →
// 6) RELIC_ENHANCE_LEVEL_CHANCE 확률표(등급별로 분리: 일반 +0~+4, 레어 +0~+3, 에픽 +0 고정, 유니크 +0 고정)로 강화 단계를 추첨.
//    최종 선택된 무기(weaponType)의 등급을 기준으로 표를 고름(폴백 ②로 등급이 바뀌었을 수 있으므로,
//    최초 추첨된 grade가 아니라 실제로 지급되는 weaponType.grade를 사용).
function resolveWeaponRelicDrop(monsterLevel){
  if(Math.random() * 100 >= RELIC_DROP_CHANCE) return null;

  const grade = pickWeighted(Object.entries(RELIC_GRADE_CHANCE));

  const minLevel = Math.max(1, monsterLevel - RELIC_LEVEL_WINDOW);
  const maxLevel = monsterLevel;
  let candidates = Object.values(WEAPON_TYPES).filter(w =>
    w.grade === grade && w.levelReq >= minLevel && w.levelReq <= maxLevel
  );
  if(candidates.length === 0){
    // 폴백 ①: 레벨 구간 제한을 풀고, 같은 등급 안에서 몬스터 레벨 이하 중 가장 가까운 레벨로 대체
    candidates = nearestLevelCandidates(Object.values(WEAPON_TYPES).filter(w => w.grade === grade), monsterLevel);
  }
  if(candidates.length === 0){
    // 폴백 ②: 이 등급에 등록된 무기가 아예 없으면(예: 유니크처럼 아직 등록된 무기가 없는 등급), 등급도 무시하고 몬스터 레벨 이하 중 가장 가까운 무기로 대체
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
  const enhanceTable = RELIC_ENHANCE_LEVEL_CHANCE[weaponType.grade] || RELIC_ENHANCE_LEVEL_CHANCE.normal;
  const enhanceLevel = pickWeighted(enhanceTable);
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
  const weaponIdDrops = [];
  for(const drop of (monsterDef.drops || [])){
    if(!drop.weaponId) continue;
    if(Math.random() * 100 < drop.chance){
      weaponIdDrops.push({ type: drop.weaponId, level: 0 });
    }
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

  return { gold, weaponDrop, weaponIdDrops, stoneDrop, artifactDropIds, miscDrops };
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
