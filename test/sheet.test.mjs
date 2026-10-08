/* ============================================================
   Guest menu: sheet parser suite (TESTPLAN.md tests 1-6 + derivation).
   Module under test: sheet.js — parseIngredients / parseBeans THROW on
   invalid payloads (caller falls to the cache path); deriveMenu returns
   { cocktails, syrups, warnings } with exact warning string formats:
   - unknown key  -> the verbatim key
   - missing key  -> key + ": missing from sheet"
   - non-boolean  -> key + ': cell is ' + JSON.stringify(value) + ', not a checkbox'
   Fixtures are read from disk via new URL(import.meta.url) paths.
   ============================================================ */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseIngredients, parseBeans, deriveMenu } from "../sheet.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

/* ---- inline menu fixture, real menu.js shape ---- */
const INLINE_MENU = {
  coffee: {
    espresso: [{ name: "Espresso", desc: "Double shot, served straight." }],
    syrups: ["vanilla"],
  },
  cocktails: [
    {
      slug: "negroni",
      name: "Negroni",
      desc: "Gin, Campari and sweet vermouth, equal parts, stirred.",
      ingredients: ["gin", "campari", "sweet vermouth"],
    },
    {
      slug: "paper-plane",
      name: "Paper plane",
      desc: "Bourbon, Aperol, Amaro Nonino and lemon, equal parts.",
      ingredients: ["bourbon", "aperol", "amaro nonino", "lemon juice"],
    },
  ],
};

/* ---- 1. recorded REAL gviz response: wrapper stripping + schema guard ---- */
test("gviz-demo-real: parseIngredients throws on non-item/available schema", () => {
  // Real recorded Google response (Student Name | Gender | ...): valid gviz
  // wrapper, wrong column labels -> the schema check must throw.
  assert.throws(() => parseIngredients(fixture("gviz-demo-real.txt")), /unexpected ingredients schema/);
});

test("gviz-demo-real: parseBeans accepts it and returns exactly 30 beans", () => {
  // 30 rows, every col-A cell a non-empty string (verified against fixture).
  const { beans, warnings } = parseBeans(fixture("gviz-demo-real.txt"));
  assert.equal(beans.length, 30);
  assert.deepEqual(warnings, []);
});

/* ---- 2. all-true fixture: full availability map, every key, every boolean ---- */
test("all-true fixture parses to the exact full availability map", () => {
  const { availability, warnings } = parseIngredients(fixture("SYNTHETIC-ingredients-all-true.txt"));
  assert.deepEqual(availability, {
    "Aperol": true,
    "Agave": true,
    "Amaretto": true,
    "Bitters": true,
    "Coffee liqueur": true,
    "Cold brew": true,
    "Cream": true,
    "Grenadine": true,
    "Grapefruit juice": true,
    "Irish cream": true,
    "Lemon": true,
    "Lime": true,
    "Lychee": true,
    "Mezcal": true,
    "Orange liqueur": true,
    "Orange juice": true,
    "Prosecco": true,
    "Simple syrup": true,
    "Soda": true,
    "St. Germain": true,
    "Tequila": true,
    "Topo Chico": true,
    "Vodka": true,
    "Whiskey": true,
    "Yellow Chartreuse": true,
    "vanilla": true,
    "caramel": true,
    "chocolate": true,
  });
  assert.deepEqual(warnings, []);
});

/* ---- 3. aperol-false fixture: Aperol false, every other key true ---- */
test("aperol-false fixture parses to the exact full map with Aperol=false", () => {
  const { availability, warnings } = parseIngredients(fixture("SYNTHETIC-ingredients-aperol-false.txt"));
  assert.deepEqual(availability, {
    "Aperol": false,
    "Agave": true,
    "Amaretto": true,
    "Bitters": true,
    "Coffee liqueur": true,
    "Cold brew": true,
    "Cream": true,
    "Grenadine": true,
    "Grapefruit juice": true,
    "Irish cream": true,
    "Lemon": true,
    "Lime": true,
    "Lychee": true,
    "Mezcal": true,
    "Orange liqueur": true,
    "Orange juice": true,
    "Prosecco": true,
    "Simple syrup": true,
    "Soda": true,
    "St. Germain": true,
    "Tequila": true,
    "Topo Chico": true,
    "Vodka": true,
    "Whiskey": true,
    "Yellow Chartreuse": true,
    "vanilla": true,
    "caramel": true,
    "chocolate": true,
  });
  assert.deepEqual(warnings, []);
});

