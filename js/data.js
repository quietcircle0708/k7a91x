// ============================================================
// data.js — 게임 데이터 테이블 및 상수
// 새 무기/몬스터/던전/아이템을 추가하거나 밸런스(수치)를 조정할 때는
// 이 파일만 수정하면 됩니다. 계산 로직은 formulas.js를 참고하세요.
// ============================================================

const MAX_LEVEL = 9;
const INV_MAX = 10;
const RING_CHANCE = 2;

// 장비 타입. 지금은 '무기'만 있지만 나중에 방어구 등 다른 장비 타입이 추가될 수 있음.
const EQUIPMENT_TYPES = { weapon: '무기' };

// 무기 종류(카테고리) 구분: 양손 검 / 검 / 단검 / 지팡이. 무기 "이름"과는 별개의 개념.
const WEAPON_KINDS = { two_handed_sword: '양손 검', sword: '검', dagger: '단검', staff: '지팡이' };

// 무기 종류별 착용 요구 스탯 공식. 아이템 레벨(levelReq)에 배율을 곱해서 계산(소수점 반올림), 강화 단계와 무관.
// stat: 'str'(힘) | 'agi'(민첩) | 'int'(지능)
const WEAPON_KIND_STAT_REQ = {
  sword:            [{ stat: 'str', mult: 2 }, { stat: 'agi', mult: 0.5 }],
  two_handed_sword: [{ stat: 'str', mult: 3 }],
  dagger:           [{ stat: 'str', mult: 1 }, { stat: 'agi', mult: 2 }],
  staff:            [{ stat: 'int', mult: 3 }],
};
const STAT_LABELS = { str: '힘', agi: '민첩', int: '지능' };

// 무기 등급(레어도). 색상만 우선 정의 — 텍스트 테두리 강조 등 시각 효과는 추후 추가 예정.
const WEAPON_GRADES = {
  normal: { label: '일반', color: '#ffffff' },
  rare:   { label: '레어', color: '#8fd0ff' },
  epic:   { label: '에픽', color: '#a066d6' },
  unique: { label: '유니크', color: '#ff8a3d' },
};

// ---- 무기 이름 색상 ----
// 무기 이름 색상 = 무기 등급 색상이 기본. 단, 강화 단계 색상의 "가치"가 더 높으면 그 색으로 대체됨.
// 가치 순서(낮음→높음): 흰색 < 하늘색 < 보라색 < 주황색 < 금색. (무기 이미지 발광 효과와는 별개의 시스템)
const NAME_COLOR_RANK = { white: 1, sky: 2, purple: 3, orange: 4, gold: 5 };
const NAME_COLOR_HEX = { white: '#ffffff', sky: '#8fd0ff', purple: '#a066d6', orange: '#ff8a3d', gold: '#e0b13c' };
// 무기 등급별 이름 색상 키
const GRADE_NAME_COLOR_KEY = { normal: 'white', rare: 'sky', epic: 'purple', unique: 'orange' };
// 강화 단계(0~9)별 이름 색상 키
const ENHANCE_NAME_COLOR_KEY = ['white', 'white', 'white', 'sky', 'sky', 'purple', 'purple', 'orange', 'orange', 'gold'];

// 무기 이미지 파일 경로 규칙. WEAPON_TYPES의 image 필드는 파일명만 가짐(확장자/경로 제외).
// 해당 이름의 파일이 없으면 WEAPON_IMAGE_FALLBACK을 사용(런타임에 <img onerror>로 자동 대체).
const WEAPON_IMAGE_DIR = 'assets/sword/';
const WEAPON_IMAGE_EXT = '.png';
const WEAPON_IMAGE_FALLBACK = 'common_shortsword';

