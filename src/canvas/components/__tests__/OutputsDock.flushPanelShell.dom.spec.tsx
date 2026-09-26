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
 *   `.ai-panel{position:absolute;right:0;top:51px;bottom:0;width:319px;
 *   border-left:1px solid #DCD7CF}` · `.panel-tabs{height:45px}` ·
 *   `.panel-tabs button{font-size:11px;border-bottom:2px solid transparent}` ·
 *   `.panel-tabs button.active{border-color:var(--info);background:#F3F8FA}`.
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
const CONTRACT_PANEL_WIDTH_PX = 319
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

  it('opens at the contract width, 319px, at the 1280 acceptance frame and at 1440', () => {
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

  it('has one rule on its LEFT edge in the contract colour, and no radius and no shadow', () => {
    const dock = mountDock()
    expect(dock.style.borderLeft).toBe('1px solid var(--panel-edge-rule)')
    // The served card's all-round box is gone: no top/right/bottom rule.
    expect(dock.style.borderTop).toBe('')
    expect(dock.style.borderRight).toBe('')
    expect(dock.style.borderBottom).toBe('')
    // React writes a numeric 0 radius as the bare string '0'.
    expect(dock.style.borderRadius).toBe('0')
    expect(dock.style.boxShadow).toBe('none')
  })

  it('the tab strip is 45px and the active tab is a 2px underline with the contract tint, not an outlined pill', () => {
    mountDock()
    const strip = screen.getByTestId('outputs-dock-tabstrip')
    expect(strip.style.height).toBe(`${SHELL_TABSTRIP_HEIGHT_PX}px`)
    expect(SHELL_TABSTRIP_HEIGHT_PX).toBe(45)

    const tabs = screen.getAllByRole('tab').filter(t => (t.getAttribute('data-testid') ?? '').startsWith('outputs-dock-tab-'))
    expect(tabs.length).toBeGreaterThanOrEqual(2)
    const active = tabs.filter(t => t.getAttribute('aria-selected') === 'true')
    expect(active).toHaveLength(1)
    const on = classTokens(active[0])
    for (const token of ['border-b-2', 'border-info', 'bg-[var(--panel-tab-active-bg)]', 'rounded-none', 'text-[11px]']) {
      expect(on.has(token), `active tab carries "${token}"`).toBe(true)
    }
    // The served pill's tokens, by name.
    for (const token of ['border-info/80', 'rounded-sm', 'border', 'text-xs']) {
      expect(on.has(token), `active tab must not carry the pill's "${token}"`).toBe(false)
    }
    expect(active[0].style.height).toBe(`${SHELL_TAB_HEIGHT_PX}px`)

    // CONTRAST: an inactive tab has the transparent underline and no tint.
    const idle = classTokens(tabs.find(t => t.getAttribute('aria-selected') !== 'true')!)
    expect(idle.has('border-b-2')).toBe(true)
    expect(idle.has('border-transparent')).toBe(true)
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

describe('the three contract colours are declared once, as tokens', () => {
  const css = readFileSync(path.resolve(__dirname, '../../../index.css'), 'utf8')
  it.each([
    ['--panel-edge-rule', '#DCD7CF'],
    ['--panel-tab-rule', '#E6E1D8'],
    ['--panel-tab-active-bg', '#F3F8FA'],
  ])('%s is %s', (name, hex) => {
    const decl = [...css.matchAll(new RegExp(`${name}\\s*:\\s*([^;]+);`, 'g'))].map(m => m[1].trim())
    expect(decl).toEqual([hex])
  })
})
