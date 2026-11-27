import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider, useStoreApi } from '@xyflow/react'
import { useLayoutEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../canvas/ToastContext'
import { CANVAS_LOD_NOTICE_TESTID } from '../../../canvas/components/CanvasLodNotice'
import { useCanvasStore } from '../../../canvas/store'
import { CanvasViewportControls } from '../../../components/layout/CanvasViewportControls'
import { LeftSidebar } from '../../../components/layout/LeftSidebar'
import { TopBar } from '../../../components/layout/TopBar'
import { AddFigure, ADD_FIGURE_WORDS } from '../../AddFigure'
import { BelowCue } from '../../BelowCue'
import { ViewLensBar } from '../../ViewLensBar'
import { ViewWhatIfKey } from '../../ViewWhatIfKey'
import { ViewZoomNotice } from '../../ViewZoomNotice'
import { VIEW_CARD } from '../../canvas'
import { useViewLens } from '../../lens'
import { UndoControl } from '../../v12/UndoControl'
import { useProposalAsk } from '../../v12/chat/proposalAsk'
import { approved, install, uninstall } from '../../v12/edit/__tests__/harness'
import { LensesMenu } from '../../v12/lenses/LensesMenu'

const shellClasses = ['rounded-md', 'border', 'border-panel-border', 'bg-panel', 'p-1', 'shadow-2']
const blueClass = /(?:text|border|ring|outline|bg)-(?:info|primary)|--info-rgb|--panel-tab-active-bg/
const selected = ['bg-panel-hover', 'ring-1', 'ring-inset', 'ring-text-header', 'text-text-header', 'font-medium']

function expectNeutralFaces(surface: HTMLElement) {
  const faces = [...surface.querySelectorAll<HTMLElement>('.toolbar-face')]
  expect(faces.length).toBeGreaterThan(0)
  expect(surface.querySelector('[title]')).toBeNull()
  for (const face of faces) {
    expect(face).toHaveClass('h-[30px]', 'min-w-[30px]', 'rounded-control', 'focus-visible:ring-offset-2')
    expect(face).toHaveAccessibleName()
  }
  for (const node of [surface, ...surface.querySelectorAll('[class]')]) {
    expect(node.getAttribute('class') ?? '').not.toMatch(blueClass)
  }
  const icons = [...surface.querySelectorAll('svg')]
  expect(icons.length).toBeGreaterThan(0)
  for (const icon of icons) {
    expect(icon).toHaveAttribute('width', '14')
    expect(icon).toHaveAttribute('height', '14')
    expect(icon).toHaveAttribute('stroke-width', '1.75')
  }
}

function expectSelected(face: HTMLElement) {
  const variants = face.className.split(' ').filter((cls) => cls.includes('[aria-'))
  for (const token of selected) expect(variants.some((cls) => cls.endsWith(`]:${token}`)), token).toBe(true)
}

function CameraSeed() {
  const api = useStoreApi()
  useLayoutEffect(() => {
    api.setState({
      nodes: [{ id: 'below', type: VIEW_CARD, position: { x: 2000, y: 700 }, data: {}, measured: { width: 100, height: 100 } }],
      width: 1232, height: 704, transform: [0, 0, 1],
    })
  }, [api])
  return null
}

const handlers = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onZoomReset: vi.fn(), onFitView: vi.fn(), onAutoArrange: vi.fn() }

beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  const view = approved()
  install({ ...view, proposal: { id: 9 } as typeof view.proposal,
    model: { ...view.model!, edit_base: null, cards: view.model!.cards.map((card) => ({ ...card, driver: null })) } })
})

afterEach(() => {
  cleanup()
  uninstall()
  useViewLens.setState({ lens: 'full' })
  useCanvasStore.setState({ lodRung: 'full' })
  useProposalAsk.setState(useProposalAsk.getInitialState())
  vi.unstubAllEnvs()
})

