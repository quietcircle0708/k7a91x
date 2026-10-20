// ============================================================
// 대장간 새 강화 탭 UI — 강화 화면의 "표시와 조작"만 담당함. 강화 판정/확률/비용/기도 효과/장비 선택·저장은 전부 기존 코드를 그대로 호출함:
//   · 강화 시도 = actions.js startEnhance (→ resolveEnhance, 기존 딜레이/결과 처리/강화 기록부 수집 그대로)
//   · 기도 토글 = actions.js toggleBlessing / toggleFocus (활성 상태 저장, 사용 가능 조건 prayerCanUse*, 확률/비용 배율 적용은 기존 그대로)
//   · 확률/비용/판매가 = formulas.js displayEnhanceOdds / enhanceCostBreakdown / enhanceCostTooltipText / sellValueFor / durabilityAdjustedSellValue
//   · 강화 장비 선택 = 기존 장비 선택 팝업(openForgeSelect → selectForgeTarget → equipItem) / 인벤토리의 "강화 선택"(state.forgeTargetId) 그대로
//   · 성장 수치 = 인벤토리 아이템 비교 UI와 같은 엔진(codexDisplayFor → invCompareBuildRows → ▲▼/색 규칙 INV_COMPARE_STAT_BETTER)
// 모드(기도/촉매): state.forgeMode. 촉매 모드는 고정 슬롯(왼쪽 강화석 = state.forgeStone, 오른쪽 소생석 = state.forgeRevive, 아래는 빈 슬롯)이며 선택창 없이 토글/버튼으로 조작(catalyst.js),
//   촉매 아이템 데이터/효과/소모 계산은 catalyst.js가 담당(forgeCatalystInfo는 슬롯에 표시할 아이콘만 만듦). 기도 툴팁 문구는 index.html의 #fePrayerBlessingTip/#fePrayerFocusTip에 직접 있음.
// ============================================================

let forgeEnhNew = { growCache: null, tipHtml: '', slotClickTimer: null, catClickTimers: [null, null, null] };
const FORGE_ENH_DOUBLE_CLICK_MS = 280; // 슬롯 한 번 클릭(선택 팝업) / 더블 클릭(선택 해제) 구분 대기 시간

function forgeEnhIsMobile(){ return document.body.classList.contains('mobile-preset'); }

