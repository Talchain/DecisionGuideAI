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
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NodeQuickActions } from '../NodeQuickActions'
import { NodeCoachingIcon } from '../NodeCoachingIcon'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

const NODE = { id: 'node-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }

const ASK_GLYPH = 'lucide-message-circle'
const RETIRED_ASK_GLYPHS = ['lucide-message-circle-question', 'lucide-message-square'] as const

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

describe('"Ask Olumi" is ONE glyph on the card — MessageCircle (Panel R3)', () => {
  it('the rail coaching icon is MessageCircle, not MessageCircleQuestion', () => {
    render(
      <NodeCoachingIcon
        nodeId="node-a"
        chips={[{ id: 'evidence', label: 'What’s the evidence?', message: 'What is the evidence for Hiring spend?', actionType: null }]}
      />,
    )
    const icon = screen.getByTestId('node-coaching-icon-node-a')
    expect(glyphOf(icon)).toBe(ASK_GLYPH)
    for (const retired of RETIRED_ASK_GLYPHS) expect(icon.querySelector(`svg.${retired}`)).toBeNull()
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

  it('both carriers of the one act render the SAME glyph', () => {
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
    expect(glyphOf(screen.getByTestId('node-action-ask-node-a'))).toBe(coaching)
  })

  it('Paul 23 Sep point 6 — at Normal zoom the rail carries ONE Ask Olumi door: the resting icon, same glyph, no hover twin', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    expect(screen.queryByTestId('node-action-ask-node-a')).toBeNull()
    const icon = screen.getByTestId('node-coaching-icon-node-a')
    expect(icon).toHaveAccessibleName('Ask Olumi about Hiring spend')
    expect(glyphOf(icon)).toBe(ASK_GLYPH)
  })

  it('CONTROL — a different act keeps its own glyph, so the probe discriminates', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    const challenge = screen.getByRole('button', { name: 'Challenge Hiring spend' })
    expect(glyphOf(challenge)).toBe('lucide-zap')
    expect(glyphOf(challenge)).not.toBe(ASK_GLYPH)
  })
})