/* ---- 4. string "TRUE" cell coerces to true ---- */
test("string TRUE cell is available", () => {
  const { availability, warnings } = parseIngredients(fixture("SYNTHETIC-ingredients-string-true.txt"));
  assert.deepEqual(availability, { "Agave": true, "Lime": true });
  assert.deepEqual(warnings, []);
});

/* ---- 5. non-boolean cell: item unavailable AND named in warnings ---- */
test("non-boolean cell: Bitters false and warned verbatim", () => {
  const { availability, warnings } = parseIngredients(fixture("SYNTHETIC-ingredients-nonboolean.txt"));
  assert.equal(availability["Bitters"], false);
  assert.ok(
    warnings.some((w) => w.includes("Bitters")),
    "warnings must name the item verbatim, got " + JSON.stringify(warnings),
  );
  // every other cell is a native boolean -> no other warnings
  assert.equal(warnings.length, 1);
});

/* ---- 6. garbage payloads: each one throws, separately asserted ---- */
test("garbage: empty string throws", () => {
  assert.throws(() => parseIngredients(""), Error);
});

test("garbage: html page throws", () => {
  assert.throws(() => parseIngredients("<html>nope</html>"), Error);
});

test("garbage: status error payload throws", () => {
  assert.throws(
    () =>
      parseIngredients(
        '/*O_o*/\ngoogle.visualization.Query.setResponse({"version":"0.6","reqId":"0","status":"error"});',
      ),
    Error,
  );
});

test("garbage: payload with no table throws", () => {
  assert.throws(
    () => parseIngredients('/*O_o*/\ngoogle.visualization.Query.setResponse({"version":"0.6"});'),
    Error,
  );
});

test("garbage: truncated json (first 60 chars of demo fixture) throws", () => {
  const truncated = fixture("gviz-demo-real.txt").slice(0, 60);
  assert.throws(() => parseIngredients(truncated), Error);
});

/* ---- 7. derivation: aperol=false hides exactly the aperol drink ---- */
test("deriveMenu: aperol unavailable -> only negroni visible", () => {
  // "vanilla" (the inline menu's syrup) is a used ingredient key too:
  // deriveMenu joins BOTH cocktails and coffee.syrups against availability.
  const availability = {
    gin: true,
    campari: true,
    "sweet vermouth": true,
    bourbon: true,
    aperol: false,
    "amaro nonino": true,
    "lemon juice": true,
    vanilla: true,
  };
  const { cocktails, syrups, warnings } = deriveMenu(INLINE_MENU, availability);
  assert.deepEqual(
    cocktails.map((d) => d.slug),
    ["negroni"],
  );
  assert.deepEqual(warnings, []);
  assert.deepEqual(syrups, ["vanilla"]);
});

/* ---- 8. missing key: drink hidden AND warning key + ": missing from sheet" ---- */
test("deriveMenu: absent key hides drink and warns 'key: missing from sheet'", () => {
  // same availability as test 7 but with the "aperol" row removed entirely
  const availability = {
    gin: true,
    campari: true,
    "sweet vermouth": true,
    bourbon: true,
    "amaro nonino": true,
    "lemon juice": true,
  };
  const { cocktails, warnings } = deriveMenu(INLINE_MENU, availability);
  assert.deepEqual(
    cocktails.map((d) => d.slug),
    ["negroni"],
  );
  assert.ok(
    warnings.includes("aperol: missing from sheet"),
    "expected exact missing-key warning, got " + JSON.stringify(warnings),
  );
});

/* ---- 9. unknown key: extra sheet rows are spare inventory, silent ---- */
test("deriveMenu: unknown sheet keys produce no warnings and hide nothing", () => {
  const { availability } = parseIngredients(fixture("SYNTHETIC-ingredients-unknown-key.txt"));
  // "Apperol" (typo row) is unknown to the inline menu: no warning, and the
  // inline menu's drinks are unaffected by its presence.
  const base = {
    gin: true, campari: true, "sweet vermouth": true, bourbon: true,
    aperol: false, "amaro nonino": true, "lemon juice": true, vanilla: true,
  };
  const { cocktails, warnings } = deriveMenu(INLINE_MENU, { ...base, ...availability });
  assert.deepEqual(cocktails.map((d) => d.slug), ["negroni"]);
  assert.deepEqual(warnings, []);
});

