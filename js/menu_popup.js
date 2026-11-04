// ============================================================
// 메뉴 팝업 (데스크탑 프리셋 + 던전 화면에서 인벤토리/캐릭터/도감 같은 메뉴를 떠 있는 창으로 띄움)
// ------------------------------------------------------------
// ■ 기본 원칙
//   - 새 UI를 만들지 않고 기존 화면 상자(#inventoryView 등)를 그대로 창으로 씀 → 내용·기능은 전체 화면 메뉴와 같고 복제도 없음.
//   - showView를 거치지 않음(거치면 던전이 종료됨). 대신 화면을 떠날 때 하는 정리는 navigation.js viewLeaveCleanup을 팝업 닫기에서도 같이 호출함.
//   - 팝업은 던전 화면에서만 존재함: 다른 화면으로 이동(showView)하거나 모바일 프리셋으로 바뀌면 모두 닫힘. 던전 밖에서는 기존 전체 화면 그대로.
//   - 팝업은 모달이 아님 — 여러 개를 동시에 열 수 있고(클릭한 창이 맨 앞), 전투·스킬/퀵슬롯 단축키는 창이 열려 있어도 동작함.
// ■ 팝업 가능 여부는 JS에 목록으로 박아두지 않고 "계산"함(menuPopupCapable):
//     데스크탑 프리셋 && 메뉴 그리드 버튼에 data-popup="<화면이름>" 선언 && 화면 상자(#<화면이름>View) 존재 && 설정에서 꺼져 있지 않음.
//   → 팝업 가능 메뉴를 바꾸려면 index.html 메뉴 버튼의 data-popup 속성만 추가/삭제하면 됨(제작소·던전·상점·대장간은 속성 없음 = 불가).
//   → 설정에서 메뉴별 켜기/끄기(3단계): state.settings.menuPopup = { 화면이름: false } 이면 그 메뉴는 팝업 불가가 됨(menuPopupEnabledSetting).
// ■ 화면별로 팝업이 필요한 진입 처리는 MENU_POPUP_HOOKS에 한 곳에 모음(인벤토리/캐릭터/도감).
// ■ 창 조작: 제목줄(.shop-title → .menu-popup-head)을 끌어서 이동(화면 밖으로 나가지 않게 제한), [x] 버튼으로 닫기, 같은 메뉴 키/버튼을 다시 누르면 닫힘,
//   Esc(나가기)는 맨 위 팝업부터 닫음(hotkeys.js hotkeyDoExit). 이동한 위치는 state.settings.menuPopupPos에 저장되어 다음에 열 때 그 자리로 열림.
// ■ 쌓임 순서: 팝업 20~39 < 상단 메뉴 영역(.main-nav 40) < 아이템 세부 팝업(45) < 모달(50) < 툴팁(200).
// ============================================================

const MENU_POPUP_Z_BASE = 20;      // 열린 순서/클릭 순서대로 20, 21, 22...
const MENU_POPUP_DEFAULT_GAP = 16; // 처음 열 때 기본 위치: 게임 화면(.wrap) 옆과의 간격
const MENU_POPUP_STAGGER = 26;     // 처음 여러 개를 열면 겹치지 않게 조금씩 어긋나는 간격
const MENU_POPUP_CLOSE_ICON = 'assets/ui/menu_cancel.png'; // 32×32 픽셀아트 — 16px(정확히 1/2)로 표시(menu_popup 닫기 버튼 CSS)

// 열린 팝업 이름(뒤쪽일수록 위) / 진행 중인 드래그
const menuPopupUI = { order: [], drag: null };