// ---- 성장 수치 ----
// 비교 표의 행 목록을 만든 뒤 "강화로 성장하는 옵션 + 고유 옵션"만 남김. 어떤 옵션이 성장하는지는 이름이 아니라 데이터로 판별함:
// 이 장비의 0~MAX_LEVEL 모든 단계 툴팁을 만들어 항목별 값이 단계에 따라 달라지는지 비교(툴팁 규칙을 그대로 따르므로 새 옵션이 추가돼도 자동 반영).
// 이름/등급/설명/종류/판매가(INV_COMPARE_NO_DELTA_KEYS)와 단계가 올라도 값이 안 변하는 내구도·착용 제한 등은 자동으로 빠지고, 고유 옵션만 고정 값이어도 항상 표시함.
function forgeEnhGrowthLabels(type, item){
  const labels = new Set();
  const seen = {}; // key → { label, values:Set }
  for(let lv = 0; lv <= MAX_LEVEL; lv++){
    invCompareParseTooltip(codexDisplayFor(type, lv, item).tooltipHtml).forEach(r => {
      if(INV_COMPARE_NO_DELTA_KEYS.includes(r.key) && r.key !== 'unique') return;
      const s = seen[r.key] || (seen[r.key] = { label: r.label, values: new Set() });
      s.values.add(r.valueHtml);
    });
  }
  Object.keys(seen).forEach(k => { if(k === 'unique' || seen[k].values.size > 1) labels.add(seen[k].label); });
  return labels;
}
// 현재 단계(왼쪽)와 시도 단계(오른쪽)의 옵션 행: [{ label, aHtml, bHtml, delta }]. nextLevel이 null이면 다음 단계가 없는 경우(오른쪽 없음).
function forgeEnhGrowthRows(type, item, level, nextLevel){
  const labels = forgeEnhGrowthLabels(type, item);
  const a = codexDisplayFor(type, level, item);
  if(nextLevel == null){
    return invCompareParseTooltip(a.tooltipHtml).filter(r => labels.has(r.label)).map(r => ({ label: r.label, aHtml: r.valueHtml }));
  }
  const b = codexDisplayFor(type, nextLevel, item);
  return invCompareBuildRows(a, b).filter(r => labels.has(r.label)).map(r => ({ label: r.label, aHtml: r.aHtml, bHtml: r.bHtml, delta: r.delta }));
}
function forgeEnhGrowthHtml(type, item, level, nextLevel){
  const rows = forgeEnhGrowthRows(type, item, level, nextLevel);
  const hasNext = nextLevel != null;
  const lvColor = lv => weaponNameColor(type, lv);
  const lvSpan = lv => `<span style="color:${lvColor(lv)};">+${lv}</span>`;
  // 위쪽 단계 표시: 아래 옵션 영역과 같은 3열(왼쪽 | 화살표 폭 | 오른쪽) — 단계는 각 옵션 영역의 가로 중앙, 화살표 이미지는 가운데.
  // 다음 단계가 없으면 "+9 >>> 없음"이 아니라 현재 단계만 가운데에 표시
  const head = hasNext
    ? `<div class="fe-lv-grid two"><span class="fe-lv-l">${lvSpan(level)}</span><img class="fe-lv-arrow-img" src="assets/ui/ui_right_arrow.png" alt="" draggable="false"><span class="fe-lv-r">${lvSpan(nextLevel)}</span></div>`
    : `<div class="fe-lv-grid one"><span class="fe-lv-l">${lvSpan(level)}</span></div>`;
  const dl = d => d ? ` <span class="cmp-delta ${d.good ? 'good' : 'bad'}">${d.text}</span>` : '';
  const cell = (label, html, delta) => `<div class="fe-grow-cell"><span class="fe-opt-label">${label}</span> <span class="fe-opt-val">${html}</span>${dl(delta)}</div>`;
  // 현재 옵션 / 강화 성공 옵션은 서로 독립된 영역(각각 따로 스크롤). 가운데는 화살표 폭만큼 빈 공간.
  const pane = (title, cells) => `<div class="fe-opt-pane"><div class="fe-pane-head">${title}</div><div class="fe-pane-scroll">${cells}</div></div>`;
  const left = rows.map(r => cell(r.label, r.aHtml)).join('');
  const body = hasNext
    ? pane('현재 장비 옵션', left) + '<div class="fe-opt-gap"></div>' + pane('시도 강화 옵션', rows.map(r => cell(r.label, r.bHtml, r.delta)).join(''))
    : pane('현재 장비 옵션', left);
  return { lvArrow: head, html: `<div class="fe-grow-body ${hasNext ? 'two' : 'one'}">${body}</div>` };
}

// ---- 모드 / 촉매 슬롯 ----
// 촉매 종류 → 표시 정보({ iconHtml }) — 촉매 아이템(MISC_ITEMS)의 아이콘을 그대로 사용함. 모르는 종류면 null('?' 표시).
function forgeCatalystInfo(id){ const it = catalystDef(id); return it ? { iconHtml: itemIconHtml(it, 'inv-icon-img') } : null; }
function forgeIsCatalystMode(){ return state.forgeMode === 'catalyst'; }
// 모드 전환 — 촉매 모드로 들어가면 기도 선택을 해제(기도와 촉매가 동시에 적용되지 않게). 촉매 등록 상태(종류·수량)는 그대로 유지.
function forgeSetMode(mode){
  if(isEnhancing || (mode !== 'prayer' && mode !== 'catalyst') || state.forgeMode === mode) return;
  state.forgeMode = mode;
  if(mode === 'catalyst'){ state.blessingActive = false; state.focusActive = false; }
  render(); saveState();
}
// 선택 해제 안내 문구: 데스크톱은 우클릭, 모바일은 더블 클릭
function forgeEnhHintText(){ return forgeEnhIsMobile() ? '더블 클릭으로 선택 해제' : '우클릭으로 선택 해제'; }

