/** T3a: exercise retired reply presentation through the real React render paths. */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({
  supabase: {},
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))

import { parseV5Response } from '../../../v5/responseParser'
import { routeV5Response } from '../../../v5/responseRouter'
import { mapV5Blocks } from '../../../v5/blocks/mapV5Blocks'
import { extractPhase3FromV5Response, deriveV5AnalysisFactUpdate } from '../../../v5/extractPhase3FromV5Response'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { composePhase3BridgedBlocks } from '../useConversation'
import { extractAnswerShapeSidecar } from '../answerShape'
import { extractOpenQuestionListSidecar } from '../serverOpenQuestions'
import { extractProvisionalViewSidecar } from '../provisionalView'
import { saveTranscript, loadTranscript, __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import { AnalysisReadinessBar } from '../../components/workspaceShell/AnalysisReadinessBar'
import { PanelFooter } from '../../components/pre-analysis-v3/footer/PanelFooter'
import { useCanvasStore } from '../../store'
import { ChatThread } from '../zones/ChatThread'
import type { ConversationMessage } from '../types'

import served from './fixtures/chat-served-turns.bf-20260927.json'

type Wire = Record<string, unknown>

const VIEW = 'I would hold the Pro price at £49 for now and test £59 on new customers only.'
const REASONING = 'Churn is already near your 10% limit, and a rise for existing customers is the move most likely to push it over.'
const STEP = 'Give me your real monthly churn figure, so the analysis can check the limit against it.'
const HEADING = 'Provisional view — the analysis can’t confirm this yet because your churn limit is checked against Olumi’s estimate, not your figure.'
/** A prose copy, as Runtime's first plan appended it (5855331903): one bold-led paragraph after the gate. */
const PROSE = `**${HEADING}** ${VIEW} ${STEP}`

const servedRun = (): Wire => {
  const t = (served as Array<{ source: string; body: Wire }>)[3]!
  expect(t.source).toContain('bf-20260927T101447Z turns.jsonl[8]')
  return JSON.parse(JSON.stringify(t.body)) as Wire
}

/** The served Run with the C5 sidecar; optionally a prose copy appended where the shaper puts it (detail). */
function withProvisional(body: Wire, opts: { shaped: boolean; sidecar?: boolean; prose?: boolean; heading?: boolean }): Wire {
  const b = JSON.parse(JSON.stringify(body)) as Wire
  const shape = b._answer_shape as { detail?: string } | undefined
  if (opts.prose) {
    b.assistant_text = `${String(b.assistant_text)}\n\n${PROSE}`
    if (shape) shape.detail = `${shape.detail ?? ''}\n\n${PROSE}`.trim()
  }
  if (opts.shaped) expect(shape, 'the served Run carries an answer shape').toBeTruthy()
  else delete b._answer_shape
  if (opts.sidecar !== false) {
    b._agent = {
      ...(b._agent as Wire | undefined),
      provisional_view: { view: VIEW, reasoning: REASONING, confirm_step: STEP, ...(opts.heading === false ? {} : { heading: HEADING }) },
    }
  }
  return b
}

/** The shipped chain, then the message exactly as `useConversation` builds it. */
async function messageFrom(body: Wire): Promise<ConversationMessage> {
  const res = new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const target = routeV5Response(await parseV5Response(res))
  if (target.kind !== 'blocks' && target.kind !== 'text_only') throw new Error(target.kind)
  const response = target.response
  const mapped = target.kind === 'blocks' ? mapV5Blocks(response.blocks, response.suggested_actions) : []
  const phase3 = extractPhase3FromV5Response(response)
  const fact = deriveV5AnalysisFactUpdate(response, phase3)
  const blocks = composePhase3BridgedBlocks(fact.action === 'set', phase3.rawBlocks, mapped)
  const actionChips = buildSuggestedActionChips(response.blocks, response.suggested_actions)
  const answerShape = extractAnswerShapeSidecar(response)
  const openQuestionList = extractOpenQuestionListSidecar(response)
  const provisionalView = extractProvisionalViewSidecar(response)
  return {
    id: 'a1',
    role: 'assistant',
    content: response.assistant_text,
    blocks,
    ...(actionChips.length > 0 ? { actionChips } : {}),
    ...(answerShape ? { answerShape } : {}),
    ...(openQuestionList ? { openQuestionList } : {}),
    ...(provisionalView ? { provisionalView } : {}),
    timestamp: new Date('2026-09-27T10:14:47Z'),
  } as ConversationMessage
}

function renderThread(assistant: ConversationMessage) {
  const messages = [{ id: 'u1', role: 'user', content: 'Run the analysis', timestamp: new Date('2026-09-27T10:14:40Z') }, assistant] as ConversationMessage[]
  return render(
    <ChatThread
      {...({
        messages, isThinking: false, longRunningHint: null, nodeCount: 12, patchBlockStates: new Map(), patchRejections: new Map(),
        onChipClick: vi.fn(async () => {}), onPatchAccept: () => {}, onPatchDismiss: () => {}, onFeedback: () => {}, onRetry: () => {}, compact: true,
      } as unknown as React.ComponentProps<typeof ChatThread>)}
    />,
  )
}

const flat = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const count = (hay: string, needle: string) => hay.split(needle).length - 1

beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() })
afterEach(() => cleanup())

