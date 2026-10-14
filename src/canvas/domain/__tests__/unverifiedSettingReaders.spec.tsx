/**
 * A SETTING THE HOST COULD NOT VERIFY AS THE USER'S IS NOT OLUMI'S ESTIMATE — ON
 * EVERY READER OF AN OPTION'S INTERVENTION `source`.
 *
 * The CEE stamps `user_material_unverified: true` beside a demoted
 * `cee_hypothesis` when the AI claimed the user as the source of a setting and
 * the host could not verify that. The option inspector row is pinned in
 * `OptionPanel.interventionProvenanceMark.spec.tsx` (T-UNVERIFIED). This file
 * pins the other four readers of the same stamp, each through its own deployed
 * mount, each with its opposite-direction twin on the same fixture:
 *
 *   · the option CARD's change-row mark (`interventionTargetSourceMark`)
 *   · the Model tab's detail region (`InterventionProvenanceMark`)
 *   · the decision brief's "What Olumi assumed" (`selectEstimatedInterventions`),
 *     which is a LIST and a "+N more" COUNT of Olumi's own estimates
 *   · `InterventionDisplay`'s source badge
 *
 * The words are the existing ones (`UNVERIFIED_BRIEF_LABEL`), written LITERALLY
 * here so a change of voice REDs rather than agreeing with itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider, type Node } from '@xyflow/react'
import { OptionNode } from '../../nodes/OptionNode'
import { OptionChanceCellProvider } from '../../nodes/shared/OptionChanceCellProvider'
import { useCanvasStore } from '../../store'
import { ModelDetailRegion } from '../../model-tab-v2/ModelDetailRegion'
import { toRowDetail, type ModelProjectionInput } from '../../model-tab-v2/adapters'
import type { ModelRow } from '../../model-tab-v2/types'
import { InterventionDisplay } from '../../components/InterventionDisplay'
import { DecisionBriefSectionContainer } from '../../../components/results/decision-brief/DecisionBriefSection'
import { selectEstimatedInterventions } from '../../../components/results/decision-brief/estimatedInterventions'
import type { UIInterventionValue } from '../../../types/options'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual('@xyflow/react'), Handle: () => null }))

// ── The exact sentences a user reads. Written literally, never imported. ─────
const UNVERIFIED = 'Not confirmed from your brief'

const OPT = 'opt_pilot'
const OPT_LABEL = 'Run a pilot'
const F_FLAGGED = 'fac_flagged'
const F_PLAIN = 'fac_plain'
const F_USER = 'fac_user'
const FLAGGED_LABEL = 'Flagged capacity'
const PLAIN_LABEL = 'Plain budget'
const USER_LABEL = 'User headcount'

/** The AI's claim that the user said this, unverified by the host. */
const IV_FLAGGED = { value: 0.6, source: 'cee_hypothesis', value_confidence: 'low', user_material_unverified: true }
/** The same stamp-free `cee_hypothesis`: still Olumi's own estimate. */
const IV_PLAIN = { value: 0.3, source: 'cee_hypothesis', value_confidence: 'low' }
/** The user's own act outranks a stamp about the AI's claim. */
const IV_USER = { value: 0.8, source: 'user_specified', value_confidence: 'high', user_material_unverified: true }

function factor(id: string, label: string): Node {
  return {
    id, type: 'factor', position: { x: 0, y: 0 },
    data: { label, type: 'factor', kind: 'factor', observedState: { value: 0.5, source: 'user' } },
  } as unknown as Node
}
function option(interventions: Record<string, unknown>): Node {
  return {
    id: OPT, type: 'option', position: { x: 0, y: 0 },
    data: { label: OPT_LABEL, type: 'option', kind: 'option', provenance: 'ai_inferred', interventions },
  } as unknown as Node
}
const NODES = (): Node[] => [
  option({ [F_FLAGGED]: IV_FLAGGED, [F_PLAIN]: IV_PLAIN, [F_USER]: IV_USER }),
  factor(F_FLAGGED, FLAGGED_LABEL), factor(F_PLAIN, PLAIN_LABEL), factor(F_USER, USER_LABEL),
]

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [], edges: [], ceeAnalysisReady: null, goalThreshold: null,
    results: { status: 'idle', report: null },
  } as never)
})
afterEach(cleanup)

