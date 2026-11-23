import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReactFlowProvider, useStoreApi } from '@xyflow/react'
import { useLayoutEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CANVAS_LOD_NOTICE_ACTION, CANVAS_LOD_NOTICE_TESTID } from '../../../canvas/components/CanvasLodNotice'
import { useCanvasStore } from '../../../canvas/store'
import { VIEW_CARD } from '../../canvas'
import { useViewLens } from '../../lens'
import { FOOT_CONTROLS, LENS_KEYS } from '../../regions'
import { install, uninstall } from '../../v12/edit/__tests__/harness'
import { FootRow } from '../FootRow'

const GAP = 8
const RAIL_RIGHT = 53
const DOCK_WIDTH = 360
const CUE_WIDTH = 220
const NOTICE_WIDTH = 366
const ICON_WIDTH = 40
const BAR_HEIGHT = 40
const TRAY_HEIGHT = 160
const rect = (left: number, top: number, width: number, height: number) => new DOMRect(left, top, width, height)

function viewport(width: number, height: number, scale: number) {
  vi.stubGlobal('innerWidth', Math.floor(width / scale))
  vi.stubGlobal('innerHeight', Math.floor(height / scale))
}

function CameraSeed() {
  const api = useStoreApi()
  useLayoutEffect(() => {
    api.setState({
      nodes: [{ id: 'below', type: VIEW_CARD, position: { x: 0, y: window.innerHeight - 30 }, data: {}, measured: { width: 100, height: 100 } }],
      width: window.innerWidth, height: window.innerHeight, transform: [0, 0, 1],
    })
  }, [api])
  return null
}

function draw() {
  const onZoom = vi.fn()
  render(<ReactFlowProvider>
    <header role="banner" />
    <nav aria-label="Canvas tools" />
    <nav aria-label="Viewport controls" />
    <aside aria-label="Outputs dock" />
    <CameraSeed />
    <FootRow onPress={vi.fn()} onZoom={onZoom} edge />
  </ReactFlowProvider>)
  return onZoom
}

beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  install()
  useCanvasStore.setState({ lodRung: 'line' })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.matches('[role="banner"]')) return rect(0, 0, window.innerWidth, 120)
    if (this.matches('nav[aria-label="Canvas tools"]')) return rect(13, 128, 40, 140)
    if (this.matches('nav[aria-label="Viewport controls"]')) return rect(13, window.innerHeight - 176, 40, 136)
    if (this.matches('aside[aria-label="Outputs dock"]')) return rect(window.innerWidth - DOCK_WIDTH, 0, DOCK_WIDTH, window.innerHeight)
    if (this.matches('[data-testid="view-below-cue"]')) return rect(0, 0, CUE_WIDTH, BAR_HEIGHT)
    if (this.matches('[data-foot-zoom]')) return rect(0, 0, this.parentElement?.dataset.compact ? ICON_WIDTH : NOTICE_WIDTH, BAR_HEIGHT)
    return rect(0, 0, 0, 0)
  })
})

afterEach(() => {
  cleanup()
  uninstall()
  useViewLens.setState({ lens: 'full' })
  useCanvasStore.setState({ lodRung: 'full' })
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('the measured canvas foot', () => {
  it.each([
    { width: 2000, height: 1205, scale: 1, lens: 'tradeoffs', trayId: 'view-tradeoffs-key', widthClass: 'max-w-[min(40rem,100%)]', trayWidth: 640, compact: false },
    { width: 1232, height: 704, scale: 1, lens: 'premortem', trayId: 'view-premortem-key', widthClass: 'w-[26rem]', trayWidth: 416, compact: false },
    { width: 1128, height: 680, scale: 1.33, lens: 'what_if', trayId: 'view-whatif-key', widthClass: 'w-80', trayWidth: 320, compact: true },
  ] as const)('keeps the cue, notice and tray clear at $width × $height at $scale', async ({ width, height, scale, lens, trayId, widthClass, trayWidth, compact }) => {
    viewport(width, height, scale)
    useViewLens.setState({ lens })
    draw()
    const foot = screen.getByTestId('view-foot-row')
    const cue = screen.getByTestId('view-below-cue')
    const notice = screen.getByTestId(CANVAS_LOD_NOTICE_TESTID)
    const tray = screen.getByTestId(trayId)
    const row = cue.parentElement!
    expect([...row.children]).toEqual([cue, notice])
    expect([...foot.children]).toEqual([row, tray])
    expect(foot).toHaveClass('fixed', 'bottom-[var(--foot-bottom)]', 'left-[var(--foot-left)]',
      'w-[var(--foot-width)]', 'max-h-[var(--foot-height)]', 'flex-col-reverse', 'items-center', 'gap-2')
    expect(row).toHaveClass('w-full', 'flex-wrap', 'gap-2')
    expect(tray).toHaveClass(widthClass, 'min-h-0')
    await waitFor(() => expect(row.dataset.compact === 'true').toBe(compact))
    expect(cue.querySelector('button')?.matches(FOOT_CONTROLS[1])).toBe(true)
    expect(notice.matches(FOOT_CONTROLS[2])).toBe(true)
    expect(tray.matches(LENS_KEYS.join(','))).toBe(true)

    const px = (name: string) => parseFloat(foot.style.getPropertyValue(name))
    const left = px('--foot-left')
    const available = px('--foot-width')
    const bottom = window.innerHeight - px('--foot-bottom')
    const cueBox = rect(left, bottom - BAR_HEIGHT, cue.getBoundingClientRect().width, BAR_HEIGHT)
    const noticeBox = rect(cueBox.right + GAP, cueBox.top, notice.getBoundingClientRect().width, BAR_HEIGHT)
    const trayBox = rect(left + (available - trayWidth) / 2, cueBox.top - GAP - TRAY_HEIGHT, trayWidth, TRAY_HEIGHT)
    expect(cueBox.left).toBe(RAIL_RIGHT + GAP)
    expect(noticeBox.right).toBeLessThanOrEqual(left + available)
    expect(left + available).toBe(window.innerWidth - DOCK_WIDTH - GAP)
    expect(trayBox.left).toBeGreaterThanOrEqual(left)
    expect(trayBox.right).toBeLessThanOrEqual(left + available)
    expect(trayBox.top).toBeGreaterThanOrEqual(bottom - px('--foot-height'))
    expect(trayBox.bottom).toBeLessThan(cueBox.top)
  })

  it('puts the words in the compact action’s Tip and expands again without replacing its button', async () => {
    viewport(1128, 680, 1.33)
    const onZoom = draw()
    const notice = screen.getByTestId(CANVAS_LOD_NOTICE_TESTID)
    const button = screen.getByRole('button', { name: CANVAS_LOD_NOTICE_ACTION })
    await waitFor(() => expect(notice.parentElement).toHaveAttribute('data-compact', 'true'))
    act(() => button.focus())
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('Zoomed out, showing less on each card')
    expect(tip).toHaveTextContent(CANVAS_LOD_NOTICE_ACTION)
    fireEvent.click(button)
    expect(onZoom).toHaveBeenCalledOnce()

    viewport(1232, 704, 1)
    fireEvent(window, new Event('resize'))
    await waitFor(() => expect(notice.parentElement).not.toHaveAttribute('data-compact'))
    expect(screen.getByRole('button', { name: CANVAS_LOD_NOTICE_ACTION })).toBe(button)
    expect(button).toHaveFocus()
  })
})
