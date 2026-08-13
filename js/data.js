// ============================================================
// data.js — 게임 데이터 테이블 및 상수
// 새 무기/몬스터/던전/아이템을 추가하거나 밸런스(수치)를 조정할 때는
// 이 파일만 수정하면 됩니다. 계산 로직은 formulas.js를 참고하세요.
// ============================================================

const MAX_LEVEL = 9;
const INV_MAX = 50; // 장비(무기/방어구/장신구) 공용 인벤토리 최대 슬롯 — 세 종류가 하나의 총량을 공유함(totalEquipInventoryCount 참고)

// 장비 타입. 무기 / 방어구 / 장신구 / 아티팩트가 있으며, 방어구·장신구는 아직 실제 데이터가 없음(장비 탭
// 구조만 먼저 준비된 상태 — 20번째 작업 "장비 탭 추가" 참고).
const EQUIPMENT_TYPES = { weapon: '무기', armor: '방어구', accessory: '장신구', artifact: '아티팩트' };

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

// 몬스터 이미지 파일 경로 규칙(무기와 동일한 방식). MONSTERS의 image 필드는 파일명만 가짐(확장자/경로 제외),
// 필드 자체가 없는 몬스터는 기존처럼 icon(이모지)을 그대로 사용함. image가 있는데 실제 파일 로드에
// 실패하는 경우엔 폴백 PNG가 아니라 이모지(icon)로 대체됨(monsterIconHtml/monsterImgError, formulas.js).
const MONSTER_IMAGE_DIR = 'assets/monster/';
const MONSTER_IMAGE_EXT = '.png';

