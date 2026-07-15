# V6 BUILD SPEC — Olumi Analysis tab (ratified design contract)

Source of truth: `analysis-tab-prototype-build-ready-v6.html` in this directory (590 lines; `<html lang="en-GB">`, proto:3).
All `proto:NNN` references are line numbers in that file. All `src/…:NNN` references are `origin/staging` of
`/Users/paulslee/Documents/GitHub/DecisionGuideAI` (working tree is dirty/behind — do not trust it).

Conventions: every copy string below is VERBATIM (British English). "Producer-owned state" = the simulated
control-panel states in the prototype (proto:190–206) that stand in for real backend/CEE signals — they are
**not** product-visible controls (proto:192 "These simulate producer-owned states. They are not visible controls in the product.").

---

## 0. Producer-owned simulated states (the drive matrix)

| Control | Values (default first) | Mock mechanism | What it drives |
|---|---|---|---|
| `quality` | `ready` / `thin` / `conflict` (labels "Ready" / "Thin" / "Contradictory", proto:193) | class `quality-{value}` on `#mock` (proto:548–549) | brief-bar icon colour + state copy, brief auto-expand, brief-dot colours, conflict pause-read, hiding of analysis body/evidence/next-route |
| `fresh` | `current` / `stale` (labels "Current" / "Model edited", proto:194) | class `stale` toggled on `#mock` (proto:570) | freshness strip icon + copy line swap |
| `measure` | `missing` / `set` (proto:195) | classes `measure-missing`/`measure-set` on `#mock` (proto:207, 515, 570 — note: **no CSS selector references these classes**; they are pure state markers) | Goal-fit lens content, Goal brief-chip note, `success` recommendation status |
| `priority` | `clarify` / `broaden` / `challenge` / `evaluate` / `commit` (proto:196) | JS var `priority` (proto:416, 570) | recommendation sort order (matching `job` first), gating of `commit` rec, resets `visibleCount=1` |
| `diversity` | `diverse` / `narrow` (proto:200–205) | JS var `optionSetNarrow` (proto:417, 571–581) | gating of `broaden` rec, Options brief-chip note text |

Design boundary (proto:197, verbatim): "**Design boundary:** the Analysis tab owns framing quality, the current read, one next move and supporting evidence. Deeper dialogue opens in Olumi. Collaboration and outcome learning remain separate workstreams."

Workspace dock (proto:208): `<nav aria-label="Workspace tabs">` with buttons "Olumi", "Analysis" (`.active`), "Compare", "Model".

---

## 1. Decision overview card (`section.card.decision-overview#decisionOverview`, proto:210–249)

### 1a. DOM / behaviour
- Head row (`.decision-overview-head`, proto:211): meta label + `<h2>` + classification pills on the left, Actions menu (`.method-wrap.decision-actions`) on the right.
- Classification pills: `<div aria-label="Decision classification" class="decision-pills">` (proto:215) containing four `<button class="decision-pill" data-overview="…">`. Click → `openDrawer("Review ${data-overview}", "Help me check whether this decision classification is right and how it should affect the process.")` (proto:489–491). NB drawer title uses the raw data value, e.g. "Review stakes".
- **Actions menu**: `#methodToggle` ghost-button, `aria-expanded="false|true"` (proto:223, 461); `#methodMenu` `aria-label="Methods and global actions"` (proto:224), positioned *below* the trigger in this placement (`.decision-actions .method-menu{top:34px;bottom:auto;right:0}`, proto:146). When expanded the trigger gets info border + header text colour (proto:147). Menu items are `.method-button` (strong title + span description), with `.method-heading` group labels and rendered in source order (proto:456–460). On item click: menu closes, `aria-expanded` reset (proto:462). Routing (proto:463–465):
  - "Rerun analysis" → clears `stale`, sets fresh control to `current`, toast "Analysis rerun completed with the current model".
  - "Edit decision brief" → `openDrawer('Review my decision brief','Challenge the framing across Goal, Context, Constraints and Options.')`.
  - Every other item → `openDrawer(title, description)`.
  - ⚠ No outside-click/Escape dismissal is implemented — the real app must add it.
- **Brief bar**: `#briefToggle` full-width button with `aria-expanded` (proto:227–231): status dot `●` (`.brief-status-icon`, `aria-hidden`), `.brief-state` + `.brief-state-note` stacked, chevron `⌄` rotating 180° when `#decisionOverview` has `.brief-open` (proto:85). Click toggles `.brief-open` + `aria-expanded` (proto:467). Boot forces collapsed (proto:583–584). Quality `thin`/`conflict` auto-expands and sets `aria-expanded="true"`; `ready` collapses (proto:555–568).
- **Brief details** (`.brief-details`, hidden unless `.brief-open`, proto:86): 2×2 `.brief-grid` of `.brief-chip` buttons (`data-brief="Goal|Context|Constraints|Options"`). Each chip: `.brief-dot` (7px circle, border `--success` by default; `.warn` → `--warning` only under `.quality-thin`; `.conflict` → `--danger` only under `.quality-conflict`, proto:89) + `<strong>` name + note span. Chip click → `openDrawer("Review ${brief}", "Help me strengthen the ${brief.toLowerCase()} in my decision brief.")` (proto:468).
- Brief actions row (proto:239): text-button `data-open-brief` → same drawer as "Edit decision brief" (proto:469).
- **Framing question** (`.framing-question`, inside brief-details, proto:240–248): meta label, question `<p>`, then two actions:
  - `ghost-button data-direct-edit="Goal"` "Answer directly" → `openDrawer('Edit Goal','Update this part of the persisted decision brief directly.')` (proto:492–494).
  - `text-button data-ask="Work through the framing question"` "Work through with Olumi" → ⚠ the shared `[data-ask]` handler (proto:542) titles the drawer **'Resolve the brief conflict'** with the `data-ask` value as context — a prototype quirk; the real app should title it after the actual task.
