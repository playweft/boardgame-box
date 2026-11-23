export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 6;
export const LAND_BIRDS = 4;

export const CHARACTERS = [
  { id: "lauren", size: 4, survival: 8, doubles: "jewels" },
  { id: "stephen", size: 5, survival: 7, doubles: "painting" },
  { id: "captain", size: 7, survival: 5, doubles: "cash" },
  { id: "mate", size: 8, survival: 4 },
  { id: "frenchy", size: 6, survival: 6, swimmer: true },
  { id: "kid", size: 3, survival: 9, pickpocket: true },
];

export const characterById = Object.fromEntries(
  CHARACTERS.map((character) => [character.id, character]),
);

const WEAPONS = { oar: 1, blackjack: 2, knife: 3, hook: 4, flare: 8 };

function card(id, type, value = 0) {
  return { id, type, size: WEAPONS[type] ?? 0, value };
}

function copies(type, count, value) {
  return Array.from({ length: count }, (_, index) =>
    card(`${type}-${index + 1}`, type, value),
  );
}

export const PROVISIONS = [
  ...copies("water", 16),
  ...copies("oar", 2),
  ...copies("chum", 2),
  ...copies("medical", 3),
  ...copies("cash", 6, 1),
  card("painting-1", "painting", 2),
  card("painting-2", "painting", 3),
  card("painting-3", "painting", 3),
  card("parasol-1", "parasol"),
  card("preserver-1", "preserver"),
  card("blackjack-1", "blackjack"),
  card("compass-1", "compass"),
  card("flare-1", "flare"),
  card("hook-1", "hook"),
  ...copies("jewels", 3, 3),
  card("knife-1", "knife"),
];

export const provisionById = Object.fromEntries(
  PROVISIONS.map((item) => [item.id, item]),
);

const thirst = (...ids) => ids;
const except = (...ids) => ({ except: ids });

export const NAVIGATION = [
  {
    overboard: ["frenchy"],
    thirst: thirst("captain", "mate", "frenchy"),
    bird: 1,
    row: false,
    fight: false,
  },
  { overboard: "all", thirst: "all", bird: 1, row: true, fight: true },
  {
    overboard: ["madame"],
    thirst: except("stephen", "madame", "lauren", "kid"),
    bird: 1,
    row: true,
    fight: false,
  },
  {
    overboard: ["mate"],
    thirst: thirst("captain", "frenchy"),
    bird: 0,
    row: true,
    fight: true,
  },
  {
    overboard: ["frenchy"],
    thirst: thirst("captain", "mate", "kid"),
    bird: 0,
    row: true,
    fight: false,
  },
  {
    overboard: ["stephen"],
    thirst: thirst("captain", "mate", "frenchy"),
    bird: 0,
    row: true,
    fight: true,
  },
  {
    overboard: ["kid"],
    thirst: thirst("captain", "mate", "frenchy", "lauren"),
    bird: 0,
    row: false,
    fight: true,
  },
  {
    overboard: ["frenchy"],
    thirst: thirst("captain", "mate", "frenchy", "stephen"),
    bird: 0,
    row: true,
    fight: true,
  },
  {
    overboard: ["frenchy"],
    thirst: thirst("captain", "mate", "lauren"),
    bird: 0,
    row: false,
    fight: true,
  },
  {
    overboard: ["captain"],
    thirst: thirst("mate"),
    bird: 1,
    row: false,
    fight: true,
  },
  {
    overboard: ["stephen"],
    thirst: thirst("captain", "stephen"),
    bird: 0,
    row: false,
    fight: false,
  },
  { overboard: "none", thirst: "none", bird: 1, row: false, fight: false },
  {
    overboard: ["kid"],
    thirst: except("kid"),
    bird: 0,
    row: true,
    fight: false,
  },
  {
    overboard: ["kid"],
    thirst: except("lauren"),
    bird: 1,
    row: true,
    fight: true,
  },
  { overboard: "all", thirst: "all", bird: 0, row: false, fight: true },
  {
    overboard: ["mate"],
    thirst: thirst("kid"),
    bird: 1,
    row: false,
    fight: true,
  },
  {
    overboard: ["stephen"],
    thirst: thirst("captain", "lauren"),
    bird: 0,
    row: false,
    fight: true,
  },
  {
    overboard: ["captain"],
    thirst: thirst("stephen"),
    bird: 0,
    row: true,
    fight: true,
  },
  {
    overboard: ["mate"],
    thirst: thirst("captain", "mate"),
    bird: 0,
    row: true,
    fight: false,
  },
  {
    overboard: ["mate"],
    thirst: thirst("lauren"),
    bird: 0,
    row: false,
    fight: false,
  },
  {
    overboard: ["kid"],
    thirst: thirst("captain", "mate", "frenchy", "kid"),
    bird: 0,
    row: false,
    fight: true,
  },
  {
    overboard: ["lauren"],
    thirst: except("kid"),
    bird: -1,
    row: true,
    fight: false,
  },
  {
    overboard: ["captain"],
    thirst: thirst("frenchy"),
    bird: 0,
    row: false,
    fight: false,
  },
  {
    overboard: ["stephen"],
    thirst: thirst("captain", "kid"),
    bird: 1,
    row: true,
    fight: false,
  },
].map((entry, index) => ({ id: `nav-${index + 1}`, ...entry }));

export const navigationById = Object.fromEntries(
  NAVIGATION.map((item) => [item.id, item]),
);

export function cardInfo(id) {
  return provisionById[id] ?? null;
}
