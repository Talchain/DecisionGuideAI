/**
 * THE METHOD STRIP — one home on the Reasoning tab for the seven methods and the
 * three global actions, replacing the chip shelf AND the Actions dropdown (which
 * rendered every method twice).
 *
 * Bound by IDENTITY: catalogue ids (read from `METHOD_CATALOGUE` /
 * `GLOBAL_ACTIONS`, never retyped), test ids, and the strip's own copy
 * constants. Widths are DERIVED from the shell contract (`shellContentBudget`
 * over the dock's floor and default), never hand-typed content budgets.
 */
import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import {
  MethodStrip,
  METHOD_STRIP_COPY,
  METHOD_STRIP_ICON_IDS,
  METHOD_STRIP_RUN_SOURCE,
  methodStripLabel,
  methodsInMenuOrder,
  type MethodStripProps,
} from '../sections/MethodStrip'
import {
  GLOBAL_ACTIONS,
  METHOD_CATALOGUE,
  REVIEW_BRIEF_ASK,
  RERUN_TOASTS,
} from '../../decision-overview/actionsCatalogue'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'
import {
  registerCanonicalRunner,
  __resetCanonicalRunnerForTests,
  type CanonicalRunOptions,
} from '../../../../canvas/analysis/canonicalRunRegistry'
import { PanelWidthProvider } from '../../../../canvas/components/workspaceShell/usePanelWidth'
import { shellContentBudget } from '../../../../canvas/components/workspaceShell/shellContract'
import { DOCK_MIN_WIDTH, DOCK_RESPONSIVE_MAX_WIDTH } from '../../../../canvas/components/dockWidth'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { methodIdsRaisedBy } from '../recommendationMethod'
import { genuineDecision } from './analysisNewFixtures'
import type { Recommendation } from '../../strengthen/strengthenTypes'

const TID = 'analysis-new-method-strip'
const NARROW = DOCK_MIN_WIDTH // 280 → content 254
const WIDE = 420 // the V2 brief's wide dock → content 392

const title = (id: string) => METHOD_CATALOGUE.find((m) => m.id === id)!.title
const entry = (id: string) => METHOD_CATALOGUE.find((m) => m.id === id)!
const action = (id: string) => GLOBAL_ACTIONS.find((a) => a.id === id)!

const atWidth = (dock: number) =>
  function Wrap({ children }: { children: ReactNode }) {
    return (
      <PanelWidthProvider value={{ width: dock, contentWidth: shellContentBudget(dock) }}>
        {children}
      </PanelWidthProvider>
    )
  }

const draw = (props: Partial<MethodStripProps> = {}, dock: number | null = null) => {
  const onSelectMethod = vi.fn()
  const ui = <MethodStrip activeMethodId={null} onSelectMethod={onSelectMethod} {...props} />
  const utils = dock === null ? render(ui) : render(ui, { wrapper: atWidth(dock) })
  return { onSelectMethod, ...utils }
}

/** Ids of the icon methods, in DOM order, read from the rendered test ids. */
const iconIds = () =>
  within(screen.getByTestId(TID))
    .getAllByRole('button')
    .map((b) => b.getAttribute('data-testid') ?? '')
    .filter((t) => t.startsWith(`${TID}-method-`))
    .map((t) => t.slice(`${TID}-method-`.length))

const more = () => screen.getByTestId(`${TID}-more`)
const openMenu = () => {
  fireEvent.click(more())
  return screen.getByRole('menu')
}
const menuMethodIds = () =>
  within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((b) => b.getAttribute('data-testid') ?? '')
    .filter((t) => t.startsWith(`${TID}-menu-method-`))
    .map((t) => t.slice(`${TID}-menu-method-`.length))
const menuActionIds = () =>
  within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((b) => b.getAttribute('data-testid') ?? '')
    .filter((t) => t.startsWith(`${TID}-menu-action-`))
    .map((t) => t.slice(`${TID}-menu-action-`.length))

beforeEach(() => {
  __resetCanonicalRunnerForTests()
  useAskOlumiStore.setState({
    isOpen: false,
    context: '',
    draft: '',
    label: '',
    targetId: null,
    parameters: undefined,
    source: 'chip',
  })
})
afterEach(cleanup)

