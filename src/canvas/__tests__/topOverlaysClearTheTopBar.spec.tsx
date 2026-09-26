/**
 * Every fixed, top-anchored canvas overlay starts BELOW the top bar (#2078
 * review 5842363420).
 *
 * v3.1 WS2 made the top bar full-width, 51px tall and z-index 3000. The
 * reconnect banner (`fixed top-4 … z-50`) then rendered entirely under it, so
 * the canvas stayed in a mode that rewires an edge on the next node click with
 * nothing on screen saying so. The layout banner and the toasts covered the
 * bar's title and controls instead.
 *
 * jsdom cannot lay out `calc(var(--topbar-h) …)`, so the rendered rows bind
 * each overlay to the ONE clearance authority. The source row closes the
 * class: no other overlay may pin itself inside the bar's 51px.
 */
import '@testing-library/jest-dom/vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { render, screen, act } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ReconnectBanner } from '../components/ReconnectBanner'
import { LayoutProgressBanner } from '../components/LayoutProgressBanner'
import { ToastProvider, useToast } from '../ToastContext'
import { useCanvasStore } from '../store'
import { useLayoutProgressStore } from '../layoutProgressStore'
import { TOP_CLEARANCE, TOAST_TOP_CLEARANCE } from '../utils/topBarClearance'
import { TOP_BAR_HEIGHT_PX } from '../../components/layout/TopBar'

afterEach(() => {
  useCanvasStore.setState({ reconnecting: null })
  useLayoutProgressStore.setState({ status: 'idle' })
})

const hasTopUtility = (el: HTMLElement) => [...el.classList].some((c) => /^top-/.test(c))

describe('fixed top overlays clear the canvas top bar', () => {
  it('the clearance is measured from the bar the canvas publishes', () => {
    expect(TOP_CLEARANCE).toContain('var(--topbar-h')
    expect(TOAST_TOP_CLEARANCE).toContain('var(--topbar-h')
  })

  it('the reconnect-mode banner starts below the bar', () => {
    act(() => useCanvasStore.setState({ reconnecting: { edgeId: 'e1', end: 'source' } as never }))
    render(<ReconnectBanner />)
    const banner = screen.getByTestId('banner-reconnect-mode')
    expect(banner.style.top).toBe(TOP_CLEARANCE)
    expect(hasTopUtility(banner)).toBe(false)
  })

  it('the layout banner starts below the bar', () => {
    act(() => useLayoutProgressStore.setState({ status: 'loading' }))
    render(<LayoutProgressBanner />)
    const outer = screen.getByRole('status').parentElement as HTMLElement
    expect(outer.style.top).toBe(TOP_CLEARANCE)
    expect(hasTopUtility(outer)).toBe(false)
  })

  it('toasts start below the bar', () => {
    function Fire() {
      const { showToast } = useToast()
      return <button onClick={() => showToast('Connector updated.', 'info')}>fire</button>
    }
    render(<ToastProvider><Fire /></ToastProvider>)
    act(() => screen.getByText('fire').click())
    const region = screen.getByRole('region', { name: 'Notifications' })
    expect(region.style.top).toBe(TOAST_TOP_CLEARANCE)
    expect(hasTopUtility(region)).toBe(false)
  })

  it('no other canvas overlay pins itself inside the bar', () => {
    // Intentional exception: the crash banner sits OVER everything (z 9998).
    const ALLOWED = new Set(['ErrorBoundary.tsx'])
    const root = join(__dirname, '..')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) {
          if (name !== '__tests__' && name !== 'node_modules') walk(p)
          continue
        }
        if (!/\.tsx$/.test(name) || /\.(spec|test|stories)\.tsx$/.test(name) || ALLOWED.has(name)) continue
        const src = readFileSync(p, 'utf8')
        for (const m of src.matchAll(/className="([^"]*)"/g)) {
          const cls = m[1].split(/\s+/)
          if (!cls.includes('fixed')) continue
          const top = cls.find((c) => /^top-(\d+(\.5)?|px)$/.test(c))
          if (!top) continue
          const px = top === 'top-px' ? 1 : Number(top.slice(4)) * 4
          if (px < TOP_BAR_HEIGHT_PX) offenders.push(`${relative(root, p)}: ${top}`)
        }
      }
    }
    walk(root)
    expect(offenders).toEqual([])
  })
})
