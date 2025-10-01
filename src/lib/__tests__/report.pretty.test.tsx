import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react'
import { mockFlags } from '../../tests/__helpers__/mockFlags'

vi.mock('../../lib/runReport', () => ({
  fetchRunReport: async () => ({
    seed: 55,
    route: 'critique',
    startedAt: '2025-09-23T18:00:00.000Z',
    finishedAt: '2025-09-23T18:00:01.000Z',
    totals: { inputTokens: 1, outputTokens: 1 },
    steps: [{ id: 'a', type: 'plan', status: 'ok', attempts: 1, durationMs: 1 }],
  }),
}))

describe('RunReportDrawer Pretty JSON (flag-gated)', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFlags({ isRunReportEnabled: () => true })
    try {
      localStorage.setItem('feature.reportPretty', '1')
      localStorage.removeItem('report.pretty')
    } catch {}
  })

  it('toggle renders pretty JSON with indentation, toggles back to minified, and persists preference when left ON', async () => {
    const { default: RunReportDrawer } = await import('../../components/RunReportDrawer')

    render(
      <RunReportDrawer open={true} sessionId="s" org="o" onClose={() => {}} />
    )

    await act(async () => { await Promise.resolve() })
    await screen.findByTestId('report-steps')

    const preFirst = await screen.findByTestId('report-json-view')
    const text0 = preFirst.textContent || ''
    expect((text0.match(/\n/g) || []).length).toBeLessThanOrEqual(1)

    const toggle = await screen.findByTestId('report-pretty-toggle') as HTMLInputElement
    expect(toggle.checked).toBe(false)
    fireEvent.click(toggle)

    const prettyView = await screen.findByTestId('report-json-view')
    const text1 = prettyView.textContent || ''
    // Heuristic: pretty JSON should contain multiple newlines and spaces
    expect((text1.match(/\n/g) || []).length).toBeGreaterThan(3)
    expect(text1).toContain('  "seed": 55')

    // Toggle OFF → minified again
    fireEvent.click(toggle)
    const text2 = (await screen.findByTestId('report-json-view')).textContent || ''
    expect((text2.match(/\n/g) || []).length).toBeLessThanOrEqual(1)

    // Leave ON for persistence
    fireEvent.click(toggle)

    // Preference persists
    cleanup()
    const { default: RunReportDrawer2 } = await import('../../components/RunReportDrawer')
    render(
      <RunReportDrawer2 open={true} sessionId="s" org="o" onClose={() => {}} />
    )
    await act(async () => { await Promise.resolve() })
    await screen.findByTestId('report-steps')
    const toggle2 = await screen.findByTestId('report-pretty-toggle') as HTMLInputElement
    expect(toggle2.checked).toBe(true)
  })
})