describe('PRECONDITIONS — the subjects of these rules exist', () => {
  it('every icon id is a real catalogue method, and the catalogue has methods beyond them', () => {
    const ids = METHOD_CATALOGUE.map((m) => m.id)
    for (const id of METHOD_STRIP_ICON_IDS) expect(ids).toContain(id)
    expect(ids.length).toBeGreaterThan(METHOD_STRIP_ICON_IDS.length)
    expect(GLOBAL_ACTIONS.map((a) => a.id)).toEqual(['edit_brief', 'review_inputs', 'rerun_analysis'])
  })

  it('the two widths straddle the compact threshold (derived, not hand-typed)', () => {
    expect(shellContentBudget(NARROW)).toBeLessThan(300)
    expect(shellContentBudget(WIDE)).toBeGreaterThanOrEqual(300)
    expect(shellContentBudget(DOCK_RESPONSIVE_MAX_WIDTH)).toBeGreaterThanOrEqual(300)
  })
})

describe('the strip', () => {
  it('shows the five icon methods in the prototype order, then one overflow (wide dock)', () => {
    draw({}, WIDE)
    expect(iconIds()).toEqual([
      'different_option',
      'reframe_problem',
      'consider_opposite',
      'outside_view',
      'pre_mortem',
    ])
    expect(screen.getByTestId(TID)).toHaveAttribute('data-compact', 'false')
    expect(more()).toHaveAttribute('aria-haspopup', 'menu')
    expect(more()).toHaveAttribute('aria-label', METHOD_STRIP_COPY.more)
  })

  it('outside the shell it behaves as the default dock: five icons', () => {
    draw()
    expect(iconIds()).toHaveLength(5)
  })

  /**
   * ⭐ RE-POINTED, V2 prototype (design audit B1, 25 Sep 2026): the ⋯ is "one
   * complete menu" — it lists EVERY method, the strip's icons included
   * (`methodMenu()` iterates the whole method table). What these cases pinned
   * is unchanged: no catalogue method can fall between the strip and the menu,
   * none is listed twice, and a narrow dock drops the pre-mortem icon.
   */
  it('⛔ CONTRAST — a narrow dock shows four icons; the pre-mortem stays reachable in the menu', () => {
    draw({}, NARROW)
    expect(screen.getByTestId(TID)).toHaveAttribute('data-compact', 'true')
    expect(iconIds()).toEqual(['different_option', 'reframe_problem', 'consider_opposite', 'outside_view'])
    openMenu()
    expect(menuMethodIds()).toContain('pre_mortem')
  })

  it.each([
    ['wide', WIDE],
    ['narrow', NARROW],
  ])('⭐ at a %s dock the menu lists every catalogue method exactly once, and the icons are a subset of it', (_l, dock) => {
    draw({}, dock)
    const strip = iconIds()
    openMenu()
    const menu = menuMethodIds()
    expect([...menu].sort()).toEqual(METHOD_CATALOGUE.map((m) => m.id).sort())
    expect(new Set(menu).size).toBe(menu.length)
    for (const id of strip) expect(menu).toContain(id)
  })

  it('names each icon by the catalogue title and description (tooltip = accessible name)', () => {
    draw({}, WIDE)
    for (const id of METHOD_STRIP_ICON_IDS) {
      const m = entry(id)
      expect(screen.getByTestId(`${TID}-method-${id}`)).toHaveAttribute('aria-label', `${m.title}. ${m.description}`)
    }
  })

  it('carries no heading and no paragraph', () => {
    draw({}, WIDE)
    const root = screen.getByTestId(TID)
    expect(root.querySelector('h1,h2,h3,h4,h5,h6,p')).toBeNull()
    expect(root).toHaveAttribute('role', 'group')
    expect(root).toHaveAttribute('aria-label', METHOD_STRIP_COPY.group)
  })
})

