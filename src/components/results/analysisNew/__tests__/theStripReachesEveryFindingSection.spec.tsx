/**
 * THE STRIP'S DENIAL IS A CLAIM ABOUT THE WHOLE PANEL, SO IT MUST REACH EVERY
 * SECTION THE PANEL RENDERS — NOT THE TWO THE FIRST FIX HAPPENED TO LIST.
 *
 * ⚠⚠ THIS SPEC EXISTS BECAUSE THE FIX FOR THE ORIGINAL DEFECT SHIPPED WITH THE
 * ORIGINAL DEFECT STILL IN IT, for a different pair of sections, under a comment
 * claiming it covered "every other section". `panelMentionsAreNotDenied.spec.ts`
 * proves `buildNodeInsights` can hold a mention and
 * `panelMentionsRender.spec.tsx` proves `ModelStrip` renders one — and BOTH stay
 * green while the MOUNT hands the builder two of the panel's four
 * finding-bearing sections. Neither can see the mount, and the mount is where
 * the list was short. That is the gap this file closes.
 *
 * ── THE REACHABLE FAILURE, AND IT IS AN ORDINARY RUN ────────────────────────
 * `GLANCE_DRIVER_COUNT = 3` caps `vm.atAGlance.drivers`, which is the only
 * driver list the strip's index reads. The Drivers SECTION is uncapped in data
 * (`buildDrivers`: `live.map(driverFinding)`), so on ANY run with four or more
 * live drivers the rank-4 node has:
 *
 *   · `driverLabel === null`    (the glance cap dropped it)
 *   · `findings.length === 0`   (no intervention names it)
 *   · `mentions.length === 0`   (drivers was not a mention section)
 *
 * ⇒ "Nothing else on this panel refers to this node." — while "Drivers and
 * dynamics" is naming that exact node on screen, one click away.
 *
 * ⚠ THE CAP AND THE SECTION ARE PINNED IN-TEST, NOT ASSUMED. If the glance ever
 * stopped capping, the rank-4 node would earn a `driverLabel`, the denial would
 * never render, and every assertion below would pass while proving nothing
 * (CLAUDE.md trap 13b — a guard whose discrimination depends on a fixture that
 * nothing pins). The first case therefore asserts the rank-1 node HAS the
 * glance's chip and the rank-4 node does NOT: a contrast pair, in one run.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { makeData, makeDriver } from './analysisNewFixtures'

const STRIP = 'analysis-new-model-strip'

/** Rank 4 by array position — `glanceDrivers` slices the list as the producer sent it. */
const RANK_4 = 'f_reporting'
const RANK_4_LABEL = 'Regulatory reporting load'
const RANK_1 = 'f_leadtime'

/**
 * ⚠ ON THE CANVAS AND IN NO SECTION AT ALL — the opposite-direction twin's
 * subject. Removing the denial altogether would be its own defect (silence is
 * indistinguishable from a broken control), and this node is the only thing
 * that can see that.
 */
const SILENT = 'f_untouched'

const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Sustained margin' } },
  { id: RANK_1, type: 'factor', data: { label: 'Supplier lead time' } },
  { id: 'f_demand', type: 'factor', data: { label: 'Demand volatility' } },
  { id: 'f_price', type: 'factor', data: { label: 'Competitor pricing' } },
  { id: RANK_4, type: 'factor', data: { label: RANK_4_LABEL } },
  { id: SILENT, type: 'factor', data: { label: 'Warehouse lease term' } },
]

/**
 * FOUR LIVE DRIVERS, IN PRODUCER ORDER. `glanceDrivers` takes
 * `rows.slice(0, GLANCE_DRIVER_COUNT)` off THIS array, so the fourth element is
 * the one the glance drops and the Drivers section keeps.
 */
const fourDrivers = () =>
  makeData({
    drivers: {
      totalCount: 4,
      drivers: [
        makeDriver({ factorKey: RANK_1, factorLabel: 'Supplier lead time', rank: 1, displayInfluence: 0.9 }),
        makeDriver({ factorKey: 'f_demand', factorLabel: 'Demand volatility', rank: 2, displayInfluence: 0.7 }),
        makeDriver({ factorKey: 'f_price', factorLabel: 'Competitor pricing', rank: 3, displayInfluence: 0.5 }),
        makeDriver({ factorKey: RANK_4, factorLabel: RANK_4_LABEL, rank: 4, displayInfluence: 0.3 }),
      ],
    },
  })

const previous = { nodes: [] as unknown }

beforeEach(() => {
  previous.nodes = useCanvasStore.getState().nodes
  useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: previous.nodes } as never)
})

const renderPanel = () =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={fourDrivers()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_four_drivers"
    />,
  )