- Status icon colours: ready `--success`, thin `--warning`, conflict `--danger` (proto:84, reinforced scoped at proto:152–153).

### 1b. Copy (verbatim)
- Meta: "Decision overview" (proto:213). Title: "Technical Co-Founder" (proto:214).
- Pills: "High stakes" · "Reversible" · "12-month horizon" · "Risk cautious" (proto:216–219). Trigger: "Actions ⌄" (proto:223).
- Brief state by quality (proto:552–568):
  - ready: "Framing has the basics" / "Goal, context, constraints and options"
  - thin: "Framing needs one clarification" / "The goal is broad or important context is missing"
  - conflict: "The brief contains a conflict" / "Resolve it before relying on the read"
- Chips (proto:234–237): Goal → note `.goal-note` "Success measure missing" (becomes "`${metric}: ${threshold}${unit}, ${timeframe}`" after save, e.g. "Productivity: 20%, within 6 months", proto:515); Context → "Challenge is clear"; Constraints → "Key limits captured"; Options → note `.options-note` "Four distinct routes" (diversity narrow → "Three of four use the same mechanism", proto:574).
- Brief actions: "Review your decision brief" · "Olumi challenges one issue at a time." (proto:239).
- Framing question: "Olumi's framing question" / "What would make bringing on a co-founder clearly better than hiring a senior technical lead?" / "Answer directly" / "Work through with Olumi" (proto:242–247).
- Actions menu items (proto:445–454), `title` / `description`:
  - **Methods**: "Reframe the problem" / "Check whether the current question is too narrow." · "Generate a materially different option" / "Use divergent thinking before narrowing." · "Consider the opposite" / "Build the strongest case against the current leader." · "Apply the outside view" / "Compare with a relevant reference class." · "Run a pre-mortem" / "Imagine failure and capture plausible causes." · "Explore trade-offs" / "Make gains and sacrifices explicit." · "Review a possible bias" / "Use only biases grounded in this brief or model."
  - **Global actions**: "Edit decision brief" / "Review Goal, Context, Constraints and Options." · "Review all inputs" / "Inspect the current model inputs without changing them." · "Rerun analysis" / "Run the analysis against the current model."
  - Group headings: "Methods", "Global actions".

### 1c. Driving state
`quality` (icon colour, state copy, auto-expand, dot colours); `measure` (goal-note text); `diversity` (options-note text); `fresh` (reset via "Rerun analysis" item).

### 1d. Tokens
`--panel-header` (card h2 14px), `--panel-body` (12px), `--panel-meta` (11px labels/notes), `--text-header/--text-body/--text-light`, `--border-default` (chip/pill/menu borders, dividers), `--bg-panel-hover` (hovers), `--success/--warning/--danger` (status icon + dots), `--info` (expanded trigger border, text-buttons), `--shadow-2` (menu), radii: pills 999px, chips 9px, menu 12px, menu buttons 8px.

---

## 2. Freshness strip (`section.status-strip`, proto:249–255)

### 2a. DOM / behaviour
`aria-label="Analysis freshness"`. Layout: `●` `.status-icon` (aria-hidden) + one visible copy line + spacer + `ghost-button.rerun` "Rerun". `.status-current` shown by default; `.mock.stale` swaps to `.status-stale` and turns the icon `--warning` (proto:70–71). Rerun click: remove `stale`, reset control, toast "Analysis rerun completed with the current model" (proto:505).

### 2b. Copy
- current: "Analysis reflects the current model."
- stale: "The model changed after this analysis."
- Button: "Rerun".

### 2c. Driving state
`fresh` (`current`/`stale`). Cleared by either Rerun surface (strip button or Actions-menu "Rerun analysis").

### 2d. Tokens
`--success` (current icon), `--warning` (stale icon), `--text-header` (stale copy weight of colour, proto:70), `--panel-body`, `--border-default`, `--bg-panel`, `--shadow-1`, radius 12px.

