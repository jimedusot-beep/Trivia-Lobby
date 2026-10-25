/** Built-in, editor-owned dinner pack; imported privately into a user's deck on request. */
import type { InsertCard } from "@shared/schema";
export const ODD_ONE_OUT_STARTER_TITLE = "Odd One Out — Extreme Edition (20 Questions)";
const questions = [
  [
    "Gemstones",
    [
      "Ruby",
      "Spinel",
      "Sapphire",
      "Padparadscha"
    ],
    "B",
    "Ruby, sapphire, and padparadscha are varieties of corundum. Spinel is a separate mineral."
  ],
  [
    "Botany",
    [
      "Parsley",
      "Basil",
      "Oregano",
      "Mint"
    ],
    "A",
    "Basil, oregano, and mint belong to the mint family (Lamiaceae). Parsley belongs to Apiaceae."
  ],
  [
    "Astronomy",
    [
      "Mars",
      "Venus",
      "Jupiter",
      "Earth"
    ],
    "B",
    "Venus spins retrograde relative to its orbital motion. Mars, Jupiter, and Earth have prograde rotation."
  ],
  [
    "Nobel Prizes",
    [
      "Marie Curie",
      "John Bardeen",
      "Linus Pauling",
      "Albert Einstein"
    ],
    "D",
    "Curie, Bardeen, and Pauling each received two Nobel Prizes. Einstein received one."
  ],
  [
    "Olympics",
    [
      "1908",
      "1912",
      "1920",
      "1916"
    ],
    "D",
    "Summer Olympic Games took place in 1908, 1912, and 1920. The 1916 Games were canceled during World War I."
  ],
  [
    "Plant Families",
    [
      "Almond",
      "Pistachio",
      "Cashew",
      "Mango"
    ],
    "A",
    "Pistachio, cashew, and mango belong to Anacardiaceae. Almond belongs to the rose family (Rosaceae)."
  ],
  [
    "Magnetism",
    [
      "Copper",
      "Iron",
      "Cobalt",
      "Nickel"
    ],
    "A",
    "Iron, cobalt, and nickel are ferromagnetic at room temperature. Copper is not."
  ],
  [
    "Cephalopods",
    [
      "Octopus",
      "Squid",
      "Nautilus",
      "Cuttlefish"
    ],
    "C",
    "The nautilus retains a prominent external shell. Octopus, squid, and cuttlefish do not."
  ],
  [
    "Solar System",
    [
      "Titan",
      "Enceladus",
      "Mimas",
      "Europa"
    ],
    "D",
    "Titan, Enceladus, and Mimas orbit Saturn. Europa orbits Jupiter."
  ],
  [
    "Music",
    [
      "Mozart",
      "Vivaldi",
      "Handel",
      "Bach"
    ],
    "A",
    "Vivaldi, Handel, and Bach were leading Baroque composers. Mozart is associated with the Classical period."
  ],
  [
    "Geography",
    [
      "Lesotho",
      "San Marino",
      "Luxembourg",
      "Vatican City"
    ],
    "C",
    "Lesotho, San Marino, and Vatican City are surrounded by a single country. Luxembourg borders three countries."
  ],
  [
    "Orchestra",
    [
      "Violin",
      "Double bass",
      "Viola",
      "Cello"
    ],
    "B",
    "Standard double-bass tuning uses fourths; violin, viola, and cello use fifths."
  ],
  [
    "Spaceflight",
    [
      "Apollo 11",
      "Apollo 12",
      "Apollo 13",
      "Apollo 14"
    ],
    "C",
    "Apollo 11, 12, and 14 landed astronauts on the Moon. Apollo 13 returned without landing after its onboard emergency."
  ],
  [
    "Number Theory",
    [
      "3",
      "5",
      "19",
      "17"
    ],
    "C",
    "3, 5, and 17 are Fermat primes of the form 2^(2^n)+1. 19 is not a Fermat prime."
  ],
  [
    "Number Theory",
    [
      "6",
      "28",
      "496",
      "120"
    ],
    "D",
    "6, 28, and 496 are perfect numbers: their proper positive divisors sum to the number. 120 is not."
  ],
  [
    "Birds",
    [
      "Emu",
      "Penguin",
      "Cassowary",
      "Ostrich"
    ],
    "B",
    "Emus, cassowaries, and ostriches are ratites. Penguins are flightless birds from a different lineage."
  ],
  [
    "Ancient Rome",
    [
      "Julius Caesar",
      "Nero",
      "Augustus",
      "Caligula"
    ],
    "A",
    "Augustus, Nero, and Caligula were Roman emperors. Julius Caesar ruled as dictator before the imperial system."
  ],
  [
    "Films",
    [
      "Jaws",
      "E.T.",
      "Jurassic Park",
      "Back to the Future"
    ],
    "D",
    "Spielberg directed Jaws, E.T., and Jurassic Park. Robert Zemeckis directed Back to the Future."
  ],
  [
    "Ocean Liners",
    [
      "Olympic",
      "Lusitania",
      "Titanic",
      "Britannic"
    ],
    "B",
    "Olympic, Titanic, and Britannic were White Star Line's Olympic-class sister ships. Lusitania was a Cunard liner."
  ],
  [
    "Literature",
    [
      "Dracula",
      "Frankenstein",
      "The Picture of Dorian Gray",
      "Dr. Jekyll and Mr. Hyde"
    ],
    "B",
    "Mary Shelley wrote Frankenstein. Bram Stoker, Oscar Wilde, and Robert Louis Stevenson wrote the other three novels."
  ]
] as const;
export const oddOneOutStarterCards: Omit<InsertCard,"deckId">[] = questions.map(([category,choices,correctOption,explanation],index)=>({
  type:"multiple_choice" as const,front:`Odd One Out ${index+1} — ${category}: Which ONE does not belong?`,
  back:explanation,options:[...choices],correctOption,
}));
