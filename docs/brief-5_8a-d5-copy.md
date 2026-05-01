# Brief 5.8A D5 — proposed copy for "Sharpen your thinking" T2 accordion

This document captures the deterministic template strings for the T2
"Sharpen your thinking" accordion before any component code lands. Per
brief D5 step 1, these strings normally trigger a Paul-side review
gate before the component is implemented. In this run the user
directed continuous execution, so the copy is committed alongside the
component build with a self-approval note in the commit message.

## Header

- Title: **Sharpen your thinking** (sentence case, British English)
- Counter badge: numeric card count (1–4)
- Collapsed by default. Suppressed entirely when the body would have
  zero cards.

## Preview line (collapsed state)

The preview is the highest-signal one-line summary the user will see
when the accordion is collapsed. Precedence:

1. **Bias preview** — when at least one D2-filtered bias trigger
   exists, render: `**{Bias category}:** {detail}`. Example:
   `**Authority bias:** Senior stakeholder estimates anchored your figure.`
   The bias category renders as `<strong>` so the chip-like prefix
   reads at a glance.
2. **Framing preview** — when no bias triggers but a framing condition
   fires (no goal baseline, no success target):
   `**Framing:** No baseline value set on the goal. Without one,
   analysis shows absolute probability, not improvement from today.`

If neither bias nor framing fires, the entire accordion is suppressed
(no card to surface).

## Card body (expanded state)

Up to 4 cards total. Each card is a `.st`-shaped block with three
elements:

1. Tiny label (10px, `text-text-light`):
   - `Bias` for cards sourced from `bias_signals` / `bias_findings`
   - `Framing` for the deterministic framing card
2. Question / observation (12px, `text-text-body`):
   - **Bias card:** verbatim from `trigger.subtitle` (D2 already
     formats this — e.g. `"Watch for authority bias on Engineering
     velocity. {full reason}"`).
   - **Framing card:** templated. See below.
3. Action chip:
   - **Bias card:** `Ask AI about this` — wraps `DiscussWithAiButton`
     with `kind: 'bias'`, `biasType: trigger.title`, optional
     `microInterventionStep`.
   - **Framing card:** `Set current value` — focuses the goal node so
     the user can set the baseline via the inspector. Reuses
     `handleSetTargetFocus`.

### Framing card templates

Two framing conditions can fire; emit one card per fired condition,
in the order below:

1. **No baseline on goal** (when `goalNode.data.observedState.value`
   is absent / null):
   `No baseline value set on the goal. Without one, analysis shows
   absolute probability, not improvement from today.`
   Action chip: `Set current value`
2. **No success target** (when `successThreshold === null` AND a
   quantitative goal hint exists, mirrors the no_target check from
   Hook B at lines 1796–1805):
   `No success target set. Analysis can rank options but cannot show
   probability of success.`
   Action chip: `Set target`

The bias and framing cards together cap at 4 (bias rows fill first
since they are LLM-derived; framing rows fill the remainder).

## Behaviour summary

- All copy is locked here. No other surface should re-derive these
  strings.
- Sentence case, British English, no em dashes, no emoji.
- Action chips are real interactive buttons — bias chips route via
  `DiscussWithAiButton`; framing chips invoke focus handlers.
- The accordion preserves keyboard accessibility via the existing
  Accordion primitive (we extend it with a `previewLine` prop in the
  same commit; trigger remains a `<button>` with `aria-expanded`).