### Real-app deviation (freshness)
The prototype models only current/stale. The app contract is four-valued: `freshness?: 'fresh' | 'stale' | 'unknown' | 'none'` (`src/adapters/cee/types.ts:410`), where `'unknown': CEE could not determine freshness` (`src/adapters/cee/types.ts:406`) and absent/invalid values coerce to `'unknown'` (`src/adapters/cee/types.ts:409` "Absent on legacy responses; treated as 'unknown' by the UI."; contract tests `src/__contracts__/__tests__/analysisReadyContract.spec.ts:266–277`). Hydrated/historical results must display the cannot-confirm state (`src/canvas/__tests__/store.spec.ts:474,496`), CEE `fresh` + locally dirty graph degrades to `unknown` (`src/canvas/blueprints/__tests__/commitTemplateGraph.spec.ts:50`), and `unknown` must NEVER be rendered as "stale" (no fabrication — `src/canvas/compare-tab/__tests__/CompareTabBody.freshness.spec.tsx:75–76`). **The strip therefore needs a third visual state (cannot-confirm) with its own copy; do not reuse the stale line.**

---

## 3. Merged analysis panel (`section.card.hero#hero`, `data-component="merged-analysis-panel"`, `aria-label="Analysis"`, proto:256–313)

### 3a. Headline / subline
`h2.hero-headline` "Bring On Technical Co-Founder is slightly ahead." + `p.hero-subline` "It also has the strongest expected outcome, but the top two remain close." (proto:258). Hidden (with lenses, lens-body, summary) under `.quality-conflict` (proto:103).

### 3b. Lenses (4-tab segmented control)
`div.lenses[role=tablist][aria-label="Analysis lenses"]` (proto:259–264) with `button.lens[role=tab]`: "Goal fit" (`data-lens="goal"`), "Likely outcome" (`data-lens="outcome"`, default `.active`), "Stability" (`data-lens="stability"`), "What changed" (`data-lens="changed"`). Click swaps `.active` on lens + matching `.lens-view[data-view]` (proto:471). ⚠ Prototype sets no `aria-selected`/`aria-controls` and no arrow-key nav — real app must implement full tab semantics. Active lens = `--primary` fill + `--text-on-colour`.

- **Goal fit — measure missing** (proto:266, re-rendered by `renderGoalView(false)` proto:507): `.unavailable` row — `ⓘ` (aria-hidden) + "Goal fit needs a measurable success definition. " + text-button `.open-success` "Define success" (opens the Define-success modal).
- **Goal fit — measure set** (`renderGoalView(true)`, proto:507): option-table without range tracks — rows 1–4 with values "72%", "64%", "31%", "27%" (row 1 `.leading`), footer meta "Probability of meeting the success measure."
- **Likely outcome** (proto:267–275): `div.option-table[aria-label="Expected outcome by option"]`; each `.option-row` is a grid `24px minmax(0,1fr) 43px` (proto:97): `.option-number` (stable 1–4; bordered `--option`; leading row: `--info` background + `--text-on-colour`, proto:98), `.option-name` (2-line clamp), `.option-value` right-aligned, then full-width `.range-track` (grid-column 2/4, 7px) with `.range-fill` (option tint, leading = info tint) + `.range-dot` (10px, 2px `--bg-panel` border). Values/geometry:
  1. "Bring On Technical Co-Founder" "+26%" fill left 18% width 64%, dot 58% (leading)
  2. "Hire Senior Technical Lead" "+20%" fill 14%/60%, dot 51%
  3. "Continue Without Technical Lead" "0%" fill 7%/18%, dot 15%
  4. "Outsource Technical Leadership" "-7%" fill 2%/22%, dot 11%
  Footer meta: "Expected change versus the current approach. Ranges show plausible outcomes."
- **Stability — honest unavailable** (proto:276): "Per-option stability is not produced yet. Olumi will not infer it in the UI."
- **What changed — honest unavailable** (proto:277): "This unlocks with versioned run comparisons. Olumi will not approximate it locally."

### 3c. Summary chips
`.hero-summary` (proto:279): `button.summary-link[data-focus]` — "Main driver: Market Timing Pressure" (`data-focus="Market Timing Pressure"`) and "Top flip risk: Technical Leadership Capacity" (`data-focus="Technical Leadership Capacity"`). Click → toast `Focused ${data-focus} on the canvas` (proto:472).

### 3d. Conflict pause-read
`.pause-read` shown ONLY under `.quality-conflict` (proto:104), which also hides headline/subline/lenses/lens-body/summary (proto:103) AND the evidence toggle, evidence body and next-route (proto:171–173). Content (proto:281): `<strong>`"Resolve the conflicting brief before relying on this read."`</strong>` + card-copy "The brief says speed is the priority but also says delivery date does not matter. Olumi needs one clarification." + primary-button `data-ask="Resolve the conflict in my decision brief"` "Resolve with Olumi" → drawer titled "Resolve the brief conflict" with that context (proto:542).

