export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 6;
export const LAND_BIRDS = 4;

export const CHARACTERS = [
  { id: "lauren", name: "劳伦女士", short: "劳伦", size: 4, survival: 8, doubles: "jewels" },
  { id: "stephen", name: "斯蒂芬爵士", short: "斯蒂芬", size: 5, survival: 7, doubles: "painting" },
  { id: "captain", name: "船长", short: "船长", size: 7, survival: 5, doubles: "cash" },
  { id: "mate", name: "大副", short: "大副", size: 8, survival: 4 },
  { id: "frenchy", name: "法国佬", short: "法国佬", size: 6, survival: 6, swimmer: true },
  { id: "kid", name: "小孩", short: "小孩", size: 3, survival: 9, pickpocket: true },
];

export const characterById = Object.fromEntries(CHARACTERS.map(character => [character.id, character]));

const doubleScoreText = { cash: "现金计双倍。", jewels: "珠宝计双倍。", painting: "画作计双倍。" };

export function characterAbility(person) {
  if (person.swimmer) return "他水性很好：落水本身不会让他受伤。";
  if (person.pickpocket) return "他摸走一张暗牌时，对方不能因此开战。";
  return doubleScoreText[person.doubles] ?? "无特殊技能";
}

const WEAPONS = { oar: 1, blackjack: 2, knife: 3, hook: 4, flare: 8 };

function card(id, type, extra = {}) {
  return {
    id, type, size: WEAPONS[type] ?? 0, value: 0,
    name: extra.name, ...extra,
  };
}

function copies(type, count, extra) {
  return Array.from({ length: count }, (_, index) => card(`${type}-${index + 1}`, type, extra));
}

export const PROVISIONS = [
  ...copies("water", 16, { name: "淡水" }),
  ...copies("oar", 2, { name: "船桨" }),
  ...copies("chum", 2, { name: "鱼饵" }),
  ...copies("medical", 3, { name: "医药包" }),
  ...copies("cash", 6, { name: "现金", value: 1 }),
  card("painting-1", "painting", { name: "画作", value: 2 }),
  card("painting-2", "painting", { name: "画作", value: 3 }),
  card("painting-3", "painting", { name: "画作", value: 3 }),
  card("parasol-1", "parasol", { name: "阳伞" }),
  card("preserver-1", "preserver", { name: "救生圈" }),
  card("blackjack-1", "blackjack", { name: "短棍" }),
  card("compass-1", "compass", { name: "罗盘" }),
  card("flare-1", "flare", { name: "信号枪" }),
  card("hook-1", "hook", { name: "鱼叉" }),
  ...copies("jewels", 3, { name: "珠宝", value: 3 }),
  card("knife-1", "knife", { name: "短刀" }),
];

export const provisionById = Object.fromEntries(PROVISIONS.map(item => [item.id, item]));

const thirst = (...ids) => ids;
const except = (...ids) => ({ except: ids });

