/**
 * ⭐⭐ AN ICON BUTTON IS ITS ACCESSIBLE NAME — there is nothing else to read.
 *
 * Both name sites read `ariaLabel ?? tooltip`. `??` falls back on null and
 * undefined ONLY, so a consumer handing this primitive a label built from DATA
 * ships `aria-label=""` the moment that data is empty: a round, pressable,
 * entirely unreachable control that every shape and style assertion applauds.
 *
 * ⚠ WHY THIS FILE EXISTS AT ALL, and it is the honest reason rather than a
 * tidy one. The fix that prompted it was first made ONLY at the Reasoning
 * panel's call site, and a mutant reverting this primitive back to `??` left
 * the panel's own suite fully GREEN — because the call site's gate meant an
 * empty label never reached here. A surviving mutant on a SHARED primitive is
 * an unguarded change to every other consumer, so the hardening is pinned here
 * where it actually lives.
 *
 * ⚠ AND `??` IS NOT WRONG BY ITSELF. `ariaLabel` is declared optional, so `??`
 * is correct for the case it was written for. The defect needs a caller passing
 * a DEFINED BUT EMPTY string, which is why the absent case below is asserted
 * alongside the empty one rather than instead of it.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Check } from 'lucide-react'
import { IconBtn } from '../primitives/IconBtn'

afterEach(cleanup)

const name = () => screen.getByRole('button').getAttribute('aria-label') ?? ''

describe('an icon button always has a name', () => {
  it('uses the explicit label when one is given', () => {
    render(<IconBtn icon={Check} tooltip="Confirm" ariaLabel="Confirm this estimate" />)
    expect(name()).toBe('Confirm this estimate')
  })

  it('⚠ falls back to the tooltip when the label is ABSENT — the case `??` was written for', () => {
    render(<IconBtn icon={Check} tooltip="Confirm" />)
    expect(name()).toBe('Confirm')
  })

  it('⛔ falls back when the label is DEFINED BUT EMPTY — the case `??` cannot see', () => {
    render(<IconBtn icon={Check} tooltip="Confirm" ariaLabel="" />)
    expect(name()).toBe('Confirm')
  })

  it('⛔ and when it is only whitespace, which reads as a name and announces as nothing', () => {
    render(<IconBtn icon={Check} tooltip="Confirm" ariaLabel="   " />)
    expect(name()).toBe('Confirm')
  })

  /**
   * ⚠ THE DISABLED BRANCH IS A SEPARATE RENDER PATH with its own name site, so
   * a fix applied to one and not the other would pass everything above.
   */
  it('⛔ the disabled branch names itself too — it is a second, independent site', () => {
    render(<IconBtn icon={Check} tooltip="Confirm" ariaLabel="" disabled />)
    const labelled = [...document.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label'))
    expect(labelled.length, 'precondition: something carries a name at all').toBeGreaterThan(0)
    expect(labelled.every((l) => (l ?? '').trim().length > 0), 'a disabled control still has to be reachable').toBe(true)
  })
})
