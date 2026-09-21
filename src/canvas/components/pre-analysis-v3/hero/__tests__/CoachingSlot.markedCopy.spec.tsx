/**
 * CoachingSlot — the pre-analysis receipt renders the SAME dialect the
 * conversation does, and still injects no HTML.
 *
 * `pickAssumption()` feeds BOTH the conversation bullet and
 * `analysis_ready.coaching_summary`. The conversation renders the dialect;
 * this slot rendered `{coaching.text}` as a plain child. One producer string,
 * two surfaces, disagreeing about markup — so a sentence CEE marked for the
 * conversation showed LITERAL ASTERISKS here. The CEE lane hit exactly that:
 * it marked twelve sites and reverted this one because the UI could not render
 * what it would send.
 *
 * ⚠ THE SUBTREE BANS `dangerouslySetInnerHTML` and the ban stays. These tests
 * pin the capability; `signals/__tests__/registry.spec.ts` independently pins
 * that it was NOT bought with an exemption.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoachingSlot } from '../CoachingSlot'

function renderSlot(text: string, displayName?: string) {
  render(
    <CoachingSlot
      coaching={{
        text,
        attribution: displayName
          ? ({ kind: 'collaborator', displayName } as never)
          : ({ kind: 'olumi' } as never),
      }}
    />,
  )
  return screen.getByTestId('pre-analysis-v3-coaching-text')
}

describe('CoachingSlot — marked producer copy', () => {
  it('renders **bold** as a <strong>, not as literal asterisks', () => {
    const body = renderSlot('One assumption worth checking: **add a new-customer factor**.')
    expect(body.querySelector('strong')?.textContent).toBe('add a new-customer factor')
    expect(body.textContent).not.toContain('**')
  })

  it('renders *italics* as an <em>', () => {
    const body = renderSlot('This is *provisional*.')
    expect(body.querySelector('em')?.textContent).toBe('provisional')
  })

  it('leaves _underscores_ alone — producer field names print in this prose', () => {
    const body = renderSlot('Check goal_threshold_unit before relying on it.')
    expect(body.textContent).toContain('goal_threshold_unit')
    expect(body.querySelector('em')).toBeNull()
  })

  it('renders UNMARKED prose byte-identically, creating no elements', () => {
    const plain = 'One assumption worth checking: Add a new-customer acquisition factor.'
    const body = renderSlot(plain)
    expect(body.textContent).toBe(plain)
    expect(body.children).toHaveLength(0)
  })

  it('renders a <script> in producer text as visible text and creates no script node', () => {
    const body = renderSlot('<script>alert(1)</script>')
    expect(body.textContent).toContain('<script>')
    expect(body.querySelector('script')).toBeNull()
  })

  it('never routes a collaborator display name through the renderer', () => {
    renderSlot('a note', '<img src=x onerror=alert(1)>')
    const slot = screen.getByTestId('pre-analysis-v3-coaching-slot')
    expect(slot.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(slot.querySelector('img')).toBeNull()
  })

  it('renders nothing at all when there is no coaching', () => {
    render(<CoachingSlot coaching={null} />)
    expect(screen.queryByTestId('pre-analysis-v3-coaching-slot')).toBeNull()
  })
})
