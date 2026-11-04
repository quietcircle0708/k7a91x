// ============================================================
// 전투 로그 (던전 화면 — 처치 보상·스킬/플라스크 사용·안내 메시지를 시간 순으로 보여주는 대화창)
// ------------------------------------------------------------
// ■ 문구·모양을 바꾸는 곳은 "표" 3개와 CSS뿐이고, 호출부(dungeon.js·actions.js 등)에는 문장이 하나도 없음.
//     ① HUNT_LOG_MESSAGES  메시지 id → { text: 문장 틀, tone: 줄 색 종류, merge: 같은 줄 연속 시 (×N)으로 합칠지 }
//        문장 틀의 {이름}은 호출부가 넘긴 값이 들어갈 자리이고, {이름|을/를}처럼 쓰면 앞 글자 받침에 맞춰 조사가 자동으로 붙음.
//     ② HUNT_LOG_TOKENS    {이름} 자리에 값을 어떻게 적고(fmt) 어떤 색 클래스를 줄지(cls) 정하는 표.
//     ③ style.css의 .hl-*   줄 색(tone)과 값 색(cls) — 골드·경험치 같은 강조색은 여기서만 바꾸면 됨.
//   호출부는 huntLog('메시지id', { 이름: 값, ... }) 한 줄로 끝남. 아이템 이름색은 기존 이름색 규칙(등급·강화 단계)을 그대로 씀.
// ■ 보관: 최근 HUNT_LOG_MAX_LINES줄만 메모리에 두고 저장하지 않음(던전에 들어갈 때마다 새로 시작).
// ■ 표시: 데스크탑 = 메뉴 팝업(menu_popup.js, 이름 'log') / 모바일 = 던전 카드 아래 인라인 상자. 열림/닫힘은 설정에 저장(기본 열림).
// ============================================================

const HUNT_LOG_MAX_LINES = 50;              // 보관·표시하는 최대 줄 수(넘으면 오래된 줄부터 삭제)
const HUNT_LOG_DURABILITY_WARN_PCT = 20;    // 장착 장비 내구도가 이 비율(%) 이하로 내려가는 순간 경고(0이 되면 별도 문구)
const HUNT_LOG_SCROLL_STICK_PX = 24;        // 사용자가 위로 스크롤해 둔 상태가 아니면(맨 아래에서 이 거리 이내) 새 줄에 따라 자동으로 맨 아래로 이동

// ---- ① 문구 표 ----
// tone: base(회색 기본) / system(진입·종료 같은 진행 안내) / warn(경고·안내) / levelup(레벨업 강조) / relic(모험가의 유해 발견)
const HUNT_LOG_MESSAGES = {
  // 던전·전투 진행
  dungeonEnter:   { text: '{dungeon}에 입장했습니다.', tone: 'system' },
  dungeonLeave:   { text: '{dungeon}에서 나갑니다.', tone: 'system' },
  combatStart:    { text: '{stage} 전투가 시작되었습니다.', tone: 'system' },
  combatEnd:      { text: '{stage} 전투가 종료되었습니다.', tone: 'system' },
  treasureStage:  { text: '숨겨진 장소에 도착했습니다.', tone: 'system' },
  treasureOpen:   { text: '보물 상자를 열었습니다.', tone: 'system' },
  huntPause:      { text: '전투를 일시 중단했습니다.', tone: 'system' },
  huntResume:     { text: '전투를 재개합니다.', tone: 'system' },
  // 획득
  gold:           { text: '{gold|을/를} 획득했습니다.', tone: 'base' },
  exp:            { text: '{exp|을/를} 획득했습니다. ({pct})', tone: 'base' },
  expNoPct:       { text: '{exp|을/를} 획득했습니다.', tone: 'base' },   // 경험치 비율을 계산할 수 없을 때(만렙 등)
  item:           { text: '{item|을/를} 획득했습니다.', tone: 'base' },
  relic:          { text: '모험가의 유해에서 장비를 발견했습니다!', tone: 'relic' },
  levelUp:        { text: '레벨업! {level}', tone: 'levelup' },
  // 사용
  skillUse:       { text: '{skill|을/를} 시전합니다.', tone: 'base' },
  flaskUse:       { text: '{item|을/를} 사용했습니다.', tone: 'base' },
  // 안내·경고
  inventoryFull:  { text: '{category} 인벤토리가 가득 찼습니다.', tone: 'warn', merge: true },
  combatLocked:   { text: '전투 중에는 할 수 없습니다.', tone: 'warn', merge: true },
  durabilityLow:  { text: '{item}의 내구도가 {pct} 이하입니다.', tone: 'warn' },
  durabilityZero: { text: '{item}의 내구도가 0이 되었습니다.', tone: 'warn' },
  playerDeath:    { text: '{monster}에게 사망했습니다.', tone: 'warn' },
  curseNotice:    { text: '마을에서 부활하면 망자의 저주가 부여됩니다. (골드·경험치 {pct} 감소, {time})', tone: 'warn' },
  curseActive:    { text: '망자의 저주가 적용 중입니다. (골드·경험치 {pct} 감소, 남은 시간 {time})', tone: 'warn' },
  curseEnd:       { text: '망자의 저주가 풀렸습니다.', tone: 'system' },
};

