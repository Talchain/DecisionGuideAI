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
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { typography } from '../../../styles/typography'
import { ModelRowView } from '../ModelRowView'
import { ModelOutline } from '../ModelOutline'
import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { ModelFooter } from '../../components/model-tab/ModelFooter'
import { ModelHealthSection } from '../../components/model-tab/ModelHealthSection'
import { ModelGroupActions } from '../ModelGroupActions'
import { VALUE_PROVENANCE_LABEL } from '../../domain/valueProvenance'
import type { ModelRow, EditCommitState } from '../types'

vi.mock('../../store', () => ({ useCanvasStore: (sel: (s: unknown) => unknown) => sel({ nodes: [] }) }))
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }
})
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

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

describe('MODEL-6 — the key moves to the filter row; tier arms are panelBody at 28px', () => {
  function renderPanel() {
    render(<ModelTabV2Panel nodes={[]} edges={[]} goalThreshold={null} />)
  }

  it('the key toggle shares a parent with the filter input, not with the title', () => {
    renderPanel()
    const filterInput = screen.getByTestId('model-tab-v2-filter')
    const keyToggle = screen.getByTestId('model-tab-v2-provenance-key-toggle')
    const heading = screen.getByText('Model outline')
    expect(keyToggle.parentElement?.parentElement).toBe(filterInput.parentElement)
    expect(keyToggle.parentElement?.parentElement).not.toBe(heading.parentElement)
  })

  it('tier arms are panelBody (12px/400) at min-h-[28px], not buttonSmall at 24px', () => {
    renderPanel()
    const plain = screen.getByTestId('model-tab-v2-tier-plain')
    const bodyTokens = typography.panelBody.split(' ')
    for (const t of bodyTokens) expect(plain.className).toMatch(new RegExp(`(^|\\s)${t}(\\s|$)`))
    expect(plain.className).toMatch(/min-h-\[28px\]/)
    expect(plain.className).not.toMatch(/min-h-\[24px\]/)
  })

  it('the filter row is the positioned (relative) ancestor for the key popover', () => {
    renderPanel()
    const filterInput = screen.getByTestId('model-tab-v2-filter')
    const filterRow = filterInput.parentElement as HTMLElement
    expect(filterRow.className).toMatch(/(^|\s)relative(\s|$)/)
  })
})

describe('NARROW-7 — the provenance-key popover is never clipped at 280px', () => {
  function renderPanel() {
    render(<ModelTabV2Panel nodes={[]} edges={[]} goalThreshold={null} />)
  }

  it('the key wrapper itself is no longer the positioned ancestor', () => {
    renderPanel()
    const keyToggle = screen.getByTestId('model-tab-v2-provenance-key-toggle')
    expect(keyToggle.parentElement?.className).not.toMatch(/(^|\s)relative(\s|$)/)
  })

  it('the trigger clears the 24px target floor (28px circle, not a 22px square)', () => {
    renderPanel()
    const keyToggle = screen.getByTestId('model-tab-v2-provenance-key-toggle')
    expect(keyToggle.className).toMatch(/\bw-7\b/)
    expect(keyToggle.className).toMatch(/\bh-7\b/)
    expect(keyToggle.className).toMatch(/rounded-full/)
    expect(keyToggle.className).not.toMatch(/\bp-1\b/)
  })

  it('the open popover carries max-w-full, so it can never overflow its ancestor', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId('model-tab-v2-provenance-key-toggle'))
    const popover = screen.getByTestId('model-tab-v2-provenance-key')
    expect(popover.className).toMatch(/(^|\s)max-w-full(\s|$)/)
  })
})

