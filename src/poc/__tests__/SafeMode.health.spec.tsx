/**
 * Health check opt-in test
 * Verifies no network request unless VITE_ENABLE_PLOT_HEALTH=true
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import SafeMode from '../SafeMode'

describe('SafeMode - Health Check Opt-In', () => {
  const originalFetch = global.fetch
  const fetchSpy = vi.fn()

  beforeEach(() => {
    global.fetch = fetchSpy
    fetchSpy.mockResolvedValue({
      json: async () => ({ status: 'ok' })
    } as Response)
  })

  afterEach(() => {
    global.fetch = originalFetch
    cleanup()
    vi.clearAllMocks()
  })

  it('does not call /health when VITE_ENABLE_PLOT_HEALTH is unset', () => {
    // Ensure flag is not set (delete from env)
    delete (import.meta as any).env.VITE_ENABLE_PLOT_HEALTH
    
    render(<SafeMode />)
    
    // Verify fetch was NOT called
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not call /health when VITE_ENABLE_PLOT_HEALTH=false', () => {
    vi.stubEnv('VITE_ENABLE_PLOT_HEALTH', 'false')
    
    render(<SafeMode />)
    
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls /health when VITE_ENABLE_PLOT_HEALTH=true', async () => {
    vi.stubEnv('VITE_ENABLE_PLOT_HEALTH', 'true')
    
    render(<SafeMode />)
    
    // Wait a tick for useEffect to run
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Verify fetch was called
    expect(fetchSpy).toHaveBeenCalled()
    const callUrl = fetchSpy.mock.calls[0][0]
    expect(callUrl).toContain('/health')
  })
})