/** Post-run the strip mounts CLOSED and its marks are unmounted with it. */
const openStrip = () => {
  const toggle = screen.getByTestId(`${STRIP}-toggle`)
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

/**
 * Select ONE node's mark, BY ITS NODE ID.
 *
 * ⚠ NEVER `marks[0]`. Every mark of a kind renders identically, so an index
 * would bind this whole spec to whichever factor happens to sort first — a
 * value predicate several objects satisfy, which is the binding CLAUDE.md trap
 * 19 exists to forbid. The id is the identity.
 */
const pickNode = (nodeId: string) => {
  openStrip()
  const marks = screen.getAllByTestId(`${STRIP}-mark`)
  const mark = marks.find((m) => m.getAttribute('data-node-id') === nodeId)
  expect(mark, `no mark for ${nodeId} — every assertion after this would be vacuous`).toBeTruthy()
  fireEvent.click(mark as HTMLElement)
  expect(screen.getByTestId(`${STRIP}-detail`)).toHaveAttribute('data-node-id', nodeId)
}

const mentionsOn = () =>
  screen.queryAllByTestId(`${STRIP}-detail-mention`).map((el) => ({
    id: el.getAttribute('data-mention-id'),
    section: el.getAttribute('data-mention-section'),
    text: el.textContent ?? '',
  }))

const denial = () => screen.queryByTestId(`${STRIP}-detail-empty`)?.textContent ?? null

describe('THE PRECONDITION — this fixture really does reach the defective class', () => {
  /**
   * ⭐ THE CONTRAST PAIR. Both halves are required: the first proves the glance
   * list is populated at all (without it the second is satisfied by a run that
   * produced no drivers), the second proves the CAP is what drops the rank-4
   * node rather than an empty index.
   */
  it('the glance named the rank-1 driver and the cap dropped the rank-4 one', () => {
    renderPanel()

    pickNode(RANK_1)
    expect(
      screen.getByTestId(`${STRIP}-detail-driver`),
      'the glance chip is missing on rank 1 — the cap below would prove nothing',
    ).toHaveTextContent(COPY.glance.whatMattersMost)

    pickNode(RANK_4)
    expect(screen.queryByTestId(`${STRIP}-detail-driver`)).toBeNull()
    // And nothing else the OLD index could see reaches it either, so a mention
    // is the only thing that can lift the denial in the next case.
    expect(screen.queryAllByTestId(`${STRIP}-detail-finding`)).toHaveLength(0)
  })

  it('the Drivers section is naming that node on screen, four rows deep', () => {
    renderPanel()

    const section = screen.getByTestId('analysis-new-drivers')
    expect(screen.getByTestId('analysis-new-drivers-count')).toHaveTextContent('4')

    const toggle = screen.getByTestId('analysis-new-drivers-toggle')
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
    // `DRIVER_PREVIEW` is 3, so the rank-4 row sits behind the section's own
    // disclosure. It is on the panel either way — the strip's sentence says
    // "on this panel", not "in the first three rows" — but reading it here
    // makes the precondition a thing this test SAW rather than inferred.
    fireEvent.click(screen.getByTestId('analysis-new-drivers-show-more'))

    /* ⚠ BOUND TO A DRIVER ROW, NOT TO THE TEXT ANYWHERE IN THE SECTION. The
       influence CHART sits in this section's header and renders every driver's
       label too, so `getByText` would match twice and throw — and a looser
       "the label appears somewhere" assertion would be satisfied by the chart
       alone, which is a different surface from the row list this case is
       about. */
    const rows = within(section).getAllByTestId('analysis-new-drivers-row')
    expect(rows).toHaveLength(4)
    expect(rows.filter((r) => (r.textContent ?? '').includes(RANK_4_LABEL))).toHaveLength(1)
  })
})

describe('⛔ THE REACHABLE FAILURE — the strip may not deny the Drivers section', () => {
  it('the rank-4 driver is pointed at, not denied', () => {
    renderPanel()
    pickNode(RANK_4)

    // The defect, stated as the assertion that RED-ed before the mount passed
    // `vm.drivers.findings`: the panel is talking, so the strip may not say it
    // is silent.
    expect(denial()).toBeNull()

    // BOUND BY IDENTITY to the driver finding's own id (`driver:${factorKey}`),
    // never to the label — the Drivers section renders that label too, so a
    // text predicate would pass on the wrong element entirely.
    expect(mentionsOn()).toEqual([
      expect.objectContaining({ id: `driver:${RANK_4}`, section: 'drivers' }),
    ])
    expect(mentionsOn()[0].text).toBe(
      COPY.modelStrip.mention(COPY.sections.drivers, RANK_4_LABEL),
    )
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN, and it is the one that matters. A change
   * that credited every node with every mention, or that simply deleted the
   * empty state, would satisfy every assertion above and be a worse defect than
   * the one being fixed: the reader could no longer tell "nothing said about
   * this" from "the control is broken".
   */
  it('a node NO section names is still told so, in the same run', () => {
    renderPanel()
    pickNode(SILENT)

    expect(mentionsOn()).toEqual([])
    expect(denial()).toBe(COPY.modelStrip.noInsight)
  })
})
