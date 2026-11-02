// Self-contained, original EN/ES family game packs. No third-party game questions copied.
// This catalog deliberately does not alter existing server protocol or score authority.
const rawTopics = [["Picnic","Picnic","Sandwich|Sándwich","Blanket|Manta","Water|Agua","Fruit|Fruta","Napkins|Servilletas"],["Beach","Playa","Towel|Toalla","Sunscreen|Protector solar","Umbrella|Sombrilla","Sand|Arena","Shells|Conchas"],["School","Escuela","Pencil|Lápiz","Notebook|Cuaderno","Backpack|Mochila","Teacher|Maestro","Desk|Pupitre"],["Kitchen","Cocina","Spoon|Cuchara","Pan|Sartén","Plate|Plato","Oven|Horno","Knife|Cuchillo"],["Camping","Campamento","Tent|Tienda de campaña","Flashlight|Linterna","Sleeping bag|Saco de dormir","Campfire|Fogata","Map|Mapa"],["Garden","Jardín","Flowers|Flores","Shovel|Pala","Seeds|Semillas","Hose|Manguera","Butterflies|Mariposas"],["Birthday party","Fiesta de cumpleaños","Cake|Pastel","Balloons|Globos","Candles|Velas","Gifts|Regalos","Music|Música"],["Library","Biblioteca","Books|Libros","Shelves|Estantes","Librarian|Bibliotecario","Desk|Escritorio","Computer|Computadora"],["Road trip","Viaje por carretera","Snacks|Bocadillos","Map|Mapa","Music|Música","Water|Agua","Camera|Cámara"],["Rainy day","Día lluvioso","Umbrella|Paraguas","Raincoat|Impermeable","Boots|Botas","Puddles|Charcos","Clouds|Nubes"],["Zoo","Zoológico","Lion|León","Elephant|Elefante","Giraffe|Jirafa","Penguin|Pingüino","Monkey|Mono"],["Playground","Parque infantil","Swing|Columpio","Slide|Tobogán","Seesaw|Subibaja","Sandbox|Arenero","Bench|Banco"],["Bakery","Panadería","Bread|Pan","Cookies|Galletas","Cake|Pastel","Donuts|Donas","Muffins|Magdalenas"],["Museum","Museo","Painting|Pintura","Sculpture|Escultura","Fossil|Fósil","Map|Mapa","Exhibit|Exposición"],["Farm","Granja","Cow|Vaca","Chicken|Gallina","Tractor|Tractor","Barn|Granero","Horse|Caballo"],["Park","Parque","Trees|Árboles","Bench|Banco","Path|Sendero","Birds|Aves","Fountain|Fuente"],["Airport","Aeropuerto","Suitcase|Maleta","Passport|Pasaporte","Airplane|Avión","Ticket|Boleto","Gate|Puerta"],["Hospital","Hospital","Doctor|Médico","Nurse|Enfermero","Bed|Cama","Bandage|Vendaje","Thermometer|Termómetro"],["Concert","Concierto","Singer|Cantante","Guitar|Guitarra","Drums|Batería","Stage|Escenario","Microphone|Micrófono"],["Restaurant","Restaurante","Menu|Menú","Waiter|Mesero","Table|Mesa","Fork|Tenedor","Bill|Cuenta"],["Grocery store","Supermercado","Cart|Carrito","Apples|Manzanas","Milk|Leche","Bread|Pan","Cashier|Cajero"],["Soccer game","Partido de fútbol","Ball|Balón","Goal|Portería","Referee|Árbitro","Jersey|Camiseta","Whistle|Silbato"],["Art class","Clase de arte","Paint|Pintura","Brush|Pincel","Paper|Papel","Easel|Caballete","Crayons|Crayones"],["Space mission","Misión espacial","Rocket|Cohete","Helmet|Casco","Moon|Luna","Astronaut|Astronauta","Stars|Estrellas"],["Snowy day","Día de nieve","Snowman|Muñeco de nieve","Scarf|Bufanda","Gloves|Guantes","Sled|Trineo","Boots|Botas"]];
const scores = [35,25,20,12,8];
const finalScores = [40,30,20,10];
export const supportedLanguages = Object.freeze(["en","es"]);
export const deckThemes = Object.freeze(["everyday","places","celebrations","nature","adventure"]);
const themeOf = i => deckThemes[i % deckThemes.length];
const bilingual = (value) => { const [en,es] = value.split("|"); return {en,es}; };
export const familyBoards = Object.freeze(rawTopics.flatMap((entry,i)=>{
  const [en,es,...answers] = entry;
  const a=answers.map(bilingual);
  return [
    {id:"family-"+i+"-a",theme:themeOf(i),difficulty:"easy",
      question:{en:"Name something associated with: "+en+".",es:"Nombra algo relacionado con: "+es+"."},
      answers:a.map((label,index)=>({label,points:scores[index]}))},
    {id:"family-"+i+"-b",theme:themeOf(i),difficulty:"medium",
      question:{en:"What might you find at or near: "+en+"?",es:"¿Qué podrías encontrar en o cerca de: "+es+"?"},
      answers:[...a].reverse().map((label,index)=>({label,points:scores[index]}))}
  ];
}));
export const familyShows50 = Object.freeze(Array.from({length:50},(_,i)=>{
 const indices=[i,(i+17)%50,(i+34)%50];
 const boards=indices.map((index,j)=>({...familyBoards[index],multiplier:j+1}));
 const finals=Array.from({length:5},(_,j)=>{
   const b=familyBoards[(i+7+j*9)%50];
   return {id:b.id+"-final",question:b.question,answers:b.answers.slice(0,4).map((a,k)=>({label:a.label,points:finalScores[k]})),multiplier:1};
 });
 return {id:"family-show-"+String(i+1).padStart(2,"0"),theme:themeOf(i),difficulty:["easy","medium","hard"][i%3],title:{en:"Family Showdown #"+(i+1),es:"Duelo familiar n.º "+(i+1)},rounds:boards,final:finals};
}));
export function showForLanguage(show,locale="en"){
 if(!supportedLanguages.includes(locale)) throw new Error("Unsupported language");
 return {title:show.title[locale],rounds:show.rounds.map(b=>({question:b.question[locale],multiplier:b.multiplier,answers:b.answers.map(a=>({text:a.label[locale],points:a.points}))})),final:show.final.map(b=>({question:b.question[locale],multiplier:1,answers:b.answers.map(a=>({text:a.label[locale],points:a.points}))}))};
}
// A stable, server-owned catalog selector. No randomized clients and no private answers sent.
export function selectDeck(decks,{theme="all",difficulty="all",mode="rotate",completed=0,seed=0}={}){
 if(!["rotate","fixed","shuffle"].includes(mode)||!Number.isSafeInteger(completed)||completed<0||!Number.isSafeInteger(seed)||seed<0) throw new Error("Invalid deck selection");
 const pool=decks.filter(d=>(theme==="all"||d.theme===theme)&&(difficulty==="all"||d.difficulty===difficulty));
 if(!pool.length) throw new Error("No matching decks");
 const index=mode==="fixed"?0:mode==="shuffle"?(Math.imul((seed+completed+1),2654435761)>>>0)%pool.length:completed%pool.length;
 return pool[index];
}
