/**
 * HeadlineSignals Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HeadlineSignals, detectSchema } from '../HeadlineSignals'

describe('HeadlineSignals', () => {
  it('renders route signal', () => {
    render(<HeadlineSignals route="UI → /bff/engine → CEE" />)
    
    expect(screen.getByText('Route')).toBeInTheDocument()
    expect(screen.getByText('UI → /bff/engine → CEE')).toBeInTheDocument()
  })

  it('renders schema signal with match status', () => {
    render(
      <HeadlineSignals
        schema={{
          requested: 'v3',
          detected: 'v3',
          reason: 'analysis_ready present',
          isMatch: true,
        }}
      />
    )
    
    expect(screen.getByText('Schema')).toBeInTheDocument()
    expect(screen.getByText('v3 ✓')).toBeInTheDocument()
  })

  it('renders schema mismatch warning', () => {
    render(
      <HeadlineSignals
        schema={{
          requested: 'v3',
          detected: 'v2',
          reason: 'edges have belief field',
          isMatch: false,
        }}
      />
    )
    
    expect(screen.getByText('v2 ⚠')).toBeInTheDocument()
  })

  it('renders structure info', () => {
    render(
      <HeadlineSignals
        structureInfo={{
          factorCount: 5,
          hasAnalysisReady: true,
        }}
      />
    )
    
    expect(screen.getByText('Structure')).toBeInTheDocument()
    expect(screen.getByText(/Factors: 5/)).toBeInTheDocument()
  })

  it('renders pipeline status', () => {
    render(
      <HeadlineSignals
        pipelineStatus={{
          status: 'SUCCESS',
          duration: 55200,
        }}
      />
    )
    
    expect(screen.getByText('Pipeline')).toBeInTheDocument()
    expect(screen.getByText(/SUCCESS/)).toBeInTheDocument()
    expect(screen.getByText(/55.2s/)).toBeInTheDocument()
  })

  it('renders top issue when present', () => {
    render(
      <HeadlineSignals
        topIssue={{
          message: '9 fragile edges detected',
          severity: 'warning',
        }}
      />
    )
    
    expect(screen.getByText('Top Issue')).toBeInTheDocument()
    expect(screen.getByText(/9 fragile edges/)).toBeInTheDocument()
  })

  it('renders no issues when null', () => {
    render(<HeadlineSignals topIssue={null} />)
    
    expect(screen.getByText('✓ No issues')).toBeInTheDocument()
  })

  it('renders request ID with copy button', () => {
    render(<HeadlineSignals requestId="abc123def456" />)
    
    expect(screen.getByText('Request ID')).toBeInTheDocument()
    expect(screen.getByText('[abc123de]')).toBeInTheDocument()
    expect(screen.getByTitle('Copy full request ID')).toBeInTheDocument()
  })

  it('copies request ID on button click', async () => {
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    }
    Object.assign(navigator, { clipboard: mockClipboard })

    render(<HeadlineSignals requestId="abc123def456" />)
    
    fireEvent.click(screen.getByTitle('Copy full request ID'))
    
    expect(mockClipboard.writeText).toHaveBeenCalledWith('abc123def456')
  })
})

describe('detectSchema', () => {
  it("detects v3 schema from schema_version '3.0'", () => {
    const response = {
      schema_version: '3.0',
      nodes: [],
      edges: [],
    }

    const result = detectSchema(response)

    expect(result.detected).toBe('v3')
    expect(result.reason).toBe("schema_version === '3.0'")
    expect(result.isMatch).toBe(true)
  })

  it('detects v3 schema from analysis_ready field', () => {
    const response = {
      analysis_ready: { goal_node_id: 'goal-1', options: [] },
      nodes: [],
      edges: [],
    }
    
    const result = detectSchema(response)
    
    expect(result.detected).toBe('v3')
    expect(result.reason).toBe('analysis_ready present')
    expect(result.isMatch).toBe(true)
  })

  it('detects v3 schema from nested graph.analysis_ready', () => {
    const response = {
      graph: {
        analysis_ready: { goal_node_id: 'goal-1' },
        nodes: [],
        edges: [],
      },
    }
    
    const result = detectSchema(response)
    
    expect(result.detected).toBe('v3')
    expect(result.reason).toBe('graph.analysis_ready present')
  })

  it('detects v3 schema from strength_mean field in edges', () => {
    const response = {
      nodes: [],
      edges: [{ from: 'a', to: 'b', strength_mean: 0.8 }],
    }
    
    const result = detectSchema(response)
    
    expect(result.detected).toBe('v3')
    expect(result.reason).toBe('edges[0].strength_mean present')
    expect(result.isMatch).toBe(true)
  })

  it('detects v2 schema from nested strength.mean field in edges', () => {
    const response = {
      nodes: [],
      edges: [{ from: 'a', to: 'b', strength: { mean: 0.6, std: 0.1 } }],
    }

    const result = detectSchema(response)

    expect(result.detected).toBe('v2')
    expect(result.reason).toBe('edges[0].strength.mean present')
    expect(result.isMatch).toBe(false)
  })

  it('detects legacy schema when no markers found', () => {
    const response = {
      nodes: [],
      edges: [{ source: 'a', target: 'b', weight: 0.5 }],
    }
    
    const result = detectSchema(response)
    
    expect(result.detected).toBe('legacy')
    expect(result.reason).toBe('no v2/v3 markers found')
  })

  it('returns unknown for null/undefined response', () => {
    expect(detectSchema(null).detected).toBe('unknown')
    expect(detectSchema(undefined).detected).toBe('unknown')
  })
})
