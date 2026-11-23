import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { useRef, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../canvas/ToastContext'
import { CanvasViewportControls } from '../../../components/layout/CanvasViewportControls'
import { KebabMenu } from '../../../components/layout/KebabMenu'
import { UserAvatarMenu } from '../../../components/layout/UserAvatarMenu'
import { ActionsMenu, ACTIONS_MENU_NAME, MORE_ACTIONS } from '../../v12/actionsMenu'
import { install, uninstall } from '../../v12/edit/__tests__/harness'
import { LensesMenu } from '../../v12/lenses/LensesMenu'

const viewportHandlers = {
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onZoomReset: vi.fn(),
  onFitView: vi.fn(),
  onAutoArrange: vi.fn(),
}
const noop = () => undefined

function Bars() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  return (
    <>
      <CanvasViewportControls {...viewportHandlers} />
      <LensesMenu />
      <KebabMenu isOpen={open} onToggle={() => setOpen(!open)} onClose={() => setOpen(false)}
        onStartRename={noop} onShowKeyboardLegend={noop} onShowInfluenceExplainer={noop} menuRef={menuRef} />
      <UserAvatarMenu />
    </>
  )
}

const chatRows = {
  goal: null,
  methods: [
    { id: 'find_first', text: 'What should we find out first?', first: false, prerequisite: null, i: 0 },
  ],
  tools: ['edit_brief', 'review_inputs'] as const,
}

function ChatActions({ held = false, build = true }: { held?: boolean; build?: boolean }) {
  return <ActionsMenu menu={{ ...chatRows, tools: [...chatRows.tools] }} held={held} goal={null} onMethod={noop} onTool={noop}
    build={build ? { label: 'Build a model', title: 'Draft from the conversation so far', onPress: noop } : undefined} />
}

function renderMenus() {
  return render(
    <MemoryRouter>
      <ReactFlowProvider>
        <ToastProvider>
          <Bars />
          <ChatActions />
        </ToastProvider>
      </ReactFlowProvider>
    </MemoryRouter>,
  )
}

const openMenu = (name: string) => {
  const trigger = screen.getByRole('button', { name })
  trigger.focus()
  fireEvent.click(trigger)
  return trigger
}

beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  install()
})
afterEach(() => {
  cleanup()
  uninstall()
  vi.unstubAllEnvs()
})

describe('lane menus use the shared shell and focus contract', () => {
  it.each([
    ['More view options', 'More view options', 'menuitem'],
    ['Layers', 'Layers', 'menuitemradio'],
    ['More options', 'More options', 'menuitem'],
    ['Account menu', 'Account menu', 'menuitem'],
    [MORE_ACTIONS, ACTIONS_MENU_NAME, 'menuitem'],
  ])('%s moves real focus through the rows and returns it on Escape', (openerName, menuName, rowRole) => {
    renderMenus()
    const trigger = openMenu(openerName)
    const menu = screen.getByRole('menu', { name: menuName })
    const rows = within(menu).getAllByRole(rowRole)
    expect(menu).toHaveAttribute('data-olumi-menu')
    expect(menu).toHaveClass('p-1.5', 'bg-panel', 'shadow-2')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).not.toHaveAttribute('title')
    expect(menu.querySelector('[title]')).toBeNull()

    expect(rows[0]).toHaveFocus()
    fireEvent.keyDown(rows[0]!, { key: 'ArrowDown' })
    expect(rows[1]).toHaveFocus()
    fireEvent.keyDown(rows[1]!, { key: 'ArrowUp' })
    expect(rows[0]).toHaveFocus()
    fireEvent.keyDown(rows[0]!, { key: 'ArrowUp' })
    expect(rows.at(-1)).toHaveFocus()
    fireEvent.keyDown(rows.at(-1)!, { key: 'Home' })
    expect(rows[0]).toHaveFocus()
    fireEvent.keyDown(rows[0]!, { key: 'End' })
    expect(rows.at(-1)).toHaveFocus()
    fireEvent.keyDown(rows.at(-1)!, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('replaces the previous menu when a different opener is activated without a pointer press', () => {
    renderMenus()
    for (const [openerName, menuName] of [
      ['More view options', 'More view options'],
      ['Layers', 'Layers'],
      ['More options', 'More options'],
      ['Account menu', 'Account menu'],
      [MORE_ACTIONS, ACTIONS_MENU_NAME],
    ] as const) {
      const previous = screen.queryByRole('menu')
      if (previous) expect(previous).toBeInTheDocument()
      const trigger = openMenu(openerName)
      const menu = screen.getByRole('menu', { name: menuName })
      expect(screen.getAllByRole('menu')).toEqual([menu])
      if (previous) expect(previous).not.toBeInTheDocument()
      expect(menu).toContainElement(document.activeElement as HTMLElement)
      expect(trigger).not.toHaveFocus()
    }
    const trigger = screen.getByRole('button', { name: MORE_ACTIONS })
    fireEvent.click(trigger)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  // Paul 23 Nov: the goal is the menu's own radio row (ViewChat SessionGoal, MenuRow's DOM), held as aria-disabled.
  const goalRow = (held: boolean) => <button type="button" role="menuitemradio" aria-checked={false} data-menu-row="goal-understand" tabIndex={-1} aria-disabled={held || undefined}>Understand the situation</button>
  it('repairs chat focus if the goal row becomes held, then if the build offer disappears', async () => {
    const { rerender } = render(
      <ActionsMenu menu={{ ...chatRows, tools: [...chatRows.tools] }} held={false}
        goal={goalRow(false)} onMethod={noop} onTool={noop} />,
    )
    openMenu(MORE_ACTIONS)
    const goal = screen.getByRole('menuitemradio', { name: 'Understand the situation' })
    expect(goal).toHaveFocus()
    const build = { label: 'Build a model', title: 'Draft from the conversation so far', onPress: noop }
    rerender(<ActionsMenu menu={{ ...chatRows, tools: [...chatRows.tools] }} held={false}
      goal={goalRow(true)} onMethod={noop} onTool={noop} build={build} />)
    await waitFor(() => expect(screen.getByTestId('view-build-model')).toHaveFocus())
    rerender(<ActionsMenu menu={{ ...chatRows, tools: [...chatRows.tools] }} held={false}
      goal={goalRow(true)} onMethod={noop} onTool={noop} />)
    await waitFor(() => expect(screen.getByTestId('view-session-method')).toHaveFocus())
  })
})
