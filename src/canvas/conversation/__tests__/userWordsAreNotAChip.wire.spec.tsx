/**
 * T1H-3 (14 Oct) — the OPPOSITE misattribution to T1H: the person's OWN typed words must reach CEE as theirs.
 *
 * Before this fix two doors sent the user's words as a chip (the first, SuccessTarget "Add constraint", went with the
 * legacy pre-analysis panel in U2; its rows went with it):
 *   · Results "Respond" (`askAi` userWords + typed parameters) — `{ source: 'chip', chip: { parameters } }` with the
 *     card heading `On ‘<title>’:` prepended.
 * CEE treats chip text as product copy: the agent lane's `typedByUser` is false for any chip
 * (`stated-by-user.ts:1117-1123`), so the words never enter `verified_user_messages` (`agent-v1-turn.ts:3102,3178,3200`)
 * and a figure in them cannot be credited to the user; the V5 executor runs its typed-constraint door only off chip
 * sources (`turn-executor.ts:7020-7021`). The `add_constraint` chip did not even fire its typed route: its
 * `{ description }` fails `AddConstraintParamsSchema` (`typed-chip-mutation-proposal.ts:148-154,288-289` →
 * `parameters_invalid`), and the fall-through then suppresses the text parsers (`turn-executor.ts:7049-7057`).
 * (CEE staging 38b33bb.)
 *
 * Every row drives the REAL surface → the REAL store seam the REAL ConversationPanel registers → the REAL
 * `useConversation().sendMessage` → the REAL `buildV5Payload`, and reads the body handed to `callV5Turn` (the one
 * mocked seam). Bound by identity: the exact typed words, the absence of any chip, the exact target ref.
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

import { useConversation, type UseConversationReturn } from '../useConversation'
import { ConversationPanel } from '../ConversationPanel'
import { askAi } from '../askAi'
import { ScienceIcon } from '../../nodes/shared/ScienceIcon'
import { OLUMI_TEXT_CHIP_IDS } from '../chipMeta'
import { ChallengeCard } from '../../../components/results/analysisNew/sections/ChallengeCard'
import { buildAnalysisNewViewModel } from '../../../components/results/analysisNew/buildAnalysisNewViewModel'
import { genuineDecision } from '../../../components/results/analysisNew/__tests__/analysisNewFixtures'
import type { Recommendation } from '../../../components/results/strengthen/strengthenTypes'
import { useCanvasStore } from '../../store'
import { setCurrentScenarioId } from '../../store/scenarios'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useResultsStore } from '../../stores/resultsStore'
import { useStrengthenStore } from '../../stores/strengthenStore'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { Sparkles } from 'lucide-react'
import { METHOD_CATALOGUE, type MethodEntry } from '../../../components/results/decision-overview/actionsCatalogue'
import { respondToMethod } from '../../../components/results/analysisNew/challengeResponse'
import { AskOlumiDrawer } from '../../../components/results/coaching/AskOlumiDrawer'
import { openAskOlumi, useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'

const SID = '7a2c1e9b-5d4f-4c3a-9b8e-1f2d3c4b5a69'
type Body = { kind?: string; chip?: { id?: string; action_type?: string; parameters?: unknown } | null; message: string
  source?: string; selected_elements?: Array<{ id: string; kind: string; label?: string }> }

let conversation: UseConversationReturn
function Host({ children }: { children: (c: UseConversationReturn) => ReactNode }) {
  conversation = useConversation()
  return <>{children(conversation)}</>
}
/** Mounts the REAL ConversationPanel, which registers `_sendMessage` / `_dispatchAction` on the guidance store. */
function Registered({ children }: { children: ReactNode }) {
  return <Host>{c => <><ConversationPanel conversation={c} onCollapse={() => {}} onAttach={() => {}} hideComposer />{children}</>}</Host>
}
async function onlyBody(): Promise<Body> {
  await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(conversation.isThinking).toBe(false))
  return mockCallV5Turn.mock.calls[0][0] as Body
}

/**
 * CEE's OWN entry conditions, restated from its source (staging 38b33bb) — the conditions under which CEE keeps a
 * turn's words as the user's. Restated, not imported (cross-repo); each line cites the predicate it copies.
 */
