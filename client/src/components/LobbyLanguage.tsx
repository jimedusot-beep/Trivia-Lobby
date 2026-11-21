import { setLocale } from "../../../examples/party-engine/public/i18n.js";
import { useDisplayLanguage } from "@/lib/use-display-language";

export function LobbyLanguage() {
  const language = useDisplayLanguage();
  return <label className="identity-language" lang={language}>🌐 <span>Language / Idioma</span>
    <select aria-label="Language / Idioma" value={language} onChange={event => setLocale(event.target.value)}>
      <option value="en" lang="en">English</option><option value="es" lang="es">Español</option>
    </select>
  </label>;
}
