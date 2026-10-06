// ============================================================
// codex_monster.js — 몬스터 도감
// 가로 탭 [몬스터]의 내용: 등급 체크박스(MONSTER_GRADES 기준, 레어 없음) + 검색(몬스터/던전/드랍 아이템 이름) +
// 세로 탭(즐겨찾기 + 던전 region으로 자동 생성되는 지역 탭) + 5×8 그리드 + 아이콘 클릭 메뉴 + 몬스터 정보(단일 패널).
// 장비 도감(codex.js)의 모양(.codex-* / .inv-box-* 스타일)과 일부 공용 함수(즐겨찾기 저장, 팝업, 툴팁 표시)를
// 재사용하지만, 목록/필터/검색/정보 화면은 DOM id와 로직을 완전히 분리해 장비 도감에 영향을 주지 않음.
// 이 파일은 데이터(MONSTERS / DUNGEONS)와 기존 계산·드랍 판정 함수를 "읽어서 표시"만 하며 게임 시스템은 바꾸지 않음.
// 새 몬스터/던전/지역이 데이터에 추가되면 이 파일을 고치지 않아도 목록·세로 탭·검색에 자동 반영됨.
// ============================================================

const CODEX_MONSTER_KEY_PREFIX = 'monster:';   // 즐겨찾기 key — 장비 key('weapon:id' 등)와 겹치지 않도록 접두어로 구분
const CODEX_MONSTER_REGION_PREFIX = 'region:'; // 세로 탭 id(즐겨찾기 'favorites'와 구분)
const CODEX_MONSTER_SEARCH_MAX_RESULTS = 60;

// 드랍 아이템(정보 화면/드랍 이름 검색)을 판정할 때 쓰는 몬스터 레벨 기준.
// true : 일반 등급 몬스터는 던전에서 실제로 생성될 수 있는 레벨 구간(몬스터 레벨 ~ 레벨+던전 levelRange)을 기준으로 판정 —
//        던전 입구 카드의 획득 가능 아이템(buildDungeonDropIcons)과 같은 방식이라 실제 게임과 가장 잘 맞음.
// false: 몬스터 데이터에 등록된 기본 level 하나만 기준으로 판정.
// (화면에 보이는 레벨/체력/공격력은 이 값과 상관없이 항상 기본 level 기준)
const CODEX_MONSTER_DROP_USE_SPAWN_RANGE = true;

// 드랍 아이템 표시 순서(그룹). 같은 그룹 안에서는 등급 내림차순 → 이름 가나다순.
const CODEX_MONSTER_DROP_GROUPS = ['relic', 'scroll', 'table', 'stone', 'flask', 'gold'];

// ---- 화면 상태(저장하지 않음, 즐겨찾기만 state.codexFavorites에 저장) ----
// cat: 세로 탭 id / grades: 등급 id → 체크 여부(기본 전부 체크) / query: 검색어 / infoKey: 정보 화면에 열린 몬스터 key
let codexMUI = { cat: null, grades: {}, query: '', focusKey: null, resultsOpen: false, infoKey: null };
let codexMEntries = [];     // 현재 데이터 기준 몬스터 엔트리(도감 화면에 들어올 때마다 새로 만듦, 지역 탭 정렬 규칙으로 정렬됨)
let codexMEntryByKey = {};
let codexMRegions = [];     // 던전 데이터에 등장하는 지역 이름(데이터 등록 순서)

function codexMonsterGradeIds(){ return Object.keys(MONSTER_GRADES); }
function codexMonsterGradeRank(grade){ const i = codexMonsterGradeIds().indexOf(grade); return i < 0 ? codexMonsterGradeIds().length : i; }
function codexMonsterGradeOn(grade){ return codexMUI.grades[grade] !== false; }

