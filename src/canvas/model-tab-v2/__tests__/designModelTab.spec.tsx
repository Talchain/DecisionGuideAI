/**
 * Panel design audit 25 Sep — bundle b4-model-tab ("Model tab").
 *
 * Pins the presentation this bundle's build brought the Model tab to, by
 * IDENTITY (a `data-testid` plus the exact token/class or structure), so a
 * revert of any one hunk REDs here rather than silently regressing. Each
 * `describe` names the gap id from `bundle-b4-model-tab.json`.
 *
 * What this file does NOT re-assert: truth content (provenance meaning, the
 * edit control's presence, unit/value correctness) already pinned elsewhere
 * (`inputsStayAtMinimumSize.spec.ts`, `renameIsKeyboardReachable.spec.tsx`,
 * `valueProvenance.spec.ts`). This file is presentation-only.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { typography } from '../../../styles/typography'
import { ModelRowView } from '../ModelRowView'
import { ModelOutline } from '../ModelOutline'
import { VALUE_PROVENANCE_LABEL } from '../../domain/valueProvenance'
import type { ModelRow } from '../types'

vi.mock('../../store', () => ({ useCanvasStore: (sel: (s: unknown) => unknown) => sel({ nodes: [] }) }))

afterEach(cleanup)

function row(over: Partial<ModelRow> & Pick<ModelRow, 'id'>): ModelRow {
  return {
    kind: 'factor',
    group: 'factors',
    label: `Label ${over.id}`,
    primaryValue: '45 days',
    provenanceSource: 'user',
    attention: [],
    editable: true,
    ...over,
  }
}

describe('MODEL-2 — the row rename act is an icon, not a clipped blue word', () => {
  it('rename-start is a button holding a Pencil svg, not the word "Rename"', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" onRenameRow={vi.fn()} />)
    const btn = screen.getByTestId('model-row-v2-f1-rename-start')
    expect(btn.textContent?.trim()).toBe('')
    expect(btn.querySelector('svg.lucide-pencil')).not.toBeNull()
  })

  it('carries no buttonSmall/underline classes — DS token panelBody-sized icon button, 24px floor', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" onRenameRow={vi.fn()} />)
    const btn = screen.getByTestId('model-row-v2-f1-rename-start')
    expect(btn.className).not.toMatch(/underline|decoration-dotted/)
    expect(btn.className).toMatch(/\bw-6\b/)
    expect(btn.className).toMatch(/\bh-6\b/)
    expect(btn.className).toMatch(/rounded-full/)
  })

  it('keeps its accessible name and title — the edit control stays reachable', () => {
    render(<ModelRowView row={row({ id: 'f1', label: 'Onboarding load' })} tier="plain" onRenameRow={vi.fn()} />)
    const btn = screen.getByTestId('model-row-v2-f1-rename-start')
    expect(btn.getAttribute('aria-label')).toBe('Rename Onboarding load')
    expect(btn.getAttribute('title')).toBe('Rename this element')
  })
})

describe('TYPE-11 / MODEL-2 — Confirm-as-is drops to panelBody, no underline', () => {
  it('confirm-as-is is panelBody (12px/400), not buttonSmall (12px/600), and carries no underline', () => {
    render(
      <ModelRowView
        row={row({ id: 'f1', attention: ['unconfirmed-estimate'] })}
        tier="plain"
        onConfirmValueAsIs={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('model-row-v2-f1-confirm-as-is')
    const bodyTokens = typography.panelBody.split(' ')
    for (const t of bodyTokens) expect(btn.className).toMatch(new RegExp(`(^|\\s)${t}(\\s|$)`))
    expect(btn.className).not.toMatch(/underline|decoration-dotted/)
    expect(btn.className).toMatch(/min-h-\[24px\]/)
  })
})

describe('MODEL-3 — group toggles are panelBody with a kind mark, not a second title', () => {
  const ALL_GROUPS = ['goal', 'options', 'factors', 'outcomes-risks', 'relationships'] as const

  it('the factors toggle is panelBody (12px/400), not panelHeader (14px/600)', () => {
    render(
      <ModelOutline
        rows={[row({ id: 'f1' })]}
        tier="plain"
        filter=""
        initiallyClosedGroups={ALL_GROUPS}
      />,
    )
    const toggle = screen.getByTestId('model-group-v2-factors-toggle')
    // panelHeader-only tokens (14px/600) must be absent; font-sans is shared
    // with panelBody so it is not a discriminator.
    expect(toggle.className).not.toMatch(/(^|\s)text-sm(\s|$)/)
    expect(toggle.className).not.toMatch(/(^|\s)font-semibold(\s|$)/)
    expect(toggle.className).not.toMatch(/(^|\s)leading-snug(\s|$)/)
    // panelBody tokens (12px/400) must be present.
    expect(toggle.className).toMatch(/(^|\s)text-xs(\s|$)/)
    expect(toggle.className).toMatch(/(^|\s)leading-relaxed(\s|$)/)
  })

  it('the factors toggle carries a factor shape mark (a circle, matching NodeShapeIndicator)', () => {
    render(
      <ModelOutline
        rows={[row({ id: 'f1' })]}
        tier="plain"
        filter=""
        initiallyClosedGroups={ALL_GROUPS}
      />,
    )
    const toggle = screen.getByTestId('model-group-v2-factors-toggle')
    expect(toggle.querySelector('svg circle')).not.toBeNull()
  })

  it('the options toggle carries an option shape mark (a square, not a circle)', () => {
    render(
      <ModelOutline
        rows={[row({ id: 'o1', kind: 'option', group: 'options' })]}
        tier="plain"
        filter=""
        initiallyClosedGroups={ALL_GROUPS}
      />,
    )
    const toggle = screen.getByTestId('model-group-v2-options-toggle')
    expect(toggle.querySelector('svg rect')).not.toBeNull()
    expect(toggle.querySelector('svg circle')).toBeNull()
  })

  it('the relationships toggle keeps its own arrow glyph, aria-hidden, with no node shape', () => {
    render(
      <ModelOutline
        rows={[row({ id: 'f1' })]}
        tier="plain"
        filter=""
        initiallyClosedGroups={ALL_GROUPS}
      />,
    )
    const toggle = screen.getByTestId('model-group-v2-relationships-toggle')
    // The chevron is its own svg; a node SHAPE mark (circle/rect/polygon) must
    // be absent — relationships is an edge, not a node.
    expect(toggle.querySelector('svg circle, svg rect, svg polygon')).toBeNull()
    expect(toggle.textContent).toContain('→')
  })

  it('the toggle keeps its own accessible name — a shape mark changes nothing a screen reader announces', () => {
    render(
      <ModelOutline
        rows={[row({ id: 'f1' })]}
        tier="plain"
        filter=""
        initiallyClosedGroups={ALL_GROUPS}
      />,
    )
    const toggle = screen.getByTestId('model-group-v2-factors-toggle')
    expect(toggle.getAttribute('aria-label')).toMatch(/^Factors, /)
  })
})

describe('MODEL-9 — a selected row is an outline, never a 1.03:1 fill', () => {
  it('selected renders ring-1 ring-inset ring-info and carries no bg-panel-hover fill', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" selected />)
    const li = screen.getByTestId('model-row-v2-f1')
    expect(li.className).toMatch(/ring-1/)
    expect(li.className).toMatch(/ring-inset/)
    expect(li.className).toMatch(/ring-info/)
    expect(li.className).not.toMatch(/bg-panel-hover/)
  })

  it('unselected carries neither the ring nor the old fill', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" selected={false} />)
    const li = screen.getByTestId('model-row-v2-f1')
    expect(li.className).not.toMatch(/ring-info/)
    expect(li.className).not.toMatch(/bg-panel-hover/)
  })
})

describe('MODEL-11 — one name for the fact: "Olumi estimate", never "AI estimate"', () => {
  it('VALUE_PROVENANCE_LABEL.ai reads "Olumi estimate"', () => {
    expect(VALUE_PROVENANCE_LABEL.ai).toBe('Olumi estimate')
  })

  it('the rename is keyed to the ai kind only — every other kind is untouched', () => {
    expect(VALUE_PROVENANCE_LABEL.brief).toBe('From brief')
    expect(VALUE_PROVENANCE_LABEL.human).toBe('Set by you')
    expect(VALUE_PROVENANCE_LABEL.assumption).toBe('Your assumption')
    expect(VALUE_PROVENANCE_LABEL.confirmed).toBe('Confirmed by you')
    expect(VALUE_PROVENANCE_LABEL.edited).toBe('User edited')
  })

  it('no map entry says "AI" — the rename was not a partial find/replace', () => {
    for (const label of Object.values(VALUE_PROVENANCE_LABEL)) {
      expect(label).not.toMatch(/\bAI\b/)
    }
  })
})
