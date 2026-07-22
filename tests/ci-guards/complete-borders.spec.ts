/**
 * complete-borders guard — the one-sided-accent preventer (V7 Lane L1).
 *
 * THE RULE (Paul, ruled repeatedly; re-ruled 23 Jul 2026 with a screenshot of the
 * draft-error card): analysis-surface cards/rows/panels carry COMPLETE borders
 * only — never a one-sided coloured accent edge. A card that wants to signal
 * state does it through the border COLOUR (state-colour on all four sides) or a
 * badge/tint, never through a lone `border-l-[3px]` / `border-t-2` / `border-l-info`
 * stripe. This guard reads the source of the analysis-surface content-card files
 * swept in L1 and fails if any single-side border accent is reintroduced.
 *
 * WHY A SOURCE SCAN, AND WHY COMMENT-STRIPPED. The rule is a design convention, so
 * it is enforced by reading the source. Comments are stripped FIRST via the shared
 * literal-aware `stripComments` (tests/helpers/stripSourceComments) — the JSX-aware
 * stripper the alpha-emission and plotFetch guards use — because this repo's
 * dominant guard footgun (#385/#386) is a source scan reddening CI over a class
 * that lives only in a comment or a documentation example. A `border-l-[3px]`
 * written in a JSDoc block ships nothing and must not fail CI; the COMMENT control
 * at the foot of this file pins that.
 *
 * WHAT IT FLAGS (on comment-stripped source):
 *   · `border-{l,r,t,b}-[<arbitrary>]`  e.g. border-l-[3px], border-t-[3px]
 *   · `border-{l,r,t,b}-<width≥1>`      e.g. border-l-4, border-t-2, border-b-2
 *   · `border-{l,r,t,b}-<colour>`       e.g. border-l-info, border-t-danger,
 *                                            border-l-carrot-500
 *   · inline `border{Left,Top,Right,Bottom}: …` (non-transparent)
 *
 * WHAT IT DOES NOT FLAG (documented exclusions — none of these is a coloured
 * accent on a content card, per §3.3 of V6-RESPEC-2026-07-23):
 *   · Neutral hairline row separators — `border-t` / `border-b` with NO width
 *     digit (1px) + a neutral colour (`border-panel-border`, `border-sand-200`).
 *     The width regex requires a digit ≥1, so these never match; the colour regex
 *     requires the colour to sit directly after the side letter (`border-b-<c>`),
 *     which a separated `border-b … border-sand-200` never forms.
 *   · Width-zero resets — `border-{l,r,t,b}-0` (e.g. `last:border-b-0`): the width
 *     regex is `[1-9]`, so a `-0` reset is ignored.
 *   · Loading-spinner arcs (`animate-spin … border-b-2`), the RangeLabels CSS
 *     triangle, the FloatingOlumiPanel resize-handle corner, and the dock
 *     tab-underline indicators (`border-b-2 border-info`) — none live in the
 *     content-card set below, so they are out of scope by file selection.
 *
 * SWEPT IN V7 L2 (the last two one-sided accents — Paul's rule is categorical):
 *   · §16 conversation coaching blocks (V5CoachingBlock `bias_signal` variant):
 *     `border-l-[3px] border-info` -> complete `border border-info`.
 *   · §17 toast notifications (ToastContext inline `borderLeft: 3px` ->
 *     complete `border: 1px`).
 *   Both files are now in the scan set below and their design-contract specs
 *   pin the complete-border form. No surface remains behind a colour exception.
 *
 * CONTROLS (run every CI pass, not once by hand):
 *   · POSITIVE — a synthetic `border-l-[3px]` and a `border-t-2` MUST be flagged,
 *     proving the scanner can see a violation at all.
 *   · NEGATIVE — a complete `border border-danger`, a neutral `border-b
 *     border-panel-border` separator, and a `last:border-b-0` reset must NOT be
 *     flagged, proving the scanner is accent-scoped rather than a blunt
 *     "no border-b anywhere" rule.
 *   · COMMENT — a `border-l-[3px]` that exists ONLY inside a `//` and a block
 *     comment must NOT be flagged (the #385/#386 footgun).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { stripComments } from '../helpers/stripSourceComments'

const SRC = resolvePath(__dirname, '../../src')

/**
 * The analysis-surface content-card files swept in V7 Lane L1. This is the
 * scan set: the rule is enforced here, so a reintroduced accent in any of these
 * files reddens CI. (New analysis-surface cards should be added to this list.)
 */
