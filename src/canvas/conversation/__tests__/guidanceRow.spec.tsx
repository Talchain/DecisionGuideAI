/**
 * T4 — the M1 coaching row (Reasoning Coach @1c355d57, case A-STRENGTHEN-PLACEHOLDER-P1; carrier AI HARNESS 5937532945).
 * The row's copy below is the coach's own `rendered_example`, not ours. Rows: the reader takes the contract shape and
 * nothing looser; load 2 keeps it; the words render verbatim; the ONE action is #2408's served Accept/Edit, bound to
 * the `item_ref` link by id, and offered only where #2408 offers it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const confirm = vi.fn()
const openEditor = vi.fn()
vi.mock('../../hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({ proposeEdgeStrengthConfirmation: (id: string, o: unknown) => { confirm(id, o); return { kind: 'sent' } } }),
}))
vi.mock('../../utils/openEdgeStrengthEditor', () => ({ openEdgeStrengthEditor: (id: string) => openEditor(id) }))

import { readGuidance, readGuidanceSlots } from '../guidanceRows'
import { GuidanceRows } from '../zones/GuidanceRows'
import { ChatThread } from '../zones/ChatThread'
import { saveTranscript, loadTranscript } from '../utils/transcriptStore'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import type { ConversationMessage } from '../types'
import served from '../../__tests__/fixtures/served-0303ef5-pricing-withheld-run.json'

const COPY = {
  title: 'The comparison rests on a link nobody has sized yet.',
  why: "Until it is sized, Olumi can't compare the options on your goal.",
  question: 'How much does sprint capacity for AI reporting really change AI reporting module availability? The comparison turns on it.',
}
const ROW = {
  policy_id: 'RC-STRENGTHEN-ITEM', priority: 'P1', variant: 'S1',
  item: 'sprint_capacity_for_ai_reporting->ai_reporting_module_availability',
  primary_action: 'strengthen', state_key_hash: 'skh_d1_ai', copy: COPY,
  item_ref: { kind: 'link', from_id: 'sprint_capacity_for_ai_reporting', to_id: 'ai_reporting_module_availability' },
}
const PLACEHOLDER = { strength_mean: 0.25, weightSource: 'cee', strengthPlaceholder: 0.25 }
const ACCEPTED = { strength_mean: 0.25, weightSource: 'cee' }

const savedScroll = Element.prototype.scrollIntoView
beforeAll(() => { Element.prototype.scrollIntoView = function () {} })
afterAll(() => { Element.prototype.scrollIntoView = savedScroll })
afterEach(() => {
  cleanup(); confirm.mockReset(); openEditor.mockReset(); localStorage.clear()
  useCanvasStore.setState({ nodes: [], edges: [], results: { status: 'idle', progress: 0 }, hasCompletedFirstRun: false, analysisFreshness: null, analysisFreshnessDirty: false } as never)
})

function seed(opts: { aiLink?: Record<string, unknown>; current?: boolean } = {}) {
  const report = mapV5AnalysisToReport(served.analysis_result as never, {} as never)
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: opts.current === false,
    importPendingServerRegistration: false,
    nodes: [
      ['sprint_capacity_for_ai_reporting', 'Sprint capacity for AI reporting'],
      ['ai_reporting_module_availability', 'AI reporting module availability'],
      ['sprint_capacity_for_integration_fix', 'Sprint capacity for integration fix'],
      ['integration_step_bug_resolution', 'Integration-step bug resolution'],
    ].map(([id, label], i) => ({ id, type: 'factor', position: { x: i * 100, y: 0 }, data: { label, kind: 'factor' } })) as never,
    edges: [
      // e_int FIRST: a binder that took "the first unsized link" instead of item_ref's ids would pick it.
      { id: 'e_int', source: 'sprint_capacity_for_integration_fix', target: 'integration_step_bug_resolution', data: PLACEHOLDER },
      { id: 'e_ai', source: 'sprint_capacity_for_ai_reporting', target: 'ai_reporting_module_availability', data: opts.aiLink ?? PLACEHOLDER },
    ] as never,
    results: { status: 'complete', progress: 100, report } as never,
  } as never)
}

describe('readGuidance: the contract shape, nothing looser', () => {
  it('reads root `guidance`, then the additive sidecar; ids become camelCase item_ref', () => {
    const g = readGuidance({ guidance: { slot1: ROW } })
    expect(g?.slot1).toMatchObject({ policyId: 'RC-STRENGTHEN-ITEM', variant: 'S1', stateKeyHash: 'skh_d1_ai', copy: COPY,
      itemRef: { kind: 'link', fromId: 'sprint_capacity_for_ai_reporting', toId: 'ai_reporting_module_availability' } })
    expect(g?.slot2).toBeNull()
    expect(readGuidance({ __additive__: { guidance: { slot2: ROW } } })?.slot2?.policyId).toBe('RC-STRENGTHEN-ITEM')
  })
  it('⛔ a row with no title, no state key or no policy is NOT a row; no row at all = null', () => {
    expect(readGuidance({ guidance: { slot1: { ...ROW, copy: { why: 'x' } } } })).toBeNull()
    expect(readGuidance({ guidance: { slot1: { ...ROW, state_key_hash: '' } } })).toBeNull()
    expect(readGuidance({ guidance: { slot1: { ...ROW, policy_id: undefined } } })).toBeNull()
    expect(readGuidance({})).toBeNull()
    expect(readGuidance({ guidance: 'slot1' })).toBeNull()
  })
  it('a malformed item_ref leaves the row as words only (itemRef null), never a guessed link', () => {
    expect(readGuidance({ guidance: { slot1: { ...ROW, item_ref: { kind: 'link', from_id: 'a' } } } })?.slot1?.itemRef).toBeNull()
    expect(readGuidance({ guidance: { slot1: { ...ROW, item_ref: { kind: 'factor', factor_id: 'f1' } } } })?.slot1?.itemRef).toEqual({ kind: 'factor', factorId: 'f1' })
  })
})

describe('load 2 keeps the challenge', () => {
  it('guidance survives saveTranscript → loadTranscript, identical', () => {
    const g = readGuidance({ guidance: { slot1: ROW } })!
    const msgs: ConversationMessage[] = [
      { id: 'u', role: 'user', content: 'Run it', timestamp: new Date() },
      { id: 'a', role: 'assistant', content: 'Run complete.', guidance: g, timestamp: new Date() },
    ]
    saveTranscript('scn-g', msgs)
    const back = loadTranscript('scn-g')?.messages.find((m) => m.id === 'a')
    expect(back?.guidance).toEqual(g)
    expect(readGuidanceSlots(back?.guidance)).toEqual(g)
  })
})

describe('the row: the coach’s words verbatim, and #2408’s served action bound by id', () => {
  const g = () => readGuidance({ guidance: { slot1: ROW } })!

  it('renders title, why and question exactly as sent; none of the contract’s forbidden words', () => {
    seed()
    render(<GuidanceRows guidance={g()} />)
    expect(screen.getByTestId('guidance-row-slot1-title').textContent).toBe(COPY.title)
    expect(screen.getByTestId('guidance-row-slot1-why').textContent).toBe(COPY.why)
    expect(screen.getByTestId('guidance-row-slot1-question').textContent).toBe(COPY.question)
    const text = screen.getByTestId('guidance-row-slot1').textContent ?? ''
    for (const banned of ['Strengthen the model', 'placeholder', 'edge']) expect(text).not.toContain(banned)
  })

  it('S1 + link on canvas + unsized + current Run → Accept/Edit for THAT link (e_ai, not e_int); Accept confirms e_ai', () => {
    seed()
    render(<GuidanceRows guidance={g()} />)
    expect(screen.getByTestId('guidance-row-slot1')).toHaveAttribute('data-has-action', 'true')
    expect(screen.queryByTestId('guidance-row-slot1-link-e_int-accept')).toBeNull()
    fireEvent.click(screen.getByTestId('guidance-row-slot1-link-e_ai-accept'))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm.mock.calls[0][0]).toBe('e_ai')
    fireEvent.click(screen.getByTestId('guidance-row-slot1-link-e_ai-edit'))
    expect(openEditor).toHaveBeenCalledWith('e_ai')
  })

  it.each([
    ['the link already carries a strength (accepted)', () => seed({ aiLink: ACCEPTED }), ROW],
    ['the Run is not current', () => seed({ current: false }), ROW],
    ['the ids are not on this canvas', () => seed(), { ...ROW, item_ref: { kind: 'link', from_id: 'gone', to_id: 'ai_reporting_module_availability' } }],
    ['a factor item, not a link', () => seed(), { ...ROW, item_ref: { kind: 'factor', factor_id: 'sprint_capacity_for_ai_reporting' } }],
    ['another policy', () => seed(), { ...ROW, policy_id: 'RC-PREMORTEM' }],
    ['another variant (S3L)', () => seed(), { ...ROW, variant: 'S3L' }],
  ])('⛔ %s → the words only, NO action', (_why, setup, row) => {
    setup()
    render(<GuidanceRows guidance={readGuidance({ guidance: { slot1: row } })!} />)
    expect(screen.getByTestId('guidance-row-slot1')).toHaveAttribute('data-has-action', 'false')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByTestId('guidance-row-slot1-title').textContent).toBe(COPY.title)
  })
})

describe('only the latest turn carries a row', () => {
  it('an older assistant message with guidance shows no row; the latest one does', () => {
    seed()
    const g = readGuidance({ guidance: { slot1: ROW } })!
    render(
      <ChatThread
        messages={[
          { id: 'a1', role: 'assistant', content: 'Earlier turn.', guidance: g, timestamp: new Date() },
          { id: 'u', role: 'user', content: 'And now?', timestamp: new Date() },
          { id: 'a2', role: 'assistant', content: 'Latest turn.', guidance: g, timestamp: new Date() },
        ]}
        isThinking={false}
        longRunningHint={null}
        nodeCount={4}
        patchBlockStates={new Map()}
        patchRejections={new Map()}
        onChipClick={async () => {}}
        onPatchAccept={() => {}}
        onPatchDismiss={() => {}}
        onFeedback={() => {}}
        onRetry={() => {}}
      />,
    )
    expect(screen.getAllByTestId('guidance-rows')).toHaveLength(1)
    expect(screen.getByTestId('guidance-rows').parentElement?.textContent).toContain('Latest turn.')
  })
})