// ============================================================
// 드랍 아이템 목록(정보 화면 + 드랍 이름 검색 공용)
// ============================================================
// 이 몬스터의 드랍을 판정할 레벨 목록(오름차순). CODEX_MONSTER_DROP_USE_SPAWN_RANGE 설명 참고.
function codexMonsterDropLevels(e){
  const set = new Set([e.def.level]);
  if(CODEX_MONSTER_DROP_USE_SPAWN_RANGE && e.def.grade === 'normal'){ // 일반 등급만 레벨 구간이 있음(dungeonLevelRange와 같은 기준)
    e.dungeons.forEach(d => { for(let i = 1; i <= (d.levelRange || 0); i++) set.add(e.def.level + i); });
  }
  return [...set].sort((a, b) => a - b);
}
// 장비 id → 정의(없으면 null). wpn()은 없는 id를 기본 검으로 대체하므로 존재 여부를 따로 확인함.
function codexEquipDef(id){
  return WEAPON_TYPES[id] || ARMOR_TYPES[id] || ACCESSORY_TYPES[id] || SUB_TYPES[id] || null;
}
function codexEquipTooltipAtZero(id){ // 던전 입구 카드의 장비 드랍 툴팁과 같은 규칙(+0 기준)
  const equipType = wpn(id).equipType;
  return equipType === 'armor' ? buildArmorTooltipHtml(id, 0)
    : equipType === 'accessory' ? buildAccessoryTooltipHtml(id, 0)
    : equipType === 'sub' ? buildSubTooltipHtml(id, 0)
    : buildWeaponTooltipHtml(id, 0);
}
// 모험가의 유해가 이 레벨에서 실제로 나올 수 있는지(resolveWeaponRelicDrop과 같은 조건: 장비 타입·등급 확률이 0보다 크고,
// min(몬스터 레벨+10, RELIC_LEVEL_CAP) 이하 장비가 그 등급에 하나라도 있음). 조건 판정만 하고 추첨은 하지 않음.
function codexRelicPossibleAt(level){
  if(!(RELIC_DROP_CHANCE > 0)) return false;
  const maxDropLevel = Math.min(level + 10, RELIC_LEVEL_CAP);
  return Object.entries(RELIC_EQUIP_TYPE_CHANCE).some(([equipType, typeChance]) => {
    if(!(typeChance > 0)) return false;
    const pool = EQUIP_INVENTORY_POOLS.find(p => p.kind === equipType);
    if(!pool || !pool.typesTable) return false;
    const gradeChances = RELIC_GRADE_CHANCE[equipType] || {};
    return Object.entries(gradeChances).some(([grade, chance]) =>
      chance > 0 && Object.values(pool.typesTable).some(w => w.grade === grade && w.levelReq <= maxDropLevel));
  });
}
function codexGradeRankOf(grade){ return (grade && WEAPON_GRADE_RANK[grade] != null) ? WEAPON_GRADE_RANK[grade] : -1; } // 등급 없는 아이템은 가장 낮게

