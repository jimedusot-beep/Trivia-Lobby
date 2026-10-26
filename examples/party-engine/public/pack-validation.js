// SPDX-License-Identifier: AGPL-3.0-or-later
export const fail = (message) => {
  throw new Error(message);
};
export function requireFields(value, required, optional = []) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    required.some((k) => !Object.hasOwn(value, k)) ||
    Object.keys(value).some((k) => ![...required, ...optional].includes(k))
  )
    fail("Invalid game action fields.");
}
export function readable(value, max = 80) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    fail(`Use 1–${max} readable characters.`);
  return value.trim();
}
export const integer = (value, min, max) =>
  Number.isSafeInteger(value) && value >= min && value <= max;
export const normalized = (s) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
