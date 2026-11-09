// ============================================================
// 데이터 탭(옵션 > 데이터) — 저장하기 / 내보내기 / 불러오기
// ------------------------------------------------------------
// 기기마다 저장소가 달라(PC 로컬 파일, 모바일 웹) 데이터를 옮길 수 있게 해 주는 기능.
//  - 저장하기: 지금 상태를 즉시 저장(평소엔 자동 저장됨)하고 마지막 저장 시각/위치를 보여줌.
//  - 내보내기: 세이브를 "압축 → 난독화 → 서명"한 텍스트 코드로 만들어 복사하거나 파일(.txt)로 저장.
//  - 불러오기: 코드(붙여넣기 또는 파일)를 서명 검증 → 정합성 검사 → 요약 비교 확인창 → 현재 데이터 자동 백업 → 적용(새로고침).
//              기기 설정(state.settings — 화면 프리셋·단축키 등)은 불러와도 현재 기기 것을 유지함.
//  - 조작 방지: 브라우저에서 도는 코드라 완전한 방지는 불가능하므로 "일반적인 수정"을 막는 수준을 목표로 함.
//      ① 서명(HMAC-SHA256): 데이터를 한 글자라도 고치면 불러올 수 없음  ② 압축 + XOR 난독화: 내용을 눈으로 읽을 수 없음
//      ③ 정합성 검사: 서명이 있어도 범위·규칙이 맞지 않는 값(레벨 초과 스탯 포인트, 없는 장비 등)은 거절.
//    내보낸 코드만 보호하며, 기기 안의 평소 저장소(STORAGE_KEY)는 건드리지 않음.
// 이 파일은 main.js의 loadState() 이전에 로드되어야 함(기본 상태 스냅샷을 그 시점에 떠 두기 때문).
// ============================================================

const DT_GAME_ID = 'enhance-slay';
const DT_FORMAT_VERSION = 1;                 // 내보내기 형식 버전 — 형식을 바꾸면 올리고, 더 새로운 파일을 옛 빌드가 불러오는 경우만 거절함
const DT_BACKUP_KEY = 'forge-backup-before-import'; // 불러오기/되돌리기 직전의 현재 데이터 백업 1개(localStorage)
const DT_NUM_MAX = 1e13;                     // 정합성 검사: 숫자 값 상한(날짜 값도 들어 있어 넉넉하게)
// 서명·난독화에 쓰는 값(조각을 합쳐 사용). 브라우저에서 도는 코드라 완전한 비밀은 아니며, 일반적인 수정을 막는 용도임.
const DT_SECRET = ['enhance&slay', '\u2694', 'save-seal', 'v1', '9f3c1a7e5b'].join('|');

// 기본 상태 스냅샷 — 불러오기는 "새 게임 기본값 위에 올리는" 방식이라 loadState()가 돌기 전의 상태를 보관해 둠.
const DT_DEFAULT_STATE_JSON = JSON.stringify(state);

