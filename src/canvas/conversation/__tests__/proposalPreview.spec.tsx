/**
 * Suggestion preview, stage 1: the carrier and the bridge (DL ruling 5941839936). The Agent turn's root
 * `proposal_preview` is read strictly, bound to the consent chip of the SAME proposal id, never persisted, and handed
 * to the canvas ghost store only while the latest reply still offers that chip.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))

import { consentChipIdFor, previewOfLatestReply, readProposalPreview, readProposalPreviewValue } from '../proposalPreview'
import { useProposalGhostStore } from '../../stores/proposalGhostStore'
import { saveTranscript, loadTranscript } from '../utils/transcriptStore'
import { ChatThread } from '../zones/ChatThread'
import type { ActionChip, ConversationMessage } from '../types'

// The DL-ruled wire shape: ids, labels, op class and band only.
const WIRE = {
  proposal_id: 'prop_0a1b2c3d4e5f',
  ops: [
    { op: 'add_node', id: 'fac_onboarding_time', label: 'Customer onboarding time', kind: 'factor' },
    { op: 'add_edge', from_id: 'fac_onboarding_time', to_id: 'enterprise_prospect_signing_likelihood' },
    { op: 'set_link_strength', from_id: 'sprint_capacity_for_ai_reporting', to_id: 'ai_reporting_module_availability', band: 'moderate' },
  ],
}
const CONSENT: ActionChip = { id: consentChipIdFor(WIRE.proposal_id), label: 'Make this change', intent: 'primary', message: 'Yes, make that change.' }
const reply = (id: string, over: Partial<ConversationMessage> = {}): ConversationMessage =>
  ({ id, role: 'assistant', content: `Reply ${id}`, timestamp: new Date(), ...over }) as ConversationMessage

afterEach(() => {
  cleanup()
  const g = useProposalGhostStore.getState().ghost
  if (g) useProposalGhostStore.getState().clearGhost(g.proposalId)
  localStorage.clear()
})

describe('readProposalPreview: the ruled shape, nothing looser', () => {
  it('reads root `proposal_preview`, then the additive sidecar; ids become camelCase', () => {
    const p = readProposalPreview({ proposal_preview: WIRE })
    expect(p).toEqual({
      proposalId: 'prop_0a1b2c3d4e5f',
      ops: [
        { op: 'add_node', id: 'fac_onboarding_time', label: 'Customer onboarding time', kind: 'factor' },
        { op: 'add_edge', fromId: 'fac_onboarding_time', toId: 'enterprise_prospect_signing_likelihood' },
        { op: 'set_link_strength', fromId: 'sprint_capacity_for_ai_reporting', toId: 'ai_reporting_module_availability', band: 'moderate' },
      ],
    })
    expect(readProposalPreview({ __additive__: { proposal_preview: WIRE } })?.proposalId).toBe('prop_0a1b2c3d4e5f')
  })

  it('⛔ only the display fields cross: a value, a reason or prose on an op is never copied', () => {
    const p = readProposalPreview({ proposal_preview: { proposal_id: 'p', ops: [
      { op: 'add_node', id: 'n', label: 'N', kind: 'factor', value: 42, reason: 'internal', prose: 'Olumi thinks…' },
    ] } })
    expect(p?.ops[0]).toEqual({ op: 'add_node', id: 'n', label: 'N', kind: 'factor' })
  })

  it('⛔ strict: an unknown op class, or one missing an id, label or band, is dropped; no ops or no id = no preview', () => {
    const p = readProposalPreviewValue({ proposal_id: 'p', ops: [
      { op: 'remove_node', id: 'x' }, { op: 'add_node', id: 'n' }, { op: 'add_edge', from_id: 'a' },
      { op: 'set_link_strength', from_id: 'a', to_id: 'b' }, { op: 'add_edge', from_id: 'a', to_id: 'b' },
    ] })
    expect(p?.ops).toEqual([{ op: 'add_edge', fromId: 'a', toId: 'b' }])
    expect(readProposalPreviewValue({ proposal_id: 'p', ops: [{ op: 'remove_node', id: 'x' }] })).toBeNull()
    expect(readProposalPreviewValue({ ops: WIRE.ops })).toBeNull()
    expect(readProposalPreview({})).toBeNull()
  })
})

describe('previewOfLatestReply: bound to the consent chip of the SAME proposal', () => {
  const preview = () => readProposalPreview({ proposal_preview: WIRE })!

  it('the latest reply offers its consent chip → its preview', () => {
    expect(previewOfLatestReply([reply('a', { proposalPreview: preview(), actionChips: [CONSENT] })])).toEqual(preview())
  })

  it.each([
    ['no consent chip (settled, or dropped on reload)', { actionChips: [] }],
    ['a consent chip for ANOTHER proposal', { actionChips: [{ ...CONSENT, id: consentChipIdFor('prop_other') }] }],
  ])('⛔ %s → no preview', (_why, over) => {
    expect(previewOfLatestReply([reply('a', { proposalPreview: preview(), ...over })])).toBeNull()
  })

  it('⛔ a LATER reply without a preview ends it (Accept, decline, any new turn); an older preview never resurfaces', () => {
    expect(previewOfLatestReply([
      reply('a', { proposalPreview: preview(), actionChips: [CONSENT] }),
      { id: 'u', role: 'user', content: 'Yes, make that change.', timestamp: new Date() } as ConversationMessage,
      reply('b'),
    ])).toBeNull()
  })

  it('the restore’s "Session resumed" divider is not a reply', () => {
    expect(previewOfLatestReply([
      reply('a', { proposalPreview: preview(), actionChips: [CONSENT] }),
      reply('boundary-x', { content: '', synthetic: true, sessionDivider: 'Session resumed' } as Partial<ConversationMessage>),
    ])).toEqual(preview())
  })

  it('⛔ a reload keeps no preview: saveTranscript → loadTranscript → nothing to ghost', () => {
    saveTranscript('scn-pp', [
      { id: 'u', role: 'user', content: 'Add onboarding time', timestamp: new Date() } as ConversationMessage,
      reply('a', { proposalPreview: preview(), actionChips: [CONSENT] }),
    ])
    const back = loadTranscript('scn-pp')!.messages
    expect(back.find((m) => m.id === 'a')?.proposalPreview).toBeUndefined()
    expect(previewOfLatestReply(back)).toBeNull()
  })
})

describe('the bridge: ChatThread hands the live preview to the ghost store, and takes it back', () => {
  const saved = Element.prototype.scrollIntoView
  beforeAll(() => { Element.prototype.scrollIntoView = function () {} })
  afterAll(() => { Element.prototype.scrollIntoView = saved })
  const props = (messages: ConversationMessage[]) => ({
    messages, isThinking: false, longRunningHint: null, nodeCount: 13, patchBlockStates: new Map(), patchRejections: new Map(),
    onChipClick: vi.fn(), onPatchAccept: vi.fn(), onPatchDismiss: vi.fn(), onFeedback: vi.fn(), onRetry: vi.fn(),
  }) as unknown as React.ComponentProps<typeof ChatThread>

  it('shows the ghost while the chip is offered; a later reply clears it; unmount clears it', () => {
    const p = readProposalPreview({ proposal_preview: WIRE })!
    const first = [reply('a', { proposalPreview: p, actionChips: [CONSENT] })]
    const { rerender, unmount } = render(<ChatThread {...props(first)} />)
    expect(useProposalGhostStore.getState().ghost).toEqual(p)

    rerender(<ChatThread {...props([...first, { id: 'u', role: 'user', content: 'Yes', timestamp: new Date() } as ConversationMessage, reply('b')])} />)
    expect(useProposalGhostStore.getState().ghost).toBeNull()

    rerender(<ChatThread {...props(first)} />)
    expect(useProposalGhostStore.getState().ghost).toEqual(p)
    unmount()
    expect(useProposalGhostStore.getState().ghost).toBeNull()
  })

  it('⛔ a stale clear cannot wipe a NEWER ghost (clearGhost names its proposal)', () => {
    const a = readProposalPreview({ proposal_preview: WIRE })!
    const b = readProposalPreview({ proposal_preview: { ...WIRE, proposal_id: 'prop_newer' } })!
    useProposalGhostStore.getState().showGhost(b)
    useProposalGhostStore.getState().clearGhost(a.proposalId)
    expect(useProposalGhostStore.getState().ghost).toEqual(b)
  })
})
