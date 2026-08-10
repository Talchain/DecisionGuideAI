/**
 * TopBar kebab menu — ATTRIBUTION for an assistant-raised surface.
 *
 * #645 lifted the menu's open-state into uiStore and recorded WHO raised it
 * (`overlaySurfaceOrigin`). It rendered nothing from that fact: a menu could
 * appear and the user was given no way to know Olumi did it. An interface that
 * acts on its own without saying so is startling, and this is the one channel
 * whose entire purpose is truthfulness. This spec pins the visible half.
 *
 * ⚠ WHAT THIS BADGE MAY AND MAY NOT SAY. It says WHO ("Opened by Olumi") and
 * HOW TO TAKE IT BACK ("Esc to dismiss" — verified: TopBar's Escape handler is
 * unconditional on origin). It does NOT say WHY, because no reason is
 * reachable at this tip: `ui_directive.note` is the only candidate carrier on
 * the 0.39.0 wire and NOTHING in src/ reads it. A plausible-sounding rationale
 * here would be a fabrication on the provenance channel, which is worse than
 * no badge at all.
 *
 * ⚠ TRAP 3b — BIND TO THE SURFACE THE DEPLOYED BUILD MOUNTS. The first test is
 * a mount-path assertion, reusing the identity markers TopBar.overlaySurface
 * .spec.tsx pinned against the deployed staging chunk.
 *
 * ⚠ TRAP 19 — BIND BY IDENTITY. The badge's truth condition is a CONJUNCTION:
 * "the surface THIS bar owns is raised" AND "the assistant raised it". Either
 * conjunct alone is satisfiable by a state where the badge would be a lie, so
 * both are pinned with a discriminating pair below.
 *
 * ⚠ WHAT jsdom CANNOT PROVE. `css: false` in vitest.config.ts means CSS-module
 * lookups return the key regardless of whether any rule exists — a className
 * assertion here would pass against a class that generates NO CSS, which is
 * exactly the defect a sibling PR shipped tonight (`text-text-muted`). The
 * style guard below therefore reads TopBar.module.css FROM DISK. Visibility,
 * layout and contrast are proven only in a real browser; the PR body carries
 * those readings separately.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from '../TopBar'
import {
  OVERLAY_ATTRIBUTION_TEXT,
  OVERLAY_DISMISS_HINT,
} from '../KebabMenu'
import { ToastProvider } from '../../../canvas/ToastContext'
import { useUIStore, type OverlaySurfaceId } from '../../../stores/uiStore'

/** The exact sentences the product is allowed to make.
 *
 * ⚠ These are asserted as LITERALS as well as imported. Importing alone would
 * be a guard agreeing with itself (trap 13b): rename the constant's VALUE to
 * anything — including an invented rationale — and an import-only test stays
 * green. The literal is what makes a copy change come through this test. */
const ATTRIBUTION_TEXT = 'Opened by Olumi'
const DISMISS_HINT = 'Esc to dismiss'

/** A surface id this bar does NOT own — stands in for a future sibling surface
 *  so the identity binding is pinned now rather than when it starts to matter. */
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

/** The assistant's ONLY reach into the UI: the non-render store seam
 *  applyV5State holds. Deliberately not a component handler — calling a prop
 *  would prove nothing about the gesture path. */
function assistantRaises(surface: OverlaySurfaceId) {
  act(() => {
    useUIStore.getState().requestOverlaySurface(surface)
  })
}

/** The user's seam: a click, Escape, or click-outside all run this. */
function userRaises(surface: OverlaySurfaceId) {
  act(() => {
    useUIStore.getState().setOverlaySurface(surface)
  })
}

function queryBadge() {
  return screen.queryByTestId('overlay-origin-badge')
}