### 3e. Collapsed evidence toggle + Drivers / Flip risks / Trade-offs
- Toggle `#analysisEvidenceToggle` (`aria-expanded`, proto:282–288): strong "Why and what could change it" + sub-span "Drivers, flip risks and trade-offs" + chevron `⌄` (rotates when `#hero` gains `.analysis-evidence-open`, proto:163). Click toggles `.analysis-evidence-open` and `aria-expanded` (proto:475–478). Body `#analysisEvidence` hidden unless open (proto:164–165).
- Tabs (`role=tablist`, proto:289): `.tab-button` "Drivers" (active) / "Flip risks" / "Trade-offs" (`data-evidence="drivers|flips|tradeoffs"`), same active-swap pattern (proto:496–501); same missing aria-selected caveat.
- **Drivers** (proto:289–296): note "Ranked by effect on the analysed outcome. Evidence quality is separate." Rows `.evidence-row[data-focus]` (grid `minmax(0,1fr) 80px 58px`, clickable → toast `Focused ${data-focus} on the canvas`, proto:502): sign `+`/`-` (`.sign.pos` `--success` / `.sign.neg` `--danger`) + name, `.evidence-bar` (6px, `--info` fill `<i>`), `.evidence-meta` right:
  - "+ Market Timing Pressure" 100% "Low evidence"
  - "- Founder Equity Dilution" 87% "Low evidence"
  - "+ Engineering Capacity" 66% "Low evidence"
  - hidden `.extra-evidence`: "- Ongoing Salary Cost" 58% "Low evidence" (`style="display:none"`, proto:294)
  - Footer text-button `.see-all-evidence` "See all factors" ↔ toggles the extra row (display `grid`) and relabels to "Show fewer" (proto:503).
- **Flip risks** (proto:296–301): note "Chance the leading option changes when a relationship is varied within its plausible range." Rows (name uses `→` glyph; `data-focus` uses "… to …" wording):
  - "Technical Leadership Capacity → Technical Quality" bar 96%, "48% switch"
  - "Founder Equity Dilution → Retention" 72%, "36% switch"
  - "Ongoing Salary Cost → Runway" 62%, "31% switch"
  - Footer meta: "If the top relationship under-delivers, option 2 becomes the likely leader."
- **Trade-offs** (proto:302–305): note "What the two leading routes gain, give up and depend on." Two `.trade-row`s, each `.trade-title` (option-number + name) + 2×2 `.trade-grid` of `.trade-cell` (strong label + span):
  - 1 "Bring On Technical Co-Founder": You gain / "Long-term technical ownership" · You give up / "Equity and hiring time" · Depends on / "Finding the right partner" · Watch / "Runway and role clarity"
  - 2 "Hire Senior Technical Lead": You gain / "Faster execution capacity" · You give up / "Ongoing salary cost" · Depends on / "Delegated authority" · Watch / "Founder bottlenecks"

### 3f. Next-recommendation route
`.analysis-next-route` (proto:306–313): icon `◎` (`.analysis-next-icon`, `--info`, aria-hidden) + meta "Next recommendation" + strong "Define a measurable success measure" + ghost-button `#openRecommendation` "Open". Click (proto:479–488): smooth-scrolls `#strengthCard` into view (`block:'start'`) and force-opens the first `.recommendation` (adds `.open`, sets its head `aria-expanded="true"`). ⚠ The strong text is **static** in the prototype — the real app must derive it from the current top recommendation.

### 3g. Driving state
`quality` (conflict collapses the whole panel to pause-read); `measure` (Goal-fit lens content + which rec the route targets); producer analysis payload supplies headline, options, ranges, drivers, flip risks, trade-offs (all copy above is fixture data for the "Technical Co-Founder" decision).

