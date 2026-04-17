# Brief 4 pre-analysis hotfix — screenshot checklist

Paste staging screenshots and tick the acceptance items inline. Closes the
final open verification for the pre-analysis hotfix before post-analysis work
begins.

Staging URL: https://staging--olumi.netlify.app/#/canvas

---

## Bundle A — Mid-market acquisition (5 model adjustments)

_Screenshot:_ `<paste here>`

Acceptance:

- [ ] **Task 1 — ModelAdjustments count.** Header reads exactly
      "Olumi adjusted 5 factors". Expanded list shows 5 rows, one per raw
      adjustment (not 1 row per distinct code).
- [ ] **Task 4 — Start here badge.** The Start here card has no "0" circle
      next to the title. Green left-border + "Start here" label are still
      present.
- [ ] **Task 5 — Improve confidence counts match.** Accordion header count
      equals subtitle count ("N items could strengthen confidence") in both
      the closed and open states. Zero-state (count = 0) renders
      "Your model looks well-calibrated." instead of the pluralised sentence.
- [ ] **Task 2 — Subtitle no truncation.** Any triage subtitle that fits in
      ≤ 2 lines renders in full. No "…" ellipsis on short subtitles like
      "Connects to 2 downstream relationships".
- [ ] **Task 6 — Options coaching consistency.** When `hasSameLeversCheck` is
      true, the same narrow-framing coaching copy appears in both the
      collapsed and expanded option views. "Explore alternatives" link
      renders whenever `onSendMessage` is wired.

---

## Bundle B — Assistant hiring (Annual Assistant Cost `cap=70000`)

_Screenshot:_ `<paste here>`

Acceptance:

- [ ] **Task 1 — ModelAdjustments count.** Header reads "Olumi adjusted
      1 factor" (or the correct N for this bundle). Expanded row count
      matches header.
- [ ] **Task 3a — Editor empty.** The Annual Assistant Cost inline input is
      empty (placeholder "Set value"), not pre-filled with "$0" / "£0".
- [ ] **Task 3b — Cap hint subtitle.** Below the title the card body shows
      "Brief suggests up to: £70,000" (unit-prefixed) instead of the
      card-body "$0" fallback.
- [ ] **Task 3c — Genuine-zero tolerance.** The hedged "Brief suggests up
      to: X" wording is defensible: it never claims the brief stated X as
      the current value, only that it allows up to X. (Manual sanity check —
      no further assertion if you don't have a genuine-zero bundle to hand.)
- [ ] **Task 4 — Start here badge.** No "0" circle.
- [ ] **Task 5 — Improve confidence counts match.** Header / subtitle
      numeric parity.
- [ ] **Task 2 — Subtitle no truncation.**

---

## Cross-bundle sanity

- [ ] **Variant parity.** Both bundles render cards in the default variant
      (top triage) and the compact variant (AlsoConsider disclosure). For
      both variants: Task 2 subtitle expansion works, Task 4 optional
      ordinal works, EVPI pp pill renders when `evoiImpact` is set.
- [ ] **No "AI estimate. Does this match?" string** anywhere in the
      pre-analysis panel (archived copy).
- [ ] **No "… downstream"** truncation artefact anywhere.

---

## Sign-off

- [ ] Screenshots captured and pasted above for both bundles.
- [ ] All acceptance boxes ticked.
- [ ] Any divergence logged as a follow-up ticket (not silently accepted).

Sign-off date: `<YYYY-MM-DD>`
Signed: `<name>`
