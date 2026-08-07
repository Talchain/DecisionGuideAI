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
    render(<InferenceWarningStrip warnings={[WARNING_CONSTRAINT_TARGET]} />)
    const strip = screen.getByTestId('inference-warning-strip')
    expect(strip).toBeInTheDocument()
    const entry = screen.getByTestId('inference-warning-strip-entry')
    expect(entry).toHaveAttribute('data-warning-code', 'CONSTRAINT_TARGET_UNRELIABLE')
    // ROADMAP 1.12: CONSTRAINT_TARGET_UNRELIABLE now has a CODE_TEMPLATES
    // entry (humaniseCritique.ts) — a meaningful, code-keyed title, NOT the
    // raw producer message verbatim and NOT the generic unmapped-code
    // fallback (superseded by the fix; was "Review this factor's inputs").
    expect(entry).toHaveTextContent("success target can't be evaluated reliably")
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
    render(<InferenceWarningStrip warnings={[missingObservedState]} />)
    const entry = screen.getByTestId('inference-warning-strip-entry')
    // Template-derived, human-readable — uses the producer-resolved label.
    expect(entry).toHaveTextContent('Marketing Spend is missing a current value')
    // Never the raw internal-token-bearing message.
    expect(entry).not.toHaveTextContent(missingObservedState.message as string)
  })

  it('renders nothing when only info-severity entries exist (info stays hidden)', () => {
    const { container } = render(
      <InferenceWarningStrip warnings={[INFO_EDGE_SENSITIVITY, INFO_CONSTRAINT_BASE]} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when warnings are absent or empty', () => {
    const { container: empty } = render(<InferenceWarningStrip warnings={[]} />)
    expect(empty.firstChild).toBeNull()
    const { container: absent } = render(<InferenceWarningStrip />)
    expect(absent.firstChild).toBeNull()
  })

  it('shows every warning-severity entry when several arrive (no silent cap)', () => {
    const second: InferenceWarning = {
      code: 'CONSTRAINT_TARGET_UNRELIABLE',
      affected_nodes: [],
      message: "The target for 'out_roi' could not be reliably assessed - set an explicit range for this outcome to make the target meaningful.",
      severity: 'warning',
    }
    render(
      <InferenceWarningStrip
        warnings={[INFO_EDGE_SENSITIVITY, WARNING_CONSTRAINT_TARGET, second]}
      />,
    )
    expect(screen.getAllByTestId('inference-warning-strip-entry')).toHaveLength(2)
  })
})
