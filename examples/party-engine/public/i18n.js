// Presentation-only English/Spanish text. Authoritative actions and content IDs stay unchanged.
export const supportedLanguages = Object.freeze(["en", "es"]);
const storageKey = "party-display-language:v1";
let language = "en";
export function getLocale() { return language; }
export function loadLocale() {
  let requested;
  try { requested = new URLSearchParams(location.search).get("lang"); } catch {}
  if (!supportedLanguages.includes(requested)) {
    try { requested = localStorage.getItem(storageKey); } catch {}
  }
  language = supportedLanguages.includes(requested) ? requested : "en";
  if (typeof document !== "undefined") document.documentElement.lang = language;
  return language;
}
export function setLocale(next) {
  if (!supportedLanguages.includes(next) || next === language) return false;
  language = next;
  try { localStorage.setItem(storageKey, next); } catch {}
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
    document.dispatchEvent(new Event("party-locale-change"));
  }
  return true;
}
const spanishUI = Object.freeze({
  "🎮 Game library": "🎮 Biblioteca de juegos",
  "lobby": "sala",
  "countdown": "cuenta regresiva",
  "question": "pregunta",
  "reveal": "resultados",
  "finished": "terminada",
  "acting": "mímica",
  "playing": "jugando",
  "voting": "votación",
  "writing": "escribiendo",
  "Enter TV full screen": "Pantalla completa del TV",
  "Exit TV full screen": "Salir de pantalla completa",
  "Full screen is unavailable here. On Windows, try F11 for browser full screen.": "Pantalla completa no disponible. En Windows, prueba F11.",
  "The browser couldn't enter full screen. On Windows, try F11.": "El navegador no pudo abrir pantalla completa. En Windows, prueba F11.",
  "Solo test": "Prueba individual",
  "Join party": "Unirse",
  "Make a quiz": "Crear cuestionario",
  "My courses": "Mis cursos",
  "31 games": "31 juegos",
  "No sign-in": "Sin registro",
  "Pick a Game": "Elige un juego",
  "Browse the covers. Choose what to play. Invite everyone with a QR code.": "Explora las portadas, elige un juego e invita a todos con un código QR.",
  "Start a party": "Crear una partida",
  "Gather your crew. We’ll bring the questions.": "Reúne a tus amigos. Nosotros ponemos las preguntas.",
  "Create host screen": "Crear pantalla anfitriona",
  "Join on your phone": "Únete con tu teléfono",
  "Party code": "Código de partida",
  "Nickname": "Apodo",
  "Change room code": "Cambiar código",
  "Players & points": "Jugadores y puntos",
  "Leave this device": "Salir de este dispositivo",
  "Game mode": "Modo de juego",
  "Charades pack": "Categoría de charadas",
  "Everyday actions": "Acciones cotidianas",
  "Animals": "Animales",
  "How these games work": "Cómo funcionan estos juegos",
  "Start match": "Comenzar partida",
  "Waiting for the host to start.": "Esperando al anfitrión.",
  "Get ready!": "¡Prepárate!",
  "Answer locked.": "Respuesta confirmada.",
  "Correct (+1)": "Correcto (+1)",
  "Pass": "Pasar",
  "Next": "Siguiente",
  "Turn summary": "Resumen del turno",
  "Match complete! Equal scores share the result.": "¡Partida terminada! Los empates comparten el puesto.",
  "Return to same party": "Volver a la misma sala",
  "Connecting…": "Conectando…",
  "Connected.": "Conectado.",
  "Joining your party…": "Entrando a la partida…",
  "Sending…": "Enviando…",
  "Reconnected.": "Reconectado.",
  "Submission accepted.": "Respuesta recibida.",
  "Game info": "Información",
  "Scores": "Puntuaciones",
  "Options": "Opciones",
  "Controller options": "Opciones del control",
  "Game information": "Información del juego",
  "Back to game": "Volver al juego",
  "Leave party": "Salir de la partida",
  "← Previous": "← Anterior",
  "Next →": "Siguiente →",
  "Round complete": "Ronda terminada",
  "Match complete": "Partida terminada",
  "See round details": "Ver detalles de la ronda",
  "Your response is locked. Awaiting everyone else.": "Respuesta confirmada. Esperando a los demás.",
  "Lock answer": "Confirmar respuesta",
  "Your closest estimate (whole number)": "Tu estimación (número entero)",
  "No estimates submitted": "Sin estimaciones",
  "No points awarded": "Nadie ganó puntos",
  "Game Night Championship": "Campeonato de juegos",
  "Recent games": "Partidas recientes",
  "All games": "Todos",
  "Party & trivia": "Fiesta y trivia",
  "Racing & arcade": "Carreras y arcade",
  "Cards & dice": "Cartas y dados",
  "Board games": "Juegos de mesa",
  "Show all games": "Mostrar todos",
  "No games found. Try another search or category.": "No se encontraron juegos. Prueba otra búsqueda.",
  "CHOOSE YOUR NEXT GAME  ·  ← → BROWSE": "ELIGE TU PRÓXIMO JUEGO  ·  ← → EXPLORAR",
  "YOUR NEXT GAME": "TU PRÓXIMO JUEGO",
  "Choose this game": "Elegir juego",
  "Host this game": "Crear partida",
  "Previous game": "Juego anterior",
  "Next game": "Juego siguiente",
  "TRIVIA LOBBY · GAME LIBRARY": "TRIVIA LOBBY · BIBLIOTECA",
  "Room code and QR appear next": "Verás el código de sala y el QR",
  "Uses the current room and players": "Usa la sala y los jugadores actuales",
  "Trivia Quiz": "Trivia",
  "Charades": "Charadas",
  "Majority Rules": "Reglas de la mayoría",
  "Who's Most Likely?": "¿Quién es más probable?",
  "Closest Wins": "Gana el más cercano",
  "5 demo questions or up to 20 of your own": "5 preguntas de muestra o hasta 20 propias",
  "One acting turn per player": "Un turno de mímica por jugador",
  "5 votes": "5 votaciones",
  "5 nominations": "5 nominaciones",
  "5 estimates": "5 estimaciones",
  "Classic": "Clásico",
  "Creative": "Creativo",
  "Act it out": "Actúa",
  "Quick votes": "Votaciones rápidas",
  "Know your crew": "Conoce a tu grupo",
  "Big guesses": "Grandes estimaciones",
  "Choose the correct answer before the clock ends. Sample rounds allow 30 seconds and award 100 points; imported quizzes can set their own timers and scoring.": "Elige la respuesta correcta antes de que termine el tiempo. Las rondas de muestra duran 30 segundos y dan 100 puntos; los cuestionarios propios pueden configurar el tiempo y la puntuación.",
  "Act out the private clue, let family guess, then mark Correct or Pass before the 60-second timer ends.": "Representa la pista secreta sin hablar. Tu familia adivina; marca Correcto o Pasar antes de que terminen los 60 segundos.",
  "Pick one of two choices. The most popular choice wins 100 points for its voters; a tie rewards both sides.": "Elige entre dos opciones. La más votada da 100 puntos a quienes la eligieron; un empate recompensa a ambos grupos.",
  "Secretly nominate someone else for a funny prompt. Players who choose the top nominee score 100.": "Elige en secreto a otra persona según una pregunta divertida. Quienes elijan a la persona más nominada ganan 100 puntos.",
  "Guess a whole number. Closest valid guesses earn 100 points; the correct answer stays hidden until reveal.": "Adivina un número entero. Las respuestas válidas más cercanas ganan 100 puntos; la solución se revela al final.",
  "Survey Showdown": "Duelo de encuestas",
  "Category Clash": "Duelo de categorías",
  "5 prompts": "5 preguntas",
  "5 word rounds": "5 rondas de palabras",
  "Family favorites": "Favoritos de familia",
  "Word game": "Juego de palabras",
  "Name an answer from the host's curated survey board. The highest-ranked matches earn the most points.": "Escribe una respuesta popular de la encuesta. Las respuestas mejor clasificadas ganan más puntos. Puedes responder en inglés o español.",
  "Think of a valid word beginning with the given letter. Unique accepted answers earn extra points.": "Escribe una palabra válida que empiece con la letra indicada, en inglés o español. Las respuestas aceptadas que nadie repita ganan más puntos.",
  "actions": "acciones",
  "animals": "animales",
  "correct": "correcto",
  "pass": "pasar",
  "unanswered": "sin respuesta",
});
export function t(value) {
  return language === "es" && typeof value === "string" ? (spanishUI[value] ?? value) : value;
}
export function translateStatic(root) {
  if (!root?.querySelectorAll) return;
  for (const node of root.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
}
export function localizeGame(game) {
  if (!game || language !== "es") return game;
  return { ...game, name: t(game.name), rules: t(game.rules), rounds: t(game.rounds), tag: t(game.tag) };
}
// Other modes keep English game material until their answer validators can safely support Spanish.
export const spanishContentModes = Object.freeze(["quiz", "charades", "majority", "likely", "closest", "survey", "category"]);
const quizSpanish = Object.freeze({
  "Which shape has exactly three sides?": { original: ["Circle","Triangle","Square","Pentagon"], prompt: "¿Qué figura tiene exactamente tres lados?", choices: ["Círculo","Triángulo","Cuadrado","Pentágono"], explanation: "Un triángulo es un polígono con tres lados." },
  "Which number is a prime number?": { original: ["9","15","17","21"], prompt: "¿Cuál de estos números es primo?", choices: ["9","15","17","21"], explanation: "17 tiene exactamente dos divisores positivos: 1 y 17." },
  "What does a compass normally help you find?": { original: ["Direction","Temperature","Weight","Volume"], prompt: "¿Qué te ayuda a encontrar una brújula?", choices: ["Dirección","Temperatura","Peso","Volumen"], explanation: "Una brújula magnética indica la dirección respecto al norte magnético." },
  "Which unit measures electrical resistance?": { original: ["Metre","Second","Ohm","Litre"], prompt: "¿Qué unidad mide la resistencia eléctrica?", choices: ["Metro","Segundo","Ohmio","Litro"], explanation: "La resistencia eléctrica se mide en ohmios." },
  "How many minutes are in two hours?": { original: ["60","90","120","180"], prompt: "¿Cuántos minutos hay en dos horas?", choices: ["60","90","120","180"], explanation: "Cada hora tiene 60 minutos, así que dos horas tienen 120." },
});
const charadesSpanish = Object.freeze({
  "Brushing your teeth": "Cepillarse los dientes",
  "Flying a kite": "Volar una cometa",
  "Opening an umbrella": "Abrir un paraguas",
  "Rowing a boat": "Remar en un bote",
  "Baking a cake": "Hornear un pastel",
  "Walking a tightrope": "Caminar por una cuerda floja",
  "Planting a tree": "Plantar un árbol",
  "Looking through binoculars": "Mirar con binoculares",
  "Playing a violin": "Tocar el violín",
  "Wrapping a present": "Envolver un regalo",
  "Building a snowman": "Hacer un muñeco de nieve",
  "Climbing a ladder": "Subir una escalera",
  "Carrying a heavy suitcase": "Llevar una maleta pesada",
  "Skipping rope": "Saltar la cuerda",
  "Riding a bicycle": "Montar en bicicleta",
  "Blowing up a balloon": "Inflar un globo",
  "Penguin": "Pingüino",
  "Elephant": "Elefante",
  "Kangaroo": "Canguro",
  "Butterfly": "Mariposa",
  "Tortoise": "Tortuga",
  "Giraffe": "Jirafa",
  "Octopus": "Pulpo",
  "Rabbit": "Conejo",
  "Crocodile": "Cocodrilo",
  "Flamingo": "Flamenco",
  "Gorilla": "Gorila",
  "Owl": "Búho",
  "Crab": "Cangrejo",
  "Snake": "Serpiente",
  "Frog": "Rana",
  "Peacock": "Pavo real",
});
const majoritySpanish = Object.freeze({
  "Is a hot dog a sandwich?": { prompt: "¿Un perrito caliente es un sándwich?", original: ["Absolutely","Not a chance"], choices: ["¡Por supuesto!","¡Ni hablar!"] },
  "Would you rather travel through time or space?": { prompt: "¿Preferirías viajar por el tiempo o por el espacio?", original: ["Time","Space"], choices: ["Tiempo","Espacio"] },
  "Should pineapple go on pizza?": { prompt: "¿La piña debería ir en la pizza?", original: ["Yes","No"], choices: ["Sí","No"] },
  "Which is better for a rainy day?": { prompt: "¿Qué es mejor para un día lluvioso?", original: ["Movies","Board games"], choices: ["Películas","Juegos de mesa"] },
  "Do you prefer early mornings or late nights?": { prompt: "¿Prefieres madrugar o trasnochar?", original: ["Mornings","Nights"], choices: ["Mañanas","Noches"] },
});
const likelySpanish = Object.freeze({
  "Who is most likely to get lost using GPS?": "¿Quién es más probable que se pierda usando GPS?",
  "Who is most likely to become a famous chef?": "¿Quién es más probable que sea un chef famoso?",
  "Who is most likely to fall asleep during a movie?": "¿Quién es más probable que se duerma viendo una película?",
  "Who is most likely to win a game show?": "¿Quién es más probable que gane un concurso?",
  "Who is most likely to adopt an unusual pet?": "¿Quién es más probable que adopte una mascota inusual?",
});
const closestSpanish = Object.freeze({
  "How many keys are on a standard modern piano?": "¿Cuántas teclas tiene un piano moderno estándar?",
  "How many minutes are there in a full day?": "¿Cuántos minutos tiene un día completo?",
  "How many bones are in a typical adult human skeleton?": "¿Cuántos huesos tiene un esqueleto humano adulto típico?",
  "In what year did humans first land on the Moon?": "¿En qué año llegaron los humanos a la Luna por primera vez?",
  "How many squares are on a chessboard?": "¿Cuántas casillas tiene un tablero de ajedrez?",
});
const closestUnits = Object.freeze({ keys: "teclas", minutes: "minutos", bones: "huesos", year: "año", squares: "casillas" });

const surveyPromptsSpanish = Object.freeze({
  "Name something people might forget when going on vacation.": "Nombra algo que la gente puede olvidar al salir de vacaciones.",
  "Name something you might find in a movie theater.": "Nombra algo que puedes encontrar en un cine.",
  "Name something people put on pancakes.": "Nombra algo que se pone sobre los panqueques.",
  "Name something you bring to the beach.": "Nombra algo que llevas a la playa.",
  "Name something commonly found in a refrigerator.": "Nombra algo que suele haber en un refrigerador.",
});
const surveyAnswersSpanish = Object.freeze({
  "Passport":"Pasaporte", "Toothbrush":"Cepillo de dientes",
  "Phone charger":"Cargador de teléfono", "Tickets":"Entradas",
  "Sunscreen":"Protector solar", "Popcorn":"Palomitas",
  "Seats":"Asientos", "Screen":"Pantalla", "Soda":"Refresco",
  "Syrup":"Sirope", "Butter":"Mantequilla", "Fruit":"Fruta",
  "Chocolate":"Chocolate", "Whipped cream":"Crema batida",
  "Towel":"Toalla", "Umbrella":"Sombrilla",
  "Sunglasses":"Gafas de sol", "Water":"Agua",
  "Milk":"Leche", "Eggs":"Huevos", "Cheese":"Queso",
  "Vegetables":"Verduras", "Juice":"Jugo",
});
const categoryPromptsSpanish = Object.freeze({
  "Name a fruit starting with P.": "Escribe una fruta que empiece con P, en inglés o español.",
  "Name a animal starting with C.": "Escribe un animal que empiece con C, en inglés o español.",
  "Name an animal starting with C.": "Escribe un animal que empiece con C, en inglés o español.",
  "Name a city starting with B.": "Escribe una ciudad que empiece con B, en inglés o español.",
  "Name a food starting with S.": "Escribe una comida que empiece con S, en inglés o español.",
  "Name a country starting with M.": "Escribe un país que empiece con M, en inglés o español.",
});
const categoryExamplesSpanish = Object.freeze({
  "pineapple": "piña", "pear": "pera", "plantain": "plátano",
  "papaya": "papaya", "passion fruit": "parchita",
  "camel": "camello", "capybara": "capibara",
  "chimpanzee": "chimpancé", "crocodile": "cocodrilo",
  "berlin": "Berlín", "bogota": "Bogotá", "brussels": "Bruselas",
  "salmon": "salmón", "sandwich": "sándwich",
  "sausage": "salchicha", "soup": "sopa",
  "malaysia": "Malasia", "maldives": "Maldivas",
  "mexico": "México", "morocco": "Marruecos",
  "moldova": "Moldavia",
});

export function localizeState(state) {
  if (!state || language !== "es") return state;
  const translated = { ...state };
  if (state.mode === "quiz" && state.quizTitle === "Sample Quiz" && state.question) {
    const question = state.question, material = quizSpanish[question.prompt];
    if (material && question.choices.length === material.original.length &&
        question.choices.every((choice, index) => choice === material.original[index])) {
      translated.question = { ...question, prompt: material.prompt, choices: [...material.choices],
        ...(question.explanation ? { explanation: material.explanation } : {}) };
    }
  }
  if (state.mode === "charades" && state.charades) {
    const c = state.charades;
    translated.charades = { ...c, category: t(c.category),
      ...(c.clue ? { clue: { ...c.clue, text: charadesSpanish[c.clue.text] ?? c.clue.text } } : {}),
      ...(c.history ? { history: c.history.map(mark => ({
        ...mark, text: charadesSpanish[mark.text] ?? mark.text, result: t(mark.result),
      })) } : {}) };
  }
  if (state.social && ["majority","likely","closest"].includes(state.social.kind)) {
    const social = state.social;
    if (social.kind === "majority") {
      const material = majoritySpanish[social.prompt];
      if (material && social.choices.length === material.original.length &&
          social.choices.every((choice, index) => choice === material.original[index])) {
        translated.social = { ...social, prompt: material.prompt, choices: [...material.choices] };
      }
    } else if (social.kind === "likely") {
      translated.social = { ...social, prompt: likelySpanish[social.prompt] ?? social.prompt };
    } else {
      translated.social = { ...social, prompt: closestSpanish[social.prompt] ?? social.prompt,
        ...(social.unit ? { unit: closestUnits[social.unit] ?? social.unit } : {}) };
    }
  }
  if (state.mode === "survey" && state.social?.kind === "survey") {
    const social = state.social;
    if (Object.hasOwn(surveyPromptsSpanish, social.prompt)) {
      translated.social = {
        ...social,
        prompt: surveyPromptsSpanish[social.prompt],
        ...(social.topAnswers ? {
          topAnswers: social.topAnswers.map(answer => ({
            ...answer, text: surveyAnswersSpanish[answer.text] ?? answer.text,
          })),
        } : {}),
      };
    }
  }
  if (state.mode === "category" && state.bonus?.kind === "category") {
    const bonus = state.bonus;
    if (Object.hasOwn(categoryPromptsSpanish, bonus.prompt)) {
      translated.bonus = {
        ...bonus, prompt: categoryPromptsSpanish[bonus.prompt],
        ...(bonus.allowed ? {
          allowed: bonus.allowed.map(word => {
            const spanish = categoryExamplesSpanish[word];
            return spanish && spanish.toLocaleLowerCase() !== word.toLocaleLowerCase()
              ? word + " / " + spanish : word;
          }),
        } : {}),
      };
    }
  }
  return translated;
}
