/**
 * ⭐ THE RIGHT PANEL IS THE CONTRACT'S FLUSH PANEL, NOT A FLOATING CARD
 * (DESIGN-GAP #4 / register rows #4, design audit 26 Sep 2026 §2 item 6).
 *
 * SERVED at `853feeb7` (1280×800, `/private/tmp/canvas-design-audit-2`):
 *   - the dock was a 416×721 card at (852,63): radius 20px, a 1px `#EEE6D8`
 *     border on all four sides, a two-layer shadow, 12px off the right edge;
 *   - the tabs were 12px/400 and the active one a 1px outlined pill
 *     (`rgba(39,122,157,.8)`, radius 8) with no underline and no tint.
 *
 * TARGET, the locked visual contract (`olumi-canvas-visual-contract.html`):
 *   `.ai-panel{position:absolute;right:0;top:51px;bottom:0;width:319px}` ·
 *   `.panel-tabs{height:45px}` · `.panel-tabs button{font-size:11px}` ·
 *   `.panel-tabs button.active{color:var(--info);background:#F3F8FA}`.
 *   The contract's panel-edge rule, tab-strip rule and 2px tab underline are
 *   one-sided borders, retired by Design System v5 §6 (Paul, 18 Oct 2026):
 *   the panel's white on the warm canvas is its edge, and the active tab is
 *   the info colour plus the tint.
 *
 * Bound by IDENTITY: the dock's own test id and inline style (the element
 * `computeFitPadding` and `measureDockInset` read back), the CSS custom
 * property the mounted dock writes, the tab strip's test id, the tab that
 * carries `aria-selected="true"`, and the exact class tokens it renders.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { DOCK_RESPONSIVE_MAX_WIDTH, resolveDockWidth } from '../dockWidth'
import { SHELL_TAB_HEIGHT_PX, SHELL_TABSTRIP_HEIGHT_PX } from '../workspaceShell/shellContract'
import { useCanvasStore } from '../../store'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { ToastProvider } from '../../ToastContext'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isJourneyTabEnabled: vi.fn(() => false),
    isPreAnalysisV3Enabled: vi.fn(() => false),
  }
})

/** The contract's panel width, read from the contract, not from the module under test. */
// 27 Sep 2026: 360, Paul + Panel (flush as the contract says; wider than its 319).
const CONTRACT_PANEL_WIDTH_PX = 360
const DOCK_WIDTH_VAR = '--dock-right-expanded'

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => width })
}

function mountDock(viewportWidth = 1280) {
  setViewportWidth(viewportWidth)
  useCanvasStore.setState({
    nodes: [
      { id: 'f-goal', type: 'goal', data: { label: 'Goal' }, position: { x: 0, y: 0 } },
      { id: 'f-decision', type: 'decision', data: { label: 'Decision' }, position: { x: 100, y: 100 } },
    ],
    edges: [{ id: 'f-e1', source: 'f-decision', target: 'f-goal' }],
    hasCompletedFirstRun: false,
  } as never)
  render(
    <ToastProvider>
      <ConversationProvider>
        <OutputsDock />
      </ConversationProvider>
    </ToastProvider>,
  )
  return screen.getByTestId('outputs-dock')
}

const classTokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))