// 무기 종류 도감. 새로운 옵션(필드)이 필요해지면 이 객체에 항목만 추가하면 됨 — 언제든 확장 가능한 구조.
// ---- 항목 설명 ----
// desc: 장비 설명 / equipType: 장비 타입(EQUIPMENT_TYPES 참고) / weaponKind: 무기 종류(WEAPON_KINDS) /
// grade: 무기 등급(WEAPON_GRADES) / attackPower: 공격력 / attackSpeed: 공격 속도 / critRate: 치명타 확률(%) /
// purchasable: 상점 구매 가능 여부(true면 상점에 자동 등록) / sellPrice: 판매 가격(플레이어가 상점에 파는 가격.
// 상점 구매가는 이 값의 2배로 자동 계산됨) / levelReq: 아이템 레벨(착용하려면 플레이어 레벨이 이 수치 "이상"이어야 함. 구매/강화는 레벨과 무관하게 항상 가능) / image: 이미지 파일명
// ---- 아래 강화 단계별(+0~+9) 수치는 전부 공식으로 자동 계산되어 채워짐 — 여기에 적는 값은
// "+0(기본) 값"뿐이며, 나머지는 아래 forEach들이 attackPower/attackSpeed/critRate/sellPrice/grade/
// weaponKind를 기준으로 계산해서 덮어씀. 직접 배열 전체를 적어둘 필요 없음(적어도 무시되고 재계산됨).
// atk/speed/crit: 단계별 공격력/공격속도/치명타확률 배열 / cost: 단계별 강화 비용 / sell: 단계별 판매가 / odds: 단계별 강화 확률
const WEAPON_TYPES = {
  longsword: {
    id: 'longsword', name: '롱소드', desc: '균형 잡힌 장검',
    equipType: 'weapon',
    weaponKind: 'two_handed_sword', // 양손 검
    grade: 'normal', // 일반
    attackPower: 28, attackSpeed: 0.6, critRate: 10,
    purchasable: true, sellPrice: 100, levelReq: 1,
    image: 'common_longsword',
    atk: [28], speed: [0.6], crit: [10], sell: [100],
    cost: [], odds: [],
  },
  greatsword: {
    id: 'greatsword', name: '그레이트 소드', desc: '강력한 일격을 위한 대검',
    equipType: 'weapon',
    weaponKind: 'two_handed_sword', // 양손 검
    grade: 'rare', // 레어
    attackPower: 34, attackSpeed: 0.6, critRate: 10,
    purchasable: true, sellPrice: 500, levelReq: 5,
    image: 'rare_greatsword',
    atk: [34], speed: [0.6], crit: [10], sell: [500],
    cost: [], odds: [],
  },
  // ---- 아래 두 무기는 강화 단계별 증가 공식이 아직 없어서, 우선 +0(기본) 값만 담아둠.
  // cost/odds가 비어있으면(강화 데이터 없음) 강화 화면에서 "강화 준비 중"으로 자동 표시됨(render.js 참고).
  shortsword: {
    id: 'shortsword', name: '숏소드', desc: '한 손으로 휘두르는 검',
    equipType: 'weapon',
    weaponKind: 'sword', // 검
    grade: 'normal', // 일반
    attackPower: 20, attackSpeed: 0.8, critRate: 5,
    purchasable: true, sellPrice: 100, levelReq: 1,
    image: 'common_shortsword',
    atk: [20], speed: [0.8], crit: [5], sell: [100],
    cost: [], odds: [],
  },
  dagger: {
    id: 'dagger', name: '대거', desc: '짧은 두 개의 단검',
    equipType: 'weapon',
    weaponKind: 'dagger', // 단검
    grade: 'normal', // 일반
    attackPower: 18, attackSpeed: 1.2, critRate: 10,
    purchasable: true, sellPrice: 100, levelReq: 1,
    image: 'common_dagger',
    atk: [18], speed: [1.2], crit: [10], sell: [100],
    cost: [], odds: [],
  },
};

// 방어구 종류 도감. 현재는 등록된 방어구가 없음(빈 객체) — 상점 "방어구" 탭은 이 표가 비어있는 동안
// 자동으로 빈 탭이 됨. WEAPON_TYPES와 동일한 필드 구조(equipType:'armor', purchasable 등)로 항목을
// 추가하면 상점 코드를 건드리지 않고도 자동으로 목록에 표시됨.
const ARMOR_TYPES = {};

// ============================================================
// 강화 단계별 공격력/공격속도/치명타 계산 공식
// 일반/레어/에픽 등급에 적용됨. 유니크 등급은 이 공식을 쓰지 않고 무기마다 고유 값을 직접 넣을 예정이라 대상에서 제외.
// 필요한 보정값이 아직 없는 무기 종류(예: 지팡이, 구상 중)도 자동으로 제외되고 기존 값이 그대로 유지됨.
// ============================================================

// 1. 강화 단계 구간별 공격력 배율 (index = 강화단계, [0]은 사용 안 함)
const ENHANCE_ATK_STEP_MULT = [null, 1.8, 1.5, 1.3, 1.3, 1.3, 1.3, 1.3, 1.4, 1.4];

// 2. 무기 종류별 공격력 곱연산 보정 (지팡이는 구상 단계라 비워둠)
const WEAPON_KIND_ATK_MULT = { sword: 1, two_handed_sword: 1.014, dagger: 0.96, staff: null };

// 2. 무기 종류별 강화 구간(+1~+9)당 공격속도 증가량 — 합연산. index 0 = +1, ... index 8 = +9
const WEAPON_KIND_ATKSPEED_STEP = {
  sword:            [0.05, 0, 0.05, 0, 0.05, 0, 0.05, 0.1, 0.1],
  two_handed_sword: [0.02, 0, 0.02, 0, 0.02, 0, 0.02, 0.02, 0.05],
  dagger:           [0.1, 0, 0.1, 0, 0.1, 0, 0.1, 0.1, 0.1],
  staff: null,
};

// 2. 무기 종류별 강화 구간(+1~+9)당 치명타 확률 증가량(%p) — 합연산. index 0 = +1, ... index 8 = +9
const WEAPON_KIND_CRIT_STEP = {
  sword:            [0, 1, 0, 1, 0, 1, 0, 1, 1],
  two_handed_sword: [0, 1, 0, 1, 0, 1, 0, 1, 1],
  dagger:           [1, 1, 1, 1, 1, 1, 1, 1, 2],
  staff: null,
};

// 3. 무기 등급별 공격력 곱연산 보정 (+1부터 매 단계 적용). 공격력에만 적용되고 공격속도/치명타에는 영향 없음.
const WEAPON_GRADE_ATK_MULT = { normal: 1, rare: 1.02, epic: 1.03, unique: null };

