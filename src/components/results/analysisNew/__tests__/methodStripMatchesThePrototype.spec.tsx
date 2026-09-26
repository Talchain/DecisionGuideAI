/**
 * B1 — THE METHOD STRIP AGAINST THE V2 PROTOTYPE (design audit 25 Sep 2026,
 * `Olumi_Reasoning_Prototype_V2.html` sha256 817be21a…, `methodsHTML` /
 * `menuHTML` / `methodMenu`).
 *
 * What the prototype renders and the live strip did not:
 *   · the ⋯ is "All methods and actions", and its menu is ONE COMPLETE MENU
 *     (the prototype's own guide: "One toolbar and one complete menu") — a
 *     "Reasoning methods" label over EVERY method, a separator, then a "Model
 *     and workflow" label over the actions;
 *   · every menu row is an icon plus a name — no subtitle;
 *   · the active method carries the ring AND the dot (`.iconbtn.active:after`);
 *   · "Consider the opposite" is the down-then-up arrow pair (`paths.opposite`
 *     = lucide `arrow-down-up`), not `arrow-up-down`;
 *   · the strip's circles are 36px (35px in a ≤320px panel), not 28px.
 *
 * Bound by IDENTITY: catalogue ids read from `METHOD_CATALOGUE` /
 * `GLOBAL_ACTIONS`, test ids, and the prototype's exact labels.
 */