// 기타/아티팩트/소비 아이템 이미지 파일 경로 규칙(무기·몬스터와 동일한 방식). ARTIFACTS/CONSUMABLES/
// MISC_ITEMS 항목에 선택 필드 image(파일명만, 확장자/경로 제외)를 등록하면 이모지(icon) 대신 PNG가
// 출력됨(itemIconHtml/itemImgError, formulas.js). image 필드가 없거나 파일 로드에 실패하면 항상
// 기존처럼 icon(이모지)이 그대로 출력됨 — 새로 추가되는 기타/아티팩트/소비 아이템도 동일하게 동작함.
const ITEM_IMAGE_DIR = 'assets/MiscItems/';
const ITEM_IMAGE_EXT = '.png';

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
    id: 'longsword', name: '견습 모험가의 대검', desc: '균형 잡힌 장검',
    equipType: 'weapon',
    weaponKind: 'two_handed_sword', // 양손 검
    grade: 'normal', // 일반
    attackPower: 30, attackSpeed: 0.6, critRate: 10,
    purchasable: true, sellPrice: 100, levelReq: 1,
    image: 'common_longsword',
    atk: [30], speed: [0.6], crit: [10], sell: [100],
    cost: [], odds: [],
  },
  greatsword: {
    id: 'greatsword', name: '낡은 그레이트소드', desc: '강력한 일격을 위한 대검',
    equipType: 'weapon',
    weaponKind: 'two_handed_sword', // 양손 검
    grade: 'rare', // 레어
    attackPower: 43, attackSpeed: 0.6, critRate: 10,
    purchasable: true, sellPrice: 500, levelReq: 5,
    image: 'rare_greatsword',
    atk: [43], speed: [0.6], crit: [10], sell: [500],
    cost: [], odds: [],
  },
  // ---- 아래 두 무기는 강화 단계별 증가 공식이 아직 없어서, 우선 +0(기본) 값만 담아둠.
  // cost/odds가 비어있으면(강화 데이터 없음) 강화 화면에서 "강화 준비 중"으로 자동 표시됨(render.js 참고).
  shortsword: {
    id: 'shortsword', name: '견습 모험가의 검', desc: '한 손으로 휘두르는 검',
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
    id: 'dagger', name: '견습 모험가의 단검', desc: '짧은 두 개의 단검',
    equipType: 'weapon',
    weaponKind: 'dagger', // 단검
    grade: 'normal', // 일반
    attackPower: 12, attackSpeed: 1.2, critRate: 10,
    purchasable: true, sellPrice: 100, levelReq: 1,
    image: 'common_dagger',
    atk: [12], speed: [1.2], crit: [10], sell: [100],
    cost: [], odds: [],
  },
  broadsword: {
    id: 'broadsword', name: '낡은 브로드소드', desc: '베고 찌르는 데 특화된 검',
    equipType: 'weapon',
    weaponKind: 'sword', // 검
    grade: 'rare', // 레어
    attackPower: 29, attackSpeed: 0.8, critRate: 5,
    purchasable: true, sellPrice: 500, levelReq: 5,
    image: 'rare_broadsword',
    atk: [29], speed: [0.8], crit: [5], sell: [500],
    cost: [], odds: [],
  },
  combatknife: {
    id: 'combatknife', name: '낡은 컴뱃 나이프', desc: '빠르게 휘두를 수 있게 설계된 단검',
    equipType: 'weapon',
    weaponKind: 'dagger', // 단검
    grade: 'rare', // 레어
    attackPower: 18, attackSpeed: 1.2, critRate: 10,
    purchasable: true, sellPrice: 500, levelReq: 5,
    image: 'rare_combatknife',
    atk: [18], speed: [1.2], crit: [10], sell: [500],
    cost: [], odds: [],
  },
  longsword2: {
    id: 'longsword2', name: '초보 모험가의 대검', desc: '균형 잡힌 장검',
    equipType: 'weapon',
    weaponKind: 'two_handed_sword', // 양손 검
    grade: 'normal', // 일반
    attackPower: 47, attackSpeed: 0.6, critRate: 10,
    purchasable: true, sellPrice: 500, levelReq: 10,
    image: 'common_longsword2',
    atk: [47], speed: [0.6], crit: [10], sell: [500],
    cost: [], odds: [],
  },
  shortsword2: {
    id: 'shortsword2', name: '초보 모험가의 검', desc: '한 손으로 휘두르는 검',
    equipType: 'weapon',
    weaponKind: 'sword', // 검
    grade: 'normal', // 일반
    attackPower: 31, attackSpeed: 0.8, critRate: 5,
    purchasable: true, sellPrice: 500, levelReq: 10,
    image: 'common_shortsword2',
    atk: [31], speed: [0.8], crit: [5], sell: [500],
    cost: [], odds: [],
  },
  dagger2: {
    id: 'dagger2', name: '초보 모험가의 단검', desc: '짧은 두 개의 단검',
    equipType: 'weapon',
    weaponKind: 'dagger', // 단검
    grade: 'normal', // 일반
    attackPower: 19, attackSpeed: 1.2, critRate: 10,
    purchasable: true, sellPrice: 500, levelReq: 10,
    image: 'common_dagger2',
    atk: [19], speed: [1.2], crit: [10], sell: [500],
    cost: [], odds: [],
  },
  poisonfang: {
    id: 'poisonfang', name: '독 송곳니', desc: '맹독을 품은 송곳니를 벼려 만든 단검',
    equipType: 'weapon',
    weaponKind: 'dagger', // 단검
    grade: 'epic', // 에픽
    attackPower: 26, attackSpeed: 1.2, critRate: 15,
    purchasable: false, sellPrice: 2400, levelReq: 8,
    image: 'epic_poisonfang',
    atk: [26], speed: [1.2], crit: [15], sell: [2400],
    cost: [], odds: [],
    // ---- 고유 옵션(에픽/유니크 전용) ----
    // effectId: 다른 소스(아티팩트 등)와 동일 효과일 경우 확률을 합산해 1회만 판정하기 위한 식별자
    // activateLevel: 이 강화 단계(+N) 이상에서만 활성화. 강화 단계가 낮아지면 즉시 비활성화되고,
    //   다시 조건을 만족하면 재활성화됨 — 항상 "현재 강화 단계" 기준으로 판단(별도 상태 저장 없음)
    // chanceByLevel: 강화 단계별 발동 확률(%). activateLevel 미만 구간은 값이 없어도 됨(비활성 상태에서
    //   툴팁에 미리보기로 표시할 때는 activateLevel 시점의 값을 사용함)
    // textTemplate: 툴팁 표시 문구. {chance}가 현재(또는 미리보기) 수치로 자동 치환됨
    uniqueOption: {
      effectId: 'poison_on_hit',
      activateLevel: 5,
      chanceByLevel: { 5: 5, 6: 5, 7: 6, 8: 6, 9: 7 },
      textTemplate: '공격 적중 시 {chance}% 확률로 중독',
    },
  },
  greatsword2: {
    id: 'greatsword2', name: '그레이트소드', desc: '압도적인 위력으로 적을 분쇄하는 거대한 대검',
    equipType: 'weapon',
    weaponKind: 'two_handed_sword', // 양손 검
    grade: 'rare', // 레어
    attackPower: 71, attackSpeed: 0.6, critRate: 10,
    purchasable: true, sellPrice: 1000, levelReq: 15,
    image: 'rare_greatsword2',
    atk: [71], speed: [0.6], crit: [10], sell: [1000],
    cost: [], odds: [],
  },
  broadsword2: {
    id: 'broadsword2', name: '브로드소드', desc: '공격과 방어의 균형을 갖춘 검',
    equipType: 'weapon',
    weaponKind: 'sword', // 검
    grade: 'rare', // 레어
    attackPower: 48, attackSpeed: 0.8, critRate: 5,
    purchasable: true, sellPrice: 1000, levelReq: 15,
    image: 'rare_broadsword2',
    atk: [48], speed: [0.8], crit: [5], sell: [1000],
    cost: [], odds: [],
  },
  combatknife2: {
    id: 'combatknife2', name: '컴뱃 나이프', desc: '신속한 근접전을 위한 다목적 단검',
    equipType: 'weapon',
    weaponKind: 'dagger', // 단검
    grade: 'rare', // 레어
    attackPower: 28, attackSpeed: 1, critRate: 10,
    purchasable: true, sellPrice: 1000, levelReq: 15,
    image: 'rare_combatknife2',
    atk: [28], speed: [1], crit: [10], sell: [1000],
    cost: [], odds: [],
  },
  longsword3: {
    id: 'longsword3', name: '모험가의 대검', desc: '튼튼한 내구성을 갖춘 모험가용 대검',
    equipType: 'weapon',
    weaponKind: 'two_handed_sword', // 양손 검
    grade: 'normal', // 일반
    attackPower: 76, attackSpeed: 0.6, critRate: 10,
    purchasable: true, sellPrice: 1250, levelReq: 20,
    image: 'common_longsword3',
    atk: [76], speed: [0.6], crit: [10], sell: [1250],
    cost: [], odds: [],
  },
  shortsword3: {
    id: 'shortsword3', name: '모험가의 검', desc: '균형 잡힌 성능의 모험가용 검',
    equipType: 'weapon',
    weaponKind: 'sword', // 검
    grade: 'normal', // 일반
    attackPower: 51, attackSpeed: 0.8, critRate: 5,
    purchasable: true, sellPrice: 1250, levelReq: 20,
    image: 'common_shortsword3',
    atk: [51], speed: [0.8], crit: [5], sell: [1250],
    cost: [], odds: [],
  },
  dagger3: {
    id: 'dagger3', name: '모험가의 단검', desc: '가볍고 다루기 쉬운 모험가용 단검',
    equipType: 'weapon',
    weaponKind: 'dagger', // 단검 (표기상 "양손 검"은 오타로 확인함)
    grade: 'normal', // 일반
    attackPower: 30, attackSpeed: 1.0, critRate: 10,
    purchasable: true, sellPrice: 1250, levelReq: 20,
    image: 'common_dagger2', // 기존 dagger2와 이미지 공유(재사용) — 신규 파일 없음
    atk: [30], speed: [1.0], crit: [10], sell: [1250],
    cost: [], odds: [],
  },
  blacksword: {
    id: 'blacksword', name: '흑색 검', desc: '검은빛을 머금은 날은 적의 숨결마저 끊어낸다.',
    equipType: 'weapon',
    weaponKind: 'sword', // 검
    grade: 'epic', // 에픽
    attackPower: 69, attackSpeed: 0.8, critRate: 5,
    purchasable: false, sellPrice: 4560, levelReq: 18,
    image: 'epic_blacksword',
    atk: [69], speed: [0.8], crit: [5], sell: [4560],
    cost: [], odds: [],
    // 고유 옵션: 치명타 확률 자체를 올려주는 "스탯 보너스" 계열 효과(effectId: crit_chance_bonus).
    // 독 송곳니의 poison_on_hit(적중 시 확률 발동형)와 달리, 이 효과는 활성화 조건을 만족하는 동안
    // 항상 적용되는 고정 보너스 — effectiveCritChance(formulas.js)에서 effectId로 인식해 합산함.
    uniqueOption: {
      effectId: 'crit_chance_bonus',
      activateLevel: 5,
      chanceByLevel: { 5: 4, 6: 5, 7: 6, 8: 7, 9: 10 },
      textTemplate: '치명타 확률 {chance}% 증가',
    },
  },
  moongreatsword: {
    id: 'moongreatsword', name: '반월대도', desc: '거대한 반월형 칼날을 가진 대도',
    equipType: 'weapon',
    weaponKind: 'two_handed_sword', // 양손 검
    grade: 'epic', // 에픽
    attackPower: 146, attackSpeed: 0.6, critRate: 10,
    purchasable: false, sellPrice: 5900, levelReq: 25,
    image: 'epic_moongreatsword',
    atk: [146], speed: [0.6], crit: [10], sell: [5900],
    cost: [], odds: [],
    // 고유 옵션: 성장치가 없는 "고정형" 고유 옵션 — chanceByLevel/textTemplate({chance}) 대신 완성된
    // 문구(text)와 고정 스탯 보너스(statBonus)를 직접 등록함. activateLevel:0이라 +0부터 바로 활성화되고,
    // 강화를 진행해도 수치가 오르지 않음(요청사항). statBonus는 artifactStatBonus/effectiveMaxHp에서
    // weaponUniqueOptionStatBonus를 통해 자동으로 합산되어 실제 스탯에 반영됨(formulas.js).
    // 이 스키마(opt.text + opt.statBonus)는 반월대도 전용이 아니라, 앞으로 추가되는 성장치 없는 고정
    // 고유 옵션 무기라면 그대로 재사용 가능 — weaponUniqueOptionTooltipHtml/ForgeHtml이 opt.text 유무로
    // 자동 분기함.
    uniqueOption: {
      activateLevel: 0,
      text: '힘 +5<br>최대 체력 +800',
      statBonus: { str: 5, maxHp: 800 },
    },
  },
  bent_greatsword: {
    id: 'bent_greatsword', name: '휘어진 양손 검', desc: '날이 휘어져 절삭력이 좋지 않다',
    equipType: 'weapon',
    weaponKind: 'two_handed_sword', // 양손 검
    grade: 'normal', // 일반
    attackPower: 35, attackSpeed: 0.6, critRate: 8,
    purchasable: false, sellPrice: 200, levelReq: 4,
    image: 'common_longsword', // 기존 이미지 재사용
    atk: [35], speed: [0.6], crit: [8], sell: [200],
    cost: [], odds: [],
  },
  doubleedge_greatsword: {
    id: 'doubleedge_greatsword', name: '양날대검', desc: '세월의 흔적이 담긴 양손 검',
    equipType: 'weapon',
    weaponKind: 'two_handed_sword', // 양손 검
    grade: 'normal', // 일반
    attackPower: 40, attackSpeed: 0.6, critRate: 9,
    purchasable: false, sellPrice: 350, levelReq: 7,
    image: 'common_longsword', // 기존 이미지 재사용
    atk: [40], speed: [0.6], crit: [9], sell: [350],
    cost: [], odds: [],
  },
  doubleedge_sword: {
    id: 'doubleedge_sword', name: '양날검', desc: '세월의 흔적이 담긴 검',
    equipType: 'weapon',
    weaponKind: 'sword', // 검
    grade: 'normal', // 일반
    attackPower: 27, attackSpeed: 0.8, critRate: 4,
    purchasable: false, sellPrice: 350, levelReq: 7,
    image: 'common_shortsword', // 기존 이미지 재사용
    atk: [27], speed: [0.8], crit: [4], sell: [350],
    cost: [], odds: [],
  },
  iron_sword: {
    id: 'iron_sword', name: '철검', desc: '조잡하지만 위력은 있는 검',
    equipType: 'weapon',
    weaponKind: 'sword', // 검
    grade: 'normal', // 일반
    attackPower: 24, attackSpeed: 0.8, critRate: 3,
    purchasable: false, sellPrice: 195, levelReq: 4,
    image: 'common_shortsword', // 기존 이미지 재사용
    atk: [24], speed: [0.8], crit: [3], sell: [195],
    cost: [], odds: [],
  },
  plain_dagger: {
    id: 'plain_dagger', name: '단검', desc: '가볍지만 균형이 어긋나있다.',
    equipType: 'weapon',
    weaponKind: 'dagger', // 단검
    grade: 'normal', // 일반
    attackPower: 14, attackSpeed: 1.0, critRate: 9,
    purchasable: false, sellPrice: 195, levelReq: 4,
    image: 'common_dagger', // 기존 이미지 재사용
    atk: [14], speed: [1.0], crit: [9], sell: [195],
    cost: [], odds: [],
  },
  sharp_dagger: {
    id: 'sharp_dagger', name: '날카로운 단검', desc: '날 끝을 예리하게 갈아낸 단검',
    equipType: 'weapon',
    weaponKind: 'dagger', // 단검 (사용자 확인 후 검→단검으로 수정함)
    grade: 'normal', // 일반
    attackPower: 16, attackSpeed: 1.0, critRate: 9,
    purchasable: false, sellPrice: 340, levelReq: 7,
    image: 'common_dagger', // 기존 이미지 재사용
    atk: [16], speed: [1.0], crit: [9], sell: [340],
    cost: [], odds: [],
  },
  bastardsword: {
    id: 'bastardsword', name: '바스타드 소드', desc: '상황에 따라 어떤 손으로든,<br>자유롭게 휘두를 수 있는 중검',
    equipType: 'weapon',
    weaponKind: 'two_handed_sword', // 양손 검
    grade: 'rare', // 레어
    attackPower: 116, attackSpeed: 0.6, critRate: 10,
    purchasable: true, sellPrice: 1750, levelReq: 25,
    image: 'rare_basterdsword',
    atk: [116], speed: [0.6], crit: [10], sell: [1750],
    cost: [], odds: [],
  },
  armingsword: {
    id: 'armingsword', name: '아밍소드', desc: '균형 잡힌 검신을 가진<br>아름다운 검',
    equipType: 'weapon',
    weaponKind: 'sword', // 검
    grade: 'rare', // 레어
    attackPower: 73, attackSpeed: 0.8, critRate: 5,
    purchasable: true, sellPrice: 1750, levelReq: 25,
    image: 'rare_armingsword',
    atk: [73], speed: [0.8], crit: [5], sell: [1750],
    cost: [], odds: [],
  },
  silverdagger: {
    id: 'silverdagger', name: '실버 대거', desc: '어둠 속에서 빛나는<br>은빛 칼날의 단검',
    equipType: 'weapon',
    weaponKind: 'dagger', // 단검
    grade: 'rare', // 레어
    attackPower: 47, attackSpeed: 1.0, critRate: 10,
    purchasable: true, sellPrice: 1750, levelReq: 25,
    image: 'rare_silverdagger',
    atk: [47], speed: [1.0], crit: [10], sell: [1750],
    cost: [], odds: [],
  },
  steelsword: {
    id: 'steelsword', name: '강철 검', desc: '단단한 강철로 벼려낸 믿음직한 검',
    equipType: 'weapon',
    weaponKind: 'sword', // 검
    grade: 'normal', // 일반
    attackPower: 82, attackSpeed: 0.8, critRate: 5,
    purchasable: true, sellPrice: 2250, levelReq: 30,
    image: 'common_shortsword4',
    atk: [82], speed: [0.8], crit: [5], sell: [2250],
    cost: [], odds: [],
  },
  steelgreatsword: {
    id: 'steelgreatsword', name: '강철 대검', desc: '무거운 강철로 만들어진 강력한 양손 검',
    equipType: 'weapon',
    weaponKind: 'two_handed_sword', // 양손 검
    grade: 'normal', // 일반
    attackPower: 123, attackSpeed: 0.6, critRate: 10,
    purchasable: true, sellPrice: 2250, levelReq: 30,
    image: 'common_longsword4',
    atk: [123], speed: [0.6], crit: [10], sell: [2250],
    cost: [], odds: [],
  },
  steeldagger: {
    id: 'steeldagger', name: '강철 단검', desc: '날카롭게 벼려낸 가볍고 재빠른 단검',
    equipType: 'weapon',
    weaponKind: 'dagger', // 단검
    grade: 'normal', // 일반
    attackPower: 49, attackSpeed: 1.0, critRate: 10,
    purchasable: true, sellPrice: 2250, levelReq: 30,
    image: 'common_dagger4',
    atk: [49], speed: [1.0], crit: [10], sell: [2250],
    cost: [], odds: [],
  },
};