describe('T-UNVERIFIED-READERS — the stamp reaches every reader of an intervention source', () => {
  it('⭐⭐ T-CARD the option card marks the flagged target "Not confirmed from your brief", not "est."', () => {
    // The card shows a bounded number of rows, so the user-set contrast is its
    // own mount of the same component rather than a third row that might sit
    // behind "+N more".
    const mountCard = (interventions: Record<string, unknown>) => {
      const nodes = [option(interventions), factor(F_FLAGGED, FLAGGED_LABEL), factor(F_PLAIN, PLAIN_LABEL), factor(F_USER, USER_LABEL)]
      useCanvasStore.setState({
        nodes, edges: [], ceeAnalysisReady: null, lodRung: 'full', viewMode: 'standard',
        currentScenarioId: 'unverified', results: { status: 'idle', report: null },
      } as never)
      return render(
        <ReactFlowProvider><OptionChanceCellProvider>
          <OptionNode id={OPT} type="option" data={nodes[0].data as never} selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
        </OptionChanceCellProvider></ReactFlowProvider>,
      )
    }
    mountCard({ [F_FLAGGED]: IV_FLAGGED, [F_PLAIN]: IV_PLAIN })

    // Each row is resolved BY factor id (trap 19).
    const flagged = screen.getByTestId(`option-change-row-source-${OPT}-${F_FLAGGED}`)
    expect(flagged).toHaveAttribute('data-card-mark', 'source-unverified_brief')
    expect(flagged.getAttribute('aria-label')).toContain(UNVERIFIED)
    expect(screen.queryByTestId(`option-change-row-estimate-${OPT}-${F_FLAGGED}`)).toBeNull()

    // CONTRAST: the same literal without the stamp is still the estimate mark.
    expect(screen.getByTestId(`option-change-row-estimate-${OPT}-${F_PLAIN}`)).toHaveAttribute('data-card-mark', 'source-olumi')

    // CONTRAST: a target the user set stays theirs, flag or no flag.
    cleanup()
    mountCard({ [F_USER]: IV_USER })
    expect(screen.getByTestId(`option-change-row-source-${OPT}-${F_USER}`)).toHaveAttribute('data-card-mark', 'source-you')
  })

  it('⭐⭐ T-MODEL-TAB the Model tab detail marks the flagged target "Not confirmed from your brief", not "Olumi estimate"', () => {
    const input: ModelProjectionInput = { nodes: NODES(), edges: [], goalThreshold: null }
    const detail = toRowDetail(input, OPT)!
    const row: ModelRow = { id: OPT, kind: 'option', group: 'options', label: OPT_LABEL, primaryValue: '3 changes', attention: [], editable: true }
    render(<ModelDetailRegion row={row} detail={detail} tier="plain" />)
    const mark = (id: string) => screen.getByTestId(`model-detail-v2-intervention-${id}-provenance`)

    expect(within(mark(F_FLAGGED)).getByText(UNVERIFIED)).toBeInTheDocument()
    expect(within(mark(F_FLAGGED)).queryByText('Olumi estimate')).toBeNull()
    // CONTRAST: the plain hypothesis is still the estimate; the user's target is still theirs.
    expect(within(mark(F_PLAIN)).getByText('Olumi estimate')).toBeInTheDocument()
    expect(within(mark(F_USER)).getByText('User edited')).toBeInTheDocument()
    expect(within(mark(F_USER)).queryByText(UNVERIFIED)).toBeNull()
  })

  it('⭐⭐ T-BRIEF-COUNT the flagged setting is neither listed nor counted as Olumi’s in "What Olumi assumed"', () => {
    // Selector: only the unflagged hypothesis is Olumi's.
    const rows = selectEstimatedInterventions(NODES() as never)
    expect(rows.map(r => r.factorId)).toEqual([F_PLAIN])

    // Mounted: the section's count. Two Olumi estimates would read "+1 more".
    useCanvasStore.setState({
      nodes: NODES(), edges: [],
      results: { status: 'complete', report: { decision_brief: {
        version: '1', brief_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', created_at: '2026-10-14T07:00:00.000Z',
        top_drivers: [{ factor_label: 'Time to market', sensitivity: 0.4, direction: 'positive' }],
        key_assumptions: [], what_would_change: [], defaulted_assumptions: [],
      } } },
    } as never)
    render(<DecisionBriefSectionContainer leaderClaimPermitted hasOptionResult />)
    const group = screen.getByTestId('decision-brief-defaulted')
    expect(group).toHaveTextContent(PLAIN_LABEL)
    expect(group).not.toHaveTextContent(FLAGGED_LABEL)
    expect(group).not.toHaveTextContent('more')
  })

  it('⭐⭐ T-INTERVENTION-DISPLAY the source badge says "Not confirmed from your brief", not "inferred"', () => {
    const interventions: Record<string, UIInterventionValue> = {
      [F_FLAGGED]: IV_FLAGGED as UIInterventionValue,
      [F_PLAIN]: IV_PLAIN as UIInterventionValue,
      [F_USER]: IV_USER as UIInterventionValue,
    }
    render(<InterventionDisplay interventions={interventions} nodes={NODES() as never} />)
    const rowOf = (label: string) => screen.getByText(label).closest('div.flex.items-center.justify-between') as HTMLElement

    expect(within(rowOf(FLAGGED_LABEL)).getByText(UNVERIFIED)).toBeInTheDocument()
    expect(within(rowOf(FLAGGED_LABEL)).queryByText('inferred')).toBeNull()
    // CONTRAST: the plain hypothesis keeps this surface's existing word; the user's stays "you set this".
    expect(within(rowOf(PLAIN_LABEL)).getByText('inferred')).toBeInTheDocument()
    expect(within(rowOf(USER_LABEL)).getByText('you set this')).toBeInTheDocument()
  })
})
