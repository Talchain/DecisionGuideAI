/**
 * ⭐ CONSENT (DL 22 Oct 2026; Track 3 CARD-VS-WRITE: 12/12 served core approvals wrote changes the card never showed). CEE's
 * held card names every other change as a `change_note` add: one plain sentence and whose it is. The chat shows them as
 * "Also changes", read before the approve; the canvas ghost draws none of them; an unknown kind is still dropped.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SuggestedChips, ALSO_CHANGES } from '../zones/SuggestedChips'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { readProposalFields } from '../proposalFields'
import { consentChipIdFor, previewFromFields, previewOfLatestReply, readProposalPreviewValue } from '../proposalPreview'
import type { ConversationMessage } from '../types'
import served from './fixtures/served-held-proposal-sdwire4.json'

type Json = Record<string, unknown>
const RENAME = { field_id: 'change_note:nodes/fac_a/label', kind: 'change_note', text: 'Renames ‘Capacity’ to ‘Team capacity’ (Olumi’s estimate).', source: 'estimate', editable: false }
const SETTING = { field_id: 'change_note:options/opt_b/fac_w', kind: 'change_note', text: '‘Hire a lead’ now sets ‘External wait’ to 0.5 weeks (yours).', source: 'yours', editable: false }
const withAdds = (adds: unknown[] | undefined): Json => {
  const f = structuredClone(served.read_R1.proposal_fields) as unknown as Json
  const p = (f.proposals as Json[])[0]
  if (adds === undefined) delete p.adds; else p.adds = adds
  return f
}
const mount = (fields: Json) => {
  const approve = ((fields.proposals as Json[])[0].approve_action) as never
  return render(<SuggestedChips chips={buildSuggestedActionChips([], [approve])} onChipClick={vi.fn(async () => {})} proposalFields={fields} />)
}
const PID = String((served.read_R1.proposal_fields.proposals[0] as Json).proposal_id)

afterEach(cleanup)

describe('the held card says everything else the approval writes', () => {
  it('⭐ every note, in CEE\'s order, in its words and whose it is, above the approve', () => {
    mount(withAdds([RENAME, SETTING]))
    const panel = screen.getByTestId(`proposal-change-notes-${PID}`)
    expect(panel.querySelector('p')?.textContent).toBe(ALSO_CHANGES)
    const items = [...panel.querySelectorAll('li')]
    expect(items.map((li) => li.textContent)).toEqual([RENAME.text, SETTING.text])
    expect(items.map((li) => li.getAttribute('data-source'))).toEqual(['estimate', 'yours'])
    // Read BEFORE the buttons: the panel precedes the chip row.
    expect(panel.compareDocumentPosition(screen.getByTestId('suggested-chips')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(panel.querySelector('input, button, textarea')).toBeNull()
  })

  it('⛔ an unknown kind, an editable note or a note over 400 characters is dropped on its own; the card and its other notes stay', () => {
    const fields = withAdds([{ field_id: 'mystery:1', kind: 'mystery', text: 'x' }, { ...RENAME, editable: true },
      { ...SETTING, field_id: 'change_note:long', text: 'y'.repeat(401) }, SETTING])
    const read = readProposalFields(fields)
    expect(read?.proposals[0].adds.map((a) => a.field_id)).toEqual([SETTING.field_id])
    mount(fields)
    expect([...screen.getByTestId(`proposal-change-notes-${PID}`).querySelectorAll('li')].map((li) => li.textContent)).toEqual([SETTING.text])
  })

  it('CONTRAST: a card with no notes renders exactly as before (no panel, same markup as a card whose adds were all dropped)', () => {
    // React's generated ids (`:r5:`) differ per mount; everything else must match.
    const markup = (fields: Json) => { const html = mount(fields).container.innerHTML.replace(/:r[0-9a-z]+:/g, ':id:'); cleanup(); return html }
    const none = markup(withAdds(undefined))
    const dropped = markup(withAdds([{ field_id: 'mystery:1', kind: 'mystery' }]))
    expect(dropped).toBe(none)
    expect(none).not.toContain('proposal-change-notes')
    expect(none).not.toContain(ALSO_CHANGES)
  })

  it('⛔ the canvas ghost draws no note: a notes-only card has no ghost, and a factor add beside notes ghosts the factor alone', () => {
    const only = readProposalFields(withAdds([RENAME]))!.proposals[0]
    expect(previewFromFields({ ...only, fields: [] })).toBeNull()
    const add = { field_id: 'factor_add:fac_n', kind: 'factor_add', node_id: 'fac_n', label: 'Night shifts', value: null, source: 'estimate' }
    const mixed = readProposalFields(withAdds([RENAME, add]))!.proposals[0]
    expect(previewFromFields({ ...mixed, fields: [] })?.ops).toEqual([{ op: 'add_node', id: 'fac_n', label: 'Night shifts', kind: 'factor', value: null, source: 'estimate' }])
  })

  it('⭐ the ghost knows how many other changes its card lists (so it offers no approve); with none, the preview is exactly as before', () => {
    const add = { field_id: 'factor_add:fac_n', kind: 'factor_add', node_id: 'fac_n', label: 'Night shifts', value: null, source: 'estimate' }
    const mixed = readProposalFields(withAdds([RENAME, add, SETTING]))!.proposals[0]
    expect(previewFromFields({ ...mixed, fields: [] })?.otherChanges).toBe(2)
    const plain = readProposalFields(withAdds([add]))!.proposals[0]
    expect(previewFromFields({ ...plain, fields: [] })).toEqual({ proposalId: plain.proposal_id,
      ops: [{ op: 'add_node', id: 'fac_n', label: 'Night shifts', kind: 'factor', value: null, source: 'estimate' }] })
  })

  it('⛔ Codex r2: an EXPLICIT preview (proposal_preview) whose held card lists notes also carries the count; with none it is returned as is', () => {
    const fields = withAdds([RENAME])
    const pid = String(((fields.proposals as Json[])[0]).proposal_id)
    const explicit = readProposalPreviewValue({ proposal_id: pid, ops: [{ op: 'add_node', id: 'fac_n', label: 'Night shifts', kind: 'factor' }] })!
    const reply = (f: Json): ConversationMessage => ({ id: 'r1', role: 'assistant', content: 'reply', timestamp: new Date(), proposalPreview: explicit,
      proposalFields: f, actionChips: [{ id: consentChipIdFor(pid), label: 'Make this change', intent: 'primary', message: 'Yes.' }] }) as ConversationMessage
    expect(previewOfLatestReply([reply(fields)])?.otherChanges).toBe(1)
    expect(previewOfLatestReply([reply(withAdds(undefined))])).toBe(explicit)
  })
})
