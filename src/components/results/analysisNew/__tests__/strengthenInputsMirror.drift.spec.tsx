/**
 * ⭐⭐ THE MIRROR DRIFT GUARD — DO NOT DELETE, DO NOT LOOSEN.
 *
 * `buildStrengthenInputsForAnalysisNew` is a deliberate hand-maintained mirror
 * of the `inputs` useMemo inside `StrengthenContainer`. A hand-maintained mirror
 * is this estate's dominant defect class (CLAUDE.md trap 12) and is permitted
 * ONLY when it fails loud on drift. This is what makes it fail loud.
 *
 * ── THE MECHANISM ─────────────────────────────────────────────────────────
 * It renders the REAL `StrengthenContainer`, intercepts the object it actually
 * hands `buildRecommendations`, and asserts deep equality with what the mirror
 * produces from the same sources. So the comparison is against the container's
 * OBSERVED BEHAVIOUR, not against a copy of its source — which is the only kind
 * of comparison that can survive the container being edited.
 *
 * ⚠ IF THIS GOES RED, RE-MIRROR THE CHANGE IN
 * `buildStrengthenInputsForAnalysisNew.ts`. Do not relax the assertion, and do
 * not delete the mirror's diverging key from the comparison — either move
 * makes the guard agree with itself, which is worse than having no guard.
 *
 * ⚠ AND ITS POSITIVE CONTROL. A deep-equality assertion between two objects
 * that were never produced passes vacuously. The first case asserts the spy was
 * CALLED and that the captured object is non-trivial before any comparison is
 * made (trap 13).
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { StrengthenInputs } from '../../strengthen/strengthenTypes'

const captured: StrengthenInputs[] = []

// Spread the real module and intercept ONE export — a hand-listed factory would
// drop `toStrengthenPhase3Item`, which BOTH sides import.
vi.mock('../../strengthen/buildRecommendations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../strengthen/buildRecommendations')>()
  return {
    ...actual,
    buildRecommendations: (inputs: StrengthenInputs) => {
      captured.push(inputs)
      return actual.buildRecommendations(inputs)
    },
  }
})

import { StrengthenContainer } from '../../strengthen/StrengthenContainer'
import { buildStrengthenInputsForAnalysisNew } from '../buildStrengthenInputsForAnalysisNew'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { genuineDecision, highUncertainty, makeDriver, openStrategicChallenge } from './analysisNewFixtures'

/**
 * ⭐⭐ THE SCENARIO THE OTHER THREE COULD NOT SEE — and the reason this guard
 * passed 4/4 while the two sides disagreed on a reachable run.
 *
 * `hasLeadingOption` is fed from two DIFFERENT authorities:
 *   container → `leaderDesignationPermitted(rec)`   the COMPOSED answer (Q1 ∧ Q2)
 *   mirror    → `rec.verdict?.hasLeadingOption`      Q2 ALONE
 * `leaderDesignationPermitted()` falls back to Q2 when the composed field is
 * absent — and NO fixture in `analysisNewFixtures.ts` sets it (contrast-
 * controlled sweep of that file: `leaderDesignationPermitted` 0,
 * `recommendation` 11, `verdict` 5). So on every existing scenario both sides
 * evaluate the SAME expression and agree BY CONSTRUCTION. The guard was
 * agreeing with itself.
 *
 * This scenario is the only shape that separates them: Q2 says the arms
 * separated, the composed admission says the model does not license naming a
 * leader. It is not hypothetical — it is the `quantified_provisional` shape.
 */
const leaderAdmissionWithheld = (): ReturnType<typeof genuineDecision> => {
  const data = genuineDecision()
  return {
    ...data,
    recommendation: {
      ...data.recommendation,
      // Q2 stays `true` (inherited from `genuineDecision`) — the divergence
      // lives entirely in the composed field, which only one side reads today.
      leaderDesignationPermitted: false,
    },
  }
}

const SCENARIOS = {
  'open strategic challenge': openStrategicChallenge,
  'genuine decision': genuineDecision,
  'high uncertainty': highUncertainty,
  'leader admission withheld (composed false, verdict true)': leaderAdmissionWithheld,
}

beforeEach(() => {
  captured.length = 0
})
afterEach(() => {
  cleanup()
})

describe('the mirror matches the container it mirrors', () => {
  for (const [name, makeScenario] of Object.entries(SCENARIOS)) {
    it(`produces the same engine inputs as StrengthenContainer — ${name}`, () => {
      const data = makeScenario()
      // Give the drivers a fragile edge and a producer flag so the branches
      // that MAP something are actually exercised — a scenario whose every
      // optional input is absent would compare two mostly-empty objects.
      const enriched = {
        ...data,
        drivers: {
          ...data.drivers,
          drivers: [
            ...data.drivers.drivers,
            makeDriver({
              factorKey: 'f_extra',
              factorLabel: 'Extra factor',
              matchedNodeId: 'node_extra',
              worthInvestigating: true,
              confidence: 0.8,
              isDefaultedConfidence: false,
              rank: 9,
            }),
          ],
        },
        confidence: {
          ...data.confidence,
          challengeFragileEdges: [
            {
              edge_id: 'e_1',
              from_id: 'f_extra',
              from_label: 'Extra factor',
              to_label: 'Margin',
              switch_probability: 0.42,
            },
          ],
        },
      } as typeof data

      render(<StrengthenContainer data={enriched} />)

      // POSITIVE CONTROL — the comparison below means nothing if the container
      // never ran the engine.
      expect(captured.length, 'StrengthenContainer never called buildRecommendations').toBeGreaterThan(0)
      const fromContainer = captured[captured.length - 1]
      expect(
        fromContainer.factors.length,
        'the captured inputs carry no factors — this comparison would be near-vacuous',
      ).toBeGreaterThan(0)
      expect(fromContainer.fragileEdges.length).toBeGreaterThan(0)

      const fromMirror = buildStrengthenInputsForAnalysisNew({
        data: enriched,
        guidanceItems: useGuidanceStore.getState().guidanceItems,
        biasSignals: useCanvasStore.getState().draftCoaching?.biasSignals ?? null,
        currentStage: useCanvasStore.getState().currentStage,
      })

      expect(fromMirror).toEqual(fromContainer)
    })
  }

  it('the guard can actually detect a divergence', () => {
    // ⭐ THE DISCRIMINATING HALF. Without this, "the two agree" could be true
    // because the comparison is insensitive rather than because they agree.
    const data = openStrategicChallenge()
    const real = buildStrengthenInputsForAnalysisNew({
      data,
      guidanceItems: [],
      biasSignals: null,
      currentStage: null,
    })
    const drifted = { ...real, analysisComplete: !real.analysisComplete }
    expect(drifted).not.toEqual(real)
  })
})