// 모드 선택 / 삼각형 슬롯 / 안내 문구 표시(장비 선택 여부와 무관하게 항상 갱신)
function forgeEnhModeRender(){
  const catMode = forgeIsCatalystMode();
  if(catMode && (state.blessingActive || state.focusActive)){ state.blessingActive = false; state.focusActive = false; } // 촉매 모드에서는 기도가 적용되지 않음(방어)
  document.getElementById('feTri').classList.toggle('mode-catalyst', catMode);
  document.getElementById('feTri').classList.toggle('mode-prayer', !catMode);
  document.querySelectorAll('#feMode .fe-mode-btn').forEach(b => {
    const m = b.dataset.mode;
    const on = m === state.forgeMode;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    if(m !== 'special') b.disabled = !!isEnhancing; // 특수 모드는 추후 업데이트(항상 비활성)
  });
  // 촉매 고정 슬롯(요청: 기도처럼 고정 표시). 상태를 현재 장비/보유량에 먼저 맞춘 뒤 그림.
  catalystEnhanceSync();
  const tg = catalystEnhanceTarget();
  const hideBtn = (slot, dir, hide) => document.querySelectorAll(`.fe-qty-btn[data-slot="${slot}"]`).forEach(b => { if(b.dataset.dir === String(dir)) { b.classList.toggle('hide', !!hide); b.disabled = !!isEnhancing; } });
  // 왼쪽: 강화석 — 장비가 있을 때만 그 장비 등급의 강화석이 자동 선택되어 표시됨. 클릭 = ON/OFF, 위/아래 = 한 단계 높은/낮은 등급의 (사용 가능한) 강화석으로 변경. 수량은 직접 못 바꿈.
  { const st = state.forgeStone, it = tg && st.id ? catalystDef(st.id) : null;
    const btn = document.getElementById('feCat0');
    const need = it ? catalystRequiredQty({ id: st.id, qty: 1 }, catalystEnhanceCtx(tg.type, tg.level)) : null;
    btn.classList.toggle('empty', !it); btn.classList.toggle('on', !!(it && st.on)); btn.classList.toggle('off', !!(it && !st.on));
    forgeEnhSet('feCat0', it ? forgeCatalystInfo(st.id).iconHtml + `<span class="fe-cat-qty">${catalystOwned(st.id)}/${need == null ? '-' : need}</span>` : '');
    hideBtn(0, 1, !it || !catalystEnhanceStoneNeighbor(1));
    hideBtn(0, -1, !it || !catalystEnhanceStoneNeighbor(-1)); }
  // 오른쪽: 소생석 — 항상 표시. 투입 수량/보유 수량, 1개 이상이면 ON(0개면 OFF 표시). 위/아래 = 투입 수량 ±1(보유량 초과·0 미만 불가)
  { const q = state.forgeRevive, owned = catalystOwned('reviveStone');
    const btn = document.getElementById('feCat1');
    btn.classList.toggle('on', q > 0); btn.classList.toggle('off', q <= 0);
    forgeEnhSet('feCat1', forgeCatalystInfo('reviveStone').iconHtml + `<span class="fe-cat-qty">${q}/${owned}</span>`);
    hideBtn(1, 1, !catalystEnhanceCanAddRevive());
    hideBtn(1, -1, q <= 0); }
  forgeEnhSet('feHint', forgeEnhHintText());
}

// ---- 렌더 ----
function forgeEnhSet(id, html){
  const box = document.getElementById(id);
  if(!box) return;
  const key = '_h_' + id;
  if(forgeEnhNew[key] === html) return;
  forgeEnhNew[key] = html;
  box.innerHTML = html;
}
function forgeEnhSetPrayer(id, isOn, isDisabled){
  const btn = document.getElementById(id);
  if(!btn) return;
  btn.classList.toggle('on', isOn);
  btn.disabled = isDisabled;
}