/* ---- 10. parseBeans: exact ordered array + empty-tab shape ---- */
test("parseBeans: exact ordered array from beans fixture", () => {
  // null row dropped, numeric cell stringified, row order preserved
  const { beans, warnings } = parseBeans(fixture("SYNTHETIC-beans.txt"));
  assert.deepEqual(beans, ["Ethiopia Chelbesa", "Colombia El Paraiso", "5"]);
  assert.deepEqual(warnings, []);
});

test("parseBeans: empty tab returns { beans: [] } shape", () => {
  const result = parseBeans(fixture("SYNTHETIC-beans-empty.txt"));
  assert.deepEqual(result, { beans: [], warnings: [] });
});

/* ---- 12. extras: cold foams gated on ingredient keys ---- */
test("deriveMenu: extras gated on ingredient keys; missing key warns verbatim", () => {
  const menu = {
    coffee: {
      espresso: [],
      syrups: [],
      extras: [
        { group: "cold foam", name: "plain", ingredients: ["heavy cream"] },
        { group: "cold foam", name: "vanilla", ingredients: ["heavy cream", "vanilla"] },
      ],
    },
    cocktails: [],
  };
  // heavy cream only: plain visible, vanilla (also needs the syrup) hidden
  const some = deriveMenu(menu, { "heavy cream": true, vanilla: false });
  assert.deepEqual(some.extras.map((e) => e.name), ["plain"]);
  // both keys: everything visible, no warnings
  const all = deriveMenu(menu, { "heavy cream": true, vanilla: true });
  assert.deepEqual(all.extras.map((e) => e.name), ["plain", "vanilla"]);
  assert.deepEqual(all.warnings, []);
  // both keys missing: nothing shown, both named verbatim
  const miss = deriveMenu(menu, {});
  assert.deepEqual(miss.extras, []);
  assert.ok(
    miss.warnings.includes("heavy cream: missing from sheet") &&
      miss.warnings.includes("vanilla: missing from sheet"),
    "got " + JSON.stringify(miss.warnings),
  );
});

/* ---- 13. families: variants filtered; entry hides when none makeable ---- */test("deriveMenu: family shows exactly its makeable variants", () => {
  const menu = {
    coffee: { espresso: [], syrups: [] },
    cocktails: [{
      slug: "margarita",
      name: "Margarita",
      desc: "family",
      variants: [
        { name: "traditional", ingredients: ["tequila", "orange liqueur", "lime juice"] },
        { name: "tommy's", ingredients: ["tequila", "lime juice", "agave nectar"] },
        { name: "aperol", ingredients: ["tequila", "aperol", "lime juice"] },
      ],
    }],
  };
  // aperol out, everything else in: traditional + tommy's only
  const availability = {
    tequila: true, "orange liqueur": true, "lime juice": true,
    "agave nectar": true, aperol: false,
  };
  const { cocktails, warnings } = deriveMenu(menu, availability);
  assert.equal(cocktails.length, 1);
  assert.deepEqual(cocktails[0].variants.map((v) => v.name), ["traditional", "tommy's"]);
  assert.deepEqual(warnings, []);

  // tequila out too -> whole family hidden
  const none = deriveMenu(menu, { ...availability, tequila: false });
  assert.deepEqual(none.cocktails, []);

  // a variant referencing a key absent from the sheet -> hidden + warned
  const withMissing = deriveMenu(menu, {
    tequila: true, "lime juice": true, "agave nectar": true, aperol: true,
  });
  assert.deepEqual(withMissing.cocktails[0].variants.map((v) => v.name), ["tommy's", "aperol"]);
  assert.ok(
    withMissing.warnings.includes("orange liqueur: missing from sheet"),
    "got " + JSON.stringify(withMissing.warnings),
  );
});

/* ---- 14. grid drinks + specials: no ingredients = always in stock ---- */
test("deriveMenu: espresso and specials gate on their ingredients", () => {
  const menu = {
    coffee: {
      espresso: [
        { name: "americano" },
        { name: "mocha", meta: "hot or iced", ingredients: ["chocolate"] },
      ],
      specials: [
        { name: "vietnamese iced coffee", ingredients: ["condensed milk"] },
      ],
      syrups: [],
    },
    cocktails: [],
  };
  // chocolate out: mocha hidden, americano stays; condensed milk missing:
  // special hidden AND warned verbatim.
  const out = deriveMenu(menu, { chocolate: false });
  assert.deepEqual(out.espresso.map((d) => d.name), ["americano"]);
  assert.deepEqual(out.specials, []);
  assert.ok(
    out.warnings.includes("condensed milk: missing from sheet"),
    "got " + JSON.stringify(out.warnings),
  );
  // everything stocked: all show, no warnings.
  const all = deriveMenu(menu, { chocolate: true, "condensed milk": true });
  assert.deepEqual(all.espresso.map((d) => d.name), ["americano", "mocha"]);
  assert.deepEqual(all.specials.map((s) => s.name), ["vietnamese iced coffee"]);
  assert.deepEqual(all.warnings, []);
});