// ---- 방어구 종류(투구/갑옷) ----
const ARMOR_KINDS = { helmet: '투구', armor: '갑옷' };
// 방어구 이미지 파일 경로 규칙(무기와 동일한 onerror 방식). image 필드가 비어 있으면 방어구 종류별
// 기본 이미지(투구→helmetbase, 갑옷→armorbase)를 자동 적용함(방어구 아이템 데이터 스키마 규칙).
const ARMOR_IMAGE_DIR = 'assets/armor/';
const ARMOR_IMAGE_EXT = '.png';
const ARMOR_DEFAULT_IMAGE = { helmet: 'helmetbase', armor: 'armorbase' };

// 방어구 종류 도감. 무기 데이터 스키마와 동일한 구조를 기본으로 사용함(이름/장비 설명/아이템 등급/
// 고유 옵션/상점 구매 여부/판매 가격/이미지는 무기와 동일한 규칙). 레벨 제한은 레벨만 검사하고(힘/민첩 등
// 추가 조건 없음), 각 방어구 종류(투구/갑옷)당 하나의 아이템만 동시 착용 가능함.
// ---- 항목 설명 ----
// armorKind: 방어구 종류('helmet'|'armor') / defense: 기본 방어도(음수 값만 사용) / hp: 기본 체력 보너스 /
// mana: 기본 마나 보너스 — defense/hp/mana는 공란(값 없음=undefined)이면 해당 옵션이 없는 것으로 간주됨.
// defArr/hpArr/manaArr: 강화 단계별(+0~+9) 값 배열 — 아래 forEach가 자동으로 계산해서 채움(직접 적을 필요 없음).
const ARMOR_TYPES = {
  oldarmor: {
    id: 'oldarmor', name: '천 옷', desc: '낡았지만 아직 입을 만한 갑옷',
    equipType: 'armor',
    armorKind: 'armor', // 갑옷
    grade: 'normal', // 일반
    defense: -1,
    purchasable: true, sellPrice: 100, levelReq: 1,
    image: '',
  },
  oldhelmet: {
    id: 'oldhelmet', name: '천 모자', desc: '기본적인 방호력은 유지하고 있다',
    equipType: 'armor',
    armorKind: 'helmet', // 투구
    grade: 'normal', // 일반
    defense: -1,
    purchasable: true, sellPrice: 100, levelReq: 1,
    image: '',
  },
  // 원본 문서엔 방어도가 양수(3/1/5/2)로 적혀있었으나, 기존 방어구 데이터는 전부 음수 값만
  // 사용하는 규칙(defenseFor 공식이 음수를 전제로 함, 같은 요청에 포함된 신규 장신구 3종의
  // 방어도는 이미 음수(-2,-2,-1)로 정확히 적혀있었음)이라 부호를 반전해 반영함(응답 참고, 확인 필요).
  linenarmor: {
    id: 'linenarmor', name: '리넨 옷', desc: '가볍고 편안해 초보 모험가에게 적합한 기본 갑옷',
    equipType: 'armor',
    armorKind: 'armor', // 갑옷
    grade: 'rare', // 레어
    defense: -3, hp: 100,
    purchasable: true, sellPrice: 400, levelReq: 8,
    image: 'armorbase',
  },
  linenhelmet: {
    id: 'linenhelmet', name: '리넨 모자', desc: '볍고 편안하게 머리를 보호하는 초보자용 모자',
    equipType: 'armor',
    armorKind: 'helmet', // 투구
    grade: 'rare', // 레어
    defense: -1, hp: 50,
    purchasable: true, sellPrice: 400, levelReq: 8,
    image: 'helmetbase',
  },
  leatherarmor: {
    id: 'leatherarmor', name: '가죽 옷', desc: '가볍고 질긴 가죽으로 만들어진 갑옷',
    equipType: 'armor',
    armorKind: 'armor', // 갑옷
    grade: 'normal', // 일반
    defense: -5, hp: 100,
    purchasable: true, sellPrice: 500, levelReq: 10,
    image: 'armorbase',
  },
  leatherhelmet: {
    id: 'leatherhelmet', name: '가죽 모자', desc: '질긴 가죽으로 머리를 보호하는 모자',
    equipType: 'armor',
    armorKind: 'helmet', // 투구
    grade: 'normal', // 일반
    defense: -2, hp: 30,
    purchasable: true, sellPrice: 500, levelReq: 10,
    image: 'helmetbase',
  },
};

// ---- 방어구 강화 단계별 체력/마나 증가 공식 ----
// +N 체력(또는 마나) = 기본값 + (기본값 × 강화 단계 × 이 배율). 항상 +0(기본) 값을 기준으로 직접 계산하며
// (재귀 아님, 이전 강화 단계는 참조하지 않음), 계산 과정에서는 반올림하지 않고 최종 결과만 반올림함.
// index = 강화 단계(1~9)
const ARMOR_VITAL_STEP_MULT = [null, 0.10, 0.10, 0.10, 0.10, 0.10, 0.10, 0.15, 0.15, 0.20]; // 장신구도 동일 공식을 재사용(computeArmorVitalArray)
function computeArmorVitalArray(base){
  if(base == null) return null;
  const arr = [base];
  for(let lv = 1; lv <= 9; lv++){
    arr.push(Math.round(base + (base * lv * ARMOR_VITAL_STEP_MULT[lv])));
  }
  return arr;
}

// ---- 방어구 강화 단계별 방어도 증가 공식 ----
// 재귀 방식: +N 방어도 = +(N-1) 방어도 + 해당 강화 단계 증가치. index = 강화 단계(1~9)
const ARMOR_DEFENSE_STEP_DELTA = [null, 0, -1, 0, -1, 0, -1, -1, -1, -2];
function computeArmorDefenseArray(baseDefense){
  if(baseDefense == null) return null;
  const arr = [baseDefense];
  for(let lv = 1; lv <= 9; lv++){
    arr.push(arr[lv - 1] + (ARMOR_DEFENSE_STEP_DELTA[lv] || 0));
  }
  return arr;
}

// 방어도/체력/마나 강화 배열은 여기서 바로 채움(다른 데이터 테이블에 의존하지 않는 자체 계산).
// 강화 비용/확률/판매가("장비 전역 설정")는 computeGradeCost 등 관련 함수/상수가 이 파일 아래쪽에
// 정의되므로, 그 정의 이후(무기 판매가 공식 연결부 바로 다음)에서 이어서 연결함 — 3단계 참고.
Object.values(ARMOR_TYPES).forEach(a => {
  if(a.defense != null) a.defArr = computeArmorDefenseArray(a.defense);
  if(a.hp != null) a.hpArr = computeArmorVitalArray(a.hp);
  if(a.mana != null) a.manaArr = computeArmorVitalArray(a.mana);
});

// ---- 장신구 종류(현재는 반지만 사용) ----
const ACCESSORY_KINDS = { ring: '반지' };
// 장신구 이미지 경로 규칙(무기/방어구와 동일한 onerror 방식). image 필드가 비어 있으면 장신구 종류별
// 기본 이미지(반지→ringbase)를 자동 적용함(장신구 데이터 스키마 규칙). 종류가 늘어나도(목걸이 등)
// 이 표에 항목만 추가하면 자동 적용됨.
const ACCESSORY_IMAGE_DIR = 'assets/accessory/';
const ACCESSORY_IMAGE_EXT = '.png';
const ACCESSORY_DEFAULT_IMAGE = { ring: 'ringbase' };

// 장신구 도감. 무기/방어구와 동일한 데이터 구조를 그대로 사용함. 레벨 제한은 레벨만 검사(힘/민첩 등
// 추가 조건 없음). 반지는 같은 아이템이라도 2개까지 동시 착용 가능(장신구1/장신구2 슬롯) — 방어구처럼
// 종류당 1개로 제한하지 않음(state.equippedAccessories, actions.js 참고).
// ---- 항목 설명 ----
// accessoryKind: 장신구 종류('ring') / defense: 기본 방어도(강화되지 않고 항상 이 값 그대로 유지 —
// "장신구 강화 대상 옵션"에서 방어도 제외) / hp,mana: 방어구와 동일한 공식으로 강화 / crit: 기본
// 치명타 확률(강화 시 합연산으로 증가) — defense/hp/mana/crit는 공란(undefined)이면 옵션 없음으로 간주.
const ACCESSORY_TYPES = {
  colorlessring: {
    id: 'colorlessring', name: '무색 반지', desc: '희미한 마나가 서려있는 반지',
    equipType: 'accessory',
    accessoryKind: 'ring',
    grade: 'normal', // 일반
    defense: -1,
    mana: 50,
    purchasable: true, sellPrice: 500, levelReq: 5,
    image: '',
  },
  agilityring: {
    id: 'agilityring', name: '민첩의 반지', desc: '몸을 가볍게 하여 움직임을 돕는 반지',
    equipType: 'accessory',
    accessoryKind: 'ring',
    grade: 'rare', // 레어
    defense: -2, hp: 30, mana: 30,
    purchasable: true, sellPrice: 1400, levelReq: 15,
    image: '',
  },
  strengthring: {
    id: 'strengthring', name: '힘의 반지', desc: '미약한 힘이 깃드는 반지',
    equipType: 'accessory',
    accessoryKind: 'ring',
    grade: 'rare', // 레어
    defense: -2, hp: 100,
    purchasable: true, sellPrice: 1400, levelReq: 15,
    image: '',
  },
  wisdomring: {
    id: 'wisdomring', name: '지혜의 반지', desc: '정신을 맑게 하고 지혜를 더하는 반지',
    equipType: 'accessory',
    accessoryKind: 'ring',
    grade: 'rare', // 레어
    defense: -1, mana: 100,
    purchasable: true, sellPrice: 1400, levelReq: 15,
    image: '',
  },
};

// ---- 장신구 강화 단계별 치명타 확률 증가 공식 ----
// 합연산 방식: 각 단계의 증가값을 그때그때 누적해서 더함(방어도처럼 이전 단계를 그대로 이어받는 재귀와
// 결과적으로 같은 누적 형태지만, 의미상 "합연산"임을 명확히 하기 위해 별도 표로 관리). index = 강화 단계(1~9)
const ACCESSORY_CRIT_STEP_DELTA = [null, 0, 0, 2, 0, 2, 0, 2, 1, 2];
function computeAccessoryCritArray(baseCrit){
  if(baseCrit == null) return null;
  const arr = [baseCrit];
  for(let lv = 1; lv <= 9; lv++){
    arr.push(arr[lv - 1] + (ACCESSORY_CRIT_STEP_DELTA[lv] || 0));
  }
  return arr;
}

