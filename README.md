# JSON · Log Formatter

Paste a raw request/response log (or plain JSON) and read it comfortably.

```bash
npm install
npm run dev              # http://localhost:5173
npm test                 # parser, render and interaction tests (jsdom)
npm run e2e              # drives real Chrome against the dev server + json.rtf
npm run e2e -- --headful # …and watch it click
npm run build            # static output in dist/
```

## What it handles

- **Log blocks** — strips the `│ ┌ └ ─` gutter, then pulls out method, URL, query params,
  headers, status, status text and timing. Request and response with the same `[id]` are
  paired into one card.
- **Bare JSON** — paste just a body and it renders in the same tree.
- **RTF** — paste straight from a `.rtf` (or drop the file in); it is unwrapped first.
- **Broken JSON** — trailing commas, `//` comments and unquoted keys are auto-repaired
  (flagged `repaired`); anything unrecoverable is shown as raw text with the failing line marked.
- **Packed strings** — a value like `C1K~TS8~12~…~Margin#0^Markup#0^Fixed#0` gets a `⋯` toggle
  that splits it into numbered parts on `~`, `^` and `####`. Positional only, so it works for
  every model, not just this one.

Input is kept in `localStorage`, so a refresh does not lose your paste.

## Collapsing

- **Click** an arrow (or the key next to it) — toggles that node only.
- **Shift-click** an arrow — toggles that node **together with its siblings**, the branches sharing
  its parent, one level deep. Shift-click one hotel and all 44 open; shift-click a
  `cancellationPolicies` arrow inside hotel 0 and only hotel 0's own fields follow — the other 43
  keep whatever state you left them in.
- **Shift-click** a REQUEST/RESPONSE header — toggles every section of that card at once.
- **Expand all / Collapse all** in the toolbar — the whole tree at once, roots included.

Shift is the only modifier: one gesture, one meaning. Its direction is read from the group, not from
the arrow you clicked — if any sibling is still closed the group opens, and only a fully open group
collapses. That matters because a root always renders open, so reading its own state would collapse
a tree you meant to expand.

A search always wins over the collapse state, so matches are never left hidden.

## Reading mode

The **⤢** button at the right of the toolbar hides the paste box and the page header so the results
take the whole window — useful on wide payloads where a 38 % column wraps every line. **Esc** or the
**⤡** button brings them back; the pasted text is untouched.

Bodies with more than `AUTO_EXPAND_LIMIT` (300) branches load collapsed one level deep — the
361 KB sample expands to ~69,000 DOM nodes and over a second of layout, which made every paste feel
frozen. A note above the tree says how many nodes there are; shift-click walks it down one group at
a time (~380 ms to open all 44 items on that payload).

## Layout

```
src/lib/rtf.js         RTF -> plain text
src/lib/logParser.js   text -> transactions (gutter, sections, headers, bodies)
src/lib/jsonParse.js   tolerant JSON.parse with repairs
src/lib/delimited.js   packed-string detection and splitting
src/components/        InputPane, Toolbar, TransactionCard, HeadersTable, JsonTree, DelimitedString
```
