/**
 * ⭐ HOVERING A NODE ICON SAYS SOMETHING — IN THE PAGE, NOT IN OS CHROME.
 *
 * The founder, driving the deployed canvas (6 Sep 2026): *"if you hover over any
 * individual icon, it doesn't tell you what it is or what to do about it (with a
 * hover state of any kind or something like that)."*
 *
 * The affordance was never missing. It was NATIVE: a bare `title=` attribute,
 * which paints OS chrome after the platform's own ~1s dwell and changes nothing
 * about the icon in the meantime — so a hover that "does nothing" for a full
 * second reads as an inert glyph. Measured at `80bacf36`: **47 `title=` sites
 * across `src/canvas/nodes` production files against ONE `<Tooltip>`.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ WHAT THIS SPEC CAN AND CANNOT ESTABLISH — READ BEFORE TRUSTING IT
 * ─────────────────────────────────────────────────────────────────────────────
 * **jsdom has no layout and no paint.** It cannot establish that the bubble is
 * VISIBLE, that it is positioned near its icon, that it escapes the node card's
 * overflow, or that it is legible at the canvas's post-draft zoom. Every one of
 * those is a browser claim and NONE of them is asserted here — a
 * `getByRole('tooltip')` that passes in jsdom is fully consistent with a bubble
 * painted at 0×0 behind the card.
 *
 * What it DOES establish, which is the part that regressed: that hovering
 * mounts an in-page `role="tooltip"` element carrying the icon's own sentence,
 * that the sentence is the SAME string as the accessible name (one source, two
 * channels), and that the native `title` is gone so the two do not both paint.
 *
 * The visible-in-a-browser half is UNMEASURED by this lane and is recorded as
 * such rather than implied.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ WHY EVERY QUERY BINDS BY TESTID OR EXACT ACCESSIBLE NAME
 * ─────────────────────────────────────────────────────────────────────────────
 * `getByRole('tooltip')` alone would pass on ANY tooltip the tree happened to
 * render, including a sibling icon's. Each case therefore hovers ONE glyph found
 * by its own testid and asserts the bubble's text equals THAT glyph's
 * `aria-label`, read off the element under test rather than typed here.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BriefIcon, BRIEF_ICON_LABEL } from '../BriefIcon'
import { NodeProvenanceMark } from '../NodeProvenanceMark'
import { NODE_TOOLTIP_DELAY_MS } from '../nodeTooltip'

/** Long enough for the 300ms open delay plus floating-ui's async positioning. */
const OPEN = { timeout: NODE_TOOLTIP_DELAY_MS + 1500 }

/** A structural card — an option, the shape `NodeProvenanceMark` speaks for. */
const option = (provenance: string) => ({ label: 'Rebuild', type: 'option', provenance })

/**
 * Hover the glyph `el`, wait for the bubble, and return its text.
 *
 * Integration update (9 Sep): the earlier wrapper-based implementation needed
 * hover on the parent. The existing asChild API now attaches the listeners to
 * the glyph itself, which is the element these tests exercise.
 *
 * ⚠ It asserts the bubble is ABSENT before hovering. Without that, a component
 * that rendered its tooltip unconditionally — i.e. one with no hover behaviour
 * at all — would satisfy every assertion below. The precondition is what makes
 * the post-hover reading evidence about HOVERING rather than about rendering.
 */
async function hoverText(el: HTMLElement): Promise<string> {
  expect(screen.queryByRole('tooltip')).toBeNull()
  // Integration with #1333: asChild makes the glyph itself the reference.
  fireEvent.mouseEnter(el)
  const tip = await screen.findByRole('tooltip', {}, OPEN)
  return tip.textContent ?? ''
}

describe('node icons answer a hover in the page', () => {
  it('BriefIcon — hovering paints its sentence, and it matches the accessible name', async () => {
    render(<BriefIcon />)
    const icon = screen.getByTestId('brief-icon')
    // Derived from the element, not re-typed: a literal here would keep passing
    // if the component and this spec drifted apart together.
    expect(icon.getAttribute('aria-label')).toBe(BRIEF_ICON_LABEL)
    expect(await hoverText(icon)).toContain(icon.getAttribute('aria-label')!)
  })

  /**
   * ⭐ THE FOUNDER'S OWN EXAMPLE. This mark was converted from a text pill to a
   * glyph ON HIS RULING that identical copy on every card is furniture and
   * *"they should all be icons with hoverover states"* — and shipped with a
   * native `title` as its only hover state. This is the case that closes it.
   */
  it('NodeProvenanceMark — hovering paints the provenance claim, from one source', async () => {
    render(<NodeProvenanceMark nodeType="option" data={option('ai_inferred')} />)
    const mark = screen.getByTestId('node-provenance-mark')
    const claim = mark.getAttribute('aria-label')!
    expect(claim.length).toBeGreaterThan(0)
    expect(await hoverText(mark)).toContain(claim)
  })

  /**
   * ⛔ NO DOUBLE TOOLTIP. A styled bubble beside a surviving `title=` paints
   * BOTH — the bubble at 300ms, OS chrome over it a moment later, saying the
   * same sentence twice. Pinned so it cannot come back on either glyph.
   */
  it.each([
    ['brief-icon', <BriefIcon key="b" />],
    ['node-provenance-mark', <NodeProvenanceMark key="p" nodeType="option" data={option('from_brief')} />],
  ])('%s carries NO native title alongside its tooltip', (testid, element) => {
    render(<div title="Outside your control">{element}</div>)
    // Empty rather than absent: blocks the ancestor's native title too.
    expect(screen.getByTestId(testid)).toHaveAttribute('title', '')
  })

  /**
   * ⚠ THE ACCESSIBLE NAME IS THE CHANNEL THAT SURVIVES NO-HOVER. Touch has no
   * hover and these glyphs are deliberately not tab stops, so a hover-only
   * treatment would make the claim unreachable for those users. `title` at least
   * fed the accessible-name fallback; removing it without an explicit name would
   * have been a net LOSS, which is why this is asserted and not assumed.
   */
  it.each([
    ['brief-icon', <BriefIcon key="b" />],
    ['node-provenance-mark', <NodeProvenanceMark key="p" nodeType="option" data={option('from_brief')} />],
  ])('%s keeps an explicit accessible name, reachable with no hover and no focus', (testid, element) => {
    render(element)
    const el = screen.getByTestId(testid)
    expect(el.getAttribute('role')).toBe('img')
    expect(el.getAttribute('aria-label')).toBeTruthy()
  })

  /**
   * ⚠ THE SHARED-BEAT PROPERTY IS GUARDED IN `nodeTooltipDelayParity.spec.tsx`,
   * NOT HERE, AND THE REASON IS THAT THE VERSION THAT LIVED HERE WAS VACUOUS.
   *
   * It read `expect(NODE_TOOLTIP_DELAY_MS).toBe(300)` under the name *"all three
   * open on the one shared beat"*, and it failed in the wrong direction on BOTH
   * sides: an adopter drifting to `delay={200}` left it GREEN (it never looked at
   * an adopter), while moving the constant to 250 turned it RED (the adopters
   * would still agree, so its own name would still be true). A constant's VALUE
   * is not the property; the property is that every adopter RESOLVES to the same
   * delay, which needs the adopters in the measurement.
   *
   * That guard mocks `Tooltip` to capture the `delay` each adopter actually
   * passes, so it cannot live in this file — `vi.mock` is file-scoped and these
   * cases need the real Tooltip to paint a real bubble.
   */
})
