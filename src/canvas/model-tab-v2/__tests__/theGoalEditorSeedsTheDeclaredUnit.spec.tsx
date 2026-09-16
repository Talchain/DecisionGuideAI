/**
 * ⭐⭐ OPENING THE GOAL EDITOR ON A GOAL THAT DECLARES A UNIT AND CARRIES NO
 * TARGET MUST SEED THE UNIT BOX WITH THAT UNIT.
 *
 * ⛔⛔ THE DEFECT THIS BINDS. `beginEdit` seeded `unit: target?.unit ?? ''` from
 * `resolveGoalTarget(node.data)`. That resolver answers *"what TARGET is
 * set?"* and returns `null` when none is, discarding the `goal_threshold_unit`
 * it read on the way past (`domain/goalTarget.ts`). So a reader opening the
 * editor to set their FIRST target — the one state this row exists for — got an
 * EMPTY unit box, and leaving it alone earned `unproposableDraftReason`'s
 * *"Add a unit — £, % or points to review this change"* about a goal that has
 * one.
 *
 * ⚠⚠ WHY THIS FILE EXISTS RATHER THAN RELYING ON THE OWNER'S OWN SPEC.
 * `declaredGoalUnitIsNotTheTargets.spec.ts` proves the pure function is right.
 * It CANNOT prove this call site calls it — and this call site is where the
 * defect lived. A guard whose corpus bypasses the code under test agrees with
 * itself (CLAUDE.md trap 13b), so the binding is asserted here, in the DOM, at
 * the seeded value.
 *
 * ⚠ THE SIBLING WAS FOUND BY SWEEPING, NOT BY HITTING IT. The same expression
 * in `SuccessTargetLine` was the reported defect; this one was found by
 * enumerating every `resolveGoalTarget` consumer and asking which question each
 * one asks. The other three are correct: two read `.raw` to ask whether a
 * target exists, and the outline reads `.unit` to DISPLAY a target beside its
 * figure, which is a question the resolver does answer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

vi.mock('../../conversation/turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../utils/focusHelpers', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { useCanvasStore } from '../../store'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { openOutlineGroups } from './openOutlineGroups'

const GOAL = 'goal_service'
const HASH = '9f2c1b0ae4d37c5a'
const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

/** A goal that DECLARES a unit and carries NO target — `resolveGoalTarget` reads null here. */
const goalNodes = (data: Record<string, unknown>): Node[] => [
  { id: GOAL, type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Hit ARR target', ...data } } as Node,
  { id: 'fac_1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Competitive pressure' } } as Node,
]

function openGoalEditor(data: Record<string, unknown>) {
  useCanvasStore.setState(
    { nodes: goalNodes(data), edges: [], lastServerGraphHash: HASH, currentScenarioId: SCENARIO } as never,
    false,
  )
  render(
    <ConversationProvider>
      <ModelTabV2Panel
        nodes={goalNodes(data)}
        edges={[]}
        goalThreshold={null}
        currentScenarioId={SCENARIO}
        lastServerGraphHash={HASH}
      />
    </ConversationProvider>,
  )
  openOutlineGroups()
  fireEvent.click(screen.getByTestId(`model-row-v2-${GOAL}-value`))
}

afterEach(cleanup)

describe('the goal editor seeds the unit the GOAL declares', () => {
  /**
   * ⭐ THE LOAD-BEARING CASE. At the defect the box seeds `''`, because no
   * target exists for the resolver to carry a unit out of.
   */
  it('seeds the declared unit when the goal carries NO target', () => {
    openGoalEditor({ goal_threshold_unit: '%' })
    expect(screen.getByLabelText('Target unit for Hit ARR target')).toHaveValue('%')
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Without it, a component hardcoded to emit `'%'`
   * passes the case above. A DIFFERENT unit must arrive as that unit.
   */
  it('⛔ CONTRAST: seeds a different declared unit as that unit', () => {
    openGoalEditor({ goal_threshold_unit: '£' })
    expect(screen.getByLabelText('Target unit for Hit ARR target')).toHaveValue('£')
  })

  /**
   * ⚠ UNCHANGED WHERE A TARGET EXISTS — the two readings agree there, and this
   * pins that the fix did not move the case that already worked.
   */
  it('still seeds the unit where a target DOES exist', () => {
    openGoalEditor({ goal_threshold_raw: 110, goal_threshold_unit: '%' })
    expect(screen.getByLabelText('Target unit for Hit ARR target')).toHaveValue('%')
  })

  /** ⛔ A goal declaring no unit still opens empty — the refusal stays reachable. */
  it('seeds empty where the goal declares no unit', () => {
    openGoalEditor({})
    expect(screen.getByLabelText('Target unit for Hit ARR target')).toHaveValue('')
  })
})
