# STYLE-MAP: next.css and the look-proof's DOM

Source: `output/ui-ws2-20261112/src/template.html` (builder line numbers below are that file's). Everything is scoped
under the root class `.olumi-next` (the slice root: `position:fixed; inset:0`, carries the tokens, the font and the
page background). Template ids are now classes named `nx-<id>`; all other class names are unchanged.
Element resets use `:where(.olumi-next)` so they keep element-level specificity.

## Frame (builder: static shell in the template body, lines 288-294; the script fills it)
| Class | Element | Children / notes |
|---|---|---|
| `.nx-app` | `div` (grid, 2 cols x 2 rows) | `header.nx-bar`, `main.nx-board`, `aside.nx-panel` |
| `.nx-bar` | `header` (spans both cols) | `.brand`, `.scn`, `nav.nx-lenses`, `.nx-proof` (builder 707-712) |
| `.brand` | `div` | `span` (brand svg 20px) + text "Olumi" |
| `.scn` | `div` | `span.scn-title`, then `span.meta` x0-2 |
| `.nx-lenses` | `nav` | `button[aria-current="true"]` on the active lens, each wrapping a `span` |
| `.nx-proof` | `div` | look-proof switcher only; NOT part of the product (omit it) |
| `.nx-board` | `main` (scrolls) | `.nx-stage` |
| `.nx-stage` | `div`, positioned | `svg.nx-wires` first, then `.node` children; class `compact` is toggled here (layout 507) when the board is under 1300px |
| `.nx-wires` | `svg` | children from `S()` 496-610: `path.wire` (+`firm`/`sized`/`disputed`/`leader`, `hot` on hover/open), `path.hit` (transparent hit target, holds a `title`), `path.head-open/head-firm/head-sized`, `circle.dot`, `g.chip` (circle + path), `g.wmark` (path) |
| `.nx-legend` | `footer` | `span.it` x n: `span.mk` (svg) or `span.fm`, then a text `span` (builder 718) |
| `.nx-panel` | `aside` (flex column) | `.nx-panel-head`, `.nx-scroll`, then `.nx-decide` (only when proposal) and `.nx-composer` appended after the scroll |
| `.nx-scroll` | `div` | holds `section.nx-detail[hidden]` first, then turns and sections |
| `.nx-decide` (657) | `div` | `button.btn.btn-primary`, `button.btn.btn-quiet[disabled]` (text + `span` count), optional `button.btn.btn-text` |
| `.nx-composer` (661) | `div` | `div.field` > `input[type=text]` + `button` (send icon). The send button is styled by `.nx-composer button` |
| `.nx-detail` (633, 685) | `section[hidden]` | `header` (`h3` + `button.icon-btn` close) then `dl` of `div` > `dt`, `dd`+. Shown by removing `hidden` |

## Cards and notes on the board (all are `.node`: absolutely positioned, geometry is data)
| Class | Builder | DOM |
|---|---|---|
| `.node.card` + `.by-olumi/.by-person/.by-mixed` + `.fam-<family>` | `cardEl` 416 | `article[tabindex=0][data-id][title]`; state classes `focus` (blue border), `proposed` (dashed), `sel` (open in detail, added by openDetail). Children: `header` (`.who`, `.fm`, `h3`), `.body`, `.ask`, `.foot` |
| `h3.quoted` | cardEl 421 | the title when the words are the person's own; quotes come from CSS |
| `.who` | `who` 344 | `span[role=img][aria-label][title]` wrapping an svg (`mk-olumi`, `mk-partly` or `mk-person`); `.o`/`.f` paths in `mk-partly` |
| `.fm` | `fam` 342 | `span[aria-hidden]` wrapping the glyph svg; the line glyphs use `path.s`/`rect.s`/`circle.s`; `.s.heavy` is the "!" mark |
| `.body` | cardEl | `div` of: `.chance` / `.fixed` / `.nochance` (`p`), `p.meta`, `.olumi-says`, `.words`, `.figrow`, `.vals`, `.views`, `.lrow`, `.premise`, `span.nothing` (optionBody 371, quantityBody 400) |
| `.chance` `.fixed` `.figure` `.words` `.nochance` | optionBody / quantityBody | text elements (`p` or `span`) |
| `.olumi-says` | `olumiSays` 353 | `div` grid: `span.mk` (svg olumi 8) + `.cl` clamp wrapper (or a plain `p`) |
| `.figrow` | quantityBody | `div` flex: `span.figure` or `span.words`, then optional `button.icon-btn` (pencil). `span.meta` follows when the edit label is shown |
| `.vals` | quantityBody 405 | `div` of `div` > `div.v-opt` + `div.v-val` (optional `span.mk`, then `span`) |
| `.views` | quantityBody 418 | `div` of `span` > `span.vby` + `span.vfig` |
| `.lrow` (+ `one-limit`) | optionBody 391 | `p`: optional `span.l-key` (`.fm` + `span.meta`), `span.lval` (optional `.mk` + `span`), `span.meta.l-aim`. In `.compact`, `one-limit` swaps `.l-aim` for `.l-key` |
| `.premise` (+ `by-olumi`) | optionBody 396 | `div` grid: `.fm` + `.words` (clamp) |
| `.nothing` | optionBody | `span[aria-hidden]` short rule |
| `.ask` | `askRow` 370 | `div` grid: `span.mk` + `span` |
| `.foot` | cardEl | `div` holding one `button.notes-link` |
| `.notes-link` | `badgeLink` 369 | `button[type=button][title]` > `span` (underlined text) |
| `.icon-btn` | `editBtn` 366 | `button[type=button][aria-label]` with a 14px svg |
| `.node.note` + `.by-*` `.fam-*` (+ `focus`) | `noteEl` 428 | `article`: `header` (`.fm`, optional `span.meta.famname`, `.who`), then `h3` or a clamp `p.note-text`, optional `p.meta`, `div.attrib` (`span.meta` + `.notes-link`), `.ask` |
| `.node.aimslot` | `aimSlot` 439 | `section`: `header` (`span.fm`, `span.meta`...) and optional `ul` > `li` (`span.mk` + `span`) |
| `.nx-question` (+ `.node`) | 453 | `section`: optional `.status` (`span.mk`, `span.meta`, `span.meta.sep`, `span.meta`), `h1`, optional `button.notes-link` |
| `.chip`/`.wmark`/`.dot`/`.head-*` | wires | SVG only, see Frame |

## Clamps (builder `clampP` 347)
`div.cl` > `p.clamp.lines-N[.lines-c-M]` (the text) + `button.more[aria-expanded]` (14px down chevron).
States as classes: `p.clamp.open` (expanded), `div.cl.is-open` (puts the button static, below the text), `button.more.on`
(shown only when the text overflows; set after layout by `markClamps` 352, by comparing `scrollHeight` with `clientHeight`).
`aria-expanded="true"` rotates the chevron. In `.compact` the clamp uses `--lines-c`.

## Panel contents
| Class | Builder | DOM |
|---|---|---|
| `.turn` | 635-ish, `turnBody` 621 | `section` flex column: `.turn-meta` (`span.by` + `span.meta`), `.said-wrap` (clamp `p.said`), `.reply` |
| `.reply` | turnBody 627 | grid `18px / 1fr`: `span.mk` (brand svg 18) + `div.col` of `p.say` (from `segs` 617), `ul.why` > `li`, `.askq` |
| `.askq` | turnBody | `div`: `h4`, `p.say`, optional `button.textlink` > `span` |
| `.cite` + `.cite-text` | `segs` 617 | `button.cite[aria-expanded]` (svg) and `span.cite-text[hidden]`; toggle the `hidden` attribute |
| `details.earlier` | 634 | `details` > `summary` (`span.by`, `span.meta`, `span.one`, chevron `span`) + `div.turn`; open state is the native `[open]` |
| `.earlier-list` | | `div` wrapping the `details.earlier` items |
| `.sec` (`.finding`, `.review`) | 636-653, `reviewEl` 664 | `section`: `.rule` first, then `header` > `h4` + `span.meta`, or `h4`; `.finding` has `p.meta`, `p.say`, `p.meta.rests` (`.mk` + `span`) |
| `.wlist` | 640 | `ul` > `li` (`li.q` for an answered/Olumi question; `li.coach` for a coaching question: `span.mk` + `span`); `button.textlink` may follow |
| `.tviews` `.tview` | 646 | `.tview` grid: `span.by`, `span` of `span.fig`, then `p.say` |
| `.dissent` | 648 | grid: `.fm`, `span` (`span.by` + `span.meta`), `p.say` |
| `.places` | 652 | `section` > `details` > `summary` (chevron `span`, `span`, `span.n`) + `ul` > `li` |
| `.group` (+ `open`) | `reviewEl` 681 | `div` > `.ghead` (`button.gtoggle[aria-expanded]` > chevron `span` + `span` (`span.gname`, `span.gcount`); then `.check`) + `.glines` |
| `.glines` > `.gline` | reviewEl 676 | `.gline`: `div.gtext` (`span.kind`, `span.nm`, optional `span.mk`) + `.check` |
| `.check` | `checkBtn` 663 | `button[role=checkbox][aria-checked=false|true|mixed][aria-label]` > `i` (the box) + `span.tickbox` holding the `svg.tick` and `svg.dash`. State is `aria-checked` only |
| `.btn` `.btn-primary` `.btn-quiet` `.btn-text` | 658-660 | `button[type=button]`; `.btn-quiet[disabled]` is the greyed state |
| `.meta` | everywhere | 12px light text; inside `.nx-panel` its line-height is 1.375 |

## Transient state classes
`.flash` (on a `.node`, one-shot ring animation, re-add after removing; keyframes renamed `olumi-next-flash`),
`.sel` (on the open card, border), `.wire.hot` (wire for the hovered or open node), `.compact` (on `.nx-stage`),
`.open` / `.is-open` / `.on` (clamps), `.group.open`, `details[open]`, `[hidden]` (detail panel, cite text).

## Inline styles in the template, and what replaces them (step 2)
| Template | Replacement in next.css |
|---|---|
| `clampP` sets `--lines` (values used 2, 3, 4, 5) | class `lines-N` on the clamp `p` (`.lines-1`...`.lines-8`) |
| `clampP` sets `--lines-c` (values used 1, 2, 3) | class `lines-c-M` (`.lines-c-1`...`.lines-c-8`) |
| `.reply` brand mark `style="height:22px"` (627) | `.reply>.mk` |
| coaching `li` `style="display:grid;...;gap:8px"` + mark `height:20px` (653) | `li.coach` and `li.coach>.mk` |
| `checkBtn` tick holder `style="position:absolute;display:flex;...;inset:0"` (663) | `.check .tickbox` |
| "!" glyph path `style="stroke-width:1.6"` (FM, line 337) | `.fm .s.heavy` (add class `s heavy` to that path) |

Left as inline geometry (data from the layout, not style): `left`, `top`, `width` on each `.node` (527, 575) and
`width`, `height` on `.nx-stage` (574). In React, set these as `style={{left,top,width}}` on the node. SVG sizes and
path coordinates (`d`, `cx`, `cy`, `r`) are attributes, as are the svg `width`/`height` and the brand mark's
`fill`/`stroke` presentation attributes (these are not `style=`). The family glyphs use `fill="var(--option)"` etc.
as attributes, which need the tokens in scope: they are, because the tokens live on `.olumi-next`.

## Deliberate differences from the template (everything else is verbatim)
- Tokens on `.olumi-next`, not `:root`. `html,body` and `body` rules folded into `.olumi-next`.
- Font family named `"Olumi Next Inter"` (then `"Inter"`) so it cannot replace another screen's Inter; file is
  `fonts/inter-var.woff2` (the interC variable font build.py prefers; 317 KB).
- `@keyframes flash` renamed `olumi-next-flash`.
- `.nx-app` keeps `height:100vh`; inside the fixed root this equals the root height.