// 화면별 진입/정리 처리. enter: 창을 띄운 직후(화면이 보이고 레이아웃이 잡힌 뒤) 호출, leave: 닫기 직전~직후 처리.
// 캐릭터/도감도 같은 방식(화면 진입 초기화는 navigation.js viewEnterInit을 showView와 공유).
const MENU_POPUP_HOOKS = {
  inventory: {
    enter(){
      const tabs = el('invBoxTabs');
      if(tabs) tabs.classList.add('drag-tabs'); // 탭 줄은 좁아서 제작소처럼 가로 스크롤(흐림 표시 + 마우스 드래그/휠)
      renderInventoryBox(); // 팝업은 4열×6행 — 열이 바뀌므로 다시 그림(inventory_box.js invBoxCols/invBoxRows)
    },
    leave(){
      const tabs = el('invBoxTabs');
      if(tabs){ tabs.classList.remove('drag-tabs', 'can-left', 'can-right'); tabs.scrollLeft = 0; }
      renderInventoryBox(); // 전체 화면용 8×8로 되돌려 둠
    },
  },
  // 캐릭터/도감: showView와 같은 진입 초기화(navigation.js viewEnterInit)를 그대로 호출 — 닫을 때 정리는 viewLeaveCleanup이 공통으로 처리함
  character: {
    enter(){ skillSearchReset(); viewEnterInit('character'); }, // 화면 이동 때처럼 스킬 검색어도 초기화
  },
  collection: {
    enter(){ viewEnterInit('collection'); },
  },
  achievements: {
    enter(){ viewEnterInit('achievements'); }, // 업적(achievements.js): 열 때마다 첫 분류 탭에서 새로 구성
  },
  // 전투 로그(hunt_log.js): 기존 화면 상자가 아니라 전용 상자 #logView를 같은 방식으로 띄움. 열 때마다 보관된 줄을 다시 그리고 맨 아래로 이동.
  log: {
    enter(){ if(typeof huntLogRenderAll === 'function') huntLogRenderAll(); },
  },
};
// Esc(나가기)로 닫지 않는 팝업 — 전투 로그는 기본으로 열려 있어서 Esc가 던전 나가기 흐름에 닿기 전에 먼저 닫히지 않게 함(닫기는 [x]·로그 버튼)
const MENU_POPUP_NO_ESC = ['log'];

// ---- 가능 여부(계산) ----
function menuPopupDesktop(){ return !document.body.classList.contains('mobile-preset'); }
function menuPopupViewEl(name){ return el(name + 'View'); } // 화면 상자 id 규칙: <화면이름>View (inventoryView / characterView / collectionView)
function menuPopupMenuBtn(name){ return document.querySelector('[data-popup="' + name + '"]'); } // 메뉴 그리드 버튼 외에 던전 화면 [전투 로그] 버튼(#huntLogBtn)도 같은 속성을 씀
// 설정에서 메뉴별로 끌 수 있게 하는 자리(3단계에서 설정 화면 연결) — 저장된 값이 false인 메뉴만 끔
function menuPopupEnabledSetting(name){
  const s = state.settings && state.settings.menuPopup;
  return !(s && s[name] === false);
}
function menuPopupCapable(name){
  return menuPopupDesktop() && !!menuPopupMenuBtn(name) && !!menuPopupViewEl(name) && !!MENU_POPUP_HOOKS[name] && menuPopupEnabledSetting(name);
}
function menuPopupIsOpen(name){ return menuPopupUI.order.includes(name); }
// 그 화면이 지금 사용자에게 열려 있는지: 전체 화면으로 보고 있거나 팝업으로 떠 있을 때(currentView만 보던 곳이 팝업도 인식하게 하는 공용 함수)
function viewIsActive(name){ return currentView === name || menuPopupIsOpen(name); }

// ---- 저장된 위치 ----
function menuPopupSavedPos(name){
  const p = state.settings && state.settings.menuPopupPos && state.settings.menuPopupPos[name];
  return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
}
function menuPopupSavePos(name, x, y){
  if(!state.settings) state.settings = {};
  if(!state.settings.menuPopupPos) state.settings.menuPopupPos = {};
  state.settings.menuPopupPos[name] = { x: Math.round(x), y: Math.round(y) };
  saveState();
}