describe('the right panel shell is flush (contract `.ai-panel`)', () => {
  beforeEach(() => {
    ensureMatchMedia()
    try {
      sessionStorage.removeItem(OUTPUTS_DOCK_STORAGE_KEY)
    } catch {}
    try {
      localStorage.removeItem('panel.results.width')
    } catch {}
    document.documentElement.style.removeProperty(DOCK_WIDTH_VAR)
  })
  afterEach(() => {
    cleanup()
    document.documentElement.style.removeProperty(DOCK_WIDTH_VAR)
  })

  it('opens at the panel width, 360px, at the 1280 acceptance frame and at 1440', () => {
    expect(DOCK_RESPONSIVE_MAX_WIDTH).toBe(CONTRACT_PANEL_WIDTH_PX)
    expect(resolveDockWidth(1280, null)).toBe(CONTRACT_PANEL_WIDTH_PX)
    expect(resolveDockWidth(1440, null)).toBe(CONTRACT_PANEL_WIDTH_PX)
    mountDock(1280)
    // The value the mounted dock actually writes, and the canvas reads back.
    expect(document.documentElement.style.getPropertyValue(DOCK_WIDTH_VAR)).toBe(`${CONTRACT_PANEL_WIDTH_PX}px`)
  })

  it('sits flush on the right edge, from the top bar to the viewport bottom', () => {
    const dock = mountDock()
    expect(dock).toHaveAttribute('data-panel-composition', 'expanded')
    expect(dock.style.right).toBe('0px')
    expect(dock.style.top).toBe('var(--topbar-h, 0px)')
    expect(dock.style.bottom).toBe('var(--bottombar-h)')
  })

  it('has no edge rule on any side (DS v5 §6), and no radius and no shadow', () => {
    const dock = mountDock()
    // No one-sided rule: the panel's own background against the canvas is its edge.
    expect(dock.style.border).toBe('')
    expect(dock.style.borderLeft).toBe('')
    // The served card's all-round box is gone too.
    expect(dock.style.borderTop).toBe('')
    expect(dock.style.borderRight).toBe('')
    expect(dock.style.borderBottom).toBe('')
    // React writes a numeric 0 radius as the bare string '0'.
    expect(dock.style.borderRadius).toBe('0')
    expect(dock.style.boxShadow).toBe('none')
  })

  it('the tab strip is 45px and the active tab is the info colour with the contract tint: no underline, not an outlined pill', () => {
    mountDock()
    const strip = screen.getByTestId('outputs-dock-tabstrip')
    expect(strip.style.height).toBe(`${SHELL_TABSTRIP_HEIGHT_PX}px`)
    expect(SHELL_TABSTRIP_HEIGHT_PX).toBe(45)

    const tabs = screen.getAllByRole('tab').filter(t => (t.getAttribute('data-testid') ?? '').startsWith('outputs-dock-tab-'))
    expect(tabs.length).toBeGreaterThanOrEqual(2)
    const active = tabs.filter(t => t.getAttribute('aria-selected') === 'true')
    expect(active).toHaveLength(1)
    const on = classTokens(active[0])
    for (const token of ['text-info', 'bg-[var(--panel-tab-active-bg)]', 'rounded-none', 'text-[11px]']) {
      expect(on.has(token), `active tab carries "${token}"`).toBe(true)
    }
    // The served pill's tokens, and the retired one-sided underline, by name.
    for (const token of ['border-info/80', 'rounded-sm', 'border', 'text-xs', 'border-b-2', 'border-info']) {
      expect(on.has(token), `active tab must not carry "${token}"`).toBe(false)
    }
    expect(active[0].style.height).toBe(`${SHELL_TAB_HEIGHT_PX}px`)

    // CONTRAST: an inactive tab has no tint, no info colour and no underline.
    const idle = classTokens(tabs.find(t => t.getAttribute('aria-selected') !== 'true')!)
    expect(idle.has('border-b-2')).toBe(false)
    expect(idle.has('text-info')).toBe(false)
    expect(idle.has('text-text-body')).toBe(true)
    expect(idle.has('bg-[var(--panel-tab-active-bg)]')).toBe(false)
    expect(idle.has('text-[11px]')).toBe(true)
  })

  it('collapses to the flush rail and the restore control brings the panel back', () => {
    const dock = mountDock()
    fireEvent.click(screen.getByTestId('dock-collapse-control'))
    expect(dock).toHaveAttribute('data-panel-composition', 'collapsed')
    expect(dock.style.right).toBe('0px')
    const restore = screen.getByRole('button', { name: 'Expand outputs dock' })
    fireEvent.click(restore)
    expect(dock).toHaveAttribute('data-panel-composition', 'expanded')
    expect(screen.getByTestId('outputs-dock-tabstrip')).toBeInTheDocument()
  })
})

describe('the contract tab tint is declared once, as a token; the retired rule tokens are gone', () => {
  const css = readFileSync(path.resolve(__dirname, '../../../index.css'), 'utf8')
  it('--panel-tab-active-bg is #F3F8FA', () => {
    const decl = [...css.matchAll(/--panel-tab-active-bg\s*:\s*([^;]+);/g)].map(m => m[1].trim())
    expect(decl).toEqual(['#F3F8FA'])
  })
  it.each(['--panel-edge-rule', '--panel-tab-rule'])('%s (a one-sided rule colour) is no longer declared', (name) => {
    expect(css).not.toMatch(new RegExp(`${name}\\s*:`))
  })
})