// ---- SHA-256 / HMAC (외부 라이브러리 없이 동기 계산 — 보안 컨텍스트가 아닌 환경에서도 동작) ----
const DT_SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
function dtSha256(data){
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const len = data.length;
  const padLen = ((len + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(padLen);
  m.set(data);
  m[len] = 0x80;
  const hi = Math.floor(len / 0x20000000), lo = (len << 3) >>> 0;
  m[padLen - 8] = hi >>> 24; m[padLen - 7] = (hi >>> 16) & 255; m[padLen - 6] = (hi >>> 8) & 255; m[padLen - 5] = hi & 255;
  m[padLen - 4] = lo >>> 24; m[padLen - 3] = (lo >>> 16) & 255; m[padLen - 2] = (lo >>> 8) & 255; m[padLen - 1] = lo & 255;
  const w = new Uint32Array(64);
  for(let off = 0; off < padLen; off += 64){
    for(let i = 0; i < 16; i++){
      w[i] = ((m[off + 4 * i] << 24) | (m[off + 4 * i + 1] << 16) | (m[off + 4 * i + 2] << 8) | m[off + 4 * i + 3]) >>> 0;
    }
    for(let i = 16; i < 64; i++){
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for(let i = 0; i < 64; i++){
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + DT_SHA_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  for(let i = 0; i < 8; i++){
    out[4 * i] = H[i] >>> 24; out[4 * i + 1] = (H[i] >>> 16) & 255; out[4 * i + 2] = (H[i] >>> 8) & 255; out[4 * i + 3] = H[i] & 255;
  }
  return out;
}
function dtHmac(key, msg){
  let k = key.length > 64 ? dtSha256(key) : key;
  const ipad = new Uint8Array(64), opad = new Uint8Array(64);
  for(let i = 0; i < 64; i++){
    const kb = i < k.length ? k[i] : 0;
    ipad[i] = kb ^ 0x36; opad[i] = kb ^ 0x5c;
  }
  const inner = new Uint8Array(64 + msg.length);
  inner.set(ipad); inner.set(msg, 64);
  const ih = dtSha256(inner);
  const outer = new Uint8Array(64 + 32);
  outer.set(opad); outer.set(ih, 64);
  return dtSha256(outer);
}

// ---- 바이트/문자열 변환 ----
function dtUtf8(str){ return new TextEncoder().encode(str); }
function dtB64uEncode(bytes){
  let bin = '';
  for(let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function dtB64uDecode(str){
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while(s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function dtConcat(a, b){ const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
function dtEquals(a, b){
  if(a.length !== b.length) return false;
  let diff = 0;
  for(let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function dtKey(label){ return dtSha256(dtUtf8(label + '|' + DT_SECRET)); }
// 난독화: 키와 nonce에서 만든 스트림(HMAC 카운터 방식)과 XOR — 같은 함수로 되돌림
function dtXorStream(bytes, nonce){
  const key = dtKey('enc');
  const out = new Uint8Array(bytes.length);
  for(let block = 0; block * 32 < bytes.length; block++){
    const ctr = new Uint8Array([block >>> 24, (block >>> 16) & 255, (block >>> 8) & 255, block & 255]);
    const ks = dtHmac(key, dtConcat(nonce, ctr));
    for(let j = 0; j < 32 && block * 32 + j < bytes.length; j++) out[block * 32 + j] = bytes[block * 32 + j] ^ ks[j];
  }
  return out;
}
function dtRandomBytes(n){
  const out = new Uint8Array(n);
  if(typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(out);
  else for(let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}
// 압축(브라우저 기본 기능) — 지원하지 않는 환경이면 압축 없이(mode 'p') 내보냄
async function dtStream(bytes, Ctor){
  const s = new Blob([bytes]).stream().pipeThrough(new Ctor('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// ---- 내보내기 코드 만들기 / 해석 ----
// 코드 형식: ESV<버전>.<모드 z|p>.<nonce>.<본문>.<서명>  (각 조각은 base64url이라 '.'이 섞이지 않음)
async function dtBuildExportCode(){
  const snapshot = JSON.parse(JSON.stringify(state));
  delete snapshot.settings; // 기기 설정(화면 프리셋·단축키 등)은 기기마다 다르므로 내보내지 않음
  const wrapper = { game: DT_GAME_ID, fmt: DT_FORMAT_VERSION, at: Date.now(), state: snapshot };
  let bytes = dtUtf8(JSON.stringify(wrapper));
  let mode = 'p';
  if(typeof CompressionStream === 'function'){
    try{ bytes = await dtStream(bytes, CompressionStream); mode = 'z'; }catch(e){ mode = 'p'; bytes = dtUtf8(JSON.stringify(wrapper)); }
  }
  const nonce = dtRandomBytes(8);
  const head = 'ESV' + DT_FORMAT_VERSION + '.' + mode + '.' + dtB64uEncode(nonce) + '.' + dtB64uEncode(dtXorStream(bytes, nonce));
  const sig = dtB64uEncode(dtHmac(dtKey('sig'), dtUtf8(head)));
  return { code: head + '.' + sig, at: wrapper.at };
}
// 반환: { ok:true, wrapper } 또는 { ok:false, error }
async function dtParseCode(text){
  const code = String(text || '').replace(/\s+/g, '');
  if(!code) return { ok: false, error: '불러올 코드가 비어 있습니다.' };
  const parts = code.split('.');
  const m = parts.length === 5 && /^ESV(\d+)$/.exec(parts[0]);
  if(!m) return { ok: false, error: '이 게임에서 내보낸 코드가 아니거나 일부가 잘렸습니다.' };
  if(Number(m[1]) > DT_FORMAT_VERSION) return { ok: false, error: '더 새로운 버전에서 내보낸 데이터입니다. 이 기기의 게임을 먼저 최신 버전으로 업데이트해 주세요.' };
  if(parts[1] !== 'z' && parts[1] !== 'p') return { ok: false, error: '알 수 없는 데이터 형식입니다.' };
  let sig;
  try{ sig = dtB64uEncode(dtHmac(dtKey('sig'), dtUtf8(parts.slice(0, 4).join('.')))); }
  catch(e){ return { ok: false, error: '코드를 읽을 수 없습니다.' }; }
  if(!dtEquals(sig, parts[4])) return { ok: false, error: '데이터가 변경되었거나 손상되어 불러올 수 없습니다.' };
  let bytes;
  try{
    bytes = dtXorStream(dtB64uDecode(parts[3]), dtB64uDecode(parts[2]));
    if(parts[1] === 'z'){
      if(typeof DecompressionStream !== 'function') return { ok: false, error: '이 브라우저는 압축된 데이터를 풀 수 없습니다. 브라우저를 최신 버전으로 업데이트해 주세요.' };
      bytes = await dtStream(bytes, DecompressionStream);
    }
    const wrapper = JSON.parse(new TextDecoder().decode(bytes));
    if(!wrapper || wrapper.game !== DT_GAME_ID || !wrapper.state) return { ok: false, error: '이 게임의 데이터가 아닙니다.' };
    return { ok: true, wrapper };
  }catch(e){
    return { ok: false, error: '데이터를 해석하지 못했습니다(손상된 코드일 수 있습니다).' };
  }
}

// ---- 정합성 검사: 서명이 있어도 규칙에 맞지 않는 값은 거절(오류 문구 배열 반환, 비어 있으면 통과) ----
function dtValidateState(s){
  const errs = [];
  const bad = (msg) => { if(errs.length < 5 && !errs.includes(msg)) errs.push(msg); };
  if(!s || typeof s !== 'object' || Array.isArray(s)) return ['저장 데이터의 형식이 올바르지 않습니다.'];
  const badNum = (v) => typeof v !== 'number' || !isFinite(v) || v < 0 || v > DT_NUM_MAX;
  // 1) 최상위 숫자 값은 유한한 0 이상 수. 소모품 목록(consumables)도 같은 규칙.
  Object.keys(s).forEach(k => { if(typeof s[k] === 'number' && badNum(s[k])) bad('숫자 값이 허용 범위를 벗어났습니다(' + k + ').'); });
  if(s.consumables !== undefined){
    if(!s.consumables || typeof s.consumables !== 'object' || Array.isArray(s.consumables)) bad('소모품 데이터 형식이 올바르지 않습니다.');
    else Object.keys(s.consumables).forEach(k => { if(badNum(s.consumables[k])) bad('소모품 수량이 올바르지 않습니다(' + k + ').'); });
  }
  // 2) 레벨 / 스탯 포인트(투자한 합 + 남은 포인트는 레벨에서 얻을 수 있는 총량을 넘을 수 없음)
  const lv = s.playerLevel;
  const lvOk = Number.isInteger(lv) && lv >= 1 && lv <= PLAYER_MAX_LEVEL;
  if(!lvOk) bad('캐릭터 레벨이 올바르지 않습니다.');
  const level = lvOk ? lv : 1;
  let spent = 0;
  if(s.stats !== undefined){
    if(!s.stats || typeof s.stats !== 'object' || Array.isArray(s.stats)) bad('스탯 데이터 형식이 올바르지 않습니다.');
    else STAT_KEYS.forEach(k => {
      const v = s.stats[k];
      if(v === undefined) return;
      if(!Number.isInteger(v) || v < 0) bad('스탯 값이 올바르지 않습니다(' + k + ').'); else spent += v;
    });
  }
  const sp = s.statPoints === undefined ? 0 : s.statPoints;
  if(!Number.isInteger(sp) || sp < 0) bad('남은 스탯 포인트가 올바르지 않습니다.');
  else if(spent + sp > STAT_POINTS_PER_LEVEL * level) bad('스탯 포인트가 레벨에서 얻을 수 있는 양을 넘습니다.');
  // 3) 스킬: 알 수 없는 스킬·중복 금지, 스킬/기연 포인트는 레벨 누적 지급량 이하
  ['learnedSkills', 'learnedAwakeningSkills', 'unlockedAwakeningSkills'].forEach(k => {
    const arr = s[k];
    if(arr === undefined) return;
    if(!Array.isArray(arr)){ bad('스킬 데이터 형식이 올바르지 않습니다.'); return; }
    arr.forEach(id => { if(typeof id !== 'string' || !SKILLS[id]) bad('알 수 없는 스킬이 있습니다(' + id + ').'); });
    if(new Set(arr).size !== arr.length) bad('중복된 스킬이 있습니다.');
  });
  if(lvOk && s.skillPoints !== undefined && (!Number.isInteger(s.skillPoints) || s.skillPoints > totalSkillPointsForLevel(level))) bad('스킬 포인트가 올바르지 않습니다.');
  if(lvOk && s.awakeningPoints !== undefined && (!Number.isInteger(s.awakeningPoints) || s.awakeningPoints > totalAwakeningPointsForLevel(level))) bad('기연 포인트가 올바르지 않습니다.');
  // 4) 장비: 존재하는 종류, 정수 id(모든 장비 통틀어 중복 금지), 강화 단계 0~MAX_LEVEL, 내구도는 유한한 0 이상 수
  const tables = { inventory: WEAPON_TYPES, armorInventory: ARMOR_TYPES, subInventory: SUB_TYPES, accessoryInventory: ACCESSORY_TYPES };
  const seen = new Set();
  Object.keys(tables).forEach(key => {
    const arr = s[key];
    if(arr === undefined) return;
    if(!Array.isArray(arr)){ bad('장비 데이터 형식이 올바르지 않습니다.'); return; }
    arr.forEach(it => {
      if(!it || typeof it !== 'object'){ bad('장비 데이터가 올바르지 않습니다.'); return; }
      if(!Number.isInteger(it.id) || it.id < 1){ bad('장비 번호가 올바르지 않습니다.'); return; }
      if(seen.has(it.id)) bad('중복된 장비 번호가 있습니다.');
      seen.add(it.id);
      if(!tables[key][it.type]) bad('알 수 없는 장비가 있습니다(' + it.type + ').');
      if(it.level !== undefined && (!Number.isInteger(it.level) || it.level < 0 || it.level > MAX_LEVEL)) bad('장비 강화 단계가 올바르지 않습니다.');
      if(it.currentDurability != null && badNum(it.currentDurability)) bad('장비 내구도가 올바르지 않습니다.');
    });
  });
  return errs;
}

// ---- 요약(확인창용) ----
function dtSummary(s){
  const n = (k) => (Array.isArray(s[k]) ? s[k].length : 0);
  return {
    level: s.playerLevel || 1,
    gold: s.gold || 0,
    gear: n('inventory') + n('armorInventory') + n('subInventory') + n('accessoryInventory'),
    kills: s.totalKills || 0,
  };
}
function dtFmtNum(v){ return Number(v || 0).toLocaleString('ko-KR'); }
function dtFmtTime(ms){
  if(!ms) return '-';
  const d = new Date(ms), p = (v) => String(v).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

// ---- 백업 / 적용 ----
function dtReadBackup(){
  try{
    const raw = localStorage.getItem(DT_BACKUP_KEY);
    if(!raw) return null;
    const b = JSON.parse(raw);
    return b && b.raw ? b : null;
  }catch(e){ return null; }
}
function dtWriteBackup(){
  try{
    localStorage.setItem(DT_BACKUP_KEY, JSON.stringify({ at: Date.now(), raw: JSON.stringify(state) }));
    return true;
  }catch(e){ return false; }
}
// 불러올 데이터를 현재 게임에 적용: 새 기본값 위에 올리고(loadState와 같은 마이그레이션 경로), 기기 설정은 현재 것을 유지, 저장 후 새로고침.
async function dtApplyState(imported){
  const keepSettings = state.settings || {};
  state = JSON.parse(DT_DEFAULT_STATE_JSON);
  applyLoadedRaw(JSON.stringify(imported));
  state.settings = keepSettings;
  // 장비 번호 카운터는 불러온 장비의 최대 번호보다 크게 보정(이후 새 장비가 기존 번호와 겹치지 않도록)
  let maxId = 0;
  ['inventory', 'armorInventory', 'subInventory', 'accessoryInventory'].forEach(k => (state[k] || []).forEach(it => { if(it && it.id > maxId) maxId = it.id; }));
  if(!Number.isInteger(state.nextItemId) || state.nextItemId <= maxId) state.nextItemId = maxId + 1;
  ensurePlayerVitals();
  ensureSettingsDefaults();
  await saveState();
  location.reload();
}
// 지금은 불러오기를 할 수 없는 상황이면 이유를 반환(강화 연출 중, 던전 사냥 중, 반복 제작 중)
function dtBlockedReason(){
  if(typeof isEnhancing !== 'undefined' && isEnhancing) return '강화 중에는 불러올 수 없습니다. 끝난 뒤에 다시 시도해 주세요.';
  if(typeof hunt !== 'undefined' && hunt && hunt.started) return '던전에서는 불러올 수 없습니다. 던전에서 나온 뒤에 시도해 주세요.';
  if(typeof craftMultiRun !== 'undefined' && craftMultiRun) return '반복 제작 중에는 불러올 수 없습니다.';
  return '';
}

// ---- 화면(옵션 > 데이터 탭) ----
let dtMsg = null;          // { text, kind: 'ok'|'err'|'info' }
let dtExport = null;       // { code, at } — 내보내기 코드
let dtImportText = '';     // 붙여넣은 코드
let dtPending = null;      // 검사를 통과한 불러오기 대기 { state, at, summary, source: 'code'|'backup' }
let dtBusy = false;

function dtSetMsg(text, kind){ dtMsg = text ? { text, kind: kind || 'info' } : null; }
function dtEsc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function dataTransferPanelHtml(){
  const info = (typeof lastSaveInfo !== 'undefined' && lastSaveInfo) ? lastSaveInfo : null;
  const where = info ? (info.where === 'claude' ? 'Claude 저장소' : '이 기기의 브라우저 저장소') : '';
  const saveLine = info
    ? (info.ok ? `마지막 저장: ${dtFmtTime(info.at)} · ${where}` : `<span style="color:var(--forge-blood);">저장에 실패했습니다(${dtFmtTime(info.at)}). 브라우저 저장 공간을 확인해 주세요.</span>`)
    : '이번 접속에서는 아직 저장 기록이 없습니다.';
  const backup = dtReadBackup();
  let backupHtml = '';
  if(backup){
    let lv = '-';
    try{ lv = 'Lv.' + (JSON.parse(backup.raw).playerLevel || 1); }catch(e){}
    backupHtml = `
      <div class="dt-box">
        <div class="settings-item-label">직전 데이터 백업</div>
        <div class="settings-item-desc">불러오기 직전의 이 기기 데이터입니다(${dtFmtTime(backup.at)} · ${lv}). 실수로 불러왔다면 되돌릴 수 있습니다.</div>
        <div class="dt-row"><button type="button" class="nav-btn" data-dt-act="restore" ${dtBusy ? 'disabled' : ''}>백업으로 되돌리기</button></div>
      </div>`;
  }
  let pendingHtml = '';
  if(dtPending){
    const cur = dtSummary(state), inc = dtPending.summary;
    const row = (label, a, b) => `<tr><td>${label}</td><td>${a}</td><td>${b}</td></tr>`;
    pendingHtml = `
      <div class="dt-box dt-confirm">
        <div class="settings-item-label">${dtPending.source === 'backup' ? '백업 데이터로 되돌리기' : '이 데이터를 불러올까요?'}</div>
        <table class="dt-table">
          <tr><th></th><th>현재 데이터</th><th>${dtPending.source === 'backup' ? '백업 데이터' : '불러올 데이터'}</th></tr>
          ${row('캐릭터 레벨', 'Lv.' + cur.level, 'Lv.' + inc.level)}
          ${row('골드', dtFmtNum(cur.gold) + ' G', dtFmtNum(inc.gold) + ' G')}
          ${row('보유 장비', cur.gear + '개', inc.gear + '개')}
          ${row('누적 처치', dtFmtNum(cur.kills), dtFmtNum(inc.kills))}
          ${dtPending.at ? row('데이터 시각', '-', dtFmtTime(dtPending.at)) : ''}
        </table>
        <div class="settings-item-desc">현재 데이터는 자동으로 백업되고, 화면·단축키 같은 이 기기의 설정은 그대로 유지됩니다. 적용하면 게임이 다시 시작됩니다.</div>
        <div class="dt-row">
          <button type="button" class="btn btn-main" data-dt-act="apply" ${dtBusy ? 'disabled' : ''}>불러오기 실행</button>
          <button type="button" class="nav-btn" data-dt-act="cancel" ${dtBusy ? 'disabled' : ''}>취소</button>
        </div>
      </div>`;
  }
  const msgHtml = dtMsg ? `<div class="dt-msg dt-msg-${dtMsg.kind}">${dtEsc(dtMsg.text)}</div>` : '';
  return `
    <div class="dt-panel">
      ${msgHtml}
      <div class="dt-box">
        <div class="settings-item-label">저장하기</div>
        <div class="settings-item-desc">게임은 자동으로 저장됩니다. 지금 바로 저장하려면 아래 버튼을 누르세요.<br>${saveLine}</div>
        <div class="dt-row"><button type="button" class="nav-btn" data-dt-act="save" ${dtBusy ? 'disabled' : ''}>지금 저장하기</button></div>
      </div>
      <div class="dt-box">
        <div class="settings-item-label">내보내기</div>
        <div class="settings-item-desc">현재 데이터를 코드로 만듭니다. 다른 기기에서 [불러오기]에 붙여넣거나 파일을 선택하세요. 코드를 고치면 불러올 수 없습니다.</div>
        <div class="dt-row">
          <button type="button" class="nav-btn" data-dt-act="export" ${dtBusy ? 'disabled' : ''}>코드 만들기</button>
          ${dtExport ? `<button type="button" class="nav-btn" data-dt-act="copy">코드 복사</button><button type="button" class="nav-btn" data-dt-act="download">파일로 저장</button>` : ''}
        </div>
        ${dtExport ? `<textarea id="dtExportText" class="dt-text" readonly rows="4" spellcheck="false">${dtEsc(dtExport.code)}</textarea>
        <div class="settings-item-desc">${dtFmtTime(dtExport.at)}에 만든 코드 · ${dtFmtNum(dtExport.code.length)}자</div>` : ''}
      </div>
      <div class="dt-box">
        <div class="settings-item-label">불러오기</div>
        <div class="settings-item-desc">내보낸 코드를 붙여넣거나 파일을 선택하세요. 먼저 검사한 뒤, 바꿀 내용을 확인하고 적용합니다.</div>
        <textarea id="dtImportText" class="dt-text" rows="4" spellcheck="false" placeholder="여기에 코드를 붙여넣으세요">${dtEsc(dtImportText)}</textarea>
        <div class="dt-row">
          <button type="button" class="nav-btn" data-dt-act="pick" ${dtBusy ? 'disabled' : ''}>파일 선택</button>
          <button type="button" class="btn btn-main" data-dt-act="check" ${dtBusy ? 'disabled' : ''}>코드 검사</button>
          <input type="file" id="dtFileInput" accept=".txt,text/plain" style="display:none;">
        </div>
      </div>
      ${pendingHtml}
      ${backupHtml}
    </div>`;
}

function dtRefresh(){
  if(typeof renderSettings === 'function') renderSettings();
}
function dtCaptureText(){
  const t = el('dtImportText');
  if(t) dtImportText = t.value;
}
async function dtCheckImport(text){
  dtPending = null;
  dtBusy = true; dtSetMsg('코드를 검사하는 중입니다...', 'info'); dtRefresh();
  try{
    const parsed = await dtParseCode(text);
    if(!parsed.ok){ dtSetMsg(parsed.error, 'err'); return; }
    const errs = dtValidateState(parsed.wrapper.state);
    if(errs.length){ dtSetMsg('데이터가 규칙에 맞지 않아 불러올 수 없습니다: ' + errs.join(' '), 'err'); return; }
    dtPending = { state: parsed.wrapper.state, at: parsed.wrapper.at, summary: dtSummary(parsed.wrapper.state), source: 'code' };
    dtSetMsg('검사를 통과했습니다. 아래 내용을 확인한 뒤 불러오기를 실행하세요.', 'ok');
  }finally{
    dtBusy = false; dtRefresh();
  }
}
async function dtDoSave(){
  dtBusy = true; dtRefresh();
  try{
    const ok = await saveState();
    dtSetMsg(ok ? '저장했습니다.' : '저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.', ok ? 'ok' : 'err');
  }finally{ dtBusy = false; dtRefresh(); }
}
async function dtDoExport(){
  dtBusy = true; dtRefresh();
  try{
    dtExport = await dtBuildExportCode();
    dtSetMsg('코드를 만들었습니다. 복사하거나 파일로 저장하세요.', 'ok');
  }catch(e){
    dtExport = null; dtSetMsg('코드를 만들지 못했습니다.', 'err');
  }finally{ dtBusy = false; dtRefresh(); }
}
async function dtDoCopy(){
  if(!dtExport) return;
  let done = false;
  try{ if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(dtExport.code); done = true; } }catch(e){}
  if(!done){
    const t = el('dtExportText');
    if(t){ t.focus(); t.select(); try{ done = document.execCommand('copy'); }catch(e){} }
  }
  dtSetMsg(done ? '코드를 복사했습니다.' : '자동 복사가 막혀 있습니다. 위 입력창의 코드를 직접 선택해 복사해 주세요.', done ? 'ok' : 'err');
  dtRefresh();
}
function dtDoDownload(){
  if(!dtExport) return;
  try{
    const d = new Date(dtExport.at), p = (v) => String(v).padStart(2, '0');
    const name = 'enhance-slay-save-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.txt';
    const url = URL.createObjectURL(new Blob([dtExport.code], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    dtSetMsg('파일로 저장했습니다(' + name + ').', 'ok');
  }catch(e){
    dtSetMsg('파일 저장이 막혀 있습니다. [코드 복사]를 이용해 주세요.', 'err');
  }
  dtRefresh();
}
async function dtDoApply(){
  if(!dtPending || dtBusy) return;
  const blocked = dtBlockedReason();
  if(blocked){ dtSetMsg(blocked, 'err'); dtRefresh(); return; }
  dtBusy = true; dtRefresh();
  if(!dtWriteBackup()){
    dtBusy = false; dtSetMsg('현재 데이터를 백업하지 못해 불러오기를 중단했습니다(브라우저 저장 공간 확인).', 'err'); dtRefresh(); return;
  }
  try{
    await dtApplyState(dtPending.state); // 성공하면 새로고침됨
  }catch(e){
    console.error('불러오기 실패', e);
    dtBusy = false; dtSetMsg('불러오기 중 오류가 발생했습니다. 데이터는 그대로입니다 — 새로고침 후 다시 확인해 주세요.', 'err'); dtRefresh();
  }
}
function dtDoRestorePrepare(){
  const backup = dtReadBackup();
  if(!backup){ dtSetMsg('백업이 없습니다.', 'err'); dtRefresh(); return; }
  try{
    const s = JSON.parse(backup.raw);
    dtPending = { state: s, at: backup.at, summary: dtSummary(s), source: 'backup' };
    dtSetMsg('백업 내용을 확인한 뒤 실행하세요.', 'info');
  }catch(e){
    dtSetMsg('백업 데이터를 읽지 못했습니다.', 'err');
  }
  dtRefresh();
}

// ---- 이벤트 연결(설정 본문은 다시 그려지므로 #settingsBody에 위임) ----
(function initDataTransferUi(){
  const body = el('settingsBody');
  if(!body) return;
  body.addEventListener('input', (e) => { if(e.target && e.target.id === 'dtImportText') dtImportText = e.target.value; });
  body.addEventListener('change', (e) => {
    if(!e.target || e.target.id !== 'dtFileInput') return;
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => { dtImportText = String(reader.result || ''); dtCheckImport(dtImportText); };
    reader.onerror = () => { dtSetMsg('파일을 읽지 못했습니다.', 'err'); dtRefresh(); };
    reader.readAsText(file);
  });
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dt-act]');
    if(!btn || btn.disabled) return;
    dtCaptureText();
    const act = btn.dataset.dtAct;
    if(act === 'save') dtDoSave();
    else if(act === 'export') dtDoExport();
    else if(act === 'copy') dtDoCopy();
    else if(act === 'download') dtDoDownload();
    else if(act === 'pick'){ const f = el('dtFileInput'); if(f){ f.value = ''; f.click(); } }
    else if(act === 'check') dtCheckImport(dtImportText);
    else if(act === 'apply') dtDoApply();
    else if(act === 'cancel'){ dtPending = null; dtSetMsg('', ''); dtRefresh(); }
    else if(act === 'restore') dtDoRestorePrepare();
  });
})();
