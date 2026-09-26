/**
 * ⭐⭐ "YOUR MODEL SO FAR" AS A TOOL — a mark opens what this run said about
 * that node, and still routes to it on the canvas.
 *
 * Paul, 31 Aug 2026: *"if you hover over the individual indicators … each one of
 * those is meant to represent the data point within the model and display an
 * information panel or a few key data points and actionable coaching below it.
 * Also, it should be clickable."*
 *
 * ⚠ WHAT THIS FILE IS FOR, AND THE TWO CASES THAT CARRY IT.
 *
 *   1. THE DETAIL IS BOUND TO THE MARK'S OWN NODE. Every case identifies the
 *      mark by `data-node-id` and the finding by `data-recommendation-id` —
 *      never by a title another finding could carry (CLAUDE.md trap 19). The
 *      pair that proves the binding is `names ITS OWN node's finding` together
 *      with `and NOT another node's`: a component that rendered every finding
 *      on every mark passes the first alone.
 *   2. THE ABSENCE IS RENDERED. A node the run named nowhere says so. Silence
 *      would be indistinguishable from a broken control and a reassurance would
 *      be a claim nothing measured, so the empty case is asserted as strictly as
 *      the populated one.
 *
 * ⚠ jsdom CANNOT PROVE VISIBILITY OR WIDTH (trap 3). Nothing here asserts that
 * the detail fits the 280px dock floor; that is owed on a real browser. What is
 * mechanised is which node's material renders, that three routes reach it, and
 * that the disclosure is announced rather than merely drawn.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const nodes: Array<{ id: string; type?: string; data?: unknown }> = []

vi.mock('../../../../canvas/store', () => {
  const useCanvasStore = (select: (s: { nodes: unknown }) => unknown) => select({ nodes })
  ;(useCanvasStore as unknown as { getState: () => { nodes: unknown } }).getState = () => ({ nodes })
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { highlightNode, clearHighlight } from '../../../../canvas/utils/highlightHelpers'
import { openAskOlumi } from '../../coaching/askOlumiStore'
import { ModelStrip } from '../sections/ModelStrip'
import { buildNodeInsights, NODE_INSIGHT_FINDING_CAP } from '../nodeInsights'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { STRENGTHEN_COPY } from '../../strengthen/strengthenCopy'
import { MARK_KINDS } from '../nodeMarks'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import type { GlanceDriver } from '../analysisNewTypes'

const TID = 'analysis-new-model-strip'

const node = (id: string, type: string, label?: string) => ({
  id,
  type,
  data: label === undefined ? {} : { label },
})

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'challenge',
    title: 'Pressure-test the leading option',
    signal: 'The ranking was fragile under perturbation.',
    whyNow: 'Small changes flip which option leads.',
    tryThis: 'Imagine it failed. Write down why.',
    sourceLine: 'From the robustness check.',
    action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'Pressure-test it' },
    priority: 1,
    targetId: null,
    ...over,
  }) as Recommendation

const driver = (over: Partial<GlanceDriver> & { id: string }): GlanceDriver => ({
  label: 'Vendor licensing cost',
  fraction: 1,
  targetId: null,
  ...over,
})

/**
 * The model these cases run against: two options, two factors, one risk. `o1`
 * carries a mapped finding, `f7` carries an unmapped one AND is a named driver,
 * `r1` carries nothing at all.
 */
const CANVAS = [
  node('g1', 'goal', 'Replace the customer data platform within budget'),
  node('o1', 'option', 'Adopt Segment'),
  node('o2', 'option', 'Adopt RudderStack'),
  node('f7', 'factor', 'Vendor licensing cost'),
  node('f8', 'factor', 'Migration effort'),
  node('r1', 'risk', 'Migration delay'),
]

const INTERVENTIONS: Recommendation[] = [
  rec({
    id: 'strengthen:robustness:o1',
    targetId: 'o1',
    title: 'Pressure-test Adopt Segment',
    tryThis: 'Imagine it failed. Write down why.',
    whyNow: 'Small changes flip which option leads.',
  }),
  rec({
    id: 'strengthen:lehi:f7',
    targetId: 'f7',
    title: 'Give Vendor licensing cost a range',
    tryThis: 'Replace the single number with a low and a high you would defend.',
  }),
]

