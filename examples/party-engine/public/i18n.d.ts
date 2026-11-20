export type DisplayLanguage = "en" | "es";
export const supportedLanguages: readonly DisplayLanguage[];
export function getLocale(): DisplayLanguage;
export function loadLocale(): DisplayLanguage;
export function setLocale(next: string): boolean;
export function subscribeLocale(listener: () => void): () => void;
export function t(value: string): string;
