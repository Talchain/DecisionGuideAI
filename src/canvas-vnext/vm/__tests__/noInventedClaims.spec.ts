// No invented claims: live VMs carry only producer-backed values; fixture
// provenance is explicit and never leaks into live builds.

import { describe, it, expect } from 'vitest'
import { buildGraphExperienceVM } from '../buildGraphExperienceVM'
import { buildDemoVM } from '../../fixtures'

const nodes = [
  { id: 'o1', type: 'option', data: { label: 'A' } },
  { id: 'o2', type: 'option', data: { label: 'B' } },
  { id: 'g1', type: 'goal', data: { label: 'Goal' } },
]
const edges = [{ id: 'e1', source: 'o1', target: 'g1', data: { weight: 0.5, direction: 'positive' } }]

describe('live builds', () => {
  it('carry provenance live', () => {
    const vm = buildGraphExperienceVM({
      provenance: 'live',
      nodes,
      edges,
      report: null,
      ceeAnalysisReady: null,
      displayState: 'ready_to_analyse',
      goalThreshold: null,
      prefillChatAvailable: false,
    })
    expect(vm.provenance).toBe('live')
  })

  it('never fabricate probabilities the producer did not send', () => {
    const report = {
      option_probabilities: { o1: { win_probability: 0.6 } }, // o2 missing
      robustness: { recommended_option_id: 'o1', fragile_edges: [] },
    }
    const vm = buildGraphExperienceVM({
      provenance: 'live',
      nodes,
      edges,
      report,
      ceeAnalysisReady: null,
      displayState: 'complete',
      goalThreshold: null,
      prefillChatAvailable: false,
    })
    expect(vm.optionCards.o2.winDisplay).toBeNull()
    expect(vm.optionCards.o2.goalFitDisplay).toBeNull()
  })

  it('emit no goal-fit values without a user target (UI-SEM-071)', () => {
    const report = {
      option_probabilities: { o1: { win_probability: 0.6, goal_probability: 0.9 }, o2: { win_probability: 0.4, goal_probability: 0.5 } },
      robustness: { recommended_option_id: 'o1', fragile_edges: [] },
    }
    const vm = buildGraphExperienceVM({
      provenance: 'live',
      nodes,
      edges,
      report,
      ceeAnalysisReady: null,
      displayState: 'complete',
      goalThreshold: null,
      prefillChatAvailable: false,
    })
    for (const card of Object.values(vm.optionCards)) {
      expect(card.goalFitDisplay).toBeNull()
    }
  })
})

describe('fixture builds', () => {
  it('the demo VM is explicitly fixture-provenance (forces the Example-data pill)', () => {
    expect(buildDemoVM().provenance).toBe('fixture')
  })
})
