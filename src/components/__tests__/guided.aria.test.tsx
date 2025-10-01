import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock flags before importing component
vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => false,
  isConfigDrawerEnabled: () => false,
  isJobsProgressEnabled: () => false,
  isConfidenceChipsEnabled: () => false,
  isTelemetryEnabled: () => false,
  isHintsEnabled: () => false,
  isParamsEnabled: () => false,
  isHistoryEnabled: () => false,
  isHistoryRerunEnabled: () => false,
  isExportEnabled: () => false,
  isCanvasEnabled: () => false,
  isCanvasDefaultEnabled: () => false,
  isScenarioImportPreviewEnabled: () => false,
  isMarkdownPreviewEnabled: () => false,
  isShortcutsEnabled: () => false,
  isCopyCodeEnabled: () => false,
  isScenariosEnabled: () => false,
  // Feature flags under test
  isGuidedV1Enabled: () => true,
  isCanvasSimplifyEnabled: () => true,
}))

import SandboxStreamPanel from '../../components/SandboxStreamPanel'

describe('Guided Mode ARIA and behaviour', () => {
  it('applies a suggestion and announces; Undo restores and announces', async () => {
    render(<SandboxStreamPanel />)

    const sugg = await screen.findByTestId('guided-suggestion-0')
    // Simplify toggle present and initially off
    const chk = await screen.findByTestId('simplify-toggle') as HTMLInputElement
    expect(chk.checked).toBe(false)

    fireEvent.click(sugg)

    // ARIA polite live region should contain message
    const statuses = await screen.findAllByRole('status')
    const hasApplied = statuses.some((el) => (el.textContent || '').toLowerCase().includes('suggestion applied'))
    expect(hasApplied).toBe(true)

    // Simplify toggled
    const chk2 = await screen.findByTestId('simplify-toggle') as HTMLInputElement
    expect(chk2.checked).toBe(true)

    // Undo restores
    const undo = await screen.findByTestId('guided-undo-btn')
    fireEvent.click(undo)
    const statuses2 = await screen.findAllByRole('status')
    const hasUndone = statuses2.some((el) => (el.textContent || '').includes('Undone.'))
    expect(hasUndone).toBe(true)

    const chk3 = await screen.findByTestId('simplify-toggle') as HTMLInputElement
    expect(chk3.checked).toBe(false)
  })
})
