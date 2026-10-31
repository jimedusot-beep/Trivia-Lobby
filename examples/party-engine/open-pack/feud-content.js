// Original family game-show bank. Curated "house answers" are not presented
// as results of any scientific survey. Every board totals 100 house points.
// New show packs rotate only between complete matches, not mid-round.
import { defaultShow } from "../public/show-format.js";

const boardRows = [
 ["Name something useful to carry on a rainy day.",["Umbrella","Raincoat","Boots","Hat","Towel"]],
 ["Name something people might see at a campsite.",["Tent","Campfire","Sleeping bag","Flashlight","Picnic table"]],
 ["Name something you might bake for a party.",["Cake","Cookies","Cupcakes","Brownies","Bread"]],
 ["Name something found in a bicycle repair kit.",["Pump","Tire patch","Wrench","Spare tube","Tire lever"]],
 ["Name something you might bring to the beach.",["Towel","Sunscreen","Water","Umbrella","Sunglasses"]],
 ["Name something people might see in a museum.",["Painting","Sculpture","Fossil","Display case","Model"]],
 ["Name something you might plant in a garden.",["Tomatoes","Flowers","Carrots","Herbs","Sunflowers"]],
 ["Name something you might put in a school lunch.",["Sandwich","Fruit","Juice","Vegetables","Yogurt"]],
 ["Name something found in a kitchen drawer.",["Spoon","Fork","Spatula","Can opener","Measuring spoon"]],
 ["Name something you might use to wrap a gift.",["Paper","Tape","Ribbon","Bag","Gift tag"]],
 ["Name something you take on a long walk.",["Water","Comfortable shoes","Map","Hat","Snack"]],
 ["Name something people do at a birthday party.",["Eat cake","Sing","Play games","Open gifts","Take pictures"]],
];
const lightningRows = [
 [
  ["Name something you use to tell time.",["Clock","Watch","Phone","Timer"]],
  ["Name a kind of weather.",["Rain","Snow","Sunshine","Wind"]],
  ["Name something that comes in pairs.",["Shoes","Socks","Gloves","Earrings"]],
  ["Name a fruit with a peel.",["Banana","Orange","Lemon","Mango"]],
  ["Name a way people travel to school.",["Bus","Car","Walk","Bicycle"]],
 ],
 [
  ["Name a type of tree.",["Oak","Pine","Maple","Birch"]],
  ["Name something you might find in a backpack.",["Notebook","Pencil","Water bottle","Lunchbox"]],
  ["Name a family activity after dinner.",["Board games","Movie","Walk","Reading"]],
  ["Name a pet commonly kept at home.",["Dog","Cat","Fish","Hamster"]],
  ["Name something used to build a sandcastle.",["Bucket","Shovel","Sand","Water"]],
 ],
 [
  ["Name a place where people might read.",["Library","Home","Park","Cafe"]],
  ["Name something you do before bedtime.",["Brush teeth","Read","Change clothes","Set alarm"]],
  ["Name a vehicle with two wheels.",["Bicycle","Motorcycle","Scooter","Moped"]],
  ["Name something found at a picnic.",["Basket","Blanket","Sandwich","Napkins"]],
  ["Name a vegetable that can be orange.",["Carrot","Pumpkin","Sweet potato","Bell pepper"]],
 ],
 [
  ["Name a creature that lives in water.",["Fish","Dolphin","Crab","Jellyfish"]],
  ["Name a sound heard in a garden.",["Birdsong","Wind","Bees","Water"]],
  ["Name something people keep on a desk.",["Computer","Pen","Notebook","Lamp"]],
  ["Name a round food.",["Pizza","Donut","Orange","Bagel"]],
  ["Name something used for a rainy-day game.",["Dice","Cards","Board","Pencil"]],
 ],
];
const points = [35,25,20,12,8], finalPoints = [40,30,20,10];
function board([question,words], multiplier) {
  return {question,answers:words.map((text,i)=>({text,points:points[i]})),multiplier};
}
function final([question,words]) {
  return {question,answers:words.map((text,i)=>({text,points:finalPoints[i]})),multiplier:1};
}
const extra = Array.from({length:4},(_,n)=>({
 title:"Family Showdown",
 rounds:boardRows.slice(n*3,n*3+3).map((item,i)=>board(item,i+1)),
 final:lightningRows[n].map(final),
}));
export const originalFeudShows = Object.freeze([defaultShow,...extra]);
// Do not turn this into alleged survey data; these scores are explicitly
// authored as casual game-night house points.