// 방어도/체력/마나/치명타 강화 배열 계산. 방어도는 "강화 대상에서 제외"되므로 배열 전체를 기본값으로
// 채워(defenseFor(type, level)이 어떤 강화 단계를 물어봐도 항상 기본값을 반환하게) 강화되지 않게 함 —
// defenseFor 등 기존 접근자 함수(formulas.js)를 그대로 재사용하기 위한 방식(별도 함수를 만들지 않음).
// 체력/마나는 방어구와 완전히 동일한 공식(computeArmorVitalArray)을 그대로 재사용함.
Object.values(ACCESSORY_TYPES).forEach(a => {
  if(a.defense != null) a.defArr = new Array(10).fill(a.defense);
  if(a.hp != null) a.hpArr = computeArmorVitalArray(a.hp);
  if(a.mana != null) a.manaArr = computeArmorVitalArray(a.mana);
  if(a.crit != null) a.crit = computeAccessoryCritArray(a.crit); // crit 필드를 배열로 덮어씀(critChanceFor가 wpn(type).crit[level]로 읽음)
});

// ---- 대장간 "강화 장비 선택" 팝업이 훑는 장비 보유 풀 목록 ----
// 각 항목은 { kind, items(): 보유 아이템 배열을 반환하는 함수, typesTable: 도감(공격력/등급 등 정의),
// meetsReq(type): 착용 가능 여부 판정 함수 }. formulas.js의 forgeSelectableItems()가 이 배열을 순회해서
// "소유 + 착용 가능 + 강화 가능" 세 조건을 모두 만족하는 장비만 추려 하나의 목록으로 합침.
// 무기/방어구/장신구 모두 이 풀에 포함됨(사용자 요청: 강화 화면에서 강화 가능한 모든 장비를 선택해서 사용) —
// 강화 화면(render() 상단)은 buildForgeStatRowsHtml로 데이터에 있는 옵션만 동적으로 표시하므로 장비
// 종류를 가리지 않음. 단, 방어구를 여기서 "선택"(state.forgeTargetId)해도 실제 착용 무기(state.
// equippedId)나 방어구 착용 상태(state.equippedArmor)는 바뀌지 않음 — 그건 별도의 착용 시스템이 담당.
const EQUIP_INVENTORY_POOLS = [
  {
    kind: 'weapon',
    items: () => state.inventory,
    typesTable: WEAPON_TYPES,
    meetsReq: type => meetsWeaponEquipRequirements(type, state.playerLevel, state.stats),
  },
  {
    kind: 'armor',
    items: () => state.armorInventory || [],
    typesTable: ARMOR_TYPES,
    meetsReq: type => meetsWeaponEquipRequirements(type, state.playerLevel, state.stats),
  },
  {
    kind: 'accessory',
    items: () => state.accessoryInventory || [],
    typesTable: ACCESSORY_TYPES,
    meetsReq: type => meetsWeaponEquipRequirements(type, state.playerLevel, state.stats),
  },
];

// ============================================================
// 강화 단계별 공격력/공격속도/치명타 계산 공식
// 일반/레어/에픽 등급에 적용됨. 유니크 등급은 이 공식을 쓰지 않고 무기마다 고유 값을 직접 넣을 예정이라 대상에서 제외.
// 필요한 보정값이 아직 없는 무기 종류(예: 지팡이, 구상 중)도 자동으로 제외되고 기존 값이 그대로 유지됨.
// ============================================================

// 1. 강화 단계별 공격력 배율 (index = 강화단계, [0]은 사용 안 함)
// 신규 공식: 무기 +N 공격력 = 기본 공격력 + (기본 공격력 × 강화 단계 × 이 배율). 재귀식이 아니라
// 항상 +0 기본 공격력만을 기준으로 직접 계산하며, 무기 종류/등급 보정은 이 공식에서 완전히 제외됨.
const ENHANCE_ATK_LEVEL_MULT = [null, 1.5, 1.5, 1.5, 1.5, 1.55, 1.5, 1.6, 1.6, 1.65];

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