// ---- ② 값 서식 표 ----
// fmt(값) → 글자(문자열) 또는 { text, color }. cls는 style.css의 .hl-t-* 색 클래스. 표에 없는 이름은 값을 그대로 글자로 씀.
const HUNT_LOG_TOKENS = {
  gold:     { cls: 'hl-t-gold',  fmt: v => `${Number(v).toLocaleString()} 골드` },
  exp:      { cls: 'hl-t-exp',   fmt: v => `경험치 ${Number(v).toLocaleString()}` },
  pct:      { cls: 'hl-t-pct',   fmt: v => `${v}%` },
  level:    { cls: 'hl-t-level', fmt: v => `Lv.${v}` },
  // 아이템·몬스터처럼 이름색이 따로 있는 값: { name, color, qty } 형태로 받음(색은 기존 이름색 규칙에서 호출부가 계산)
  item:     { fmt: v => ({ text: v.name + (v.qty > 1 ? ` ×${v.qty}` : ''), color: v.color }) },
  monster:  { fmt: v => ({ text: v.name, color: v.color }) },
  skill:    { fmt: v => String(v) },       // 스킬 이름은 기본 회색(색을 주고 싶으면 cls를 추가)
  dungeon:  { fmt: v => String(v) },
  stage:    { fmt: v => String(v) },
  category: { fmt: v => String(v) },
  time:     { fmt: v => String(v) },
};

// ---- 조사 처리: 받침 유무로 "을/를", "이/가", "은/는", "과/와" 등 앞쪽/뒤쪽 글자를 고름 ----
const HUNT_LOG_DIGIT_BATCHIM = [true, true, false, true, false, false, true, true, true, false]; // 영·일·이·삼·사·오·육·칠·팔·구로 읽을 때의 받침
function huntLogHasBatchim(text){
  const s = String(text).replace(/[\s)\]」』]+$/, '');
  if(!s) return false;
  const ch = s[s.length - 1];
  if(ch >= '0' && ch <= '9') return HUNT_LOG_DIGIT_BATCHIM[Number(ch)];
  const code = ch.charCodeAt(0) - 0xAC00;
  if(code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}
function huntLogJosa(text, pair){
  const parts = String(pair).split('/');
  if(parts.length < 2) return pair;
  return huntLogHasBatchim(text) ? parts[0] : parts[1];
}
function huntLogEsc(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 문장 틀 + 값 → HTML 문자열
function huntLogRender(id, params){
  const def = HUNT_LOG_MESSAGES[id];
  if(!def) return null;
  return def.text.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (m, key, josa) => {
    const v = params ? params[key] : undefined;
    if(v === undefined || v === null) return '';
    const tok = HUNT_LOG_TOKENS[key] || {};
    const r = tok.fmt ? tok.fmt(v) : String(v);
    const text = (r && typeof r === 'object') ? r.text : r;
    const color = (r && typeof r === 'object' && r.color) ? r.color : '';
    const attrs = (tok.cls ? ` class="${tok.cls}"` : '') + (color ? ` style="color:${color};"` : '');
    let out = attrs ? `<span${attrs}>${huntLogEsc(text)}</span>` : huntLogEsc(text);
    if(josa) out += huntLogJosa(text, josa);
    return out;
  });
}