const cee = {
  /** Agent lane `typedByUser` (`stated-by-user.ts:1117-1123`): only a chipless composer message is typed by the user. */
  typedByUser: (b: Body) => (b.kind === undefined || b.kind === 'message') && (b.chip === null || b.chip === undefined)
    && (b.source === undefined || b.source === 'composer'),
  /** V5 typed-constraint door entry (`turn-executor.ts:7020`): it runs only off chip sources. */
  constraintDoorRuns: (b: Body) => b.source !== 'chip_click' && b.source !== 'chip',
  /**
   * The door's `direct` test (`explicit-constraint-edit.ts:47`): the statement must BE the whole message — a frame
   * makes it partial. Probe run of CEE's own `resolveExplicitConstraintEdit` on 38b33bb with the door's test graph:
   * 'Keep Budget under $40,000.' → `ready`, every parameter `user_explicit`; the same words after
   * "I'd like to add a constraint: " → `unmatched`.
   */
  messageIsTheStatement: (b: Body, words: string) => b.message === words,
}

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation => ({
  helpType: 'challenge', title: 'Test whether £54 beats £59 on Price', signal: 'A small change here flips the order.',
  whyNow: 'A small change here flips the order.', tryThis: null, sourceLine: 'From the run’s fragile relationships.',
  action: { kind: 'ai-dialogue', label: 'Work through with Olumi', prompt: 'Test it', parameters: { block_id: 'blk_resp', method_id: 'pre_mortem' } },
  targetId: null, priority: 1, ...over,
}) as Recommendation
const viaVm = (r: Recommendation): Recommendation => {
  const vm = buildAnalysisNewViewModel({ data: genuineDecision(), recommendations: [r], isPreRun: false, isRunning: false, isStale: false })
  const out = vm.strengthen.interventions.find(i => i.id === r.id)
  if (!out) throw new Error('PRECONDITION: the view model dropped the recommendation')
  return out
}
async function respond(note: string) {
  fireEvent.click(screen.getByTestId('analysis-new-challenge-respond'))
  fireEvent.change(screen.getByTestId('analysis-new-challenge-respond-note'), { target: { value: note } })
  await act(async () => { fireEvent.click(screen.getByTestId('analysis-new-challenge-respond-send')) })
}
const GOAL = { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Revenue' } }

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
  useCanvasStore.setState({ currentScenarioId: SID, scenarioPersistedToDb: false, _hydratedThread: null, nodes: [GOAL,
    { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Raise price' } }], edges: [] })
  useResultsStore.setState(state => ({ results: { ...state.results, status: 'idle', lastSnapshotId: null, analysisSummary: undefined } }))
  useServerConversationTurnsStore.setState({ offer: null })
  useGuidanceStore.getState().clearGuidanceItems()
  useStrengthenStore.getState()._reset()
  useAskOlumiStore.setState({ isOpen: false, draft: '', promptCleared: false })
  mockCallV5Turn.mockReset()
  mockCallV5Turn.mockResolvedValue({ kind: 'boundary_error', error: {
    error: 'INTERNAL_ERROR', boundary: 'B1', direction: 'egress', validator: 'draft_graph_pipeline',
    request_id: 't1h3-user-words', retryable: true,
    details: { retryable: true, pipeline_error_code: 'CEE_LLM_VALIDATION_FAILED', stage: 'frame' },
  } })
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe('T1H-3 — the person\'s own typed words go out as theirs: chipless composer, exactly as typed', () => {
  it('Respond on an intervention (was a parameters chip + Olumi heading) → composer, the reader\'s words alone, target typed', async () => {
    const r = viaVm(rec({ id: 'strengthen:flip:opt_a', targetId: 'opt_a' }))
    render(<Registered><ChallengeCard intervention={r} methodId={null} onRunIntervention={vi.fn()} onRunMethod={vi.fn()} analysisHash="hash_1" /></Registered>)
    const words = 'I think £50 is closer — demand drops fast above that'
    await respond(words)
    const body = await onlyBody()
    expect(body.message).toBe(words)
    expect(body.source).toBe('composer')
    expect(body).not.toHaveProperty('chip')
    // The card's title (Olumi's copy, with ITS figures) is not credited to the reader.
    expect(body.message).not.toContain('£54')
    expect(body.selected_elements).toEqual([{ id: 'opt_a', kind: 'option', label: 'Raise price' }])
    expect(cee.typedByUser(body)).toBe(true)
  })

  /**
   * DL ruling (14 Oct, honouring c5806258826 §3): the `On ‘<title>’:` heading stays for a METHOD reply only — the title
   * is the catalogue's (resolved by the reply's method id; fixed copy, no figures). Every other title is dropped.
   */
  it('Respond on a picked METHOD → composer, `On ‘<catalogue title>’:` + the reader\'s words, no chip', async () => {
    const title = METHOD_CATALOGUE.find(m => m.id === 'pre_mortem')?.title
    expect(title, 'PRECONDITION: pre_mortem is a catalogue method').toBe('Run a pre-mortem')
    render(<Registered><ChallengeCard intervention={viaVm(rec({ id: 'strengthen:broaden' }))} methodId="pre_mortem"
      onRunIntervention={vi.fn()} onRunMethod={vi.fn()} analysisHash="hash_1" /></Registered>)
    await respond('Worth checking the downside case')
    const body = await onlyBody()
    expect(body.message).toBe('On ‘Run a pre-mortem’:\nWorth checking the downside case')
    expect(body.source).toBe('composer')
    expect(body).not.toHaveProperty('chip')
    expect(cee.typedByUser(body)).toBe(true)
  })

  it('Respond on a FACTOR-titled (non-method) finding → the reader\'s words only: the title and its figure are not sent', async () => {
    const r = viaVm(rec({ id: 'strengthen:flip:budget', title: 'Budget under $40,000' }))
    expect(r.title, 'PRECONDITION: the card carries the figure-bearing title').toBe('Budget under $40,000')
    render(<Registered><ChallengeCard intervention={r} methodId={null} onRunIntervention={vi.fn()} onRunMethod={vi.fn()} analysisHash="hash_1" /></Registered>)
    await respond('I think the budget can stretch')
    const body = await onlyBody()
    expect(body.message).toBe('I think the budget can stretch')
    expect(body.source).toBe('composer')
    expect(body).not.toHaveProperty('chip')
  })

  it('CONTRAST: a non-catalogue title that merely LOOKS like a method name gets no heading (identity, not text)', async () => {
    const r = viaVm(rec({ id: 'strengthen:lookalike', title: 'Run a pre-mortem' }))
    render(<Registered><ChallengeCard intervention={r} methodId={null} onRunIntervention={vi.fn()} onRunMethod={vi.fn()} analysisHash="hash_1" /></Registered>)
    await respond('Lookalike words')
    const body = await onlyBody()
    expect(body.message).toBe('Lookalike words')
    // …and a method entry whose id is NOT in the catalogue, titled like one, is sent bare too.
    mockCallV5Turn.mockClear()
    const forged: MethodEntry = { id: 'not_in_catalogue', title: 'Run a pre-mortem', description: '', prompt: '' }
    await act(async () => { expect(respondToMethod(forged, 'Forged words')).toBe('sent') })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
    expect((mockCallV5Turn.mock.calls[0][0] as Body).message).toBe('Forged words')
  })
})

/**
 * DL ruling (14 Oct) — AskOlumiDrawer "discuss": the field opens with OLUMI's prefilled text and the person may edit
 * it. FAIL-SAFE: unedited → chip; edited without clearing → STILL a chip; only cleared + typed → composer, no chip.
 */
describe('AskOlumiDrawer — mixed authorship, fail-safe (ruled)', () => {
  const PREFILL = 'Help me work through: is a 20% uplift realistic for Revenue?'
  const open = () => {
    render(<Registered><AskOlumiDrawer /></Registered>)
    act(() => openAskOlumi({ context: 'Revenue uplift', draft: PREFILL, label: 'Discuss' }))
  }
  const send = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) }) }

  it('sent UNEDITED → a chip with its id (Olumi\'s text)', async () => {
    open()
    await send()
    const body = await onlyBody()
    expect(body.message).toBe(PREFILL)
    expect(body.source).toBe('chip')
    expect(body.chip?.id).toBe(OLUMI_TEXT_CHIP_IDS.askOlumiDiscuss)
    expect(cee.typedByUser(body)).toBe(false)
  })

  it('EDITED (prefill never cleared) → STILL a chip: a wrong author is worse than lost credit', async () => {
    open()
    const edited = 'Help me work through: is a 12% uplift realistic for Revenue?'
    fireEvent.change(screen.getByTestId('ask-olumi-draft'), { target: { value: edited } })
    await send()
    const body = await onlyBody()
    expect(body.message).toBe(edited)
    expect(body.source).toBe('chip')
    expect(body.chip?.id).toBe(OLUMI_TEXT_CHIP_IDS.askOlumiDiscuss)
    expect(cee.typedByUser(body)).toBe(false)
  })

  it('CLEARED then typed → composer, the exact typed words, no chip', async () => {
    open()
    fireEvent.change(screen.getByTestId('ask-olumi-draft'), { target: { value: '' } })
    fireEvent.change(screen.getByTestId('ask-olumi-draft'), { target: { value: 'Our uplift last year was 9%.' } })
    await send()
    const body = await onlyBody()
    expect(body.message).toBe('Our uplift last year was 9%.')
    expect(body.source).toBe('composer')
    expect(body).not.toHaveProperty('chip')
    expect(cee.typedByUser(body)).toBe(true)
  })
})

describe('CONTRAST — Olumi\'s own text still travels as a chip', () => {
  it('ScienceIcon "Discuss with AI" (#2793) → chip science_icon_discuss', async () => {
    render(<Registered><ScienceIcon icon={Sparkles as never} tooltip="Anchoring check" action="Is the first figure anchoring this estimate?" /></Registered>)
    fireEvent.click(screen.getByTestId('science-icon-trigger'))
    await act(async () => { fireEvent.click(screen.getByTestId('science-icon-discuss')) })
    const body = await onlyBody()
    expect(body.source).toBe('chip')
    expect(body.chip?.id).toBe(OLUMI_TEXT_CHIP_IDS.scienceIconDiscuss)
    expect(cee.typedByUser(body)).toBe(false)
  })

  it('askAi with an intent (Olumi\'s question, the branch beside the user-words one) → chip ask:explain', async () => {
    render(<Registered><div /></Registered>)
    await act(async () => { expect(askAi({ intent: 'explain', nodeIds: ['opt_a'] })).toBe('sent') })
    const body = await onlyBody()
    expect(body.source).toBe('chip')
    expect(body.chip?.id).toBe('ask:explain')
    expect(body.message).toContain('Raise price')
  })
})