// 몬스터 하나의 드랍 아이콘 목록. 항목: { group, id, name(표시 이름), searchName(검색 대상 이름), gradeRank, iconHtml, borderColor, tooltipHtml }
function codexMonsterBuildDrops(e){
  const levels = codexMonsterDropLevels(e);
  const out = [];
  const seen = new Set();
  const add = (item) => { if(seen.has(item.group + ':' + item.id)) return; seen.add(item.group + ':' + item.id); out.push(item); };

  // 1. 모험가의 유해(전역 드랍) — 던전 카드와 같은 아이콘/문구
  if(levels.some(codexRelicPossibleAt)){
    add({ group: 'relic', id: 'relic', name: '모험가의 유해', searchName: '모험가의 유해', gradeRank: -1,
      iconHtml: uiIconHtml('relic', 'item-icon-img'), borderColor: 'var(--forge-green)',
      tooltipHtml: `<span class="txt-relic">모험가의 유해</span><br>낮은 확률로 쓰러진 모험가의 장비를 획득합니다.` });
  }

  // 2. 비급(전역 드랍) — rollScrollDrop과 같은 후보 조건: 비급 요구 레벨이 [몬스터 레벨-10, 몬스터 레벨] 안
  allScrollItems().forEach(item => {
    const lv = scrollBaseLevel(item);
    if(lv == null || !levels.some(L => lv <= L && lv >= L - 10)) return;
    const g = scrollGradeInfo(item);
    add({ group: 'scroll', id: item.id, name: item.name, searchName: '[비급] ' + item.name, gradeRank: codexGradeRankOf(item.grade),
      iconHtml: itemIconHtml({ image: item.image || SCROLL_DEFAULT_IMAGE, icon: item.icon || '📜', grade: item.grade }),
      borderColor: g ? g.color : 'var(--forge-line)', tooltipHtml: buildConsumableTooltipHtml(item.id) });
  });

  // 3. 몬스터 드랍 테이블(MONSTERS[].drops) — 장비(weaponId) / 아티팩트(artifactId) / 기타 재료(이름으로 MISC_ITEMS와 연결).
  //    실제 아이템 데이터와 연결되지 않는 항목(표시용 데이터)은 던전 카드와 마찬가지로 만들지 않음.
  (e.def.drops || []).forEach(drop => {
    if(drop.weaponId){
      const def = codexEquipDef(drop.weaponId);
      if(!def) return;
      add({ group: 'table', id: 'equip:' + drop.weaponId, name: def.name, searchName: def.name, gradeRank: codexGradeRankOf(def.grade),
        iconHtml: weaponIconHtml(drop.weaponId, 'codex-drop-img'), borderColor: weaponGradeColor(drop.weaponId),
        tooltipHtml: codexEquipTooltipAtZero(drop.weaponId) });
    } else if(drop.artifactId){
      const def = ARTIFACTS[drop.artifactId];
      if(!def) return;
      add({ group: 'table', id: 'artifact:' + drop.artifactId, name: def.name, searchName: def.name, gradeRank: codexGradeRankOf(def.grade),
        iconHtml: itemIconHtml(def), borderColor: artifactGradeColor(drop.artifactId),
        tooltipHtml: buildArtifactTooltipHtml(drop.artifactId) });
    } else {
      const item = miscItemByName(drop.name);
      if(!item || item.itemClass !== 'misc') return;
      add({ group: 'table', id: 'misc:' + item.id, name: item.name, searchName: item.name, gradeRank: codexGradeRankOf(item.grade),
        iconHtml: itemIconHtml(item), borderColor: miscNameColor(item.id), tooltipHtml: buildMiscTooltipHtml(item.id) });
    }
  });

  // 4. 마석(전역 드랍) — stonePossibleGrades(전역 구간표)가 이 레벨들에서 낼 수 있는 모든 등급의 마석
  levels.forEach(L => stonePossibleGrades(L).forEach(grade => {
    const item = Object.values(MISC_ITEMS).find(m => m.itemClass === 'stone' && m.grade === grade);
    if(!item) return;
    add({ group: 'stone', id: item.id, name: item.name, searchName: item.name, gradeRank: codexGradeRankOf(item.grade),
      iconHtml: itemIconHtml(item), borderColor: stoneNameColor(item.id), tooltipHtml: buildStoneTooltipHtml(item.id) });
  }));

  // 5. 플라스크(전역 드랍) — pickFlaskTier가 이 레벨들에서 고르는 단계의 체력/마나 두 종류 모두(종류는 레벨과 무관)
  levels.forEach(L => {
    const tier = pickFlaskTier(L);
    ['hpFlask', 'mpFlask'].forEach(prefix => {
      const item = CONSUMABLES[prefix + tier];
      if(!item) return;
      add({ group: 'flask', id: item.id, name: item.name, searchName: item.name, gradeRank: codexGradeRankOf(item.grade),
        iconHtml: itemIconHtml(item), borderColor: 'var(--forge-line)', tooltipHtml: buildConsumableTooltipHtml(item.id) });
    });
  });

  // 6. 골드 — 실제 금액은 표시하지 않고 아이콘만(던전 카드와 같은 아이콘/문구)
  add({ group: 'gold', id: 'gold', name: '골드', searchName: '골드', gradeRank: -1,
    iconHtml: uiIconHtml('gold', 'item-icon-img'), borderColor: 'var(--forge-gold)',
    tooltipHtml: `<span class="txt-gold">골드</span><br>몬스터 처치 시 골드를 획득합니다.` });

  // 정렬: 그룹 순서 → 등급 내림차순 → 이름 가나다순
  out.sort((a, b) => {
    const ga = CODEX_MONSTER_DROP_GROUPS.indexOf(a.group), gb = CODEX_MONSTER_DROP_GROUPS.indexOf(b.group);
    if(ga !== gb) return ga - gb;
    if(a.gradeRank !== b.gradeRank) return b.gradeRank - a.gradeRank;
    return a.name.localeCompare(b.name, 'ko');
  });
  return out;
}