describe('MODEL-12 — the Text/JSON footer acts are textbuttons, not 11px bordered squares', () => {
  it('Text and JSON carry text-info + panelBody with no border and no fill', () => {
    render(<ModelFooter onCopyText={vi.fn()} onCopyJson={vi.fn()} />)
    const bodyTokens = typography.panelBody.split(' ')
    for (const testId of ['model-copy', 'model-copy-json']) {
      const btn = screen.getByTestId(testId)
      for (const t of bodyTokens) expect(btn.className).toMatch(new RegExp(`(^|\\s)${t}(\\s|$)`))
      expect(btn.className).toMatch(/(^|\s)text-info(\s|$)/)
      expect(btn.className).not.toMatch(/(^|\s)border(\s|$)/)
      expect(btn.className).not.toMatch(/border-panel-border/)
      expect(btn.className).toMatch(/min-h-\[28px\]/)
    }
  })

  it('keeps the Copy/ClipboardCopy icons and testids', () => {
    render(<ModelFooter onCopyText={vi.fn()} onCopyJson={vi.fn()} />)
    expect(screen.getByTestId('model-copy').querySelector('svg')).not.toBeNull()
    expect(screen.getByTestId('model-copy-json').querySelector('svg')).not.toBeNull()
  })
})

describe('MODEL-5 — edit fields sit on a real field ground; Confirm/Discard are pills, not 18px chips', () => {
  it('the rename input carries bg-panel + border-field, never the tinted bg-panel-hover ground', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" onRenameRow={vi.fn()} />)
    // Enter rename mode via double-click, matching the row's own gesture.
    const label = screen.getByTestId('model-row-v2-f1-label')
    fireEvent.doubleClick(label)
    const input = screen.getByTestId('model-row-v2-f1-rename')
    expect(input.className).toMatch(/(^|\s)bg-panel(\s|$)/)
    expect(input.className).toMatch(/border-field/)
    expect(input.className).not.toMatch(/bg-panel-hover/)
    expect(input.className).not.toMatch(/border-panel-border/)
  })

  it('the proposed-state Confirm chip is a filled primary pill, not an 18px bordered square', () => {
    const commit: EditCommitState = { phase: 'proposed', from: '45 days', to: '60 days' }
    render(
      <ModelRowView
        row={row({ id: 'f1' })}
        tier="plain"
        commit={commit}
        onConfirmEdit={vi.fn()}
        onDiscardEdit={vi.fn()}
      />,
    )
    const confirm = screen.getByTestId('model-row-v2-f1-confirm')
    expect(confirm.className).toMatch(/(^|\s)rounded-full(\s|$)/)
    expect(confirm.className).toMatch(/(^|\s)bg-primary(\s|$)/)
    expect(confirm.className).toMatch(/text-text-on-color/)
    expect(confirm.className).not.toMatch(/(^|\s)border(\s|$)/)
    expect(confirm.className).not.toMatch(/py-0\.5/)
  })

  it('the proposed-state Discard chip has no border — a text act, not a chip', () => {
    const commit: EditCommitState = { phase: 'proposed', from: '45 days', to: '60 days' }
    render(
      <ModelRowView
        row={row({ id: 'f1' })}
        tier="plain"
        commit={commit}
        onConfirmEdit={vi.fn()}
        onDiscardEdit={vi.fn()}
      />,
    )
    const discard = screen.getByTestId('model-row-v2-f1-discard')
    expect(discard.className).toMatch(/(^|\s)text-info(\s|$)/)
    expect(discard.className).not.toMatch(/(^|\s)border(\s|$)/)
    expect(discard.className).not.toMatch(/border-panel-border/)
  })
})

