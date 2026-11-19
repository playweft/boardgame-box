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