// ============================================================
// 데이터 → 엔트리
// ============================================================
// 몬스터 툴팁: 이름(등급 색) / 등급(등급 색) / 레벨(노란색, MONSTERS에 등록된 기본 level)
function codexMonsterTooltipHtml(def){
  const g = MONSTER_GRADES[def.grade];
  const color = g ? g.color : '#ffffff';
  return `<div style="text-align:center;">`
    + `<div style="color:${color}; font-weight:700; margin-bottom:2px;">${def.name}</div>`
    + (g ? `<div style="color:${color}; font-weight:700; margin-bottom:4px;">${g.label}</div>` : '')
    + `<div style="color:var(--forge-gold);">Lv.${def.level}</div></div>`;
}
// 지역 탭 정렬: ① 몬스터 기본 level 오름차순 ② 등급(MONSTER_GRADES 순서) ③ 이름 가나다순
function codexMonsterCompare(a, b){
  if(a.level !== b.level) return a.level - b.level;
  if(a.gradeRank !== b.gradeRank) return a.gradeRank - b.gradeRank;
  return a.name.localeCompare(b.name, 'ko');
}
// 즐겨찾기 탭 정렬 = 위 규칙의 역순(레벨↓ → 등급↓ → 이름 가나다순), 장비 도감 즐겨찾기와 같은 방식
function codexMonsterCompareFavorites(a, b){
  if(a.level !== b.level) return b.level - a.level;
  if(a.gradeRank !== b.gradeRank) return b.gradeRank - a.gradeRank;
  return a.name.localeCompare(b.name, 'ko');
}
// 던전(DUNGEONS)의 region과 monsters를 훑어 몬스터 엔트리를 만듦. 몬스터 데이터에는 지역이 없으므로 항상 던전을 거침.
// 같은 몬스터가 여러 던전/지역에 있어도 엔트리는 하나(regions/dungeons에 모두 담김).
function codexMonsterBuildEntries(){
  const byId = {};
  const regionOrder = [];
  DUNGEONS.forEach(d => {
    const region = dungeonRegionOf(d);
    if(!regionOrder.includes(region)) regionOrder.push(region);
    (d.monsters || []).forEach(id => {
      const def = MONSTERS[id];
      if(!def) return;
      const e = byId[id] || (byId[id] = { id, def, regions: [], dungeons: [] });
      if(!e.regions.includes(region)) e.regions.push(region);
      if(!e.dungeons.some(x => x.id === d.id)) e.dungeons.push({ id: d.id, name: d.name, levelRange: d.levelRange || 0 });
    });
  });
  codexMRegions = regionOrder;
  const list = Object.values(byId).map(e => {
    const def = e.def;
    const g = MONSTER_GRADES[def.grade];
    e.key = CODEX_MONSTER_KEY_PREFIX + def.id;
    e.src = 'monster';
    e.name = def.name;
    e.grade = def.grade;
    e.level = def.level;
    e.gradeRank = codexMonsterGradeRank(def.grade);
    e.color = g ? g.color : '#ffffff';
    // 아이콘: 등급 배경(icon-grade-bg, 장비 아이콘과 같은 레이어) + 몬스터 이미지(없으면 이모지). 강화 발광 효과는 없음.
    // 크기는 CSS(--codex-monster-icon-size)가 정함.
    const bgCls = gradeIconBgClass(def.grade);
    const icon = monsterIconHtml(def, 'codex-monster-icon');
    e.iconHtml = bgCls ? `<span class="${bgCls}">${icon}</span>` : icon;
    e.tooltipHtml = codexMonsterTooltipHtml(def);
    e.drops = codexMonsterBuildDrops(e);
    return e;
  });
  return list.sort(codexMonsterCompare);
}

// ---- 세로 탭 ----
function codexMonsterCategories(){
  const list = [{ id: CODEX_FAVORITES_ID, label: CODEX_FAVORITES_LABEL }]; // 즐겨찾기: 항상 최상단 고정
  codexMRegions.forEach(r => list.push({ id: CODEX_MONSTER_REGION_PREFIX + r, label: r })); // 지역 탭: 던전 데이터에서 자동 생성
  return list;
}
function codexMonsterCatRegion(catId){
  return (catId && catId.startsWith(CODEX_MONSTER_REGION_PREFIX)) ? catId.slice(CODEX_MONSTER_REGION_PREFIX.length) : null;
}

// ---- 검색 ----
// 몬스터 이름 / 출현 던전 이름 / 드랍 아이템 이름 중 하나라도 검색어를 포함하면 일치. 어떻게 일치했는지(표시용)도 함께 돌려줌.
function codexMonsterMatch(e, q){
  if(!q) return { kind: 'all' };
  if(e.name.toLowerCase().includes(q)) return { kind: 'name' };
  const d = e.dungeons.find(x => x.name.toLowerCase().includes(q));
  if(d) return { kind: 'dungeon', text: d.name };
  const it = e.drops.find(x => x.searchName.toLowerCase().includes(q));
  if(it) return { kind: 'drop', text: it.searchName };
  return null;
}
function codexMonsterNormQuery(){ return codexMUI.query.trim().toLowerCase(); }
// 현재 목록 = 선택한 세로 탭(지역 또는 즐겨찾기) + 체크된 등급 + 검색 일치. 즐겨찾기한 몬스터는 지역 탭에도 그대로 표시됨.
function codexMonsterFiltered(){
  const q = codexMonsterNormQuery();
  const favTab = codexMUI.cat === CODEX_FAVORITES_ID;
  const region = codexMonsterCatRegion(codexMUI.cat);
  const list = codexMEntries.filter(e =>
    (favTab ? codexIsFavorite(e.key) : (region != null && e.regions.includes(region)))
    && codexMonsterGradeOn(e.grade) && codexMonsterMatch(e, q));
  return favTab ? list.sort(codexMonsterCompareFavorites) : list;
}
// 검색 결과 목록 = 몬스터 도감 전체(세로 탭/등급 체크와 무관, 장비는 포함되지 않음)
function codexMonsterSearchResults(){
  const q = codexMonsterNormQuery();
  if(!q) return [];
  return codexMEntries.map(e => ({ e, m: codexMonsterMatch(e, q) })).filter(r => r.m);
}

