# Guest Menu

Static site, vanilla JS **ES modules**, no build step, no dependencies.
`menu.js` holds stable content (ES module `export const MENU`, also set on
`window`); a Google Sheet holds volatile
availability, fetched via the gviz JSON endpoint by `app.js` and parsed by
`sheet.js` (pure, DOM-free). Hash-free single page: one scroll, two sections.

All design decisions follow ~/Documents/design/DESIGN.md v0.7 (canonical
spec). **Lane: catalog** — sentence case, cards licensed but not required,
everything else canonical. Do not invent colors, fonts, spacing, or motion
outside it. Tokens are vendored in `tokens.css` (adapted: dark selectors are
`[data-theme="dark"]`, not `:root`-scoped — sections carry their own fixed
theme). Fonts (Lato 400/700) in `fonts/`. Where any skill or model
suggestion conflicts, the spec wins.

Hard rules:
- Sheet values render via `textContent` only. Never `innerHTML`.
- `aria-live="polite"` lives ONLY on `#status`, never on the menu container.
- Availability semantics: an ingredient is available iff its sheet cell is
  boolean TRUE (string "TRUE" tolerated); anything else = unavailable.
  Missing keys = unavailable + warning. Extra sheet rows (keys the menu
  doesn't use) are spare inventory: allowed silently. Unavailable drinks
  are HIDDEN; families show only their makeable variants and hide when
  none are.
- Copy voice: lowercase EVERYTHING, host aesthetic (overrides the catalog
  lane's sentence case). Otherwise DESIGN.md §2 Voice: terse, no
  exclamation. All descriptions approved by the host before ship.

Tests: `node --test` (node ≥18). Fixtures in `test/fixtures/` are recorded
real gviz responses — never hand-author without a `SYNTHETIC` label in the
filename.
