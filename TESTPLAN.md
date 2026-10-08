# Test Plan — Guest Menu (consumed by /qa)

Framework: `node --test` (built-in, zero deps). Modules: ES modules.
Automated coverage lives on the parser/derivation — the codepaths where
silent wrongness reaches a guest. Manual drills cover the browser layer.

## Automated tests (test/sheet.test.mjs)

Fixture discipline: after the real Sheet exists, record its actual gviz
responses with curl (same command as the 2026-10-07 probe, per tab) into
`test/fixtures/`. Never hand-author gviz fixtures.

| # | Test | Exact assertion |
|---|---|---|
| 1 | Recorded ingredients payload parses | Deep-equal the FULL availability map (every key, every boolean) — not a subset, not a count lower bound |
| 2 | Recorded beans payload parses | Exact ordered list of bean strings, row order preserved |
| 3 | Garbage payloads rejected: HTML error page, missing `table`, `status:"error"`, empty body | Each → parser signals invalid (throw or null per its contract); caller falls to cache path |
| 4 | Derivation, option A semantics | With Aperol=FALSE and the real menu.js fixture: visible cocktail list equals an exact expected slug list; every Aperol-containing drink absent, every other drink present |
| 5 | Unknown key loudness | Sheet row "Apperol" (typo) → `warnings` contains the verbatim string "Apperol" |
| 6 | Non-boolean coercion | Cell containing text "yes" → that item unavailable AND named in `warnings` |

## Manual /qa drills (against the live Pages deploy)

| # | Drill | Pass condition |
|---|---|---|
| R1 | Cold load, online, no cache (private window) | Full correct menu on the default tab (time-based: coffee before 5pm, cocktails after) |
| R1b | Tabs | Click switches panels + flips the page theme + sets `#coffee`/`#cocktails`; keys 1/2 switch; a `#cocktails` deep link overrides the time default; invalid hash falls back to the time default |
| R2 | Warm load, network throttled (devtools) | Cached menu paints first; fresh render swaps only if payload changed |
| R3 | Airplane-mode load WITH cache | Cached menu + visible "may be out of date" notice |
| R4 | Airplane-mode load WITHOUT cache (private window) | "menu is unavailable, reload to retry" state |
| R5 | Uncheck aperol in sheet → refresh | margarita loses its aperol variant (other variants stay); spritz keeps hugo only; naked and famous and paper plane vanish; nothing else changes |
| R5b | Uncheck prosecco → refresh | the spritz entry is absent entirely (family hides when no variant is makeable) |
| R6 | Rename a sheet key (typo) → `?debug` | The intended key's "missing from sheet" warning appears verbatim; the typo'd row itself stays silent (spare-inventory rule); guest view unaffected |
| R7 | Type text "yes" in a checkbox cell → `?debug` | Item treated unavailable + warning visible |
| R8 | Beans tab: 2 rows → menu; then empty tab → menu | Pour-over section shows beans in row order; hidden entirely when empty |
| R9 | Stalled connection (devtools) | ~8s timeout → same handling as R3/R4 |
| R10 | Themes | Coffee tab paints light tokens, Cocktails tab dark, regardless of OS theme; `color-scheme` follows the active tab (no untinted scrollbars/controls) |
| R11 | Screen reader (VoiceOver quick pass) | Menu does NOT double-announce on load; status notice is the only live region |
| R12 | prefers-reduced-motion | Entrance lands instantly |

## Critical path

Guest scans QR at a party → menu correct for current inventory within ~2s on
apartment Wi-Fi. Everything above exists to protect that moment.

## Known-untested (deliberate)

localStorage cache read/write (thin try/catch copied from cocktails),
render layer pixel-level output. If either grows logic, it earns tests.