function forgeEnhNewRender(){
  const wrap = document.getElementById('forgeEnhNew');
  if(!wrap || currentView !== 'forge') return;
  forgeEnhModeRender();
  const equipped = getEquipped();
  const slot = document.getElementById('feItemSlot');
  const detail = document.getElementById('feDetail');
  const btn = document.getElementById('feEnhanceBtn');
  document.getElementById('feInvBtn').disabled = !!isEnhancing; // 기존 인벤토리 열기(openInventory)와 같은 규칙: 강화 중에는 이동 불가

  // 연출 스킵(기존 토글/기존 문구)
  const skipBtn = document.getElementById('feSkipBtn');
  skipBtn.textContent = '⏭ 연출 스킵: ' + (state.skipEffects ? '켜짐' : '꺼짐');
  skipBtn.classList.toggle('on', state.skipEffects);

  if(!equipped){
    forgeEnhSet('feItemSlot', '+');
    slot.classList.remove('filled');
    slot.style.borderColor = '';
    forgeEnhNew.tipHtml = '';
    detail.style.display = 'none';
    forgeEnhSetPrayer('fePrayerBlessing', false, true);
    forgeEnhSetPrayer('fePrayerFocus', false, true);
    btn.disabled = true; btn.textContent = isEnhancing ? '강화 중...' : '강화 진행';
    forgeEnhSet('feSell', '');
    return;
  }

  const level = equipped.level;
  const type = equipped.type || 'longsword';
  const info = equipInstanceDisplayInfo(equipped, type); // 아이콘/등급 색/툴팁 — 인벤토리 슬롯과 같은 표시 규칙(등급 배경·강화 단계 발광 포함)
  slot.classList.add('filled');
  slot.style.borderColor = info.color;
  forgeEnhSet('feItemSlot', info.iconHtml);
  forgeEnhNew.tipHtml = info.tooltipHtml;

  detail.style.display = '';
  const grade = WEAPON_GRADES[wpn(type).grade];
  forgeEnhSet('feName', `<span style="color:${weaponNameColor(type, level)};">${weaponName(type)}${levelSuffix(level)}</span>`);
  forgeEnhSet('feGrade', grade ? `<span style="color:${weaponGradeColor(type)};">${grade.label}</span>` : '');

  const noEnhanceData = !wpn(type).cost || wpn(type).cost.length === 0;
  const atMax = noEnhanceData || level >= MAX_LEVEL; // 다음 강화 단계가 있는지는 기존 강화 데이터/판정과 같은 기준(render.js와 동일)
  const nextLevel = atMax ? null : level + 1;

  // 성장 수치 — 장비/단계/내구도가 같으면 다시 계산하지 않음
  const growKey = [type, level, equipped.damaged ? 1 : 0, equipped.currentDurability, atMax ? 1 : 0].join('|');
  if(!forgeEnhNew.growCache || forgeEnhNew.growCache.key !== growKey){
    forgeEnhNew.growCache = { key: growKey, ...forgeEnhGrowthHtml(type, equipped, level, nextLevel) };
  }
  forgeEnhSet('feLvArrow', forgeEnhNew.growCache.lvArrow);
  forgeEnhSet('feGrow', forgeEnhNew.growCache.html);

  // 기도(기존 규칙 그대로: 사용 불가/최대 강화면 비활성, 켜져 있으면 .on)
  forgeEnhSetPrayer('fePrayerBlessing', state.blessingActive, atMax || !prayerCanUseBlessing(type, level) && !state.blessingActive);
  forgeEnhSetPrayer('fePrayerFocus', state.focusActive, atMax || !prayerCanUseFocus(type, level) && !state.focusActive);

  // 확률 카드 / 비용 / 판매가 — render()의 기존 표시와 같은 데이터·공식
  if(noEnhanceData){
    forgeEnhSet('feOdds', '');
    forgeEnhSet('feCost', '이 장비는 아직 강화 데이터가 준비되지 않았습니다');
    btn.disabled = true;
  } else if(atMax){
    forgeEnhSet('feOdds', '');
    forgeEnhSet('feCost', '최대 강화 완료');
    btn.disabled = true;
  } else {
    const odds = displayEnhanceOdds(type, level);
    let chips = `<span class="odds-chip success">성공 ${fmtOddsNum(odds[0])}%</span>`;
    if(odds[0] < 100){ // 성공 100%면 유지/파괴 칩을 숨김(기존 규칙)
      chips += `<span class="odds-chip stay">유지 ${fmtOddsNum(odds[1])}%</span>`;
      if(odds[2] > 0) chips += `<span class="odds-chip destroy">파괴 ${fmtOddsNum(odds[2])}%</span>`;
    }
    forgeEnhSet('feOdds', `<div class="odds-row">${chips}</div>`);
    const breakdown = enhanceCostBreakdown(type, level);
    const costTooltip = enhanceCostTooltipText(breakdown);
    const goldIcon = uiIconHtml('gold', 'ui-icon-inline'); // 예전 'g' 자리에 텍스트 크기에 맞춘 골드 아이콘
    forgeEnhSet('feCost', costTooltip
      ? `비용: <span class="enhance-cost-wrap enhance-cost-boosted">${breakdown.total.toLocaleString()}${goldIcon}<span class="tooltip">${costTooltip}</span></span>`
      : `비용: ${breakdown.total.toLocaleString()}${goldIcon}`);
    btn.disabled = state.gold < breakdown.total;
  }
  btn.textContent = '강화 진행';
  const price = durabilityAdjustedSellValue(sellValueFor(type, level), equipped); // 기존 판매 가격 계산(내구도 반영)
  forgeEnhSet('feSell', `판매가 ${price.toLocaleString()}${uiIconHtml('gold', 'ui-icon-inline')}`);

  // 강화 진행 중에는 다른 조작 잠금(기존 render()와 동일한 규칙)
  if(isEnhancing){
    btn.disabled = true; btn.textContent = '강화 중...';
    document.getElementById('fePrayerBlessing').disabled = true;
    document.getElementById('fePrayerFocus').disabled = true;
  }
}
// render()가 끝날 때마다 호출(강화 화면일 때만 동작, 바뀐 부분만 다시 그림)
function forgeEnhNewRefresh(){
  forgeEnhNewRender();
}

