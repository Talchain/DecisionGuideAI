# Brief 5.5 — Staging walkthrough template

Use after merge to staging. Viewport: **1280×900**. Bundles: use a mid-complexity model with 2–3 options, 3–5 factors, and analysis complete.

---

## Setup

- Open the Analysis tab on a fully-analysed bundle (status = complete, 2+ options).
- Have a second bundle ready with `needs_work` tier + stability ~0.75 for gate testing.
- Have a bundle with 3+ fragile edges pointing to different alt-winners ready.

---

## Section 1 — Typography scale (D3)

| Check | Expected | Forbidden | Evidence |
|---|---|---|---|
| All section titles | 14px semibold (panelHeader) | raw text-sm, font-semibold classes | Dev tools inspect |
| Body copy throughout | 12px regular (panelBody) | raw text-xs | |
| Pill labels, subtitles | 11px regular (panelMeta) | raw text-[11px] | |
| Hero probability number | 32px semibold (heroDisplay) | any raw size | |

---

## Section 2 — Section headers (D4 + D18 cleanup)

| Section | Expected | Forbidden |
|---|---|---|
| "Your options" heading | 14px title + 10px purple square (no tooltip icon) | "(i)" icon next to title |
| All other section headers | Clean panelHeader title, no (i) icons | Info icon adjacent to title text |
| Your expertise | "Your expertise" heading only; no (i) icon | Any Info icon in the header row |
| Your options (OptionPreview) | "Your options" heading + count pill + chevron; no (i) icon | Any Info icon |
| Accordion expanded state | No info-colour border/outline change | border-info or bg-info-light on expand |

---

## Section 3 — Bar vocabulary (D7)

| Check | Expected | Forbidden |
|---|---|---|
| Influence bar (Drivers) | Orange or green fill, direction-keyed | Any blue fill |
| Confidence indicator (Drivers) | 4 dots, neutral (grey-body/panel-hover), no percentage text | Bar with orange/green/blue fill |
| Tornado bars | Orange (weaker) + green (stronger), centred | Any other treatment |
| Trust narrative bars (Advanced) | Single-fill left-anchored | Bidirectional / dot pattern |
| Visual collision test | Confidence dots look distinct from sensitivity bar | Confusion between the two columns |

---

## Section 4 — Numbered badges (D6)

| Section | Expected badge colour | Evidence |
|---|---|---|
| Review next | Blue (bg-info) | Inspect badge background |
| Top evidence / Highest-value gaps | Blue (bg-info) | |
| Improve confidence | Purple (bg-option, not brown) | |
| Fragility rows | No numbered badges | |
| Option cards | No "#N of M" prefix; colour marker visible | |

---

## Section 5 — Tier-soften gate (D8)

### Bundle A: tier=needs_work, stability≈0.87
| Check | Expected |
|---|---|
| Hero headline | "Option A leads by N points" (no "currently") |
| Winner chip | "What makes this lead?" |
| Footer | "Stable result · 87%" |

### Bundle B: tier=needs_work, stability≈0.75
| Check | Expected |
|---|---|
| Hero headline | "Option A currently leads by N points" |
| Winner chip | "What makes this the current leader?" |
| Footer | "Stability sensitive · 75%" |
| Evidence caveat | Visible below hero |

### Bundle C: tier=strong, stability≈0.95
| Check | Expected |
|---|---|
| Hero headline | "Option A is the leading option" |
| Winner chip | "What makes this lead?" |
| Footer | "Stable result · 95%" |

---

## Section 6 — AttentionBanner removed (D9)

| Check | Expected | Forbidden |
|---|---|---|
| Area between DCP and "Your options" | No standalone factor card | Any unlabelled card with "Validate" + "Research" buttons |
| Dominant-factor warning (≥80% influence) | "Your result depends heavily on one factor" card with Validate + Research chips | — |

---

## Section 7 — Top evidence (D10)

| Check | Expected |
|---|---|
| Section heading | "Highest-value evidence gaps" in panelHeader |
| Subtitle | "Factors where new information would most reduce uncertainty" |
| Science nudge cards (if present) | Preceded by "Model checks" sub-header |
| Evidence gap cards | TriageCard shell throughout — no ScienceNudgeCard shell in gaps section |

---

## Section 8 — Fragility grouping (D11)

### Bundle with 2 fragile edges sharing the same alt-winner:
| Check | Expected |
|---|---|
| Card count | One card (grouped) |
| Header | "2 factors could flip the result to {Y}" |
| Per-trigger rows | "If Factor A shifts", "If Factor B shifts" (separate) |
| Review chips | One per trigger, fires per-edge focus |

### Bundle with edges pointing to different alt-winners:
| Check | Expected |
|---|---|
| Card count | One card per distinct alt-winner |

---

## Section 9 — Something Missing (D12)

| Check | Expected |
|---|---|
| Pre-analysis panel | "Something missing from the model?" + helper copy + sparkle + dismiss X |
| Results panel (above Advanced) | "Something missing from the results?" + helper copy + sparkle + dismiss X |
| Both dismiss buttons | Focus-visible ring visible on Tab; tooltip "Dismiss" on hover |
| Visual match | Both surfaces render identical shell; only copy differs |

---

## Section 10 — Driver row density (D13)

| Check | Expected |
|---|---|
| Row 1 (top driver) | Direction arrow + name + technique hint (if applicable) + tooltip icon |
| Rows 2+ | Name only (no arrow, no tooltip icon); ExpandableCoachingText on long names |
| Confidence column | 4-dot indicator on all rows |
| Semantic pill | All rows retain pill ("High impact, low evidence" etc.) |

---

## Section 11 — Option cards (D17)

| Check | Expected | Forbidden |
|---|---|---|
| Winner card | Green 10px square + option name | "#1 of 2" text |
| Runner-up card | Blue 10px square + option name | "#2 of 2" text |
| Third card | Purple 10px square + option name | |
| Ordinal borders | Unchanged from V14.2 | |
| Indeterminate state | No colour markers | |

---

## Section 12 — Structural repairs notification (D14)

| Check | Expected |
|---|---|
| Advanced section | "Olumi applied N model adjustments" line absent |
| Model tab (verify not regressed) | "N model adjustments" still visible there |

---

## Section 13 — D5 regression check

| Check | Expected |
|---|---|
| Pre-analysis panel header/readiness area | No "N assumptions to review and N quality suggestions to consider" text | 

---

## Sign-off footer

```
Walkthrough completed by: _______________
Bundle used: _______________
Date: _______________
Viewport: 1280×900  ☐  Other: ___
All checks passed: ☐ Yes  ☐ No (see attached)
Push approved: ☐ Yes  ☐ No
```