describe('the compact floating toolbar recipe', () => {
  it('renders the scenario bar and six radios with neutral shells, registry glyphs, and the selected ring', async () => {
    render(<MemoryRouter><ToastProvider><TopBar scenarioTitle="Support capacity" onTitleChange={vi.fn()} /><ViewLensBar /></ToastProvider></MemoryRouter>)
    const banner = screen.getByRole('banner')
    const lenses = screen.getByTestId('lens-bar')
    for (const surface of [banner, lenses]) {
      expect(surface).toHaveClass(...shellClasses)
      expectNeutralFaces(surface)
    }
    expect(screen.getByTestId('topbar-share-core')).toHaveClass('font-medium')

    const selectedLens = screen.getByTestId('lens-bar-full')
    expect(selectedLens).toHaveAttribute('aria-checked', 'true')
    expectSelected(selectedLens)
    const premortem = screen.getByTestId('lens-bar-premortem')
    fireEvent.click(premortem)
    fireEvent.keyDown(premortem, { key: 'ArrowRight' })
    const held = screen.getByTestId('lens-bar-what_changes')
    expect(held).toHaveFocus()
    expect(held).toHaveAttribute('aria-disabled', 'true')
    expect(premortem).toHaveAttribute('aria-checked', 'true')
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Run the analysis to see what would change it.')
    fireEvent.keyDown(held, { key: 'ArrowRight' })
    expect(screen.getByTestId('lens-bar-what_if')).toHaveAttribute('aria-checked', 'true')
  })

  it('gives each rail one Tab stop, includes held Add in the arrow keys, and keeps More menu focus entry', async () => {
    render(<ToastProvider><ReactFlowProvider>
      <LeftSidebar addControl={<AddFigure />} undoControl={<UndoControl />} layers={<LensesMenu />} />
      <CanvasViewportControls {...handlers} />
    </ReactFlowProvider></ToastProvider>)
    const left = screen.getByRole('toolbar', { name: 'Canvas tools' })
    const zoom = screen.getByRole('toolbar', { name: 'Viewport controls' })
    for (const surface of [left, zoom]) {
      expect(surface).toHaveClass(...shellClasses, 'flex-col')
      expect(surface).toHaveAttribute('aria-orientation', 'vertical')
      expectNeutralFaces(surface)
      expect(surface.querySelectorAll('button[tabindex="0"]')).toHaveLength(1)
    }
    const add = screen.getByTestId('canvas-add-to-model-held')
    expect(add).not.toHaveAttribute('aria-disabled')
    expect(add).not.toBeDisabled()
    expect(add.tabIndex).toBe(0)
    act(() => add.focus())
    expect(await screen.findByRole('tooltip')).toHaveTextContent(ADD_FIGURE_WORDS.heldProposal)
    fireEvent.click(add)
    expect(useProposalAsk.getState()).toEqual({ id: 9, n: 1 })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.keyDown(add, { key: 'ArrowDown' })
    const select = screen.getByRole('button', { name: 'Select mode' })
    expect(select).toHaveFocus()
    expect(select).toHaveAttribute('aria-pressed', 'true')
    expectSelected(select)

    const zoomOut = within(zoom).getByRole('button', { name: 'Zoom out' })
    act(() => zoomOut.focus())
    fireEvent.keyDown(zoomOut, { key: 'End' })
    const more = within(zoom).getByRole('button', { name: 'More view options' })
    expect(more).toHaveFocus()
    fireEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expectSelected(more)
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem')[0]).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(more).toHaveFocus()
    fireEvent.keyDown(more, { key: 'Home' })
    expect(zoomOut).toHaveFocus()
  })

  it('draws both directional cues in one shell and the zoom notice in its own matching shell', () => {
    useCanvasStore.setState({ lodRung: 'line' })
    render(<ReactFlowProvider><CameraSeed /><BelowCue /><ViewZoomNotice /></ReactFlowProvider>)
    const cue = screen.getByTestId('view-below-cue')
    const notice = screen.getByTestId(CANVAS_LOD_NOTICE_TESTID)
    for (const surface of [cue, notice]) {
      expect(surface).toHaveClass(...shellClasses)
      expectNeutralFaces(surface)
    }
    expect(within(cue).getAllByRole('button')).toHaveLength(2)
    expect(notice).toHaveTextContent('Zoomed out, showing less on each card')
  })

  it('keeps Proposed and the focusable, explained Keep it face in the What if tray', async () => {
    useViewLens.setState({ lens: 'what_if' })
    render(<ViewWhatIfKey />)
    const tray = screen.getByTestId('view-whatif-key')
    const actions = within(tray).getByTestId('view-whatif-bar')
    expect(tray).toHaveClass('ok-float')
    expect(actions).not.toHaveClass('bg-panel')
    expectNeutralFaces(tray)
    const keep = within(actions).getByRole('button', { name: 'Keep it' })
    expect(keep).toHaveAttribute('aria-disabled', 'true')
    expect(keep).toHaveClass('bg-success')
    act(() => keep.focus())
    expect(keep).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Try a value first')
  })
})