// 무기 하나의 +0~+9 공격력/공격속도/치명타 배열을 공식대로 계산.
// 유니크 등급은 이 공식을 쓰지 않고 무기마다 고유 값을 직접 넣을 예정이라 대상에서 제외(공격력 계산 자체와 무관하게 유지).
// 필요한 보정값이 없으면(아직 정의되지 않은 무기 종류) null을 반환 — 그 경우 기존 값을 그대로 둠.
function computeWeaponLevelStats(w){
  if(w.grade === 'unique') return null;
  const atkSpeedSteps = WEAPON_KIND_ATKSPEED_STEP[w.weaponKind];
  const critSteps = WEAPON_KIND_CRIT_STEP[w.weaponKind];
  if(atkSpeedSteps == null || critSteps == null) return null;

  const base = w.attackPower;
  const atk = [base];
  const speed = [w.attackSpeed];
  const crit = [w.critRate];
  for(let lv = 1; lv <= 9; lv++){
    const stepMult = ENHANCE_ATK_LEVEL_MULT[lv];
    // 신규 공식: 무기 +N 공격력 = 기본 공격력 + (기본 공격력 × 강화 단계 × 단계 배율).
    // 항상 +0 기본 공격력(base)만을 기준으로 직접 계산하며(이전 단계 값 미참조), 최종 결과만 반올림함.
    atk.push(Math.round(base + (base * lv * stepMult)));
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
  [90, 10, 0, 0], [85, 15, 0, 0], [75, 25, 0, 0], [60, 20, 20, 0], [50, 20, 30, 0],
  [40, 20, 40, 0], [30, 20, 48, 2], [20, 10, 60, 10], [15, 10, 60, 15],
];
const GRADE_ENHANCE_ODDS_UNIQUE = [
  [80, 20, 0, 0], [75, 25, 0, 0], [65, 35, 0, 0], [55, 20, 25, 0], [45, 20, 35, 0],
  [35, 20, 45, 0], [25, 20, 51, 4], [15, 10, 65, 10], [5, 5, 70, 20],
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
const ENHANCE_SELL_STEP_MULT = [null, 1.05, 1.05, 1.05, 1.05, 1.05, 1.05, 1.05, 1.08, 1.10];

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

// ============================================================
// ARMOR_TYPES에 "장비 전역 설정"(강화 비용/확률/판매가) 연결. 무기와 완전히 동일한 등급 기반 공식을
// 그대로 재사용함 — computeGradeCost/resolveGradeOdds/computeWeaponSellPrices는 원래부터 무기 전용
// 필드를 참조하지 않는 범용 함수(등급/아이템 레벨/cost·odds·sellPrice만 사용)라 그대로 호출 가능함.
// ============================================================
Object.values(ARMOR_TYPES).forEach(a => {
  const gradeOdds = resolveGradeOdds(a.grade);
  const gradeCost = computeGradeCost(a.levelReq || 1, a.grade);
  if(gradeOdds) a.odds = gradeOdds;
  if(gradeCost) a.cost = gradeCost;
});
Object.values(ARMOR_TYPES).forEach(a => {
  const sell = computeWeaponSellPrices(a);
  if(sell) a.sell = sell;
});

// ============================================================
// ACCESSORY_TYPES에 "장비 전역 설정" 연결 — 무기/방어구와 동일한 등급 기반 공식을 그대로 재사용하되,
// "장신구 강화 비용 보정"(문서 7번) 요구사항에 따라 계산된 강화 비용 배열에 최종적으로 1.3배를 적용함.
// 이 보정은 각 단계의 비용에 독립적으로(이전 단계의 보정된 값을 다시 사용하지 않고) 적용되므로,
// computeGradeCost가 반환한 원래 배열을 그대로 각 원소별로 1.3배 해서 덮어쓰는 방식으로 구현함.
// 기대비용(computeAverageExpectedCosts)과 판매가(computeWeaponSellPrices)는 이 보정된 cost 배열을
// 그대로 입력받아 계산하는 기존 범용 함수라, 별도 처리 없이 "보정된 강화 비용 기준"이 자동으로 적용됨.
// ============================================================
Object.values(ACCESSORY_TYPES).forEach(a => {
  const gradeOdds = resolveGradeOdds(a.grade);
  const gradeCost = computeGradeCost(a.levelReq || 1, a.grade);
  if(gradeOdds) a.odds = gradeOdds;
  if(gradeCost) a.cost = gradeCost.map(c => Math.round(c * 1.3)); // 장신구 강화 비용 보정(×1.3, 단계별 독립 적용)
});
Object.values(ACCESSORY_TYPES).forEach(a => {
  const sell = computeWeaponSellPrices(a);
  if(sell) a.sell = sell;
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

// 획득 가능한 아티팩트(장비) 도감
const ARTIFACT_SLOT_MAX = 3;
const ACCESSORY_SLOT_MAX = 2; // 장신구1/장신구2 — 반지는 같은 아이템을 2개까지 동시 착용 가능(장신구 데이터 스키마 규칙)
// ---- 항목 설명 ----
// desc: 장비 설명 / equipType: 장비 타입(EQUIPMENT_TYPES 참고, 항상 'artifact') / grade: 아티팩트 등급(WEAPON_GRADES와 동일한 키 체계 재사용) /
// effect: 장착 효과(장착 시 실제로 적용되는 효과 — 게임 로직 설명용) / effectText: 효과 설명(아이템 툴팁에 "효과"로 표시되는 문구) /
// buyPrice: 상점 구매 가격(비어있으면=null, 상점 구매 불가 + 상점 목록에서 제외됨) / icon: 아티팩트 아이콘
// (이모지) / image: 선택 필드. PNG 이미지 파일명(확장자/경로 제외, assets/MiscItems/<image>.png)을 등록하면
// icon 대신 PNG가 출력됨(itemIconHtml, formulas.js). 등록하지 않으면 기존처럼 icon이 그대로 출력됨.
const ARTIFACTS = {
  ring: {
    id: 'ring', name: '아주르의 강아지풀 반지', icon: '🌾',
    desc: '마법사 아주르가 마력을 불어넣어 만든 반지',
    equipType: 'artifact',
    grade: 'normal',
    effect: '최대 마나 +500',
    effectText: '최대 마나 +500',
    buyPrice: 10000,
  },
  batwing: {
    id: 'batwing', name: '박쥐 날개', icon: '🦇',
    desc: '흡혈 박쥐의 날개로 만든 견갑',
    equipType: 'artifact',
    grade: 'epic',
    effect: '공격 속도 5% 증가',
    effectText: '공격 속도 +5%',
    buyPrice: null,
  },
  poisonflask: {
    id: 'poisonflask', name: '독 플라스크', icon: '🍾',
    desc: '방울뱀의 극독이 담긴 플라스크',
    equipType: 'artifact',
    grade: 'rare',
    // 플레이어의 직접 공격으로 몬스터에게 피해를 입힐 때마다 5% 확률로 그 몬스터에게 중독(STATUS_EFFECTS.poison)을
    // 부여함(dungeon.js attackTick에서 판정). 중독의 지속 피해 자체는 이 발동 조건에 포함되지 않음(플레이어의
    // 직접 공격 피해만 인정 — 상태이상 틱 데미지는 startStatusTicker의 별도 경로라 자동으로 제외됨).
    effect: '몬스터에게 피해를 입힐 시, 피해를 입힌 몬스터에게 5%확률로 상태이상 "중독"을 부여한다.',
    effectText: '공격 적중 시 5% 확률로 중독',
    buyPrice: null,
  },
  antlerflag: {
    id: 'antlerflag', name: '사슴 뿔 깃발', icon: '🏴',
    desc: '사슴의 뿔로 장식한 깃발',
    equipType: 'artifact',
    grade: 'normal',
    // 힘 +2는 다른 힘 스탯과 동일하게 공격력/최대체력 공식에 그대로 반영되고(formulas.js의
    // artifactStatBonus 경유), 최대 체력 +500은 그와 별개로 effectiveMaxHp에 고정값으로 더해짐.
    effect: '힘+2<br>최대 체력 +500',
    effectText: '힘+2<br>최대 체력 +500',
    buyPrice: null,
  },
  oldarmguard: {
    id: 'oldarmguard', name: '낡은 팔 보호대', icon: '🛡️',
    desc: '빛바랜 보호구에 주인의 흔적이 남아 있다',
    equipType: 'artifact',
    grade: 'normal',
    // 힘/치명타 확률 모두 다른 힘·치명타 스탯과 합산 적용(힘은 artifactStatBonus 경유, 치명타는
    // effectiveCritChance 경유 — formulas.js)
    effect: '힘+3<br>치명타 확률 +3%',
    effectText: '힘 +3<br>치명타 확률 +3%',
    buyPrice: null,
  },
  blackarmguard: {
    id: 'blackarmguard', name: '흑색 팔 보호대', icon: '🛡️',
    desc: '흑곰의 질긴 가죽으로 제작한 견고한 장비',
    equipType: 'artifact',
    grade: 'epic',
    // 힘/민첩/치명타 확률 모두 합산 적용(힘·민첩은 artifactStatBonus, 치명타는 effectiveCritChance 경유)
    effect: '힘+5<br>민첩+3<br>치명타 확률 +8%',
    effectText: '힘 +5<br>민첩 +3<br>치명타 확률 +8%',
    buyPrice: null,
  },
};

// 소비 아이템(플라스크 등) 도감
const QUICK_SLOT_COUNT = 2;
// 모든 플라스크(현재 등록된 것 + 앞으로 추가될 것)에 공통으로 적용되는 사용 쿨타임(ms).
// 특정 플라스크 id를 분기하지 않고 useFlask()가 이 값을 그대로 사용하므로, 새 플라스크를
// CONSUMABLES에 추가하기만 하면 별도 코드 수정 없이 동일한 쿨타임 시스템이 적용됨.
const FLASK_COOLDOWN_MS = 2000;
// icon: 이모지 / image: 선택 필드. PNG 이미지 파일명(assets/MiscItems/<image>.png, 확장자/경로 제외)을
// 등록하면 icon 대신 PNG가 출력됨(itemIconHtml, formulas.js). 등록하지 않으면 기존처럼 icon이 출력됨.
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
// grade: 마석류 아이템의 등급(WEAPON_GRADES와 동일한 키 체계를 공유 — 이름 색상 공식도 그대로 재사용). 기타(misc) 아이템은 등급이 없음.
const ITEM_CLASS_LABELS = { stone: '마석', misc: '기타' };
// icon: 이모지 / image: 선택 필드. PNG 이미지 파일명(assets/MiscItems/<image>.png, 확장자/경로 제외)을
// 등록하면 icon 대신 PNG가 출력됨(itemIconHtml, formulas.js). 등록하지 않으면 기존처럼 icon이 출력됨.
// grade: itemClass가 'misc'인 항목에 한해 등급(WEAPON_GRADES와 동일한 키 체계 재사용, 이름 색상 공식도
// stoneNameColor와 동일한 방식으로 재사용됨 — miscNameColor, formulas.js). stone류는 기존처럼 grade가
// 곧 마석 종류 자체를 나타내므로 이 필드의 의미가 다름(둘 다 itemClass로 이미 명확히 구분되어 섞이지 않음).
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
  acorn: {
    id: 'acorn', name: '도토리', icon: '🌰', itemClass: 'misc', grade: 'normal',
    desc: '다람쥐의 먹이',
    sellPrice: 5, stateKey: 'acorns',
  },
  ratMeat: {
    id: 'ratMeat', name: '쥐고기', icon: '🍖', itemClass: 'misc', grade: 'normal',
    desc: '쥐의 고기',
    sellPrice: 10, stateKey: 'ratMeats',
  },
  batMeat: {
    id: 'batMeat', name: '박쥐고기', icon: '🍖', itemClass: 'misc', grade: 'normal',
    desc: '박쥐의 고기',
    sellPrice: 100, stateKey: 'batMeats',
  },
  snakeMeat: {
    id: 'snakeMeat', name: '뱀고기', icon: '🍖', itemClass: 'misc', grade: 'normal',
    desc: '뱀의 고기',
    sellPrice: 15, stateKey: 'snakeMeats',
  },
  deerMeat: {
    id: 'deerMeat', name: '사슴고기', icon: '🍖', itemClass: 'misc', grade: 'normal',
    desc: '사슴의 고기',
    sellPrice: 20, stateKey: 'deerMeats',
  },
  deerAntler: {
    id: 'deerAntler', name: '녹용', icon: '🦴', itemClass: 'misc', grade: 'rare',
    desc: '약재로 사용되는 귀한 재료',
    sellPrice: 200, stateKey: 'deerAntlers',
  },
  bearHide: {
    id: 'bearHide', name: '곰 가죽', icon: '🍖', itemClass: 'misc', grade: 'normal',
    desc: '곰의 가죽',
    sellPrice: 50, stateKey: 'bearHides',
  },
  bearBile: {
    id: 'bearBile', name: '웅담', icon: '🍖', itemClass: 'misc', grade: 'rare',
    desc: '곰의 강인한 생명력이 깃든 귀한 약재',
    sellPrice: 400, stateKey: 'bearBiles',
  },
  mountainBoarMeat: {
    id: 'mountainBoarMeat', name: '산돼지고기', icon: '🍖', itemClass: 'misc', grade: 'rare',
    desc: '비싼 값에 팔리는 산돼지의 고기',
    sellPrice: 200, stateKey: 'mountainBoarMeats',
  },
  forestBoarMeat: {
    id: 'forestBoarMeat', name: '숲돼지고기', icon: '🍖', itemClass: 'misc', grade: 'rare',
    desc: '구하기 어려운 숲돼지의 고기',
    sellPrice: 250, stateKey: 'forestBoarMeats',
  },
  rareScrapmetal: {
    id: 'rareScrapmetal', name: '쇠조각', icon: '⚙️', image: 'rare_scrapmetal', itemClass: 'misc', grade: 'rare',
    desc: '희귀한 장비 제작에 사용된다',
    sellPrice: 400, stateKey: 'rareScrapmetals',
  },
  epicShinystone: {
    id: 'epicShinystone', name: '반짝이는 돌', icon: '💎', image: 'epic_ShinyStone', itemClass: 'misc', grade: 'epic',
    desc: '하늘에서 떨어진 돌의 일부<br>특별한 장비 제작에 사용된다',
    sellPrice: 1000, stateKey: 'epicShinystones',
  },
};

// ---- 강화 파괴 및 흔적 시스템 ----
// 강화 중 파괴 판정이 나면(기존 확률/로직은 그대로) 더 이상 +0으로 초기화하지 않고, 장비를 인벤토리에서
// 완전히 소멸시킨 뒤 아래 데이터로 파괴 보상을 판정함(무기/방어구/장신구 공통, 아티팩트는 강화 대상이
// 아니므로 제외). 실제 처리는 actions.js의 resolveEnhance 파괴 분기(processDestroyReward)가 담당함.

// 흔적 복구 비용 배율. 복구 비용 = 파괴된 장비의 기본 판매 가격(sellPrice, 강화 단계 무관) × 이 값.
const TRACE_RECOVERY_COST_MULT = 3;

// 등급별 파괴 보상 종류/확률(%). pickWeighted(formulas.js)가 그대로 쓸 수 있는 [값, 가중치] 쌍 배열이며,
// 각 등급의 가중치 합이 정확히 100이 되도록 구성함. 일반 등급은 이 테이블에 아예 없음 — processDestroyReward가
// 등급이 'normal'이면 이 테이블을 조회하지 않고 보상 판정 자체를 생략함(요구사항: 일반은 파괴 보상 없음).
const DESTROY_REWARD_ODDS = {
  rare:   [ ['trace', 50], ['scrapmetal', 50] ],
  epic:   [ ['trace', 50], ['scrapmetal', 30], ['shinystone', 20] ],
  unique: [ ['trace', 50], ['shinystone', 50] ],
};

// 쇠조각/반짝이는 돌 지급 개수 = 아래 "아이템 레벨" 구간表 개수 + "강화 단계" 구간表 개수(합산).
// min/max는 각 표가 조회하는 값의 구간(아이템 레벨표는 levelReq, 강화 단계표는 파괴 당시 강화 단계 0~8)이며,
// tierQty(formulas.js)가 위에서부터 순서대로 검사해 값이 속하는 첫 구간의 qty를 반환함.
const DESTROY_SCRAPMETAL_LEVEL_QTY = [
  { min: 1, max: 9, qty: 0 }, { min: 10, max: 19, qty: 1 }, { min: 20, max: 29, qty: 2 },
  { min: 30, max: 39, qty: 3 }, { min: 40, max: 49, qty: 4 }, { min: 50, max: 59, qty: 5 },
  { min: 60, max: 69, qty: 6 }, { min: 70, max: 79, qty: 7 }, { min: 80, max: 89, qty: 8 },
  { min: 90, max: 99, qty: 9 },
];
const DESTROY_SCRAPMETAL_ENHANCE_QTY = [
  { min: 0, max: 0, qty: 0 }, { min: 1, max: 4, qty: 1 }, { min: 5, max: 6, qty: 2 }, { min: 7, max: 8, qty: 3 },
];
const DESTROY_SHINYSTONE_LEVEL_QTY = [
  { min: 1, max: 9, qty: 0 }, { min: 10, max: 49, qty: 1 }, { min: 50, max: 89, qty: 2 }, { min: 90, max: 99, qty: 3 },
];
const DESTROY_SHINYSTONE_ENHANCE_QTY = [
  { min: 0, max: 6, qty: 0 }, { min: 7, max: 7, qty: 1 }, { min: 8, max: 8, qty: 2 },
];

// ---- 상점/인벤토리 "장비" 탭 공용 하위 분류 ----
// 무기/방어구/장신구/아티팩트 4종. 인벤토리·상점 양쪽의 "장비" 최상위 탭이 이 배열을 그대로 공유해서
// 하위탭을 만듦 — 새 장비 소분류가 필요해지면 여기에 항목만 추가하면 양쪽 화면에 자동으로 반영됨.
const EQUIP_SUB_TABS = [
  { id: 'weapon', label: '무기' },
  { id: 'armor', label: '방어구' },
  { id: 'accessory', label: '장신구' },
  { id: 'artifact', label: '아티팩트' },
];

// ---- 상점 품목 분류 탭 ----
// 새 탭이 필요해지면 이 배열에 항목만 추가하면 됨. 실제로 어떤 아이템이 어느 탭에 뜨는지는
// formulas.js의 shopEntriesForTab()이 각 도감(WEAPON_TYPES/ARMOR_TYPES/ACCESSORY_TYPES/CONSUMABLES/
// ARTIFACTS/MISC_ITEMS)의 purchasable 여부(또는 판매 전용 규칙)를 보고 자동으로 결정함 — 아이템
// 이름/ID로 분기하지 않음.
// "장비" 탭은 subTabs(EQUIP_SUB_TABS)를 갖는 최상위 탭이며, 실제 표시 대상은 항상 subTabs 중 하나
// (leaf id: weapon/armor/accessory/artifact)임. 최상위 탭 자체는 내용을 직접 표시하지 않음.
const SHOP_TABS = [
  { id: 'equipment', label: '장비', subTabs: EQUIP_SUB_TABS },
  { id: 'consumable', label: '소비' },
  { id: 'stone', label: '마석' },
  { id: 'misc', label: '기타' },
];

// ---- 인벤토리 탭 분류 ----
// 상점(SHOP_TABS)과 동일한 구조(최상위 탭 + "장비" 탭만 EQUIP_SUB_TABS를 하위탭으로 가짐)를 그대로
// 재사용. 실제 각 하위탭의 목록을 어디서 가져오는지는 render.js의 각 renderXxxList 함수가 담당.
const INVENTORY_TABS = [
  { id: 'equipment', label: '장비', subTabs: EQUIP_SUB_TABS },
  { id: 'consumable', label: '소비' },
  { id: 'stone', label: '마석' },
  { id: 'misc', label: '기타' },
];

// 상점 정렬 기준 목록 (필터 드롭다운에 그대로 표시됨)
const SHOP_SORT_FIELDS = [
  { id: 'price', label: '가격' },
  { id: 'levelReq', label: '착용 제한 레벨' },
];

// ---- 페이지네이션(공통 시스템) ----
// 화면(또는 탭)마다 페이지당 최대 출력 개수를 여기서 독립적으로 관리함 — 지금은 전부 6(던전만 3)이지만,
// 나중에 탭별로 다른 값을 쓰고 싶으면 이 숫자만 바꾸면 됨(다른 코드 수정 불필요).
// 상점은 무기/방어구/소비/아티팩트 4개 탭에만 적용하고, 마석·기타 탭은 페이지네이션을 적용하지 않음
// (그 두 탭은 이 객체에 키 자체가 없음 → renderShopTab에서 자동으로 페이지 UI 없이 전체 출력됨).
const PAGE_SIZE = {
  invWeapon: 6,        // 인벤토리 무기 탭
  invArmor: 6,          // 인벤토리 방어구 탭
  invAccessory: 6,       // 인벤토리 장신구 탭
  forgeSelect: 6,       // 대장간 "강화 장비 선택" 팝업
  shopWeapon: 6,        // 상점 무기 탭
  shopArmor: 6,          // 상점 방어구 탭
  shopAccessory: 6,      // 상점 장신구 탭
  shopConsumable: 6,     // 상점 소비 탭
  shopArtifact: 6,       // 상점 아티팩트 탭
  dungeonList: 3,        // 던전 입구
};
// 상점 탭 id → PAGE_SIZE/페이지 상태 키 매핑. 페이지네이션 미적용 탭(stone/misc)은 여기 없음.
const SHOP_PAGE_KEY = {
  weapon: 'shopWeapon', armor: 'shopArmor', accessory: 'shopAccessory', consumable: 'shopConsumable', artifact: 'shopArtifact',
};
// 캐릭터 정보창 페이지 수. 이 화면은 아이템 목록을 잘라서 보여주는 게 아니라 "1페이지(장비창+캐릭터 정보) /
// 2페이지(적용 중인 아티팩트 효과)"처럼 완전히 다른 내용을 페이지로 나눈 것이라 PAGE_SIZE(개수 기반 분할)는
// 쓰지 않지만, pageState·pagerHtml·goPage·clampPage 등 페이지 이동 시스템 자체는 그대로 재사용함.
const CHAR_STATS_PAGE_COUNT = 2;

// ---- 캐릭터 메뉴(좌측 상단바 메뉴) — 탭 구성 ----
// 데이터 기반 목록이라 새 탭을 추가하려면 이 배열에 { id, label } 항목만 추가하면 됨(renderCharacterMenu가
// 이 목록을 그대로 순회해 탭 버튼을 자동 생성함, SETTINGS_SCHEMA→renderSettings와 동일한 방식).
// 'info'(캐릭터 정보) id는 renderCharacterMenu에서 특별히 다뤄지는 값이라 이름을 바꾸면 안 됨.
const CHARACTER_TABS = [
  { id: 'info', label: '캐릭터 정보' },
  { id: 'skill', label: '스킬' },
];
// 캐릭터 메뉴 "캐릭터 정보" 탭의 페이지 수. 캐릭터 정보창(모달, CHAR_STATS_PAGE_COUNT=2, 1페이지에
// 장비창+캐릭터 정보를 좌우로 함께 배치)과 동일한 데이터를 쓰지만, 캐릭터 메뉴는 화면 폭이 좁아
// 1페이지(캐릭터 정보) / 2페이지(장비창) / 3페이지(적용 중인 아티팩트 효과)로 완전히 분리함.
const CHAR_MENU_INFO_PAGE_COUNT = 3;

// ---- 스킬 시스템 — 기반 구조 ----
// 스킬 데이터 형식(SKILLS의 각 항목). 실제 스킬은 아직 등록하지 않음(이번 작업은 기반 구조만 구현) —
// 이후 이 객체에 항목을 추가하기만 하면 캐릭터 메뉴 스킬 탭(레벨별 목록/툴팁/습득/퀵슬롯)과 전투(쿨타임/자원
// 소모/시전시간/데미지)까지 코드 수정 없이 자동으로 반영됨.
// {
//   name: '스킬 이름', desc: '스킬 설명',
//   grade: 'normal' | 'rare' | 'epic' | 'unique',           // WEAPON_GRADES와 동일한 등급 색상 체계 재사용
//   category: 'common' | 'specialized' | 'awakening',        // SKILL_CATEGORIES의 id와 일치해야 함
//   target: 'single' | 'aoe' | 'buff' | 'passive',           // 단일/광역/버프/패시브 — skillKindOf 분류에 사용
//   cooldown: 재사용 대기시간(초), resourceType: 'hp' | 'mp'(생략하면 패시브로 간주), resourceAmount: 소모량,
//   castTime: 시전 시간(초, 0=즉시), damagePercent: 총 공격력 기준 데미지 배율(%), hits: 타수,
//   icon: '아이콘 파일명(SKILL_IMAGE_DIR 기준, 확장자 제외)'. 생략 시 종류별 기본 아이콘(SKILL_DEFAULT_ICON)을 자동 적용.
//   levelReq: 습득 가능한 최소 레벨, cost: 습득에 필요한 포인트(생략 시 1),
//   passiveEffect: { hpFlat: N, ... } — 패시브 스킬을 습득만 하면 항상 적용되는 고정 보너스(학습 즉시 반영,
//     learnedPassiveSkillBonus가 이 키들을 합산함. 새 보너스 종류를 추가하려면 이 객체에 키만 추가하고
//     그 키를 참조하는 effective 공식 쪽에 더해주면 됨 — 지금은 hpFlat만 사용).
//   buffEffect: { atkFlat: N, atkSpeedPercent: N, durationMs: N } — 버프 스킬 사용 시 그 시간 동안 적용되는
//     보너스(activeSkillBuffs에 등록되고 activeBuffBonus가 합산함. hpFlat과 동일하게 키 기반이라 확장 가능 —
//     atkFlat은 effectiveAtk, atkSpeedPercent는 effectiveAtkSpeed 쪽에서 각각 더해줌).
//   hitDelayMs: 선택 필드(초 단위, castTime과 동일한 단위). hits가 2 이상인 공격 스킬에서 타수 사이에 지연을
//     두고 싶을 때만 지정(예: 이연격 — 1타 즉시 + 2타는 0.1초 뒤). 지정하면 resolveSkillEffect가
//     applyDelayedSkillHits(actions.js)로 처리를 넘기고, 지정하지 않으면 기존처럼 모든 타수가 동기적으로
//     즉시 적용됨(회귀 없음) — 새로 추가되는 다타수 스킬도 이 필드 유무로 동일하게 선택 가능.
// }
const SKILLS = {
  adventurer_will: {
    name: '모험가의 의지', desc: '[패시브] 체력 +100',
    grade: 'normal', category: 'common', target: 'passive', levelReq: 1,
    passiveEffect: { hpFlat: 100 },
  },
  slash: {
    name: '내려베기', desc: '무기를 휘둘러 130%의 데미지로 적을 공격한다.',
    grade: 'normal', category: 'common', target: 'single', levelReq: 5,
    cooldown: 6, resourceType: 'mp', resourceAmount: 30, castTime: 0,
    damagePercent: 130, hits: 1,
  },
  rage: {
    name: '분노', desc: '[버프] 5초 동안 자신의 공격력을 30 증가시킨다.',
    grade: 'normal', category: 'common', target: 'buff', levelReq: 5,
    cooldown: 10, resourceType: 'mp', resourceAmount: 50, castTime: 0.1,
    buffEffect: { atkFlat: 30, durationMs: 5000 },
  },
  double_strike: {
    name: '이연격', desc: '빠르게 무기를 휘둘러 75%의 데미지로 적을 2번 공격한다.',
    grade: 'normal', category: 'common', target: 'single', levelReq: 10,
    cooldown: 5.5, resourceType: 'mp', resourceAmount: 50, castTime: 0,
    damagePercent: 75, hits: 2, icon: 'lv10atk',
    hitDelayMs: 0.1, // 1타는 즉시, 2타는 이 시간(초) 뒤에 순차 적용(resolveSkillEffect의 hitDelayMs 분기 참고)
  },
  preemptive_strike: {
    name: '선공', desc: '[버프] 8초 동안 자신의 공격 속도를 20% 증가시킨다.',
    grade: 'rare', category: 'common', target: 'buff', levelReq: 10,
    cooldown: 15, resourceType: 'mp', resourceAmount: 70, castTime: 0.1,
    buffEffect: { atkSpeedPercent: 20, durationMs: 8000 }, icon: 'lv10buff',
  },
  guardian_will: {
    name: '수호자의 의지', desc: '[패시브] 체력 +500',
    grade: 'normal', category: 'common', target: 'passive', levelReq: 10,
    passiveEffect: { hpFlat: 500 }, icon: 'lv10passive',
  },
  cleave: {
    name: '참격 1성', desc: '140%의 데미지로 모든 적을 공격한다.',
    grade: 'rare', category: 'common', target: 'aoe', levelReq: 15,
    cooldown: 8, resourceType: 'mp', resourceAmount: 110, castTime: 0.1,
    damagePercent: 140, hits: 1,
  },
  sword_strike: {
    name: '지면 강타', desc: '120% 데미지로 적을 공격하고, 피해를 입은 적을 2초 동안 기절시킨다.',
    grade: 'rare', category: 'common', target: 'single', levelReq: 20,
    cooldown: 10, resourceType: 'mp', resourceAmount: 120, castTime: 0.2,
    damagePercent: 120, hits: 1, icon: 'lv20atk',
    onHitStatus: { key: 'stun', durationMs: 2000 }, // 적중(=피해를 입혀 대상이 생존)한 경우에만 부여, 처치시엔 부여 안 함
  },
  beast_heart: {
    name: '야수의 심장', desc: '[버프] 25초 동안 기본 공격 피해량이 25% 증가한다.',
    grade: 'normal', category: 'common', target: 'buff', levelReq: 20,
    cooldown: 60, resourceType: 'mp', resourceAmount: 200, castTime: 0, icon: 'lv20buff',
    // basicAtkDamagePercent는 effectiveAtk(스킬 데미지 계산도 함께 쓰는 함수)가 아니라 dungeon.js
    // attackTick(기본 공격)에서만 별도로 읽어서 적용함 — 스킬 데미지에는 영향을 주지 않기 위한 설계.
    buffEffect: { basicAtkDamagePercent: 25, durationMs: 25000 },
  },
  earth_vigor: {
    name: '대지의 기운', desc: '체력 500을 회복한다.',
    grade: 'rare', category: 'common', target: 'buff', levelReq: 25,
    cooldown: 20, resourceType: 'mp', resourceAmount: 300, castTime: 1.0, icon: 'lv25buff',
    healFlat: 500, // 시전 완료 시점에 체력 500 회복(최대체력 초과 회복 안 함) — actions.js resolveSkillEffect 참고
  },
};
// 스킬 등급 색상은 별도로 정의하지 않고 무기 등급 색상 시스템(WEAPON_GRADES)을 그대로 재사용함
// (일반/레어/에픽/유니크 라벨·색상이 이미 동일하므로 SKILLS[id].grade를 WEAPON_GRADES에 그대로 대입해 조회).

// 스킬 아이콘 이미지 — weaponImagePath/monsterIconHtml과 동일한 방식(디렉토리+확장자 상수, <img> 태그로 출력).
const SKILL_IMAGE_DIR = 'assets/skill/';
const SKILL_IMAGE_EXT = '.svg';
// SKILLS[id].icon이 없을 때 종류별로 자동 적용되는 기본 아이콘 파일명(요구사항 5번 표 그대로).
const SKILL_DEFAULT_ICON = { attack: 'BSatk', buff: 'BSbuff', passive: 'BSpassive' };

// 캐릭터 > 스킬 탭의 하위 탭(분류) 목록. 데이터 기반이라 새 분류가 추가되면 이 배열에 항목만 추가하면 됨
// (renderCharacterMenu의 스킬 탭 렌더링이 이 목록을 그대로 순회해 하위 탭 버튼을 자동 생성함).
const SKILL_CATEGORIES = [
  { id: 'common', label: '공용' },
  { id: 'specialized', label: '특화' },
  { id: 'awakening', label: '기연' },
];
// 스킬 탭 페이지 구성(레벨 구간). "8. 페이지" 요구사항 표를 그대로 데이터화한 것으로, 페이지네이션은
// 기존 공용 시스템(pageState/pagerHtml/goPage/clampPage)을 그대로 재사용함(개수 기반 분할이 아니라
// 레벨 구간 기준 분할이라는 점은 CHAR_STATS_PAGE_COUNT와 동일한 방식).
const SKILL_PAGES = [

  { min: 1, max: 20 },
  { min: 25, max: 45 },
  { min: 50, max: 70 },
  { min: 75, max: 95 },
  { min: 99, max: 99 },
];
// 스킬 퀵슬롯 칸 수(왼쪽 5칸). 오른쪽에는 기존 플라스크 퀵슬롯(QUICK_SLOT_COUNT)을 그대로 이어붙여 사용함.
const SKILL_QUICK_SLOT_COUNT = 5;


// ---- 캐릭터 정보창 — 장비창 슬롯 구성 (데이터 기반) ----
// renderCharStats(render.js)가 이 목록을 그대로 순회해 슬롯을 그림. 새 장비 타입(방어구 등)이 실제로
// 추가되면 이 배열에 항목만 추가하고 equippedItemForSlot(render.js)에 조회 로직 한 줄만 이어주면 되며,
// 나머지 렌더링 코드는 수정할 필요가 없음. cellClass는 장비창 그리드에서 이 슬롯이 위치할 CSS 그리드 영역.
const EQUIPMENT_SLOTS = [
  { key: 'weapon', label: '무기', cellClass: 'area-weapon' },
  { key: 'helmet', label: '투구', cellClass: 'area-helmet' },
  { key: 'armor', label: '갑옷', cellClass: 'area-armor' },
  { key: 'accessory1', label: '장신구1', cellClass: '' },
  { key: 'accessory2', label: '장신구2', cellClass: '' },
];

// ---- 상태 이상(디버프) 클래스 ----
// 앞으로 종류가 계속 추가될 예정. 새 상태 이상은 이 객체에 항목만 추가하면 됨.
// type으로 상태 이상의 처리 방식을 구분함(state.js의 applyStatusEffect/tickStatusEffects/pruneExpiredStatusEffects,
// dungeon.js의 전투 행동 가드가 이 값을 보고 분기함):
//  - 'dot' (중독): 매 틱 최대체력 비례 피해 + maxTicks로 지속시간이 고정됨(기존 로직 그대로 유지, 변경 없음)
//  - 'disable' (기절): 지속시간 동안 전투 행동(기본공격/스킬/회복 등)을 전부 정지시킴
//  - 'atkSpeedMult' (둔화): 지속시간 동안 공격속도(초당 공격 횟수) 값에 atkSpeedMultiplier를 곱해서 적용
// 'disable'/'atkSpeedMult'류는 데이터에 고정 지속시간을 두지 않음 — 상태 이상을 부여하는 스킬/아이템 등
// 호출부가 매번 durationMs(밀리초)를 넘겨서 그때그때 지속시간을 지정함(요구사항 4번).
const STATUS_EFFECTS = {
  poison: {
    id: 1,
    name: '중독',
    icon: '☠️',
    color: '#7fd67f', // 초록 계열
    type: 'dot',
    tickIntervalMs: 1000,        // 1초마다
    maxTicks: 5,                 // 최대 5초(=5틱) 지속
    damagePercentOfMaxHp: 1,     // 매 틱 최대 체력의 1% 피해
  },
  stun: {
    id: 2,
    name: '기절',
    icon: '💤',
    color: '#ff5e26',
    type: 'disable',
  },
  slow: {
    id: 3,
    name: '둔화',
    icon: '🐌',
    color: '#fff5ae',
    type: 'atkSpeedMult',
    atkSpeedMultiplier: 0.65, // 공격속도(초당 공격 횟수) x 0.65
  },
};

// 모험가의 유해(장비) 드랍 — 전역 설정값. 던전/몬스터 등급별로 따로 두지 않고 모든 몬스터가 공통으로 사용함.
// 무기뿐 아니라 방어구/장신구도 대상이며(아티팩트·기타 아이템은 제외), 판정 순서는
// [드랍 여부] → [장비 타입 선택] → [해당 타입의 등급 선택] → [레벨 선택] → [강화 단계 결정](formulas.js
// resolveWeaponRelicDrop 참고).
const RELIC_DROP_CHANCE = 8; // 몬스터 처치 시 장비 드랍 판정 확률(%)
// 드랍 판정 성공 시, 가장 먼저 획득할 장비 타입을 결정하는 확률(%, 합계 100). 새 장비 타입이 추가되면
// 이 표에 항목만 추가하면 됨.
const RELIC_EQUIP_TYPE_CHANCE = { weapon: 45, armor: 40, accessory: 15 };
// 장비 타입별 등급 선택 확률(유니크는 모든 타입에서 0%라 후보에서 제외 — pickWeighted가 가중치0 항목을
// 고르는 부동소수점 예외 상황까지 원천 차단). 장비 타입마다 완전히 독립적으로 적용됨.
const RELIC_GRADE_CHANCE = {
  weapon: { normal: 70, rare: 29, epic: 1 },
  armor: { normal: 65, rare: 27, epic: 8 },
  accessory: { normal: 75, rare: 20, epic: 5 },
};
const RELIC_LEVEL_WINDOW = 10; // 후보 아이템 레벨 하한 = max(1, 몬스터 레벨 - 이 값) — 장비 타입 공통, 로직 불변
const RELIC_LEVEL_WEIGHT_DECAY = 0.8; // 등록된 아이템 레벨이 한 단계 낮아질 때마다 가중치 ×이 값(최고 레벨 가중치는 100)
// 드랍된 장비의 강화 단계(+N) 확률. "무기"에만 사용함(기존 값 그대로 유지) — 방어구/장신구는 등급과
// 무관하게 항상 +0으로 고정 지급되므로 이 표를 참조하지 않음(resolveWeaponRelicDrop이 장비 타입에 따라
// 분기함). 지금은 별도 공식 없이 하드코딩된 확률표를 사용(추후 공식으로 교체 가능하도록 이 표만 바꾸면 됨).
const RELIC_ENHANCE_LEVEL_CHANCE = {
  normal: [[0, 20], [1, 30], [2, 30], [3, 10], [4, 10]],
  rare: [[0, 40], [1, 30], [2, 20], [3, 10]],
  epic: [[0, 100]],
  unique: [[0, 100]],
};

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
// image: 선택 필드. PNG 이미지 파일명(확장자/경로 제외, assets/monster/<image>.png)을 등록하면 icon(이모지)
// 대신 PNG가 출력됨(monsterIconHtml, formulas.js). 등록하지 않으면 기존처럼 icon이 그대로 출력됨.
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
    drops: [
      { name: '뱀고기', chance: 50 },
      { name: '독 플라스크', chance: 10, artifactId: 'poisonflask' },
      { name: '독 송곳니', chance: 10, weaponId: 'poisonfang' },
    ],
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
    drops: [
      { name: '사슴고기', chance: 50 },
      { name: '녹용', chance: 20 },
      { name: '사슴 뿔 깃발', chance: 10, artifactId: 'antlerflag' },
    ],
  },
  red_bear: {
    id: 'red_bear', name: '적웅', icon: '🐻', grade: 'normal', level: 15, image: 'bear',
    hpMult: 1.1, atkMult: 1.0, speedMult: 1.0,
    drops: [
      { name: '곰 가죽', chance: 25 },
      { name: '웅담', chance: 10 },
      { name: '낡은 팔 보호대', chance: 5, artifactId: 'oldarmguard' },
    ],
  },
  fierce_bear: {
    id: 'fierce_bear', name: '사웅', icon: '🐻', grade: 'normal', level: 15, image: 'bear',
    hpMult: 1.1, atkMult: 2.0, speedMult: 0.5,
    drops: [
      { name: '곰 가죽', chance: 30 },
      { name: '웅담', chance: 5 },
      { name: '낡은 팔 보호대', chance: 5, artifactId: 'oldarmguard' },
    ],
  },
  black_bear: {
    id: 'black_bear', name: '흑웅', icon: '🐻', grade: 'epic', level: 20, image: 'bear',
    hpMult: 1.0, atkMult: 1.2, speedMult: 1.0,
    drops: [
      { name: '곰 가죽', chance: 50 },
      { name: '웅담', chance: 20 },
      { name: '낡은 팔 보호대', chance: 20, artifactId: 'oldarmguard' },
      { name: '흑색 팔 보호대', chance: 7, artifactId: 'blackarmguard' },
      { name: '흑색 검', chance: 8, weaponId: 'blacksword' },
    ],
  },
  forest_boar: {
    id: 'forest_boar', name: '숲돼지', icon: '🐗', grade: 'normal', level: 20, image: 'boar',
    hpMult: 1.1, atkMult: 1.0, speedMult: 1.0,
    drops: [ { name: '숲돼지고기', chance: 15 } ],
  },
  mountain_boar: {
    id: 'mountain_boar', name: '산돼지', icon: '🐗', grade: 'normal', level: 20, image: 'boar',
    hpMult: 1.1, atkMult: 2.0, speedMult: 0.5,
    drops: [ { name: '산돼지고기', chance: 20 } ],
  },
  red_boar: {
    id: 'red_boar', name: '홍돼지', icon: '🐗', grade: 'epic', level: 25, image: 'redboar',
    hpMult: 1.0, atkMult: 1.1, speedMult: 1.1,
    drops: [
      { name: '숲돼지고기', chance: 25 },
      { name: '반월대도', chance: 8, weaponId: 'moongreatsword' },
    ],
  },
};


// 던전 테이블.
// monsters: 등장 몬스터 id 배열(그 안에서 몬스터별 등장확률/개별 레벨범위를 따로 설정하지 않음 —
//   등급별 등장확률은 STAGE_GRADE_CHANCE(전역, 스테이지 번호 기준)를 따르고, 레벨은 아래 levelRange로 결정됨).
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
  {
    id: 'bear_den',
    name: '곰 굴',
    icon: '',
    desc: '곰들의 울음소리가 끊이지 않는 어두운 굴. 용기 있는 자만이 발을 들일 수 있다.',
    monsters: ['red_bear', 'fierce_bear', 'black_bear'],
    levelRange: 3,
  },
  {
    id: 'boar_den',
    name: '돼지굴',
    icon: '',
    desc: '거친 숨소리와 발굽 소리가 울려 퍼지는 맷돼지들의 소굴',
    monsters: ['mountain_boar', 'forest_boar', 'red_boar'],
    levelRange: 3,
  },
];

