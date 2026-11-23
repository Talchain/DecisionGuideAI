import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LeftSidebar } from '../../../components/layout/LeftSidebar'
import { EVIDENCE_RAIL_GLYPH, NodeRailIcon } from '../../../canvas/nodes/shared/NodeRailIcons'
import { Badge } from '../../Badge'
import type { View } from '../../client'
import pricing from '../../golden/pricing.view.json'
import consulting from '../../fixtures/v11/consulting-chain.view3.json'
import { RestsShareFill } from '../../ResultBand'
import { CardViewChips } from '../../RevealMarks'
import { useViewStore } from '../../store'
import { ViewSummaryTrigger } from '../../ViewSummary'
import { ViewDriverBadge } from '../../v10'
import { laneTipOf } from '../../__tests__/tipHelpers'

vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))

const pricingView = pricing as unknown as View
const option = pricingView.model!.cards.find((card) => card.id === 'raise_price')!
const teamView = consulting as unknown as View
const restoreView = useViewStore.getState()

afterEach(() => {
  cleanup()
  useViewStore.setState(restoreView)
  vi.unstubAllEnvs()
})

describe('one hover on the Olumi lane', () => {
  it('uses the light Tip for Select, Pan and Summary with their accessible names', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    useViewStore.setState({ sid: pricingView.id, view: pricingView })
    const { container } = render(
      <>
        <LeftSidebar showUndo={false} toolShortcuts={false} />
        <ViewSummaryTrigger tooltip="Read this scenario’s summary" />
      </>,
    )

    expect(container.querySelector('[title]')).toBeNull()
    expect(laneTipOf(screen.getByRole('button', { name: 'Select mode' }))).toBe('Select')
    expect(laneTipOf(screen.getByRole('button', { name: 'Pan mode' }), 'focus')).toBe('Pan')
    expect(laneTipOf(screen.getByRole('button', { name: 'Summary' }), 'focus')).toBe('Read this scenario’s summary')
  })

  it('preserves the hover words on Detailed cards, the card rail and reveal chips', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    useViewStore.setState({ view: pricingView })
    const { container } = render(
      <>
        <ViewDriverBadge card={option} />
        <RestsShareFill card={option} />
        <NodeRailIcon testId="card-rail-evidence" label="Inspect the evidence" icon={EVIDENCE_RAIL_GLYPH.Icon} tone="muted" onActivate={() => {}} />
      </>,
    )
    const share = pricingView.model!.run!.rests.find((entry) => entry.kind === 'goal' && entry.option === option.id && entry.aim === 'profit_goal')!
    expect(container.querySelector('[title]')).toBeNull()
    expect(laneTipOf(screen.getByTestId('view-driver-raise_price'), 'focus')).toBe(option.driver!.text)
    expect(laneTipOf(container.querySelector<HTMLElement>('[data-rests-share="raise_price"]')!)).toBe(share.line)
    expect(laneTipOf(screen.getByRole('button', { name: 'Inspect the evidence' }))).toBe('Inspect the evidence')
    cleanup()

    useViewStore.setState({ view: teamView })
    const mark = teamView.collab.marks!.find((item) => item.card === 'diagnostic_time_to_contract' && item.kind === 'disagreement')!
    render(<CardViewChips card={mark.card} />)
    expect(laneTipOf(screen.getByRole('button', { name: mark.label }))).toBe(mark.title)
  })

  it('keeps the native badge title in the older look and uses Tip on the lane', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '0')
    const badge = option.badge!
    const props = { cardId: option.id, badge, at: option.id }
    const { rerender } = render(<Badge {...props} />)
    const title = screen.getByRole('button', { name: badge.label }).getAttribute('title')
    expect(title?.length).toBeGreaterThan(0)

    vi.stubEnv('VITE_OLUMI_CORE', '1')
    rerender(<Badge {...props} />)
    expect(laneTipOf(screen.getByRole('button', { name: badge.label }), 'focus')).toBe(title)
  })
})
