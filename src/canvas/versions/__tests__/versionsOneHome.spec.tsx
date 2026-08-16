/**
 * R4 — ONE HOME FOR VERSION HISTORY, AND NO FLOATING PILL.
 *
 * Paul ruled on 16 Aug 2026 that the floating "Versions" trigger dies. The
 * defect it caused (ledger L-08) was not bad arithmetic — the offset module it
 * shipped with was carefully derived from the dock's own width token — it was a
 * control anchored to the viewport instead of to a header row, which put it out
 * over open canvas whenever the dock collapsed.
 *
 * ⚠ SCOPE, stated precisely (trap 16): jsdom proves PRESENCE, structure and
 * class/style attributes. It cannot prove where anything lands on a real screen.
 * What these tests pin is that the trigger DECLARES no positioning and that the
 * host renders no trigger of its own — i.e. that the mechanism which produced
 * L-08 is absent by construction. A browser witness is still owed for layout.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { VersionsTrigger, VERSIONS_TRIGGER_LABEL } from '../VersionsTrigger'
import type { VersionsTriggerVariant } from '../VersionsTrigger'
import { VersionsPanelHost } from '../VersionsPanelHost'
import { useVersionsPanelStore, openVersionsPanel } from '../versionsPanelStore'

/** Tokens that would recreate the floating pill. */
const POSITIONING_CLASS_TOKENS = ['absolute', 'fixed', 'sticky']
const POSITIONING_STYLE_PROPS = ['position', 'top', 'right', 'bottom', 'left', 'zIndex'] as const

beforeEach(() => {
  localStorage.clear()
  useVersionsPanelStore.setState({ isOpen: false })
})

describe('R4 — the floating versions pill is retired', () => {
  it('has deleted the trigger-position module rather than re-homing it', () => {
    // A DERIVED retirement guard, not a comment. The module existed solely to
    // keep a floating trigger clear of a floating dock; if it reappears, the
    // floating trigger has reappeared with it.
    //
    // ⚠ THE PATH IS BUILT FROM `process.cwd()`, NOT FROM `import.meta.url`.
    // The obvious `new URL('../versionsTriggerPosition.ts', import.meta.url)`
    // is a pattern VITE CLAIMS: it rewrites it into an ASSET reference, so at
    // runtime it resolved to `http://localhost:3000/src/...` and `existsSync`
    // returned false for a file that was sitting right there. Measured — the
    // first draft of this test PASSED against a tree that still had the module
    // (trap 13: an absence probe with no positive control).
    const dir = join(process.cwd(), 'src', 'canvas', 'versions')

    // POSITIVE CONTROL, same probe, same directory: prove this check can see a
    // file that exists before believing it about one that does not.
    expect(existsSync(join(dir, 'versionLabels.ts'))).toBe(true)

    expect(existsSync(join(dir, 'versionsTriggerPosition.ts'))).toBe(false)
  })

  // ⚠ EVERY VARIANT, and this is not belt-and-braces. The first draft of this
  // test rendered only `labelled`, and a mutant that gave the `icon` branch
  // `absolute z-[1500]` SURVIVED it — the component has two independent
  // className expressions and the test was watching one of them. Derived from
  // the exported union so a third variant cannot be added past this guard.
  it.each<VersionsTriggerVariant>(['icon', 'labelled'])(
    'renders a %s trigger that declares no positioning of its own',
    (variant) => {
      const { container } = render(<VersionsTrigger variant={variant} />)

      // Every element the component renders, not just the root — a wrapper is
      // exactly where a position would be smuggled back in.
      const elements = Array.from(container.querySelectorAll<HTMLElement>('*'))
      expect(elements.length).toBeGreaterThan(0)

      for (const element of elements) {
        const classes = element.className.toString()
        for (const token of POSITIONING_CLASS_TOKENS) {
          expect(classes.split(/\s+/)).not.toContain(token)
        }
        // Tailwind's arbitrary z-index form, e.g. the retired pill's `z-[1500]`.
        expect(classes).not.toMatch(/(^|\s)z-\[/)
        expect(classes).not.toMatch(/(^|\s)z-\d/)

        for (const prop of POSITIONING_STYLE_PROPS) {
          expect(element.style[prop]).toBe('')
        }
      }
    },
  )

  it('renders NOTHING from the panel host while the panel is closed', () => {
    // The host used to render the pill here whenever the panel was shut. That
    // is the whole surface the ruling removes, so a closed host must be empty.
    const { container } = render(<VersionsPanelHost />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('versions-panel-trigger')).not.toBeInTheDocument()
  })
})

describe('R4 — trigger and panel share one state', () => {
  it('opens the panel from a trigger mounted outside the host subtree', () => {
    // The two are deliberately rendered as SIBLINGS, because that is the new
    // production arrangement: the trigger lives in the top header bar and the
    // panel is mounted by the canvas route. Neither is an ancestor of the other.
    render(
      <>
        <VersionsTrigger />
        <VersionsPanelHost />
      </>,
    )

    expect(screen.queryByTestId('what-changed-panel')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: VERSIONS_TRIGGER_LABEL }))

    expect(screen.getByTestId('what-changed-panel')).toBeInTheDocument()
  })

  it('reports its own open state, and closes what it opened', () => {
    render(
      <>
        <VersionsTrigger />
        <VersionsPanelHost />
      </>,
    )
    const trigger = screen.getByRole('button', { name: VERSIONS_TRIGGER_LABEL })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('what-changed-panel')).not.toBeInTheDocument()
  })

  it('keeps two mounted triggers in agreement about whether the panel is open', () => {
    // The top bar's trigger and the cockpit lane's panel-header trigger are BOTH
    // live at once. Two controls for one panel must never disagree — which is
    // the reason the open flag is a store rather than either one's useState.
    render(
      <>
        <VersionsTrigger data-testid="trigger-topbar" />
        <VersionsTrigger data-testid="trigger-dock" />
        <VersionsPanelHost />
      </>,
    )

    fireEvent.click(screen.getByTestId('trigger-topbar'))

    expect(screen.getByTestId('trigger-topbar')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('trigger-dock')).toHaveAttribute('aria-expanded', 'true')

    // ...and the SECOND one closes what the FIRST one opened.
    fireEvent.click(screen.getByTestId('trigger-dock'))

    expect(screen.getByTestId('trigger-topbar')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('what-changed-panel')).not.toBeInTheDocument()
  })

  it('opens the panel from the imperative entry point', () => {
    render(<VersionsPanelHost />)

    act(() => {
      openVersionsPanel()
    })

    expect(screen.getByTestId('what-changed-panel')).toBeInTheDocument()
  })
})