const DRIVERS: GlanceDriver[] = [driver({ id: 'd1', label: 'Vendor licensing cost', targetId: 'f7' })]

const insights = () => buildNodeInsights({ interventions: INTERVENTIONS, drivers: DRIVERS })

const setCanvas = (next: ReadonlyArray<ReturnType<typeof node>>) => {
  nodes.length = 0
  nodes.push(...next)
}

/** The mark for one node, bound by the node's own id. */
const mark = (nodeId: string) =>
  screen.getAllByTestId(`${TID}-mark`).find((el) => el.getAttribute('data-node-id') === nodeId)!

/** Open the strip (it mounts closed post-run) and return nothing. */
const openStrip = () => fireEvent.click(screen.getByTestId(`${TID}-toggle`))

const renderOpen = (index = insights()) => {
  const r = render(<ModelStrip isPreRun={false} insights={index} />)
  openStrip()
  return r
}

beforeEach(() => {
  vi.mocked(focusModelTarget).mockClear()
  vi.mocked(openAskOlumi).mockClear()
  vi.mocked(highlightNode).mockClear()
  vi.mocked(clearHighlight).mockClear()
  setCanvas(CANVAS)
})
afterEach(() => cleanup())

describe('⭐ the detail names a practical move, or says nothing at all', () => {
  /**
   * ⚠ THIS SURFACE IS THE DENSEST PLACE "Try this" APPEARS — one node can carry
   * several findings, so a placeholder here STACKS. The producer path now emits
   * `tryThis: null` (see `Recommendation.tryThis`), and the detail must drop the
   * whole line rather than print a lead-in with nothing after it.
   *
   * ⚠ WRITTEN BECAUSE A MUTANT SURVIVED. Guarding this renderer without a case
   * for it left the guard free to be deleted silently — for one round the
   * ModelStrip half of this change was protected by nothing.
   *
   * ⚠ AND IT IS A PAIR, FAILING ON DIFFERENT ASSERTIONS. The first case pins
   * that the lead-in still renders when an instruction exists; without it, a
   * change that deleted the line unconditionally would pass the second case and
   * take the real coaching with it.
   */
  const findingIn = (nodeId: string) => {
    fireEvent.click(mark(nodeId))
    const detail = screen.getByTestId(`${TID}-detail`)
    return within(detail).getAllByTestId(`${TID}-detail-finding`)[0]
  }

  it('renders the lead-in when the finding names an instruction', () => {
    renderOpen()
    expect(findingIn('o1')).toHaveTextContent(STRENGTHEN_COPY.tryThisLead)
  })

  it('omits the lead-in entirely when it does not', () => {
    renderOpen(
      buildNodeInsights({
        interventions: [
          rec({
            id: 'strengthen:phase3:c-1',
            targetId: 'o1',
            title: 'Confirm the large-account assumption',
            tryThis: null,
          }),
        ],
        drivers: [],
      }),
    )
    const finding = findingIn('o1')
    // The finding itself is on screen — so the absence below is the code's
    // doing, not an empty detail.
    expect(finding).toHaveTextContent('Confirm the large-account assumption')
    expect(finding).not.toHaveTextContent(STRENGTHEN_COPY.tryThisLead)
  })
})

