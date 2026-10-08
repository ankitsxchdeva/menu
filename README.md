# Guest menu

Coffee and cocktails for guests of the apartment. Static site, no build, no
dependencies. Content lives in `menu.js`; live availability comes from a
Google Sheet the host edits on their phone. Design: ~/Documents/design/DESIGN.md
v0.7, catalog lane. Sibling app: ~/Documents/cocktails.

## One-time sheet setup (host, ~10 min)

1. Create a Google Sheet. Share → anyone with the link → **Viewer**.
2. Tab 1: rename it `ingredients` (lowercase). Row 1 headers: `item` |
   `available`. Column A: the keys below, one per row, spelled EXACTLY as
   shown (lowercase, case-sensitive; row order does not matter here — only
   the `beans` tab is order-sensitive). Column B: Insert → Checkbox, ticked
   when in stock.

   agave nectar · amaro nonino · angostura bitters · aperol · bourbon ·
   caramel · chocolate · coffee liqueur · cold brew · elderflower liqueur ·
   espresso · grapefruit juice · grenadine · heavy cream · irish cream ·
   lemon juice · lime juice · lychee puree · mezcal · orange liqueur ·
   prosecco · rye whiskey · simple syrup · soda water · tequila ·
   topo chico · vanilla · vodka · white rum · yellow chartreuse ·
   condensed milk · sarti rosa

3. Tab 2: rename it `beans`. Column A: current pour-over beans, one per row,
   free text, display order = row order. Empty tab → pour-over section hides.
4. Copy the sheet ID from its URL (`.../spreadsheets/d/<ID>/edit`) into
   `app.js`: `const SHEET_ID = "..."`.
5. After any sheet structure change (renamed tab, retyped a key), open the
   menu with `?debug` once: it lists unmatched keys and bad cells verbatim.

Unchecking an ingredient hides every drink and family variant that needs
it (a family hides entirely when no variant is makeable). Two tabs — coffee
and cocktails; the page opens on coffee before 5pm and cocktails after, and
`#coffee` / `#cocktails` links deep-link a tab. Cold foam flavors appear
under milk when `heavy cream` (and for vanilla, `vanilla`) are checked. The
menu refreshes on each page load; guests may need to pull-to-refresh.

## Develop / test

```
python3 -m http.server 8123   # serve (ES modules need http, not file://)
node --test                   # parser + derivation suite
```

Without a sheet ID set, the page renders the unavailable state by design —
that path is the failure fallback, not a bug.

## Deploy

GitHub Pages, same as cocktails: repo → Settings → Pages → main branch,
root. `.nojekyll` is already here. Print a QR to the URL; done.
