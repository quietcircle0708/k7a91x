// ============================================================
// 마을 화면 (게임의 기본 화면)
// ------------------------------------------------------------
// ■ 데이터는 data.js TOWNS(마을·클릭 영역)·TOWN_TEXT(문구)·SHRINE_COOLDOWN_MS·TOWN_REGEN_SPEED에 있고, 여기는 그리고 동작시키는 쪽만 담당함.
// ■ 화면 구성: 상단 패널(플레이어 HUD · 로그/공지/메뉴 버튼 · 지역명) + 마을 이미지(프레임 테두리)(건물 클릭 영역이 이미지 위에 %로 겹쳐 있음) + 이미지 위 로그 상자.
//     - 건물 영역을 누르면 그 자리에 작은 말풍선(이름 + [입장] 등 버튼)이 뜨고, 버튼을 눌러야 실제로 이동/실행됨.
//     - 이미지가 화면보다 길면 마우스로 잡아서 끌어 이동(main.js enableDragScroll 재사용, 터치는 기본 스크롤).
// ■ 상단 패널(프레임 이미지)에는 플레이어 HUD·로그/공지/메뉴 버튼·마을 이름이 들어감. HUD(던전의 #huntPlayerInfo)와 공지·메뉴 버튼은
//   마을 화면에 들어올 때 패널로 옮기고, 다른 화면으로 나갈 때 원래 자리로 되돌림(townUiPlace). 아이디가 그대로라 render.js renderHuntCharPanel·
//   메뉴 그리드·알림 점·단축키가 계속 동작함. 메뉴 그리드는 버튼 아래로 펼쳐짐.
// ■ 로그: hunt_log.js의 줄 보관·문구 표를 같이 씀(마을에서도 huntLog(...) 호출 가능). 마을 화면에서는 이미지 위 상자(#townLog)에 표시.
// ■ 마을 안 자연 회복 가속(TOWN_REGEN_SPEED)은 dungeon.js naturalRegenTick이 townRegenSpeed()를 읽어 적용함.
// ============================================================

// 저장 데이터 보정(이전 세이브에는 currentTown/shrineReadyAt이 없음)
function ensureTownDefaults(){
  if(!state.currentTown || !TOWNS[state.currentTown]) state.currentTown = DEFAULT_TOWN_ID;
  if(!Number.isFinite(state.shrineReadyAt) || state.shrineReadyAt < 0) state.shrineReadyAt = 0;
}
function currentTownDef(){ return TOWNS[state.currentTown] || TOWNS[DEFAULT_TOWN_ID]; }
// 현재 마을(=지역)의 던전만(던전 입구 목록). 던전 데이터의 region이 마을 region과 같은 것.
function townDungeons(){
  const region = currentTownDef().region;
  return DUNGEONS.filter(d => dungeonRegionOf(d) === region);
}
// 상점 품목의 지역 한정: 아이템 데이터에 towns 배열이 있으면 그 마을에서만 판매, 없으면 모든 마을에서 판매
function townSellsItem(def){ return !def || !Array.isArray(def.towns) || def.towns.includes(state.currentTown); }
function townShopDef(action, id){
  if(action === 'buy-consumable') return CONSUMABLES[id];
  if(action === 'buy-artifact') return ARTIFACTS[id];
  if(action === 'buy-weapon'){ try{ return wpn(id); }catch(e){ return null; } }
  return null;
}
// 마을 화면에 있는 동안 자연 회복(재생)이 몇 배로 진행되는지(던전·그 밖의 화면은 1배)
function townRegenSpeed(){ return currentView === 'town' ? TOWN_REGEN_SPEED : 1; }

const townUI = { selected: null, builtFor: null, showBuffs: false }; // showBuffs: HUD 자리에 버프 아이콘을 보여주는 중(효과 버튼 토글, 저장하지 않음)