describe('⭐ the detail is bound to the mark’s OWN node', () => {
  // ⚠ 26 Sep (design audit B12): the prototype's detail has no kind line —
  // the mark's own shape and row already say the kind — so it is pinned ABSENT.
  it('picking a mark shows THAT node and the engine’s finding for it, with no kind line', () => {
    renderOpen()
    fireEvent.click(mark('o1'))

    const detail = screen.getByTestId(`${TID}-detail`)
    expect(detail).toHaveAttribute('data-node-id', 'o1')
    expect(within(detail).getByTestId(`${TID}-detail-title`)).toHaveTextContent('Adopt Segment')
    expect(within(detail).queryByTestId(`${TID}-detail-kind`)).toBeNull()

    // The finding is identified by the ENGINE's id, never by its prose.
    const findings = within(detail).getAllByTestId(`${TID}-detail-finding`)
    expect(findings.map((el) => el.getAttribute('data-recommendation-id'))).toEqual([
      'strengthen:robustness:o1',
    ])
    // …and it renders the engine's own two sentences.
    expect(findings[0]).toHaveTextContent('Pressure-test Adopt Segment')
    expect(findings[0]).toHaveTextContent('Imagine it failed. Write down why.')
  })

  /**
   * ⭐ THE DISCRIMINATING TWIN. A component that rendered every finding against
   * every mark satisfies the case above perfectly and fails here.
   */
  it('and NOT another node’s finding — picking a second mark replaces the first', () => {
    renderOpen()
    fireEvent.click(mark('o1'))
    fireEvent.click(mark('f7'))

    const detail = screen.getByTestId(`${TID}-detail`)
    expect(detail).toHaveAttribute('data-node-id', 'f7')
    expect(
      within(detail)
        .getAllByTestId(`${TID}-detail-finding`)
        .map((el) => el.getAttribute('data-recommendation-id')),
    ).toEqual(['strengthen:lehi:f7'])
    // One slot, replaced rather than accumulated.
    expect(screen.getAllByTestId(`${TID}-detail`)).toHaveLength(1)
  })

  /**
   * ⚠ 26 Sep (design audit B12): THE DENIAL LINE IS GONE, and silence is not
   * what replaced it. The prototype's detail has no "Nothing else on this panel
   * refers to this node." — a node the run named nowhere still gets a detail
   * that is plainly working: its name, its × and its three acts. What it does
   * NOT get is a bullet this surface wrote (PRODUCER GAP).
   */
  it('a node the run named nowhere gets no bullet and no denial — but still its acts', () => {
    renderOpen()
    fireEvent.click(mark('r1'))

    const detail = screen.getByTestId(`${TID}-detail`)
    expect(detail).toHaveAttribute('data-node-id', 'r1')
    expect(within(detail).queryByTestId(`${TID}-detail-empty`)).toBeNull()
    expect(detail).not.toHaveTextContent(COPY.modelStrip.noInsight)
    expect(within(detail).queryAllByTestId(`${TID}-detail-finding`)).toHaveLength(0)
    expect(within(detail).queryByTestId(`${TID}-detail-driver`)).toBeNull()
    // CONTRAST: the detail is not an empty box.
    expect(within(detail).getByTestId(`${TID}-detail-ask`)).toBeInTheDocument()
  })

  /** The twin: a node the run DID name shows the engine's finding, and still no denial. */
  it('and a node the run named shows its finding, with no denial line either', () => {
    renderOpen()
    fireEvent.click(mark('o1'))
    expect(screen.getAllByTestId(`${TID}-detail-finding`).length).toBeGreaterThan(0)
    expect(screen.queryByTestId(`${TID}-detail-empty`)).toBeNull()
  })
})

