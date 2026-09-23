/**
 * ⭐ C2 — "Rename" on every node row becomes a PENCIL, and keeps its words.
 *
 * Measured on the captured drafts: the word "Rename" rendered on 18 of 18 node
 * rows (19 of 19 on build-vs-buy), at a uniform 46.91px, and was drawn through
 * the value at narrow docks ("Ren£20,000").
 *
 * ⚠ ONLY POSSIBLE AFTER R2. Until 23 Sep `Pencil` was ALSO the Model row's
 * "User edited" provenance STATUS, so a user-edited row would have drawn two
 * pencils meaning two different things. R2 moved that status to `UserCheck`, and
 * the last case here proves the row now carries exactly one pencil, and that it
 * is the act.
 *
 * ⚠ BOUND BY IDENTITY: role + exact accessible name, proved to be the same node
 * as the `-rename-start` testid; glyph bound by lucide's own class.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import type { ModelRow } from '../types'

const row = (over: Partial<ModelRow> & Pick<ModelRow, 'id'>): ModelRow => ({
  kind: 'factor',
  group: 'factors',
  label: `Label ${over.id}`,
  primaryValue: '0.45',
  attention: [],
  editable: true,
  ...over,
})

describe('C2 · a node row renames with a pencil, not the word', () => {
  it('the rename control is ONE button, named "Rename <label>", with no visible text', () => {
    render(<ModelRowView row={row({ id: 'f-1', label: 'Churn' })} tier="plain" onRenameRow={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Rename Churn' })
    expect(button).toBe(screen.getByTestId('model-row-v2-f-1-rename-start'))
    expect(button.textContent?.trim()).toBe('')
    expect(button.querySelector('svg.lucide-pencil')).not.toBeNull()
  })

  it('its tooltip leads with the word it replaced', () => {
    render(<ModelRowView row={row({ id: 'f-1', label: 'Churn' })} tier="plain" onRenameRow={vi.fn()} />)
    fireEvent.mouseEnter(screen.getByTestId('model-row-v2-f-1-rename-start'))
    expect(screen.getByRole('tooltip').textContent).toMatch(/^Rename\b/)
  })

  it('it is the SHARED icon button (44px touch target)', () => {
    render(<ModelRowView row={row({ id: 'f-1' })} tier="plain" onRenameRow={vi.fn()} />)
    expect(screen.getByTestId('model-row-v2-f-1-rename-start').className).toContain('before:inset-[-8px]')
  })

  it('pressing it opens the rename editor and does not also select the row', () => {
    const onSelect = vi.fn()
    render(
      <ModelRowView row={row({ id: 'f-1', label: 'Churn' })} tier="plain" onSelect={onSelect} onRenameRow={vi.fn()} />,
    )
    fireEvent.click(screen.getByTestId('model-row-v2-f-1-rename-start'))
    expect(screen.getByDisplayValue('Churn')).toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('a relationship row still has no rename (unchanged)', () => {
    render(
      <ModelRowView
        row={row({ id: 'e-1', kind: 'relationship', group: 'relationships' })}
        tier="plain"
        onRenameRow={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('model-row-v2-e-1-rename-start')).toBeNull()
  })

  it('⭐ ONE PENCIL, ONE MEANING: a user-edited row draws exactly one pencil, and it is the act', () => {
    // `user_override` classifies as the `edited` kind — the row R2 was about.
    const { container } = render(
      <ModelRowView
        row={row({ id: 'f-2', label: 'Price', provenanceSource: 'user_override' })}
        tier="plain"
        onRenameRow={vi.fn()}
      />,
    )
    const pencils = container.querySelectorAll('svg.lucide-pencil')
    expect(pencils).toHaveLength(1)
    expect(screen.getByTestId('model-row-v2-f-2-rename-start').contains(pencils[0])).toBe(true)
    // CONTRAST CONTROL: the provenance mark is really on this row, as the person glyph.
    const mark = screen.getByTestId('model-row-v2-f-2-provenance-mark')
    expect(mark.querySelector('svg.lucide-user-check')).not.toBeNull()
  })
})