export const NAVIGATION = [
  { overboard: ["frenchy"], thirst: thirst("captain", "mate", "frenchy"), bird: 1, row: false, fight: false },
  { overboard: "all", thirst: "all", bird: 1, row: true, fight: true },
  { overboard: ["madame"], thirst: except("stephen", "madame", "lauren", "kid"), bird: 1, row: true, fight: false },
  { overboard: ["mate"], thirst: thirst("captain", "frenchy"), bird: 0, row: true, fight: true },
  { overboard: ["frenchy"], thirst: thirst("captain", "mate", "kid"), bird: 0, row: true, fight: false },
  { overboard: ["stephen"], thirst: thirst("captain", "mate", "frenchy"), bird: 0, row: true, fight: true },
  { overboard: ["kid"], thirst: thirst("captain", "mate", "frenchy", "lauren"), bird: 0, row: false, fight: true },
  { overboard: ["frenchy"], thirst: thirst("captain", "mate", "frenchy", "stephen"), bird: 0, row: true, fight: true },
  { overboard: ["frenchy"], thirst: thirst("captain", "mate", "lauren"), bird: 0, row: false, fight: true },
  { overboard: ["captain"], thirst: thirst("mate"), bird: 1, row: false, fight: true },
  { overboard: ["stephen"], thirst: thirst("captain", "stephen"), bird: 0, row: false, fight: false },
  { overboard: "none", thirst: "none", bird: 1, row: false, fight: false },
  { overboard: ["kid"], thirst: except("kid"), bird: 0, row: true, fight: false },
  { overboard: ["kid"], thirst: except("lauren"), bird: 1, row: true, fight: true },
  { overboard: "all", thirst: "all", bird: 0, row: false, fight: true },
  { overboard: ["mate"], thirst: thirst("kid"), bird: 1, row: false, fight: true },
  { overboard: ["stephen"], thirst: thirst("captain", "lauren"), bird: 0, row: false, fight: true },
  { overboard: ["captain"], thirst: thirst("stephen"), bird: 0, row: true, fight: true },
  { overboard: ["mate"], thirst: thirst("captain", "mate"), bird: 0, row: true, fight: false },
  { overboard: ["mate"], thirst: thirst("lauren"), bird: 0, row: false, fight: false },
  { overboard: ["kid"], thirst: thirst("captain", "mate", "frenchy", "kid"), bird: 0, row: false, fight: true },
  { overboard: ["lauren"], thirst: except("kid"), bird: -1, row: true, fight: false },
  { overboard: ["captain"], thirst: thirst("frenchy"), bird: 0, row: false, fight: false },
  { overboard: ["stephen"], thirst: thirst("captain", "kid"), bird: 1, row: true, fight: false },
].map((entry, index) => ({ id: `nav-${index + 1}`, ...entry }));

export const navigationById = Object.fromEntries(NAVIGATION.map(item => [item.id, item]));

export function cardInfo(id) {
  return provisionById[id] ?? null;
}

const provisionEffects = {
  water: "航海结算口渴时，弃掉这张牌，为任意一名船员抵消一次口渴伤害。",
  oar: "划船时，每用一把船桨就多抽一张航海牌。用到的船桨会亮出。",
  chum: "有人落水时可弃掉鱼饵召来鲨鱼。若落水者已经亮出鱼饵，也会触发。水里每人额外受一处伤。",
  medical: "花一次行动并弃掉这张牌，为船上任意一名还活着的伤员去掉一处伤。",
  parasol: "花一次行动撑开。之后每天可抵消自己的一次口渴，直到落水或失去阳伞。",
  preserver: "免受普通落水伤害。可抛给清醒的落水者，之后归对方。昏迷者要靠已亮出的救生圈获救。",
  compass: "负责领航时，亮出罗盘，把航海牌堆顶的一张牌加入备选。",
};

const doubleScoreOwners = { cash: "船长", painting: "斯蒂芬爵士", jewels: "劳伦女士" };

export function provisionEffect(card) {
  if (card.value) return `靠岸时，这张牌值 ${card.value} 分。${doubleScoreOwners[card.type]}持有时翻倍。`;
  if (card.type === "flare") return `打架时可弃掉这张牌，本场体型 +${card.size}。也可花一次行动发射，抽三张航海牌，只结算海鸥。`;
  const weapon = card.size ? `打架时亮出，体型 +${card.size}。` : "";
  return weapon + (provisionEffects[card.type] ?? "");
}

export function iconFor(type) {
  if (type === "water") return "water";
  if (type === "cash") return "cash";
  if (type === "jewels") return "jewels";
  if (type === "painting") return "painting";
  if (type === "oar") return "oar";
  if (type === "preserver") return "preserver";
  if (type === "compass") return "compass";
  if (type === "parasol") return "parasol";
  if (type === "medical") return "medical";
  if (type === "chum") return "chum";
  return "weapon";
}
