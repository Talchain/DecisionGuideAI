/**
 * ⛔ REVERSED — V2 prototype (Paul, 25 Sep 2026: "match the prototype").
 *
 * This file proved the Reasoning tab's Focus Now mount was LIVE and NARROWED,
 * with a discriminating pair driven through the model facts: a model with no
 * risk earned the add-risk nudge, a real model with no target earned
 * define-success, an empty canvas earned nothing. The prototype has no
 * "Focus now" block on this tab, so that mount is removed. Its nudges stay on
 * the Analysis tab (`ResultsBody`'s un-narrowed `<FocusNowContainer />`), and
 * the success nudge is the model strip's own "What would success look like?"
 * row.
 *
 * So the pair is kept, pointed the other way, and each absence carries a
 * present control in the same run (trap 13):
 *   · SOURCE: `AnalysisNewTabBody.tsx` neither imports the focus-now module nor
 *     mounts `<FocusNowContainer`, while `ResultsBody.tsx` does both — the
 *     contrast that proves the probe sees the one real mount. (Rendering the
 *     container here is not an option: `focus-now/__tests__/inertness.spec.ts`
 *     walks every file under src/, tests included, and allows only listed
 *     importers. The Analysis tab's rows are pinned rendering by
 *     `ResultsBody.focusPlacement.spec.tsx`.)
 *   · DOM: on the canvas that used to earn add-risk, the Reasoning tab renders
 *     no Focus Now panel or row, over a model strip that did render;
 *   · on a real model with no target, the Reasoning tab renders no
 *     define-success row, and the strip's success row asks the question.
 *
 * Bound to each nudge by IDENTITY (`data-row-id`, `STATIC_HYGIENE_ROWS`), not
 * by text: the engine's success-measure finding can carry the same words.
 *
 * Deleted cases (they pinned the removed Reasoning-tab mount): "RENDERS the
 * nudge for a gap this model actually has — the mount is live", "renders
 * NOTHING once the model has the thing each nudge asks for", "⛔ AN EMPTY
 * CANVAS EARNS NO NUDGE — unknown is not absent", "⛔ an empty canvas earns no
 * DEFINE SUCCESS even when the hook reports hasGoalTarget FALSE", "but a REAL
 * model with no target DOES earn it — the gate must not swallow the signal".
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { genuineDecision, makeData } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const node = (id: string, type: string) => ({ id, type, position: { x: 0, y: 0 }, data: { label: id } })

const ADD_RISK_ID = 'static:add-risk'
const DEFINE_SUCCESS_ID = 'static:define-success'

/** Options, a factor and an outcome, but NO risk: the canvas that earned add-risk. */
const NO_RISK = [node('o1', 'option'), node('o2', 'option'), node('f1', 'factor'), node('out1', 'outcome')]

/** The Focus Now row with this static id, or null. Identity, not text. */
const nudge = (rowId: string): HTMLElement | null =>
  screen.queryAllByTestId('focus-card').find((c) => c.getAttribute('data-row-id') === rowId) ?? null

function renderTab(nodes: ReturnType<typeof node>[], data: ResultsSectionDataReturn) {
  useCanvasStore.setState({ nodes } as never)
  return render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="focus-now-mount"
    />,
  )
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [] } as never)
})

describe('Focus Now is not mounted on the Reasoning tab (V2 prototype, 25 Sep)', () => {
  it('the mount is gone from this tab and kept on the Analysis tab — by source, with its contrast', () => {
    const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8')
    const FOCUS_IMPORT = /from\s*['"][^'"]*coaching-panel\/focus-now['"]/
    const FOCUS_MOUNT = /<FocusNowContainer\b/
    const reasoning = read('../AnalysisNewTabBody.tsx')
    const analysis = read('../../ResultsBody.tsx')
    // PRESENT CONTROL FIRST: the Analysis tab's mount, same probes.
    expect(analysis, 'control: ResultsBody imports Focus Now').toMatch(FOCUS_IMPORT)
    expect(analysis, 'control: ResultsBody mounts Focus Now').toMatch(FOCUS_MOUNT)
    expect(reasoning).not.toMatch(FOCUS_IMPORT)
    expect(reasoning).not.toMatch(FOCUS_MOUNT)
  })

  it('on the canvas that used to earn add-risk, the Reasoning tab renders no Focus Now panel or row', () => {
    renderTab(NO_RISK, makeData(genuineDecision()))
    expect(nudge(ADD_RISK_ID)).toBeNull()
    expect(screen.queryByTestId('focus-now-panel')).toBeNull()
    expect(screen.queryAllByTestId('focus-card')).toHaveLength(0)
    // The tab rendered over this model, so the absence is the ruling.
    expect(screen.getByTestId('analysis-new-model-strip')).toBeInTheDocument()
  })

  /**
   * ⭐ THE SUCCESS NUDGE MOVED, IT DID NOT DISAPPEAR. `hasGoalTarget: false` on
   * a real model with a goal: before V2 this earned the define-success row;
   * now the strip's own success row asks the question, with the pencil named
   * as the V2 prototype names it (design audit B5, 26 Sep): "Describe success
   * in words or set an optional target".
   */
  it('a real model with no target: no define-success row — the strip asks "What would success look like?"', () => {
    const base = genuineDecision()
    const noStatedTarget = {
      ...base,
      recommendation: { ...base.recommendation, hasGoalTarget: false },
    } as ResultsSectionDataReturn
    renderTab([node('g1', 'goal'), ...NO_RISK, node('r1', 'risk')], noStatedTarget)
    expect(nudge(DEFINE_SUCCESS_ID)).toBeNull()
    expect(screen.queryByTestId('focus-now-panel')).toBeNull()
    const row = screen.getByTestId('analysis-new-model-strip-target')
    expect(row).toHaveTextContent('What would success look like?')
    expect(
      within(row).getByRole('button', { name: 'Describe success in words or set an optional target' }),
    ).toBeInTheDocument()
  })
})
