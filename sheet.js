/* ============================================================
   Guest menu: gviz parser + derivation
   Pure, DOM-free ES module. All complexity lives here (TESTPLAN.md).

   Schema contract (README.md, one-time sheet setup):
   - A payload is valid only if it is the gviz wrapper
     (O_o prefix + google.visualization.Query.setResponse(...)) and parses to
     status "ok" with a table.cols/table.rows shape. Anything else throws;
     the caller falls to the cache path.
   - Tab `ingredients` (fetched with headers=1): col A label "item", col B
     label "available" (case-insensitive, trimmed). Col B: native checkbox
     booleans. Availability: true or string "TRUE" -> available; false,
     null or empty -> unavailable (quiet: an unchecked or blank cell is
     normal); any other value -> unavailable + warning naming the item.
   - Tab `beans` (fetched with headers=0 so a missing header row cannot eat
     the first bean): col A, one bean per row, display order = row order.
     Empty rows dropped.
   - Extra sheet rows (keys the menu does not use) are allowed SILENTLY —
     spare inventory is normal. The loud drift signal is the missing-key
     side: a menu key with no sheet row warns verbatim. (Host decision:
     the unknown-key warning was redundant with it.)
   - Sheet values must only ever reach the DOM via textContent.
   ============================================================ */

const GVIZ_PREFIX = "/*O_o*/";
const GVIZ_CALL = "google.visualization.Query.setResponse(";

function parseGviz(text) {
  if (typeof text !== "string") throw new Error("invalid gviz payload: not text");
  const t = text.trim();
  if (!t.startsWith(GVIZ_PREFIX) || !t.includes(GVIZ_CALL)) {
    throw new Error("invalid gviz payload: missing wrapper");
  }
  const start = t.indexOf(GVIZ_CALL) + GVIZ_CALL.length;
  const end = t.lastIndexOf(")");
  if (end <= start) throw new Error("invalid gviz payload: missing wrapper");
  let data;
  try {
    data = JSON.parse(t.slice(start, end).replace(/;\s*$/, ""));
  } catch {
    throw new Error("invalid gviz payload: not json");
  }
  if (!data || data.status !== "ok") {
    throw new Error("invalid gviz payload: status " + (data && data.status));
  }
  const table = data.table;
  if (!table || !Array.isArray(table.cols) || !Array.isArray(table.rows)) {
    throw new Error("invalid gviz payload: missing table");
  }
  return data;
}

export function parseIngredients(text) {
  const data = parseGviz(text);
  const cols = data.table.cols;
  const labelA = String((cols[0] && cols[0].label) || "").trim().toLowerCase();
  const labelB = String((cols[1] && cols[1].label) || "").trim().toLowerCase();
  if (labelA !== "item" || labelB !== "available") {
    throw new Error("unexpected ingredients schema: " + JSON.stringify([labelA, labelB]));
  }
  const availability = {};
  const warnings = [];
  for (const row of data.table.rows) {
    const cells = (row && row.c) || [];
    const rawKey = cells[0] && cells[0].v;
    if (rawKey == null) continue; // blank row
    const key = String(rawKey).trim();
    if (!key) continue;
    const value = cells[1] ? cells[1].v : null;
    if (value === true || value === "TRUE") {
      availability[key] = true;
    } else if (value === false || value == null) {
      availability[key] = false; // unchecked or blank: normal, quiet
    } else {
      availability[key] = false;
      warnings.push(key + ': cell is ' + JSON.stringify(value) + ', not a checkbox');
    }
    // duplicate keys: last row wins
  }
  return { availability, warnings };
}

export function parseBeans(text) {
  const data = parseGviz(text);
  if (!data.table.cols.length) throw new Error("unexpected beans schema: no columns");
  const beans = [];
  for (const row of data.table.rows) {
    const cell = row && row.c && row.c[0];
    const v = cell ? cell.v : null;
    if (v == null) continue;
    const s = String(v).trim();
    if (s) beans.push(s);
  }
  return { beans, warnings: [] };
}

/* Join the stable catalog against sheet availability (decision #7:
   ingredient-level). Returns the visible cocktails and syrups plus warnings
   for the loud failure mode:
   - missing key: menu ingredient with no sheet row -> unavailable + warning
   (Extra sheet rows are spare inventory: allowed silently, host decision.) */
export function deriveMenu(menu, availability) {
  const warnings = [];
  const drinks = Array.isArray(menu && menu.cocktails) ? menu.cocktails : [];
  const syrups = (menu && menu.coffee && Array.isArray(menu.coffee.syrups))
    ? menu.coffee.syrups
    : [];
  const extras = (menu && menu.coffee && Array.isArray(menu.coffee.extras))
    ? menu.coffee.extras
    : [];
  const espresso = (menu && menu.coffee && Array.isArray(menu.coffee.espresso))
    ? menu.coffee.espresso
    : [];
  const specials = (menu && menu.coffee && Array.isArray(menu.coffee.specials))
    ? menu.coffee.specials
    : [];

  const used = new Set();
  for (const d of drinks) {
    if (Array.isArray(d.variants)) {
      for (const v of d.variants) for (const k of v.ingredients || []) used.add(k);
    } else {
      for (const k of d.ingredients || []) used.add(k);
    }
  }
  for (const k of syrups) used.add(k);
  for (const e of extras) for (const k of e.ingredients || []) used.add(k);
  for (const d of espresso) for (const k of d.ingredients || []) used.add(k);
  for (const s of specials) for (const k of s.ingredients || []) used.add(k);

  for (const key of used) {
    if (!(key in availability)) warnings.push(key + ": missing from sheet");
  }

  /* A cocktail entry is either a singleton (ingredients) or a family
     (variants). A family shows only its available variants and hides
     entirely when none are makeable. Singletons hide when any ingredient
     is unavailable (decision #5/#7). */
  const cocktails = [];
  for (const d of drinks) {
    if (Array.isArray(d.variants)) {
      const visible = d.variants.filter((v) =>
        (v.ingredients || []).every((k) => availability[k] === true)
      );
      if (visible.length) cocktails.push(Object.assign({}, d, { variants: visible }));
    } else if ((d.ingredients || []).every((k) => availability[k] === true)) {
      cocktails.push(d);
    }
  }

  const availableSyrups = syrups.filter((k) => availability[k] === true);
  const availableExtras = extras.filter((e) =>
    (e.ingredients || []).every((k) => availability[k] === true)
  );
  // Grid drinks and specials: no `ingredients` = always in stock.
  const inStock = (d) =>
    !Array.isArray(d.ingredients) || d.ingredients.every((k) => availability[k] === true);
  const availableEspresso = espresso.filter(inStock);
  const availableSpecials = specials.filter(inStock);
  return {
    cocktails,
    syrups: availableSyrups,
    extras: availableExtras,
    espresso: availableEspresso,
    specials: availableSpecials,
    warnings
  };
}
