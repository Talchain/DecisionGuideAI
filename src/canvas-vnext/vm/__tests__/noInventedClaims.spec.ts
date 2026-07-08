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

describe('fixture-only slots (live-adapter purity)', () => {
  it("live builds NEVER emit the fixture-only 'worth_discussing' flag", () => {
    const report = {
      option_probabilities: { o1: { win_probability: 0.6 }, o2: { win_probability: 0.4 } },
      robustness: { recommended_option_id: 'o1', fragile_edges: [] },
    }
    const factorNodes = [...nodes, { id: 'f1', type: 'factor', data: { label: 'Demand' } }]
    const vm = buildGraphExperienceVM({
      provenance: 'live',
      nodes: factorNodes,
      edges,
      report,
      ceeAnalysisReady: null,
      displayState: 'complete',
      goalThreshold: null,
      prefillChatAvailable: false,
      resultSignals: {
        stateHeadline: 'Analysis complete',
        driverSignals: [{ nodeId: 'f1', influenceRank: 1, confidence: 0.2, canFlipResult: true }],
        evidenceGapSignals: [{ nodeId: 'f1' }],
        hingeLabel: 'Demand',
      },
    })
    for (const card of Object.values(vm.factorCards)) {
      expect(card.flag).not.toBe('worth_discussing')
    }
  })

  it('the live adapter file never passes fixtureFactorFlags (source pin)', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const adapter = readFileSync(join(__dirname, '..', 'useGraphExperienceVM.tsx'), 'utf8')
    expect(adapter).not.toMatch(/fixtureFactorFlags\s*:/)
  })
})

describe('fixture builds', () => {
  it('the demo VM is explicitly fixture-provenance (forces the Example-data pill)', () => {
    expect(buildDemoVM().provenance).toBe('fixture')
  })

  it("the demo exercises the fixture-only 'worth_discussing' slot (positive control)", () => {
    const demo = buildDemoVM()
    const flagged = Object.values(demo.factorCards).filter((c) => c.flag === 'worth_discussing')
    expect(flagged).toHaveLength(1)
    expect(flagged[0].flagIsResultDerived).toBe(false)
  })
})
