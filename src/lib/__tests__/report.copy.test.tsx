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

describe('RunReportDrawer Copy JSON (flag-gated)', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFlags({
      isRunReportEnabled: () => true,
    })
    try { localStorage.setItem('feature.reportCopy', '1') } catch {}
  })

  it('shows Copy JSON when flag ON; clicking copies and shows toast that auto-hides', async () => {
    const { default: RunReportDrawer } = await import('../../components/RunReportDrawer')

    const writeText = vi.fn(async () => {})
    ;(globalThis as any).navigator = {
      ...(globalThis as any).navigator,
      clipboard: { writeText },
    }

    render(
      <RunReportDrawer
        open={true}
        sessionId="s"
        org="o"
        onClose={() => {}}
      />
    )

    // Allow fetch to resolve and UI to render report content
    await act(async () => { await Promise.resolve() })
    await screen.findByTestId('report-steps')
    const btn = await screen.findByTestId('report-copy-btn')
    fireEvent.click(btn)

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"seed": 1234'))

    // Toast appears
    expect(await screen.findByTestId('report-copy-toast')).toBeTruthy()
  })
})
