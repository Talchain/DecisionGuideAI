/**
 * SURFACES STEP B (18 Nov): the lane's one Tip. On the lane it stands in for the right-click menu's own tooltip (a second look, which the older look keeps). Bound here: what a menu row's tip says
 * (a label the row cut is said whole, then the row's own note), the one look, and that where it stands is two custom properties, never an inline
 * left/top. The menu's use of it (hover a row, 300 ms) is in canvas/contextMenu/__tests__/CanvasContextMenu.spec.tsx.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '../../../canvas/ToastContext'
import { LaneInspector } from '../../v12/edit/LaneInspector'
import { useLaneInspector } from '../../v12/edit/inspectorStore'
import { install, uninstall } from '../../v12/edit/__tests__/harness'
import { Tip, TIP_GAP, TIP_DELAY, rowTipOf, useAnchoredTip } from '../Tip'
import { installPlaceHost } from '../placeHost'
import { lanePlaceHost } from '../placeReaders'

afterEach(() => { cleanup() })

/** A menu row as the menu draws it: its label in `[data-menu-label]`, drawn `shown` px wide while its words need `needs` px. */
const row = (label: string, shown: number, needs: number): HTMLElement => {
  const r = document.createElement('button'), l = document.createElement('span')
  l.setAttribute('data-menu-label', 'x'); l.textContent = label
  Object.defineProperty(l, 'clientWidth', { value: shown }); Object.defineProperty(l, 'scrollWidth', { value: needs })
  r.appendChild(l)
  return r
}
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

function Anchored({ words, testid, children }: { words: string; testid: string; children?: ReactNode }) {
  const t = useAnchoredTip(words)
  return <div data-testid={testid} {...t.handlers}>{children}{t.tip}</div>
}

const tipPosition = () => {
  const tip = screen.getByTestId('lane-tip')
  return [tip.style.getPropertyValue('--tip-x'), tip.style.getPropertyValue('--tip-y')]
}

describe('what a menu row\'s tip says', () => {
  const LONG = 'Undo: put back the idea you kept about the second market before the pilot'
  it('a label the row cut is said WHOLE, then the row\'s own note. CONTRAST: a label that fits is not repeated, the note alone is said', () => {
    expect(rowTipOf(row(LONG, 200, 520), LONG, 'Takes back the last saved change')).toBe(`${LONG}\nTakes back the last saved change`)
    expect(rowTipOf(row('Rename', 200, 60), 'Rename', 'Change this card\'s name')).toBe('Change this card\'s name')
  })
  it('a cut label with no note of its own still has its whole words; a label that fits and has no note has no tip at all', () => {
    expect(rowTipOf(row(LONG, 200, 520), LONG, undefined)).toBe(LONG)
    expect(rowTipOf(row(LONG, 200, 520), LONG, '')).toBe(LONG)
    expect(rowTipOf(row('Rename', 200, 60), 'Rename', undefined)).toBeNull()
  })
  it('a note that already says the label (the menu\'s own whole-label note) is said once, not after the label again', () => {
    expect(rowTipOf(row(LONG, 200, 520), LONG, LONG)).toBe(LONG)
    expect(rowTipOf(row(LONG, 200, 520), LONG, `${LONG}. Not available on an earlier version.`)).toBe(`${LONG}. Not available on an earlier version.`)
  })
})

