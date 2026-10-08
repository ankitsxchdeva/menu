/* ============================================================
   Guest menu: app logic (ES module)
   Vanilla JS, no build step, no dependencies.

   Load schedule (stale-while-revalidate, README.md):
   Task 1 (sync):  read localStorage["guestmenu:lastGood"] -> render cached
                   if present -> fire both gviz fetches. Cached paint ALWAYS
                   first: localStorage is synchronous and the render runs in
                   the same task that fires the fetches.
   Join:           Promise.all; single render only after BOTH fetches
                   resolve. Any failure (fetch, 8s AbortController timeout,
                   invalid payload) -> cache path: keep cached render +
                   "may be out of date" notice; first visit with no cache ->
                   "unavailable, reload to retry".
   Re-render rule: skip the fresh render if the serialized payload is
                   identical to the rendered one (no mid-read shifts).

   Sheet values render via textContent only. aria-live="polite" lives on
   #status only, never on the menu container (SWR double render would
   double-announce).
   ============================================================ */

import { MENU } from "./menu.js";
import { parseIngredients, parseBeans, deriveMenu } from "./sheet.js";

// Host: paste the sheet ID from the sheet URL (…/spreadsheets/d/<ID>/edit).
// The sheet must be shared anyone-with-link, viewer.
const SHEET_ID = "1dFB8UcHei9479qgce9eVmP3slIoytcZk52SvihfRhys";
const INGREDIENTS_TAB = "ingredients"; // headers=1: item | available
const BEANS_TAB = "beans";             // headers=0: one bean per row, col A
const CACHE_KEY = "guestmenu:lastGood";
const TIMEOUT_MS = 8000;

const debugOn = new URLSearchParams(window.location.search).has("debug");

let lastRenderedJson = null;
let loadWarnings = [];

/* ---- Favicon per room: coffee cup in coffee, cocktail glass in
   cocktails. The pre-paint script in index.html sets the initial one. */
const ICON = {
  coffee: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23bf5a4a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 8h1a4 4 0 0 1 0 8h-1'/%3E%3Cpath d='M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z'/%3E%3Cpath d='M6 1v3M10 1v3M14 1v3'/%3E%3C/svg%3E",
  cocktails: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23bf5a4a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 4h14l-7 8z'/%3E%3Cpath d='M12 12v6'/%3E%3Cpath d='M8 20h8'/%3E%3C/svg%3E"
};

/* ---- DOM helpers (no innerHTML path exists: sheet data never touches it) */
function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
  }
  if (children) {
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
  }
  return node;
}

/* ---- Cache (localStorage may be unavailable: degrade quietly) */
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.v === 1 &&
      parsed.availability && typeof parsed.availability === "object" &&
      Array.isArray(parsed.beans)
    ) {
      return { v: 1, availability: parsed.availability, beans: parsed.beans };
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* no-op */
  }
}

/* ---- Fetch with the 8s timeout */
function gvizUrl(tab, headers) {
  return "https://docs.google.com/spreadsheets/d/" + SHEET_ID +
    "/gviz/tq?tqx=out:json&headers=" + headers + "&sheet=" + encodeURIComponent(tab);
}

function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal })
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .finally(() => clearTimeout(timer));
}

/* ---- Status notice (#status is the only aria-live region) */
function setStatus(text) {
  const s = document.getElementById("status");
  if (s) s.textContent = text;
}

function clearStatus() {
  const s = document.getElementById("status");
  if (s) s.textContent = "";
}

/* ---- Render */
function rowList(items) {
  const ul = el("ul", { class: "menu-list" });
  for (const item of items) {
    const li = el("li", { class: "row" });
    li.appendChild(el("span", { class: "row-name", text: item.name }));
    if (item.desc) li.appendChild(el("span", { class: "row-desc", text: item.desc }));
    if (item.variants) li.appendChild(el("span", { class: "row-meta", text: item.variants }));
    ul.appendChild(li);
  }
  return ul;
}

/* ---- Cup diagrams: one cell per milk drink, name above the cup. Flat
   hairline cups, editorial ink for espresso, mist for milk; bottoms
   aligned (y=92), heights carry the difference. Static host-authored
   markup — sheet values never come near this (textContent rule). ---- */
const SVG_NS = "http://www.w3.org/2000/svg";
const ESPRESSO_INK = "var(--editorial)";
const MILK_INK = "var(--border)";