/* ---- 11. GOLDEN: host's real sheet, recorded 2026-10-07 (post typo-fix)
   Frozen snapshot of the live sheet at recording time. Re-record both
   gviz-*-real fixtures and update these goldens whenever the sheet's
   structure intentionally changes. ---- */
test("golden: real ingredients fixture parses to the exact frozen map", () => {
  const { availability, warnings } = parseIngredients(fixture("gviz-ingredients-real.txt"));
  assert.deepEqual(availability, {
    "agave nectar": true,
    "amaro nonino": false,
    "angostura bitters": true,
    "aperol": true,
    "bourbon": true,
    "campari": true,           // spare inventory: unused by the menu, silent
    "caramel": true,
    "chocolate": true,
    "coffee liqueur": true,
    "demerara syrup": true,    // spare inventory
    "espresso": true,
    "gin": true,               // spare inventory
    "lemon juice": false,
    "lime juice": true,
    "mezcal": true,
    "simple syrup": true,
    "sweet vermouth": false,   // spare inventory
    "tequila": true,
    "vanilla": true,
    "vodka": true,
    "white rum": true,
    "yellow chartreuse": true,
    "heavy cream": true,
    "orange liqueur": true,
    "elderflower liqueur": true,
    "grapefruit juice": true,
    "lychee puree": false,     // present, currently out of stock
    "irish cream": true,
    "cold brew": true,
    "prosecco": true,
    "soda water": true,
    "rye whiskey": true,
    "topo chico": true,        // recorded row has a trailing space; parser trims
    "grenadine": true,
    "condensed milk": true,
    "sarti rosa": true,
  });
  assert.deepEqual(warnings, []);
});

test("golden: real beans fixture parses to the exact ordered array", () => {
  const { beans } = parseBeans(fixture("gviz-beans-real.txt"));
  assert.deepEqual(beans, [
    "tanat - washed ethiopian - jasmine/peach/sencha",
    "dak - fermented columbian - cardamom/pistachio/cake",
  ]);
});

test("golden: real menu.js x real sheet -> exact visible slugs + exact warnings", async () => {
  const { MENU } = await import("../menu.js");
  const { availability } = parseIngredients(fixture("gviz-ingredients-real.txt"));
  const { cocktails, syrups, extras, espresso, specials, warnings } = deriveMenu(MENU, availability);
  // Sheet state at recording: amaro nonino, lemon juice, sweet vermouth and
  // lychee puree unchecked; spare inventory rows (campari, demerara syrup,
  // gin, sweet vermouth) silent by design. Visible in menu.js order —
  // everything except paper plane (amaro nonino out):
  assert.deepEqual(
    cocktails.map((d) => d.slug),
    [
      "margarita", "martini", "spritz", "old-fashioned", "ranch-water",
      "paloma", "mexican-firing-squad", "naked-and-famous", "daiquiri",
    ],
  );
  const bySlug = Object.fromEntries(cocktails.map((d) => [d.slug, d]));
  assert.deepEqual(
    bySlug["margarita"].variants.map((v) => v.name),
    ["traditional", "tommy's", "elderflower", "aperol", "mezcal"],
  );
  assert.deepEqual(bySlug["martini"].variants.map((v) => v.name), ["mudslide", "espresso"]);
  assert.deepEqual(bySlug["spritz"].variants.map((v) => v.name), ["aperol", "hugo", "sarti"]);
  assert.deepEqual(bySlug["old-fashioned"].variants.map((v) => v.name), ["bourbon", "rye", "oaxaca"]);
  assert.deepEqual(syrups, ["vanilla", "caramel", "chocolate"]);
  assert.deepEqual(extras.map((e) => e.name), ["plain", "salted", "vanilla"]);
  assert.deepEqual(espresso.map((d) => d.name), ["americano", "cortado", "latte"]);
  assert.deepEqual(specials.map((s) => s.name), ["vietnamese iced coffee"]);
  // Every menu key has a sheet row: zero warnings.
  assert.deepEqual(warnings, []);
});
