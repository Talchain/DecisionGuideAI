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

  it('falls back to llm_calls[0] when llm_metadata is not available (CEE format)', () => {
    // CEE returns llm_calls[] instead of llm_metadata
    render(
      <LlmIoTab
        trace={{
          pipeline: {
            status: 'success',
            total_duration_ms: 2500,
            llm_calls: [
              {
                id: 'call-1',
                model: 'claude-3-sonnet',
                duration_ms: 1800,
                prompt_tokens: 1234,
                completion_tokens: 567,
                request: 'User prompt here',
                response: { nodes: [], edges: [] },
              },
            ],
            // No llm_metadata, no llm_raw - should fall back to llm_calls[0]
          },
        }}
      />
    )

    // Model should display from llm_calls[0].model
    expect(screen.getByText(/claude-3-sonnet/)).toBeInTheDocument()

    // Token usage should display from llm_calls[0]
    expect(screen.getByText(/tokens:/)).toBeInTheDocument()
    expect(screen.getByText(/1234 prompt/)).toBeInTheDocument()
    expect(screen.getByText(/567 completion/)).toBeInTheDocument()
    expect(screen.getByText(/1801 total/)).toBeInTheDocument()

    // Raw output should display llm_calls[0].response
    expect(screen.getByText(/"nodes": \[\]/)).toBeInTheDocument()
  })

  it('prefers llm_metadata over llm_calls when both are present', () => {
    render(
      <LlmIoTab
        trace={{
          pipeline: {
            total_duration_ms: 1000,
            llm_metadata: {
              model: 'gpt-4o',
              temperature: 0.7,
              token_usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
            },
            llm_calls: [
              {
                id: 'call-1',
                model: 'claude-3-opus', // Different model - should NOT be used
                duration_ms: 500,
                prompt_tokens: 999,
                completion_tokens: 888,
                response: { fallback: true },
              },
            ],
            llm_raw: {
              output_json: { primary: true },
            },
          },
        }}
      />
    )

    // Should use llm_metadata.model, not llm_calls[0].model
    expect(screen.getByText(/gpt-4o/)).toBeInTheDocument()
    expect(screen.queryByText(/claude-3-opus/)).not.toBeInTheDocument()

    // Should use llm_metadata.token_usage
    expect(screen.getByText(/100 prompt/)).toBeInTheDocument()
    expect(screen.getByText(/50 completion/)).toBeInTheDocument()
    expect(screen.getByText(/150 total/)).toBeInTheDocument()

    // Should use llm_raw, not llm_calls[0].response
    expect(screen.getByText(/"primary": true/)).toBeInTheDocument()
    expect(screen.queryByText(/"fallback": true/)).not.toBeInTheDocument()
  })
})
