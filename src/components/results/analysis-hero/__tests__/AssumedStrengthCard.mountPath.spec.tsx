/**
 * §0 THE MOUNT PATH (trap 3b: bind to what the DEPLOYED flags actually mount).
 *
 * This estate has shipped the same defect twice — a feature fully tested against
 * a component the deployed flag posture never rendered, with every render test,
 * every mutant and every positive control passing because they were all pointed
 * at the wrong host. So this file does not render the card in isolation: it
 * renders `ResultsBody` and asserts the card is a DESCENDANT of the hero panel,
 * the one analysis surface, which now mounts unconditionally.
 *
 * It also carries the F6-class wiring proof: unwiring the card from
 * `AnalysisHeroPanel` must RED here, not merely in a unit test of the card.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import type { AssumedStrengthDecision } from '../../strengthElicitation/selectAssumedStrengthToResolve'
import { ASSUMED_STRENGTH_REFUSAL_COPY } from '../../strengthElicitation/assumedStrengthCopy'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

vi.mock('../../../../canvas/utils/openEdgeStrengthEditor', async () => {
  const actual = await vi.importActual<typeof import('../../../../canvas/utils/openEdgeStrengthEditor')>(
    '../../../../canvas/utils/openEdgeStrengthEditor',
  )
  return { ...actual, openEdgeStrengthEditor: vi.fn(() => true) }
})

vi.mock('@/flags', async () => {
  // `importOriginal`-spread, never a hand-listed allowlist — a `vi.mock` factory
  // REPLACES the module, so every flag not listed would be silently absent.
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isFocusNowPanelEnabled: vi.fn(() => true),
    isStrengthenPanelEnabled: vi.fn(() => false),
    isAiPanelV2Enabled: vi.fn(() => true),
  }
})

import { openEdgeStrengthEditor } from '../../../../canvas/utils/openEdgeStrengthEditor'
import { ResultsBody } from '../../ResultsBody'
import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'

const SELECTED: AssumedStrengthDecision = {
  selected: {
    edgeId: 'e_demand_rev',
    fromLabel: 'Customer demand',
    toLabel: 'Revenue growth',
    switchProbability: 0.35,
    alternativeWinnerLabel: 'Consolidate',
    strengthProvenance: 'ai_inferred',
  },
  refusalReason: null,
  assumedFragileCount: 3,
}

const ALL_SET: AssumedStrengthDecision = {
  selected: null,
  refusalReason: 'all_strengths_set',
  assumedFragileCount: 0,
}

const NO_DATA: AssumedStrengthDecision = {
  selected: null,
  refusalReason: 'no_robustness_data',
  assumedFragileCount: 0,
}

function renderAnalysisTab(assumedStrength: AssumedStrengthDecision) {
  const data = { ...makeHeroData(), assumedStrength } as ResultsSectionDataReturn
  return render(
    <ResultsBody
      resultsSectionData={data}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
  // The DEFAULT post-run dock tab — Analysis.
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
})

describe('§0 the elicitation is on the DEFAULT Analysis tab', () => {
  it('0.1 mounts INSIDE the analysis hero panel — the mount path itself, not just the testid', () => {
    renderAnalysisTab(SELECTED)

    // POSITIVE CONTROL FIRST. Without it every assertion below could be passing
    // against a panel that never painted.
    const panel = screen.getByTestId('analysis-hero-panel')
    expect(screen.getByTestId('outputs-results-redesign')).toBeInTheDocument()

    const card = screen.getByTestId('assumed-strength-card')
    // THE BINDING: a descendant of the hero host. If a future change relocates
    // the card off this host it fails loud rather than passing on a different
    // rendering of the same data.
    expect(panel.contains(card)).toBe(true)
  })

  // ⚠ RETIRED WITH ITS MECHANISM: `0.2 disappears when the hero flag is OFF`
  // flipped the flag to prove 0.1 was a real binding. The flag is deleted and
  // the panel mounts unconditionally. 0.1 still discriminates on its own — it
  // asserts `panel.contains(card)`, which a relocation off the host REDs.

  it('0.3 names the relationship by IDENTITY, and carries the producer’s measured number', () => {
    renderAnalysisTab(SELECTED)
    const card = screen.getByTestId('assumed-strength-card')
    // Bound by edge id, never by a label another row could carry.
    expect(card.getAttribute('data-edge-id')).toBe('e_demand_rev')
    expect(screen.getByTestId('assumed-strength-lead').textContent).toContain('Customer demand')
    expect(screen.getByTestId('assumed-strength-lead').textContent).toContain('Revenue growth')
    expect(screen.getByTestId('assumed-strength-why').textContent).toContain('35%')
    expect(screen.getByTestId('assumed-strength-why').textContent).toContain('Consolidate')
    expect(screen.getByTestId('assumed-strength-others').textContent).toContain('2 other')
  })

  it('0.4 the action opens THE EDITOR for the named edge — not merely focuses it', () => {
    renderAnalysisTab(SELECTED)
    fireEvent.click(screen.getByTestId('assumed-strength-action'))
    // Asserted by ARGUMENT: the edge it opens the editor for is the edge it
    // named. This spec owns the BUTTON→ROUTE hop only; that the route actually
    // lands on the strength control is pinned separately, against the real
    // store and the real panel, in
    // `canvas/utils/__tests__/openEdgeStrengthEditor.spec.tsx`. The two are kept
    // apart deliberately — an earlier version asserted a focus mock here and
    // INFERRED the rest, which is exactly how a button that never reached the
    // editor passed review.
    expect(openEdgeStrengthEditor).toHaveBeenCalledWith('e_demand_rev')
  })

  it('0.5 a speaking refusal renders its sentence and NO card', () => {
    renderAnalysisTab(ALL_SET)
    expect(screen.queryByTestId('assumed-strength-card')).toBeNull()
    expect(screen.getByTestId('assumed-strength-refusal').textContent).toBe(
      ASSUMED_STRENGTH_REFUSAL_COPY.all_strengths_set,
    )
  })

  it('0.6 a silent refusal renders NOTHING — not an empty box, not an apology', () => {
    renderAnalysisTab(NO_DATA)
    expect(screen.queryByTestId('assumed-strength-card')).toBeNull()
    expect(screen.queryByTestId('assumed-strength-refusal')).toBeNull()
    // The rest of the panel is unaffected — silence here is not a crash there.
    expect(screen.getByTestId('analysis-hero-panel')).toBeInTheDocument()
  })
})
