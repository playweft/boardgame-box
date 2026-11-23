import { MAX_PLAYERS, MIN_PLAYERS } from "./data.js";
import en from "./locales/en.js";
import zhCN from "./locales/zh-CN.js";

const browserLanguage =
  typeof window === "undefined" ? "zh-CN" : window.navigator.language;
export const locale = /^zh(?:-|$)/i.test(browserLanguage) ? "zh-CN" : "en";
const catalogs = { en, "zh-CN": zhCN };

function message(key, language) {
  const messages = Object.hasOwn(catalogs, language) ? catalogs[language] : zhCN;
  return Object.hasOwn(messages, key) ? messages[key] : key;
}

export function t(key, values = {}, language = locale) {
  return message(key, language).replace(/\{\{\s*(\w+)\s*\}\}/g, (placeholder, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}

export function tParts(key, values) {
  return message(key, locale).split(/(\{\{\s*\w+\s*\}\})/g).map((part, index) => {
    if (index % 2 === 0) return part;
    const name = part.slice(2, -2).trim();
    return Object.hasOwn(values, name) ? values[name] : part;
  });
}

export function listNames(names) {
  return names.join(locale === "zh-CN" ? "、" : ", ");
}

export function characterName(id, { short = false } = {}) {
  const fullKey = `characters.${id}.name`;
  if (!Object.hasOwn(catalogs[locale], fullKey)) return undefined;
  const shortKey = `characters.${id}.short`;
  return t(
    short && Object.hasOwn(catalogs[locale], shortKey)
      ? shortKey
      : fullKey,
  );
}

export function personName(id) {
  return id ? characterName(id, { short: true }) ?? id : "—";
}

export function characterAbility(id) {
  return t(`characters.${id}.ability`);
}

export function provisionName(type) {
  return t(`provisions.${type}.name`);
}

export function errorMessage(error, fallback = t("errors.actionFailed")) {
  const key = `errors.${error?.code}`;
  if (Object.hasOwn(catalogs[locale], key))
    return t(key, { min: MIN_PLAYERS, max: MAX_PLAYERS });
  return error?.message || fallback;
}
