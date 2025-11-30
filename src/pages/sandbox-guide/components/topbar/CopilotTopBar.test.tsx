/**
 * Tests for CopilotTopBar component
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CopilotTopBar } from './CopilotTopBar'
import { useCopilotStore } from '../../hooks/useCopilotStore'
import { useCanvasStore } from '@/canvas/store'
import { useResultsStore } from '@/canvas/stores/resultsStore'

describe('CopilotTopBar', () => {
  beforeEach(() => {
    // Reset stores to initial state
    useCopilotStore.setState({
      journeyStage: 'empty',
      selectedElement: null,
      panelExpanded: true,
      compareMode: false,
    })

    useCanvasStore.setState({
      nodes: [],
      edges: [],
    })

    useResultsStore.setState({
      status: 'idle',
      report: null,
    })
  })

  it('should render branding', () => {
    render(<CopilotTopBar />)
    expect(screen.getByText('Decision Coach')).toBeInTheDocument()
  })

  it('should show "Getting Started" badge when empty', () => {
    useCopilotStore.setState({ journeyStage: 'empty' })
    render(<CopilotTopBar />)
    expect(screen.getByText('Getting Started')).toBeInTheDocument()
  })

  it('should show "Building Model" badge when building', () => {
    useCopilotStore.setState({ journeyStage: 'building' })
    render(<CopilotTopBar />)
    expect(screen.getByText('Building Model')).toBeInTheDocument()
  })

  it('should show "Blocked" badge when pre-run-blocked', () => {
    useCopilotStore.setState({ journeyStage: 'pre-run-blocked' })
    render(<CopilotTopBar />)
    expect(screen.getByText('Blocked')).toBeInTheDocument()
  })

  it('should show "Ready to Run" badge when pre-run-ready', () => {
    useCopilotStore.setState({ journeyStage: 'pre-run-ready' })
    render(<CopilotTopBar />)
    expect(screen.getByText('Ready to Run')).toBeInTheDocument()
  })

  it('should show "Analysis Complete" badge when post-run', () => {
    useCopilotStore.setState({ journeyStage: 'post-run' })
    render(<CopilotTopBar />)
    expect(screen.getByText('Analysis Complete')).toBeInTheDocument()
  })

  it('should show critical alert when blocked', () => {
    useCopilotStore.setState({ journeyStage: 'pre-run-blocked' })
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    })

    render(<CopilotTopBar />)
    expect(screen.getByText(/issue.*preventing analysis/)).toBeInTheDocument()
  })

  it('should show loading alert when running', () => {
    useResultsStore.setState({ status: 'loading' })
    render(<CopilotTopBar />)
    expect(screen.getByText('Running analysis...')).toBeInTheDocument()
  })

  it('should show error alert when analysis fails', () => {
    useResultsStore.setState({ status: 'error' })
    render(<CopilotTopBar />)
    expect(screen.getByText('Analysis failed - please try again')).toBeInTheDocument()
  })

  it('should show node and edge counts when no alert', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'n1', type: 'outcome', position: { x: 0, y: 0 }, data: {} },
        { id: 'n2', type: 'decision', position: { x: 100, y: 0 }, data: {} },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', data: {} }],
    })

    render(<CopilotTopBar />)
    expect(screen.getByText('2')).toBeInTheDocument() // 2 nodes
    expect(screen.getByText('nodes')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // 1 edge
    expect(screen.getByText('connections')).toBeInTheDocument()
  })
})