// ---- 강화 연출(스프라이트) ----
// 설정은 data.js ENCHANT_FX. 효과는 새 강화 탭의 실제 장비 슬롯(#feItemSlot) 중앙에 놓이며, 숨겨진 예전 강화 화면 요소는 쓰지 않음.
function forgeEnhFxBox(id){
  const tri = document.getElementById('feItemSlot').parentElement;
  let box = document.getElementById(id);
  if(!box){
    box = document.createElement('div');
    box.id = id; box.className = 'fe-fx';
    tri.appendChild(box);
  }
  return box;
}
// key: 'start'|'success'|'fail'|'destroy'. opts.loopMs가 있으면 그 시간 동안 반복, 없으면 1회 재생. 끝나면 효과를 숨기고 opts.onDone 호출.
function forgeEnhFxRun(key, opts){
  opts = opts || {};
  const cfg = ENCHANT_FX[key];
  const slot = document.getElementById('feItemSlot');
  const box = forgeEnhFxBox(opts.boxId || 'feFx'); // boxId가 다르면 같은 위치에 겹쳐 동시 재생 가능
  box.style.width = cfg.w + 'px'; box.style.height = cfg.h + 'px';
  box.style.left = (slot.offsetLeft + slot.offsetWidth / 2 - cfg.w / 2) + 'px';
  box.style.top = (slot.offsetTop + slot.offsetHeight / 2 - cfg.h / 2) + 'px';
  box.style.backgroundImage = `url(${cfg.src})`;
  box.style.backgroundSize = (cfg.frames * cfg.w) + 'px ' + cfg.h + 'px';
  const setFrame = f => { box.style.backgroundPosition = (-f * cfg.w) + 'px 0'; };
  let frame = 0;
  setFrame(0); box.style.display = 'block';
  const t0 = Date.now();
  const end = () => { box.style.display = 'none'; if(opts.onDone) opts.onDone(); };
  const step = () => {
    frame++;
    if(opts.loopMs){
      if(Date.now() - t0 >= opts.loopMs) return end();
      frame %= cfg.frames;
    } else if(frame >= cfg.frames){
      return end();
    }
    setFrame(frame);
    setTimeout(step, cfg.frameMs);
  };
  setTimeout(step, cfg.frameMs);
}
// 장비 이름+강화 단계 표시 영역(#feName) 전체에 기존 level-pop(확대 후 복귀) 적용. 아래 성장 수치의 단계 표시에는 적용하지 않음.
// 성공 연출과 동시에 새 단계를 보여주기 위해 이름 표시만 먼저 새 단계로 갱신함(장비 데이터 변경은 연출이 끝난 뒤 resolveEnhance에서).
function forgeEnhPopName(type, newLevel){
  forgeEnhSet('feName', `<span style="color:${weaponNameColor(type, newLevel)};">${weaponName(type)}${levelSuffix(newLevel)}</span>`);
  const nameEl = document.getElementById('feName');
  nameEl.classList.remove('pop'); void nameEl.offsetWidth;
  nameEl.classList.add('pop');
  setTimeout(() => nameEl.classList.remove('pop'), 500);
}
// startEnhance에서 이미 판정된 outcome을 받아 연출만 진행: [시도 연출(반복, attemptMs 동안; 0이면 생략)] → [결과 연출 1회] → resolveEnhance(실제 결과 반영)
// 선택 장비 아이콘 크기 연출 — 시도 중 수축/팽창 반복(charging)과 성공 시 짧은 팝(popping) 모두 슬롯 요소 전체(테두리+이미지)에 적용
function forgeEnhIconFx(mode){
  const slot = document.getElementById('feItemSlot');
  if(!slot) return;
  if(mode === 'pop'){ // 반복이 멈춘 순간의 현재 배율에서 팝을 시작해 튀지 않게 전환
    const m = /matrix\(([-\d.]+)/.exec(getComputedStyle(slot).transform || '');
    slot.style.setProperty('--fe-pop-from', m ? m[1] : '1');
  }
  slot.classList.remove('charging', 'popping', 'burst');
  void slot.offsetWidth;
  if(mode === 'burst') slot.classList.add('burst'); // 파괴: 폭발형 팽창 후 소멸(소멸 상태 유지 — 실제 제거 반영 직전에 'none'으로 정리)
  if(mode === 'charge') slot.classList.add('charging');
  if(mode === 'pop'){
    slot.classList.add('popping');
    setTimeout(() => slot.classList.remove('popping'), ENCHANT_ICON_POP_MS);
  }
}
function forgeEnhPlay(itemId, level, type, outcome, attemptMs){
  const playResult = () => {
    const key = outcome === 'success' ? 'success' : outcome === 'stay' ? 'fail' : 'destroy';
    // 성공: 반복 → 팝으로 전환 / 실패: 반복 종료 후 원래 크기(1.0)로 복귀 / 파괴: 슬롯 폭발형 팝업 + destroy2 스프라이트 겹쳐 재생
    forgeEnhIconFx(outcome === 'success' ? 'pop' : outcome === 'destroy' ? 'burst' : 'none');
    if(outcome === 'success') forgeEnhPopName(type, level + 1);
    if(outcome === 'destroy') forgeEnhFxRun('destroy2', { boxId: 'feFx2' });
    forgeEnhFxRun(key, { onDone: () => {
      if(outcome === 'destroy') forgeEnhIconFx('none'); // 연출용 임시 스타일 정리 — 바로 이어서 실제 제거가 반영되므로 파괴된 장비가 다시 보이지 않음
      resolveEnhance(itemId, level, { newUi: true, outcome });
    } });
  };
  if(attemptMs > 0){ forgeEnhIconFx('charge'); forgeEnhFxRun('start', { loopMs: attemptMs, onDone: playResult }); }
  else playResult();
}

// ---- 파괴 안내 팝업 ----
// 던전 전투 종료 보상창(#killResultModal)을 그대로 재사용: 제목만 "파괴 안내"로, 본문 텍스트 영역에 안내 문구, 아래 획득 아이템 슬롯 영역에 실제 지급된 보상.
// 이미 지급이 끝난 뒤에 열리며(resolveEnhance 참고), 닫거나 다른 화면으로 가도 지급에는 영향이 없음.
function forgeEnhDestroyJosa(name, level){
  // 단계 숫자로 끝나면 숫자의 한국어 읽기 받침(0,1,3,6,7,8 → 받침 있음)으로, 아니면 이름 마지막 글자로 이/가 판단
  if(level > 0) return '0136 78'.replace(' ', '').includes(String(level).slice(-1)) ? '이' : '가';
  return josaIGa(name);
}
function openDestroyNoticeModal(info){
  if(!info) return;
  const slots = [];
  if(info.reward && info.reward.kind === 'trace'){
    const t = info.reward.type, nm = weaponName(t) + '의 흔적';
    slots.push({ // 소비 인벤토리의 흔적 슬롯과 같은 아이콘/툴팁/테두리
      category: 'consumable', gradeRank: -1, qty: null, borderColor: 'var(--forge-line)',
      iconHtml: weaponIconHtml(t, 'reward-icon-img'),
      tooltipHtml: `<div>${nm}</div><div style="color:var(--forge-cream-dim);">단련의 힘을 견디지 못한 ${weaponName(t)}의 흔적</div>`,
    });
  } else if(info.reward && info.reward.kind === 'misc'){
    buildRewardDisplayItems({ weaponDrops: [], weaponIdDrops: [], artifactDrops: [], flaskDrops: {}, scrollDrops: {},
      miscDrops: { [info.reward.key]: { qty: info.reward.qty } }, stoneDrops: {} }).forEach(s => slots.push(s));
  }
  const baseName = weaponName(info.type);
  // 아이템 이름은 굵고 크게 한 줄, 다음 줄에 안내 문구
  let html = `<div style="text-align:center;"><div style="font-weight:800; font-size:1.25em; color:${info.color};">${info.name}</div><div>${forgeEnhDestroyJosa(baseName, info.level)} 강화 도중 파괴되었습니다.</div>`;
  if(info.failMsg) html += `<div style="color:var(--forge-cream-dim); margin-top:4px;">${info.failMsg}</div>`; // 지급 실패(인벤토리 가득 참 등)는 기존 문구 그대로, 지급된 것처럼 표시하지 않음
  html += '</div>';
  if(slots.length){
    html += `<div class="reward-item-section"><div class="reward-item-grid"><div class="reward-item-row reward-item-row-first">${slots.map(rewardItemSlotHtml).join('')}</div></div></div>`;
  }
  hunt.rewardModalMode = 'destroy'; // 'view'가 아니므로 던전 누적 보상 자동 갱신(refreshLiveRewardModal)이 이 창을 덮어쓰지 않음
  hunt.rewardModalOpts = {};
  { const rm = MISC_ITEMS.remnant; // 헤더 아이콘: 부서진 검(remnant) 이미지 — 등급 배경 없이 이미지만(다른 헤더 아이콘과 같은 kill-header-icon)
    el('krIcon').innerHTML = `<img src="${ITEM_IMAGE_DIR + rm.image + ITEM_IMAGE_EXT}" class="kill-header-icon" alt="" draggable="false" data-fallback-emoji="${rm.icon}" onerror="itemImgError(this)">`; }
  el('krTitle').textContent = '파괴 안내';
  el('krTitle').style.color = '';
  el('krLevel').textContent = '';
  el('krRewards').innerHTML = html;
  el('krInvTooltip').innerHTML = buildInvPeekHtml();
  ['krResumeBtn', 'krLeaveBtn', 'krRetryBtn', 'krStopBtn'].forEach(id => { el(id).style.display = 'none'; });
  el('krCloseBtn').style.display = 'inline-block';
  el('killResultModal').classList.add('destroy-notice'); // 파괴 안내 전용 닫기 버튼 스타일
  el('killResultModal').style.display = 'flex';
}

// ---- 조작 ----
function forgeEnhOpenSelect(){ if(!isEnhancing) openForgeSelect(); }
// 선택 해제: 강화 대상(state.forgeTargetId)만 비움 — 장비 자체는 인벤토리에 그대로 있음. 강화 중에는 바꿀 수 없음(기존 장비 선택과 동일).
function forgeEnhClearTarget(){
  if(isEnhancing || state.forgeTargetId == null) return;
  state.forgeTargetId = null;
  render(); saveState();
}

(function forgeEnhInit(){
  const wrap = document.getElementById('forgeEnhNew');
  if(!wrap) return;
  Object.values(ENCHANT_FX).forEach(c => { const im = new Image(); im.src = c.src; }); // 연출 시작 시 깜빡임 방지용 미리 불러오기
  document.body.classList.add('forge-enh-new');

  document.getElementById('fePrayerBlessing').addEventListener('click', () => { if(!forgeIsCatalystMode()) toggleBlessing(); });
  document.getElementById('fePrayerFocus').addEventListener('click', () => { if(!forgeIsCatalystMode()) toggleFocus(); });
  document.getElementById('feEnhanceBtn').addEventListener('click', startEnhance);
  document.getElementById('feInvBtn').addEventListener('click', openInventory); // 기존 인벤토리 열기 그대로(강화 대상 선택 상태는 건드리지 않음)
  document.getElementById('feSkipBtn').addEventListener('click', toggleSkip);
  // 모드 선택 / 촉매 수량 조절 / 촉매 슬롯 조작
  document.getElementById('feMode').addEventListener('click', e => {
    const b = e.target.closest('.fe-mode-btn');
    if(b && !b.disabled) forgeSetMode(b.dataset.mode);
  });
  // 위/아래 버튼: 왼쪽 = 강화석 등급 변경, 오른쪽 = 소생석 투입 수량 ±1
  document.querySelectorAll('.fe-qty-btn').forEach(b => b.addEventListener('click', () => {
    const dir = Number(b.dataset.dir);
    if(codexUI.tipKey && String(codexUI.tipKey).startsWith('forge-cat-')) codexHideTip();
    if(b.dataset.slot === '0') catalystEnhanceShiftStone(dir); else catalystEnhanceAdjustRevive(dir);
  }));
  // 촉매 슬롯 툴팁(촉매 아이템 툴팁 그대로): 데스크톱 = 아이콘에 마우스를 올리면 표시, 모바일 = 한 번 터치하면 표시(같은 슬롯을 다시 한 번 터치하거나 다른 곳을 터치하면 닫힘).
  // 슬롯에 표시 중인 촉매의 id — 강화석 슬롯은 장비가 없으면 비어 있어 null, 소생석 슬롯은 항상 소생석.
  const catSlotItemId = i => i === 0 ? (document.getElementById('feCat0').classList.contains('empty') ? null : state.forgeStone.id) : 'reviveStone';
  const showCatTip = i => {
    const id = catSlotItemId(i); if(!id) return false;
    codexShowTipHtml(document.getElementById('feCat' + i), buildMiscTooltipHtml(id), 'forge-cat-' + id);
    return true;
  };
  [0, 1].forEach(i => {
    const btn = document.getElementById('feCat' + i);
    btn.addEventListener('mouseover', () => { if(!forgeEnhIsMobile()) showCatTip(i); });
    btn.addEventListener('mouseout', () => { if(!forgeEnhIsMobile()) codexHideTip(); });
  });
  // 모바일: 촉매 슬롯 바깥을 터치하면 툴팁이 닫히는 동작은 codex.js의 전역 클릭 처리가 이미 해 줌.
  // 강화석 슬롯 클릭: 데스크톱 = ON/OFF 전환(툴팁은 호버로) / 모바일 = 한 번 터치로 ON/OFF 전환과 툴팁 표시를 함께 처리(더블 터치·대기 시간 없음).
  // ON/OFF 판정은 catalystEnhanceToggleStone 그대로(보유 수량이 필요 수량보다 적으면 ON으로 바뀌지 않음) — 바뀐 뒤 슬롯 상태 기준의 툴팁을 보여 줌.
  // 도감과 같은 전역 클릭 처리(codex.js)가 클릭 직후 툴팁을 닫으므로, 그 처리가 끝난 다음(setTimeout 0)에 표시해 바로 닫히지 않게 함.
  document.getElementById('feCat0').addEventListener('click', () => {
    catalystEnhanceToggleStone();
    if(forgeEnhIsMobile()) setTimeout(() => showCatTip(0), 0);
  });
  // 소생석 슬롯: 모바일 = 한 번 터치하면 툴팁 표시(수량은 위/아래 버튼으로만 조절). 데스크톱은 호버 툴팁만.
  document.getElementById('feCat1').addEventListener('click', () => {
    if(forgeEnhIsMobile()) setTimeout(() => showCatTip(1), 0);
  });

  // 중앙 슬롯: 빈 슬롯 클릭 = 장비 선택 팝업. 장비가 있으면 한 번 클릭 = 선택 팝업(더블 클릭과 구분하려고 잠깐 기다림), 더블 클릭 = 선택 해제.
  const slot = document.getElementById('feItemSlot');
  // 데스크톱: 클릭 = 선택 팝업(바로 열림), 우클릭 = 선택 해제 / 모바일: 위 설명 그대로(한 번 = 팝업, 더블 = 해제)
  slot.addEventListener('click', () => {
    if(!slot.classList.contains('filled') || !forgeEnhIsMobile()){ forgeEnhOpenSelect(); return; }
    if(forgeEnhNew.slotClickTimer){
      clearTimeout(forgeEnhNew.slotClickTimer); forgeEnhNew.slotClickTimer = null;
      if(typeof codexHideTip === 'function') codexHideTip();
      forgeEnhClearTarget();
      return;
    }
    forgeEnhNew.slotClickTimer = setTimeout(() => { forgeEnhNew.slotClickTimer = null; forgeEnhOpenSelect(); }, FORGE_ENH_DOUBLE_CLICK_MS);
  });
  slot.addEventListener('contextmenu', e => {
    if(forgeEnhIsMobile()) return;
    e.preventDefault();
    if(typeof codexHideTip === 'function') codexHideTip();
    forgeEnhClearTarget();
  });
  // 장비 툴팁: 데스크톱에서만 마우스 호버로 표시. 모바일은 아래 성장 수치 영역(현재 장비 옵션)에서 확인하므로 표시하지 않음.
  slot.addEventListener('mouseover', () => {
    if(forgeEnhIsMobile() || !forgeEnhNew.tipHtml || !slot.classList.contains('filled')) return;
    codexShowTipHtml(slot, forgeEnhNew.tipHtml, 'forge-item');
  });
  slot.addEventListener('mouseout', () => { if(!forgeEnhIsMobile()) codexHideTip(); });
})();