const CONTENT_CARD_FILES = [
  'canvas/components/pre-analysis/PreAnalysisPanel.tsx',
  'components/results/TriageActionCardsBody.tsx',
  'components/results/ConfidenceSection.tsx',
  'canvas/components/GuidanceCard.tsx',
  'canvas/components/ActionsSignal.tsx',
  'canvas/components/ValidationPanel.tsx',
  'canvas/components/InsightsTab.tsx',
  'canvas/components/ProvenanceHubTab.tsx',
  'canvas/components/GraphTextView.tsx',
  'canvas/components/EdgeFunctionTypeSelector.tsx',
  'canvas/components/model-tab/ModelTabHeader.tsx',
  'canvas/ui/inspector/InspectorGuidanceSection.tsx',
  'components/assistants/ProvenanceChip.tsx',
  // V7 L2 — the final two one-sided accents, now converted to complete borders.
  'v5/blocks/V5CoachingBlock.tsx',
  'canvas/ToastContext.tsx',
]

/** Single-side border width with an arbitrary value: `border-l-[3px]`. */
const ACCENT_WIDTH_ARBITRARY = /\bborder-[lrtb]-\[/
/** Single-side border width ≥1: `border-l-4`, `border-t-2` (not `-0` resets). */
const ACCENT_WIDTH_NUMERIC = /\bborder-[lrtb]-[1-9]/
/** Single-side border COLOUR: `border-l-info`, `border-t-danger`, `border-l-carrot-500`. */
const ACCENT_COLOUR_SIDE =
  /\bborder-[lrtb]-(?:danger|info|success|warning|carrot|banana|sky|sand|option|mint|sun|lilac|ink|paper|slate|gray|grey|zinc|neutral|red|blue|green|amber|yellow|orange|emerald|rose)\b/
/** Inline single-side border style: `borderLeft:`, `borderTop:` … (non-transparent). */
const INLINE_SIDE = /\bborder(?:Left|Top|Right|Bottom)\s*:/

interface Violation {
  file: string
  line: number
  token: string
  snippet: string
}

/** Scan already-comment-stripped text for one-sided border accents. */
function findAccentViolations(stripped: string, file: string): Violation[] {
  const out: Violation[] = []
  const lines = stripped.split('\n')
  lines.forEach((line, i) => {
    for (const re of [ACCENT_WIDTH_ARBITRARY, ACCENT_WIDTH_NUMERIC, ACCENT_COLOUR_SIDE]) {
      const m = re.exec(line)
      if (m) out.push({ file, line: i + 1, token: m[0], snippet: line.trim().slice(0, 120) })
    }
    // Inline single-side border style, excluding a transparent edge (CSS-triangle idiom).
    if (INLINE_SIDE.test(line) && !/transparent/.test(line)) {
      const m = INLINE_SIDE.exec(line)
      if (m) out.push({ file, line: i + 1, token: m[0], snippet: line.trim().slice(0, 120) })
    }
  })
  return out
}

describe('complete-borders guard: analysis-surface content cards carry complete borders only', () => {
  it('has no one-sided coloured border accent in any swept content-card file', () => {
    const violations: Violation[] = []
    for (const rel of CONTENT_CARD_FILES) {
      const abs = resolvePath(SRC, rel)
      const text = readFileSync(abs, 'utf8')
      const stripped = stripComments(text, abs)
      violations.push(...findAccentViolations(stripped, rel))
    }
    if (violations.length) {
      const report = violations
        .map((v) => `  ${v.file}:${v.line}  ${v.token}  ${v.snippet}`)
        .join('\n')
      throw new Error(
        `One-sided border accent(s) found — convert to a complete border ` +
          `(carry the state colour on all four sides):\n${report}`,
      )
    }
    expect(violations).toHaveLength(0)
  })

  // ── Self-test controls (prove the detector is neither blind nor over-eager) ──

  it('POSITIVE control: flags border-l-[3px] and border-t-2 accents', () => {
    const positive = [
      `<div className="rounded-md border border-panel-border border-t-[3px] border-t-danger" />`,
      `<div className="px-4 py-3 border-l-4 border-l-info" />`,
      `<div className="border-t-2 border-info/40 pt-3" />`,
    ].join('\n')
    const found = findAccentViolations(stripComments(positive, 'control.tsx'), 'control.tsx')
    expect(found.length).toBeGreaterThanOrEqual(3)
  })

  it('NEGATIVE control: does not flag complete borders, neutral separators, or -0 resets', () => {
    const negative = [
      `<div className="rounded-md border border-danger px-4 py-2.5" />`,
      `<div className="border border-info/50 bg-info/[0.02]" />`,
      `<li className="border-b border-panel-border last:border-b-0" />`,
      `<div className="py-2 border-t border-sand-200 first:border-t-0" />`,
    ].join('\n')
    const found = findAccentViolations(stripComments(negative, 'control.tsx'), 'control.tsx')
    expect(found).toHaveLength(0)
  })

  it('COMMENT control: a border-l-[3px] living only in a comment is not flagged', () => {
    const commented = [
      `// legacy coaching card used border-l-[3px] border-l-info here`,
      `/* MVS card: border-l-[3px] border-l-success (retired in V7 L1) */`,
      `<div className="border border-success/30 rounded-lg" />`,
    ].join('\n')
    const found = findAccentViolations(stripComments(commented, 'control.tsx'), 'control.tsx')
    expect(found).toHaveLength(0)
  })
})
