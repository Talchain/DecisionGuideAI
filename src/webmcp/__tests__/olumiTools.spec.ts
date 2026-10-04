/**
 * EXPERIMENT ONLY (#76) — T2 grounding contract and tool behaviour.
 * Gate F: no figure unless CEE says the analysis is current; no invented leader;
 * authorship from the UI's own classifier; proposals/builds never claim more than happened.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { projectState, OUTPUT_BUDGET_CHARS } from '../projectState'
import type { ScenarioGraphResult } from '../../adapters/cee/scenarioGraph'

const runs = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../canvas/analysis/canonicalRunRegistry', () => ({ executeCanonicalRun: runs.execute }))
vi.mock('../../adapters/cee/scenarioGraph', () => ({ fetchScenarioGraph: vi.fn(async () => ({ status: 'absent', requestId: null })) }))

import { olumiTools, proposalTools, PROPOSAL_TOOLS_LIVE, type ConversationBridge } from '../olumiTools'
import { probeTools } from '../probeTools'
import { useCanvasStore } from '../../canvas/store'

const GRAPH = {
  nodes: [
    { id: 'g1', kind: 'goal', label: 'Grow MRR to £100k' },
    { id: 'o1', kind: 'option', label: 'Raise Pro price' },
    { id: 'o2', kind: 'option', label: 'AI add-on' },
    { id: 'f1', kind: 'factor', label: 'Pro price', observed_state: { value: 0.49, raw_value: 49, unit: 'GBP', source: 'brief_extraction' } },
    { id: 'f2', kind: 'factor', label: 'Churn', observed_state: { value: 0.037, display_value: '3.7%', source: 'cee_inference' } },
    { id: 'f3', kind: 'factor', label: 'Bare scale', observed_state: { value: 0.6, source: 'user_override' } },
    { id: 'r1', kind: 'risk', label: 'Churn spike' },
  ],
}

function read(kind: string, extra: Partial<Record<string, unknown>> = {}): ScenarioGraphResult {
  return {
    status: 'graph',
    graph: GRAPH,
    briefText: 'Grow MRR without increasing churn',
    notModelled: null,
    identity: null,
    graphHash: 'h',
    layoutPresent: false,
    analysisState: { run_state: { kind, ...(kind === 'blocked' ? { blockers: [{ code: 'x', category: 'c', message: 'Add a unit for Churn.', repairability: 'user' }] } : {}) } },
    analysisResult: { type: 'analysis_result', summary: 'Raise Pro price leads in most futures.', leading_option_id: 'o1', win_probabilities: { o1: 0.62, o2: 0.38 } },
    requestId: null,
    ...extra,
  } as unknown as ScenarioGraphResult
}

const NUMBER_IN_ANALYSIS = /\d/

describe('projectState — grounding contract', () => {
  it('current analysis: CEE summary verbatim, leader by label, probabilities by label', () => {
    const out = projectState({ scenarioId: 's', read: read('complete_current'), turnInFlight: false }) as Record<string, any>
    expect(out.analysis).toMatchObject({
      state: 'complete_current',
      summary: 'Raise Pro price leads in most futures.',
      leading_option: 'Raise Pro price',
      win_probability_by_option: { 'Raise Pro price': 0.62, 'AI add-on': 0.38 },
    })
  })

  it.each(['complete_stale', 'never_run', 'running', 'unknown_degraded', 'refused', 'blocked'])(
    '%s analysis carries no figures and no leader',
    (kind) => {
      const out = projectState({ scenarioId: 's', read: read(kind), turnInFlight: false }) as Record<string, any>
      const analysis = JSON.stringify(out.analysis)
      expect(out.analysis.summary).toBeUndefined()
      expect(out.analysis.leading_option).toBeUndefined()
      expect(out.analysis.win_probability_by_option).toBeUndefined()
      expect(analysis.replace(/"state":"[a-z_]+"/, '')).not.toMatch(NUMBER_IN_ANALYSIS)
    },
  )

  it('stale says rerun is required', () => {
    const out = projectState({ scenarioId: 's', read: read('complete_stale'), turnInFlight: false }) as Record<string, any>
    expect(out.analysis.rerun_required).toBe(true)
    expect(out.next).toMatch(/olumi_run_analysis/)
  })

  it('a withheld leader stays withheld — never inferred from probabilities', () => {
    const r = read('complete_current', {
      analysisResult: { type: 'analysis_result', summary: 'No option clearly leads.', leading_option_id: null, win_probabilities: { o1: 0.51, o2: 0.49 } },
    })
    const out = projectState({ scenarioId: 's', read: r, turnInFlight: false }) as Record<string, any>
    expect(out.analysis.leading_option).toBeNull()
    expect(out.analysis.leader_withheld).toBe(true)
  })

  it('blocked analysis passes CEE blocker messages verbatim', () => {
    const out = projectState({ scenarioId: 's', read: read('blocked'), turnInFlight: false }) as Record<string, any>
    expect(out.analysis.reasons).toEqual(['Add a unit for Churn.'])
  })

  it('factor values: display_value, else raw+unit, never a bare model-scale value; authorship from the UI classifier', () => {
    const out = projectState({ scenarioId: 's', read: read('complete_current'), turnInFlight: false }) as Record<string, any>
    expect(out.factors).toEqual([
      { label: 'Pro price', value: '49 GBP', source: 'From brief' },
      { label: 'Churn', value: '3.7%', source: 'Olumi estimate' },
      { label: 'Bare scale' },
    ])
  })

  it('absent model while Olumi works reads as building; otherwise no_model', () => {
    const absent = { status: 'absent', requestId: null } as ScenarioGraphResult
    expect(projectState({ scenarioId: 's', read: absent, turnInFlight: true })).toMatchObject({ status: 'building' })
    expect(projectState({ scenarioId: 's', read: absent, turnInFlight: false })).toMatchObject({ status: 'no_model' })
  })

  it('stays within the output budget by dropping items, and says so', () => {
    const many = { nodes: [...GRAPH.nodes, ...Array.from({ length: 60 }, (_, i) => ({ id: `x${i}`, kind: 'factor', label: `Factor number ${i} with a long label`, observed_state: { display_value: `${i}%`, source: 'cee_inference' } }))] }
    const out = projectState({ scenarioId: 's', read: read('complete_current', { graph: many }), turnInFlight: false }) as Record<string, any>
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(OUTPUT_BUDGET_CHARS + 200)
    expect(out.truncated).toMatch(/factors/)
    expect(out.analysis.win_probability_by_option).toEqual({ 'Raise Pro price': 0.62, 'AI add-on': 0.38 })
  })
})

describe('olumi tools', () => {
  const IDENTITY_KEYS = /^(scenario_?id|user_?id|org(anisation|anization)?_?id|token|auth.*|approval.*|typed_approval_of)$/i
  let thinking = false
  const bridge: ConversationBridge = { sendMessage: vi.fn(), isThinking: () => thinking, latestAssistantText: () => null }
  const tool = (name: string) => olumiTools(bridge).find((t) => t.name === name)!

  beforeEach(() => {
    thinking = false
    vi.mocked(bridge.sendMessage).mockClear()
    runs.execute.mockReset()
    useCanvasStore.setState({ nodes: [], currentScenarioId: null } as never)
  })

  it('no tool accepts identity, scenario or approval input; descriptions within budget', () => {
    for (const t of [...probeTools(), ...olumiTools(bridge)]) {
      const props = Object.keys((t.inputSchema.properties ?? {}) as Record<string, unknown>)
      expect(props.filter((k) => IDENTITY_KEYS.test(k))).toEqual([])
      expect(t.inputSchema.additionalProperties).toBe(false)
      expect(t.description.length).toBeLessThanOrEqual(500)
    }
    expect(tool('olumi_get_state').annotations?.readOnlyHint).toBe(true)
    expect(tool('olumi_build_model').annotations?.readOnlyHint).toBeUndefined()
    expect(tool('olumi_run_analysis').annotations?.readOnlyHint).toBeUndefined()
  })

  it('build: starts the "Structure it" send and returns building — never "analysed"', async () => {
    const out = await tool('olumi_build_model').execute({ brief: 'Grow MRR to £100k without raising churn above 4%.' })
    expect(bridge.sendMessage).toHaveBeenCalledWith('Grow MRR to £100k without raising churn above 4%.', expect.objectContaining({ turnType: 'explicit_generate' }))
    expect(out).toMatchObject({ ok: true, status: 'building' })
    expect(JSON.stringify(out)).not.toMatch(/\b(was|has been|is now) analysed|analysis (is )?complete/i)
    expect((out as { message: string }).message).toMatch(/Nothing is analysed yet/)
  })

  it('build: refuses to replace an open model, and refuses while Olumi is busy', async () => {
    useCanvasStore.setState({ nodes: [{ id: 'n', position: { x: 0, y: 0 }, data: {} }] } as never)
    await expect(tool('olumi_build_model').execute({ brief: 'Grow MRR to £100k without raising churn.' })).resolves.toMatchObject({ status: 'model_exists' })
    useCanvasStore.setState({ nodes: [] } as never)
    thinking = true
    await expect(tool('olumi_build_model').execute({ brief: 'Grow MRR to £100k without raising churn.' })).resolves.toMatchObject({ status: 'busy' })
    expect(bridge.sendMessage).not.toHaveBeenCalled()
  })

  it('run: busy guard never dispatches a second run', async () => {
    thinking = true
    await expect(tool('olumi_run_analysis').execute({})).resolves.toMatchObject({ status: 'busy' })
    expect(runs.execute).not.toHaveBeenCalled()
  })

  it('run: a blocked run returns the UI gate’s reason verbatim', async () => {
    useCanvasStore.setState({ nodes: [{ id: 'n', position: { x: 0, y: 0 }, data: {} }], currentScenarioId: 's1' } as never)
    runs.execute.mockResolvedValue({ status: 'blocked', reason: 'Give Churn a unit before running.' })
    await expect(tool('olumi_run_analysis').execute({})).resolves.toMatchObject({ ok: false, status: 'blocked', message: 'Give Churn a unit before running.' })
  })
})

describe('proposal tools (registered only after CEE fast path 4 is served)', () => {
  let thinking = false
  let replies: (string | null)[] = []
  const sent: unknown[][] = []
  const bridge: ConversationBridge = {
    sendMessage: vi.fn((...a: unknown[]) => {
      sent.push(a)
      replies.push('A suggested change is ready for your review. Churn 5% Nothing in your model changes unless you approve it.')
    }),
    isThinking: () => thinking,
    latestAssistantText: () => replies.at(-1) ?? null,
  }
  const ptool = (name: string) => proposalTools(bridge).find((t) => t.name === name)!

  beforeEach(() => {
    thinking = false
    replies = ['earlier reply']
    sent.length = 0
    useCanvasStore.setState({ nodes: [{ id: 'n', position: { x: 0, y: 0 }, data: {} }], currentScenarioId: 's1' } as never)
  })

  it('stays unregistered until the fast path is live', () => {
    expect(PROPOSAL_TOOLS_LIVE).toBe(false)
  })

  it('assumption: sends the typed webmcp-tool chip, and reports awaiting approval — never applied', async () => {
    const out = await ptool('olumi_propose_assumption').execute({ factor_label: 'Churn', value: 5, unit: '%', basis: 'Industry benchmark for SMB SaaS' })
    expect(sent[0][1]).toEqual({ chipMeta: { id: 'webmcp-tool:propose_assumptions', parameters: { assumptions: [{ factor_label: 'Churn', value: 5, unit: '%', basis: 'Industry benchmark for SMB SaaS' }] } } })
    expect(out).toMatchObject({ ok: true, status: 'awaiting_human_approval', applied: false })
  })

  it('option: levels always travel as estimates with a basis', async () => {
    await ptool('olumi_propose_option').execute({ label: 'Usage-based AI tier', acts_on: [{ factor_label: 'Pro price', direction: 'positive', level: { value: 59, unit: 'GBP', basis: 'Midpoint of competitor range' } }] })
    const chip = (sent[0][1] as { chipMeta: { id: string; parameters: { acts_on: Array<{ level: Record<string, unknown> }> } } }).chipMeta
    expect(chip.id).toBe('webmcp-tool:propose_new_option')
    expect(chip.parameters.acts_on[0].level).toEqual({ value: 59, unit: 'GBP', estimate: true, basis: 'Midpoint of competitor range' })
  })

  it('a refusal from Olumi is reported as not_prepared, applied:false', async () => {
    vi.mocked(bridge.sendMessage).mockImplementationOnce((...a: unknown[]) => { sent.push(a); replies.push('That suggestion could not be prepared, so nothing was changed.') })
    await expect(ptool('olumi_propose_assumption').execute({ factor_label: 'Churn', value: 5, basis: 'benchmark' })).resolves.toMatchObject({ ok: false, status: 'not_prepared', applied: false })
  })

  it('busy guard: never sends while Olumi is working', async () => {
    thinking = true
    await expect(ptool('olumi_propose_assumption').execute({ factor_label: 'Churn', value: 5, basis: 'benchmark' })).resolves.toMatchObject({ status: 'busy' })
    expect(sent).toHaveLength(0)
  })

  it('no proposal tool claims a change was applied', async () => {
    for (const t of proposalTools(bridge)) expect(t.description).toMatch(/never applied/)
  })
})
