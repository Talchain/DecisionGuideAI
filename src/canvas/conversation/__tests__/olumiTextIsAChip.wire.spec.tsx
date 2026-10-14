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
import type { ReactNode } from 'react'

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
vi.mock('../../../components/results/coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { useConversation, type UseConversationReturn } from '../useConversation'
import { ConversationPanel } from '../ConversationPanel'
import { GuidanceStrip } from '../GuidanceStrip'
import { OLUMI_TEXT_CHIP_IDS } from '../chipMeta'
import type { ConversationBlock, ConversationMessage } from '../types'
import { InspectorGuidanceSection } from '../../ui/inspector/InspectorGuidanceSection'
import { OptionPreview } from '../../components/pre-analysis/OptionPreview'
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

  it('OptionPreview "Explore other strategies" → chip option_preview_explore_strategies, sentence unchanged', async () => {
    const opt = { id: 'opt1', label: 'Option A', status: 'ready', isBaseline: false,
      interventions: [{ factorId: 'fac1', factorLabel: 'Price', interventionValue: 0.5, currentValue: 0.3, direction: 'up', cap: 1, unit: '', currentRawValue: null }] }
    render(<Host>{c => <OptionPreview options={[opt] as never} onSendMessage={c.sendMessage} />}</Host>)
    await act(async () => { fireEvent.click(screen.getByTestId('option-preview-explore-strategies')) })
    expectChip(await onlyBody(), OLUMI_TEXT_CHIP_IDS.optionPreviewExploreStrategies,
      'What other strategies should I consider for this decision?')
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
    const opt = { id: 'opt1', label: 'Option A', status: 'ready', isBaseline: false,
      interventions: [{ factorId: 'fac1', factorLabel: 'Price', interventionValue: 0.5, currentValue: 0.3, direction: 'up', cap: 1, unit: '', currentRawValue: null }] }
    render(<Host>{c => <OptionPreview options={[opt] as never} onSendMessage={c.sendMessage} />}</Host>)
    await act(async () => { fireEvent.click(screen.getByTestId('option-preview-explore-strategies')) })
    const first = await onlyBody()
    await act(async () => { await conversation.retryLast() })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(2))
    const retried = mockCallV5Turn.mock.calls[1][0] as Payload
    expect(retried.turn_id).toBe(first.turn_id)
    expectChip(retried, OLUMI_TEXT_CHIP_IDS.optionPreviewExploreStrategies, first.message)
  })
})
