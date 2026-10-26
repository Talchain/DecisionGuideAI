/**
 * T1H (14 Oct): OLUMI-authored text sent through `sendMessage` must never reach
 * CEE as the user's own typed words.
 *
 * Before this fix six surfaces sent Olumi's sentence chipless, so the wire body
 * said `source: 'composer'` — byte-identical to typed text, in CEE's request hash
 * too — and CEE counted the sentence (and any figure inside it, e.g. a constraint
 * label) as something the user said.
 *
 * Every row drives the REAL surface → the REAL `useConversation().sendMessage` →
 * the REAL `buildV5Payload`, and reads the body handed to the turn transport
 * (`callV5Turn`, the one mocked seam). Each row is bound by IDENTITY: the exact
 * chip id for that surface, and the exact words, unchanged.
 *
 * CONTRAST: words the person types into the composer carry no chip at all.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'

const mockCallV5Turn = vi.fn()
vi.mock('../../../v5/v5Adapter', async (original) => ({
  ...await original<typeof import('../../../v5/v5Adapter')>(),
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
}))
// Staging mounts the deterministic-CEE blocks (e2e/core/journey/stack/ui.staging-flags.env:
// VITE_FEATURE_DETERMINISTIC_CEE=1) — the proposal block's Apply only renders under it.
vi.mock('../../../flags', async (original) => ({
  ...await original<typeof import('../../../flags')>(),
  isDeterministicCeeEnabled: () => true,
}))
vi.mock('../../../components/results/coaching/askOlumiStore', async (original) => ({
  ...await original<typeof import('../../../components/results/coaching/askOlumiStore')>(),
  openAskOlumi: vi.fn(),
}))
// Card nodes render React Flow handles, which need a mounted flow; the handle is not under test.
vi.mock('@xyflow/react', async (original) => ({ ...await original<typeof import('@xyflow/react')>(), Handle: () => null }))

import { useConversation, type UseConversationReturn } from '../useConversation'
import { ConversationPanel } from '../ConversationPanel'
import { GuidanceStrip } from '../GuidanceStrip'
import { OLUMI_TEXT_CHIP_IDS } from '../chipMeta'
import type { ConversationBlock, ConversationMessage } from '../types'
import { InspectorGuidanceSection } from '../../ui/inspector/InspectorGuidanceSection'
import { DraftNotes } from '../../components/pre-analysis/DraftNotes'
import { OptionsComparison } from '../../../components/results/analysisNew/sections/OptionsComparison'
import { buildAnalysisNewViewModel } from '../../../components/results/analysisNew/buildAnalysisNewViewModel'
import { makeData } from '../../../components/results/analysisNew/__tests__/analysisNewFixtures'
import { bringIntoComparisonQuestion } from '../../../components/results/utils/notAnalysedCopy'
import type { OptionResult } from '../../../components/results/types'
import { useCanvasStore } from '../../store'
import { setCurrentScenarioId } from '../../store/scenarios'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'
import { useResultsStore } from '../../stores/resultsStore'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { ReactFlowProvider } from '@xyflow/react'
import { Sparkles } from 'lucide-react'
import { FactorNode } from '../../nodes/FactorNode'
import { RiskNode } from '../../nodes/RiskNode'
import { ScienceIcon } from '../../nodes/shared/ScienceIcon'
import { NodeChip } from '../../nodes/shared/NodeChip'
import { composeCounterfactualQuestion } from '../../nodes/shared/counterfactualQuestion'
import { DiscussWithAiButton } from '../../components/pre-analysis/DiscussWithAiButton'
import { buildAiDiscussPrompt } from '../../components/pre-analysis/buildAiDiscussPrompt'
import { CoachingCard } from '../../components/CoachingCard'
import { ModelHealthSection } from '../../components/model-tab/ModelHealthSection'
import { createOlumiHandOff } from '../olumiHandOff'
import { WhatIWasGivenSection, composeNotModelledQuestion } from '../../../components/results/contextIntegrity/WhatIWasGivenSection'
import { useContextIntegrityStore } from '../../stores/contextIntegrityStore'
import { parseNotModelled } from '../../../adapters/cee/notModelled'
import b1Fixture from '../../../components/results/contextIntegrity/__tests__/fixtures/b1-cold-read.not-modelled.json'
import { StrengthenContainer } from '../../../components/results/strengthen/StrengthenContainer'
import { useStrengthenStore } from '../../stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../../components/results/useResultsSectionData'

const SID = '561548c3-acd6-4488-b088-399c7cc15631'
type Payload = { chip?: { id?: string; action_type?: string }; message: string; source: string; turn_id: string }

let conversation: UseConversationReturn
function Host({ children }: { children: (c: UseConversationReturn) => ReactNode }) {
  conversation = useConversation()
  return <>{children(conversation)}</>
}

/** The ONE body the press put on the wire. */
async function onlyBody(): Promise<Payload> {
  await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(conversation.isThinking).toBe(false))
  return mockCallV5Turn.mock.calls[0][0] as Payload
}
function expectChip(body: Payload, id: string, text: string) {
  expect(body.message).toBe(text)
  expect(body.source).toBe('chip')
  expect(body.chip?.id).toBe(id)
  expect(body).not.toHaveProperty('chipMeta')
}