describe('⭐ three routes in, and the canvas route is unchanged', () => {
  /**
   * V2 (Paul, 25 Sep 2026): no standing hint line under the rows. The
   * affordance is carried by the mark itself — its accessible name says where
   * it goes — so that is what is pinned now.
   */
  it('before anything is picked the mark states its own affordance and no detail mounts', () => {
    renderOpen()
    // CONTRAST: the region is open and the marks are drawn.
    expect(mark('r1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show Migration delay on the canvas' })).toBe(
      mark('r1'),
    )
    expect(screen.queryByTestId(`${TID}-hint`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-detail`)).toBeNull()
  })

  /**
   * ⚠ 26 Sep (design audit B12): FOCUS AND HOVER RING, ACTIVATION OPENS. The
   * detail now sits below the success line and the review tool, as the
   * prototype places it, and the prototype opens it on activation only — a
   * pointer or a Tab sweeping the census must not reflow everything beneath it.
   * The keyboard reaches it the way a click does: Enter on the mark.
   */
  it('KEYBOARD FOCUS rings the node but opens nothing; activation opens it', () => {
    renderOpen()
    fireEvent.focus(mark('f7'))
    expect(highlightNode).toHaveBeenCalledWith('f7')
    expect(screen.queryByTestId(`${TID}-detail`)).toBeNull()
    fireEvent.click(mark('f7'))
    expect(screen.getByTestId(`${TID}-detail`)).toHaveAttribute('data-node-id', 'f7')
  })

  it('ACTIVATION opens the detail AND still routes to that node on the canvas', () => {
    renderOpen()
    fireEvent.click(mark('r1'))
    expect(screen.getByTestId(`${TID}-detail`)).toHaveAttribute('data-node-id', 'r1')
    // Bound by the node's id — the affordance the strip already had.
    expect(focusModelTarget).toHaveBeenCalledTimes(1)
    expect(focusModelTarget).toHaveBeenCalledWith('r1')
  })

  it('naming a mark does NOT move the canvas — only activation commits that', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('r1'))
    fireEvent.focus(mark('o2'))
    expect(focusModelTarget).not.toHaveBeenCalled()
  })
})

describe('⭐ the graph answers — pointing at a mark rings THAT node', () => {
  it('rings the mark’s own node, and clears when the pointer leaves', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('f8'))
    // Bound by the node's id. A component that rang a fixed node, or the first
    // node, satisfies "something was highlighted" and fails this.
    expect(highlightNode).toHaveBeenCalledTimes(1)
    expect(highlightNode).toHaveBeenCalledWith('f8')
    expect(clearHighlight).not.toHaveBeenCalled()

    fireEvent.mouseLeave(mark('f8'))
    expect(clearHighlight).toHaveBeenCalledTimes(1)
  })

  it('the ring FOLLOWS the pointer — a second mark rings the second node', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('o2'))
    fireEvent.mouseEnter(mark('r1'))
    expect(vi.mocked(highlightNode).mock.calls.map(([id]) => id)).toEqual(['o2', 'r1'])
  })

  it('keyboard focus rings it too, and blur clears it', () => {
    renderOpen()
    fireEvent.focus(mark('o1'))
    expect(highlightNode).toHaveBeenCalledWith('o1')
    fireEvent.blur(mark('o1'))
    expect(clearHighlight).toHaveBeenCalledTimes(1)
  })
})

describe('⭐ the disclosure is announced, not merely drawn', () => {
  it('exactly the picked mark reports itself expanded, and points at the detail', () => {
    renderOpen()
    fireEvent.click(mark('f7'))

    const detailId = screen.getByTestId(`${TID}-detail`).getAttribute('id')!
    expect(detailId.length).toBeGreaterThan(0)
    expect(mark('f7')).toHaveAttribute('aria-expanded', 'true')
    expect(mark('f7')).toHaveAttribute('aria-controls', detailId)

    // ⭐ The discrimination: every OTHER mark reports collapsed and points at
    // nothing. A component that set the attribute on all of them would pass the
    // half above.
    const others = screen
      .getAllByTestId(`${TID}-mark`)
      .filter((el) => el.getAttribute('data-node-id') !== 'f7')
    expect(others.length).toBeGreaterThan(0)
    for (const el of others) {
      expect(el).toHaveAttribute('aria-expanded', 'false')
      expect(el).not.toHaveAttribute('aria-controls')
    }
  })
})

/**
 * ⚠ 26 Sep (design audit B12): the prototype's detail carries no driver flag
 * ("Factor · What matters most"). The glance still says what matters most; the
 * detail no longer repeats it — pinned ABSENT even where the index holds it.
 */
describe('⭐ the driver flag is not repeated in the detail', () => {
  it('a node the glance named carries NO flag in the detail — though the index still holds it', () => {
    // CONTRAST: the data for the flag exists, so the absence is the component's.
    expect(insights().get('f7')?.driverLabel).toBe('Vendor licensing cost')
    renderOpen()
    fireEvent.click(mark('f7'))
    expect(screen.getByTestId(`${TID}-detail`)).toHaveAttribute('data-node-id', 'f7')
    expect(screen.queryByTestId(`${TID}-detail-driver`)).toBeNull()
    expect(screen.getByTestId(`${TID}-detail`)).not.toHaveTextContent(COPY.glance.whatMattersMost)
  })

  it('a node it did not name carries NO flag — and no negative claim in its place', () => {
    renderOpen()
    fireEvent.click(mark('f8'))
    const detail = screen.getByTestId(`${TID}-detail`)
    expect(detail).toHaveAttribute('data-node-id', 'f8')
    expect(within(detail).queryByTestId(`${TID}-detail-driver`)).toBeNull()
  })
})

describe('⭐ the technique rides the finding that warrants it', () => {
  it('renders only where the mapping supplies one, bound by method id', () => {
    renderOpen()
    fireEvent.click(mark('o1'))
    expect(screen.getByTestId(`${TID}-detail-method`)).toHaveAttribute(
      'data-method-id',
      'pre_mortem',
    )

    // The unmapped finding names no technique — absence is not a placeholder.
    fireEvent.click(mark('f7'))
    expect(screen.queryByTestId(`${TID}-detail-method`)).toBeNull()
  })

  it('the chip is a control: it opens the method with THIS node as the target', () => {
    renderOpen()
    fireEvent.click(mark('o1'))
    fireEvent.click(screen.getByTestId(`${TID}-detail-method`))

    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(openAskOlumi).mock.calls[0][0]
    // Identity must ride the dispatch, or the chip is cosmetic.
    expect(payload.parameters).toEqual({ method_id: 'pre_mortem' })
    expect(payload.targetId).toBe('o1')
    // The FINDING is the context — that is the point of attaching a technique
    // to a trigger — and it is the engine's sentence, not a composed one.
    expect(payload.context).toBe('Small changes flip which option leads.')
  })
})

describe('⭐ the per-node cap discloses itself', () => {
  it('states how many findings it is not showing', () => {
    const many = Array.from({ length: NODE_INSIGHT_FINDING_CAP + 3 }, (_, i) =>
      rec({ id: `strengthen:phase3:b${i}`, targetId: 'o1', title: `Finding ${i}` }),
    )
    renderOpen(buildNodeInsights({ interventions: many, drivers: [] }))
    fireEvent.click(mark('o1'))

    const detail = screen.getByTestId(`${TID}-detail`)
    expect(within(detail).getAllByTestId(`${TID}-detail-finding`)).toHaveLength(
      NODE_INSIGHT_FINDING_CAP,
    )
    expect(within(detail).getByTestId(`${TID}-detail-more`)).toHaveTextContent(
      COPY.modelStrip.moreFindings(3),
    )
  })
})

describe('⭐ the strip still works with nothing wired to it', () => {
  // ⚠ 26 Sep (design audit B12): no denial line any more — the detail offers
  // its acts and writes no bullet of its own.
  it('an unwired mount still navigates, and its detail offers its acts with no bullet of its own', () => {
    render(<ModelStrip isPreRun={false} />)
    openStrip()
    fireEvent.click(mark('o1'))
    expect(focusModelTarget).toHaveBeenCalledWith('o1')
    expect(screen.queryByTestId(`${TID}-detail-empty`)).toBeNull()
    expect(screen.queryAllByTestId(`${TID}-detail-finding`)).toHaveLength(0)
    expect(screen.getByTestId(`${TID}-detail-ask`)).toBeInTheDocument()
  })
})

describe('⭐ the kind-noun map is not allowed to go short', () => {
  /**
   * ⚠ A HAND-MAINTAINED MIRROR OF `MARK_KINDS`, PINNED (CLAUDE.md trap 12). A
   * kind added to the mark vocabulary without a noun here would render a
   * heading with a missing word rather than failing loudly.
   */
  it('every kind the strip can draw has a singular noun', () => {
    expect(MARK_KINDS.length).toBeGreaterThan(0)
    for (const kind of MARK_KINDS) {
      expect(COPY.modelStrip.kindNoun[kind], `no singular noun for '${kind}'`).toBeTruthy()
    }
  })
})