### 3h. Tokens
`--primary` (active lens/tab fill — value equals `--info` #63ADCF), `--text-on-colour`, `--option` #AAA7E4 (option numbers, range fill/dot; non-token tint `rgba(170,167,228,.38)` proto:100), `--info` (leading fills; non-token tint `rgba(99,173,207,.38)`), `--success`/`--danger` (driver signs), `--border-default` (tracks, bars, dividers), `--text-header/-body/-light`, `--panel-header/-body/-meta`, `--bg-panel-hover` (row hover). ⚠ The two `rgba()` tints and the `→`/`◎`/`ⓘ`/`⌄` glyphs are hard-coded, not tokenised.

---

## 4. Strengthen card (`section.card#strengthCard`, proto:314–323)

### 4a. Adaptive recommendation model (THE schema)
Array `recommendations` (proto:408–415). Fields per item:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | stable key (`success`, `broaden`, `assumption`, `range`, `bias`, `commit`) |
| `job` | enum `clarify\|broaden\|challenge\|evaluate\|commit` | matched against producer `priority` for ordering/gating |
| `icon` | enum `target\|grid\|shield\|scale\|check\|clock\|range` | inline 24×24 stroke SVG, 17px render (proto:397–406; `clock` defined but unused) |
| `title` | string | head line |
| `signal` | string | one-line evidence signal under the title |
| `why` | string | body paragraph |
| `tip` | string | rendered as "**Try this** {tip}" (`.try-line`, "Try this" in `--info`, proto:113) |
| `source` | string | provenance line (`.source-line`, meta size/colour) |
| `action` | string | primary button label |
| `actionType` | enum `success\|broaden\|ask` (+ `commit` branch exists in handler, proto:437) | routes the primary action |

Per-item runtime state `recState`: `status: 'recommended' | 'progressing' | 'addressed' | 'dismissed'` (proto:418).

### 4b. The six recommendations (verbatim, proto:409–414)
1. `success` · clarify · target — "Define what success looks like" · "Goal fit is unavailable" · "Your goal is understandable, but Olumi cannot test whether an option succeeds until the outcome has a measurable threshold and timeframe." · tip "Keep the goal in plain language. Add a metric, direction, threshold, unit and timeframe." · source "Triggered because the goal has no valid success measure." · action "Define success" (`success`).
2. `broaden` · broaden · grid — "Find a route that is not hiring" · "Three of four options use the same mechanism" · "The current set may be converging too early. A materially different route is more useful than another hiring variation." · tip "Explore a partnership, specialist studio, scope reduction or internal capability route." · source "Uses the producer-owned option-similarity signal." · action "Generate a different option" (`broaden`).
3. `assumption` · challenge · shield — "Test the assumption most likely to change the leader" · "48% chance of switching the leader" · "Technical Leadership Capacity to Technical Quality is not the largest driver, but it is the relationship most likely to change the recommendation." · tip "Look for evidence that leadership capacity reliably improves technical quality in comparable teams." · source "Prioritised from recorded flip risk, not influence." · action "Plan an evidence check" (`ask`).
4. `range` · evaluate · range — "Give Engineering Capacity a realistic range" · "High influence, low evidence" · "A single figure hides uncertainty in one of the most important inputs." · tip "Use a plausible low and high estimate based on past delivery, not an optimistic point estimate." · source "Triggered by sensitivity and low evidence quality." · action "Set a range" (`ask`).
5. `bias` · challenge · scale — "Consider the strongest case against option 1" · "No counter-argument captured" · "The model contains the case for the current leader, but not the strongest opposing explanation." · tip "Use a consider-the-opposite dialogue, then add any surviving concern to the model." · source "Grounded in the missing-counterargument critique." · action "Challenge the leader" (`ask`).
6. `commit` · commit · check — "Record the decision and what would trigger a rethink" · "The model is ready for a provisional choice" · "A lightweight record preserves ownership and makes later review possible without turning Olumi into project management." · tip "Capture the choice, confidence, rationale, assumption to watch and revisit trigger." · source "Shown only when commitment is the highest-value move." · action "Create a decision record" (`ask` — ⚠ see defect D1).

### 4c. Ordering / gating (proto:419–425)
`orderedRecommendations()`: drop `addressed`/`dismissed`; drop `broaden` unless `optionSetNarrow`; drop `commit` unless `priority==='commit'`; sort recs whose `job === priority` first, otherwise original array order. `visibleCount` starts at 1 (only the top rec visible; the rest get `.hidden-rec`); index 0 (or all when `allExpanded`) renders `.open` with head `aria-expanded="true"` (proto:426).

### 4d. Row DOM + interactions (proto:426, 431–438)
`article.recommendation[data-rec]` → `button.recommendation-head` (grid `22px minmax(0,1fr) 18px`; icon / title+signal / chevron `›` rotating 90° when open, proto:110–111) + `.rec-body` (visible when `.open`): why ¶, try-line ¶, source-line ¶, `.rec-actions`: `primary-button.rec-primary[data-action-type]` {action} · `ghost-button.rec-focus` "Focus on canvas" · `text-button.rec-dismiss` "Not relevant" · `icon-button.rec-ask` "✦" with `title`/`aria-label` "Work through this with Olumi" (right-aligned via `margin-left:auto`, proto:114).
- Head click: toggle `.open` + `aria-expanded`.
- `.rec-focus`: toast `Focused ${rec.title} on the canvas`.
- `.rec-ask`: `openDrawer(rec.title, rec.why)`.
- `.rec-dismiss`: status `dismissed`, re-render, toast "Recommendation dismissed".
- Primary by `actionType` (proto:437): `success` → open Define-success modal; `commit` → open Record-decision modal; `broaden` → status `addressed`, re-render, toast "Added option 5: Partner with a specialist product studio"; anything else (`ask`) → status `progressing`, re-render, `openDrawer(rec.title, rec.tip)`.
- `progressing` renders an inline pill `<span class="rec-state progressing">In progress</span>` after the title (proto:426; `--info` border/colour, proto:112).

### 4e. Header / footer / addressed panel
- Header (proto:315): title "Strengthen your model"; `#progressText` static seed "0 addressed · 5 worth checking" — immediately re-rendered at boot to the computed `` `${addressed} addressed · ${worth} worth checking` `` (proto:427); with defaults (clarify/diverse/missing) worth = 4, so users see "0 addressed · 4 worth checking". `icon-button#addressedToggle` "✓" `aria-label`+`title` "Show addressed recommendations" toggles `#addressedPanel.open` (proto:442).
- Empty list state (proto:427): "No recommendations need attention right now."
- Footer (proto:318–322): `#showMore` — hidden unless worth > 1; label `` `Show ${worth-visibleCount} more` `` when collapsed, else "Show fewer"; click flips `visibleCount` between full count and 1 (proto:440). `#expandAll` — "Expand all" ↔ "Collapse all", toggles `allExpanded` (proto:441). (Static HTML seed "Show 3 more".)
- Addressed panel (proto:317, 428): meta "Addressed or dismissed"; items = check icon + title for every `addressed`/`dismissed` rec; empty state "Nothing addressed yet."

### 4f. Driving state
`priority` (ordering + commit gating + visibleCount reset), `diversity` (broaden gating + prototype toast "Prototype: producer-owned option-similarity signal is active.", proto:577), `measure` (success rec toggles addressed↔recommended, proto:515, 570).

### 4g. Tokens
`--factor` #B0A899 (rec icons, proto:111), `--info` ("Try this", In-progress pill, ✦ icon-button colour, text-buttons), `--success` (addressed pill CSS + receipt border — dead in v6, see D6), `--primary/-hover/-active` (primary buttons), `--border-default`, `--text-header/-body/-light`, `--panel-body/-meta`, `--bg-panel-hover`.

---

## 5. Advanced receipts (`<details>`, proto:324)

Collapsed by default (no `open` attr). Summary: "Advanced and receipts" + trailing `›` (inline-styled `margin-left:auto;color:var(--text-light)`). Body `dl.receipt-grid` (2-col `auto 1fr`, meta size, proto:129): "Simulations" → "4,000" · "Freshness" → "Graph hash match" · "Result stability" → "Tentative" · "Result hash" → "8ce04678…". No JS. Tokens: `--panel-header` (summary), `--panel-meta` (grid), `--text-light` (dt), `--bg-panel`, `--border-default`, `--shadow-1`, radius 12px.

---

## 6. Define-success modal (`#successModal`, proto:329–344)

### 6a. DOM / behaviour
`div.overlay[role=dialog][aria-modal=true][aria-labelledby=successTitle]`; `.open` class displays it (flex-centred, scrim `rgba(38,38,38,.28)` — not tokenised, proto:132). Card `min(430px,100%)`, max-height 90vh. Close: `.close-success` icon-button `aria-label="Close"` ("×") and "Cancel" ghost. Open via any `.open-success` (Goal-fit lens link, success rec primary) — `openSuccess()` focuses `#threshold` (proto:510).
- Fields (proto:333–338): `#metric` input, label "What outcome should improve?", default value "Productivity" (full-width) · `#direction` select "Direction" — options "Increase by at least" / "Reach at least" / "Keep below" · `#threshold` input "Threshold", `inputmode="decimal"`, placeholder "20" · `#unit` select "Unit" — options "%", "projects", "weeks", "£" · `#timeframe` input "Timeframe", placeholder "Within 6 months" · `#baseline` input "Baseline or evidence, optional", placeholder "Current productivity or source" (full-width).
- Live preview `#measurePreview` (goal-yellow border `--goal`, proto:132): static seed "Success means: increase Productivity by at least [number]% within [timeframe]." but `updatePreview()` (proto:514, run at boot proto:586) composes `` `Success means: ${direction.toLowerCase()} ${metric||'[outcome]'} ${threshold||'[number]'}${unit} ${(timeframe||'[timeframe]').toLowerCase()}.` `` — ⚠ word order differs from the seed (see D4).
- Write-semantics note (proto:340): "This updates the analysis success measure and reruns the analysis. It does not change the graph structure."
- Validation (proto:515): metric, threshold, unit, timeframe all required (trimmed) AND `Number(threshold)` finite; failure shows `#measureError` "Add a number and timeframe so Olumi can evaluate Goal fit." Baseline optional; direction always valid.
- **Save and rerun** (`#saveSuccess`, proto:515) on success: hide error → mock `measure-missing`→`measure-set` → Goal chip note becomes "`${metric}: ${threshold}${unit}, ${timeframe}`" → `success` rec `addressed` → re-render recs → close modal → sync measure control → toast "Success measure updated. Analysis rerun without changing graph structure." → `renderGoalView(true)` → programmatically activates the Goal-fit lens.

### 6b. Copy
Title "Define success"; intro "Keep the goal in plain language, then give Olumi a measurable test for Goal fit."; buttons "Cancel" / "Save and rerun". (Field labels/options/placeholders/error/note as above, all verbatim.)

### 6c/6d
Driven by `measure`; on save flips it to `set`. Tokens: `--goal` #F5C433 (preview border), `--danger` (error), `--info` (field focus border; non-token focus ring `rgba(99,173,207,.25)` on modal textareas proto:179), `--border-default`, `--bg-panel`, `--panel-meta` (labels), `--panel-body` (inputs), field radius 9px, card radius 12px, `--shadow-1` (modal-card base style, proto:63).

---

## 7. Record-decision modal (`#decisionModal`, proto:345–388)

### 7a. DOM / behaviour
Same overlay/dialog pattern; `aria-labelledby="decisionRecordTitle"`. `openDecision()` focuses `#decisionConfidence` (proto:519). Close: `.close-decision` ("×" aria-label "Close", "Cancel").
- Prototype note (`.prototype-note`, proto:354): "Prototype only. Durable saving depends on identity and Model Management."
- Fields (proto:355–381): `#chosenOption` select "Chosen option" — options "1. Bring On Technical Co-Founder" / "2. Hire Senior Technical Lead" / "3. Continue Without Technical Lead" / "4. Outsource Technical Leadership" (full) · `#decisionConfidence` "Confidence, 0–100", `inputmode="numeric"`, placeholder "e.g. 70" · `#revisitDate` "Revisit trigger or date", placeholder "e.g. runway falls below 9 months" · `#decisionRationale` textarea "Concise rationale", placeholder "Why this is the best current choice", rows 3 (full) · `#assumptionWatch` "Key assumption to watch", placeholder "The assumption most likely to change the choice" (full).
- Validation (proto:522–532): confidence must be a finite number in [0,100]; rationale, assumption and revisit all non-empty; else show `#decisionError` "Add confidence, rationale, an assumption to watch and a revisit trigger."
- Save (`#saveDecision` "Capture prototype record", proto:534–537): `commit` rec → `addressed`, re-render, close, toast "Prototype decision record captured in this session."

### 7b. Copy
Title "Record the decision"; intro "Capture the choice and what would justify revisiting it."; buttons "Cancel" / "Capture prototype record"; note + labels + placeholders + error verbatim above.

### 7c/7d
Intended trigger: commit rec primary when `priority==='commit'` (see defect D1 — currently unreachable). Tokens: same modal set as §6 minus `--goal`.

---

## 8. Olumi drawer (`#olumiDrawer`, proto:388–391)

`div.drawer[aria-label="Olumi coaching session"]`, fixed right 18px bottom 18px, width `min(370px, calc(100vw - 36px))`, z-index 25, `.open` displays (proto:133). Head strong "Work through it with Olumi" + `#closeDrawer` "×" (`aria-label="Close"`). Body: `#drawerContext` (info-bordered box; default "Context will appear here.") + `#drawerMessage` textarea `aria-label="Message to Olumi"` + actions `#focusFromDrawer` ghost "Focus on canvas" / `#sendDrawer` primary "Send".
- `openDrawer(title, context)` (proto:541): context box gets `<strong>{title}</strong><br>{context}`; textarea prefilled `` `Help me work through: ${title}` ``.
- Send → toast "Sent to Olumi with the relevant model context", closes drawer (proto:544). Focus → toast "Focused the relevant model elements on the canvas" (does not close).
- Every "deeper dialogue" surface routes here: brief chips, review-brief links, framing-question buttons, classification pills, method menu items, rec ✦ / ask-type primaries, pause-read "Resolve with Olumi".
Tokens: `--info` (context border), `--shadow-2`, `--border-default`, `--bg-panel`, `--panel-header` (head), radii 12px/9px.

---

## 9. Toast (`#toast`, proto:392, 395–396)

`role="status"`, fixed bottom-centre pill, background `--text-header`, colour `--text-on-colour`, `max-width:min(90vw,430px)`, radius 999px, opacity transition .2s (shown at .96), auto-hide after **1800 ms**, single-instance (re-trigger resets timer). Honour `prefers-reduced-motion` (global kill at proto:135). Complete toast catalogue (all verbatim):
- `Focused ${name} on the canvas` (summary chips, evidence rows, rec "Focus on canvas")
- "Analysis rerun completed with the current model"
- "Recommendation dismissed"
- "Added option 5: Partner with a specialist product studio"
- "Success measure updated. Analysis rerun without changing graph structure."
- "Prototype decision record captured in this session."
- "Sent to Olumi with the relevant model context"
- "Focused the relevant model elements on the canvas"
- "Prototype: producer-owned option-similarity signal is active." (control-panel only; not product copy)

---

## 10. Design tokens — `:root` values (proto:9–33)

| Token | Value | Principal uses |
|---|---|---|
| `--bg-canvas` | `#F4F0EA` | page + mock background |
| `--bg-panel` | `#FEFEFE` | cards, strip, modals, drawer, menus, inputs, range-dot border |
| `--bg-panel-hover` | `#FEF9F3` | all button/row hovers |
| `--border-default` | `#EEE6D8` | every default border, dividers, tracks/bars |
| `--text-header` | `#262626` | headings, values, toast bg, overlay scrim base |
| `--text-body` | `#3F3F3E` | body copy |
| `--text-light` | `#908D8D` | meta, labels, chevrons, inactive lens/tab |
| `--text-on-colour` | `#FFFFFF` | text on primary/info fills, toast text |
| `--danger` | `#EA7B4B` | conflict icon/dot, negative sign, errors |
| `--success` | `#67C89E` | ready/current icons, default brief-dots, positive sign, addressed accents |
| `--info` | `#63ADCF` | text-buttons, icon-buttons, active-segment border, field focus, drawer context, "Try this", In-progress, flip bars, next-route icon |
| `--warning` | `#FFA656` | thin icon/dot, stale icon |
| `--goal` | `#F5C433` | measure-preview border only |
| `--option` | `#AAA7E4` | option numbers, range fill/dot |
| `--factor` | `#B0A899` | recommendation icons |
| `--primary` | `#63ADCF` | primary buttons, active lens/tab fill (== `--info` by value) |
| `--primary-hover` | `#67C89E` | primary hover (== `--success` by value) |
| `--primary-active` | `#5AA88A` | primary active |
| `--panel-header` | `14px` | card titles, modal/drawer heads, summary, next-icon |
| `--panel-body` | `12px` | body, buttons, inputs, rows |
| `--panel-meta` | `11px` | meta, labels, chips, signals, receipts |
| `--shadow-1` | `0 1px 2px rgba(38,38,38,.06)` | cards/strip/controls |
| `--shadow-2` | `0 4px 12px rgba(38,38,38,.10)` | mock, menus, drawer |

**Non-tokenised literals the app must map to its DS:** option range tint `rgba(170,167,228,.38)` and info tint `rgba(99,173,207,.38)` (proto:100); overlay scrim `rgba(38,38,38,.28)` (proto:132); textarea focus ring `rgba(99,173,207,.25)` (proto:179); toast opacity `.96`; Inter font stack (proto:35); disabled opacities `.4` (primary) / `.55` (lens); glyph characters `● ⌄ › ✓ ✦ × ◎ ⓘ →`.

---

## 11. Deviations the real app must handle (prototype omissions)

1. **Freshness `unknown` (cannot-confirm) + `none`.** Prototype: binary current/stale. App: `'fresh' | 'stale' | 'unknown' | 'none'` (`src/adapters/cee/types.ts:410`; coercion tests `src/__contracts__/__tests__/analysisReadyContract.spec.ts:266–277`; hydrate/historical → unknown `src/canvas/__tests__/store.spec.ts:474,496`; fresh+dirty → unknown `src/canvas/blueprints/__tests__/commitTemplateGraph.spec.ts:50`; unknown must not render as stale `src/canvas/compare-tab/__tests__/CompareTabBody.freshness.spec.tsx:75`). The strip needs distinct cannot-confirm copy and icon treatment.
2. **No orphan banner.** The app surfaces `showOrphanBanner` from `useAnalysisStateSource` (`src/canvas/hooks/useAnalysisStateSource.ts:38`, true at `:102` for orphaned plot results; gate spec `src/canvas/hooks/__tests__/useAnalysisDisplayState.orphanGate.spec.ts:37`) and suppresses the analysis footer while it shows (`src/canvas/components/OutputsDock.tsx:724–725`, `:2277`). The v6 layout must reserve this banner slot above the merged panel.
3. **No sticky robustness footer.** The app renders `AnalysisFooter` (`src/canvas/components/OutputsDock.tsx:114`, `:2278`; pre-analysis wrapper `src/canvas/components/pre-analysis/StickyFooter.tsx:133`) whose verdict obeys ROBUSTNESS-VERDICT-CONTRACT (`src/canvas/components/utils/postAnalysisFooter.ts:8–37`): only the display-safe `robustnessVerdict` may produce a verdict — `robust` → "Stable result", `moderate|fragile` → "Sensitive to assumptions", `not_assessed` → "Robustness not assessed", missing → "Robustness unknown"; raw stability % appears only as neutral meta beside a determinate verdict. The prototype's only stability surface is the "Result stability — Tentative" receipt (proto:324); building v6 must not drop the certified footer lane.
4. **"Rerun analysis" is a real async run**, not an instant class flip (proto:463/505 fake it): needs pending/error states and must be the sole primary action per the footer contract (`src/canvas/components/OutputsDock.tsx:1224`).

### Prototype defects/quirks to correct (do NOT replicate)
- **D1 — commit rec never opens the Record-decision modal**: `commit` has `actionType:'ask'` (proto:414) while the handler's `openDecision()` branch requires `actionType==='commit'` (proto:437). Intended wiring is `commit` → modal (the modal's save marks the `commit` rec addressed, proto:534).
- **D2 — `[data-ask]` drawer title is hard-coded** to 'Resolve the brief conflict' (proto:542), mis-titling "Work through with Olumi" on the framing question.
- **D3 — static strings that must become derived**: next-route "Define a measurable success measure" (proto:310), progress seed "0 addressed · 5 worth checking" (real boot value is 4, proto:315 vs 427), footer seed "Show 3 more" (proto:319).
- **D4 — preview word order**: `updatePreview()` yields "increase by at least Productivity 20% within 6 months" (proto:514); ship the seed's order "increase Productivity by at least 20% within 6 months" (proto:340).
- **D5 — accessibility gaps**: tablists without `aria-selected`/`aria-controls`/arrow keys (proto:259, 289); no focus trap, Escape or overlay-click close on modals/drawer/menu; focus not restored on close.
- **D6 — dead code**: `.rec-receipt` + `.rec-state.addressed` CSS (proto:112, 115) never rendered by `recMarkup` (addressed recs are filtered out entirely); `icons.clock` unused (proto:403); `measure-missing`/`measure-set` classes unreferenced by CSS; `.quality-thin #decisionOverview{scroll-margin-top:10px}` (proto:182) has no scroll trigger.
- **D7 — decision modal option list is a static copy** of the four options (proto:359–362); must bind to the live option set (including any generated "option 5").
