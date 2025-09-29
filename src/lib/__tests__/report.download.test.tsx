import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { mockFlags } from '../../tests/__helpers__/mockFlags'

vi.mock('../../lib/runReport', () => ({
  fetchRunReport: async () => ({
    seed: 1234,
    userId: 'tester',
    route: 'critique',
    traceId: 't',
    startedAt: '2025-09-23T18:00:00.000Z',
    finishedAt: '2025-09-23T18:00:05.250Z',
    totals: { inputTokens: 10, outputTokens: 2 },
    steps: [{ id: 's', type: 'plan', status: 'ok', attempts: 1, durationMs: 5 }],
  }),
}))

describe('RunReportDrawer Download JSON (flag-gated)', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFlags({ isRunReportEnabled: () => true })
    try { localStorage.setItem('feature.reportDownload', '1') } catch {}
  })

  it('shows Download JSON when flag ON; clicking downloads and shows toast that auto-hides', async () => {
    const { default: RunReportDrawer } = await import('../../components/RunReportDrawer')

    const createObjectURL = vi.fn(() => 'blob:fake-url')
    const revokeObjectURL = vi.fn(() => {})
    // Prevent JSDOM navigation on <a>.click()
    const clickSpy = vi.spyOn(HTMLElement.prototype as any, 'click').mockImplementation(() => {})
    const realCreate = document.createElement.bind(document)
    let lastA: HTMLAnchorElement | null = null
    vi.spyOn(document, 'createElement').mockImplementation((tagName: any) => {
      if (String(tagName).toLowerCase() === 'a') {
        const a = realCreate('a') as HTMLAnchorElement
        lastA = a
        return a
      }
      return realCreate(tagName)
    })
    ;(globalThis as any).URL = { ...(globalThis as any).URL, createObjectURL, revokeObjectURL }

    render(
      <RunReportDrawer
        open={true}
        sessionId="s"
        org="o"
        onClose={() => {}}
      />
    )

    // Allow fetch to resolve and UI to render
    await act(async () => { await Promise.resolve() })
    await screen.findByTestId('report-steps')

    const btn = await screen.findByTestId('report-download-btn')
    fireEvent.click(btn)

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    // Allow revokeObjectURL setTimeout(0) to flush
    await new Promise((r) => setTimeout(r, 0))
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    const dlName = (lastA as any)?.getAttribute?.('download') ?? ''
    expect(String(dlName)).toBe('report_v1_seed-1234.json')

    // Toast appears then hides
    expect(await screen.findByTestId('report-download-toast')).toBeTruthy()
    await new Promise((r) => setTimeout(r, 1300))
    expect(screen.queryByTestId('report-download-toast')).toBeNull()
    clickSpy.mockRestore()
  })
})
