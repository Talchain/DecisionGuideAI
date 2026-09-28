/**
 * ⭐ A LINK THAT IS ON THE CANVAS ONLY SAYS SO — ON THE LINK, AFTER THE
 * GESTURE, AND ON RELOAD (canvas audit edit-structure/F3, 27 Sep 2026).
 *
 * The stand-down itself is by design and is NOT changed here: a link drawn with
 * no stated strength is never sent (sending `USER_EDGE_DEFAULTS.weight` 0.3
 * would fabricate a strength), and it is lost on reload unless somebody states
 * its strength. What the skeptic measured as wrong is the DISCLOSURE:
 *   (a) no lasting mark — once the toast faded the link looked identical to a
 *       saved one (served: 1px grey, solid, no label);
 *   (b) the gesture selected the new CARD, so the control that sends the link
 *       (EdgePanel `edge-state-strength-for-save`) was never put in front of
 *       the user; the toast pointed at the chat instead;
 *   (c) the reload line blamed "another tab / never finished saving", although
 *       the removed edge carried `structuralAddStandDown` — the UI knew it had
 *       never been sent.
 *
 * Every assertion binds by id (edge id, data-testid) or exact copy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasStore } from '../store'
import { mergeServerGraphOnHydrate } from '../utils/mergeServerGraph'
import {
  RELOAD_DIFFERENCE_COPY,
  formatReloadDifferenceNotice,
} from '../stores/reloadDifferenceStore'
import { OPEN_FULL_INSPECTOR_EVENT } from '../utils/openEdgeStrengthEditor'
import { addConnectedFactorAction, addConnectedOutcomeAction } from '../contextMenu/actions'
import type { NodeTarget } from '../contextMenu/types'

const SCENARIO = '5a1e7ab0-0d04-4dd4-89db-bb6470a98fc5'

function node(id: string, type: string, label: string) {
  return { id, type, position: { x: 0, y: 0 }, data: { label, kind: type } }
}

function seed(nodes: unknown[], edges: unknown[], extra: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: structuredClone(nodes) as never,
    edges: structuredClone(edges) as never,
    importPendingServerRegistration: false,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    lastServerGraphHash: null,
    history: { past: [], future: [] },
    pendingEmittedEdits: 0,
    pendingStructuralDeletes: [],
    pendingStructuralRenames: [],
    pendingStructuralAdds: [],
    pendingStructuralAddEdges: [],
    structuralRenameLifecycle: [],
    structuralAddLifecycle: [],
    _externalMutationActive: 0,
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
    ...extra,
  } as never)
}

// ── (c) reload ────────────────────────────────────────────────────────────────

describe('(c) reload names a never-sent link for what it is', () => {
  const NODES = [
    node('goal_revenue', 'goal', 'Revenue'),
    node('fac_usage_exposure', 'factor', 'Usage-Based Pricing Exposure'),
    node('out_new', 'outcome', 'New outcome'),
  ]
  const SAVED_LINK = { id: 'e_saved', source: 'fac_usage_exposure', target: 'goal_revenue', data: {} }
  const SERVER = {
    nodes: [
      { id: 'goal_revenue', kind: 'goal', label: 'Revenue' },
      { id: 'fac_usage_exposure', kind: 'factor', label: 'Usage-Based Pricing Exposure' },
      { id: 'out_new', kind: 'outcome', label: 'New outcome' },
    ],
    edges: [{ from: 'fac_usage_exposure', to: 'goal_revenue' }],
  }
  const NAME = 'the link from Usage-Based Pricing Exposure to New outcome'

  it('⭐ a pair-removed link carrying the stand-down is named apart, not as "removed in another tab"', () => {
    seed(NODES, [
      SAVED_LINK,
      { id: 'e_drawn', source: 'fac_usage_exposure', target: 'out_new', data: { weight: 0.3, structuralAddStandDown: 'strength_not_stated' } },
    ])
    const res = mergeServerGraphOnHydrate(SERVER)
    expect(res.accepted).toBe(true)
    expect(res.removedEdgeCount).toBe(1)
    expect(res.removedCanvasOnlyLinkLabels).toEqual([NAME])
    expect(res.removedLabels).toEqual([])

    const line = formatReloadDifferenceNotice(res.removedLabels, res.removedCanvasOnlyLinkLabels)
    expect(line).toBe(
      `The link from Usage-Based Pricing Exposure to New outcome was on this canvas only. It had no strength, ` +
        "so it was never sent to the model, and I've taken it off. Draw it again and set its strength to keep it.",
    )
    expect(line).not.toMatch(/another tab|never finished saving/)
  })

  it('CONTRAST: the same removal WITHOUT the stand-down keeps the generic line (the UI does not know why)', () => {
    seed(NODES, [SAVED_LINK, { id: 'e_other', source: 'fac_usage_exposure', target: 'out_new', data: { weight: 0.3 } }])
    const res = mergeServerGraphOnHydrate(SERVER)
    expect(res.removedLabels).toEqual([NAME])
    expect(res.removedCanvasOnlyLinkLabels).toEqual([])
    expect(formatReloadDifferenceNotice(res.removedLabels, res.removedCanvasOnlyLinkLabels)).toBe(
      RELOAD_DIFFERENCE_COPY.one.replace('{label}', NAME),
    )
  })

  it('both kinds at once: both sentences, generic first', () => {
    const line = formatReloadDifferenceNotice(['Competitive Pressure'], [NAME, 'the link from A to B'])
    expect(line.startsWith(RELOAD_DIFFERENCE_COPY.one.replace('{label}', 'Competitive Pressure'))).toBe(true)
    expect(line).toContain(
      `The link from Usage-Based Pricing Exposure to New outcome and the link from A to B were on this canvas only.`,
    )
  })

  it('unchanged for existing callers: one argument gives the generic line', () => {
    expect(formatReloadDifferenceNotice(['Competitive Pressure'])).toBe(
      RELOAD_DIFFERENCE_COPY.one.replace('{label}', 'Competitive Pressure'),
    )
  })
})

// ── (b) the connected-add gesture puts the strength control in front ─────────

describe('(b) "Add … from this" selects the new link when it could not be sent', () => {
  let opens = 0
  const onOpen = () => { opens += 1 }
  const showToast = vi.fn()

  async function settle() {
    await import('../../adapters/plot')
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
  }

  beforeEach(() => {
    opens = 0
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, onOpen)
  })
  afterEach(() => window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, onOpen))

  const target = (id: string, type: string): NodeTarget => ({
    kind: 'node',
    nodeId: id,
    nodeType: type as never,
    node: useCanvasStore.getState().nodes.find((n) => n.id === id)!,
    screenPos: { x: 0, y: 0 },
  })

  it('⭐ "Add outcome from this" on a factor: the causal link stood down, so IT is selected and its panel raised', async () => {
    seed([node('fac_usage_exposure', 'factor', 'Usage-Based Pricing Exposure')], [], { currentScenarioId: null })
    await addConnectedOutcomeAction(target('fac_usage_exposure', 'factor'), showToast)
    await settle()

    const { edges, selection } = useCanvasStore.getState()
    expect(edges).toHaveLength(1)
    expect((edges[0].data as { structuralAddStandDown?: string }).structuralAddStandDown).toBe('strength_not_stated')
    expect([...selection.edgeIds]).toEqual([edges[0].id])
    expect(opens).toBe(1)
  })

  it('CONTRAST: "Add connected factor" on an option rides the structural convention, so the new card stays selected', async () => {
    seed([node('opt_hybrid', 'option', 'Hybrid pricing')], [], { currentScenarioId: null })
    await addConnectedFactorAction(target('opt_hybrid', 'option'), showToast)
    await settle()

    const { edges, nodes, selection } = useCanvasStore.getState()
    expect(edges).toHaveLength(1)
    expect((edges[0].data as { structuralAddStandDown?: string }).structuralAddStandDown).toBeUndefined()
    const added = nodes.find((n) => n.id !== 'opt_hybrid')!
    expect([...selection.nodeIds]).toEqual([added.id])
    expect(opens).toBe(0)
  })
})

// (a) the lasting word on the link: `edges/__tests__/StyledEdge.canvasOnlyLinkWord.spec.tsx`.