// Cup specs keyed by drink name; bottoms all at y=92 inside a 60x100 cell.
const CUPS = {
  "americano": {
    y: 32, h: 60,
    layers: [{ h: 52, fill: ESPRESSO_INK, opacity: 0.55 }],
    label: "americano: a nearly full cup of diluted espresso"
  },
  "cortado": {
    y: 56, h: 36,
    layers: [{ h: 14, fill: ESPRESSO_INK }, { h: 14, fill: MILK_INK }],
    label: "cortado: a small cup, equal parts espresso and milk"
  },
  "latte": {
    y: 22, h: 70,
    layers: [{ h: 16, fill: ESPRESSO_INK }, { h: 48, fill: MILK_INK }],
    label: "latte: a tall glass, a quarter espresso and the rest milk"
  }
};

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

// One cup at (x, y) size w x h; layers painted bottom-up: { h, fill, opacity? }
function cup(svg, x, y, w, h, layers) {
  svg.appendChild(svgEl("rect", {
    x, y, width: w, height: h, rx: 3,
    fill: "none", stroke: "var(--muted)", "stroke-width": 1
  }));
  let bottom = y + h - 3;
  for (const layer of layers) {
    svg.appendChild(svgEl("rect", {
      x: x + 3, y: bottom - layer.h, width: w - 6, height: layer.h,
      fill: layer.fill, opacity: layer.opacity != null ? layer.opacity : 1
    }));
    bottom -= layer.h;
  }
}

function buildMilkGrid(drinks) {
  const grid = el("div", { class: "milk-grid" });
  drinks.forEach((d) => {
    const cell = el("div", { class: "milk-cell" });
    cell.appendChild(el("span", { class: "milk-name", text: d.name }));
    if (d.meta) cell.appendChild(el("span", { class: "milk-meta", text: d.meta }));
    const spec = CUPS[d.name];
    if (spec) {
      const svg = svgEl("svg", { viewBox: "0 0 60 100", role: "img", "aria-label": spec.label });
      cup(svg, 12, spec.y, 36, spec.h, spec.layers);
      cell.appendChild(svg);
    }
    grid.appendChild(cell);
  });
  return grid;
}

/* ---- Render: both panels always populated; tabs pick which room ---- */
function panelHeading(text) {
  return el("h2", { class: "sr-only", tabindex: "-1", text });
}

function renderCoffee(payload, derived) {
  const panel = document.getElementById("tab-coffee");
  panel.replaceChildren();
  panel.appendChild(panelHeading("coffee"));
  if (payload.beans.length) {
    panel.appendChild(el("h3", { class: "sub-label", text: "pour over" }));
    panel.appendChild(rowList(payload.beans.map((name) => ({ name }))));
  }
  panel.appendChild(el("h3", { class: "sub-label", text: "espresso" }));
  panel.appendChild(buildMilkGrid(derived.espresso));
  if (derived.syrups.length) {
    panel.appendChild(el("p", {
      class: "syrup-line",
      text: "syrups: " + derived.syrups.join(" / ")
    }));
  }
  if (derived.extras.length) {
    // Group extras by their display group: one line per group.
    const groups = {};
    derived.extras.forEach((x) => { (groups[x.group] = groups[x.group] || []).push(x.name); });
    Object.keys(groups).forEach((g) => {
      panel.appendChild(el("p", {
        class: "syrup-line",
        text: g + ": " + groups[g].join(" / ")
      }));
    });
  }
  if (derived.specials.length) {
    panel.appendChild(rowList(derived.specials.map((s) => ({ name: s.name, desc: s.meta }))));
  }
  panel.appendChild(el("h3", { class: "sub-label", text: "tea" }));
  panel.appendChild(el("p", { class: "tea-line", text: MENU.coffee.teas.join(" / ") }));
}

function renderCocktails(derived) {
  const panel = document.getElementById("tab-cocktails");
  panel.replaceChildren();
  panel.appendChild(panelHeading("cocktails"));
  if (!derived.cocktails.length) {
    panel.appendChild(el("p", { class: "notice", text: "no cocktails available right now." }));
    return;
  }
  // Wine-list rows: name + variants left, spirit right-aligned and muted.
  const ul = el("ul", { class: "menu-list" });
  derived.cocktails.forEach((d) => {
    const li = el("li", { class: "row" });
    const main = el("span", { class: "drink-main" });
    main.appendChild(el("span", { class: "row-name", text: d.name }));
    if (Array.isArray(d.variants)) {
      main.appendChild(el("span", {
        class: "row-meta",
        text: d.variants.map((v) => v.name).join(" / ")
      }));
    }
    li.appendChild(main);
    li.appendChild(el("span", { class: "drink-spirit", text: d.desc }));
    ul.appendChild(li);
  });
  panel.appendChild(ul);
}

