/**
 * ⭐ C6 — the Model tab's unicode "icons" become the design system's Lucide ones.
 *
 * DS v5 §9: Lucide only, no unicode symbol used as an icon. The audit found the
 * Model tab drawing its group disclosure as typed `▾`/`▸` (5 per render) while
 * the Reasoning tab draws `ChevronDown`/`ChevronRight`, and its structural group
 * acts as a typed "+ " where the DS Tier-2 add act is `Plus`.
 *
 * ⚠ OUT OF SCOPE, DELIBERATELY: the `→` inside a relationship's label is TEXT (it
 * is read as "to"), and it stays.
 *
 * ⚠ BOUND BY IDENTITY: the group toggle by its own testid, the act by its testid
 * AND role name, the glyph by lucide's own class.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelOutline } from '../ModelOutline'
import { ModelGroupActions } from '../ModelGroupActions'
import { GROUP_ACTIONS } from '../groupActions'
import type { ModelRow } from '../types'

const row = (id: string): ModelRow => ({
  id,
  kind: 'factor',
  group: 'factors',
  label: `Label ${id}`,
  primaryValue: '1',
  attention: [],
  editable: true,
})

describe('C6 · the group disclosure is a Lucide chevron, not a typed triangle', () => {
  it('closed draws ChevronRight, open draws ChevronDown, and no unicode triangle is drawn', () => {
    render(<ModelOutline rows={[row('f1')]} tier="plain" />)
    const toggle = screen.getByTestId('model-group-v2-factors-toggle')
    const wasOpen = toggle.getAttribute('aria-expanded') === 'true'
    const check = (open: boolean) => {
      expect(toggle.querySelector(open ? 'svg.lucide-chevron-down' : 'svg.lucide-chevron-right')).not.toBeNull()
      expect(toggle.querySelector(open ? 'svg.lucide-chevron-right' : 'svg.lucide-chevron-down')).toBeNull()
      expect(toggle.textContent).not.toMatch(/[▾▸]/)
    }
    check(wasOpen)
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe(String(!wasOpen))
    check(!wasOpen)
  })

  it('the chevron is decorative: the accessible name is unchanged and carries no glyph', () => {
    render(<ModelOutline rows={[row('f1')]} tier="plain" />)
    const toggle = screen.getByTestId('model-group-v2-factors-toggle')
    expect(toggle.getAttribute('aria-label')).toMatch(/^Factors, 1 element/)
    expect(toggle.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('C6 · a structural group act draws Plus, not a typed "+ "', () => {
  it('"Add a factor" keeps its words and leads with the Plus glyph', () => {
    render(
      <ModelGroupActions groupId="factors" actions={GROUP_ACTIONS.factors} context={{ goalLabel: 'Grow ARR', goalTarget: '45%' }} onAction={vi.fn()} />,
    )
    const add = screen.getByRole('button', { name: 'Add a factor' })
    expect(add).toBe(screen.getByTestId('model-action-v2-factors-add'))
    expect(add.textContent).toBe('Add a factor')
    expect(add.querySelector('svg.lucide-plus')).not.toBeNull()
  })
})
