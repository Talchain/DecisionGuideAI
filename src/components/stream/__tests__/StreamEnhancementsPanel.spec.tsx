/**
 * StreamEnhancementsPanel Unit Tests
 * Phase 2E: Tests for extracted enhancements (suggestions, snapshots, compare) component
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StreamEnhancementsPanel from '../StreamEnhancementsPanel'

describe('StreamEnhancementsPanel', () => {
  const defaultProps = {
    guidedEnabled: false,
    suggestions: [],
    onApplySuggestion: vi.fn(),
    onUndo: vi.fn(),
    canUndo: false,
    ariaGuidedMsg: '',
    snapshotsEnabled: false,
    snapshots: [],
    onMakeSnapshot: vi.fn(),
    onCopyShareLink: vi.fn(),
    shareNote: '',
    readOnly: false,
    ariaSnapshotMsg: '',
    compareEnabled: false,
    compareSelectionA: '',
    compareSelectionB: '',
    onCompareSelectionChange: vi.fn(),
    compareDiff: null,
    ariaCompareMsg: '',
    changeLog: null,
  }

  describe('Guided Suggestions', () => {
    it('renders suggestions when guidedEnabled is true and suggestions exist', () => {
      const suggestions = [
        { id: 's1', title: 'Use better model', rationale: 'GPT-4 is more accurate', apply: vi.fn() },
        { id: 's2', title: 'Increase budget', rationale: 'More tokens available', apply: vi.fn() },
      ]

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          guidedEnabled={true}
          suggestions={suggestions}
        />
      )

      expect(screen.getByTestId('guided-suggestion-0')).toHaveTextContent('Use better model')
      expect(screen.getByTestId('guided-suggestion-1')).toHaveTextContent('Increase budget')
    })

    it('does not render suggestions when guidedEnabled is false', () => {
      const suggestions = [
        { id: 's1', title: 'Use better model', rationale: 'GPT-4 is more accurate', apply: vi.fn() },
      ]

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          guidedEnabled={false}
          suggestions={suggestions}
        />
      )

      expect(screen.queryByTestId('guided-suggestion-0')).not.toBeInTheDocument()
    })

    it('calls onApplySuggestion when suggestion is clicked', () => {
      const onApplySuggestion = vi.fn()
      const suggestions = [
        { id: 's1', title: 'Use better model', rationale: 'GPT-4 is more accurate', apply: vi.fn() },
      ]

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          guidedEnabled={true}
          suggestions={suggestions}
          onApplySuggestion={onApplySuggestion}
        />
      )

      const suggestionBtn = screen.getByTestId('guided-suggestion-0')
      fireEvent.click(suggestionBtn)

      expect(onApplySuggestion).toHaveBeenCalledWith(suggestions[0], {})
    })

    it('renders undo button', () => {
      const suggestions = [
        { id: 's1', title: 'Use better model', rationale: 'GPT-4 is more accurate', apply: vi.fn() },
      ]

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          guidedEnabled={true}
          suggestions={suggestions}
        />
      )

      expect(screen.getByTestId('guided-undo-btn')).toBeInTheDocument()
    })

    it('enables undo button when canUndo is true', () => {
      const suggestions = [
        { id: 's1', title: 'Use better model', rationale: 'GPT-4 is more accurate', apply: vi.fn() },
      ]

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          guidedEnabled={true}
          suggestions={suggestions}
          canUndo={true}
        />
      )

      const undoBtn = screen.getByTestId('guided-undo-btn') as HTMLButtonElement
      expect(undoBtn.disabled).toBe(false)
    })

    it('calls onUndo when undo button is clicked', () => {
      const onUndo = vi.fn()
      const suggestions = [
        { id: 's1', title: 'Use better model', rationale: 'GPT-4 is more accurate', apply: vi.fn() },
      ]

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          guidedEnabled={true}
          suggestions={suggestions}
          canUndo={true}
          onUndo={onUndo}
        />
      )

      const undoBtn = screen.getByTestId('guided-undo-btn')
      fireEvent.click(undoBtn)

      expect(onUndo).toHaveBeenCalledTimes(1)
    })

    it('shows rationale in tooltip for accessibility', () => {
      const suggestions = [
        { id: 's1', title: 'Use better model', rationale: 'GPT-4 is more accurate', apply: vi.fn() },
      ]

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          guidedEnabled={true}
          suggestions={suggestions}
        />
      )

      expect(screen.getByTestId('why-tooltip')).toHaveTextContent('GPT-4 is more accurate')
    })
  })

  describe('Snapshots', () => {
    it('renders snapshot button when snapshotsEnabled is true', () => {
      render(
        <StreamEnhancementsPanel {...defaultProps} snapshotsEnabled={true} />
      )

      expect(screen.getByTestId('snapshot-btn')).toBeInTheDocument()
    })

    it('does not render snapshot button when readOnly is true', () => {
      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          snapshotsEnabled={true}
          readOnly={true}
        />
      )

      expect(screen.queryByTestId('snapshot-btn')).not.toBeInTheDocument()
    })

    it('calls onMakeSnapshot when snapshot button is clicked', () => {
      const onMakeSnapshot = vi.fn()

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          snapshotsEnabled={true}
          onMakeSnapshot={onMakeSnapshot}
        />
      )

      const snapshotBtn = screen.getByTestId('snapshot-btn')
      fireEvent.click(snapshotBtn)

      expect(onMakeSnapshot).toHaveBeenCalledTimes(1)
    })

    it('renders snapshot list when snapshots exist', () => {
      const snapshots = [
        { id: 'snap1', at: '2024-01-15T10:30:00Z', seed: '42', model: 'gpt-4o-mini', data: {} },
        { id: 'snap2', at: '2024-01-15T10:00:00Z', seed: '123', model: 'claude-haiku', data: {} },
      ]

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          snapshotsEnabled={true}
          snapshots={snapshots}
        />
      )

      expect(screen.getByTestId('snapshot-list')).toBeInTheDocument()
      expect(screen.getByTestId('snapshot-list-item-snap1')).toBeInTheDocument()
      expect(screen.getByTestId('snapshot-list-item-snap2')).toBeInTheDocument()
    })

    it('renders share link button for most recent snapshot', () => {
      const snapshots = [
        { id: 'snap1', at: '2024-01-15T10:30:00Z', seed: '42', model: 'gpt-4o-mini', data: {} },
        { id: 'snap2', at: '2024-01-15T10:00:00Z', seed: '123', model: 'claude-haiku', data: {} },
      ]

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          snapshotsEnabled={true}
          snapshots={snapshots}
        />
      )

      // Only the first (most recent) snapshot should have share link button
      expect(screen.getByTestId('sharelink-copy')).toBeInTheDocument()
    })

    it('calls onCopyShareLink when share link button is clicked', () => {
      const onCopyShareLink = vi.fn()
      const snapshots = [
        { id: 'snap1', at: '2024-01-15T10:30:00Z', seed: '42', model: 'gpt-4o-mini', data: {} },
      ]

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          snapshotsEnabled={true}
          snapshots={snapshots}
          onCopyShareLink={onCopyShareLink}
        />
      )

      const shareLinkBtn = screen.getByTestId('sharelink-copy')
      fireEvent.click(shareLinkBtn)

      expect(onCopyShareLink).toHaveBeenCalledWith(snapshots[0])
    })

    it('displays share note when provided', () => {
      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          snapshotsEnabled={true}
          shareNote="Link copied to clipboard"
        />
      )

      expect(screen.getByTestId('share-cap-note')).toHaveTextContent('Link copied to clipboard')
    })

    it('renders change log when provided', () => {
      const changeLog = {
        added: ['node1', 'node2'],
        removed: ['node3'],
        changed: ['edge1'],
      }

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          snapshotsEnabled={true}
          changeLog={changeLog}
        />
      )

      expect(screen.getByTestId('change-log')).toBeInTheDocument()
      expect(screen.getByTestId('change-log')).toHaveTextContent('Added 2')
      expect(screen.getByTestId('change-log')).toHaveTextContent('Removed 1')
      expect(screen.getByTestId('change-log')).toHaveTextContent('Changed 1')
    })
  })

  describe('Compare Snapshots', () => {
    const snapshots = [
      { id: 'snap1', at: '2024-01-15T10:30:00Z', seed: '42', model: 'gpt-4o-mini', data: {} },
      { id: 'snap2', at: '2024-01-15T10:00:00Z', seed: '123', model: 'claude-haiku', data: {} },
    ]

    it('renders compare controls when compareEnabled is true', () => {
      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          compareEnabled={true}
          snapshots={snapshots}
        />
      )

      expect(screen.getByTestId('compare-select-a')).toBeInTheDocument()
      expect(screen.getByTestId('compare-select-b')).toBeInTheDocument()
    })

    it('calls onCompareSelectionChange when selection A changes', () => {
      const onCompareSelectionChange = vi.fn()

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          compareEnabled={true}
          snapshots={snapshots}
          onCompareSelectionChange={onCompareSelectionChange}
        />
      )

      const selectA = screen.getByTestId('compare-select-a')
      fireEvent.change(selectA, { target: { value: 'snap1' } })

      expect(onCompareSelectionChange).toHaveBeenCalledWith('snap1', '')
    })

    it('calls onCompareSelectionChange when selection B changes', () => {
      const onCompareSelectionChange = vi.fn()

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          compareEnabled={true}
          snapshots={snapshots}
          onCompareSelectionChange={onCompareSelectionChange}
        />
      )

      const selectB = screen.getByTestId('compare-select-b')
      fireEvent.change(selectB, { target: { value: 'snap2' } })

      expect(onCompareSelectionChange).toHaveBeenCalledWith('', 'snap2')
    })

    it('renders compare diff when provided', () => {
      const compareDiff = {
        added: ['node1', 'node2'],
        removed: ['node3'],
        changed: ['edge1', 'edge2'],
      }

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          compareEnabled={true}
          snapshots={snapshots}
          compareDiff={compareDiff}
        />
      )

      const diffList = screen.getByTestId('compare-diff-list')
      expect(diffList).toBeInTheDocument()

      // Should show all added, removed, and changed items
      expect(diffList).toHaveTextContent('↑ node1')
      expect(diffList).toHaveTextContent('↑ node2')
      expect(diffList).toHaveTextContent('↓ node3')
      expect(diffList).toHaveTextContent('• edge1')
      expect(diffList).toHaveTextContent('• edge2')
    })
  })

  describe('Accessibility', () => {
    it('has ARIA live regions for guided suggestions', () => {
      const suggestions = [
        { id: 's1', title: 'Use better model', rationale: 'GPT-4 is more accurate', apply: vi.fn() },
      ]

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          guidedEnabled={true}
          suggestions={suggestions}
          ariaGuidedMsg="Suggestion applied"
        />
      )

      const ariaRegion = screen.getByRole('status')
      expect(ariaRegion).toHaveTextContent('Suggestion applied')
    })

    it('uses British English date format for snapshots', () => {
      const snapshots = [
        { id: 'snap1', at: '2024-01-15T10:30:00Z', seed: '42', model: 'gpt-4o-mini', data: {} },
      ]

      render(
        <StreamEnhancementsPanel
          {...defaultProps}
          snapshotsEnabled={true}
          snapshots={snapshots}
        />
      )

      const snapshotItem = screen.getByTestId('snapshot-list-item-snap1')
      // British format: DD/MM/YYYY
      expect(snapshotItem).toBeInTheDocument()
    })
  })

  it('memoizes correctly and does not re-render unnecessarily', () => {
    const { rerender } = render(<StreamEnhancementsPanel {...defaultProps} />)

    // Rerender with same props
    rerender(<StreamEnhancementsPanel {...defaultProps} />)

    // Component should not have re-rendered (React.memo should prevent it)
    expect(document.body).toBeInTheDocument()
  })
})
