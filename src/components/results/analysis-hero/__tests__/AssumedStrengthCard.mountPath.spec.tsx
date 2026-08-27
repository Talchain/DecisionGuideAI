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
import { useAskOlumiStore } from '../../coaching/askOlumiStore'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../../../canvas/utils/openEdgeStrengthEditor'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import type { AssumedStrengthDecision } from '../../strengthElicitation/selectAssumedStrengthToResolve'
import { ASSUMED_STRENGTH_ACTION, ASSUMED_STRENGTH_REFUSAL_COPY } from '../../strengthElicitation/assumedStrengthCopy'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

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

  /*
   * ⭐ THE ACT IS NOW OFFERED, AND THAT IS THE CHANGE.
   *
   * This case asserted the button was WITHHELD, on the correct premise that its
   * destination could not save: it opened the Inspector, which `InspectorRouter`
   * wraps in an unconditional `<fieldset disabled>`. (The premise was originally
   * cited to `EDGE_SETTER_AUTHORITY`; that manifest was deleted 27 Aug 2026,
   * PR #886, as an unenforced mirror with zero code consumers. The premise is
   * unchanged.) The product's most prominent intervention — panel
   * top level, zero clicks — therefore ended in nothing, which is why it was hidden.
   *
   * It now asks Olumi, who CAN change an edge (`update_edge` is first-class in the
   * model-facing tool schema and CEE applies it canonically). So the premise has
   * inverted and the case must assert the new behaviour rather than be deleted.
   *
   * ⚠ Still asserted: the act must NOT raise the read-only Inspector.
   */
  it('0.4 keeps the measured relationship visible AND offers the ask', () => {
    renderAnalysisTab(SELECTED)
    expect(screen.getByTestId('assumed-strength-card')).toHaveAttribute(
      'data-edge-id',
      'e_demand_rev',
    )
    expect(screen.getByTestId('assumed-strength-why')).toHaveTextContent('35%')

    const act = screen.getByTestId('assumed-strength-action')
    expect(act).toHaveTextContent(ASSUMED_STRENGTH_ACTION)

    let inspectorRaises = 0
    const onRaise = () => { inspectorRaises += 1 }
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, onRaise)
    try {
      fireEvent.click(act)
    } finally {
      window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, onRaise)
    }
    expect(inspectorRaises, 'the act must not raise the read-only Inspector').toBe(0)

    // The drawer opened with a request that names BOTH endpoints — the shape the
    // router elects. Asserted on the store, not on prose.
    const ask = useAskOlumiStore.getState()
    expect(ask.isOpen).toBe(true)
    expect(ask.draft).toContain('Customer demand')
    expect(ask.draft).toContain('Revenue growth')
    expect(ask.targetId).toBe('e_demand_rev')
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
