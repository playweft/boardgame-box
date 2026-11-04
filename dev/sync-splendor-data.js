import { readFile, writeFile } from "node:fs/promises";
import { CARDS, NOBLES } from "../src/games/splendor/data.js";

function literal(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return "{" + value.map(literal).join(",") + "}";
  return "{" + Object.entries(value).map(([key, entry]) => `${key}=${literal(entry)}`).join(",") + "}";
}
const path = new URL("../public/splendor/game.lua", import.meta.url);
const source = await readFile(path, "utf8");
const inventory = `-- BEGIN INVENTORY\nlocal CARDS = {\n${CARDS.map(card => "  " + literal(card) + ",").join("\n")}\n}\nlocal NOBLES = {\n${NOBLES.map(noble => "  " + literal(noble) + ",").join("\n")}\n}\n-- END INVENTORY`;
await writeFile(path, source.replace(/-- BEGIN INVENTORY[\s\S]*?-- END INVENTORY/, inventory));