// ============================================================
// 던전 스테이지 시스템 (11스테이지 개편)
// 몬스터와 전투 → 종료/탐험계속 반복이었던 기존 흐름을 대체함:
// 던전 입장 → 스테이지 시작 → 몬스터 처치 → 행동 선택(마을 귀환/탐험 계속) → 다음 스테이지 ... → 11스테이지(숨겨진 장소)
// 몬스터의 레벨 산출 방식(levelRange 등 기존 던전 공식)은 이 개편과 무관하게 그대로 유지됨.
// ============================================================

// 던전 내에서 출력되는 모든 팝업 메시지(스테이지 입장 안내, 몬스터 조우 안내, 몬스터 출현 토스트 등)의 공통 노출 시간
const DUNGEON_MSG_DURATION_MS = 1000;

const DUNGEON_TOTAL_STAGES = 11;     // 1~10: 전투 스테이지, 11: 숨겨진 장소(보상방)
const DUNGEON_TREASURE_STAGE = 11;

// 스테이지별 몬스터 등급 등장 확률(전역, 모든 던전 공통 적용 + 앞으로 추가되는 던전에도 자동 적용됨).
// "어떤 레벨로 등장하는지"는 기존처럼 던전의 levelRange 공식을 그대로 쓰고, 여기서는
// "일반/에픽 중 어느 등급으로 등장할지"만 스테이지 번호를 기준으로 결정함.
// (몬스터 등급 등장확률은 이제 던전 전역이 아닌 이 표로 완전히 대체됨 — 기존 던전 전역 80/20 고정값은 삭제됨)
const STAGE_GRADE_CHANCE = {
  1:  { normal: 95, epic: 5   },
  2:  { normal: 90, epic: 10  },
  3:  { normal: 90, epic: 10  },
  4:  { normal: 90, epic: 10  },
  5:  { normal: 0,  epic: 100 },
  6:  { normal: 85, epic: 15  },
  7:  { normal: 85, epic: 15  },
  8:  { normal: 85, epic: 15  },
  9:  { normal: 85, epic: 15  },
  10: { normal: 0,  epic: 100 },
};

