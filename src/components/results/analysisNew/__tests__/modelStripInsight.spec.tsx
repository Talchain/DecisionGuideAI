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
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { openAskOlumi } from '../../coaching/askOlumiStore'
import { ModelStrip } from '../sections/ModelStrip'
import { buildNodeInsights, NODE_INSIGHT_FINDING_CAP } from '../nodeInsights'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
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
  setCanvas(CANVAS)
})
afterEach(() => cleanup())

describe('⭐ the detail is bound to the mark’s OWN node', () => {
  it('naming a mark shows THAT node, its kind, and the engine’s finding for it', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('o1'))

    const detail = screen.getByTestId(`${TID}-detail`)
    expect(detail).toHaveAttribute('data-node-id', 'o1')
    expect(within(detail).getByTestId(`${TID}-detail-title`)).toHaveTextContent('Adopt Segment')
    expect(within(detail).getByTestId(`${TID}-detail-kind`)).toHaveTextContent(
      COPY.modelStrip.kindNoun.option,
    )

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
  it('and NOT another node’s finding — naming a second mark replaces the first', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('o1'))
    fireEvent.mouseEnter(mark('f7'))

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

  it('a node the run named nowhere states the absence rather than showing nothing', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('r1'))

    const detail = screen.getByTestId(`${TID}-detail`)
    expect(detail).toHaveAttribute('data-node-id', 'r1')
    expect(within(detail).getByTestId(`${TID}-detail-empty`)).toHaveTextContent(
      COPY.modelStrip.noInsight,
    )
    expect(within(detail).queryAllByTestId(`${TID}-detail-finding`)).toHaveLength(0)
    expect(within(detail).queryByTestId(`${TID}-detail-driver`)).toBeNull()
  })

  /**
   * The opposite-direction twin of the case above: the absence line must NOT
   * appear on a node the run did name, or it would be a sentence that is simply
   * always true.
   */
  it('and the absence line is absent when there IS something to say', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('o1'))
    expect(screen.queryByTestId(`${TID}-detail-empty`)).toBeNull()
  })
})

describe('⭐ three routes in, and the canvas route is unchanged', () => {
  it('before anything is picked the strip states the affordance and mounts no detail', () => {
    renderOpen()
    expect(screen.getByTestId(`${TID}-hint`)).toHaveTextContent(COPY.modelStrip.hint)
    expect(screen.queryByTestId(`${TID}-detail`)).toBeNull()
  })

  it('KEYBOARD FOCUS opens the detail — hover is a mouse affordance and nothing else', () => {
    renderOpen()
    fireEvent.focus(mark('f7'))
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

describe('⭐ the disclosure is announced, not merely drawn', () => {
  it('exactly the picked mark reports itself expanded, and points at the detail', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('f7'))

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

describe('⭐ the driver flag: presence only', () => {
  it('a node the glance named carries the flag, in the glance’s own words', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('f7'))
    expect(screen.getByTestId(`${TID}-detail-driver`)).toHaveTextContent(
      COPY.glance.whatMattersMost,
    )
  })

  it('a node it did not name carries NO flag — and no negative claim in its place', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('f8'))
    const detail = screen.getByTestId(`${TID}-detail`)
    expect(detail).toHaveAttribute('data-node-id', 'f8')
    expect(within(detail).queryByTestId(`${TID}-detail-driver`)).toBeNull()
  })
})

describe('⭐ the technique rides the finding that warrants it', () => {
  it('renders only where the mapping supplies one, bound by method id', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('o1'))
    expect(screen.getByTestId(`${TID}-detail-method`)).toHaveAttribute(
      'data-method-id',
      'pre_mortem',
    )

    // The unmapped finding names no technique — absence is not a placeholder.
    fireEvent.mouseEnter(mark('f7'))
    expect(screen.queryByTestId(`${TID}-detail-method`)).toBeNull()
  })

  it('the chip is a control: it opens the method with THIS node as the target', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('o1'))
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
    fireEvent.mouseEnter(mark('o1'))

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
  it('an unwired mount still navigates, and every detail reports the absence honestly', () => {
    render(<ModelStrip isPreRun={false} />)
    openStrip()
    fireEvent.click(mark('o1'))
    expect(focusModelTarget).toHaveBeenCalledWith('o1')
    expect(screen.getByTestId(`${TID}-detail-empty`)).toHaveTextContent(COPY.modelStrip.noInsight)
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