function guidance(action: GuidanceItem['primary_action']): GuidanceItem {
  return {
    item_id: 'g-1', signal_code: 'TEST', category: 'should_fix', source: 'structural',
    title: 'Consider reviewing this edge', priority: 50, primary_action: action,
    target_object: { type: 'node', id: 'factor:price_rise' },
  }
}

function leftOut(id: string, label: string): OptionResult {
  return {
    id, label, expected: null, outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null, p50: null, p90: null, isRecommended: false, notAnalysed: true, notAnalysedReason: 'not_returned',
  }
}
function analysed(id: string, winProbability: number): OptionResult {
  return {
    id, label: `Label ${id}`, expected: 100, outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60, p50: 100, p90: 140, isRecommended: false, winProbability, nValidSamples: 10000, computeStatus: 'computed',
  }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  __resetTranscriptTombstonesForTests()
  __resetPersistenceSessionForTests()
  vi.stubEnv('VITE_FEATURE_THREAD_PERSIST', 'false')
  vi.stubEnv('VITE_FEATURE_THREAD_HYDRATE', 'false')
  Element.prototype.scrollIntoView = vi.fn()
  useCanvasStore.getState().resetCanvas()
  setCurrentScenarioId(SID)
  useCanvasStore.setState({ currentScenarioId: SID, scenarioPersistedToDb: false, _hydratedThread: null,
    nodes: [{ id: 'factor:price_rise', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price rise' } }], edges: [] })
  useResultsStore.setState(state => ({ results: { ...state.results, status: 'idle', lastSnapshotId: null, analysisSummary: undefined } }))
  useServerConversationTurnsStore.setState({ offer: null })
  useGuidanceStore.getState().clearGuidanceItems()
  mockCallV5Turn.mockReset()
  mockCallV5Turn.mockResolvedValue({ kind: 'boundary_error', error: {
    error: 'INTERNAL_ERROR', boundary: 'B1', direction: 'egress', validator: 'draft_graph_pipeline',
    request_id: 't1h-olumi-text', retryable: true,
    details: { retryable: true, pipeline_error_code: 'CEE_LLM_VALIDATION_FAILED', stage: 'frame' },
  } })
})
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('T1H — Olumi\'s text goes out as a chip carrying its surface\'s identity', () => {
  it('GuidanceStrip "discuss" → chip guidance_discuss, prompt unchanged', async () => {
    useGuidanceStore.getState().setGuidanceItems([guidance({ type: 'discuss', prompt: 'Is a 20% churn cut realistic?' })])
    render(<Host>{c => <GuidanceStrip onSendMessage={c.sendMessage} onSetActive={() => {}} onScrollToPatch={() => {}} onOpenInspector={() => {}} />}</Host>)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /discuss/i })) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.guidanceDiscuss, 'Is a 20% churn cut realistic?')
  })

  it('GuidanceStrip "/exercise" → chip guidance_exercise, text unchanged', async () => {
    useGuidanceStore.getState().setGuidanceItems([guidance({ type: 'run_exercise', exercise: 'pre_mortem' })])
    render(<Host>{c => <GuidanceStrip onSendMessage={c.sendMessage} onSetActive={() => {}} onScrollToPatch={() => {}} onOpenInspector={() => {}} />}</Host>)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /try it/i })) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.guidanceExercise, '/exercise pre_mortem')
  })

  it('InspectorGuidanceSection (the same guidance actions, right panel) → the same chip ids', async () => {
    const item = guidance({ type: 'discuss', prompt: 'What would make this link weaker?' })
    useGuidanceStore.getState().setGuidanceItems([item])
    render(<Host>{c => <InspectorGuidanceSection elementId="factor:price_rise" onSendMessage={c.sendMessage} />}</Host>)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Consider reviewing this edge/ })) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.guidanceDiscuss, 'What would make this link weaker?')
  })

  it('ConversationPanel proposal Apply → chip proposal_confirm, `confirm:<id>` unchanged', async () => {
    const proposal = { type: 'proposal', action_type: 'add_factor', description: 'Add Regulatory Risk',
      proposal_id: 'abc-123', changes: [{ operation: 'add', target: 'Regulatory Risk', detail: 'New factor' }],
      confirmation_required: true } as unknown as ConversationBlock
    const reply: ConversationMessage = { id: 'a1', role: 'assistant', content: 'Here is a proposal.', timestamp: new Date(), blocks: [proposal] }
    render(<Host>{c => <ConversationPanel conversation={{ ...c, messages: [reply] }} onCollapse={() => {}} onAttach={() => {}} hideComposer />}</Host>)
    await act(async () => { fireEvent.click(screen.getByTestId('proposal-apply')) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.proposalConfirm, 'confirm:abc-123')
  })

  it('ArtefactActions (via ConversationPanel) → chip ai_panel_artefact_action (already a chip; pinned)', async () => {
    const artefact = { type: 'artefact', artefact_type: 'table', title: 'Costs', content: '<p>x</p>',
      actions: [{ label: 'Compare costs', message: 'Compare the £40k and £55k options.' }] } as unknown as ConversationBlock
    // jsdom has no IntersectionObserver; report the artefact as on screen at once.
    vi.stubGlobal('IntersectionObserver', class {
      constructor(private cb: (e: Array<{ isIntersecting: boolean }>) => void) {}
      observe() { this.cb([{ isIntersecting: true }]) }
      unobserve() {}
      disconnect() {}
    })
    const reply: ConversationMessage = { id: 'a2', role: 'assistant', content: 'An artefact.', timestamp: new Date(), blocks: [artefact] }
    render(<Host>{c => <ConversationPanel conversation={{ ...c, messages: [reply] }} onCollapse={() => {}} onAttach={() => {}} hideComposer />}</Host>)
    await act(async () => { fireEvent.click(screen.getAllByTestId('artefact-action-chip')[0]) })
    expectChip(await onlyBody(), 'ai_panel_artefact_action', 'Compare the £40k and £55k options.')
  })

  it('OptionsComparison "bring into comparison" → chip options_comparison_bring_in, question unchanged', async () => {
    const options = [analysed('opt-a', 0.6), analysed('opt-b', 0.4), leftOut('opt-left', 'Buy an AI Triage Tool')]
    const vm = buildAnalysisNewViewModel({
      data: makeData({ recommendation: { allOptions: options, isSingleOption: false } }),
      recommendations: [], isPreRun: false, isRunning: false, isStale: false, analysisIdentityIsCurrent: true,
    })
    render(<Host>{c => <OptionsComparison options={vm.optionsComparison} onSendMessage={c.sendMessage} />}</Host>)
    fireEvent.click(screen.getByTestId('analysis-new-options-toggle'))
    await act(async () => { fireEvent.click(screen.getByTestId('analysis-new-options-bring-in-opt-left')) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.optionsComparisonBringIn,
      bringIntoComparisonQuestion('Buy an AI Triage Tool', 'not_returned'))
  })

  it('DraftNotes "Add factor" (constraint label with figures) → chip draft_notes_constraint_factor, sentence unchanged', async () => {
    render(<Host>{c => <DraftNotes modelAdjustments={[]} repairActions={[]}
      goalConstraints={[{ id: 'c1', label: 'Budget under £250k', probability: null }]} onSendMessage={c.sendMessage} />}</Host>)
    fireEvent.click(screen.getByTestId('draft-notes').querySelector('button')!)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add factor' })) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.draftNotesConstraintFactor,
      'I\'d like to add a factor for this constraint: Budget under £250k')
  })

  it('CONTRAST: words typed into the composer carry NO chip', async () => {
    render(<Host>{c => <ConversationPanel conversation={c} onCollapse={() => {}} onAttach={() => {}} />}</Host>)
    const typed = 'We could cut churn by a fifth next quarter'
    fireEvent.change(screen.getByLabelText('Message input'), { target: { value: typed } })
    await act(async () => { fireEvent.click(screen.getByTestId('send-button')) })
    const body = await onlyBody()
    expect(body.message).toBe(typed)
    expect(body.source).toBe('composer')
    expect(body).not.toHaveProperty('chip')
  })

  it('RETRY: a failed Olumi-text chip retries as the SAME chip, never as chip-less free text', async () => {
    // Re-pointed (U2) from OptionPreview, removed with the legacy pre-analysis panel, onto GuidanceStrip "discuss".
    useGuidanceStore.getState().setGuidanceItems([guidance({ type: 'discuss', prompt: 'Is a 20% churn cut realistic?' })])
    render(<Host>{c => <GuidanceStrip onSendMessage={c.sendMessage} onSetActive={() => {}} onScrollToPatch={() => {}} onOpenInspector={() => {}} />}</Host>)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /discuss/i })) })
    const first = await onlyBody()
    await act(async () => { await conversation.retryLast() })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(2))
    const retried = mockCallV5Turn.mock.calls[1][0] as Payload
    expect(retried.turn_id).toBe(first.turn_id)
    expectChip(retried, OLUMI_TEXT_CHIP_IDS.guidanceDiscuss, first.message)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// T1H-2 (14 Oct): the census's remaining Olumi-text sends. Store-bridged
