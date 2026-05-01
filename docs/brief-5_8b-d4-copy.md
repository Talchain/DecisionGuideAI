# Brief 5.8B — D4 Stress-test copy proposals

Per the D4 built-in approval gate, this document contains the proposed
template strings for the post-analysis "Stress-test your decision" T2
accordion. **No component code has been written yet — implementation
begins only after these strings are approved.**

The accordion replaces the current `ChallengeSection` ("Before you decide").

The body has three subsections:

1. **Sensitive assumptions** — node-based, sourced from
   `factor_sensitivity` where `rank_flip_rate ≥ 0.15` (max 3).
2. **Thinking patterns** — two deterministic templates from
   `stressTestTemplates.ts` (Disconfirmation + Outside view).
3. **Fragile factors** — edge-based, preserves the existing 5.7 D11
   alt-winner grouping verbatim.

A counter badge on the header sums all subsections.

---

## 1. Header

| Slot              | String                                |
| ----------------- | ------------------------------------- |
| Header title      | `Stress-test your decision`           |
| Counter badge     | `{N}` (total across all subsections)  |

---

## 2. Preview line (collapsed state)

The collapsed preview line uses the top factor by `rank_flip_rate`. Two
variants depending on whether any factor exceeds the threshold:

| Condition                                 | Preview                                                               |
| ----------------------------------------- | --------------------------------------------------------------------- |
| At least one factor `rank_flip_rate ≥ 0.15` | `Key challenge: {topFactorLabel} dominates. Should its influence be revisited?` |
| No factor crosses the threshold            | `Review your key assumptions`                                         |

Right-aligned link inside the preview row: `Explore →`.

---

## 3. Sensitive assumptions subsection

Subsection header: `Sensitive assumptions ({N})`.

Per-card layout (full width, single column):

| Slot          | Source                                | String / template                                                         |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| Top-left tag  | static                                | `Sensitive` (10px, `panelMeta`, `text-warning`)                           |
| Card body     | `factor_sensitivity[i].factor_label`  | `{factorLabel}. A shift could change the recommendation.`                 |
| AI chip       | static                                | `What if this changes?`                                                   |

Empty-state for the subsection (no factor crosses threshold): omit the
subsection entirely (do not render an empty heading).

---

## 4. Thinking patterns subsection (2 deterministic templates)

Subsection header: `Thinking patterns (2)`.

### 4a. Disconfirmation card

Inputs: `winnerLabel`, `topDriverLabel`, `topDriverConfidence`,
`alternativeLabel`.

Confidence is sourced from `factor_sensitivity` (the authoritative
post-analysis source per `useResultsSectionData.ts:1316-1322`), NOT from
any per-row triage `confidence` field that may shadow it.

| Slot          | Condition                              | Template                                                                                              |
| ------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Question      | always                                  | `What evidence would change your mind about {winnerLabel}?`                                          |
| Context line  | `topDriverConfidence < 0.5`             | `Your confidence in {topDriverLabel} is below 50% — that is the most likely place a counter-case sits.` |
| Context line  | `topDriverConfidence >= 0.5`            | `Look for the strongest piece of evidence against {winnerLabel} you can find.`                       |
| AI chip       | always                                  | `Help me steelman the alternative`                                                                   |

### 4b. Outside view card

Inputs: `winnerLabel`, `alternativeLabel`.

| Slot          | Template                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Question      | `If a peer outside this decision picked {alternativeLabel} over {winnerLabel}, what would they have seen?` |
| Context line  | `Outside views often catch assumptions you have stopped questioning.`                              |
| AI chip       | `Run an outside view`                                                                              |

---

## 5. Fragile factors subsection

Subsection header: `Fragile factors ({N})`.

Source: `fragile_edges`. The render reuses the existing 5.7 D11
alt-winner grouping verbatim. **No copy changes** — this subsection is
preserved as-is to keep the locked alt-winner grouping intact.

Empty-state: omit the subsection entirely.

---

## 6. Empty state (whole accordion)

If all three subsections evaluate to zero, the accordion still renders
collapsed with the fallback preview `Review your key assumptions` and
the body shows a single muted line:

```
No stress-test signals fired. Your model is currently consistent.
```

---

## Open question for Paul

- Is "Sensitive" the right tag label for the top-left badge on
  factor-sensitivity cards (alternatives considered: "Hinge",
  "Pivotal", "Watch-out")?
- Is the AI-chip wording (`What if this changes?`,
  `Help me steelman the alternative`, `Run an outside view`) consistent
  enough with the rest of the panel's chip vocabulary?
- The "Outside view" context line is intentionally generic — should it
  reference a specific outside-view technique (peer review, reference
  class, red-teaming) or stay neutral?

---

**Halt.** Awaiting Paul's approval before continuing with the D4 component
build.