function render(payload, derived) {
  lastRenderedJson = JSON.stringify(payload);
  renderCoffee(payload, derived);
  renderCocktails(derived);
}

/* ---- Debug panel (?debug only; guests never see it) */
function renderDebug(errorText) {
  const box = document.getElementById("debug");
  if (!box) return;
  box.replaceChildren();
  const lines = [];
  lines.push("sheet id: " + (SHEET_ID === "PASTE_SHEET_ID_HERE" ? "not set (edit app.js)" : "set"));
  lines.push("cache: " + (lastRenderedJson ? "rendered" : "none"));
  if (errorText) lines.push("load error: " + errorText);
  lines.push("warnings: " + (loadWarnings.length ? loadWarnings.length : "none"));
  box.appendChild(el("p", { class: "debug-title", text: "debug" }));
  for (const t of lines) box.appendChild(el("p", { class: "debug-line", text: t }));
  for (const w of loadWarnings) box.appendChild(el("p", { class: "debug-line", text: w }));
  box.hidden = false;
}

/* ---- Load: SWR schedule, see header */
async function loadMenu() {
  const cached = readCache();
  if (cached) {
    render(cached, deriveMenu(MENU, cached.availability));
    loadWarnings.push(...deriveMenu(MENU, cached.availability).warnings);
  }

  let errorText = null;
  if (SHEET_ID === "PASTE_SHEET_ID_HERE") {
    errorText = "sheet id is not set in app.js";
    console.error("guest menu: " + errorText);
  } else {
    try {
      const [ingredientsText, beansText] = await Promise.all([
        fetchText(gvizUrl(INGREDIENTS_TAB, 1)),
        fetchText(gvizUrl(BEANS_TAB, 0))
      ]);
      const ingredients = parseIngredients(ingredientsText);
      const beans = parseBeans(beansText);
      const payload = { v: 1, availability: ingredients.availability, beans: beans.beans };
      const derived = deriveMenu(MENU, payload.availability);

      loadWarnings = [...ingredients.warnings, ...beans.warnings, ...derived.warnings];
      loadWarnings.forEach((w) => console.warn("guest menu: " + w));

      const json = JSON.stringify(payload);
      if (json !== lastRenderedJson) {
        writeCache(payload);
        render(payload, derived);
      }
    } catch (err) {
      errorText = err && err.message ? err.message : String(err);
      console.error("guest menu: load failed:", err);
    }
  }

  if (errorText) {
    // Cache path: keep the cached render, go loud about staleness.
    if (lastRenderedJson) {
      setStatus("the menu may be out of date.");
    } else {
      setStatus("the menu is unavailable, reload to retry.");
    }
  } else {
    clearStatus();
  }
  if (debugOn) renderDebug(errorText);
}

/* ---- Tabs: #coffee / #cocktails, deep-linkable (catalog lane).
   Default with no/invalid hash: coffee before 5pm, cocktails after —
   mirrors the pre-paint script in index.html. Switching flips
   html[data-theme]: one room at a time. Anchors set the hash natively;
   hashchange is the single activation path after the initial call. ---- */
const TABS = ["coffee", "cocktails"];

function tabFromHash() {
  const h = (location.hash || "").replace(/^#\/?/, "");
  return TABS.indexOf(h) !== -1 ? h : null;
}

function defaultTab() {
  return new Date().getHours() < 17 ? "coffee" : "cocktails";
}

function activate(tab, user) {
  document.documentElement.dataset.theme = tab === "cocktails" ? "dark" : "light";
  document.title = tab + " \u00b7 menu";
  const icon = document.querySelector("link[rel='icon']");
  if (icon) icon.href = ICON[tab];
  document.querySelectorAll(".tab-link").forEach((l) => {
    const on = l.dataset.tab === tab;
    l.classList.toggle("active", on);
    if (on) l.setAttribute("aria-current", "page");
    else l.removeAttribute("aria-current");
  });
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("active", p.id === "tab-" + tab);
  });
  if (user) {
    const heading = document.querySelector("#tab-" + tab + " h2");
    if (heading) heading.focus({ preventScroll: true });
  }
}

window.addEventListener("hashchange", () => activate(tabFromHash() || defaultTab(), true));

activate(tabFromHash() || defaultTab(), false);
loadMenu();