// 무기 하나의 +0~+9 공격력/공격속도/치명타 배열을 공식대로 계산.
// 필요한 보정값이 없으면(유니크 등급이거나, 아직 정의되지 않은 무기 종류) null을 반환 — 그 경우 기존 값을 그대로 둠.
function computeWeaponLevelStats(w){
  const kindAtkMult = WEAPON_KIND_ATK_MULT[w.weaponKind];
  const gradeAtkMult = WEAPON_GRADE_ATK_MULT[w.grade];
  const atkSpeedSteps = WEAPON_KIND_ATKSPEED_STEP[w.weaponKind];
  const critSteps = WEAPON_KIND_CRIT_STEP[w.weaponKind];
  if(kindAtkMult == null || gradeAtkMult == null || atkSpeedSteps == null || critSteps == null) return null;

  const atk = [w.attackPower];
  const speed = [w.attackSpeed];
  const crit = [w.critRate];
  for(let lv = 1; lv <= 9; lv++){
    const stepMult = ENHANCE_ATK_STEP_MULT[lv];
    // +1의 공격력 = +0의 공격력 × 강화단계배율 × 무기 보정 × 무기 등급 보정 (소수 첫째자리에서 반올림), 이후 단계도 동일하게 재귀 적용
    atk.push(Math.round(atk[lv - 1] * stepMult * kindAtkMult * gradeAtkMult));
    speed.push(Math.round((speed[lv - 1] + (atkSpeedSteps[lv - 1] || 0)) * 100) / 100);
    crit.push(crit[lv - 1] + (critSteps[lv - 1] || 0));
  }
  return { atk, speed, crit };
}

// WEAPON_TYPES 전체에 위 공식을 적용해서 atk/speed/crit 배열을 새로 채움(대상 아닌 무기는 기존 값 유지)
Object.values(WEAPON_TYPES).forEach(w => {
  const computed = computeWeaponLevelStats(w);
  if(computed){
    w.atk = computed.atk;
    w.speed = computed.speed;
    w.crit = computed.crit;
  }
});

// ============================================================
// [1단계] 무기 등급별 강화 확률/강화 비용 — 데이터 테이블만 우선 추가.
// 아직 어디에도 연결되지 않은 새 데이터임 — 기존 코드(odds/cost 사용처)는 전혀 건드리지 않음.
// 다음 단계에서 이 데이터로 배열을 계산하는 함수를 추가하고, 마지막 단계에서 WEAPON_TYPES에 연결할 예정.
// ============================================================

// 등급별 강화 확률 표. 각 배열의 index 0=+1, index 8=+9. 값 순서: [성공%, 유지%, 하락%, 파괴%]
// 일반과 레어는 같은 표를 사용(같은 배열을 그대로 참조 — 데이터 중복 방지)
const GRADE_ENHANCE_ODDS_NORMAL_RARE = [
  [95, 5, 0, 0], [90, 10, 0, 0], [85, 15, 0, 0], [75, 25, 0, 0], [65, 35, 0, 0],
  [50, 45, 5, 0], [40, 30, 29, 1], [25, 30, 40, 5], [20, 20, 50, 10],
];
const GRADE_ENHANCE_ODDS_EPIC = [
  [90, 10, 0, 0], [85, 15, 0, 0], [75, 25, 0, 0], [60, 40, 0, 0], [50, 40, 10, 0],
  [40, 45, 15, 0], [30, 30, 29, 2], [20, 30, 40, 10], [15, 25, 40, 20],
];
const GRADE_ENHANCE_ODDS_UNIQUE = [
  [80, 20, 0, 0], [75, 25, 0, 0], [65, 35, 0, 0], [55, 45, 0, 0], [45, 30, 25, 0],
  [35, 30, 35, 0], [25, 40, 31, 4], [15, 30, 45, 10], [5, 25, 50, 20],
];
const GRADE_ENHANCE_ODDS = {
  normal: GRADE_ENHANCE_ODDS_NORMAL_RARE,
  rare: GRADE_ENHANCE_ODDS_NORMAL_RARE,
  epic: GRADE_ENHANCE_ODDS_EPIC,
  unique: GRADE_ENHANCE_ODDS_UNIQUE,
};

// 강화 비용 공식용 상수.
// +0 강화비용(시드값) = 무기의 판매 가격(sellPrice) × 2 × 0.4
// 이후 강화비용 = 이전 단계 강화비용 × 단계 배율 × 등급 보너스 (다음 단계에서 계산 함수로 구현 예정)
// 단계 배율: index = 강화 단계(0~9)
const ENHANCE_COST_STEP_MULT = [1, 1.5, 1.4, 1.5, 1.5, 1.5, 1.6, 1.6, 1.7, 1.7];
// 등급 보너스
const GRADE_COST_MULT = { normal: 1, rare: 1.015, epic: 1.025, unique: 1.03 };

// ============================================================
// [2단계] 위 데이터로 실제 배열을 계산하는 함수. 아직 WEAPON_TYPES에는 연결하지 않음(3단계에서 연결 예정).
// 독립적으로 호출해서 바로 테스트 가능한 순수 함수들.
// ============================================================