// surfaces reach `sendMessage` / `dispatchAction` through the callbacks the REAL
// ConversationPanel registers (`registerConversationCallbacks`), so `Registered`
// mounts one beside the surface under test.
// ─────────────────────────────────────────────────────────────────────────────
function Registered({ children }: { children: ReactNode }) {
  return <Host>{c => <><ConversationPanel conversation={c} onCollapse={() => {}} onAttach={() => {}} hideComposer />{children}</>}</Host>
}
const nodeProps = { position: { x: 0, y: 0 }, selected: false, isConnectable: true, positionAbsoluteX: 0,
  positionAbsoluteY: 0, dragging: false, zIndex: 0 } as const
const SUBJECT = 'Regional Supplier Reliability'
const worsens = () => {
  const matches = screen.getAllByRole('button').filter(b => /worsens\?/.test(b.textContent ?? ''))
  expect(matches).toHaveLength(1)
  return matches[0]
}

describe('T1H-2 — the remaining Olumi-text sends carry their surface\'s chip identity', () => {
  it('FactorNode counterfactual question → chip factor_counterfactual_question, question unchanged', async () => {
    useCanvasStore.setState(s => ({ viewMode: 'expert', results: { ...s.results, status: 'complete' },
      nodes: [{ id: 'fac-ext', type: 'factor', position: { x: 0, y: 0 }, data: { label: SUBJECT, category: 'external' } }] }) as never)
    render(<Registered><ReactFlowProvider><FactorNode {...({ ...nodeProps, id: 'fac-ext', type: 'factor',
      data: { label: SUBJECT, category: 'external' } } as unknown as ComponentProps<typeof FactorNode>)} /></ReactFlowProvider></Registered>)
    await act(async () => { fireEvent.click(worsens()) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.factorCounterfactualQuestion, composeCounterfactualQuestion(SUBJECT)!)
  })

  it('RiskNode counterfactual question → chip risk_counterfactual_question, question unchanged', async () => {
    useCanvasStore.setState(s => ({ viewMode: 'expert', results: { ...s.results, status: 'complete' },
      nodes: [{ id: 'fac-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: SUBJECT } },
        { id: 'risk-1', type: 'risk', position: { x: 0, y: 0 }, data: { label: 'Delivery slippage', type: 'risk' } }],
      edges: [{ id: 'e-1', source: 'fac-1', target: 'risk-1', data: {} }] }) as never)
    render(<Registered><ReactFlowProvider><RiskNode {...({ ...nodeProps, id: 'risk-1', type: 'risk',
      data: { label: 'Delivery slippage', type: 'risk' } } as unknown as ComponentProps<typeof RiskNode>)} /></ReactFlowProvider></Registered>)
    await act(async () => { fireEvent.click(worsens()) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.riskCounterfactualQuestion, composeCounterfactualQuestion(SUBJECT)!)
  })

  it('ScienceIcon "Discuss with AI" → chip science_icon_discuss, action unchanged', async () => {
    render(<Registered><ScienceIcon icon={Sparkles as never} tooltip="Anchoring check" action="Is the first figure anchoring this estimate?" /></Registered>)
    fireEvent.click(screen.getByTestId('science-icon-trigger'))
    await act(async () => { fireEvent.click(screen.getByTestId('science-icon-discuss')) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.scienceIconDiscuss, 'Is the first figure anchoring this estimate?')
  })

  it('DiscussWithAiButton onSend override → chip discuss_with_ai, prompt unchanged (the seam: no production caller sends today)', async () => {
    const element = { kind: 'factor', label: 'Team size' } as const
    render(<Host>{c => <DiscussWithAiButton element={element} onSend={c.sendMessage} />}</Host>)
    await act(async () => { fireEvent.click(screen.getByTestId('discuss-with-ai')) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.discussWithAi, buildAiDiscussPrompt(element))
  })

  it('WhatIWasGivenSection "add" on a not-modelled figure → chip what_i_was_given_not_modelled, question unchanged', async () => {
    const cold = Object.fromEntries(Object.entries(b1Fixture).filter(([k]) => k !== '_provenance')) as { brief_text: string; not_modelled: unknown }
    useContextIntegrityStore.getState().setContextIntegrity({ scenarioId: SID, briefText: cold.brief_text, manifest: parseNotModelled(cold.not_modelled) })
    render(<Host>{c => <WhatIWasGivenSection onSendMessage={c.sendMessage} />}</Host>)
    fireEvent.click(screen.getByTestId('what-i-was-given-toggle'))
    const offset = cold.brief_text.indexOf('£11.2m')
    const row = screen.getByTestId('what-i-was-given-notyet').querySelector(`[data-char-offset="${offset}"]`)!
    await act(async () => { fireEvent.click(row.querySelector('[data-testid="what-i-was-given-notyet-add"]')!) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.whatIWasGivenNotModelled,
      composeNotModelledQuestion({ literal: '£11.2m', charOffset: offset } as never, cold.brief_text))
  })

  it('CoachingCard chip WITHOUT an action_type (was `composer`) → chip canvas_coaching_chip, message unchanged', async () => {
    render(<Registered><CoachingCard severity="info" message="m" chips={[{ label: 'Check it', message: 'Is a 20% uplift realistic?' }]} /></Registered>)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check it' })) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.canvasCoachingChip, 'Is a 20% uplift realistic?')
  })

  it('CoachingCard link (was `composer`) → chip canvas_coaching_link, message unchanged', async () => {
    render(<Registered><CoachingCard severity="info" message="m" linkLabel="Ask about it" linkMessage="What drives this estimate?" /></Registered>)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ask about it' })) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.canvasCoachingLink, 'What drives this estimate?')
  })

  it('CoachingCard link via the legacy `_sendMessage` bridge → the SAME chip canvas_coaching_link', async () => {
    render(<Registered><CoachingCard severity="info" message="m" linkLabel="Ask about it" linkMessage="What drives this estimate?" /></Registered>)
    useGuidanceStore.setState({ _dispatchAction: null } as never)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ask about it' })) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.canvasCoachingLink, 'What drives this estimate?')
  })

  it('NodeChip via the legacy `_sendMessage` bridge → the SAME chip identity the dispatch arm sends', async () => {
    render(<Registered><NodeChip label="Why this?" message="What evidence supports Price rise?" chipId="node_chip_evidence" actionType={null} /></Registered>)
    useGuidanceStore.setState({ _dispatchAction: null } as never)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Why this\?/ })) })
    const body = await onlyBody() as Payload & { chip?: { parameters?: Record<string, unknown> } }
    expectChip(body, 'node_chip_evidence', 'What evidence supports Price rise?')
    expect(body.chip?.parameters).toEqual({ chip_id: 'node_chip_evidence' })
  })

  it('Model card "Discuss" (the Model-tab hand-off) → chip model_tab_hand_off:modelcard-discuss, turn unchanged', async () => {
    render(<Host>{c => <ModelHealthSection ceeQuality={{ overall: 7.2 } as never} onHandOffToOlumi={createOlumiHandOff(c.sendMessage)!} />}</Host>)
    await act(async () => { fireEvent.click(screen.getByTestId('modelcard-discuss')) })
    expectChip(await onlyBody(), `${OLUMI_TEXT_CHIP_IDS.modelTabHandOff}:modelcard-discuss`,
      'Help me understand the reliability and limitations of my model')
  })

  it('Strengthen "Generate a different option" → chip strengthen:<record id> (the id its `_sendChip` arm already sends), prompt unchanged', async () => {
    useStrengthenStore.getState()._reset()
    useCanvasStore.setState({ draftCoaching: { summary: null, strengthenItems: [], wideningLog: [],
      biasSignals: [{ type: 'narrow_framing', detail: 'Three of four options hire.' }] } } as never)
    const data = { recommendation: { goalThreshold: 62, analysisStatus: 'computed' },
      confidence: { challengeFragileEdges: [], robustnessStatus: null, robustnessLevel: null },
      drivers: { drivers: [] } } as unknown as ResultsSectionDataReturn
    render(<Registered><StrengthenContainer data={data} /></Registered>)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Generate a different option' })) })
    expectChip(await onlyBody(), 'strengthen:strengthen:broaden',
      'Suggest one materially different option that works through a different mechanism.')
  })

  it('MessageBubble insight action (already a chip) → chip insight_action, message unchanged — pinned', async () => {
    const reply = { id: 'a3', role: 'assistant', content: 'Noted.', timestamp: new Date(),
      insights: [{ type: 'missing_perspective', severity: 'warning', description: 'Only one option hires.' }] } as unknown as ConversationMessage
    render(<Host>{c => <ConversationPanel conversation={{ ...c, messages: [reply] }} onCollapse={() => {}} onAttach={() => {}} hideComposer />}</Host>)
    await act(async () => { fireEvent.click(screen.getByTestId('insight-action-0')) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.insightAction, 'Suggest additional options for this decision')
  })
})

