import { useSyncExternalStore } from "react";
import { getLocale, subscribeLocale } from "../../../examples/party-engine/public/i18n.js";

/** One browser preference for the public clubhouse and party devices. */
export function useDisplayLanguage() {
  return useSyncExternalStore(subscribeLocale, getLocale, () => "en" as const);
}
