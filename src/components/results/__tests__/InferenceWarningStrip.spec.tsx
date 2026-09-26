/**
 * Lane UI-R3 (truth rendering) — roadmap 1.12: InferenceWarningStrip.
 *
 * Warning-severity producer inference_warnings surface as a compact
 * honest-caveat strip on the Analysis tab; info-severity entries stay
 * hidden. Copy is HUMANISED via humaniseCritique (V14.3 no-message-render
 * guard) — the UI keys off producer `code`, never the raw `message`.
 * Tagged provisional_doctrine_v0.
 *
 * Warning shapes mirror the real staging capture (debug bundle
 * olumi-debug-45c9b625-20260707): { code, message, severity }.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { InferenceWarningStrip, selectWarningSeverityEntries } from '../InferenceWarningStrip'
import type { InferenceWarning } from '../types'

const INFO_EDGE_SENSITIVITY: InferenceWarning = {
  code: 'EDGE_SENSITIVITY_UNAVAILABLE_V2_WIRE',
  affected_nodes: [],
  message:
    'Edge-level sensitivity was requested but the ISL V2 response format does not carry it — edge_sensitivity is empty by wire contract, not by computation failure. Factor-level sensitivity is unaffected.',
  severity: 'info',
}

const INFO_CONSTRAINT_BASE: InferenceWarning = {
  code: 'CONSTRAINT_NODE_DEFAULT_BASE',
  affected_nodes: [],
  message:
    "Node 'out_campaign_effectiveness' has no ParameterUncertainty — defaulted to base=0.0, constraint probability may be unreliable",
  severity: 'info',
}

const WARNING_CONSTRAINT_TARGET: InferenceWarning = {
  code: 'CONSTRAINT_TARGET_UNRELIABLE',
  affected_nodes: [],
  message:
    "The target for 'out_campaign_effectiveness' could not be reliably assessed - set an explicit range for this outcome to make the target meaningful.",
  severity: 'warning',
}

describe('selectWarningSeverityEntries', () => {
  it('keeps only severity === "warning" entries with a non-empty message', () => {
    const picked = selectWarningSeverityEntries([
      INFO_EDGE_SENSITIVITY,
      INFO_CONSTRAINT_BASE,
      WARNING_CONSTRAINT_TARGET,
    ])
    expect(picked).toEqual([WARNING_CONSTRAINT_TARGET])
  })

  it('never promotes entries with missing severity (UI does not invent severity)', () => {
    const noSeverity: InferenceWarning = {
      code: 'SOMETHING',
      affected_nodes: [],
      message: 'A message with no severity field.',
    }
    expect(selectWarningSeverityEntries([noSeverity])).toEqual([])
  })

  it('drops warning-severity entries without a usable message (no fabricated copy from code)', () => {
    const noMessage: InferenceWarning = {
      code: 'CONSTRAINT_TARGET_UNRELIABLE',
      affected_nodes: [],
      severity: 'warning',
    }
    expect(selectWarningSeverityEntries([noMessage])).toEqual([])
  })
})

describe('InferenceWarningStrip', () => {
  it('renders HUMANISED copy for a warning-severity entry, never the raw producer message', () => {
    render(<InferenceWarningStrip heldBackListedUnder="The listing section" warnings={[WARNING_CONSTRAINT_TARGET]} />)
    const strip = screen.getByTestId('inference-warning-strip')
    expect(strip).toBeInTheDocument()
    const entry = screen.getByTestId('inference-warning-strip-entry')
    expect(entry).toHaveAttribute('data-warning-code', 'CONSTRAINT_TARGET_UNRELIABLE')
    // ROADMAP 1.12: CONSTRAINT_TARGET_UNRELIABLE now has a CODE_TEMPLATES
    // entry (humaniseCritique.ts) — a meaningful, code-keyed title, NOT the
    // raw producer message verbatim and NOT the generic unmapped-code
    // fallback (superseded by the fix; was "Review this factor's inputs").
    // ⚠ NARROWED from the contiguous "success target can't be evaluated
    // reliably". This fixture carries no `affected_nodes`, so it takes the
    // template's ANONYMOUS branch — "A success target ON YOUR MODEL can't be
    // evaluated reliably" — and the old substring is interrupted by the very
    // clause that removes the fabricated "This factor". These two fragments are
    // present in BOTH branches, so the assertion binds to the template rather
    // than to one of its arms.
    // Re-pinned 26 Sep 2026: the code names a LIMIT, not a success target
    // (aLimitIsNotASuccessTarget.spec.ts). Both fragments sit in both forms.
    expect(entry).toHaveTextContent('limit')
    expect(entry).toHaveTextContent("can't be checked reliably")
    expect(entry).not.toHaveTextContent('success target')
    // And the sentinel must never reach this strip — the defect that occasioned
    // the change was this exact copy rendering it.
    expect(entry).not.toHaveTextContent('This factor')
    expect(entry).not.toHaveTextContent(WARNING_CONSTRAINT_TARGET.message as string)
  })

  it('humanises a template-mapped code via the shared code→title map, using the entry\'s own resolved label', () => {
    const missingObservedState: InferenceWarning = {
      code: 'MISSING_OBSERVED_STATE',
      affected_nodes: ['node_marketing_spend'],
      affected_labels: ['Marketing Spend'],
      message: "observed_state.value missing for fac_marketing_spend, defaulted",
      severity: 'warning',
    }
    render(<InferenceWarningStrip heldBackListedUnder="The listing section" warnings={[missingObservedState]} />)
    const entry = screen.getByTestId('inference-warning-strip-entry')
    // Template-derived, human-readable — uses the producer-resolved label.
    expect(entry).toHaveTextContent('Marketing Spend is missing a current value')
    // Never the raw internal-token-bearing message.
    expect(entry).not.toHaveTextContent(missingObservedState.message as string)
  })

  it('renders nothing when only info-severity entries exist (info stays hidden)', () => {
    const { container } = render(
      <InferenceWarningStrip heldBackListedUnder="The listing section" warnings={[INFO_EDGE_SENSITIVITY, INFO_CONSTRAINT_BASE]} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when warnings are absent or empty', () => {
    const { container: empty } = render(<InferenceWarningStrip heldBackListedUnder="The listing section" warnings={[]} />)
    expect(empty.firstChild).toBeNull()
    const { container: absent } = render(<InferenceWarningStrip heldBackListedUnder="The listing section" />)
    expect(absent.firstChild).toBeNull()
  })

  /**
   * ⭐⭐ SUPERSEDES "shows every warning-severity entry when several arrive (no
   * silent cap)" — 16 Sep 2026, and the original concern is KEPT, not dropped.
   *
   * That test's name is the argument: a cap the reader cannot see is a silent
   * truncation, and it would be worse than the crowding. So the rule is not
   * "show everything"; it is "show one, and say what is behind the tap". Both
   * halves are asserted below, and the held-back entries are proven reachable
   * in the detail row by `oneLimitationAtRest.spec.ts`, which measures the
   * complement on Paul's real 7-warning payload.
   *
   * Why the property changed: three independent readings of the deployed panel
   * said the same thing on 16 Sep — Paul's ("a big dump of mess below the top
   * sections"), the review note's ("repeatedly describe overlapping
   * limitations ... one prominent, specific next action"), and the panel
   * prototype's own rule that detail lives "out of the resting experience, one
   * tap away". On his run `1dd2133d` the strip carried three sentences about
   * ONE cause, with three more repeating it in the detail row.
   */
  it('shows ONE at rest and discloses the rest, rather than capping silently', () => {
    const second: InferenceWarning = {
      code: 'CONSTRAINT_TARGET_UNRELIABLE',
      affected_nodes: [],
      message: "The target for 'out_roi' could not be reliably assessed - set an explicit range for this outcome to make the target meaningful.",
      severity: 'warning',
    }
    render(
      <InferenceWarningStrip heldBackListedUnder="The listing section"
        warnings={[INFO_EDGE_SENSITIVITY, WARNING_CONSTRAINT_TARGET, second]}
      />,
    )
    expect(screen.getAllByTestId('inference-warning-strip-entry')).toHaveLength(1)
    const heldBack = screen.getByTestId('inference-warning-strip-held-back')
    expect(heldBack).toHaveTextContent('One more limitation')
    // Names the HOST's section, by identity — the strip no longer hardcodes one
    // (it said "How this was worked out", true on no surface; panel F5).
    expect(heldBack).toHaveTextContent('listed under The listing section.')
  })

  it('names no place when the host lists the held-back entries nowhere (null)', () => {
    const second: InferenceWarning = {
      code: 'CONSTRAINT_TARGET_UNRELIABLE',
      affected_nodes: [],
      message: "The target for 'out_roi' could not be reliably assessed - set an explicit range for this outcome to make the target meaningful.",
      severity: 'warning',
    }
    render(
      <InferenceWarningStrip
        heldBackListedUnder={null}
        warnings={[INFO_EDGE_SENSITIVITY, WARNING_CONSTRAINT_TARGET, second]}
      />,
    )
    const heldBack = screen.getByTestId('inference-warning-strip-held-back')
    expect(heldBack).toHaveTextContent('One more limitation is not shown here.')
    expect(heldBack).not.toHaveTextContent('listed under')
  })

  it('says nothing about a remainder when there is none', () => {
    // The discriminating twin: without it the disclosure could be unconditional
    // furniture, naming a remainder that does not exist.
    render(<InferenceWarningStrip heldBackListedUnder="The listing section" warnings={[INFO_EDGE_SENSITIVITY, WARNING_CONSTRAINT_TARGET]} />)
    expect(screen.getAllByTestId('inference-warning-strip-entry')).toHaveLength(1)
    expect(screen.queryByTestId('inference-warning-strip-held-back')).toBeNull()
  })
})