// ---- 전투 개편: 복수 몬스터 동시 등장 ----
const MONSTER_COUNT_MAX = 3; // 전투 중 동시에 등장 가능한 최대 몬스터 수

// 전투 시작 시 동시에 등장하는 몬스터 수 확률(전역 설정, 합계 100). 언제든 쉽게 바꿀 수 있도록 별도 상수로 관리함.
const MONSTER_COUNT_CHANCE = { 1: 70, 2: 25, 3: 5 };

// 에픽 몬스터가 확정 스폰되는 스테이지(5, 10)는 예외적으로 항상 1마리만 등장함.
// 11스테이지(숨겨진 장소)는 몬스터가 아예 등장하지 않으므로 이 표와 무관함(별도 처리).
const MONSTER_COUNT_FORCED_SINGLE_STAGES = [5, 10];

// 스테이지 입장 메시지. {name}은 던전 이름으로 치환됨(1스테이지 전용).
const STAGE_ENTER_MSG = {
  first: '{name}에 발을 들입니다.',   // 1스테이지
  mid: '더 깊은 곳으로 나아갑니다.',    // 2~10스테이지
  treasure: '숨겨진 장소를 발견했습니다.', // 11스테이지(숨겨진 장소)
};

// 몬스터 조우 시 랜덤으로 출력되는 안내 문구 중 하나가 선택됨. {name}은 몬스터 이름(등급 색상 적용),
// {josa}는 몬스터 이름의 받침 유무에 따라 자동으로 붙는 조사 — josaType이 'wagwa'면 와/과, 'iga'면 이/가.
// (실제 조사 치환은 formulas.js의 pickEncounterMessage()에서 처리됨)
const MONSTER_ENCOUNTER_MSGS = [
  { text: '{name}{josa} 조우했습니다!', josaType: 'wagwa' },
  { text: '{name}{josa} 맞닥뜨렸습니다!', josaType: 'wagwa' },
  { text: '{name}{josa} 당신을 응시합니다...', josaType: 'iga' },
  { text: '{name}{josa} 달려들 준비를 합니다!', josaType: 'iga' },
];

