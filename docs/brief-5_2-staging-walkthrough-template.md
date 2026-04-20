# Brief 5.2 — staging walkthrough evidence template

**Deploy:** Netlify build from staging commit `8679ea79`
**Target URL:** `https://<staging-host>/` + debug bundle 609164c7 (needs_work + needs_evidence + 10 fragile edges + 97.4 % winner)
**Viewport:** 1280×900

## How to capture evidence

For each acceptance check below, record one runtime artefact — a screenshot, a DOM selection excerpt, an interaction log, or a console assertion. Paste under the check. Don't mark a check ✅ without an artefact.

## Acceptance checks

### 1. Hero reads "{Winner} currently leads by N points" + caveat

- **Expected:** `"Option A currently leads by 95 points"` in the main hero, caveat banner `"Result depends on factors with limited evidence. See Top evidence value."` below.
- **Forbidden:** `"clear leading option"`, `"95-point advantage"`, `"is the leading option"`.
- **Evidence:** _screenshot or copy of hero text block_

### 2. Footer "Stability sensitive", NOT "Stable result · 97 %"

- **Expected:** Footer reads `"Stability sensitive · N % of influence · 97 %"`.
- **Forbidden:** `"Stable result · "`.
- **Evidence:** _footer screenshot or text_

### 3. No hex hash in standard view

- **Expected:** No 7+ char hex token anywhere on the page. Open Advanced section — it should not reveal `data-testid="advanced-hash-row"`.
- **Evidence:** _full-page screenshot + DevTools Elements pane search for `[data-testid="advanced-hash-row"]` returning 0 matches_

### 4. Missing data rows default-open

- **Expected:** Each Missing data row shows factor label + `"Not set"` + inline `ScientificEditor` open with input field + `"Try: …"` technique hint + sparkle button. **No Pencil icon.**
- **Evidence:** _screenshot of the first Missing data row in Your expertise expanded state_

### 5. Fragility rows: ≤2 lines, single arrow, stripped alt-winner, top-right pill, per-row chip

- **Expected:** Each fragility row fits in 2 lines at 1280 px. Exactly one `→` character between the shift phrase and the alt-winner. `"(Status Quo)"` not visible. `"Stability"` pill sits top-right of the card. `"Review this relationship"` chip renders per row, focuses the correct source factor when clicked.
- **Evidence:** _screenshot of the fragility card + devtools inspection of chip click on 2+ rows to confirm `onFocusNode` fires with row-specific id_

### 6. Technique chip clickable — opens chat with technique context

- **Expected:** Clicking the `"Try: reference class forecasting"` / `"Try: outside view technique"` hint opens chat pre-filled with `"How do I apply {technique} to \"{factor label}\"?"`.
- **Evidence:** _screenshot of chat panel after click, or interaction-log output of the `onSendMessage` call payload_

### 7. Expertise sparkles opacity-50 at rest

- **Expected:** `DiscussWithAiButton` instances inside AiEstimated + MissingData rows render at ~50 % opacity when not hovered / focused; reveal to full opacity on hover, keyboard focus, and parent `focus-within`.
- **Evidence:** _two screenshots: (a) sparkle at rest, (b) sparkle after Tab-focusing it_

### 8. "Your options" — collapsed and expanded render identical coaching

- **Expected:** The narrow-framing coaching sentence and "Explore alternatives" link are byte-identical across the collapsed and expanded state of the Your-options card.
- **Evidence:** _two screenshots, or DOM text excerpts, of the coaching block from each state_

### 9. Review next compact subtitle — no ellipsis

- **Expected:** Long subtitles in Review-next compact cards (e.g. `"Connects to 2 downstream relationships"`) either fully wrap or show a `"More"` toggle. The `…` ellipsis character should not appear.
- **Evidence:** _screenshot of the Review-next section with a long subtitle visible_

## Sign-off

Once every check has an artefact, stamp this file with date + walker name at the bottom and commit it. Close-out brief requires evidence per acceptance item.

_walked by: ______________ date: ______________ deploy SHA: 8679ea79_