describe('T3a: assistant_text owns the reply', () => {
  it.each([true, false])('renders the complete reply once with a legacy sidecar (shaped=%s)', async (shaped) => {
    const msg = await messageFrom(withProvisional(servedRun(), { shaped, prose: true }))
    renderThread(msg)
    expect(screen.queryByTestId('message-provisional-view')).toBeNull()
    const text = within(screen.getByTestId('message-assistant')).getByTestId('message-body-text').textContent
    expect(flat(text)).toBe(flat(msg.content.replace(/\*\*/g, '')))
    expect(count(text ?? '', VIEW)).toBe(1)
    expect(count(text ?? '', STEP)).toBe(1)
    console.info('U11 DOM:', text)
  })

  it('U9: headings, every table cell and empty cells survive the real reply renderer', () => {
    const content = '# Model implications — conditional 🔎\n| Option | Evidence | Limit |\n|---|---|---|\n| A | | Unresolved |\n| B | User stated | <img src=x onerror=alert(1)> |'
    renderThread({ id: 'a1', role: 'assistant', content, timestamp: new Date() })
    const body = within(screen.getByTestId('message-assistant')).getByTestId('message-body-text')
    expect(body.textContent).toBe(content)
    expect(body.querySelector('img')).toBeNull()
    console.info('U9 DOM:', body.outerHTML)
  })

  it('U16: coaching mounts through ChatThread without the UI science badge', () => {
    const content = 'This model depends on an uncertain assumption. Seek evidence against it.'
    renderThread({ id: 'a1', role: 'assistant', content, timestamp: new Date(), blocks: [{
      type: 'v5_coaching', block_id: 'coaching-t3', title: 'An assumption to check',
      body: 'Test the throughput assumption.', coaching_kind: 'assumption_check', source: 'decision_review',
      target_refs: [], priority_rank: 1, freshness: 'fresh',
      dsk_claim_provenance: { claim_id: 'DSK-B-003', claim_title: 'Anchoring', evidence_strength: 'strong', protocol_id: 'DSK-P-002' },
    }] })
    expect(within(screen.getByTestId('message-assistant')).getByTestId('message-body-text').textContent).toBe(content)
    expect(screen.getByTestId('v5-coaching-body').textContent).toBe('Test the throughput assumption.')
    expect(screen.queryByTestId('v5-coaching-dsk-provenance')).toBeNull()
    expect(screen.getByTestId('v5-coaching-grounding-detail').textContent).toBe('This instantiates a cited decision-science claim: “Anchoring”, which the bundle rates strong evidence.')
    console.info('U16 DOM:', screen.getByTestId('v5-coaching-body').outerHTML, 'badge absent')
  })

  it('U18: footer shows the current blocker message verbatim and keeps Run gated', () => {
    const previous = useCanvasStore.getState().analysisStateV1
    const message = 'What is the team’s weekly capacity — including its range?'
    useCanvasStore.setState({ analysisStateV1: { readiness: { status: 'blocked', blockers: [{ code: 'MISSING_FACTOR_LEVEL', message }] } } as any })
    try {
      render(<PanelFooter footer={{ dot: 'muted', headline: '', subline: '' }} onAnalyse={() => {}} isAnalysing={false} canRun={false} blockedReason={message} />)
      expect(screen.getByTestId('pre-analysis-v3-footer-headline').textContent).toBe(message)
      expect(screen.getByTestId('pre-analysis-v3-analyse')).toBeDisabled()
      expect(screen.queryByText('Not ready for analysis yet')).toBeNull()
      console.info('U18 DOM:', screen.getByTestId('pre-analysis-v3-footer-headline').outerHTML)
      render(<AnalysisReadinessBar preRunWithModel canRun={false} isAnalysing={false} nothingHasAnswered={false} onAnalyse={() => {}} blockedReason={message} />)
      expect(screen.getByTestId('analysis-readiness-bar-headline').textContent).toBe(message)
    } finally { useCanvasStore.setState({ analysisStateV1: previous }) }
  })

  it('the reader takes the wire\'s one spelling (`confirm_step`), never an alias (Panel\'s N3)', () => {
    const wire = (pv: unknown) => ({ assistant_text: 'x', __additive__: { _agent: { provisional_view: pv } } })
    expect(extractProvisionalViewSidecar(wire({ view: 'v', confirmStep: 's' }))).toEqual({ view: 'v' })
  })

  it('the reader: a sidecar with no `view` is dropped, never repaired', () => {
    const wire = (pv: unknown) => ({ assistant_text: 'x', __additive__: { _agent: { provisional_view: pv } } })
    expect(extractProvisionalViewSidecar(wire({ reasoning: 'r', confirm_step: 's' }))).toBeUndefined()
    expect(extractProvisionalViewSidecar(wire({ view: '  ' }))).toBeUndefined()
    expect(extractProvisionalViewSidecar(wire({ view: 'v', confirm_step: 's' }))).toEqual({ view: 'v', confirmStep: 's' })
  })

  it('a reload keeps it: the transcript stores the view and restores it through the same reader', async () => {
    __resetTranscriptTombstonesForTests()
    localStorage.clear()
    const msg = await messageFrom(withProvisional(servedRun(), { shaped: true }))
    saveTranscript('scn-c5', [{ id: 'u1', role: 'user', content: 'Run', timestamp: new Date() } as ConversationMessage, msg])
    const restored = loadTranscript('scn-c5')?.messages.find((m) => m.id === 'a1')
    expect(restored?.provisionalView).toEqual({ view: VIEW, reasoning: REASONING, confirmStep: STEP, heading: HEADING })
  })
})