// 무기 하나의 강화 비용 배열(길이 9)을 계산.
// +0 강화비용(시드값)은 sellPrice가 아니라 "아이템 레벨(levelReq)"만으로 결정됨:
//   아이템 레벨 = 1  → 시드값 = 100 × 2 × 0.4
//   아이템 레벨 > 1  → 시드값 = (100 + 아이템 레벨 × 10) × 2 × 0.4
// 이후 단계는 기존과 동일하게 "이전 단계 비용 × 단계배율 × 등급보너스"를 9단계 반복(그레이드 보너스는
// 첫 단계(0→1)에는 적용되지 않고, 1→2 단계부터 적용됨 — 이후 단계 계산 방식 자체는 변경하지 않음).
// 반올림은 각 단계의 "표시값"에만 적용하고, 다음 단계 계산에는 반올림 전의 정밀한 값을 그대로 이어서 사용함
// (매 단계마다 반올림된 값을 누적하면 오차가 쌓여 최종 단계에서 결과가 어긋나기 때문).
// 등급 데이터가 없으면 null 반환.
function computeGradeCost(itemLevel, grade){
  const gradeMult = GRADE_COST_MULT[grade];
  if(gradeMult == null) return null;
  const base = itemLevel === 1 ? 100 : (100 + itemLevel * 10);
  const cost = [];
  let precise = base * 2 * 0.4; // +0 강화비용(시드값) — 0→1 단계 비용은 이 값 그대로(배율 미적용)
  cost.push(Math.round(precise));
  for(let lv = 1; lv <= 8; lv++){
    precise = precise * ENHANCE_COST_STEP_MULT[lv] * gradeMult;
    cost.push(Math.round(precise)); // index0 = 0→1 비용, ... index8 = 8→9 비용
  }
  return cost;
}

// 등급에 해당하는 강화 확률표를 조회. 없는 등급이면 null.
function resolveGradeOdds(grade){
  return GRADE_ENHANCE_ODDS[grade] || null;
}

// ============================================================
// [3단계 - 최종] WEAPON_TYPES 전체에 등급별 강화 확률/비용 공식을 연결.
// 무기에 enhanceOverride({odds, cost})가 명시적으로 등록된 경우에만 그 값을 우선 적용하고,
// 그 외에는 전부(롱소드/그레이트소드 포함) 등급 공식으로 계산해서 odds/cost를 새로 채움.
// ============================================================
Object.values(WEAPON_TYPES).forEach(w => {
  if(w.enhanceOverride){
    if(w.enhanceOverride.odds) w.odds = w.enhanceOverride.odds;
    if(w.enhanceOverride.cost) w.cost = w.enhanceOverride.cost;
    return;
  }
  const gradeOdds = resolveGradeOdds(w.grade);
  const gradeCost = computeGradeCost(w.levelReq || 1, w.grade);
  if(gradeOdds) w.odds = gradeOdds;
  if(gradeCost) w.cost = gradeCost;
});

// ============================================================
// 강화 단계별 판매 가격 공식
// +0 판매가 = 무기의 기본 판매 가격(sellPrice) 그대로 사용.
// +1 이상 판매가 = 기본 판매 가격 + (평균 기대비용 × 강화 단계별 판매 배율).
// 기존 강화 시스템(cost/odds, 강화 진행 로직)은 전혀 건드리지 않고, 그 값을 그대로 읽어서 계산만 함.
// ============================================================

// 강화 단계별 판매 배율. index = 강화 단계(1~9). 무기 종류/등급과 무관하게 고정값.
const ENHANCE_SELL_STEP_MULT = [null, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 1.35, 1.35, 1.35];

