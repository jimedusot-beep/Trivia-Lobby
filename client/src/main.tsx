import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { loadLocale } from "../../examples/party-engine/public/i18n.js";

loadLocale();
createRoot(document.getElementById("root")!).render(<App />);
