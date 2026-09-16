/**
 * ⭐⭐ THE MOUNT IS REAL, AND THE NARROWING IS NOT VACUOUS — the discriminating
 * pair, because either half alone proves nothing.
 *
 * The existing section census went GREEN the moment Focus Now was mounted. That
 * is exactly what a mount rendering NOTHING looks like, so the census cannot
 * tell "narrowed correctly" from "never mounted" (CLAUDE.md trap 3b). This file
 * drives the two outcomes through the DATA:
 *
 *   · a model with no risk node  -> the add-risk nudge RENDERS   (the mount is live)
 *   · a model with everything    -> Focus Now renders NOTHING    (the narrowing bites)
 *
 * Neither case alone is evidence. Together they bind the surface to the model
 * fact rather than to the fixture.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { genuineDecision, makeData } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const node = (id: string, type: string) => ({ id, type, position: { x: 0, y: 0 }, data: { label: id } })

const ADD_RISK = 'Add a risk worth watching'
const DEFINE_SUCCESS = 'Define what success looks like'

function renderWith(nodes: ReturnType<typeof node>[], data: ResultsSectionDataReturn) {
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

describe('Focus Now on the Reasoning tab', () => {
  it('RENDERS the nudge for a gap this model actually has — the mount is live', () => {
    const data = makeData(genuineDecision())
    // Options, a factor and an outcome, but NO risk node.
    renderWith(
      [node('o1', 'option'), node('o2', 'option'), node('f1', 'factor'), node('out1', 'outcome')],
      data,
    )
    expect(screen.getByText(ADD_RISK)).toBeInTheDocument()
  })

  it('renders NOTHING once the model has the thing each nudge asks for', () => {
    const data = makeData(genuineDecision())
    renderWith(
      [
        node('o1', 'option'),
        node('o2', 'option'),
        node('f1', 'factor'),
        node('out1', 'outcome'),
        node('r1', 'risk'),
      ],
      data,
    )
    expect(screen.queryByText(ADD_RISK)).toBeNull()
  })

  it('⛔ AN EMPTY CANVAS EARNS NO NUDGE — unknown is not absent', () => {
    // Without the `stripHasContent` guard every kind reads absent here and the
    // panel would demand an outcome and a risk before anything has been built.
    const data = makeData(genuineDecision())
    renderWith([], data)
    expect(screen.queryByText(ADD_RISK)).toBeNull()
    expect(screen.queryByText(DEFINE_SUCCESS)).toBeNull()
  })

  /**
   * ⛔⛔ THE PAIR THE CASE ABOVE COULD NOT MAKE — and its absence hid a real
   * defect through a whole review.
   *
   * That case feeds `genuineDecision()`, which already carries a goal target,
   * so DEFINE_SUCCESS was absent because the FIXTURE said a target existed —
   * never because the guard held. The fixture was answering the question.
   *
   * ⭐ WHAT THE REAL HOOK EMITS, derived at `useResultsSectionData.ts:1676`:
   * `hasStatedGoalTarget` is a plain `boolean` with no unknown branch. On an
   * empty canvas — no goal node, no threshold, no readiness — every arm is
   * false and it returns `false`. A MEASURED false, indistinguishable at the
   * consumer from "this model was built and has no target".
   *
   * So the mount's `?? null` was catching `undefined`, which the real hook
   * NEVER emits, while the `false` it always emits flowed straight through.
   * The guard caught the case that cannot happen and missed the one that does.
   *
   * These two bind the gate to the model fact rather than to the fixture, and
   * they must disagree with each other — same `hasGoalTarget: false`, opposite
   * outcomes, decided only by whether a model exists.
   */
  const noStatedTarget = (): ResultsSectionDataReturn => {
    const base = genuineDecision()
    return {
      ...base,
      recommendation: { ...base.recommendation, hasGoalTarget: false },
    } as ResultsSectionDataReturn
  }

  it('⛔ an empty canvas earns no DEFINE SUCCESS even when the hook reports hasGoalTarget FALSE', () => {
    renderWith([], noStatedTarget())
    expect(screen.queryByText(DEFINE_SUCCESS)).toBeNull()
  })

  it('but a REAL model with no target DOES earn it — the gate must not swallow the signal', () => {
    renderWith(
      [
        node('o1', 'option'),
        node('o2', 'option'),
        node('f1', 'factor'),
        node('out1', 'outcome'),
        node('r1', 'risk'),
      ],
      noStatedTarget(),
    )
    expect(screen.getByText(DEFINE_SUCCESS)).toBeInTheDocument()
  })
})