describe('the one Tip', () => {
  it('one look (the panel\'s ground and border, the small radius, 240 px at most, read only) and its place in two custom properties, with no inline left or top', () => {
    render(<Tip id="tooltip-x" text={'A row\'s whole words\nand its note'} anchorRect={rect(100, 200, 220, 32)} />)
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveAttribute('id', 'tooltip-x')
    expect(tip.textContent).toBe('A row\'s whole words\nand its note')
    for (const c of ['rounded-sm', 'border', 'border-panel-border', 'bg-panel', 'ok-tip', 'pointer-events-none', 'whitespace-pre-line', 'shadow-1']) expect(tip.classList.contains(c), c).toBe(true)
    expect([...tip.classList].filter((c) => /^rounded(-|$)/.test(c)), 'one radius').toEqual(['rounded-sm'])
    expect([tip.style.left, tip.style.top], 'no inline position').toEqual(['', ''])
    expect([tip.style.getPropertyValue('--tip-x'), tip.style.getPropertyValue('--tip-y')], 'right of its row, level with it').toEqual([`${100 + 220 + TIP_GAP}px`, '200px'])
  })
  it('one layout: the first line is the title, the rest the body, and the words still read as one string; a lone line is plain', () => {
    const { unmount } = render(<Tip text={'Title\nBody line'} anchorRect={rect(0, 0, 10, 10)} />)
    expect([screen.getByRole('tooltip').querySelector('[data-tip-title]')!.textContent, screen.getByRole('tooltip').querySelector('[data-tip-body]')!.textContent]).toEqual(['Title', 'Body line'])
    expect(screen.getByRole('tooltip').querySelector('[data-tip-title]')!.className).toBe('ok-tip-title') // the weight and ink are olumiLook.css's recipe, not a class here
    unmount()
    render(<Tip text="Just words" anchorRect={rect(0, 0, 10, 10)} />)
    expect([screen.getByRole('tooltip').querySelector('[data-tip-body]'), screen.getByRole('tooltip').querySelector('[data-tip-title]')!.className]).toEqual([null, ''])
  })
  it('the delay is 150 ms, and a dock tip slides below its row when neither side fits inside the dock', () => {
    expect(TIP_DELAY).toBe(150)
    vi.useFakeTimers()
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.matches('aside[aria-label="Outputs dock"]')) return rect(700, 0, 300, 800)
      if (this.matches('[data-testid="dock-row"]')) return rect(820, 200, 20, 20)
      return rect(0, 0, 200, 60)
    })
    const restorePlaceHost = installPlaceHost(lanePlaceHost)
    try {
      render(<aside aria-label="Outputs dock"><Anchored words="Edge" testid="dock-row" /></aside>)
      fireEvent.pointerEnter(screen.getByTestId('dock-row'))
      act(() => { vi.advanceTimersByTime(TIP_DELAY - 1) })
      expect(screen.queryByTestId('lane-tip')).toBeNull()
      act(() => { vi.advanceTimersByTime(1) })
      expect(tipPosition()).toEqual(['800px', '228px'])
    } finally {
      restorePlaceHost()
      spy.mockRestore()
      vi.useRealTimers()
    }
  })
  it('an oversized tip starts at its region margin and keeps its full height', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(0, 0, window.innerWidth + 100, window.innerHeight + 100))
    try {
      render(<Tip text="Very long" anchorRect={rect(200, 150, 20, 20)} />)
      expect(tipPosition()).toEqual([`${TIP_GAP}px`, `${TIP_GAP}px`])
      expect(screen.getByTestId('lane-tip').style.maxHeight).toBe('')
    } finally {
      spy.mockRestore()
    }
  })
  it('a canvas tip stays left of the dock and takes another side when pinned details occupy its first clear side', () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.matches('aside[aria-label="Outputs dock"]')) return rect(650, 0, 350, 800)
      if (this.matches('[data-testid="canvas-row"]')) return rect(405, 100, 40, 20)
      if (this.matches('[data-testid="lane-inspector"]')) return rect(195, 45, 220, 80)
      return rect(0, 0, 200, 60)
    })
    const scene = (pinned: boolean) => <>
      <aside aria-label="Outputs dock" />
      <div className="react-flow"><Anchored words="Low" testid="canvas-row" /></div>
      {pinned ? <aside data-testid="lane-inspector" /> : null}
    </>
    const restorePlaceHost = installPlaceHost(lanePlaceHost)
    try {
      const { rerender } = render(scene(false))
      const row = screen.getByTestId('canvas-row')
      fireEvent.pointerEnter(row)
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect(tipPosition()).toEqual(['197px', '100px'])
      fireEvent.pointerLeave(row)
      rerender(scene(true))
      fireEvent.pointerEnter(row)
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect(tipPosition()).toEqual(['405px', '128px'])
    } finally {
      restorePlaceHost()
      spy.mockRestore()
      vi.useRealTimers()
    }
  })
  it('a card part tip stays on its own card to avoid a neighbour and takes the right side when the neighbour is removed', () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.matches('[data-testid="card-with-part"]')) return rect(130, 110, 135, 110)
      if (this.matches('[data-testid="card-part"]')) return rect(200, 150, 57, 26)
      if (this.matches('[data-testid="neighbour-card"]')) return rect(300, 145, 80, 40)
      return rect(0, 0, 57, 26)
    })
    const scene = (withNeighbour: boolean) => (
      <div className="react-flow">
        <div className="react-flow__node" data-testid="card-with-part">
          <Anchored words="1 years" testid="card-part" />
        </div>
        {withNeighbour ? <div className="react-flow__node" data-testid="neighbour-card" /> : null}
      </div>
    )
    const restorePlaceHost = installPlaceHost(lanePlaceHost)
    try {
      const { rerender } = render(scene(true))
      const part = screen.getByTestId('card-part')
      fireEvent.pointerEnter(part)
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect(tipPosition().map(Number.parseFloat)).toEqual([135, 150])
      fireEvent.pointerLeave(part)
      rerender(scene(false))
      fireEvent.pointerEnter(part)
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect(tipPosition().map(Number.parseFloat)).toEqual([265, 150])
    } finally {
      restorePlaceHost()
      spy.mockRestore()
      vi.useRealTimers()
    }
  })
  it('without a host, a tip stands beside its anchor inside the window margin and ignores cards and boxes', () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.matches('[data-testid="canvas-row"]')) return rect(100, 0, 20, 20)
      if (this.matches('.react-flow__node, [data-testid="lane-inspector"]')) return rect(128, 8, 80, 32)
      return rect(0, 0, 80, 32)
    })
    try {
      render(<>
        <div className="react-flow">
          <Anchored words="Edge" testid="canvas-row" />
          <div className="react-flow__node" />
        </div>
        <aside data-testid="lane-inspector" />
      </>)
      fireEvent.pointerEnter(screen.getByTestId('canvas-row'))
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect(tipPosition()).toEqual(['128px', '8px'])
    } finally {
      spy.mockRestore()
      vi.useRealTimers()
    }
  })
  it('a tip is never interactive: a long body renders WHOLE (every word in the DOM), with no overflow or height style and no scroll recipe in the stylesheet', () => {
    const body = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ')
    render(<Tip text={`Title\n${body}`} anchorRect={rect(100, 100, 20, 20)} />)
    const tip = screen.getByRole('tooltip')
    expect(tip.querySelector('[data-tip-body]')!.textContent).toBe(body)
    expect([tip.style.overflow, tip.style.maxHeight, tip.style.height, tip.getAttribute('style')?.includes('overflow') ?? false]).toEqual(['', '', '', false])
    expect(tip.className).toContain('pointer-events-none')
    const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    const rule = css.match(/\.ok-tip\s*\{([^}]*)\}/)?.[1] ?? ''
    expect([/max-width:\s*min\(240px,\s*calc\(100vw/.test(rule), /max-height|overflow/.test(rule)]).toEqual([true, false])
    expect(css).toMatch(/\.ok-tip-title\s*\{[^}]*font-weight:\s*500[^}]*var\(--text-header\)/)
  })
  it('nothing is drawn with no words or no row to stand beside', () => {
    render(<><Tip text="" anchorRect={rect(0, 0, 10, 10)} /><Tip text="words" anchorRect={null} /></>)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

describe('one tip on the screen at a time (Codex round 4: a card\'s tip and an icon\'s tip inside it opened together)', () => {
  it('the pointer resting on an icon inside a card shows the icon\'s tip only; leaving the icon for another anchor swaps it, never two', () => {
    vi.useFakeTimers()
    try {
      render(<><Anchored words="Card results" testid="card"><Anchored words="Icon words" testid="icon" /></Anchored><Anchored words="Other" testid="other" /></>)
      fireEvent.pointerEnter(screen.getByTestId('card'))
      fireEvent.pointerEnter(screen.getByTestId('icon'))
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect(screen.getAllByRole('tooltip').map((t) => t.textContent)).toEqual(['Icon words'])
      fireEvent.pointerEnter(screen.getByTestId('other'))
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect(screen.getAllByRole('tooltip').map((t) => t.textContent)).toEqual(['Other'])
    } finally { vi.useRealTimers() }
  })

  it('a card part tip hides the hover preview, closing it restores the preview, and pinned details stay visible', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    vi.useFakeTimers()
    install()
    const restorePlaceHost = installPlaceHost(lanePlaceHost)
    const target = { kind: 'card', id: 'starting_customers' } as const
    try {
      useLaneInspector.getState().setPeek(target)
      render(<ToastProvider>
        <div className="react-flow">
          <div className="react-flow__node" data-id={target.id}>
            <Anchored words="Icon words" testid="card-part" />
          </div>
        </div>
        <LaneInspector />
      </ToastProvider>)
      const part = screen.getByTestId('card-part')
      const openTip = () => {
        fireEvent.pointerEnter(part)
        act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      }
      expect(screen.queryByTestId('lane-peek')).not.toBeNull()
      openTip()
      expect(screen.queryByTestId('lane-tip')).not.toBeNull()
      expect(screen.queryByTestId('lane-peek')).toBeNull()
      fireEvent.pointerLeave(part, { relatedTarget: part.parentElement })
      expect(screen.queryByTestId('lane-tip')).toBeNull()
      expect(screen.queryByTestId('lane-peek')).not.toBeNull()

      act(() => { useLaneInspector.getState().open(target) })
      openTip()
      expect(screen.queryByTestId('lane-tip')).not.toBeNull()
      expect(screen.queryByTestId('lane-inspector')).not.toBeNull()
    } finally {
      cleanup()
      restorePlaceHost()
      useLaneInspector.setState({ current: null, peek: null })
      uninstall()
      vi.useRealTimers()
      vi.unstubAllEnvs()
    }
  })

  it('a tip with a stand-in anchor opens inside the window margin and leaves the hover preview visible', () => {
    const anchor = { getBoundingClientRect: () => rect(100, 0, 20, 20), matches: () => true }
    function StandInTrigger() {
      const t = useAnchoredTip('Icon words')
      return <button type="button" data-testid="stand-in-trigger" onFocus={(event) => {
        t.handlers.onFocus(Object.create(event, { currentTarget: { value: anchor } }))
      }}>{t.tip}</button>
    }

    vi.stubEnv('VITE_OLUMI_CORE', '1')
    vi.useFakeTimers()
    install()
    const restorePlaceHost = installPlaceHost(lanePlaceHost)
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.matches('.react-flow__node')) return rect(250, 150, 100, 40)
      return rect(0, 0, 80, 32)
    })
    const target = { kind: 'card', id: 'starting_customers' } as const
    try {
      useLaneInspector.getState().setPeek(target)
      render(<ToastProvider>
        <div className="react-flow">
          <div className="react-flow__node" data-id={target.id}><StandInTrigger /></div>
        </div>
        <LaneInspector />
      </ToastProvider>)
      expect(screen.getByTestId('lane-peek')).toBeVisible()
      fireEvent.focus(screen.getByTestId('stand-in-trigger'))
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect(tipPosition()).toEqual([`${120 + TIP_GAP}px`, `${TIP_GAP}px`])
      expect(screen.getByTestId('lane-peek')).toBeVisible()
    } finally {
      cleanup()
      spy.mockRestore()
      restorePlaceHost()
      useLaneInspector.setState({ current: null, peek: null })
      uninstall()
      vi.useRealTimers()
      vi.unstubAllEnvs()
    }
  })
})