// ============================================================
// 렌더
// ============================================================
function codexMonsterRenderVTabs(){
  el('codexMVTabs').innerHTML = codexMonsterCategories().map((c, i) => {
    const cls = (c.id === codexMUI.cat ? ' active' : '') + (c.id === CODEX_FAVORITES_ID ? ' codex-vtab-fav' : '') + (i === 1 ? ' codex-vtab-after-fav' : '');
    return `<button class="codex-vtab${cls}" data-cat="${codexEsc(c.id)}">${codexEsc(c.label)}</button>`;
  }).join('');
}
// 등급 체크박스: MONSTER_GRADES 기준(일반/에픽/유니크). 레어는 몬스터 등급에 없으므로 표시되지 않음.
function codexMonsterRenderGradeChecks(){
  el('codexMChecks').innerHTML = codexMonsterGradeIds().map(g =>
    `<label class="codex-check" style="--codex-grade-color:${MONSTER_GRADES[g].color};">`
    + `<input type="checkbox" data-grade="${g}" ${codexMonsterGradeOn(g) ? 'checked' : ''}>`
    + `<span class="codex-checkbox"></span><span class="codex-check-label">${MONSTER_GRADES[g].label}</span></label>`).join('');
}
function codexMonsterRenderGrid(scrollToKey, keepScroll){
  const list = codexMonsterFiltered();
  const total = Math.max(CODEX_MIN_SLOTS, Math.ceil(list.length / CODEX_COLUMNS) * CODEX_COLUMNS); // 5×8=40칸 이상, 넘으면 스크롤
  let cells = '';
  for(let i = 0; i < total; i++){
    if(i < list.length){
      const e = list[i];
      cells += `<div class="inv-box-slot filled codex-slot codex-mslot${e.key === codexMUI.focusKey ? ' flash' : ''}" data-key="${e.key}" style="border-color:${e.color};">${e.iconHtml}${codexFavMarkHtml(e.key)}</div>`;
    } else {
      cells += '<div class="inv-box-slot empty"></div>';
    }
  }
  const scroller = el('codexMGridScroll');
  const prevScroll = scroller.scrollTop;
  el('codexMGrid').innerHTML = cells;
  codexMonsterSyncGridHeight();
  if(keepScroll){
    scroller.scrollTop = prevScroll;
  } else if(scrollToKey){
    const slot = el('codexMGrid').querySelector(`[data-key="${scrollToKey}"]`);
    if(slot) scroller.scrollTop = Math.max(0, slot.offsetTop - 4);
  } else {
    scroller.scrollTop = 0;
  }
}
// 장비 도감(codexSyncGridHeight)과 같은 방식: 항상 8줄 높이로 고정, 실제 슬롯 높이를 측정해서 계산.
function codexMonsterSyncGridHeight(){
  const grid = el('codexMGrid');
  const slot = grid.querySelector('.inv-box-slot');
  const cs = getComputedStyle(grid);
  const gap = parseFloat(cs.rowGap) || 4;
  const padTop = parseFloat(cs.paddingTop) || 0, padBottom = parseFloat(cs.paddingBottom) || 0;
  const h = (slot && slot.getBoundingClientRect().height) || 42;
  const total = Math.round(CODEX_ROWS * h + (CODEX_ROWS - 1) * gap + padTop + padBottom);
  el('codexMGridScroll').style.height = total + 'px';
  el('codexMVTabs').style.maxHeight = total + 'px';
  el('codexWrap').style.setProperty('--codex-grid-h', total + 'px'); // 몬스터 정보 화면도 같은 높이
}
function codexMonsterRenderResults(){
  const box = el('codexMResults');
  const q = codexMonsterNormQuery();
  if(!q || !codexMUI.resultsOpen){ box.style.display = 'none'; return; }
  const results = codexMonsterSearchResults();
  if(results.length === 0){
    box.innerHTML = '<div class="codex-result-empty">검색 결과가 없습니다.</div>';
  } else {
    box.innerHTML = results.slice(0, CODEX_MONSTER_SEARCH_MAX_RESULTS).map(({ e, m }) => {
      let hint;
      if(m.kind === 'dungeon') hint = `던전: ${codexHighlightHtml(m.text, codexMUI.query)}`;
      else if(m.kind === 'drop') hint = `드랍: ${codexHighlightHtml(m.text, codexMUI.query)}`;
      else hint = e.dungeons.map(d => codexEsc(d.name)).join(', ');
      return `<button class="codex-result" data-key="${e.key}"><span style="color:${e.color};">${m.kind === 'name' ? codexHighlightHtml(e.name, codexMUI.query) : codexEsc(e.name)}</span>`
        + `<span class="codex-result-cat">${hint}</span></button>`;
    }).join('');
  }
  box.style.display = 'block';
}
function codexMonsterRender(scrollToKey, keepScroll){
  codexMonsterRenderVTabs();
  codexMonsterRenderGrid(scrollToKey, keepScroll);
  codexMonsterRenderResults();
  codexMonsterRenderInfo();
}

