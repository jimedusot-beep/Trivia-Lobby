// SPDX-License-Identifier: AGPL-3.0-or-later
// First-party editor UI only. Authored questions, answers and points stay literal.
import { creatorSpanish } from "./creator-copy.js";
export const showdownSpanish = Object.freeze({
  "Make a Showdown · Trivia Lobby": "Crear un duelo familiar · Trivia Lobby",
  "Your family. Your showdown.": "Tu familia. Tu duelo.",
  "Make 1–8 team boards and five lightning questions. Each board's points add up to 100. Keep a backup: your show saves on this device.": "Crea de 1 a 8 tableros por equipos y cinco preguntas relámpago. Los puntos de cada tablero suman 100. Guarda una copia: tu partida se guarda en este dispositivo.",
  "Loading your show…": "Cargando tu partida…",
  "← Pick a Game": "← Elige un juego",
  "Make a trivia quiz": "Crear un cuestionario de trivia",
  "Show title": "Título del duelo",
  "Team boards": "Tableros por equipos",
  "Add a board": "Añadir un tablero",
  "Edit the five lightning questions": "Editar las cinco preguntas relámpago",
  "Save on this device": "Guardar en este dispositivo",
  "Save & host showdown": "Guardar y crear duelo familiar",
  "Download JSON backup": "Descargar copia JSON",
  "Import a showdown or Friendly Feud JSON file": "Importar un archivo JSON de Duelo familiar o Friendly Feud",
  "Load sample show": "Cargar partida de ejemplo",
  "Sample points are curated for fun, not the results of a real survey. Use your own questions and content that you have permission to share.": "Los puntos del ejemplo se han elegido para jugar; no son resultados de una encuesta real. Usa tus propias preguntas y contenido que tengas permiso para compartir.",
  "Your show text stays in its original language. The sample questions are in English; only the editor controls change language.": "El texto de tu partida conserva su idioma original. Las preguntas de ejemplo están en inglés; solo los controles del editor cambian de idioma.",
  "Board {number}": "Tablero {number}",
  "Lightning question {number}": "Pregunta relámpago {number}",
  "Question": "Pregunta",
  "Answers and points — one answer | points per line": "Respuestas y puntos — una respuesta | puntos por línea",
  "Round multiplier": "Multiplicador de ronda",
  "Remove this board": "Eliminar este tablero",
  "Board removed. Save your show when ready.": "Tablero eliminado. Guarda tu partida cuando quieras.",
  "Could not read a saved show. The sample is ready to edit.": "No se ha podido leer la partida guardada. El ejemplo está listo para editar.",
  "Could not save this show.": "No se ha podido guardar esta partida.",
  "Show saved on this device. Download a JSON backup to keep a copy.": "Se ha guardado en este dispositivo. Descarga una copia JSON para conservarla.",
  "Replace the current editor with the sample show? Save or export your edits first.": "¿Sustituir el contenido actual del editor por la partida de ejemplo? Guarda o exporta tus cambios primero.",
  "JSON backup downloaded.": "Copia JSON descargada.",
  "Sample loaded. Save when ready.": "Ejemplo cargado. Guarda cuando quieras.",
  "Show imported. Save on this device, then host when ready.": "Partida importada. Guárdala en este dispositivo y crea la sala cuando quieras.",
  "Could not import the show.": "No se ha podido importar la partida.",
  "Ready. Edit your boards and lightning questions, then Save & host.": "Todo listo. Edita tus tableros y preguntas relámpago y elige Guardar y crear duelo familiar.",
  "Each answer needs its points after |, such as: Sandwiches | 35": "Cada respuesta necesita sus puntos después de |, por ejemplo: Bocadillos | 35",
  "Use a show file smaller than 32 KB.": "Usa un archivo de partida de 32 KB o menos.",
  "Each board needs 2–8 answers.": "Cada tablero necesita de 2 a 8 respuestas.",
  "Answer points must be 1–100.": "Los puntos de cada respuesta deben estar entre 1 y 100.",
  "Each board's answer points must add up to 100.": "Los puntos de las respuestas de cada tablero deben sumar 100.",
  "Board answers must be different.": "Las respuestas del tablero deben ser diferentes.",
  "Round multiplier must be 1–3.": "El multiplicador de ronda debe estar entre 1 y 3.",
  "Friendly Feud imports need five final_round questions.": "Los archivos de Friendly Feud necesitan cinco preguntas en final_round.",
  "Invalid game action fields.": "Los campos de la partida no son válidos.",
  "Use {min}–{max} questions.": "Usa entre {min} y {max} preguntas.",
  "Use 1–{max} readable characters.": "Usa entre 1 y {max} caracteres legibles."
});
export function showdownEditorError(message, name, locale = "en", fallback = "Could not save this show.") {
  const key = name === "QuotaExceededError" ? "Device storage is full. Export a backup and free some space."
    : name === "SecurityError" ? "Device storage is unavailable."
      : name === "SyntaxError" ? "This is not valid JSON." : message || "Could not save this show.";
  if (locale !== "es") return key;
  if (Object.hasOwn(showdownSpanish, key)) return showdownSpanish[key];
  if (Object.hasOwn(creatorSpanish, key)) return creatorSpanish[key];
  const questions = /^Use ([0-9]+)–([0-9]+) questions\.$/.exec(key);
  if (questions) return showdownSpanish["Use {min}–{max} questions."].replace("{min}",questions[1]).replace("{max}",questions[2]);
  const characters = /^Use 1–([0-9]+) readable characters\.$/.exec(key);
  if (characters) return showdownSpanish["Use 1–{max} readable characters."].replace("{max}",characters[1]);
  return showdownSpanish[fallback] || showdownSpanish["Could not save this show."];
}
