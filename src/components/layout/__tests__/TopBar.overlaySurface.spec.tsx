/**
 * TopBar — the kebab menu is driven by uiStore, not by component-local state.
 *
 * THE BLOCKER THIS CLOSES. `applyV5State` executes ui_directive verbs at a
 * once-per-envelope, NON-RENDER side-effect site. It reaches the UI only
 * through `useUIStore.getState()`. Until this change the TopBar menu's
 * open-state was `const [showMenu, setShowMenu] = useState(false)` inside the
 * component, so no assistant gesture could ever raise it — menus, pop-ups and
 * coach-marks were structurally unreachable, not merely unimplemented.
 *
 * ⚠ TRAP 3b — BIND TO THE SURFACE THE DEPLOYED BUILD MOUNTS. This estate has
 * twice shipped a green suite bound to a component the deployed flags do not
 * render. The first test below is a MOUNT-PATH assertion: it pins that the
 * module under test is the one in the deployed bundle, via a marker string
 * that is unique to src/components/layout/TopBar.tsx in the source tree AND
 * present in the deployed staging chunk CanvasMVP-y0VodO-Y.js (crawled to a
 * fixpoint over 87 chunks at commit aa81aa1a, 2026-08-10; positive controls
 * fired, negative controls read zero). If TopBar is ever replaced by a
 * lookalike, that assertion fails rather than the suite passing on the wrong
 * object (trap 19: bind by identity, never by a predicate another object
 * could satisfy).
 *
 * ⚠ WHAT jsdom CANNOT PROVE. These tests prove the menu is MOUNTED and that
 * `aria-expanded` is true. They prove NOTHING about visibility, stacking,
 * layout or whether a human can see the menu. Only a real browser can, and
 * the PR body carries that check separately.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from '../TopBar'
import { MENU_EXCLUSIVE_EVENT } from '../LeftSidebar'
import { ToastProvider } from '../../../canvas/ToastContext'
import { useUIStore, type OverlaySurfaceId } from '../../../stores/uiStore'

/**
 * A surface id this bar does NOT own.
 *
 * `OVERLAY_SURFACE_IDS` has one member today, so every "is my menu open?"
 * predicate — `=== 'top_bar_menu'` and the far looser `!== null` — agrees on
 * every value the enum can produce. A mutation kit confirmed it: replacing
 * TopBar's identity check with `!== null` left the whole suite GREEN. That is
 * trap 19 exactly (an assertion satisfied by an object other than the one it
 * names), latent until the second surface is lifted, at which point the kebab
 * would silently open whenever a sibling menu was raised.
 *
 * So the discrimination is pinned NOW, with a foreign id the store will one
 * day carry for real. The cast is the point: it stands in for a future sibling
 * surface, and it makes the pair complete — loosen the guard for ALL surfaces
 * and this test REDs; loosen it for a DIFFERENT surface only and the
 * assistant-open test stays green.
 */
const FOREIGN_SURFACE = 'a_surface_this_bar_does_not_own' as unknown as OverlaySurfaceId

const props = {
  scenarioTitle: 'Pricing Decision 2025',
  onTitleChange: vi.fn(),
  onSave: vi.fn(),
  onShare: vi.fn(),
}

function renderTopBar() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TopBar {...props} />
      </ToastProvider>
    </MemoryRouter>,
  )
}

/** The assistant's only reach into the UI: the non-render store seam that
 *  applyV5State uses. Deliberately NOT a component handler — calling a prop
 *  would prove nothing about directive reachability. */
function assistantRaises(surface: 'top_bar_menu') {
  act(() => {
    useUIStore.getState().requestOverlaySurface(surface)
  })
}