// ---- 화면 진입/이탈 ----
function codexMonsterOpen(){
  codexMEntries = codexMonsterBuildEntries();
  codexMEntryByKey = {};
  codexMEntries.forEach(e => { codexMEntryByKey[e.key] = e; codexEntryByKey[e.key] = e; }); // 툴팁/팝업은 codexEntryByKey로 조회(장비 key와 겹치지 않음)
  const cats = codexMonsterCategories();
  if(!cats.some(c => c.id === codexMUI.cat)){ // 기본 선택은 즐겨찾기가 아니라 첫 번째 지역
    const firstRegion = cats.find(c => c.id !== CODEX_FAVORITES_ID);
    codexMUI.cat = firstRegion ? firstRegion.id : CODEX_FAVORITES_ID;
  }
  codexMUI.infoKey = null;
  codexMUI.query = '';
  codexMUI.focusKey = null;
  codexMUI.resultsOpen = false;
  el('codexMSearchInput').value = '';
  const info = el('codexMInfo'); info.style.display = 'none'; info.innerHTML = '';
  codexMonsterRenderGradeChecks();
}
function codexMonsterOnLeave(){
  codexMUI.infoKey = null;
  codexMUI.resultsOpen = false;
  el('codexMResults').style.display = 'none';
  const info = el('codexMInfo'); if(info){ info.style.display = 'none'; info.innerHTML = ''; }
}

// ---- 검색 결과 선택 → 해당 몬스터가 속한 지역 탭으로 이동 ----
function codexMonsterGoTo(key){
  const e = codexMEntryByKey[key];
  if(!e) return;
  codexUI.tab = 'monster';
  const curRegion = codexMonsterCatRegion(codexMUI.cat);
  if(!(curRegion != null && e.regions.includes(curRegion))) codexMUI.cat = CODEX_MONSTER_REGION_PREFIX + e.regions[0]; // 이미 그 몬스터가 있는 지역 탭이면 유지
  codexMUI.grades[e.grade] = true; // 그 몬스터의 등급이 꺼져 있으면 목록에서 보이도록 켬
  codexMUI.focusKey = key;
  codexMUI.resultsOpen = false;
  codexMonsterRenderGradeChecks();
  codexRender(key);
}

// ============================================================
// 아이콘 클릭 메뉴(장비 도감 팝업 재사용): 정보 / 즐겨찾기(해제)
// ============================================================
CODEX_ACTION_PROVIDERS.monster = (e) => [
  { id: 'info', label: '정보', run: () => codexMonsterOpenInfo(e.key) },
  { id: 'favorite', label: codexIsFavorite(e.key) ? '즐겨찾기 해제' : '즐겨찾기',
    run: () => { codexToggleFavorite(e.key); codexRender(null, true); } }, // 즐겨찾기 탭에서는 해제 즉시 목록에서 사라짐(스크롤 위치 유지)
];