// ---- 줄 보관 / 화면 갱신 ----
const huntLogUI = { lines: [], seq: 0 };
function huntLogActive(){ return currentView === 'hunt' && !!hunt.dungeon; }
function huntLogLists(){
  return ['huntLogList', 'huntLogInlineList'].map(id => el(id)).filter(Boolean);
}
function huntLogLineHtml(line){
  const count = line.count > 1 ? ` <span class="hl-count">(×${line.count})</span>` : '';
  return `<div class="hl-line hl-${line.tone}" data-k="${line.key}">${line.html}${count}</div>`;
}
function huntLogScrollBottom(list){ list.scrollTop = list.scrollHeight; }
function huntLogRenderAll(){
  huntLogLists().forEach(list => {
    list.innerHTML = huntLogUI.lines.map(huntLogLineHtml).join('');
    huntLogScrollBottom(list);
  });
}
// 메시지 한 줄 추가. 던전 밖에서는 아무 일도 하지 않음.
function huntLog(id, params){
  if(!huntLogActive()) return;
  const def = HUNT_LOG_MESSAGES[id];
  if(!def) return;
  const html = huntLogRender(id, params);
  if(html === null) return;
  const last = huntLogUI.lines[huntLogUI.lines.length - 1];
  if(def.merge && last && last.id === id && last.html === html){
    last.count++;
    huntLogLists().forEach(list => {
      const node = list.querySelector(`[data-k="${last.key}"]`);
      if(node) node.outerHTML = huntLogLineHtml(last);
    });
    return;
  }
  const line = { key: ++huntLogUI.seq, id, html, tone: def.tone || 'base', count: 1 };
  huntLogUI.lines.push(line);
  const overflow = huntLogUI.lines.length > HUNT_LOG_MAX_LINES;
  if(overflow) huntLogUI.lines.shift();
  huntLogLists().forEach(list => {
    const stick = list.scrollHeight - list.scrollTop - list.clientHeight <= HUNT_LOG_SCROLL_STICK_PX;
    list.insertAdjacentHTML('beforeend', huntLogLineHtml(line));
    if(overflow && list.firstElementChild) list.removeChild(list.firstElementChild);
    if(stick) huntLogScrollBottom(list);
  });
}
function huntLogReset(){
  huntLogUI.lines = [];
  huntLogRenderAll();
}

// ---- 값 만들기 도우미(아이템 이름색은 기존 규칙 재사용) ----
function huntLogEquipToken(type, level){
  return { name: weaponName(type) + levelSuffix(level || 0), color: weaponNameColor(type, level || 0) };
}
function huntLogConsumableToken(itemId, qty){
  const item = CONSUMABLES[itemId];
  if(!item) return { name: String(itemId), color: '', qty };
  const g = scrollGradeInfo(item) || consumableGradeInfo(item); // 비급(할당 스킬 등급) → 그 외 등급 있는 소비 아이템(상자·고급 포션 등) → 등급 없으면 기본 글자색
  return { name: item.name, color: g ? g.color : '', qty };
}
function huntLogMiscToken(itemId, qty){
  const item = MISC_ITEMS[itemId];
  if(!item) return { name: String(itemId), color: '', qty };
  return { name: item.name, color: item.itemClass === 'stone' ? stoneNameColor(itemId) : miscNameColor(itemId), qty };
}
function huntLogArtifactToken(id){
  const a = ARTIFACTS[id];
  return { name: a ? a.name : String(id), color: a ? artifactNameColor(id) : '' };
}
function huntLogFmtPct(v){ // 소수 둘째 자리까지, 뒤쪽 0은 생략(1.20 → 1.2)
  return String(Number(Number(v).toFixed(2)));
}
function huntLogFmtDuration(ms){
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? (s > 0 ? `${m}분 ${s}초` : `${m}분`) : `${s}초`;
}