// 마을 귀환 시(스테이지 클리어 후 행동 선택에서 "마을 귀환" 선택) 출력되는 안내 문구
const STAGE_RETURN_MSG = '지친 몸을 이끌고 마을로 귀환했습니다.';

// 몬스터 처치 연출
const MONSTER_DEAD_ANIM_MS = 400;     // 몬스터 사망(scale/rotate/fade) 애니메이션 재생 시간(css .monster-icon.dead와 동일)
const REWARD_MODAL_DELAY_MS = 500;    // 마지막 몬스터의 사망 애니메이션이 끝난 뒤 보상 창을 띄우기까지의 대기 시간

// 11스테이지(숨겨진 장소) 보물 상자 설정
const TREASURE_SHAKE_MS = 1000;       // 상자 클릭 후 흔들림 애니메이션 시간
const TREASURE_GOLD_MULT = 5;         // 골드 보상 = 던전 최소 레벨 몬스터의 고정 골드 × 5
const TREASURE_GOLD_VARIANCE = 0.25;  // 골드 보상 랜덤 편차 ±25%(일반 몬스터 처치 시의 ±15%와는 다른 값)

// 모든 몬스터 공통 규칙
const MONSTER_BASE_GOLD = 100;       // 1레벨 몬스터의 기본 드랍 골드
const MONSTER_GOLD_GROWTH = 0.06;    // 레벨당 골드 가중치 (+6%)
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