// ============================================================
// 몬스터 정보(단일 패널) — 장비 비교 UI와 별개 구조. 선택한 몬스터 1마리의 정보만 표시(비교 기능 없음).
// ============================================================
// 체력/공격력은 실제 전투와 같은 계산 함수(monsterHPFor/monsterAtkFor)를 몬스터 기본 level로 호출한 최종값.
// 공격 속도는 전투(dungeon.js startMonsterAttackTimer)와 같은 식(MONSTER_ATTACK_SPEED × speedMult)이며 플레이어 공격속도와 같은 '회/초' 표기.
function codexMonsterStats(def){
  const speedMult = (def.speedMult != null) ? def.speedMult : 1;
  return {
    hp: monsterHPFor(def, def.level),
    atk: monsterAtkFor(def, def.level),
    speed: MONSTER_ATTACK_SPEED * speedMult,
    defense: def.defense || 0, // 몬스터 방어도(데이터 값 그대로, 전투 중 상태이상 보정은 포함하지 않음)
  };
}
function codexMonsterInfoRow(label, valueHtml){
  return `<div class="cmi-row"><span class="cmi-label">${label}</span><span class="cmi-val">${valueHtml}</span></div>`;
}
function codexMonsterRenderInfo(){
  const panel = el('codexMInfo');
  const e = codexMEntryByKey[codexMUI.infoKey];
  const body = panel.parentElement; // .codex-body — 정보가 열려 있는 동안 목록(세로 탭+그리드) 자리를 정보 패널이 대신 차지함(CSS .codex-body.cmi-open)
  if(!codexMUI.infoKey || !e){ panel.style.display = 'none'; panel.innerHTML = ''; body.classList.remove('cmi-open'); return; }
  body.classList.add('cmi-open');
  const g = MONSTER_GRADES[e.grade];
  const st = codexMonsterStats(e.def);
  const dropCells = e.drops.map((d, i) =>
    `<span class="codex-mdrop" data-didx="${i}" style="border-color:${d.borderColor};">${d.iconHtml}</span>`).join('');
  panel.innerHTML = `<div class="cmi-body">`
    + `<div class="cmi-section">기본 정보</div>`
    + `<div class="cmi-basic"><div class="inv-box-slot filled codex-mslot cmi-slot" style="border-color:${e.color};">${e.iconHtml}</div>`
    + `<div class="cmi-basic-rows">`
    + codexMonsterInfoRow('이름', `<span style="color:${e.color}; font-weight:700;">${codexEsc(e.name)}</span>`)
    + codexMonsterInfoRow('레벨', `Lv.${e.level}`)
    + codexMonsterInfoRow('등급', `<span style="color:${e.color}; font-weight:700;">${g ? g.label : ''}</span>`)
    + codexMonsterInfoRow('방어도', st.defense)
    + `</div></div>`
    + `<div class="cmi-section">전투 능력치</div>`
    + codexMonsterInfoRow('체력', st.hp.toLocaleString())
    + codexMonsterInfoRow('공격 속도', `${st.speed.toFixed(2)}회/초`)
    + codexMonsterInfoRow('공격력', st.atk.toLocaleString())
    + `<div class="cmi-section">출현 던전</div>`
    + `<div class="cmi-dungeons">${e.dungeons.map(d => `<div>${codexEsc(d.name)}</div>`).join('')}</div>`
    + `<div class="cmi-section">드랍 아이템</div>`
    + `<div class="cmi-drops"><div class="cmi-drops-inner">${dropCells}</div></div>`
    + `</div><div class="cmi-foot"><button class="inv-box-btn" data-cmi="close">닫기</button></div>`;
  panel.style.display = 'flex';
}
function codexMonsterOpenInfo(key){
  if(!codexMEntryByKey[key]) return;
  codexHideTip();
  codexClosePopup();
  codexMUI.resultsOpen = false;
  el('codexMResults').style.display = 'none';
  codexMUI.infoKey = key;
  codexMonsterRenderInfo();
}
function codexMonsterCloseInfo(){
  if(!codexMUI.infoKey && el('codexMInfo').style.display === 'none') return;
  codexMUI.infoKey = null;
  codexHideTip();
  codexMonsterRenderInfo();
}
function codexMonsterOnEscape(){
  if(codexUI.popupKey){ codexClosePopup(); codexHideTip(); return; }
  if(codexMUI.infoKey){ codexMonsterCloseInfo(); }
}