import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { MethodStrip, METHOD_STRIP_ICON_IDS, type MethodStripProps } from '../sections/MethodStrip'
import { GLOBAL_ACTIONS, METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import { PanelWidthProvider } from '../../../../canvas/components/workspaceShell/usePanelWidth'
import { shellContentBudget } from '../../../../canvas/components/workspaceShell/shellContract'
import { DOCK_MIN_WIDTH } from '../../../../canvas/components/dockWidth'

const TID = 'analysis-new-method-strip'
/** The prototype's `methods` table order (alternatives · frame · opposite · outside · premortem · bias · trade). */
const PROTOTYPE_MENU_ORDER = [
  'different_option',
  'reframe_problem',
  'consider_opposite',
  'outside_view',
  'pre_mortem',
  'review_bias',
  'explore_tradeoffs',
] as const
const NARROW = DOCK_MIN_WIDTH
const WIDE = 420

const atWidth = (dock: number) =>
  function Wrap({ children }: { children: ReactNode }) {
    return (
      <PanelWidthProvider value={{ width: dock, contentWidth: shellContentBudget(dock) }}>
        {children}
      </PanelWidthProvider>
    )
  }

const draw = (props: Partial<MethodStripProps> = {}, dock = WIDE) =>
  render(<MethodStrip activeMethodId={null} onSelectMethod={vi.fn()} {...props} />, { wrapper: atWidth(dock) })

const openMenu = () => {
  fireEvent.click(screen.getByTestId(`${TID}-more`))
  return screen.getByTestId(`${TID}-menu`)
}
const menuMethodIds = () =>
  within(screen.getByTestId(`${TID}-menu`))
    .getAllByRole('menuitem')
    .map((b) => b.getAttribute('data-testid') ?? '')
    .filter((t) => t.startsWith(`${TID}-menu-method-`))
    .map((t) => t.slice(`${TID}-menu-method-`.length))

afterEach(cleanup)

describe('B1 — the ⋯ is the prototype\'s ONE complete menu', () => {
  it('is named "All methods and actions"', () => {
    draw()
    expect(screen.getByTestId(`${TID}-more`)).toHaveAttribute('aria-label', 'All methods and actions')
  })

  it.each([
    ['wide', WIDE],
    ['narrow', NARROW],
  ])('⭐ at a %s dock the menu lists EVERY catalogue method, in the prototype\'s order', (_l, dock) => {
    // PRECONDITION: the catalogue holds exactly the prototype's seven, so the
    // literal order below covers all of it (a new method would RED here first).
    expect(METHOD_CATALOGUE.map((m) => m.id).sort()).toEqual([...PROTOTYPE_MENU_ORDER].sort())
    draw({}, dock)
    openMenu()
    expect(menuMethodIds()).toEqual([...PROTOTYPE_MENU_ORDER])
  })

  it('⛔ CONTRAST — the strip itself still shows only its five (four when narrow) icons', () => {
    draw({}, WIDE)
    const icons = METHOD_STRIP_ICON_IDS.filter((id) => screen.queryByTestId(`${TID}-method-${id}`) !== null)
    expect(icons).toEqual([...METHOD_STRIP_ICON_IDS])
    cleanup()
    draw({}, NARROW)
    expect(screen.queryByTestId(`${TID}-method-pre_mortem`)).toBeNull()
  })

  it('groups: "Reasoning methods" label, the methods, a separator, "Model and workflow" label, the actions', () => {
    draw({ canRerun: true })
    const menu = openMenu()
    const kids = Array.from(menu.children).map((el) => {
      if (el.getAttribute('role') === 'separator') return 'sep'
      const t = el.getAttribute('data-testid') ?? ''
      if (t === `${TID}-menu-label-methods` || t === `${TID}-menu-label-actions`) return `label:${el.textContent}`
      return t.startsWith(`${TID}-menu-method-`) ? 'method' : t.startsWith(`${TID}-menu-action-`) ? 'action' : `?${t}`
    })
    expect(kids).toEqual([
      'label:Reasoning methods',
      ...METHOD_CATALOGUE.map(() => 'method'),
      'sep',
      'label:Model and workflow',
      ...GLOBAL_ACTIONS.map(() => 'action'),
    ])
    // The labels name groups; they are not items a keyboard lands on.
    expect(within(menu).getByTestId(`${TID}-menu-label-methods`)).not.toHaveAttribute('role', 'menuitem')
  })

  it('every row is an icon plus the name — no subtitle (CONTRAST: the catalogue does carry descriptions)', () => {
    draw({ canRerun: true })
    openMenu()
    for (const m of METHOD_CATALOGUE) {
      const row = screen.getByTestId(`${TID}-menu-method-${m.id}`)
      expect(row.querySelectorAll('svg')).toHaveLength(1)
      expect(row.textContent).toBe(m.title)
      expect(m.description.length, 'PRECONDITION: a description exists to be dropped').toBeGreaterThan(0)
      expect(row.textContent).not.toContain(m.description)
    }
    for (const a of GLOBAL_ACTIONS) {
      const row = screen.getByTestId(`${TID}-menu-action-${a.id}`)
      expect(row.querySelectorAll('svg')).toHaveLength(1)
      expect(row.textContent).toBe(a.title)
      expect(row.textContent).not.toContain(a.description)
    }
  })

  it('the current method is marked in the menu by colour AND aria-current; a CONTRAST sibling is neither', () => {
    draw({ activeMethodId: 'reframe_problem' })
    openMenu()
    const current = screen.getByTestId(`${TID}-menu-method-reframe_problem`)
    expect(current).toHaveAttribute('aria-current', 'true')
    expect(current.className).toMatch(/\btext-info\b/)
    const other = screen.getByTestId(`${TID}-menu-method-outside_view`)
    expect(other).not.toHaveAttribute('aria-current')
    expect(other.className).not.toMatch(/\btext-info\b/)
  })

  it('a raised method keeps its "raised" note in the menu, as a dot plus screen-reader text, not a visible subtitle', () => {
    draw({ raisedMethodIds: new Set(['review_bias']) })
    openMenu()
    const note = screen.getByTestId(`${TID}-menu-method-review_bias-raised`)
    expect(note.className).toMatch(/\bsr-only\b/)
    expect(screen.getByTestId(`${TID}-menu-method-review_bias-dot`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TID}-menu-method-explore_tradeoffs-dot`)).toBeNull()
  })
})

describe('B1 — the strip itself', () => {
  it('⭐ the ACTIVE method carries the ring AND the dot, even when the run did not raise it', () => {
    draw({ activeMethodId: 'reframe_problem' })
    const active = screen.getByTestId(`${TID}-method-reframe_problem`)
    expect(active).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId(`${TID}-method-reframe_problem-mark`)).toBeInTheDocument()
    // CONTRAST: an inactive, unraised sibling has neither.
    expect(screen.getByTestId(`${TID}-method-outside_view`)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId(`${TID}-method-outside_view-mark`)).toBeNull()
  })

  it('"Consider the opposite" is the prototype\'s down-up arrows; CONTRAST: no icon on the strip is up-down', () => {
    draw()
    const svg = screen.getByTestId(`${TID}-method-consider_opposite`).querySelector('svg')
    expect(svg?.getAttribute('class') ?? '').toContain('lucide-arrow-down-up')
    expect(screen.getByTestId(TID).querySelector('.lucide-arrow-up-down')).toBeNull()
  })

  it('the circles are the prototype\'s 36px, and 35px in a narrow panel', () => {
    draw({}, WIDE)
    for (const id of METHOD_STRIP_ICON_IDS) expect(screen.getByTestId(`${TID}-method-${id}`).className).toMatch(/\bsize-9\b/)
    expect(screen.getByTestId(`${TID}-more`).className).toMatch(/\bsize-9\b/)
    cleanup()
    draw({}, NARROW)
    expect(screen.getByTestId(`${TID}-method-different_option`).className).toMatch(/\bsize-\[35px\]/)
    expect(screen.getByTestId(`${TID}-method-different_option`).className).not.toMatch(/\bsize-9\b/)
  })
})