// ---- 획득 항목 묶음 출력 ----
// dropItems: killMonsterInstance가 모은 { kind: 'equip'|'item'|'consumable'|'artifact', type|itemId|id, level?, qty?, relic? } 목록(실제 지급이 확정된 것만).
function huntLogDropItems(dropItems){
  (dropItems || []).forEach(d => {
    let token = null;
    if(d.kind === 'equip'){
      if(d.relic) huntLog('relic');
      token = huntLogEquipToken(d.type, d.level);
    } else if(d.kind === 'consumable') token = huntLogConsumableToken(d.itemId, d.qty);
    else if(d.kind === 'item') token = huntLogMiscToken(d.itemId, d.qty);
    else if(d.kind === 'artifact') token = huntLogArtifactToken(d.id);
    if(token) huntLog('item', { item: token });
  });
}
function huntLogFullCategories(cats){
  Object.keys(cats || {}).forEach(c => { if(cats[c]) huntLog('inventoryFull', { category: inventoryCategoryLabel(c) }); });
}
// 몬스터 1마리 처치 보상: 골드 → 경험치(%) → 획득 아이템 → 가득참 안내 → 레벨업 순서
function huntLogKillRewards(info){
  if(info.gold > 0) huntLog('gold', { gold: info.gold });
  if(info.exp > 0){
    if(info.expPct != null) huntLog('exp', { exp: info.exp, pct: huntLogFmtPct(info.expPct) });
    else huntLog('expNoPct', { exp: info.exp });
  }
  huntLogDropItems(info.drops);
  huntLogFullCategories(info.fulls);
  if(info.levelsGained > 0) huntLog('levelUp', { level: info.newLevel });
}
// 11스테이지(숨겨진 장소) 보물 상자 결과(grantTreasureRewards의 반환값)
function huntLogTreasureResult(result){
  huntLog('treasureOpen');
  if(result.gold > 0) huntLog('gold', { gold: result.gold });
  const drops = treasureResultDrops(result); // dungeon.js — 업적(achievements.js)과 같은 목록을 씀
  huntLogDropItems(drops);
  huntLogFullCategories(result.fullCategories);
}

// ---- 내구도 경고: 장착 장비의 내구도가 감소할 때 호출(dungeon.js) ----
function huntLogDurability(item, before, after){
  if(!huntLogActive() || !item) return;
  const max = maxDurabilityForItem(item);
  if(!max) return;
  const token = huntLogEquipToken(item.type, item.level);
  if(after <= 0 && before > 0){
    huntLog('durabilityZero', { item: token });
  } else if(after > 0 && (before / max) * 100 > HUNT_LOG_DURABILITY_WARN_PCT && (after / max) * 100 <= HUNT_LOG_DURABILITY_WARN_PCT){
    huntLog('durabilityLow', { item: token, pct: HUNT_LOG_DURABILITY_WARN_PCT });
  }
}

// ---- 망자의 저주 안내(수치·시간은 state.js 상수를 그대로 읽음) ----
function huntLogCurseParams(remainMs){
  return { pct: Math.round((1 - DEATH_CURSE_MULTIPLIER) * 100), time: huntLogFmtDuration(remainMs) };
}

// ---- 열기/닫기(데스크탑 = 메뉴 팝업, 모바일 = 인라인 상자). 열림 여부는 설정에 저장하고 기본은 열림 ----
function huntLogIsOpenSetting(){ return !(state.settings && state.settings.huntLogOpen === false); }
function huntLogSetOpenSetting(open){
  if(!state.settings) state.settings = {};
  state.settings.huntLogOpen = !!open;
  saveState();
}
// 지금 프리셋·던전 상태·설정에 맞춰 팝업/인라인 상자와 버튼 모양을 맞춤(던전 입장·프리셋 변경·버튼 토글에서 호출)
function huntLogApplyVisibility(){
  const open = huntLogIsOpenSetting();
  const inline = el('huntLogInline');
  const btn = el('huntLogBtn');
  if(btn) btn.classList.toggle('log-closed', !open);
  if(!huntLogActive()){
    if(inline) inline.style.display = 'none';
    return;
  }
  if(menuPopupDesktop()){
    if(inline) inline.style.display = 'none';
    if(open && !menuPopupIsOpen('log')) menuPopupOpen('log');
    else if(!open && menuPopupIsOpen('log')) menuPopupClose('log');
  } else {
    if(menuPopupIsOpen('log')) menuPopupClose('log');
    if(inline){
      inline.style.display = open ? 'block' : 'none';
      if(open) huntLogRenderAll();
    }
  }
}
function huntLogToggle(){
  if(!huntLogActive()) return;
  huntLogSetOpenSetting(!huntLogIsOpenSetting());
  huntLogApplyVisibility();
}
// 팝업의 [x]를 사용자가 직접 눌러 닫았을 때(menu_popup.js) — 다음 던전에서도 닫힌 상태를 유지함. (던전을 떠나며 자동으로 닫히는 경우는 설정을 바꾸지 않음)
function huntLogOnUserClose(){ huntLogSetOpenSetting(false); huntLogApplyVisibility(); }
