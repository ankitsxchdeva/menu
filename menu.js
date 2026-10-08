/* ============================================================
   Guest menu: stable content (window.MENU)
   Names, descriptions and ingredient keys live here; the Google Sheet
   owns volatile availability, joined on the ingredient key strings
   below (case-sensitive, trimmed). Edited rarely, in git.
   Copy voice: lowercase everywhere (host aesthetic, AGENTS.md).
   Cocktail descriptions are just the main spirit (host decision); the
   variants line carries the detail.

   A cocktail entry is either a singleton (ingredients) or a family
   (variants). A family shows only its makeable variants and hides
   entirely when none are (sheet.js deriveMenu).
   ============================================================ */

export const MENU = {
  coffee: {
    // Grid drinks. Always in stock; meta shows under the name.
    espresso: [
      { name: "americano" },
      { name: "flat white" },
      { name: "latte", meta: "hot or iced" }
    ],
    // Standalone coffee drinks, each gated on its ingredients (mocha on the
    // chocolate syrup checkbox; chicory is always stocked, so vietnamese
    // iced coffee hangs off condensed milk).
    specials: [
      { name: "mocha", meta: "espresso / chocolate / milk, hot or iced", ingredients: ["chocolate"] },
      { name: "vietnamese iced coffee", meta: "chicory coffee / condensed milk", ingredients: ["condensed milk"] }
    ],
    // Tea: always in stock, no checkboxes.
    teas: ["white", "green", "oolong", "black", "chai"],
    // Checkbox ingredients in the sheet; unavailable ones drop off the line.
    syrups: ["vanilla", "caramel", "chocolate"],
    // Cold foams, gated on sheet keys like variants: plain and salted need
    // heavy cream (salt is always stocked — never a checkbox); vanilla also
    // needs vanilla syrup. Rendered as "cold foam on request: …" lines.
    extras: [
      { group: "cold foam", name: "plain", ingredients: ["heavy cream"] },
      { group: "cold foam", name: "salted", ingredients: ["heavy cream"] },
      { group: "cold foam", name: "vanilla", ingredients: ["heavy cream", "vanilla"] }
    ]
  },
  cocktails: [
    {
      slug: "margarita",
      name: "margarita",
      desc: "tequila",
      variants: [
        { name: "traditional", ingredients: ["tequila", "orange liqueur", "lime juice"] },
        { name: "tommy's", ingredients: ["tequila", "lime juice", "agave nectar"] },
        { name: "elderflower", ingredients: ["tequila", "elderflower liqueur", "lime juice"] },
        { name: "aperol", ingredients: ["tequila", "aperol", "grapefruit juice", "lime juice", "agave nectar"] },
        { name: "mezcal", ingredients: ["mezcal", "lime juice", "agave nectar"] }
      ]
    },
    {
      slug: "martini",
      name: "martini",
      desc: "vodka",
      variants: [
        { name: "lychee", ingredients: ["vodka", "lychee puree", "elderflower liqueur", "lemon juice", "simple syrup"] },
        { name: "mudslide", ingredients: ["vodka", "coffee liqueur", "irish cream", "cold brew", "simple syrup"] },
        { name: "espresso", ingredients: ["vodka", "coffee liqueur", "espresso", "simple syrup"] }
      ]
    },
    {
      slug: "spritz",
      name: "spritz",
      desc: "prosecco",
      variants: [
        { name: "aperol", ingredients: ["aperol", "prosecco", "soda water"] },
        { name: "hugo", ingredients: ["elderflower liqueur", "prosecco", "soda water"] }
      ]
    },
    {
      slug: "old-fashioned",
      name: "old fashioned",
      desc: "whiskey",
      variants: [
        { name: "bourbon", ingredients: ["bourbon", "simple syrup", "angostura bitters"] },
        { name: "rye", ingredients: ["rye whiskey", "simple syrup", "angostura bitters"] },
        { name: "oaxaca", ingredients: ["tequila", "mezcal", "agave nectar", "angostura bitters"] }
      ]
    },
    {
      slug: "ranch-water",
      name: "ranch water",
      desc: "tequila",
      ingredients: ["tequila", "lime juice", "topo chico"]
    },
    {
      slug: "paloma",
      name: "paloma",
      desc: "tequila",
      ingredients: ["tequila", "grapefruit juice", "lime juice", "topo chico", "agave nectar"]
    },
    {
      slug: "mexican-firing-squad",
      name: "mexican firing squad",
      desc: "tequila",
      ingredients: ["tequila", "grenadine", "lime juice", "angostura bitters"]
    },
    {
      slug: "naked-and-famous",
      name: "naked and famous",
      desc: "mezcal",
      ingredients: ["mezcal", "aperol", "yellow chartreuse", "lime juice"]
    },
    {
      slug: "paper-plane",
      name: "paper plane",
      desc: "bourbon",
      ingredients: ["bourbon", "aperol", "amaro nonino", "lemon juice"]
    },
    {
      slug: "daiquiri",
      name: "daiquiri",
      desc: "rum",
      ingredients: ["white rum", "lime juice", "simple syrup"]
    }
  ]
};

if (typeof window !== "undefined") window.MENU = MENU;
