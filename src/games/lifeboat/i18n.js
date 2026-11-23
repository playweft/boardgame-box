import { MAX_PLAYERS, MIN_PLAYERS } from "./data.js";
import en from "./locales/en.js";
import zhCN from "./locales/zh-CN.js";

const browserLanguage =
  typeof window === "undefined" ? "zh-CN" : window.navigator.language;
const defaultLocale = /^zh(?:-|$)/i.test(browserLanguage) ? "zh-CN" : "en";
const catalogs = { en, "zh-CN": zhCN };

export function t(key, values = {}, locale = defaultLocale) {
  const messages = Object.hasOwn(catalogs, locale) ? catalogs[locale] : zhCN;
  if (!Object.hasOwn(messages, key)) return key;
  const message = messages[key];
  return message.replace(/\{\{\s*(\w+)\s*\}\}/g, (placeholder, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}

export function characterName(id, { short = false } = {}) {
  const fullKey = `characters.${id}.name`;
  if (!Object.hasOwn(catalogs[defaultLocale], fullKey)) return undefined;
  const shortKey = `characters.${id}.short`;
  return t(
    short && Object.hasOwn(catalogs[defaultLocale], shortKey)
      ? shortKey
      : fullKey,
  );
}

export function characterAbility(id) {
  return t(`characters.${id}.ability`);
}

export function provisionName(type) {
  return t(`provisions.${type}.name`);
}

export function errorMessage(error, fallback = t("errors.actionFailed")) {
  const key = `errors.${error?.code}`;
  if (Object.hasOwn(catalogs[defaultLocale], key))
    return t(key, { min: MIN_PLAYERS, max: MAX_PLAYERS });
  return error?.message || fallback;
}
