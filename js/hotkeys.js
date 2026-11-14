// ============================================================
// 단축키 (설정 > 단축키)
// ------------------------------------------------------------
// [1단계: 설정 탭 UI·저장 구조·키 입력 팝업·검증] [2단계: 실제 키 동작 — 파일 맨 아래 "키 동작" 섹션] [3단계: 화면 표기 — "화면 표기" 섹션(메뉴 이름 옆 (키) / 퀵슬롯 좌상단 뱃지)]
//
// ■ 동작 목록은 하드코딩하지 않음(hotkeyActionList):
//   - 메뉴: #menuGrid의 .menu-grid-item 버튼을 실행 시점에 읽음(id=버튼 id, 이름=.menu-grid-label, 순서=CSS order) → 메뉴가 늘면 자동으로 나타남. 필수 등록.
//   - 스킬: SKILL_QUICK_SLOT_COUNT칸(스킬1 = 첫 줄 가장 왼쪽부터), 퀵슬롯(플라스크): QUICK_SLOT_COUNT칸(1 = 왼쪽, 2 = 오른쪽). 선택 등록.
//   - 상호작용: 타겟 변경 / 나가기(Esc 고정 + 추가 키 1개) / 획득 아이템 목록. 선택 등록.
// ■ 저장: state.settings.hotkeyBindings = { 동작id: 키코드 } ('' = 미지정, null = 한 번도 저장 안 함 → 기본값). 키는 e.code(물리 키 위치)로 저장.
// ■ 편집은 전부 "초안"(hotkeyUI.draft)에서 하고 [저장]을 눌러야 state에 반영됨. [초기화]도 초안만 기본값으로 되돌림.
// ■ 규칙: 메뉴 동작은 키가 꼭 있어야 저장 가능(없으면 붉은색) / 이미 쓰는 키를 다른 동작에 넣으면 그 키가 이동(이전 동작은 미지정) /
//        Esc는 나가기에 고정이라 다른 동작에 지정 불가 / Tab·Enter·F키·Ctrl·Alt·Meta 조합 등은 지정 불가(Space는 가능) / 키 칸 우클릭 = 해제.
// ============================================================

