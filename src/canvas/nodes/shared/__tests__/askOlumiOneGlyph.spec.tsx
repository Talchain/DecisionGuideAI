/**
 * ⭐ ONE GLYPH FOR "ASK OLUMI" ON THE CARD — `MessageCircle`, exactly.
 *
 * Panel's icon ruling R3 (olumi-programme-docs#63 5796486697): "Every 'discuss /
 * work through with Olumi' action becomes `MessageCircle`." Settled for the
 * canvas by 5796609717: "`MessageCircle` exactly, on both canvas and panel …
 * `MessageCircleQuestion` would become a second glyph for the same act."
 *
 * Before the design integration the card carried TWO glyphs for that one act:
 *   · the rail's coaching icon (`NodeCoachingIcon`) — `MessageCircleQuestion`;
 *   · the hover quick action "Ask Olumi" (`NodeQuickActions`) — `MessageSquare`.
 *
 * Bound by IDENTITY: lucide stamps each icon's own kebab name as a class token
 * (`lucide-message-circle`), and `classList.contains` matches whole tokens, so
 * `lucide-message-circle-question` can never satisfy `lucide-message-circle`.
 * The CONTROL arm proves the probe tells glyphs apart (the Challenge action's
 * `Zap` reads as `lucide-zap`, not as the ask glyph).
 *
 * ⚠⚠ CONTRACT v3.1 (DESIGN-GAP-v31 #42, 26 Sep 2026) REDRAWS THE COACHING DOOR.
 * v3.1 `ICONS.coaching` is a speech bubble WITH A QUESTION MARK — lucide's
 * `MessageCircleQuestion` — and the common brief rules "where v3.1 and the
 * code's documented rulings conflict, v3.1 + Paul's rulings win; name the
 * conflict". So the RESTING coaching icon now carries
 * `lucide-message-circle-question`, and this file pins that by identity. The
 * hover quick action "Ask Olumi" (`NodeQuickActions`, WS3's region, and the
 * panel's glyph under #2057) is NOT changed by this lane and still reads
 * `lucide-message-circle`. The two carriers therefore DIFFER — the conflict
 * with Panel R3 is pinned below as a visible divergence, never a silent one,
 * and is routed to the lane owner for a ruling (one-line follow-up: the quick
 * action imports `COACHING_ICON_GLYPH`).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NodeQuickActions } from '../NodeQuickActions'
import { NodeCoachingIcon } from '../NodeCoachingIcon'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

const NODE = { id: 'node-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }

const ASK_GLYPH = 'lucide-message-circle'
/** v3.1 `ICONS.coaching` — the bubble with "?" (DESIGN-GAP-v31 #42). */
const COACHING_GLYPH = 'lucide-message-circle-question'
const RETIRED_ASK_GLYPHS = ['lucide-message-circle-question', 'lucide-message-square'] as const
const RETIRED_COACHING_GLYPHS = ['lucide-message-circle', 'lucide-message-square'] as const

/** The lucide identity token of the ONE svg inside an element. */
const glyphOf = (el: HTMLElement): string => {
  const svgs = el.querySelectorAll('svg')
  expect(svgs).toHaveLength(1)
  const token = Array.from(svgs[0].classList).find((c) => c.startsWith('lucide-'))
  expect(token).toBeDefined()
  return token as string
}

beforeEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [NODE], lodRung: 'full' } as never)
  useGuidanceStore.setState({
    _sendMessage: vi.fn(), _prefillChat: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [],
  } as never)
})

describe('"Ask Olumi" glyphs on the card — v3.1 coaching door vs Panel R3 ask', () => {
  it('the rail coaching icon is v3.1 `coaching` — MessageCircleQuestion, not the plain MessageCircle (#42)', () => {
    render(
      <NodeCoachingIcon
        nodeId="node-a"
        chips={[{ id: 'evidence', label: 'What’s the evidence?', message: 'What is the evidence for Hiring spend?', actionType: null }]}
      />,
    )
    const icon = screen.getByTestId('node-coaching-icon-node-a')
    expect(glyphOf(icon)).toBe(COACHING_GLYPH)
    for (const retired of RETIRED_COACHING_GLYPHS) expect(icon.querySelector(`svg.${retired}`)).toBeNull()
  })

  it('the hover quick action "Ask Olumi" is MessageCircle, not MessageSquare', () => {
    // Paul 23 Sep contract feedback point 6: at Normal zoom the resting coaching
    // icon is the card's Ask Olumi door and the hover ask is withheld; the hover
    // ask renders at the quiet rung, where the resting icon is hidden.
    useCanvasStore.setState({ lodRung: 'quiet' } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    const ask = screen.getByTestId('node-action-ask-node-a')
    expect(ask).toHaveAccessibleName('Ask Olumi about Hiring spend')
    expect(glyphOf(ask)).toBe(ASK_GLYPH)
    for (const retired of RETIRED_ASK_GLYPHS) expect(ask.querySelector(`svg.${retired}`)).toBeNull()
  })

  it('⚠ RULING CONFLICT PINNED — the coaching door (v3.1 #42) and the hover ask (Panel R3) now render DIFFERENT glyphs', () => {
    // Was "both carriers of the one act render the SAME glyph". v3.1 redrew the
    // coaching door; the hover ask is outside this lane. If the lane owner rules
    // "one glyph" again, the quick action imports `COACHING_ICON_GLYPH` and this
    // assertion flips to equality.
    render(
      <NodeCoachingIcon
        nodeId="node-a"
        chips={[{ id: 'evidence', label: 'What’s the evidence?', message: 'What is the evidence?', actionType: null }]}
      />,
    )
    const coaching = glyphOf(screen.getByTestId('node-coaching-icon-node-a'))
    cleanup()
    useCanvasStore.setState({ lodRung: 'quiet' } as never) // point 6: the hover ask's rung
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    expect(coaching).toBe(COACHING_GLYPH)
    expect(glyphOf(screen.getByTestId('node-action-ask-node-a'))).toBe(ASK_GLYPH)
  })

  it('Paul 23 Sep point 6 — at Normal zoom the rail carries ONE Ask Olumi door: the resting icon, v3.1 glyph, no hover twin', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    expect(screen.queryByTestId('node-action-ask-node-a')).toBeNull()
    const icon = screen.getByTestId('node-coaching-icon-node-a')
    expect(icon).toHaveAccessibleName('Ask Olumi about Hiring spend')
    expect(glyphOf(icon)).toBe(COACHING_GLYPH)
  })

  it('CONTROL — a different act keeps its own glyph, so the probe discriminates', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    const challenge = screen.getByRole('button', { name: 'Challenge Hiring spend' })
    expect(glyphOf(challenge)).toBe('lucide-zap')
    expect(glyphOf(challenge)).not.toBe(ASK_GLYPH)
    expect(glyphOf(challenge)).not.toBe(COACHING_GLYPH)
  })
})
