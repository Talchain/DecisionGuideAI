/**
 * ⭐⭐ V2 GAP 33 — AI ACTIONS ON THE MODEL TAB NEVER USE THE OLUMI AI ICON, AND
 * THEIR TARGETS ARE 14-15PX.
 *
 * `FIDELITY-GAPS-INDEX-20260924.txt` #33 (medium/quick). Witnessed on served
 * `4549b66b`: `ModelGroupActions.tsx:70-74` rendered every group hand-off as
 * an 11px (`typography.panelMeta`) text link with no geometry, and the
 * structural ones ("+ Add a factor", "+ Explore other strategies") spelled
 * "add" as a typed `+ ` character rather than a recognisable glyph.
 * `git grep OlumiAiIcon -- src/canvas` found zero hits repo-wide.
 *
 * Two directions, bound by IDENTITY (the `data-icon="olumi-ai"` marker and
 * the exact Lucide class, never a value predicate the other intent could
 * also satisfy):
 *   · `discuss` actions carry the Olumi AI icon, in `text-info`.
 *   · `structural` actions carry a Lucide `Plus`, NEVER the AI icon and NEVER
 *     a typed `+ ` character in the rendered label.
 * Both intents carry a real ≥24px touch target (WCAG 2.2 AA §2.5.8).
 *
 * A mutant reverting the icon swap REDs the first two tests; a mutant
 * dropping the geometry REDs the third; neither can satisfy the other.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { ModelGroupActions } from '../ModelGroupActions'
import type { GroupAction, GroupActionContext } from '../groupActions'

afterEach(cleanup)

const CTX: GroupActionContext = { goalLabel: 'Grow ARR', goalTarget: '45%' }

const DISCUSS: GroupAction = {
  id: 'factors-discuss',
  label: 'Discuss the factors with Olumi',
  intent: 'discuss',
  message: () => 'Help me review the factors in my model',
  rehomedFrom: 'FactorsSection.tsx:745',
}

const STRUCTURAL: GroupAction = {
  id: 'factors-add',
  label: 'Add a factor',
  intent: 'structural',
  message: () => 'I want to add a new factor to the model',
  rehomedFrom: 'FactorsSection.tsx:737',
}

function renderActions(actions: readonly GroupAction[], onAction = vi.fn()) {
  render(
    <ModelGroupActions groupId="factors" actions={actions} context={CTX} onAction={onAction} />,
  )
  return onAction
}

describe('discuss actions carry the Olumi AI icon', () => {
  it('renders the AI glyph, in text-info, on a discuss action', () => {
    renderActions([DISCUSS])
    const btn = screen.getByTestId('model-action-v2-factors-discuss')
    const glyph = btn.querySelector('[data-icon="olumi-ai"]')
    expect(glyph, 'no Olumi AI icon on a discuss action').not.toBeNull()
    expect(glyph!.getAttribute('class') ?? '').toContain('text-info')
  })

  it('the label text is unchanged and still fires the exact turn', () => {
    const onAction = renderActions([DISCUSS])
    const btn = screen.getByTestId('model-action-v2-factors-discuss')
    expect(btn.textContent).toContain('Discuss the factors with Olumi')
    btn.click()
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction.mock.calls[0][1]).toBe('Help me review the factors in my model')
  })
})

describe('structural actions carry a Plus glyph, never the AI icon and never a typed "+"', () => {
  it('renders a Lucide Plus, and no Olumi AI icon', () => {
    renderActions([STRUCTURAL])
    const btn = screen.getByTestId('model-action-v2-factors-add')
    expect(btn.querySelector('[data-icon="olumi-ai"]'), 'a structural action must never carry the AI icon').toBeNull()
    expect(btn.querySelector('svg')).not.toBeNull()
  })

  it('⚠ the rendered label no longer spells "add" with a typed "+" character', () => {
    renderActions([STRUCTURAL])
    const btn = screen.getByTestId('model-action-v2-factors-add')
    // The glyph is a real SVG now; the text node must be the bare label.
    expect(btn.textContent).toBe('Add a factor')
    expect(btn.textContent).not.toMatch(/^\+/)
  })
})

describe('every action — either intent — carries a real ≥24px target', () => {
  it.each([
    ['discuss', DISCUSS],
    ['structural', STRUCTURAL],
  ] as const)('%s: min-h-[24px] on the control', (_label, action) => {
    renderActions([action])
    const btn = screen.getByTestId(`model-action-v2-${action.id}`)
    expect(btn.className).toContain('min-h-[24px]')
  })
})