describe('TopBar kebab menu — attribution for an assistant-raised surface', () => {
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
    expect(screen.getByRole('button', { name: /version history/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /more options/i })).toBeInTheDocument()
  })

  // ── THE CAPABILITY ───────────────────────────────────────────────────────
  it('says the assistant opened the menu, in the menu, when the assistant opened it', () => {
    renderTopBar()
    expect(queryBadge()).not.toBeInTheDocument()

    assistantRaises('top_bar_menu')

    const badge = queryBadge()
    expect(badge).toBeInTheDocument()
    // Positive outcome, not a non-emptiness check: the exact sentence.
    expect(badge).toHaveTextContent(ATTRIBUTION_TEXT)
    expect(badge).toHaveTextContent(DISMISS_HINT)
    // It lives INSIDE the surface it explains — the answer is where the
    // question is asked, not somewhere the user has to hunt for it.
    expect(within(screen.getByRole('menu')).getByTestId('overlay-origin-badge')).toBe(badge)
  })

  it('names the origin to assistive technology as well as on screen', () => {
    renderTopBar()
    assistantRaises('top_bar_menu')
    // A menu that appears unprompted is exactly the case where a screen-reader
    // user is most disoriented, and a bare <div> inside role="menu" is not
    // reliably announced. The accessible NAME of the menu carries it.
    expect(screen.getByRole('menu')).toHaveAccessibleName(
      new RegExp(ATTRIBUTION_TEXT),
    )
  })

  // ── HONESTY: the badge must not appear over a menu the USER opened ───────
  it('says nothing when the USER opened the menu', () => {
    renderTopBar()

    userRaises('top_bar_menu')

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(queryBadge()).not.toBeInTheDocument()
    expect(screen.getByRole('menu')).not.toHaveAccessibleName(
      new RegExp(ATTRIBUTION_TEXT),
    )
  })

  it('says nothing when the user opens the menu with the kebab button', () => {
    renderTopBar()

    fireEvent.click(screen.getByRole('button', { name: /more options/i }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(useUIStore.getState().overlaySurfaceOrigin).toBe('user')
    expect(queryBadge()).not.toBeInTheDocument()
  })

  // ── TRAP 19 — the DISCRIMINATING PAIR on the conjunction ─────────────────
  // Conjunct A ("assistant raised it") alone: a foreign surface raised by the
  // assistant must NOT badge this bar. Conjunct B ("this bar's surface is up")
  // alone: a user-raised top_bar_menu must NOT badge. Loosen the guard to
  // EITHER conjunct and one of these REDs; both together are the only state
  // in which the sentence is true.
  it('does not badge when an assistant-raised surface is one this bar does not own', () => {
    renderTopBar()

    act(() => {
      useUIStore.setState({
        activeOverlaySurface: FOREIGN_SURFACE,
        overlaySurfaceOrigin: 'assistant',
      })
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(queryBadge()).not.toBeInTheDocument()
  })

  // ── THE BADGE CANNOT OUTLIVE THE FACT IT DESCRIBES ───────────────────────
  it('disappears when the user dismisses the assistant-raised menu with Escape', () => {
    renderTopBar()
    assistantRaises('top_bar_menu')
    expect(queryBadge()).toBeInTheDocument()

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(queryBadge()).not.toBeInTheDocument()
    expect(useUIStore.getState().overlaySurfaceOrigin).toBeNull()
  })

  it('disappears when the user clicks outside the assistant-raised menu', () => {
    renderTopBar()
    assistantRaises('top_bar_menu')
    expect(queryBadge()).toBeInTheDocument()

    act(() => {
      fireEvent.mouseDown(document.body)
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(queryBadge()).not.toBeInTheDocument()
  })

  it('disappears when the user takes the surface over by re-opening it themselves', () => {
    renderTopBar()
    assistantRaises('top_bar_menu')
    expect(queryBadge()).toBeInTheDocument()

    // Close via the kebab button, then re-open it — the second raise is the
    // user's, and the store re-stamps the origin.
    fireEvent.click(screen.getByRole('button', { name: /more options/i }))
    fireEvent.click(screen.getByRole('button', { name: /more options/i }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(useUIStore.getState().overlaySurfaceOrigin).toBe('user')
    expect(queryBadge()).not.toBeInTheDocument()
  })

  it('does not survive the bar unmounting and remounting', () => {
    const first = renderTopBar()
    assistantRaises('top_bar_menu')
    expect(queryBadge()).toBeInTheDocument()

    first.unmount()
    renderTopBar()

    expect(queryBadge()).not.toBeInTheDocument()
  })

  // ── IT MUST NOT INVENT A REASON ──────────────────────────────────────────
  it('claims only who and how to dismiss — never a rationale it cannot know', () => {
    renderTopBar()
    assistantRaises('top_bar_menu')

    // The two claims, each pinned exactly — a positive outcome, not a
    // non-emptiness check (`not.toBe('')` passes when nothing renders).
    expect(screen.getByTestId('overlay-origin-label')).toHaveTextContent(
      new RegExp(`^${ATTRIBUTION_TEXT}$`),
    )
    expect(screen.getByTestId('overlay-origin-dismiss-hint')).toHaveTextContent(
      new RegExp(`^${DISMISS_HINT}$`),
    )
    // ...and the badge contains NOTHING ELSE. This is the conjunct that stops a
    // rationale being appended somewhere the two assertions above cannot see.
    const text = (queryBadge()?.textContent ?? '').replace(/\s+/g, ' ').trim()
    expect(text).toBe(`${ATTRIBUTION_TEXT}${DISMISS_HINT}`)

    // The constants the component actually renders from are the same ones.
    expect(OVERLAY_ATTRIBUTION_TEXT).toBe(ATTRIBUTION_TEXT)
    expect(OVERLAY_DISMISS_HINT).toBe(DISMISS_HINT)

    // And no causal claim smuggled in. `note` is the only reason-carrier on the
    // 0.39.0 wire and nothing in src/ reads it, so any of these would be made up.
    for (const forbidden of [/because/i, /so that/i, /to help you/i, /I thought/i]) {
      expect(text).not.toMatch(forbidden)
    }
  })

  // ── THE DEAD-CLASS GUARD (read from disk, not from a className string) ────
  // vitest runs with `css: false`, so `styles.overlayOriginBadge` resolves to a
  // truthy string whether or not any rule exists. A sibling PR shipped exactly
  // that defect tonight. This reads the stylesheet itself.
  it('the badge class actually exists in TopBar.module.css and follows DS v5 §3.2', () => {
    // ⚠ `?raw` is NOT usable here: with `css: false`, vitest's CSS-module stub
    // intercepts `*.module.css` and returns a key-echoing Proxy, so
    // `topBarCss.length` came back as the STRING "length" — an instrument that
    // reads nothing and agrees with everything. Read the file directly.
    const cssPath = resolve(process.cwd(), 'src/components/layout/TopBar.module.css')
    const css = readFileSync(cssPath, 'utf8')

    // Positive control for the instrument itself, BEFORE any absence claim: a
    // wrong cwd or a moved file must RED here rather than make every assertion
    // below vacuously true (trap 13 — an absence probe needs to prove it can
    // see a presence).
    expect(typeof css).toBe('string')
    expect(css.length).toBeGreaterThan(1000)
    expect(css).toContain('.dropdownMenu')

    const block = css.match(/\.overlayOriginBadge\s*\{([^}]*)\}/)
    expect(block, '.overlayOriginBadge has no rule in TopBar.module.css').not.toBeNull()
    const body = block![1]

    // DS v5 §3.2 / DESIGN_SYSTEM.md: outlined pills only — transparent
    // background, body-coloured INK, the colour carried on the BORDER. The
    // sibling lane's 2.80:1 failure came from colouring the text instead.
    expect(body).toMatch(/background:\s*transparent/)
    expect(body).toMatch(/color:\s*var\(--text-body/)
    expect(body).toMatch(/border:\s*1px solid/)
    // Never a filled pill.
    expect(body).not.toMatch(/background:\s*var\(--info/)
  })
})