describe('TopBar kebab menu — lifted into uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({ activeOverlaySurface: null, overlaySurfaceOrigin: null })
  })
  afterEach(() => {
    cleanup()
    useUIStore.setState({ activeOverlaySurface: null, overlaySurfaceOrigin: null })
  })

  // ── Mount-path assertion (trap 3b) ───────────────────────────────────────
  it('is the TopBar the deployed bundle mounts', () => {
    renderTopBar()
    // Marker unique to src/components/layout/TopBar.tsx and present in the
    // deployed chunk. Its handler is the only producer of this string.
    const versionHistory = screen.getByRole('button', { name: /version history/i })
    expect(versionHistory).toBeInTheDocument()
    // And this TopBar is the one that owns the kebab trigger.
    expect(screen.getByRole('button', { name: /more options/i })).toBeInTheDocument()
  })

  // ── THE CAPABILITY: an assistant gesture opens a menu, no user input ─────
  it('opens the kebab menu from the non-render store seam, with no user interaction', () => {
    renderTopBar()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /more options/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    assistantRaises('top_bar_menu')

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /more options/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(useUIStore.getState().overlaySurfaceOrigin).toBe('assistant')
  })

  // ── The binding is to THIS bar's surface, by identity ────────────────────
  it('stays closed when a surface it does not own is raised', () => {
    renderTopBar()
    act(() => {
      useUIStore.setState({
        activeOverlaySurface: FOREIGN_SURFACE,
        overlaySurfaceOrigin: 'assistant',
      })
    })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('banner')).not.toHaveAttribute('data-overlay-origin')
  })

  it('does not lower a surface it does not own', () => {
    renderTopBar()
    act(() => {
      useUIStore.setState({
        activeOverlaySurface: FOREIGN_SURFACE,
        overlaySurfaceOrigin: 'user',
      })
    })
    // Escape and click-outside are this bar's dismissals. They must act on its
    // OWN surface only — a component that lowers whatever happens to be raised
    // would take a sibling's menu away the moment two surfaces are lifted.
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.mouseDown(document.body)

    expect(useUIStore.getState().activeOverlaySurface).toBe(FOREIGN_SURFACE)
    expect(useUIStore.getState().overlaySurfaceOrigin).toBe('user')
  })

  it('marks the banner with the origin so a surface the assistant raised is attributable', () => {
    renderTopBar()
    const banner = screen.getByRole('banner')
    expect(banner).not.toHaveAttribute('data-overlay-origin')

    assistantRaises('top_bar_menu')
    expect(banner).toHaveAttribute('data-overlay-origin', 'assistant')

    act(() => {
      useUIStore.getState().setOverlaySurface(null)
    })
    expect(banner).not.toHaveAttribute('data-overlay-origin')
  })

  // ── The user path is unchanged ───────────────────────────────────────────
  it('the user can still open the menu by clicking, and the store records it', () => {
    renderTopBar()
    fireEvent.click(screen.getByRole('button', { name: /more options/i }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(useUIStore.getState().activeOverlaySurface).toBe('top_bar_menu')
    expect(useUIStore.getState().overlaySurfaceOrigin).toBe('user')
  })

  it('the user can still close the menu by clicking the trigger again', () => {
    renderTopBar()
    const trigger = screen.getByRole('button', { name: /more options/i })
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(useUIStore.getState().activeOverlaySurface).toBeNull()
  })

  // ── USER AGENCY over an assistant-raised surface ─────────────────────────
  it('Escape dismisses a menu the ASSISTANT raised', () => {
    renderTopBar()
    assistantRaises('top_bar_menu')
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(useUIStore.getState().activeOverlaySurface).toBeNull()
    expect(useUIStore.getState().overlaySurfaceOrigin).toBeNull()
  })

  it('a click outside dismisses a menu the ASSISTANT raised', () => {
    renderTopBar()
    assistantRaises('top_bar_menu')
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(useUIStore.getState().activeOverlaySurface).toBeNull()
  })

  // ── The cross-menu exclusivity bridge still works ────────────────────────
  // LeftSidebar's lens menu and UserAvatarMenu still hold their own local
  // state (not this lane's files) and coordinate over this window event. The
  // lifted kebab must keep honouring it in BOTH directions, or lifting one
  // surface would silently create two competing exclusivity mechanisms.
  it('closes when ANOTHER menu claims exclusivity', () => {
    renderTopBar()
    assistantRaises('top_bar_menu')
    expect(screen.getByRole('menu')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(
        new CustomEvent(MENU_EXCLUSIVE_EVENT, { detail: { source: 'lens' } }),
      )
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(useUIStore.getState().activeOverlaySurface).toBeNull()
  })

  it('stays open when the exclusivity claim is its OWN', () => {
    renderTopBar()
    assistantRaises('top_bar_menu')

    act(() => {
      window.dispatchEvent(
        new CustomEvent(MENU_EXCLUSIVE_EVENT, { detail: { source: 'kebab' } }),
      )
    })

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(useUIStore.getState().activeOverlaySurface).toBe('top_bar_menu')
  })

  it('announces its own exclusivity claim when the ASSISTANT raises it, so sibling menus close', () => {
    renderTopBar()
    const seen: string[] = []
    const listener = (e: Event) => {
      seen.push(String((e as CustomEvent).detail?.source))
    }
    window.addEventListener(MENU_EXCLUSIVE_EVENT, listener)
    try {
      assistantRaises('top_bar_menu')
    } finally {
      window.removeEventListener(MENU_EXCLUSIVE_EVENT, listener)
    }
    expect(seen).toContain('kebab')
  })

  it('reflects the store on first paint rather than defaulting closed', () => {
    useUIStore.setState({
      activeOverlaySurface: 'top_bar_menu',
      overlaySurfaceOrigin: 'assistant',
    })
    renderTopBar()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  // ── The store must stay TRUTHFUL about what is on screen ─────────────────
  // An overlay is anchored to a control. Component-local `useState` died with
  // the component; a store does not. Without an unmount lower, a route change
  // would leave the store asserting a menu that no longer exists — and the
  // next TopBar to mount would paint it open, which is how a lifted surface
  // turns into a ghost.
  it('lowers its surface when the bar unmounts', () => {
    const { unmount } = renderTopBar()
    assistantRaises('top_bar_menu')
    expect(useUIStore.getState().activeOverlaySurface).toBe('top_bar_menu')

    unmount()

    expect(useUIStore.getState().activeOverlaySurface).toBeNull()
    expect(useUIStore.getState().overlaySurfaceOrigin).toBeNull()
  })

  it('a remount after an unmount starts closed', () => {
    const first = renderTopBar()
    assistantRaises('top_bar_menu')
    first.unmount()

    renderTopBar()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