describe('MODEL-1 — idle rows are two lines, not one truncated line; no horizontal scroll at 280', () => {
  it('the idle label breaks words instead of truncating', () => {
    render(<ModelRowView row={row({ id: 'f1', label: 'A very much longer label that would otherwise be cut at 96px' })} tier="plain" />)
    const label = screen.getByTestId('model-row-v2-f1-label')
    expect(label.className).toMatch(/(^|\s)break-words(\s|$)/)
    expect(label.className).not.toMatch(/(^|\s)truncate(\s|$)/)
  })

  it('the label (line 1) and the value+meta group (line 2) sit on different grid rows', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" />)
    const li = screen.getByTestId('model-row-v2-f1')
    const identity = li.children[1]
    const line2 = li.children[2]
    expect(identity.className).toMatch(/(^|\s)row-start-1(\s|$)/)
    expect(line2.className).toMatch(/(^|\s)row-start-2(\s|$)/)
  })

  it('the row no longer carries a per-row border — the prototype has no rule between rows', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" />)
    const li = screen.getByTestId('model-row-v2-f1')
    expect(li.className).not.toMatch(/(^|\s)border-b(\s|$)/)
  })

  it('the value cell still keeps its 23px reserved edit height — entering edit does not reflow', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" onBeginEdit={vi.fn()} />)
    const value = screen.getByTestId('model-row-v2-f1-value')
    expect(value.className).toMatch(/min-h-\[23px\]/)
  })

  it('the edit control (rename) stays reachable on the idle row — restyled, never removed', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" onRenameRow={vi.fn()} />)
    expect(screen.getByTestId('model-row-v2-f1-rename-start')).toBeInTheDocument()
  })

  it('at a 280px container the outline body never scrolls sideways', () => {
    // ⚠ jsdom performs no layout — scrollWidth and clientWidth both read 0
    // here regardless of markup, so this assertion is necessarily trivial in
    // this environment. It is added because the build instructions require
    // it as the DOM-level acceptance check; the load-bearing verification of
    // "no horizontal scroll at 280" is the real-browser Playwright geometry
    // measure (`e2e/geometry/dockContent.measure.ts`,
    // `modelRowCellOverlap.measure.ts`), which this PR does not itself run.
    const { container } = render(
      <div style={{ width: '280px' }}>
        <ModelOutline rows={[row({ id: 'f1', label: 'A very much longer label that would otherwise be cut at 96px' })]} tier="plain" filter="" />
      </div>,
    )
    const body = container.firstElementChild as HTMLElement
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth)
  })
})

describe('MODEL-7 — one left edge, not five', () => {
  it('the group heading row hangs its inset (-mx-2) but keeps px-2 for the count census', () => {
    render(
      <ModelOutline
        rows={[row({ id: 'f1' })]}
        tier="plain"
        filter=""
        initiallyClosedGroups={['goal', 'options', 'outcomes-risks', 'relationships']}
      />,
    )
    const heading = screen.getByTestId('model-group-heading-v2-factors')
    expect(heading.className).toMatch(/(^|\s)-mx-2(\s|$)/)
    expect(heading.className).toMatch(/(^|\s)px-2(\s|$)/)
  })

  it('group actions no longer carry their own +16 gutter', () => {
    render(
      <ModelGroupActions
        groupId="factors"
        actions={[
          {
            id: 'factors-add',
            label: 'Add a factor',
            intent: 'structural',
            message: () => 'I want to add a new factor to the model',
            rehomedFrom: 'FactorsSection.tsx:737',
          },
        ]}
        context={{ goalLabel: 'Grow ARR', goalTarget: '45%' }}
        onAction={vi.fn()}
      />,
    )
    const wrap = screen.getByTestId('model-group-v2-factors-actions')
    expect(wrap.className).not.toMatch(/px-4/)
    expect(wrap.className).toMatch(/(^|\s)px-0(\s|$)/)
  })
})

describe('MODEL-4 — the Model card never opens onto an empty body; the ask stays reachable shut', () => {
  it('with only a quality score (plain mode) the card does NOT force itself open', () => {
    render(<ModelHealthSection ceeQuality={{ overall: 7.2 }} onHandOffToOlumi={vi.fn()} />)
    const header = screen.getByRole('button', { name: 'Model card' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
  })

  it('the header ask is reachable while the card is closed', () => {
    render(<ModelHealthSection ceeQuality={{ overall: 7.2 }} onHandOffToOlumi={vi.fn()} />)
    const header = screen.getByRole('button', { name: 'Model card' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    const discuss = screen.getByTestId('modelcard-discuss')
    expect(discuss).toBeVisible()
    // The ask is a SIBLING of the toggle, not nested inside the collapsible
    // (inert-when-closed) region — a button cannot contain another button,
    // and nesting it inside the body would make it unreachable exactly when
    // this test needs it reachable.
    expect(discuss.closest('[aria-hidden="true"]')).toBeNull()
  })

  it('with no hand-off, the header carries no action slot at all', () => {
    render(<ModelHealthSection ceeQuality={{ overall: 7.2 }} />)
    expect(screen.queryByTestId('modelcard-discuss')).toBeNull()
  })
})
