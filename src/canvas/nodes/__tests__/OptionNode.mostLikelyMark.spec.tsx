/**
 * ⭐ D6 B (Paul, 26 Oct, design page Decision 6): beside W6's "most likely" line, a small mark on that option's card,
 * "most likely in this model". Shown only where CEE's view permits naming the option (`leader.licence === 'permitted'`)
 * and names THIS option as the goal-chance leader of a current Run; nothing when the leader is withheld, the Run is not
 * current, or another option is named. Never the win-share "recommended" path.
 *
 * Real path: the served capacity reads #3010's rows use (`pass-capacity-35463f30-read.json`, current;
 * `s2-capacity-stale-after-deploy-read.json`, not current) through the real `parseCanonicalAnalysisView`, adopted into
 * the real view store, and the real `OptionNode`. Those reads predate CEE #3792, so the leader is spelled inline in its
 * shape (SYNTHETIC, labelled), as in `viewOnlyRunChances.mostLikely.spec.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null }))
vi.mock('../shared/NodePopover', () => ({ NodePopover: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../runView/canonicalAnalysisView'
import current from '../../runView/__tests__/fixtures/pass-capacity-35463f30-read.json'
import stale from '../../runView/__tests__/fixtures/s2-capacity-stale-after-deploy-read.json'

type Json = Record<string, any>
const KEEP = 'keep_current_staffing'
const ADD = 'add_one_specialist'
const MARK = 'most likely in this model'
/** SYNTHETIC, labelled: CEE #3792's leader shapes. */
const PERMITTED = (leader: string): Json => ({ licence: 'permitted', option_id: null, goal_chance_leader: leader, similar_option_ids: [], words: 'In this model, …' })
const WITHHELD: Json = { licence: 'withheld', option_id: null, goal_chance_leader: null, similar_option_ids: [KEEP, ADD], words: 'In this model, … are too close to call …' }

/** The board with this read's view adopted, carrying this leader; then the card for `optionId`. */
function card(source: Json, leader: Json, optionId: string) {
  const view = parseCanonicalAnalysisView({ ...source.canonical_analysis_view, leader_licence: leader.licence, leader })
  expect(view).not.toBeNull()
  const nodes = source.graph.nodes.map((x: Json, i: number) => ({ id: x.id, type: x.kind, position: { x: 0, y: i * 100 }, data: { label: x.label, type: x.kind } }))
  useCanvasStore.setState({ currentScenarioId: source.scenario_id, lastServerGraphHash: source.graph_hash, nodes, edges: [] } as never)
  useCanonicalAnalysisViewStore.getState().adopt(source.scenario_id, view)
  const option = nodes.find((x: Json) => x.id === optionId)!
  render(<ReactFlowProvider>
    <OptionNode type="option" position={{ x: 0, y: 0 }} selected={false} isConnectable
      positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0}
      deletable selectable draggable id={optionId} data={option.data} {...({} as any)} />
  </ReactFlowProvider>)
  return screen.queryByTestId(`option-most-likely-${optionId}`)
}

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { cleanup() })

describe('the "most likely in this model" mark on an option card', () => {
  it('CEE permits naming it, names this option, and the Run is current: the mark, in the mock\'s words', () => {
    expect(card(current, PERMITTED(ADD), ADD)?.textContent).toBe(MARK)
  })

  it('the leader is withheld (too close to call): no mark', () => {
    expect(card(current, WITHHELD, ADD)).toBeNull()
  })

  it('a licence short of "permitted" (with a caveat), though CEE named this option: no mark', () => {
    expect(card(current, { ...PERMITTED(ADD), licence: 'permitted_with_caveat' }, ADD)).toBeNull()
  })

  it('the Run is not current: no mark, though CEE named this option', () => {
    expect(card(stale, PERMITTED(ADD), ADD)).toBeNull()
  })

  it('CEE named another option: no mark on this one', () => {
    expect(card(current, PERMITTED(ADD), KEEP)).toBeNull()
  })
})
