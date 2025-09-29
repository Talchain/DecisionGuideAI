import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  isCommentsEnabled: () => true,
  isListViewEnabled: () => true,
}))

import SandboxStreamPanel from '../../components/SandboxStreamPanel'

const COMMENTS_KEY = 'comments.v1'

describe('Comments ARIA announcements', () => {
  beforeEach(() => {
    try { localStorage.removeItem(COMMENTS_KEY) } catch {}
  })

  it('announces “Comment added” and “Comment deleted” via a polite live region', async () => {
    render(<SandboxStreamPanel />)

    // Open comments panel for node n1
    const btn = await screen.findByTestId('comment-btn-n1')
    fireEvent.click(btn)

    // Add a comment
    const input = await screen.findByTestId('comment-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Hello there' } })
    const add = await screen.findByTestId('comment-add-btn')
    fireEvent.click(add)

    // The status region should contain the text
    const panel = await screen.findByTestId('comments-panel')
    const status = panel.querySelector('[role="status"]') as HTMLElement
    expect(status?.textContent || '').toContain('Comment added')

    // Delete the comment
    const delBtn = await screen.findByText('Delete')
    fireEvent.click(delBtn)
    expect(status?.textContent || '').toContain('Comment deleted')
  })
})
