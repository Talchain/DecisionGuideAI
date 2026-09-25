/**
 * ⭐ C3 — the Model tab's half of rulings R1, R2 and R3 (one icon, one meaning).
 *
 *   R1 `HelpCircle` = an UNRESOLVED question (a status). The provenance key's
 *      BUTTON used it too, on the same screen as 25 "Estimate not yet
 *      confirmed" marks; the button becomes `Info`.
 *   R2 `Pencil` = the EDIT act only. The "User edited" provenance STATUS
 *      becomes `UserCheck` — the value is yours — and keeps its own words.
 *   R3 every hand-to-Olumi ACT is `MessageCircle`. The "Discuss the {group}
 *      with Olumi" text links become speech-bubble icon buttons whose name and
 *      tooltip are the full sentence.
 *
 * ⚠ BOUND BY IDENTITY: testid + exact accessible name + lucide's own class.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelGroupActions } from '../ModelGroupActions'
import { GROUP_ACTIONS } from '../groupActions'
import { ValueProvenanceKey } from '../ValueProvenanceKey'
import { ValueProvenanceMark } from '../ValueProvenanceMark'
import { VALUE_PROVENANCE_LABEL } from '../../domain/valueProvenance'

const CTX = { goalLabel: 'Grow ARR', goalTarget: '45%' }

describe('R3 · "Discuss the {group} with Olumi" is a speech-bubble icon button', () => {
  it('each discuss act is a button named by its full sentence, with no visible text', () => {
    render(
      <ModelGroupActions groupId="factors" actions={GROUP_ACTIONS.factors} context={CTX} onAction={vi.fn()} />,
    )
    const discuss = screen.getByRole('button', { name: 'Discuss the factors with Olumi' })
    expect(discuss).toBe(screen.getByTestId('model-action-v2-factors-discuss'))
    expect(discuss.textContent?.trim()).toBe('')
    expect(discuss.querySelector('svg.lucide-message-circle')).not.toBeNull()
    expect(discuss.querySelector('svg.lucide-sparkles')).toBeNull()
  })

  it('its tooltip is the same sentence', () => {
    render(
      <ModelGroupActions groupId="factors" actions={GROUP_ACTIONS.factors} context={CTX} onAction={vi.fn()} />,
    )
    fireEvent.mouseEnter(screen.getByTestId('model-action-v2-factors-discuss'))
    expect(screen.getByRole('tooltip').textContent).toBe('Discuss the factors with Olumi')
  })

  it('every group\'s discuss act is the same glyph, and still hands over its exact message', () => {
    const onAction = vi.fn()
    for (const groupId of ['goal', 'options', 'factors', 'outcomes-risks', 'relationships'] as const) {
      const { unmount } = render(
        <ModelGroupActions groupId={groupId} actions={GROUP_ACTIONS[groupId]} context={CTX} onAction={onAction} />,
      )
      const discuss = GROUP_ACTIONS[groupId].find(a => a.intent === 'discuss')
      expect(discuss, `${groupId} has a discuss act`).toBeDefined()
      const button = screen.getByRole('button', { name: discuss!.label })
      expect(button.querySelector('svg.lucide-message-circle'), groupId).not.toBeNull()
      fireEvent.click(button)
      expect(onAction).toHaveBeenLastCalledWith(discuss, discuss!.message(CTX))
      unmount()
    }
  })
})

describe('R1 · the provenance key button is Info, not the unresolved-question mark', () => {
  it('the toggle draws Info, and HelpCircle is left to mean "not yet resolved"', () => {
    render(<ValueProvenanceKey />)
    const toggle = screen.getByRole('button', { name: 'How to read these marks' })
    expect(toggle).toBe(screen.getByTestId('model-tab-v2-provenance-key-toggle'))
    expect(toggle.querySelector('svg.lucide-info')).not.toBeNull()
    expect(toggle.querySelector('svg.lucide-help-circle')).toBeNull()
  })
})

describe('R2 · "User edited" is a STATUS, so it is the person glyph, never the edit pencil', () => {
  it('a user_override value draws UserCheck and keeps its own words', () => {
    render(<ValueProvenanceMark source="user_override" rowId="f1" />)
    const mark = screen.getByTestId('model-row-v2-f1-provenance-mark')
    expect(mark).toHaveAttribute('data-provenance-kind', 'edited')
    expect(mark).toHaveAttribute('aria-label', VALUE_PROVENANCE_LABEL.edited)
    expect(mark.querySelector('svg.lucide-user-check')).not.toBeNull()
    expect(mark.querySelector('svg.lucide-pencil')).toBeNull()
  })

  it('DISCRIMINATING PAIR: in the key, "Set by you" shares the glyph but NOT the words', () => {
    // `human` is not reachable from a value literal (`classifyValueProvenance`
    // has no source for it), so the pair is read where both are drawn: the key.
    render(<ValueProvenanceKey />)
    fireEvent.click(screen.getByTestId('model-tab-v2-provenance-key-toggle'))
    const key = screen.getByTestId('model-tab-v2-provenance-key')
    const edited = key.querySelector('[data-provenance-kind="edited"]') as HTMLElement
    const human = key.querySelector('[data-provenance-kind="human"]') as HTMLElement
    expect(edited.querySelector('svg.lucide-user-check')).not.toBeNull()
    expect(human.querySelector('svg.lucide-user-check')).not.toBeNull()
    expect(edited).toHaveTextContent(VALUE_PROVENANCE_LABEL.edited)
    expect(human).toHaveTextContent(VALUE_PROVENANCE_LABEL.human)
    expect(VALUE_PROVENANCE_LABEL.human).not.toBe(VALUE_PROVENANCE_LABEL.edited)
    // And no row of the key draws the edit pencil any more.
    expect(key.querySelector('svg.lucide-pencil')).toBeNull()
  })
})