const HOTKEY_ESC_CODE = 'Escape'; // 나가기 고정 키
const HOTKEY_PUNCT_LABELS = {
  Space: 'Space', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
  Slash: '/', Backslash: '\\', Backquote: '`', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  NumpadAdd: 'Num+', NumpadSubtract: 'Num-', NumpadMultiply: 'Num*', NumpadDivide: 'Num/', NumpadDecimal: 'Num.',
};
const HOTKEY_MODIFIER_CODES = ['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'CapsLock', 'NumLock', 'ContextMenu'];

// UI 상태(저장하지 않음)
const hotkeyUI = { draft: null, notice: '', capturingId: null, discardProceed: null };

// ---- 키 코드 ↔ 표시 이름 / 지정 가능 여부 ----
function hotkeyCodeLabel(code){
  if(!code) return '';
  if(code === HOTKEY_ESC_CODE) return 'ESC';
  if(/^Key[A-Z]$/.test(code)) return code.slice(3);
  if(/^Digit[0-9]$/.test(code)) return code.slice(5);
  if(/^Numpad[0-9]$/.test(code)) return 'Num' + code.slice(6);
  return HOTKEY_PUNCT_LABELS[code] || code;
}
// 지정 가능한 키: 영문자, 숫자(위/숫자패드), 숫자패드 연산 키, 기호, 방향키, Space. (Tab/Enter/F1~F12/Esc/Backspace 등은 브라우저·포커스·고정 키와 충돌해서 제외.
// Space는 포커스가 남은 버튼을 같이 눌러버리는 기본 동작이 있어 아래 키 동작에서 기본 동작을 막고 포커스를 풀어 줌 — hotkeyOnKeydown/keyup)
function hotkeyIsAllowedCode(code){
  return /^Key[A-Z]$/.test(code) || /^Digit[0-9]$/.test(code) || /^Numpad[0-9]$/.test(code) || (code in HOTKEY_PUNCT_LABELS);
}
function hkEsc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// 메뉴 버튼 이름(화면 표기용 "(키)" 조각은 뺀 순수 이름)
function hotkeyMenuBaseLabel(labelEl){
  const c = labelEl.cloneNode(true);
  c.querySelectorAll('.menu-grid-key').forEach(n => n.remove());
  return c.textContent.trim();
}

// ---- 동작 목록(실제 메뉴·퀵슬롯에서 계산) ----
function hotkeyActionList(){
  const list = [];
  const menuBtns = Array.from(document.querySelectorAll('#menuGrid .menu-grid-item')).filter(b => b.id && b.querySelector('.menu-grid-label'));
  menuBtns
    .map((b, i) => ({ b, i, order: parseInt(getComputedStyle(b).order, 10) || 0 }))
    .sort((a, c) => (a.order - c.order) || (a.i - c.i)) // 설정처럼 CSS order로 맨 뒤로 보낸 메뉴도 화면 순서 그대로
    .forEach(({ b }) => list.push({ id: 'menu:' + b.id, group: 'menu', label: hotkeyMenuBaseLabel(b.querySelector('.menu-grid-label')), required: true, btnId: b.id }));
  for(let i = 1; i <= SKILL_QUICK_SLOT_COUNT; i++) list.push({ id: 'skill:' + i, group: 'skill', label: '스킬' + i, slot: i - 1 });
  for(let i = 1; i <= QUICK_SLOT_COUNT; i++) list.push({ id: 'flask:' + i, group: 'flask', label: '퀵슬롯' + i, slot: i - 1 });
  list.push({ id: 'target', group: 'action', label: '타겟 변경' });
  list.push({ id: 'stage', group: 'action', label: '스테이지 진행' });
  list.push({ id: 'exit', group: 'action', label: '나가기', fixedEsc: true });
  list.push({ id: 'rewards', group: 'action', label: '획득 아이템 목록' });
  return list;
}
function hotkeyDefaultFor(a){
  if(a.group === 'menu') return HOTKEY_MENU_DEFAULTS[a.btnId] || '';
  if(a.group === 'skill') return HOTKEY_SKILL_DEFAULTS[a.slot] || '';
  if(a.group === 'flask') return HOTKEY_FLASK_DEFAULTS[a.slot] || '';
  return HOTKEY_ACTION_DEFAULTS[a.id] || '';
}
function hotkeyFirstFreeLetter(used){
  for(let c = 65; c <= 90; c++){ const code = 'Key' + String.fromCharCode(c); if(!used.has(code)) return code; }
  return '';
}
// 저장값(saved: {id: code} 또는 null)을 현재 동작 목록에 맞춰 완성한 "실제 적용 키 맵"을 계산함.
//  1) 저장된 값 우선('' 포함) 2) 저장된 적 없는 동작은 기본값(이미 쓰이는 키면 제외) 3) 그래도 비어 있는 메뉴(필수)는 안 쓰는 첫 알파벳 키 자동 배정
function hotkeyComputeBindings(saved){
  const list = hotkeyActionList();
  const src = saved && typeof saved === 'object' ? saved : {};
  const out = {}, used = new Set([HOTKEY_ESC_CODE]);
  list.forEach(a => { if(a.id in src){ const c = src[a.id] || ''; out[a.id] = c; if(c) used.add(c); } });
  list.forEach(a => { if(a.id in out) return; const d = hotkeyDefaultFor(a); if(d && !used.has(d)){ out[a.id] = d; used.add(d); } });
  list.forEach(a => {
    if(a.id in out) return;
    if(a.required){ const c = hotkeyFirstFreeLetter(used); out[a.id] = c; if(c) used.add(c); }
    else out[a.id] = '';
  });
  return out;
}
// 지금 실제로 적용되는 키 맵(2단계 키 동작과 3단계 표기가 이 함수를 씀)
function hotkeyEffectiveBindings(){
  return hotkeyComputeBindings(state.settings && state.settings.hotkeyBindings);
}

// ---- 초안 ----
function hotkeyDraftInit(){ hotkeyUI.draft = hotkeyEffectiveBindings(); hotkeyUI.notice = ''; }
function hotkeyEnsureDraft(){ if(!hotkeyUI.draft) hotkeyDraftInit(); return hotkeyUI.draft; }
function hotkeyIsDirty(){
  if(!hotkeyUI.draft) return false;
  const eff = hotkeyEffectiveBindings();
  return hotkeyActionList().some(a => (hotkeyUI.draft[a.id] || '') !== (eff[a.id] || ''));
}
function hotkeyMissingRequired(){
  const d = hotkeyEnsureDraft();
  return hotkeyActionList().filter(a => a.required && !d[a.id]);
}
function hotkeyLabelOf(id){ const a = hotkeyActionList().find(x => x.id === id); return a ? a.label : id; }

// ---- 조작 ----
// 키 지정(이미 다른 동작이 쓰는 키면 그 동작에서 빼서 이쪽으로 이동 + 안내)
function hotkeyAssign(actionId, code){
  const d = hotkeyEnsureDraft();
  let notice = '';
  Object.keys(d).forEach(id => {
    if(id !== actionId && d[id] === code){
      d[id] = '';
      notice = `${hotkeyCodeLabel(code)} 키가 이동했어요: ${hotkeyLabelOf(id)} → ${hotkeyLabelOf(actionId)}`;
    }
  });
  d[actionId] = code;
  hotkeyUI.notice = notice;
  renderSettings();
}
function hotkeyClear(actionId){
  const d = hotkeyEnsureDraft();
  if(!d[actionId]) return;
  d[actionId] = '';
  hotkeyUI.notice = '';
  renderSettings();
}
function hotkeyReset(){
  hotkeyUI.draft = hotkeyComputeBindings(null); // 기본값(초안만 바꿈 — [저장]을 눌러야 확정)
  hotkeyUI.notice = '기본값으로 되돌렸어요. [저장]을 눌러야 적용됩니다.';
  renderSettings();
}
function hotkeySave(){
  if(hotkeyMissingRequired().length) return;
  const d = hotkeyEnsureDraft();
  const out = {};
  hotkeyActionList().forEach(a => { out[a.id] = d[a.id] || ''; });
  if(!state.settings) state.settings = {};
  state.settings.hotkeyBindings = out;
  saveState();
  hotkeyUI.notice = '저장했어요.';
  renderSettings();
  if(typeof hotkeysChanged === 'function') hotkeysChanged();
}
// 저장 직후 호출: 메뉴 이름 옆 (키)와 퀵슬롯 좌상단 표기를 새 설정으로 다시 그림(키 동작은 매번 저장값을 읽으므로 따로 할 일 없음)
function hotkeysChanged(){
  hotkeyRefreshMenuLabels();
  if(typeof renderSkillQuickSlots === 'function') renderSkillQuickSlots();
  if(typeof renderQuickSlots === 'function') renderQuickSlots();
}

// ---- 설정창을 벗어날 때(카테고리 전환/닫기) 저장 안 한 변경이 있으면 확인 ----
// 변경이 없으면 바로 proceed 실행, 있으면 확인 팝업을 띄우고 "버리고 나가기"를 누를 때 초안을 버리고 proceed 실행.
function hotkeyGuardLeave(proceed){
  if(activeSettingsCategory === 'hotkeys' && hotkeyIsDirty()){
    hotkeyUI.discardProceed = proceed;
    el('hotkeyDiscardModal').style.display = 'flex';
    return;
  }
  proceed();
}

// ---- 화면 ----
function hotkeyKeyCellHtml(a, code, opts){
  const missing = a.required && !code;
  const cls = 'hotkey-key' + (code ? '' : ' empty') + (missing ? ' missing' : '');
  const text = code ? hkEsc(hotkeyCodeLabel(code)) : (missing ? '미등록' : '—');
  return `<button type="button" class="${cls}" data-hk-id="${a.id}" title="클릭: 변경 / 우클릭: 해제">${text}</button>`;
}
function hotkeySlotCellHtml(a, code, iconHtml, color){
  const missing = a.required && !code;
  const cls = 'hotkey-slot' + (code ? '' : ' empty') + (missing ? ' missing' : '');
  const text = code ? hkEsc(hotkeyCodeLabel(code)) : '—';
  return `<button type="button" class="${cls}" data-hk-id="${a.id}" title="${hkEsc(a.label)} — 클릭: 변경 / 우클릭: 해제"${color ? ` style="border-color:${color};"` : ''}>
    <span class="hotkey-slot-no">${a.slot + 1}</span><span class="hotkey-slot-icon">${iconHtml || ''}</span><span class="hotkey-slot-key">${text}</span></button>`;
}
function hotkeyPanelHtml(){
  const d = hotkeyEnsureDraft();
  const list = hotkeyActionList();
  const rows = a => `<div class="hotkey-row"><span class="hotkey-row-label">${hkEsc(a.label)}</span>${hotkeyKeyCellHtml(a, d[a.id] || '')}</div>`;
  const menuHtml = list.filter(a => a.group === 'menu').map(rows).join('');
  const skillHtml = list.filter(a => a.group === 'skill').map(a => {
    const sid = state.skillQuickSlots && state.skillQuickSlots[a.slot];
    const s = sid ? SKILLS[sid] : null;
    const g = s && WEAPON_GRADES[s.grade];
    return hotkeySlotCellHtml(a, d[a.id] || '', s ? skillIconHtml(s) : '', g ? g.color : '');
  }).join('');
  const flaskHtml = list.filter(a => a.group === 'flask').map(a => {
    const iid = state.quickSlots && state.quickSlots[a.slot];
    const item = iid ? CONSUMABLES[iid] : null;
    return hotkeySlotCellHtml(a, d[a.id] || '', item ? itemIconHtml(item, 'inv-icon-img') : '', item && consumableGradeInfo(item) ? consumableBorderColor(item) : '');
  }).join('');
  const actionHtml = list.filter(a => a.group === 'action').map(a => {
    if(a.fixedEsc){
      return `<div class="hotkey-row"><span class="hotkey-row-label">${hkEsc(a.label)}<span class="hotkey-row-sub">창 닫기·취소·던전 나가기</span></span>
        <span class="hotkey-row-keys"><span class="hotkey-key fixed" title="Esc는 나가기에 고정되어 있습니다">ESC</span>${hotkeyKeyCellHtml(a, d[a.id] || '')}</span></div>`;
    }
    return rows(a);
  }).join('');
  const missing = hotkeyMissingRequired();
  const dirty = hotkeyIsDirty();
  let msg;
  if(missing.length) msg = `<div class="hotkey-msg error">필수 단축키가 비어 있어 저장할 수 없어요: ${missing.map(a => hkEsc(a.label)).join(', ')}</div>`;
  else if(hotkeyUI.notice) msg = `<div class="hotkey-msg notice">${hkEsc(hotkeyUI.notice)}</div>`;
  else msg = `<div class="hotkey-msg">키 칸을 누르면 변경, 우클릭하면 해제됩니다.${dirty ? ' (저장 전)' : ''}</div>`;
  return `
    <div class="hotkey-panel">
      ${msg}
      <div class="hotkey-scroll" id="hotkeyScroll">
        <div class="hotkey-section-title">메뉴 바로가기 <span class="hotkey-req">필수</span></div>
        ${menuHtml}
        <div class="hotkey-section-title">스킬 퀵슬롯</div>
        <div class="hotkey-slot-grid">${skillHtml}</div>
        <div class="hotkey-section-title">퀵슬롯 (플라스크)</div>
        <div class="hotkey-slot-grid hotkey-flask-grid">${flaskHtml}</div>
        <div class="hotkey-section-title">상호 작용</div>
        ${actionHtml}
      </div>
      <div class="hotkey-footer">
        <button type="button" class="nav-btn" data-hk-act="reset">초기화</button>
        <button type="button" class="btn btn-main" data-hk-act="save" ${missing.length || !dirty ? 'disabled' : ''}>저장</button>
      </div>
    </div>`;
}

// ---- 키 입력 팝업 ----
function hotkeyOpenCapture(actionId){
  const a = hotkeyActionList().find(x => x.id === actionId);
  if(!a) return;
  hotkeyUI.capturingId = actionId;
  el('hotkeyCaptureTarget').textContent = a.label;
  el('hotkeyCaptureInput').textContent = '키를 입력하세요...';
  el('hotkeyCaptureInput').classList.remove('error');
  el('hotkeyCaptureMsg').textContent = 'Esc: 취소 · Tab/Enter/F키/Ctrl·Alt 조합은 사용할 수 없어요.';
  el('hotkeyCaptureModal').style.display = 'flex';
  window.addEventListener('keydown', hotkeyOnCaptureKey, true);
}
function hotkeyCloseCapture(){
  hotkeyUI.capturingId = null;
  el('hotkeyCaptureModal').style.display = 'none';
  window.removeEventListener('keydown', hotkeyOnCaptureKey, true);
}
function hotkeyCaptureReject(text){
  el('hotkeyCaptureInput').classList.add('error');
  el('hotkeyCaptureMsg').textContent = text;
}
function hotkeyOnCaptureKey(e){
  // 팝업이 열려 있는 동안엔 모든 키 입력을 여기서만 처리(다른 화면의 Esc/단축키 처리가 끼어들지 않게 먼저 가로챔)
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  if(e.repeat) return;
  if(e.code === HOTKEY_ESC_CODE){ hotkeyCloseCapture(); return; }
  if(HOTKEY_MODIFIER_CODES.includes(e.code)) return; // 조합키 단독 입력은 무시
  if(e.ctrlKey || e.altKey || e.metaKey){ hotkeyCaptureReject('Ctrl/Alt/Meta 조합은 사용할 수 없어요.'); return; }
  if(!hotkeyIsAllowedCode(e.code)){ hotkeyCaptureReject('사용할 수 없는 키예요. (영문자·숫자·기호·방향키·Space만 가능)'); return; }
  const id = hotkeyUI.capturingId;
  hotkeyCloseCapture();
  hotkeyAssign(id, e.code);
}

// ---- 이벤트 연결(설정 본문은 다시 그려지므로 #settingsBody에 위임) ----
(function initHotkeyUi(){
  const body = el('settingsBody');
  if(!body) return;
  body.addEventListener('click', (e) => {
    const act = e.target.closest('[data-hk-act]');
    if(act){
      if(act.dataset.hkAct === 'reset') hotkeyReset();
      else if(act.dataset.hkAct === 'save') hotkeySave();
      return;
    }
    const cell = e.target.closest('[data-hk-id]');
    if(cell) hotkeyOpenCapture(cell.dataset.hkId);
  });
  body.addEventListener('contextmenu', (e) => { // 키 칸 우클릭 = 해제
    const cell = e.target.closest('[data-hk-id]');
    if(!cell) return;
    e.preventDefault();
    hotkeyClear(cell.dataset.hkId);
  });
  el('hotkeyCaptureCancel').addEventListener('click', hotkeyCloseCapture);
  el('hotkeyCaptureClear').addEventListener('click', () => { const id = hotkeyUI.capturingId; hotkeyCloseCapture(); if(id) hotkeyClear(id); });
  el('hotkeyDiscardKeep').addEventListener('click', () => { hotkeyUI.discardProceed = null; el('hotkeyDiscardModal').style.display = 'none'; });
  el('hotkeyDiscardGo').addEventListener('click', () => {
    const go = hotkeyUI.discardProceed;
    hotkeyUI.discardProceed = null;
    el('hotkeyDiscardModal').style.display = 'none';
    hotkeyDraftInit(); // 변경 사항 버림
    if(go) go();
  });
})();

// ============================================================
// 키 동작 (실제 키 입력 처리)
// ------------------------------------------------------------
// window keydown(capture) 한 곳에서 처리. 키 → 동작은 hotkeyEffectiveBindings()(저장된 값)로 찾음 — 설정창의 초안 값은 [저장] 전에는 반영되지 않음.
// 무시하는 경우: 키 반복(꾹 누름)·한글 조합 중·Ctrl/Alt/Meta 조합·입력칸에 글자 입력 중·단축키 지정 팝업이 열려 있을 때.
// 창(모달)이 열려 있으면 [나가기]만 동작해서 맨 위 창을 "안전하게 닫는 버튼"으로 닫고(아래 HOTKEY_MODAL_CANCEL), 다른 단축키는 무시함.
// 메뉴/스킬/퀵슬롯 단축키는 화면의 실제 버튼을 .click()해서 기존 조건(비활성·확인창·전투 중 이동 확인 등)을 그대로 따름.
// ============================================================

// 창 id → 그 창을 "취소/닫기"로 안전하게 닫는 버튼 id(앞에서부터 보이는 첫 버튼을 누름).
// 일부러 목록에 없는 창: deathModal(부활 선택 필수) / craftAnimModal(제작 연출 진행) — 나가기를 눌러도 닫히지 않고, 아래 창으로 새어 나가지도 않음.
// killResultModal은 [닫기](보상창 보기)/[계속 전투](던전 나가기 흐름)만 대상 — 최종 보상창(재탐험/마을 귀환 선택)은 선택이 필수라 닫히지 않음.
// settingsModal(closeSettings)·boxUseModal(closeBoxModal)은 버튼이 아니라 함수로 닫음(hotkeyDismissModal).
const HOTKEY_MODAL_CANCEL = {
  killResultModal: ['krCloseBtn', 'krResumeBtn'],
  leaveConfirmModal: ['leaveConfirmContinueBtn'],
  sellConfirmModal: ['sellConfirmNoBtn'],
  buyQtyModal: ['buyQtyCancelBtn'],
  skillLearnConfirmModal: ['skillLearnCancelBtn'],
  scrollUseModal: ['scrollUseCancelBtn'],
  scrollResultModal: ['scrollResultOkBtn'],
  skillResetConfirmModal: ['skillResetCancelBtn'],
  traceRestoreModal: ['traceRestoreCancelBtn'],
  traceRestoreResultModal: ['traceRestoreResultOkBtn'],
  traceSlotFullModal: ['traceSlotFullOkBtn'],
  patchNoteModal: ['closePatchNoteBtn'],
  quickSlotPickerModal: ['closeQuickSlotPickerBtn'],
  forgeSelectModal: ['closeForgeSelectBtn'],
  repairSelectModal: ['closeRepairSelectBtn'],
  craftPopupModal: ['craftPopupCancelBtn'],
  restorePopupModal: ['restorePopupCancelBtn'],
  restoreSelectModal: ['closeRestoreSelectBtn'],
  craftSelectModal: ['closeCraftSelectBtn'],
  craftCatalystModal: ['closeCraftCatalystBtn'],
  craftConfirmModal: ['craftConfirmCancelBtn'],
  restoreConfirmModal: ['restoreConfirmCancelBtn'],
  restoreResultModal: ['restoreResultConfirmBtn'],
  repairIndividualModal: ['repairIndivCancelBtn'],
  repairAllModal: ['repairAllCancelBtn'],
  repairConfirmModal: ['repairConfirmCancelBtn'],
  hotkeyDiscardModal: ['hotkeyDiscardKeep'],
};

function hotkeyElVisible(node){ return !!node && getComputedStyle(node).display !== 'none' && node.getClientRects().length > 0; }
// 눈에 보이고 비활성이 아닌 버튼이면 누르고 true
function hotkeyClickIfUsable(node){
  if(!node || node.disabled || !hotkeyElVisible(node)) return false;
  node.click();
  return true;
}
// 지금 열려 있는 창 중 맨 위(z-index가 높은 것, 같으면 화면에 더 나중에 있는 것)
function hotkeyTopModal(){
  const open = Array.from(document.querySelectorAll('.modal-overlay')).filter(m => getComputedStyle(m).display !== 'none');
  if(open.length === 0) return null;
  return open
    .map((m, i) => ({ m, i, z: parseInt(getComputedStyle(m).zIndex, 10) || 0 }))
    .sort((a, b) => (b.z - a.z) || (b.i - a.i))[0].m;
}
function hotkeyIsTypingTarget(t){
  if(!t || !t.tagName) return false;
  const tag = t.tagName.toUpperCase();
  if(tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return true;
  if(tag === 'INPUT') return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes((t.type || '').toLowerCase());
  return false;
}
// 창 하나를 안전하게 닫음. 목록에 없는 창은 아무것도 하지 않음(true를 돌려줘도 호출 쪽은 이미 이 키를 소비한 것으로 처리).
function hotkeyDismissModal(modal){
  const id = modal.id;
  if(id === 'settingsModal'){ closeSettings(); return; } // 저장 안 한 단축키 변경이 있으면 확인창이 뜸
  if(id === 'boxUseModal'){ if(typeof boxUI !== 'undefined' && boxUI && (boxUI.stage === 'list' || boxUI.stage === 'result')) closeBoxModal(); return; } // 대기·연출 중에는 닫지 않음
  const ids = HOTKEY_MODAL_CANCEL[id];
  if(ids) ids.some(bid => hotkeyClickIfUsable(el(bid)));
}
// 기존에 Esc로 닫히던 작은 층(메뉴 그리드/인벤토리 팝업·비교/도감 팝업·정보)이 열려 있는지 — 이 층들은 각자의 Esc 처리(main.js·inventory_box.js·codex.js)가 닫음
function hotkeyLocalEscLayerOpen(){
  const grid = el('menuGrid');
  if(grid && grid.style.display !== 'none') return true;
  if(typeof invBoxUI !== 'undefined' && invBoxUI && invBoxUI.popupKey) return true;
  if(typeof invCompare !== 'undefined' && invCompare && invCompare.on) return true;
  if(typeof codexUI !== 'undefined' && codexUI && codexUI.popupKey) return true;
  if(typeof codexInfo !== 'undefined' && codexInfo && (codexInfo.picking || (typeof codexInfoIsOpen === 'function' && codexInfoIsOpen()))) return true;
  if(typeof codexMUI !== 'undefined' && codexMUI && codexMUI.infoKey) return true;
  return false;
}
// 맨 위 화면에서 한 단계 나감: 던전 화면 → 던전 나가기 흐름(보상창 + [계속 전투]/[던전 나가기]), 그 밖의 메뉴 화면 → 마을(각 화면의 ← 버튼과 같음), 마을에서는 아무 일도 없음
function hotkeyLeaveCurrentView(){
  if(currentView === 'hunt'){
    if(hunt.dungeon && hunt.pendingRewards) openHuntLeaveFlow();
    else guardedNav('dungeonlist');
    return;
  }
  if(currentView === 'town'){ if(townUI.selected){ townUI.selected = null; townRenderBubble(); } return; } // 마을: 열려 있는 건물 말풍선만 닫음(마을이 맨 위 화면이라 더 나갈 곳이 없음)
  if(currentView) closeToTown();
}
// 나가기(Esc 또는 사용자가 지정한 추가 키). 순서: 열린 창(모달) → 기존 Esc 층 → 떠 있는 메뉴 팝업 → 화면 나가기
function hotkeyDoExit(e, isRealEsc){
  const top = hotkeyTopModal();
  if(top){
    e.preventDefault(); e.stopImmediatePropagation(); // 창 아래 화면(메뉴 그리드·인벤토리 팝업 등)이 같은 키로 같이 닫히지 않게
    hotkeyDismissModal(top);
    return;
  }
  if(hotkeyLocalEscLayerOpen()){
    // 진짜 Esc는 그대로 흘려보내 기존 Esc 처리가 닫게 하고, 사용자가 지정한 추가 키는 Esc 입력으로 바꿔 같은 처리를 태움
    if(!isRealEsc){ e.preventDefault(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })); }
    return;
  }
  e.preventDefault(); e.stopImmediatePropagation();
  if(typeof menuPopupCloseTop === 'function' && menuPopupCloseTop()) return; // 떠 있는 메뉴 팝업(menu_popup.js)이 있으면 맨 위 팝업부터 하나씩 닫음
  hotkeyLeaveCurrentView();
}
// 획득 아이템 목록: 던전 화면에서 열기, 이미 열려 있는 보상창(보기 모드)이면 닫기
function hotkeyToggleRewards(){
  const top = hotkeyTopModal();
  if(top){ if(top.id === 'killResultModal') hotkeyClickIfUsable(el('krCloseBtn')); return; }
  if(currentView === 'hunt') openLiveRewardView();
}
// 던전 화면의 실제 퀵슬롯 칸(0부터)에 있는 버튼을 누름 — 스킬: 사용 가능한 스킬 칸만, 플라스크: 등록돼 있고 사용 가능한 칸만(빈 칸의 [+]는 누르지 않음)
function hotkeyPressQuickSlot(rowId, slot, action){
  if(currentView !== 'hunt') return;
  const row = el(rowId);
  const wrap = row && row.children[slot];
  const btn = wrap && wrap.querySelector('.quickslot-btn');
  if(btn && btn.dataset.action === action) hotkeyClickIfUsable(btn);
}
function hotkeyRun(actionId){
  if(actionId === 'rewards'){ hotkeyToggleRewards(); return; }
  if(hotkeyTopModal()) return; // 창이 열려 있으면 나가기·획득 아이템 목록 외에는 동작하지 않음
  if(actionId.startsWith('menu:')){ const b = el(actionId.slice(5)); if(b && !b.disabled) b.click(); return; }
  const m = /^(skill|flask):(\d+)$/.exec(actionId);
  if(m){
    const slot = parseInt(m[2], 10) - 1;
    if(m[1] === 'skill') hotkeyPressQuickSlot('huntSkillQuickSlotRow', slot, 'use-skill');
    else hotkeyPressQuickSlot('quickSlotRow', slot, 'use');
    return;
  }
  if(actionId === 'target'){ if(currentView === 'hunt') cycleTarget(); return; }
  if(actionId === 'stage'){ hotkeyAdvanceStage(); return; }
}
// 스테이지 진행: 던전 화면에서 (1) 클리어 후 준비시간 중이면 대기를 건너뛰고 다음 스테이지로(= [다음 스테이지 즉시 이동] 버튼), (2) 11스테이지(숨겨진 장소)면 보물 상자 열기(= 상자 클릭).
// 둘 다 화면의 실제 동작 함수를 그대로 부르므로 조건(일시정지·이미 열림 등)이 클릭과 같고, 해당 없는 상황에서는 아무 일도 없음.
function hotkeyAdvanceStage(){
  if(currentView !== 'hunt' || !hunt.dungeon) return;
  if(isHuntPrepButtonsVisible()){ skipHuntPrep(); return; }
  if(hunt.stage === DUNGEON_TREASURE_STAGE && !hunt.chestOpened && hotkeyElVisible(el('treasureChest'))) clickTreasureChest();
}
// 포커스가 남은 버튼(방금 마우스로 누른 버튼 등)을 풀어 줌 — Space를 누르면 브라우저가 그 버튼을 한 번 더 누르는 걸 막기 위함
function hotkeyReleaseFocus(){
  const a = document.activeElement;
  if(a && a !== document.body && ['BUTTON', 'A', 'SUMMARY'].includes(a.tagName)) a.blur();
}
function hotkeyOnKeydown(e){
  if(hotkeyUI.capturingId) return; // 단축키 지정 팝업이 열려 있으면 팝업이 키를 받음
  if(e.repeat || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return;
  if(hotkeyIsTypingTarget(e.target)) return;
  const isRealEsc = e.code === HOTKEY_ESC_CODE;
  const bindings = hotkeyEffectiveBindings();
  const actionId = isRealEsc ? 'exit' : Object.keys(bindings).find(id => bindings[id] && bindings[id] === e.code);
  if(!actionId) return;
  if(actionId === 'exit'){ hotkeyDoExit(e, isRealEsc); return; }
  if(actionId !== 'rewards' && hotkeyTopModal()) return; // 창이 열려 있으면 이 키는 동작하지 않으므로 브라우저 기본 동작(창 안 버튼 Space 누르기 등)도 건드리지 않음
  e.preventDefault(); // Space면 페이지 스크롤/포커스된 버튼 누르기 방지
  if(e.code === 'Space') hotkeyReleaseFocus();
  hotkeyRun(actionId);
}
window.addEventListener('keydown', hotkeyOnKeydown, true);
// 일부 브라우저는 Space로 버튼을 누르는 동작이 keyup에서 일어나므로, Space에 지정된 동작이 있으면 keyup의 기본 동작도 막음(입력칸 글자 입력·창이 열린 상태는 제외)
window.addEventListener('keyup', (e) => {
  if(e.code !== 'Space' || hotkeyUI.capturingId || hotkeyIsTypingTarget(e.target) || hotkeyTopModal()) return;
  if(Object.values(hotkeyEffectiveBindings()).includes('Space')) e.preventDefault();
}, true);

// ============================================================
// 화면 표기
// ------------------------------------------------------------
// - 메뉴 그리드: 이름 옆에 "(키)"를 금색으로 붙임(예: 캐릭터(S)). 키가 없는 메뉴는 표기 안 함. 이름 글자는 그대로 두고 .menu-grid-key 조각만 붙였다 뗌.
// - 퀵슬롯(스킬/플라스크): 칸 좌상단에 작은 흰색 굵은 글자 + 어두운 외곽선(.quickslot-key, render.js가 칸을 그릴 때 이 함수로 만든 뱃지를 같이 넣음). 칸 디자인은 그대로.
// - 모바일 프리셋에서는 CSS로 자동 숨김(style.css .quickslot-key / .menu-grid-key).
// - 표시하는 키는 "저장된 설정"(hotkeyEffectiveBindings) 기준 — 설정창에서 편집 중인 초안은 [저장] 전까지 반영되지 않음.
// ============================================================
let hotkeyLabelCache = null; // { saved: state.settings.hotkeyBindings 참조, bindings }
// 퀵슬롯은 자주 다시 그려지므로 저장값(참조)이 바뀌었을 때만 키 맵을 새로 계산함(저장·세이브 불러오기·초기화는 참조가 바뀜)
function hotkeyBindingsCached(){
  const saved = state.settings ? state.settings.hotkeyBindings : null;
  if(!hotkeyLabelCache || hotkeyLabelCache.saved !== saved) hotkeyLabelCache = { saved, bindings: hotkeyEffectiveBindings() };
  return hotkeyLabelCache.bindings;
}
function hotkeyLabelFor(actionId){
  const code = hotkeyBindingsCached()[actionId];
  return code ? hotkeyCodeLabel(code) : '';
}
// 퀵슬롯 칸(.quickslot-wrap) 안에 넣을 키 뱃지 HTML — 키가 없으면 빈 문자열. onEmpty: 비어 있는 칸(+)은 배경이 어두워서 둥근 반투명 배경을 깜
function hotkeyBadgeHtml(actionId, onEmpty){
  const t = hotkeyLabelFor(actionId);
  if(!t) return '';
  return `<span class="quickslot-key${onEmpty ? ' on-empty' : ''}${t.length > 2 ? ' long' : ''}">${hkEsc(t)}</span>`;
}
function hotkeyRefreshMenuLabels(){
  document.querySelectorAll('#menuGrid .menu-grid-item').forEach(btn => {
    const label = btn.querySelector('.menu-grid-label');
    if(!label || !btn.id) return;
    const t = hotkeyLabelFor('menu:' + btn.id);
    let k = label.querySelector('.menu-grid-key');
    if(t){
      if(!k){ k = document.createElement('span'); k.className = 'menu-grid-key'; label.appendChild(k); }
      k.textContent = '(' + t + ')';
    }else if(k){
      k.remove();
    }
  });
}
hotkeyRefreshMenuLabels(); // 처음 불러온 설정 기준으로 메뉴 표기

// ---- 마우스 오버 문구 옆 단축키 표기 ----
// [다음 스테이지 즉시 이동] 버튼(#huntPrepNextBtn)에 마우스를 올리면 고정 위치 툴팁에 "문구 (키)"로 표시하고 키는 노란색(금색)으로 보여줌.
// 문구는 dungeon.js syncHuntPrepNextIcon이 버튼의 data-tip에 넣어 둠(다음이 11스테이지면 "숨겨진 장소로 이동"). 모바일 프리셋에서는 키를 붙이지 않음.
function hotkeyTipSuffix(actionId){
  if(document.body.classList.contains('mobile-preset')) return '';
  const t = hotkeyLabelFor(actionId);
  return t ? ` <span class="hotkey-tip-key">(${hkEsc(t)})</span>` : '';
}
function hotkeyHidePrepTip(){
  if(!hotkeyUI.prepTipOpen) return;
  hotkeyUI.prepTipOpen = false;
  if(typeof codexUI !== 'undefined' && codexUI && codexUI.tipKey === 'prep-next' && typeof codexHideTip === 'function') codexHideTip();
}
(function initPrepTip(){
  document.addEventListener('mouseover', (e) => {
    const b = e.target.closest && e.target.closest('#huntPrepNextBtn');
    if(!b || typeof codexShowTipHtml !== 'function') return;
    const label = b.dataset.tip || b.getAttribute('aria-label') || '';
    if(!label) return;
    hotkeyUI.prepTipOpen = true;
    codexShowTipHtml(b, hkEsc(label) + hotkeyTipSuffix('stage'), 'prep-next');
  });
  document.addEventListener('mouseout', (e) => { if(e.target.closest && e.target.closest('#huntPrepNextBtn')) hotkeyHidePrepTip(); });
  document.addEventListener('click', (e) => { if(e.target.closest && e.target.closest('#huntPrepNextBtn')) hotkeyHidePrepTip(); }, true);
})();