// ---- 마을 이미지 + 클릭 영역 만들기(마을이 바뀔 때만 다시 만듦) ----
function townBuildMap(){
  const town = currentTownDef();
  const map = el('townMap');
  if(!map || townUI.builtFor === town.id) return;
  townUI.builtFor = town.id;
  townUI.selected = null;
  map.classList.remove('img-failed');
  const spots = town.buildings.map(b =>
    `<button type="button" class="town-spot" data-b="${b.id}" style="left:${b.rect[0]}%;top:${b.rect[1]}%;width:${b.rect[2]}%;height:${b.rect[3]}%;" aria-label="${b.name}"><span class="town-spot-tag">${b.name}</span></button>`
  ).join('');
  map.innerHTML = `<img class="town-img" id="townImg" src="${town.image}" alt="" draggable="false">` + spots +
    `<div class="town-bubble" id="townBubble" style="display:none;"></div>` +
    `<div class="town-img-fail" id="townImgFail" style="display:none;">${TOWN_TEXT.imageFail}</div>`;
  const img = el('townImg');
  img.addEventListener('error', () => { // 이미지를 못 불러오면 가벼운 안내만 띄움(메뉴 그리드로는 계속 이동 가능)
    img.style.display = 'none';
    map.classList.add('img-failed');
    el('townImgFail').style.display = 'flex';
  });
}

// ---- 건물 말풍선(이름 + 버튼) ----
function townBtnHtml(act, arg, label, iconSrc, extraCls){
  const icon = iconSrc ? `<img class="town-bubble-icon" src="${iconSrc}" alt="" width="24" height="24" draggable="false">` : '';
  return `<button type="button" class="town-bubble-btn${extraCls ? ' ' + extraCls : ''}" data-act="${act}"${arg ? ` data-arg="${arg}"` : ''}>${icon}<span>${label}</span></button>`;
}
function townShrineRemainMs(){ return Math.max(0, (state.shrineReadyAt || 0) - Date.now()); }
function townRenderBubble(){
  const bub = el('townBubble');
  if(!bub) return;
  const town = currentTownDef();
  const b = town.buildings.find(x => x.id === townUI.selected);
  document.querySelectorAll('#townMap .town-spot').forEach(s => s.classList.toggle('selected', !!b && s.dataset.b === b.id));
  if(!b){ bub.style.display = 'none'; return; }
  const cx = b.rect[0] + b.rect[2] / 2, cy = b.rect[1] + b.rect[3] / 2;
  bub.style.left = Math.min(80, Math.max(20, cx)) + '%'; // 이미지 좌우 끝에서 말풍선이 잘리지 않게 제한
  bub.style.top = cy + '%';
  let btns = '';
  if(b.kind === 'shrine'){
    const remain = townShrineRemainMs();
    const healLabel = remain > 0 ? `${TOWN_TEXT.shrineHeal} (${huntLogFmtDuration(remain)})` : TOWN_TEXT.shrineHeal;
    btns = townBtnHtml('heal', '', healLabel, '', remain > 0 ? 'cooling' : '') + townBtnHtml('pray', '', TOWN_TEXT.shrinePray, 'assets/ui/icon_town_prayer.png');
  } else if(b.kind === 'portal'){
    const others = TOWN_ORDER.filter(id => id !== state.currentTown && TOWNS[id]);
    btns = others.length
      ? others.map(id => townBtnHtml('travel', id, TOWNS[id].name, 'assets/ui/icon_town_enter.png')).join('')
      : townBtnHtml('portalNone', '', TOWN_TEXT.portalBtn, 'assets/ui/icon_town_enter.png', 'cooling');
  } else {
    btns = townBtnHtml('enter', '', TOWN_TEXT.enterBtn, 'assets/ui/icon_town_enter.png');
  }
  bub.innerHTML = `<div class="town-bubble-title">${b.name}</div><div class="town-bubble-row">${btns}</div>`;
  bub.style.display = 'flex';
}