describe('selection', () => {
  it('an icon press calls onSelectMethod with the catalogue id and does NOT open the drawer', () => {
    const { onSelectMethod } = draw({}, WIDE)
    fireEvent.click(screen.getByTestId(`${TID}-method-outside_view`))
    expect(onSelectMethod).toHaveBeenCalledTimes(1)
    expect(onSelectMethod).toHaveBeenCalledWith('outside_view')
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })

  it('pressed marks exactly the active method, and a CONTRAST sibling is not pressed', () => {
    draw({ activeMethodId: 'consider_opposite' }, WIDE)
    expect(screen.getByTestId(`${TID}-method-consider_opposite`)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId(`${TID}-method-reframe_problem`)).toHaveAttribute('aria-pressed', 'false')
  })

  it('no active method → nothing pressed', () => {
    draw({}, WIDE)
    for (const id of METHOD_STRIP_ICON_IDS) {
      expect(screen.getByTestId(`${TID}-method-${id}`)).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('an overflow method calls onSelectMethod, closes the menu and does NOT open the drawer', () => {
    const { onSelectMethod } = draw({}, WIDE)
    openMenu()
    fireEvent.click(screen.getByTestId(`${TID}-menu-method-explore_tradeoffs`))
    expect(onSelectMethod).toHaveBeenCalledWith('explore_tradeoffs')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
    expect(document.activeElement).toBe(more())
  })

  it('the active overflow method is marked current in the menu; a CONTRAST sibling is not', () => {
    draw({ activeMethodId: 'review_bias' }, WIDE)
    openMenu()
    expect(screen.getByTestId(`${TID}-menu-method-review_bias`)).toHaveAttribute('aria-current', 'true')
    expect(screen.getByTestId(`${TID}-menu-method-explore_tradeoffs`)).not.toHaveAttribute('aria-current')
  })
})

describe('raised by this run', () => {
  it('marks a raised icon and names it in the label; a CONTRAST unraised icon carries neither', () => {
    draw({ raisedMethodIds: new Set(['outside_view']) }, WIDE)
    const raised = screen.getByTestId(`${TID}-method-outside_view`)
    expect(screen.getByTestId(`${TID}-method-outside_view-mark`)).toBeInTheDocument()
    expect(raised).toHaveAttribute('aria-label', methodStripLabel(entry('outside_view'), true))
    expect(raised.getAttribute('aria-label')).toContain(METHOD_STRIP_COPY.raised)
    expect(screen.queryByTestId(`${TID}-method-reframe_problem-mark`)).toBeNull()
    expect(screen.getByTestId(`${TID}-method-reframe_problem`).getAttribute('aria-label')).not.toContain(
      METHOD_STRIP_COPY.raised,
    )
    // Raised only on the strip → the overflow is not marked.
    expect(screen.queryByTestId(`${TID}-more-mark`)).toBeNull()
  })

  it('a raised overflow method marks the overflow and is named inside the menu', () => {
    draw({ raisedMethodIds: new Set(['review_bias']) }, WIDE)
    expect(screen.getByTestId(`${TID}-more-mark`)).toBeInTheDocument()
    expect(more().getAttribute('aria-label')).toContain(title('review_bias'))
    openMenu()
    expect(screen.getByTestId(`${TID}-menu-method-review_bias-raised`)).toHaveTextContent(METHOD_STRIP_COPY.raised)
    expect(screen.queryByTestId(`${TID}-menu-method-explore_tradeoffs-raised`)).toBeNull()
  })

  it('⭐ the raised pre-mortem follows itself into the overflow on a narrow dock', () => {
    draw({ raisedMethodIds: new Set(['pre_mortem']) }, NARROW)
    expect(screen.getByTestId(`${TID}-more-mark`)).toBeInTheDocument()
    openMenu()
    expect(screen.getByTestId(`${TID}-menu-method-pre_mortem-raised`)).toBeInTheDocument()
  })

  it('FROM A FIXTURE: a robustness finding on genuineDecision raises the pre-mortem through the VM', () => {
    const rec = {
      id: 'strengthen:robustness:o1',
      helpType: 'challenge',
      title: 'Pressure-test the option',
      signal: 'The ranking was fragile under perturbation.',
      whyNow: 'Small changes move the reading.',
      tryThis: 'Imagine it failed. Write down why.',
      sourceLine: 'From the robustness check.',
      action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'Pressure-test it' },
      priority: 1,
      targetId: null,
    } as unknown as Recommendation
    const vm = buildAnalysisNewViewModel({
      data: genuineDecision(),
      recommendations: [rec],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    })
    const raised = methodIdsRaisedBy(vm.strengthen.interventions)
    expect([...raised]).toEqual(['pre_mortem'])
    draw({ raisedMethodIds: raised }, WIDE)
    expect(screen.getByTestId(`${TID}-method-pre_mortem-mark`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TID}-method-outside_view-mark`)).toBeNull()
  })

  it('CONTRAST: the same fixture with no findings marks nothing', () => {
    const vm = buildAnalysisNewViewModel({
      data: genuineDecision(),
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    })
    draw({ raisedMethodIds: methodIdsRaisedBy(vm.strengthen.interventions) }, WIDE)
    expect(screen.getByTestId(TID).querySelector('[data-testid$="-mark"]')).toBeNull()
  })
})

describe('the overflow menu', () => {
  it('lists every method, a separator, then the global actions (no rerun without canRerun)', () => {
    draw({}, WIDE)
    const menu = openMenu()
    expect(more()).toHaveAttribute('aria-expanded', 'true')
    // V2: the whole catalogue, in the prototype's order (re-pointed from "the remaining methods").
    expect(menuMethodIds()).toEqual(methodsInMenuOrder().map((m) => m.id))
    expect(within(menu).getByRole('separator')).toBeInTheDocument()
    expect(menuActionIds()).toEqual(['edit_brief', 'review_inputs'])
    // Order in the DOM: the "Reasoning methods" label, the methods, then the
    // separator, then the "Model and workflow" label and the actions.
    const kids = Array.from(menu.children).map((el) =>
      el.getAttribute('role') === 'separator' ? 'sep' : (el.getAttribute('data-testid') ?? ''),
    )
    expect(kids.indexOf('sep')).toBe(1 + METHOD_CATALOGUE.length)
    expect(kids.indexOf(`${TID}-menu-label-actions`)).toBe(2 + METHOD_CATALOGUE.length)
  })

  it('⛔ CONTRAST — canRerun adds the rerun item, last', () => {
    draw({ canRerun: true }, WIDE)
    openMenu()
    expect(menuActionIds()).toEqual(['edit_brief', 'review_inputs', 'rerun_analysis'])
    expect(screen.getByTestId(`${TID}-menu-action-rerun_analysis`)).toHaveTextContent(action('rerun_analysis').title)
  })

  it('keyboard: first item focused on open, arrows rove, End jumps, Escape closes and restores focus', () => {
    draw({ canRerun: true }, WIDE)
    openMenu()
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[items.length - 1])
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(items[items.length - 1])
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(more()).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(more())
  })

  it('Tab closes without trapping; a press outside closes', () => {
    draw({}, WIDE)
    openMenu()
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(screen.queryByRole('menu')).toBeNull()
    openMenu()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('"Edit decision brief" opens the drawer with the shared review-brief ask', () => {
    draw({}, WIDE)
    openMenu()
    fireEvent.click(screen.getByTestId(`${TID}-menu-action-edit_brief`))
    const d = useAskOlumiStore.getState()
    expect(d.isOpen).toBe(true)
    expect([d.label, d.context, d.draft]).toEqual([REVIEW_BRIEF_ASK.label, REVIEW_BRIEF_ASK.context, REVIEW_BRIEF_ASK.draft])
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('"Review all inputs" opens the drawer with the catalogue\'s own draft', () => {
    draw({}, WIDE)
    openMenu()
    fireEvent.click(screen.getByTestId(`${TID}-menu-action-review_inputs`))
    const d = useAskOlumiStore.getState()
    const a = action('review_inputs')
    expect(d.isOpen).toBe(true)
    expect([d.label, d.context, d.draft]).toEqual([a.title, a.description, a.prompt])
  })

  it('rerun goes through the canonical runner (no drawer), labelled with this surface, and toasts a start', async () => {
    const runner = vi.fn(async (_opts?: CanonicalRunOptions) => ({ status: 'dispatched' as const }))
    registerCanonicalRunner(runner)
    draw({ canRerun: true }, WIDE)
    openMenu()
    fireEvent.click(screen.getByTestId(`${TID}-menu-action-rerun_analysis`))
    await vi.waitFor(() => expect(runner).toHaveBeenCalledTimes(1))
    expect(runner.mock.calls[0]![0]).toEqual({ source: METHOD_STRIP_RUN_SOURCE })
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
    expect(await screen.findByText(RERUN_TOASTS.started)).toBeInTheDocument()
  })

  it('a blocked rerun surfaces the runner\'s own reason', async () => {
    registerCanonicalRunner(async () => ({ status: 'blocked' as const, reason: 'Add a goal first' }))
    draw({ canRerun: true }, WIDE)
    openMenu()
    fireEvent.click(screen.getByTestId(`${TID}-menu-action-rerun_analysis`))
    expect(await screen.findByText('Add a goal first')).toBeInTheDocument()
  })
})