// ============================================================
// 이벤트
// ============================================================
(function bindCodexMonsterEvents(){
  el('codexMChecks').addEventListener('change', (ev) => {
    const cb = ev.target.closest('input[data-grade]');
    if(!cb) return;
    codexMUI.grades[cb.dataset.grade] = cb.checked;
    codexMUI.focusKey = null;
    codexHideTip();
    codexClosePopup();
    codexMonsterCloseInfo(); // 필터를 바꾸면 정보 화면은 닫고 목록으로 돌아감
    codexMonsterRenderGrid();
  });
  el('codexMVTabs').addEventListener('click', (ev) => {
    const b = ev.target.closest('.codex-vtab');
    if(!b || b.dataset.cat === codexMUI.cat) return;
    codexMUI.cat = b.dataset.cat;
    codexMUI.focusKey = null;
    codexHideTip();
    codexClosePopup();
    codexMonsterCloseInfo();
    codexMonsterRender();
  });
  const input = el('codexMSearchInput');
  input.addEventListener('input', () => {
    codexMUI.query = input.value;
    codexMUI.resultsOpen = true;
    codexMUI.focusKey = null;
    codexHideTip();
    codexClosePopup();
    codexMonsterCloseInfo();
    codexMonsterRenderGrid();
    codexMonsterRenderResults();
  });
  input.addEventListener('focus', () => { if(codexMonsterNormQuery()){ codexMUI.resultsOpen = true; codexMonsterRenderResults(); } });
  el('codexMResults').addEventListener('click', (ev) => {
    const b = ev.target.closest('.codex-result');
    if(b){ codexClosePopup(); codexMonsterCloseInfo(); codexMonsterGoTo(b.dataset.key); }
  });

  // 몬스터 아이콘: hover = 툴팁(마우스), 클릭/터치 = 아이콘 메뉴(정보 / 즐겨찾기).
  // 터치 환경(hover 불가)에서는 메뉴와 함께 툴팁도 같이 보여 줌. 같은 아이콘을 다시 누르면 메뉴가 닫힘.
  const grid = el('codexMGrid');
  // 터치 기기는 탭하면 브라우저가 흉내 내는 mouseover/mouseout이 따라오므로, 마우스 환경에서만 hover 툴팁을 처리함(터치는 클릭 핸들러가 담당).
  grid.addEventListener('mouseover', (ev) => { if(!invLockHasMouse()) return; const s = ev.target.closest('.codex-slot'); if(s && codexUI.popupKey !== s.dataset.key) codexShowTip(s); });
  grid.addEventListener('mouseout', (ev) => { if(!invLockHasMouse()) return; if(ev.target.closest('.codex-slot')) codexHideTip(); });
  grid.addEventListener('click', (ev) => {
    const s = ev.target.closest('.codex-slot');
    if(!s) return;
    if(codexUI.popupKey === s.dataset.key){ codexClosePopup(); codexHideTip(); return; }
    codexOpenPopup(s.dataset.key, s);
    if(!invLockHasMouse()) codexShowTip(s); // 터치: 메뉴 + 툴팁 동시 표시
  });
  el('codexMGridScroll').addEventListener('scroll', () => { codexHideTip(); codexClosePopup(); });

  // 정보 화면: [닫기] / 드랍 아이콘 툴팁(마우스: hover, 터치: 눌러서 표시·다시 누르면 닫힘). 드랍 아이콘은 아이콘 메뉴가 없음.
  const info = el('codexMInfo');
  const dropTip = (cell) => {
    const e = codexMEntryByKey[codexMUI.infoKey];
    const d = e && e.drops[Number(cell.dataset.didx)];
    if(d) codexShowTipHtml(cell, d.tooltipHtml, 'drop:' + e.key + ':' + cell.dataset.didx);
  };
  info.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-cmi="close"]');
    if(btn){ codexMonsterCloseInfo(); return; }
    const cell = ev.target.closest('.codex-mdrop');
    if(!cell || invLockHasMouse()) return; // 마우스 환경에서는 hover 툴팁만 사용(클릭은 아무 동작 없음)
    const tipKey = 'drop:' + codexMUI.infoKey + ':' + cell.dataset.didx;
    if(codexUI.tipKey === tipKey) codexHideTip(); else dropTip(cell);
  });
  info.addEventListener('mouseover', (ev) => { const c = ev.target.closest('.codex-mdrop'); if(c && invLockHasMouse()) dropTip(c); });
  info.addEventListener('mouseout', (ev) => { if(ev.target.closest('.codex-mdrop') && invLockHasMouse()) codexHideTip(); });
  info.addEventListener('scroll', () => codexHideTip(), true); // 정보 본문/드랍 줄을 스크롤하면 툴팁 닫음

  document.addEventListener('click', (ev) => {
    if(!ev.target.closest('#codexMSearch') && codexMUI.resultsOpen){
      codexMUI.resultsOpen = false;
      el('codexMResults').style.display = 'none';
    }
  });
})();
