import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

// Speed up polling by enabling E2E mode in this test only
vi.mock('../../flags', () => ({ isE2EEnabled: () => true, isCanvasEnabled: () => false, isScenariosEnabled: () => false }))

vi.mock('../config', () => ({ getGatewayBaseUrl: () => '' }))

import HealthIndicator from '../../components/HealthIndicator'

describe('HealthIndicator', () => {
  beforeEach(() => {})
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('success → Connected', async () => {
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue({ ok: true } as any)
    render(<HealthIndicator />)
    // Runs immediately; flush microtasks
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    const dot = screen.getByTestId('health-dot')
    expect(dot.getAttribute('title') || '').toMatch(/^Connected — checked \d+s ago$/)
    expect(fetchSpy).toHaveBeenCalled()
  })

  it('timeout/non-200 → Offline', async () => {
    const seq: Array<{ ok: boolean }> = [{ ok: false }]
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockImplementation(async () => {
      return seq.shift() ?? ({ ok: false } as any)
    })

    render(<HealthIndicator />)
    // First probe runs immediately and fails
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    const dot = screen.getByTestId('health-dot')
    expect(dot.getAttribute('title') || '').toMatch(/^Offline — checked \d+s ago$/)
  })
})