// ---- 클릭 처리 ----
function townMapClick(e){
  const actBtn = e.target.closest('[data-act]');
  if(actBtn){ townAct(actBtn.dataset.act, actBtn.dataset.arg); return; }
  if(e.target.closest('.town-bubble')) return;
  const spot = e.target.closest('.town-spot');
  if(spot){
    townUI.selected = townUI.selected === spot.dataset.b ? null : spot.dataset.b;
    townRenderBubble();
    return;
  }
  if(townUI.selected){ townUI.selected = null; townRenderBubble(); }
}
function townNotice(text){
  showTownToast(text);
  huntLog('townNotice', { text });
}
function townAct(act, arg){
  const town = currentTownDef();
  const b = town.buildings.find(x => x.id === townUI.selected);
  if(act === 'enter'){
    if(!b) return;
    if(b.kind === 'view'){ townUI.selected = null; townRenderBubble(); guardedNav(b.view); }
    else if(b.kind === 'soon'){ townNotice(b.notice || TOWN_TEXT.prayerSoon); }
  } else if(act === 'heal') townShrineHeal();
  else if(act === 'pray') townNotice(TOWN_TEXT.prayerSoon); // 기도 효과는 마을 구성이 끝난 뒤 따로 작업(지금은 안내만)
  else if(act === 'travel') townTravel(arg);
  else if(act === 'portalNone') townNotice(TOWN_TEXT.portalNone);
}

// 성소 [회복]: 체력·마나를 최대치로 회복, 무료, 실제 시간 기준 쿨타임(SHRINE_COOLDOWN_MS). 이미 가득 차 있으면 쿨타임을 쓰지 않고 안내만 함.
function townShrineHeal(){
  ensurePlayerVitals();
  const now = Date.now();
  if(state.shrineReadyAt > now){
    const t = huntLogFmtDuration(state.shrineReadyAt - now);
    showTownToast(TOWN_TEXT.shrineWait.replace('{time}', t));
    huntLog('shrineWait', { time: t });
    return;
  }
  const maxHp = effectiveMaxHp(state.playerLevel), maxMp = effectiveMaxMp(state.playerLevel);
  if(state.playerHp >= maxHp && state.playerMp >= maxMp){
    showTownToast(TOWN_TEXT.shrineFull);
    huntLog('shrineFull');
    return;
  }
  state.playerHp = maxHp;
  state.playerMp = maxMp;
  state.shrineReadyAt = now + SHRINE_COOLDOWN_MS;
  saveState();
  huntLog('shrineUse');
  showTownToast(TOWN_TEXT.shrineHealed);
  render();
  townRenderBubble();
}

// 지역 이동 포탈: 다른 마을로 이동(현재는 마을이 하나뿐이라 안내만 나옴)
function townTravel(id){
  const t = TOWNS[id];
  if(!t || id === state.currentTown) return;
  state.currentTown = id;
  saveState();
  townUI.builtFor = null;
  townOnEnter('travel');
  huntLog('townArrive', { town: t.name });
  showTownToast(TOWN_TEXT.arrive.replace('{town}', t.name));
}

// ---- 화면에 따라 공용 UI를 마을 패널 ↔ 원래 자리로 옮기기 ----
//  · 플레이어 HUD(#huntPlayerInfo): 마을 패널(#townHudSlot) ↔ 던전 카드(#huntCard, 던전 이름 바로 아래)
//  · 버프 아이콘 영역(#huntBuffUi): 마을 패널의 HUD 자리(#townHudSlot, 효과 버튼으로 HUD와 토글) ↔ 던전 카드(HUD 바로 다음). render.js renderHuntBuffUi가 100ms마다 어느 화면이든 같은 방식으로 채움
//  · 공지사항 버튼(#openPatchNoteBtn)·메뉴(#menuWrap = 버튼 + 그리드): 마을 패널(#townNavSlot) ↔ 위쪽 줄(#mainNav, 맨 뒤 두 칸)
//  요소 자체를 옮기는 것이라 아이디·이벤트·알림 점·단축키가 그대로 유지됨. 마을에서는 비어 버린 #mainNav 줄을 숨김.
function townUiPlace(name){
  const hud = el('huntPlayerInfo');
  const slot = el('townHudSlot'), navSlot = el('townNavSlot'), nav = el('mainNav');
  const buff = el('huntBuffUi'), patch = el('openPatchNoteBtn'), menu = el('menuWrap');
  if(name === 'town'){
    if(hud && slot && hud.parentElement !== slot) slot.appendChild(hud);
    if(buff && slot && buff.parentElement !== slot) slot.appendChild(buff); // HUD와 같은 자리(토글로 번갈아 표시)
    if(navSlot){
      if(patch && patch.parentElement !== navSlot) navSlot.appendChild(patch);
      if(menu && menu.parentElement !== navSlot) navSlot.appendChild(menu);
    }
    if(nav) nav.style.display = 'none';
  } else {
    const home = el('huntCard');
    if(buff && home && buff.parentElement !== home) home.insertBefore(buff, el('monsterStage')); // 원래 자리: HUD 바로 다음(던전 카드 안)
    if(hud && home && hud.parentElement !== home) home.insertBefore(hud, buff); // 원래 자리: 던전 이름 바로 아래
    if(nav){
      if(patch && patch.parentElement !== nav) nav.appendChild(patch); // 원래 순서: 공지사항 → 메뉴(뒤로가기 버튼들 다음)
      if(menu && menu.parentElement !== nav) nav.appendChild(menu);
      nav.style.display = '';
    }
  }
}