// 선형연립방정식 Ax=b를 가우스 소거법(부분 피벗팅)으로 푸는 범용 함수.
// 평균 기대비용 계산 전용으로 쓰지만, 그 자체로는 강화 시스템과 무관한 독립적인 수학 유틸리티.
function solveLinearSystem(A, b){
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for(let col = 0; col < n; col++){
    let pivot = col;
    for(let r = col + 1; r < n; r++){
      if(Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const pv = M[col][col];
    if(Math.abs(pv) < 1e-12) continue; // 특이 행렬 방지용 안전장치(정상적인 확률표에서는 발생하지 않음)
    for(let c = col; c <= n; c++) M[col][c] /= pv;
    for(let r = 0; r < n; r++){
      if(r === col) continue;
      const factor = M[r][col];
      if(factor === 0) continue;
      for(let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map(row => row[n]);
}

// 현재 강화 비용(cost)/강화 확률(odds)을 그대로 사용해, 목표 강화 단계(+1~+최대단계)까지 도달하는
// "평균 기대비용"을 각각 계산. 파괴가 발생하면 재획득비용(reacquireCost)을 내고 +0부터 같은 목표까지
// 다시 강화하는 전체 비용(자기 자신, E_0)이 다시 더해지는 재귀 구조라, 단계별로 연립방정식을 세워서 품.
// (기존 강화 진행 로직과는 완전히 분리된 독립 계산 함수 — cost/odds 값만 입력받아 결과만 반환함)
function computeAverageExpectedCosts(cost, odds, reacquireCost){
  const maxLevel = Math.min(cost.length, odds.length);
  const results = [];
  for(let target = 1; target <= maxLevel; target++){
    const n = target; // 미지수: 0부터 target까지, 각 단계(0~target-1)에서의 기대비용 E_0 ... E_(n-1)
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    const b = new Array(n).fill(0);
    for(let i = 0; i < n; i++){
      const [ps, pt, pd, px] = odds[i].map(v => v / 100);
      A[i][i] += 1 - pt;              // 유지: 같은 자리에 머무름
      A[i][Math.max(i - 1, 0)] -= pd; // 하락: 한 단계 아래로 (0 밑으로는 안 내려감)
      A[i][0] -= px;                  // 파괴: 재획득 후 다시 0부터
      if(i + 1 < n) A[i][i + 1] -= ps; // 성공: 목표(n)에 도달하면 그 이후 비용은 0이라 항이 없음
      b[i] = cost[i] + px * reacquireCost;
    }
    results.push(solveLinearSystem(A, b)[0]); // E_0 = 0부터 target까지의 평균 기대비용
  }
  return results; // index0 = +1까지 기대비용, ... index(maxLevel-1) = +maxLevel까지 기대비용
}

// 무기 하나의 강화 단계별 판매가 배열(길이 10, index=강화단계)을 계산.
// 평균 기대비용은 w.avgExpectedCost에 캐시해서, 이후 같은 실행(세션) 동안 재계산 없이 재사용.
function computeWeaponSellPrices(w){
  if(!w.cost || w.cost.length === 0 || !w.odds || w.odds.length === 0) return null; // 강화 데이터가 없으면 계산 불가(예: 강화 준비 중인 무기)
  const reacquireCost = (w.sellPrice || 0) * 2; // 무기 재획득 비용 = 기본 판매 가격 × 2
  const avgCosts = computeAverageExpectedCosts(w.cost, w.odds, reacquireCost);
  w.avgExpectedCost = avgCosts; // 계산 결과 저장(캐시) — 강화 비용/확률이 바뀌지 않는 한 다시 계산하지 않음
  const sell = [w.sellPrice]; // +0 판매가 = 기본 판매 가격 그대로
  for(let lv = 1; lv <= avgCosts.length; lv++){
    sell.push(Math.round(w.sellPrice + avgCosts[lv - 1] * ENHANCE_SELL_STEP_MULT[lv]));
  }
  return sell;
}

// WEAPON_TYPES 전체(롱소드/그레이트소드 포함)에 판매가 공식을 연결
Object.values(WEAPON_TYPES).forEach(w => {
  const sell = computeWeaponSellPrices(w);
  if(sell) w.sell = sell;
});

// ---- 캐릭터 레벨 시스템 ----
const PLAYER_MAX_LEVEL = 99;
const STAT_POINTS_PER_LEVEL = 4;

// 몬스터 등급
const MONSTER_GRADES = {
  normal: { label: '일반', color: '#ffffff', goldBonus: 0 },
  epic:   { label: '에픽', color: '#a066d6', goldBonus: 0.20 },
  named:  { label: '네임드', color: '#ff8fc7', goldBonus: 0.35 },
};

// 등급별 몬스터 등장 확률(전역 설정값). 던전마다 따로 설정하지 않고 모든 던전이 이 값을 공유함.
// 한 던전 안에 같은 등급 몬스터가 여러 마리면, 그 등급의 확률을 마리 수만큼 균등하게 나눠 가짐.
const MONSTER_GRADE_SPAWN_CHANCE = { normal: 80, epic: 20 };

// 획득 가능한 아티팩트(장비) 도감
const ARTIFACT_SLOT_MAX = 3;
// purchasable:true + buyPrice가 있는 아티팩트만 상점 "아티팩트" 탭에 자동으로 등록됨(박쥐 날개처럼
// 몬스터 드랍 전용 아티팩트는 필드를 비워두면 상점에 나타나지 않음).
const ARTIFACTS = {
  ring: {
    id: 'ring', name: '아주르의 강아지풀 반지', icon: '🌾',
    desc: '마법사 아주르가 마력을 불어넣어 줄기를 꼬아 만든 반지.',
    effectText: '강화 실패 시, 아주 낮은 확률(2%)로 강화 단계 하락을 막아준다.',
    purchasable: true, buyPrice: 25000,
  },
  batwing: {
    id: 'batwing', name: '박쥐 날개', icon: '🦇',
    desc: '흡혈 박쥐(에픽)의 단단한 날개.',
    effectText: '공격속도 5% 증가',
  },
};

// 소비 아이템(플라스크 등) 도감
const QUICK_SLOT_COUNT = 2;
const CONSUMABLES = {
  hpFlask: {
    id: 'hpFlask', name: '[하급]체력 회복 플라스크', class: '플라스크', icon: '🧪',
    desc: '사용시 2초에 걸쳐 최대 체력의 25%를 회복한다',
    buyPrice: 70, sellPrice: 35,
    effect: { type: 'healHp', percent: 25, durationMs: 2000 },
  },
  mpFlask: {
    id: 'mpFlask', name: '[하급]마나 회복 플라스크', class: '플라스크', icon: '💧',
    desc: '사용시 2초에 걸쳐 최대 마나의 25%를 회복한다',
    buyPrice: 70, sellPrice: 35,
    effect: { type: 'healMp', percent: 25, durationMs: 2000 },
  },
};

// 재료성 아이템 도감(기타/마석 등 인벤토리·상점 하단 탭에 노출되는 아이템)
// stateKey: 보유 개수가 저장되는 state의 필드 이름. 상점/판매 로직이 이 값만 보고 동작하므로
// 새 아이템을 추가할 때 stateKey에 맞는 state 필드만 준비하면 코드 수정 없이 자동 연결됨.
// itemClass: 아이템 분류(ITEM_CLASS_LABELS 참고) — 인벤토리/상점의 "마석"/"기타" 탭 분기는
// 아이템 이름이 아니라 이 값만 보고 자동으로 결정됨.
// grade: 마석류 아이템의 등급(WEAPON_GRADES와 동일한 키 체계를 공유 — 이름 색상 공식도 그대로 재사용).
const ITEM_CLASS_LABELS = { stone: '마석' };
const MISC_ITEMS = {
  manaFragment: {
    id: 'manaFragment', name: '마석 파편', icon: '💠', itemClass: 'stone', grade: 'normal',
    desc: '마물의 부서진 심장 파편',
    sellPrice: 50, stateKey: 'manaFragments',
  },
  manaShard: {
    id: 'manaShard', name: '마석 조각', icon: '💠', itemClass: 'stone', grade: 'rare',
    desc: '마물의 부서진 심장 조각',
    sellPrice: 100, stateKey: 'manaShards',
  },
  manaCrystal: {
    id: 'manaCrystal', name: '마석 결정', icon: '💠', itemClass: 'stone', grade: 'epic',
    desc: '마물의 심장 결정',
    sellPrice: 200, stateKey: 'manaCrystals',
  },
  manaStone: {
    id: 'manaStone', name: '마석', icon: '💠', itemClass: 'stone', grade: 'unique',
    desc: '온전한 마물의 심장',
    sellPrice: 1000, stateKey: 'manaStones',
  },
};

// ---- 상점 품목 분류 탭 ----
// 새 탭이 필요해지면 이 배열에 항목만 추가하면 됨. 실제로 어떤 아이템이 어느 탭에 뜨는지는
// formulas.js의 shopEntriesForTab()이 각 도감(WEAPON_TYPES/ARMOR_TYPES/CONSUMABLES/ARTIFACTS/MISC_ITEMS)의
// purchasable 여부(또는 판매 전용 규칙)를 보고 자동으로 결정함 — 아이템 이름/ID로 분기하지 않음.
const SHOP_TABS = [
  { id: 'weapon', label: '무기' },
  { id: 'armor', label: '방어구' },
  { id: 'consumable', label: '소비' },
  { id: 'artifact', label: '아티팩트' },
  { id: 'stone', label: '마석' },
  { id: 'misc', label: '기타' },
];

// 상점 정렬 기준 목록 (필터 드롭다운에 그대로 표시됨)
const SHOP_SORT_FIELDS = [
  { id: 'price', label: '가격' },
  { id: 'levelReq', label: '착용 제한 레벨' },
];

// ---- 상태 이상(디버프) 클래스 ----
// 앞으로 종류가 계속 추가될 예정. 새 상태 이상은 이 객체에 항목만 추가하면 됨.
const STATUS_EFFECTS = {
  poison: {
    id: 1,
    name: '중독',
    icon: '☠️',
    color: '#7fd67f', // 초록 계열
    tickIntervalMs: 1000,        // 1초마다
    maxTicks: 5,                 // 최대 5초(=5틱) 지속
    damagePercentOfMaxHp: 1,     // 매 틱 최대 체력의 1% 피해
  },
};

// 모험가의 유해(무기) 드랍 — 전역 설정값. 던전/몬스터 등급별로 따로 두지 않고 모든 몬스터가 공통으로 사용함.
const RELIC_DROP_CHANCE = 10; // 몬스터 처치 시 장비 드랍 판정 확률(%)
const RELIC_GRADE_CHANCE = { normal: 50, rare: 35, epic: 15 }; // 드랍 판정 성공 시, 장비 등급 선택 확률
const RELIC_LEVEL_WINDOW = 10; // 후보 아이템 레벨 하한 = max(1, 몬스터 레벨 - 이 값)
const RELIC_LEVEL_WEIGHT_DECAY = 0.8; // 등록된 아이템 레벨이 한 단계 낮아질 때마다 가중치 ×이 값(최고 레벨 가중치는 100)
// 드랍된 장비의 강화 단계(+N) 확률. 등급과 무관하게 동일하게 적용되며 +5가 최대.
// 지금은 별도 공식 없이 하드코딩된 확률표를 사용(추후 공식으로 교체 가능하도록 이 표만 바꾸면 됨).
const RELIC_ENHANCE_LEVEL_CHANCE = [
  [0, 20], [1, 20], [2, 20], [3, 15], [4, 15], [5, 10],
];

// 마석 드랍 — 전역 설정값. 던전/몬스터 등급별로 따로 두지 않고 모든 몬스터가 공통으로 사용함.
// (예전의 던전별 드랍 확률·에픽 몬스터 확정 드랍 규칙은 삭제되고 이 전역 설정으로 대체됨)
const STONE_DROP_CHANCE = 20;   // 몬스터 처치 시 마석 드랍 판정 확률(%)
const STONE_DROP_BASE_QTY = 1;  // 기본 드랍 수량(에픽 등급 몬스터는 formulas.js에서 이 값의 2배를 지급)
// 마석 등급 선택 공식(몬스터 레벨 기준). 위에서부터 순서대로 검사해 조건에 맞는 첫 구간의 등급을 사용함.
// maxLevel이 null이면 그 구간은 상한이 없는 것으로 처리됨.
// 지금은 테스트용 공식이며, 레벨 구간이나 등급을 바꾸고 싶으면 이 배열만 수정하면 됨(다른 코드 수정 불필요).
const STONE_GRADE_RULES = [
  { minLevel: 1, maxLevel: 9, grade: 'normal' },
  { minLevel: 10, maxLevel: null, grade: 'rare' },
];

// 개별 몬스터 테이블.
// 체력/공격력은 등급 공식(MONSTER_GRADES)으로 먼저 계산한 뒤, 그 결과에 hpMult/atkMult를 곱해서 최종값을 냄.
// 공격속도도 마찬가지로 기본 몬스터 공격속도(MONSTER_ATTACK_SPEED)에 speedMult를 곱해서 이 몬스터만의 공격속도를 냄.
// drops: 이 몬스터를 처치했을 때 나오는 드랍 목록. 각 항목은 { name, chance }이며, chance는 항목별로 "개별" 판정함
// (여러 개를 합쳐서 100%를 나누는 방식이 아니라, 각 항목마다 따로 확률을 굴림). artifactId가 있는 항목만 실제
// 아티팩트 지급 로직(resolveDrops)과 연결되며, artifactId가 없는 항목(도토리/쥐고기 등 재료류)은 아직 실제
// 아이템 데이터/인벤토리 시스템이 없어 현재는 표시용 데이터로만 존재함 — 추후 재료 아이템이 추가되면 연결 예정.
const MONSTERS = {
  squirrel: {
    id: 'squirrel', name: '다람쥐', icon: '🐿️', grade: 'normal', level: 1,
    hpMult: 1.0, atkMult: 1.0, speedMult: 1.0,
    drops: [ { name: '도토리', chance: 50 } ],
  },
  rat: {
    id: 'rat', name: '쥐', icon: '🐀', grade: 'normal', level: 3,
    hpMult: 1.0, atkMult: 0.6, speedMult: 1.5,
    drops: [ { name: '쥐고기', chance: 50 } ],
  },
  bat: {
    id: 'bat', name: '박쥐', icon: '🦇', grade: 'epic', level: 6,
    extraGoldBonus: 0.10, // 등급 보너스 위에 추가로 붙는 골드 보너스(기존 그대로 유지)
    hpMult: 1.0, atkMult: 2.0, speedMult: 0.5,
    drops: [
      { name: '박쥐고기', chance: 50 },
      { name: '박쥐 날개', chance: 10, artifactId: 'batwing' },
    ],
  },
  blue_snake: {
    id: 'blue_snake', name: '청사', icon: '🐍', grade: 'normal', level: 6,
    hpMult: 1.0, atkMult: 1.0, speedMult: 1.0,
    drops: [ { name: '뱀고기', chance: 50 } ],
  },
  tailless_snake: {
    id: 'tailless_snake', name: '꼬리잘린 뱀', icon: '🐍', grade: 'normal', level: 6,
    hpMult: 0.9, atkMult: 1.0, speedMult: 1.1,
    drops: [ { name: '뱀고기', chance: 50 } ],
  },
  rattlesnake: {
    id: 'rattlesnake', name: '방울뱀', icon: '🐍', grade: 'epic', level: 9,
    hpMult: 1.0, atkMult: 1.0, speedMult: 1.0,
    drops: [ { name: '뱀고기', chance: 50 } ],
  },
  blue_deer: {
    id: 'blue_deer', name: '청록수', icon: '🦌', grade: 'normal', level: 10,
    hpMult: 1.0, atkMult: 2.0, speedMult: 0.5,
    drops: [ { name: '사슴고기', chance: 50 }, { name: '녹용', chance: 20 } ],
  },
  red_deer: {
    id: 'red_deer', name: '적록수', icon: '🦌', grade: 'normal', level: 10,
    hpMult: 1.0, atkMult: 0.5, speedMult: 2.0,
    drops: [ { name: '사슴고기', chance: 50 }, { name: '녹용', chance: 20 } ],
  },
  three_eyed_deer: {
    id: 'three_eyed_deer', name: '세개의 눈을 가진 사슴', icon: '🦌', grade: 'epic', level: 14,
    hpMult: 1.0, atkMult: 1.0, speedMult: 1.0,
    drops: [ { name: '사슴고기', chance: 50 }, { name: '녹용', chance: 20 } ],
  },
};


// 던전 테이블.
// monsters: 등장 몬스터 id 배열(그 안에서 몬스터별 등장확률/개별 레벨범위를 따로 설정하지 않음 —
//   등급별 등장확률은 MONSTER_GRADE_SPAWN_CHANCE(전역)를 따르고, 레벨은 아래 levelRange로 결정됨).
// icon: 비워두면(빈 문자열) 등장 몬스터 중 첫 번째의 아이콘을 자동으로 사용함(dungeonIcon() 참고).
// levelRange: 일반 등급 몬스터의 등장 레벨 = 몬스터 자체 레벨 ~ (몬스터 자체 레벨 + levelRange), 그 구간 내에서
//   레벨별 등장 확률은 모두 동일함. 에픽(그 외 등급) 몬스터는 이 범위를 적용하지 않고 몬스터 데이터의
//   고정 레벨(level)로만 등장함.
// dropTable(마석 파편 드랍 규칙)은 더 이상 던전별로 관리하지 않고, 아래 전역 설정(STONE_* / STONE_GRADE_RULES)으로 통일됨.
// 모험가의 유해(무기) 드랍도 마찬가지로 던전별 설정을 쓰지 않고 위의 RELIC_* 전역 설정값으로 통일됨.
const DUNGEONS = [
  {
    id: 'squirrel_hole',
    name: '다람쥐굴',
    icon: '',
    desc: '숲에서 으스나무의 알 수 없는 힘에 빨려들어온 다람쥐들이 사는 굴입니다. 이들은 이성이 없고 침입자를 무차별적으로 공격합니다.',
    monsters: ['squirrel'],
    levelRange: 2,
  },
  {
    id: 'rat_den',
    name: '쥐굴',
    icon: '',
    desc: '하수도 깊은 곳에 자리 잡은 쥐떼의 소굴입니다. 가끔 흡혈 박쥐가 함께 서식하기도 합니다.',
    monsters: ['rat', 'bat'],
    levelRange: 2,
  },
  {
    id: 'snake_den',
    name: '뱀굴',
    icon: '',
    desc: '습하고 어두운 동굴 깊은 곳에 뱀들이 똬리를 튼 소굴입니다. 방울뱀의 독은 매우 위험합니다.',
    monsters: ['blue_snake', 'tailless_snake', 'rattlesnake'],
    levelRange: 2,
  },
  {
    id: 'deer_den',
    name: '사슴굴',
    icon: '',
    desc: '깊은 숲 속, 신령한 기운이 감도는 사슴들의 서식지입니다. 세 개의 눈을 가진 사슴은 예사롭지 않은 기운을 뿜습니다.',
    monsters: ['blue_deer', 'red_deer', 'three_eyed_deer'],
    levelRange: 2,
  },
];

// 모든 몬스터 공통 규칙
const MONSTER_BASE_GOLD = 100;       // 1레벨 몬스터의 기본 드랍 골드
const MONSTER_GOLD_GROWTH = 0.12;    // 레벨당 골드 가중치 (+12%)
const MONSTER_GOLD_VARIANCE = 0.15;  // 최종 드랍 골드 랜덤 편차 (±15%)
const MONSTER_ATTACK_SPEED = 1.0;    // 몬스터 공격속도(초당 공격 횟수) = 1초에 1번

// 강화단계 그룹별 표시 이름(대장간 화면 상단 라벨, 인벤토리 카드 등에서 사용)
const TIER_META = [
  { label:"평범한 검" },
  { label:"기운이 감도는 검" },
  { label:"신비로운 검" },
  { label:"타오르는 검" },
  { label:"전설의 검" },
];

// 강화 단계(+0~+9)별 무기 발광 효과. PNG 이미지 자체는 건드리지 않고, 무기 이미지에 CSS filter만 적용해서 표현함
// (drop-shadow 기본, 필요 시 brightness/saturate/blur 등을 filter 체인에 추가). 배경 전체가 아니라 무기 이미지 자체에만
// 적용되므로 이미지 알파(투명 영역)를 넘어서 번지지 않음.
// - glowColor: 대표 색상(폼멜 보석 색, 연기 색상 등에도 재사용)
// - glow: swordVisual에 적용할 filter 값
// - smoke: 연기 파티클 표시 여부
const ENHANCE_LEVEL_EFFECTS = [
  /* +0 */ { glowColor: null,      glow: "none" },
  /* +1 */ { glowColor: "#ffffff", glow: "drop-shadow(0 0 6px #ffffffb0)" },
  /* +2 */ { glowColor: "#ffffff", glow: "drop-shadow(0 0 9px #ffffffd0) brightness(1.05)" },
  /* +3 */ { glowColor: "#8fd0ff", glow: "drop-shadow(0 0 9px #8fd0ffb0)" },
  /* +4 */ { glowColor: "#8fd0ff", glow: "drop-shadow(0 0 12px #8fd0ffd0) brightness(1.05)", smoke: true },
  /* +5 */ { glowColor: "#a066d6", glow: "drop-shadow(0 0 12px #a066d6b0)", smoke: true },
  /* +6 */ { glowColor: "#a066d6", glow: "drop-shadow(0 0 15px #a066d6d0) brightness(1.05) saturate(1.1)", smoke: true },
  /* +7 */ { glowColor: "#ff6a3d", glow: "drop-shadow(0 0 15px #ff6a3db0)", smoke: true },
  /* +8 */ { glowColor: "#ff6a3d", glow: "drop-shadow(0 0 18px #ff6a3dd0) brightness(1.08) saturate(1.15)", smoke: true },
  /* +9 */ { glowColor: "#c9950f", glow: "drop-shadow(0 0 22px #c9950fee) drop-shadow(0 0 10px #f2b90fcc) brightness(1.05) saturate(1.35)", smoke: true },
];

// 저장소 키
const STORAGE_KEY = 'forge-state-v5';

// ---- 설정 시스템 ----
// 카테고리(예: 전투) 안에 메뉴(예: 회복 설정)들이 들어가는 구조.
// 새 카테고리/메뉴를 추가할 때는 이 배열에 항목만 추가하면 됨 — 모달 UI, 저장 로직은 자동으로 반영됨.
// 각 항목: id(state.settings에 저장될 키), label(표시 이름), desc(설명),
// type('toggle' | 'stepper' | 'stepper-row'), default(기본값).
// stepper-row는 여러 개의 스테퍼(fields)를 한 줄에 배치할 때 사용 — 각 field는 min/max/step/unit/default 필요.
const SETTINGS_SCHEMA = [
  {
    id: 'combat',
    label: '전투',
    icon: '⚔️',
    items: [
      {
        id: 'autoHeal',
        label: '회복 설정',
        desc: '설정 값에 따라, 퀵슬롯에 등록된 플라스크를 사용합니다.',
        type: 'toggle',
        default: false,
      },
      {
        id: 'healThresholds',
        type: 'stepper-row',
        fields: [
          { id: 'autoHealThreshold', label: '체력 설정', min: 10, max: 90, step: 5, unit: '%', default: 50 },
          { id: 'autoManaThreshold', label: '마나 설정', min: 10, max: 90, step: 5, unit: '%', default: 50 },
        ],
      },
    ],
  },
];
