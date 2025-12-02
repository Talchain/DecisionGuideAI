import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DegradedBanner } from '../DegradedBanner'
import * as healthModule from '../../../lib/health'

// Small DOM test to assert that DegradedBanner uses token-backed warning classes
// when the engine health is degraded. This guards the design-system wiring.

describe('DegradedBanner design tokens', () => {
  it('uses warning token classes when health is degraded', async () => {
    const fetchHealthSpy = vi.spyOn(healthModule, 'fetchHealth').mockResolvedValue({
      status: 'degraded',
      p95_ms: 123,
    } as any)

    render(<DegradedBanner />)

    // Wait for degraded message to appear
    const message = await screen.findByText(/Engine running in degraded mode/i)

    // The token classes live on the flex container wrapping the icon + text
    const flexContainer = message.closest('div')?.parentElement as HTMLElement | null
    expect(flexContainer).not.toBeNull()
    if (!flexContainer) return

    expect(flexContainer.className).toContain('border-warning-200')
    expect(flexContainer.className).toContain('bg-warning-50')
    expect(flexContainer.className).toContain('text-warning-800')

    fetchHealthSpy.mockRestore()
  })
})