// ---- 로그 상자(이미지 위) 열기/닫기: 열림 여부는 설정에 저장(기본 열림) ----
function townLogIsOpen(){ return !(state.settings && state.settings.townLogOpen === false); }
function townLogApply(){
  const box = el('townLog');
  if(box) box.style.display = townLogIsOpen() ? 'flex' : 'none';
  const btn = el('townLogBtn');
  if(btn) btn.classList.toggle('active', townLogIsOpen());
  if(townLogIsOpen()) huntLogRenderAll();
}
function townLogToggle(){
  if(!state.settings) state.settings = {};
  state.settings.townLogOpen = !townLogIsOpen();
  saveState();
  townLogApply();
}

// ---- 효과(버프) 토글: HUD ↔ 적용 중인 버프·망자의 저주 아이콘 ----
function townBuffsApply(){
  const slot = el('townHudSlot'), btn = el('townBuffBtn');
  if(slot) slot.classList.toggle('show-buffs', townUI.showBuffs);
  if(btn){
    btn.classList.toggle('active', townUI.showBuffs);
    const buff = el('huntBuffUi');
    btn.classList.toggle('has-effect', !townUI.showBuffs && !!buff && buff.children.length > 0);
  }
}
function townBuffsToggle(){
  townUI.showBuffs = !townUI.showBuffs;
  townBuffsApply();
}

// ---- 마을 화면에 들어올 때(navigation.js showView / 게임 시작) ----
// prev: 직전 화면 이름('load' = 게임을 켠 직후). 던전에서 돌아오거나 게임을 켰을 때만 도착·재생 안내를 로그에 남김(메뉴를 오갈 때마다 쌓이지 않게).
function townOnEnter(prev){
  townUiPlace('town');
  townBuildMap();
  townUI.selected = null;
  townRenderBubble();
  const name = el('townRegionName');
  if(name) name.textContent = currentTownDef().name;
  const logBtn = el('townLogBtn');
  if(logBtn && !logBtn.firstElementChild) logBtn.innerHTML = uiIconHtml('huntLog', 'hunt-img-btn-icon');
  townBuffsApply();
  if(prev === 'hunt' || prev === 'load'){
    huntLog('townArrive', { town: currentTownDef().name });
    huntLog('townNotice', { text: TOWN_TEXT.regenNotice });
  }
  townLogApply();
}

// 성소 쿨타임 표시(말풍선이 성소를 가리키는 동안만 1초마다 갱신)
setInterval(() => {
  if(currentView !== 'town' || !townUI.selected) return;
  const b = currentTownDef().buildings.find(x => x.id === townUI.selected);
  if(b && b.kind === 'shrine') townRenderBubble();
}, 1000);

// 효과 버튼 표시: 적용 중인 버프·망자의 저주가 있는데 HUD가 보이는 동안에는 버튼에 작은 점을 띄워 알려 줌
setInterval(() => {
  if(currentView !== 'town') return;
  const btn = el('townBuffBtn'), buff = el('huntBuffUi');
  if(btn && buff) btn.classList.toggle('has-effect', !townUI.showBuffs && buff.children.length > 0);
}, 500);
