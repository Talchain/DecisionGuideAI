import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LlmIoTab } from '../LlmIoTab'

describe('LlmIoTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows fallback when llm_raw is not available', () => {
    render(<LlmIoTab trace={{ pipeline: { status: 'success' } }} />)

    expect(screen.getByText(/LLM output not captured/i)).toBeInTheDocument()
  })

  it('renders metadata + raw output and supports copy', () => {
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
    Object.assign(navigator, { clipboard: mockClipboard })

    render(
      <LlmIoTab
        trace={{
          pipeline: {
            total_duration_ms: 1234,
            llm_metadata: {
              model: 'gpt-4o-mini',
              prompt_version: 'pv1',
              temperature: 0.2,
              token_usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
            },
            llm_raw: {
              prompt_text: 'PROMPT HERE',
              output_text: 'OUTPUT TEXT',
              output_json: { ok: true },
            },
            node_extraction: {
              raw: { decision: 1, goal: 1, option: 2 },
              normalised: { decision: 1, goal: 1, option: 2 },
              validated: { decision: 1, goal: 1, option: 2 },
            },
          },
        }}
      />
    )

    expect(screen.getByText('Metadata')).toBeInTheDocument()
    expect(screen.getByText(/gpt-4o-mini/)).toBeInTheDocument()
    expect(screen.getByText(/tokens:/)).toBeInTheDocument()

    // Raw output is expanded by default
    expect(screen.getByText(/"ok": true/)).toBeInTheDocument()

    // Copy should copy JSON payload
    const copyButtons = screen.getAllByRole('button', { name: 'Copy' })
    fireEvent.click(copyButtons[0])
    expect(mockClipboard.writeText).toHaveBeenCalled()

    // Prompt section exists and is collapsed by default
    expect(screen.getByText('Prompt')).toBeInTheDocument()
    expect(screen.queryByText(/PROMPT HERE/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Prompt'))
    expect(screen.getByText(/PROMPT HERE/)).toBeInTheDocument()
  })
})
