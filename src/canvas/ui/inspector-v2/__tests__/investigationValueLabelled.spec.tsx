/**
 * THE INVESTIGATION-VALUE BAR MUST CARRY A VISIBLE LABEL.
 *
 * ── THE DEFECT, AND WHY IT LOOKED LIKE A DATA BUG ─────────────────────────
 * `DataBar` renders its `label` prop as an `aria-label` ONLY — never as text.
 * `ImportanceBar` puts its own label BELOW its bar. So on a factor panel the
 * two stacked as:
 *
 *     1st · 100%
 *     Influence on results        <- label for the bar ABOVE it
 *     [unlabelled bar]  Low       <- value-of-information, no label at all
 *     "Further investigation here is unlikely to change the outcome."
 *     "This is one of the most influential factors in your model."
 *
 * A sighted reader binds "Influence on results" to the bar directly beneath it
 * and reads "influence: Low" immediately above "one of the most influential
 * factors". The data was never wrong — influence and value-of-information are
 * different quantities, and a top driver can honestly have low VoI. A missing
 * label alone turned a coherent panel into an apparent contradiction, and a
 * reviewer nearly filed it as a data-integrity defect.
 *
 * ⚠ THE ASSERTION IS ABOUT VISIBLE TEXT, AND THAT IS THE WHOLE POINT. The
 * `aria-label` was present throughout and would have passed any accessible-name
 * assertion, so a `getByLabelText` pin here would have been GREEN against the
 * defect. Only rendered text discriminates.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const VOI = { value: 0.12 }

vi.mock('../../../hooks/useNodeDisplayMetadata', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useNodeDisplayMetadata: () => ({
      influence: 1,
      sensitivityRank: 1,
      confidence: null,
      confidenceIsDefaulted: false,
      confidenceIsProvisional: false,
      influenceProvenance: 'normalised_elasticity',
      inSensitivityAnalysis: true,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: VOI.value,
      voiRank: 1,
    }),
  }
})

import { FactorExternalPanel } from '../panels/FactorExternalPanel'
import { FactorObservablePanel } from '../panels/FactorObservablePanel'
import { useCanvasStore } from '../../../store'
import { INLINE_LABELS } from '../inspectorStrings'

const noop = () => {}
const NODE_ID = 'fac_market_growth'

function seed() {
  useCanvasStore.setState(
    {
      nodes: [
        {
          id: NODE_ID,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            kind: 'factor',
            label: 'Market growth',
            observedState: { value: 0.4, source: 'cee_inference', extractionType: 'inferred' },
          },
        } as unknown as Node,
      ],
      edges: [],
      results: { status: 'complete', report: null },
      analysisFreshness: null,
      analysisFreshnessDirty: false,
    } as never,
    false,
  )
}

beforeEach(seed)
afterEach(cleanup)

describe('the investigation-value bar is labelled in visible text', () => {
  it('renders the label on the external-factor panel', () => {
    render(<FactorExternalPanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.getByText(INLINE_LABELS.investigationValue)).toBeInTheDocument()
  })

  it('renders the label on the observable-factor panel', () => {
    render(<FactorObservablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.getByText(INLINE_LABELS.investigationValue)).toBeInTheDocument()
  })

  // ⭐ THE DISCRIMINATOR. The influence label was always visible and the
  // investigation label never was; asserting only the second could pass on a
  // panel that had lost the first. Both must be present, and as DISTINCT text —
  // that adjacency is the thing that read as a contradiction.
  it('shows BOTH labels, so neither bar borrows the other’s', () => {
    const { container } = render(
      <FactorExternalPanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />,
    )
    const scope = within(container)
    expect(scope.getByText(INLINE_LABELS.influenceOnResults)).toBeInTheDocument()
    expect(scope.getByText(INLINE_LABELS.investigationValue)).toBeInTheDocument()
    expect(INLINE_LABELS.investigationValue).not.toBe(INLINE_LABELS.influenceOnResults)
  })

  // Precondition pinned in-test: the bar is only rendered when VoI is present,
  // so a green label assertion could otherwise be green on a panel that renders
  // no bar at all.
  it('precondition: the bar itself is on screen', () => {
    render(<FactorExternalPanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.getByLabelText(INLINE_LABELS.investigationValue)).toBeInTheDocument()
  })
})