// ---- 위치 계산 / 화면 안으로 제한 ----
function menuPopupClamp(view, x, y){
  const r = view.getBoundingClientRect();
  const maxX = Math.max(0, window.innerWidth - r.width);
  const maxY = Math.max(0, window.innerHeight - r.height);
  return { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
}
function menuPopupSetPos(view, x, y){
  const c = menuPopupClamp(view, x, y);
  view.style.left = c.x + 'px';
  view.style.top = c.y + 'px';
  return c;
}
// 열 때 위치: 저장된 위치가 있으면 그 자리(현재 화면 크기에 맞게 보정), 없으면 다른 팝업·게임 화면과 겹치지 않는 빈 자리(게임 화면 옆 → 열린 팝업 옆 → 반대쪽), 그래도 없으면 겹치되 조금 어긋나게
function menuPopupPlace(name){
  const v = menuPopupViewEl(name);
  v.style.left = '0px'; v.style.top = '0px'; // 크기 측정용
  const r = v.getBoundingClientRect();
  const saved = menuPopupSavedPos(name);
  if(saved){ menuPopupSetPos(v, saved.x, saved.y); return; }
  const wrap = document.querySelector('.wrap');
  const wr = wrap ? wrap.getBoundingClientRect() : { left: 0, right: window.innerWidth };
  const idx = Math.max(0, menuPopupUI.order.indexOf(name));
  const gap = MENU_POPUP_DEFAULT_GAP;
  // 이미 열려 있는 다른 팝업들의 가로 범위(새 팝업이 앞 팝업을 통째로 가리지 않게 빈 자리를 찾음)
  const others = menuPopupUI.order.filter(n => n !== name).map(n => menuPopupViewEl(n)).filter(Boolean).map(o => o.getBoundingClientRect());
  const fits = x => x >= gap / 2 && x + r.width <= window.innerWidth - gap / 2;
  const free = (x, avoidWrap) =>
    !others.some(o => x < o.right + 4 && x + r.width > o.left - 4) &&
    !(avoidWrap && x < wr.right && x + r.width > wr.left);
  // 후보 자리: 게임 화면 오른쪽 옆 → 열린 팝업들의 오른쪽 옆 → 게임 화면 왼쪽 옆 → 열린 팝업들의 왼쪽 옆. 게임 화면을 안 가리는 자리부터 찾고, 없으면 가려도 팝업끼리 안 겹치는 자리
  const cands = [wr.right + gap, ...others.map(o => o.right + gap), wr.left - gap - r.width, ...others.map(o => o.left - gap - r.width)];
  for(const avoidWrap of [true, false]){
    const x = cands.find(cx => fits(cx) && free(cx, avoidWrap));
    if(x !== undefined){ menuPopupSetPos(v, x, 90); return; }
  }
  // 빈 자리가 없으면 겹치되 조금씩 어긋나게
  let x = wr.right + gap;
  if(x + r.width > window.innerWidth) x = wr.left - gap - r.width;
  menuPopupSetPos(v, x, 90 + idx * MENU_POPUP_STAGGER);
}

// ---- 쌓임 순서 ----
function menuPopupApplyZ(){
  menuPopupUI.order.forEach((name, i) => { const v = menuPopupViewEl(name); if(v) v.style.zIndex = String(MENU_POPUP_Z_BASE + i); });
}
function menuPopupFront(name){
  const i = menuPopupUI.order.indexOf(name);
  if(i < 0 || i === menuPopupUI.order.length - 1) return;
  menuPopupUI.order.splice(i, 1);
  menuPopupUI.order.push(name);
  menuPopupApplyZ();
}

// ---- 열기 / 닫기 ----
function menuPopupOpen(name){
  if(!menuPopupCapable(name)) return false;
  if(menuPopupIsOpen(name)){ menuPopupFront(name); return true; }
  const v = menuPopupViewEl(name);
  v.classList.add('menu-popup');
  v.dataset.popupName = name;
  v.style.display = 'block';
  menuPopupUI.order.push(name);
  menuPopupApplyZ();
  const hook = MENU_POPUP_HOOKS[name];
  if(hook && hook.enter) hook.enter();
  menuPopupPlace(name); // 내용을 그린 뒤(크기가 정해진 뒤)에 위치를 잡음
  notifyRequestSync();
  return true;
}
function menuPopupClose(name){
  const i = menuPopupUI.order.indexOf(name);
  if(i < 0) return;
  menuPopupUI.order.splice(i, 1);
  const v = menuPopupViewEl(name);
  if(menuPopupUI.drag && menuPopupUI.drag.name === name) menuPopupUI.drag = null;
  if(v){
    v.classList.remove('menu-popup');
    delete v.dataset.popupName;
    v.style.display = 'none';
    v.style.left = ''; v.style.top = ''; v.style.zIndex = '';
  }
  viewLeaveCleanup(name); // 화면을 떠날 때와 같은 정리(navigation.js)
  const hook = MENU_POPUP_HOOKS[name];
  if(hook && hook.leave) hook.leave();
  if(typeof codexHideTip === 'function') codexHideTip();
  menuPopupApplyZ();
  notifyRequestSync(); // 알림 점 — 닫으면 그 탭의 새 항목이 확인 처리됨
}
function menuPopupCloseAll(){ menuPopupUI.order.slice().forEach(menuPopupClose); }
function menuPopupCloseTop(){
  const name = menuPopupUI.order.slice().reverse().find(n => !MENU_POPUP_NO_ESC.includes(n));
  if(!name) return false;
  menuPopupClose(name);
  return true;
}
// 메뉴 버튼/단축키가 눌렸을 때(navigation.js guardedNav): 던전 화면이고 팝업 가능한 메뉴면 열려 있으면 닫고 닫혀 있으면 열어서 true(= 화면 이동 안 함)
function menuPopupTryOpen(name){
  if(currentView !== 'hunt' || !hunt.dungeon || !menuPopupCapable(name)) return false;
  if(menuPopupIsOpen(name)) menuPopupClose(name);
  else menuPopupOpen(name);
  return true;
}
// 프리셋이 바뀌었을 때(navigation.js applyScreenPreset): 모바일이면 팝업을 모두 닫음
function menuPopupOnPresetChange(){
  if(!menuPopupDesktop()) menuPopupCloseAll();
}

// ---- 제목줄 준비: 제목줄에 클래스를 붙이고 [x] 버튼을 넣음(팝업이 아닐 때는 CSS가 숨김) ----
function menuPopupInitHeaders(){
  document.querySelectorAll('[data-popup]').forEach(btn => {
    const name = btn.dataset.popup;
    const v = menuPopupViewEl(name);
    if(!v) return;
    // 화면 상자 안의 제목(.shop-title)에 모두 적용: 인벤토리처럼 구버전(숨김)·신버전 제목이 함께 들어 있는 화면도 현재 보이는 쪽이 손잡이가 됨
    v.querySelectorAll('.shop-title').forEach(head => {
      head.classList.add('menu-popup-head');
      if(head.querySelector('.menu-popup-close')) return;
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'menu-popup-close';
      x.title = '닫기';
      x.setAttribute('aria-label', '닫기');
      x.innerHTML = `<img src="${MENU_POPUP_CLOSE_ICON}" alt="" draggable="false">`;
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        menuPopupClose(name);
        if(name === 'log' && typeof huntLogOnUserClose === 'function') huntLogOnUserClose(); // 로그는 닫은 상태를 설정에 기억(다음 던전에서도 닫힘)
      });
      head.appendChild(x);
    });
  });
}

