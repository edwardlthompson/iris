import en from "./locales/en.json";

const catalogs: Record<string, Record<string, string>> = { en };

export function t(key: string, locale = "en"): string {
  return catalogs[locale]?.[key] ?? catalogs.en?.[key] ?? key;
}