// ---- 제목줄 드래그 + 클릭하면 맨 앞으로 ----
(function initMenuPopupDrag(){
  document.addEventListener('pointerdown', (e) => {
    const pop = e.target.closest && e.target.closest('.menu-popup');
    if(!pop) return;
    const name = pop.dataset.popupName;
    menuPopupFront(name);
    const head = e.target.closest('.menu-popup-head');
    if(!head || e.target.closest('.menu-popup-close') || e.button !== 0) return;
    const r = pop.getBoundingClientRect();
    menuPopupUI.drag = { name, view: pop, pointerId: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, head };
    try{ head.setPointerCapture(e.pointerId); }catch(_){}
    pop.classList.add('is-dragging');
    if(typeof codexHideTip === 'function') codexHideTip();
    e.preventDefault(); // 제목 글자 선택 방지
  }, true);
  document.addEventListener('pointermove', (e) => {
    const d = menuPopupUI.drag;
    if(!d || e.pointerId !== d.pointerId) return;
    menuPopupSetPos(d.view, e.clientX - d.dx, e.clientY - d.dy);
  });
  const end = (e) => {
    const d = menuPopupUI.drag;
    if(!d || e.pointerId !== d.pointerId) return;
    menuPopupUI.drag = null;
    d.view.classList.remove('is-dragging');
    try{ d.head.releasePointerCapture(e.pointerId); }catch(_){}
    const r = d.view.getBoundingClientRect();
    menuPopupSavePos(d.name, r.left, r.top); // 놓은 자리를 저장 — 다음에 열면 그 자리
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  // 브라우저 창 크기가 바뀌면 열려 있는 팝업이 화면 밖에 남지 않게 다시 안쪽으로 보정(저장된 위치는 그대로 둠)
  window.addEventListener('resize', () => {
    menuPopupUI.order.forEach(name => {
      const v = menuPopupViewEl(name);
      if(!v) return;
      const r = v.getBoundingClientRect();
      menuPopupSetPos(v, r.left, r.top);
    });
  });
})();

menuPopupInitHeaders();
