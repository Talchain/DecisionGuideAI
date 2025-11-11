/**
 * StreamControlBar - Start/Stop/Resume Controls
 * Phase 2E-E: Extracted from SandboxStreamPanel.tsx
 *
 * Provides primary streaming controls with keyboard shortcut hints.
 * Manages button states based on streaming status.
 */

import React from 'react'

interface StreamControlBarProps {
  canStart: boolean
  canStop: boolean
  canResume: boolean
  onStart: () => void
  onStop: () => void
  onResume: () => void
  status: 'idle' | 'starting' | 'streaming' | 'complete' | 'error' | 'cancelled' | 'aborted' | 'limited' | 'done'
  disabled?: boolean
  startTitle?: string
  stopTitle?: string
  readOnly?: boolean
}

export const StreamControlBar = React.memo<StreamControlBarProps>(({
  canStart,
  canStop,
  canResume: _canResume,
  onStart,
  onStop,
  onResume: _onResume,
  status: _status,
  disabled = false,
  startTitle = 'Start (⌘⏎)',
  stopTitle,
  readOnly = false,
}) => {
  // Determine if we should show Start button (hide in read-only mode)
  const showStart = !readOnly

  // Compute disabled state for Start button
  const startDisabled = disabled || !canStart || readOnly

  // Compute disabled state for Stop button
  const stopDisabled = disabled || !canStop || readOnly

  return (
    <>
      {showStart && (
        <button
          type="button"
          data-testid="start-btn"
          onClick={onStart}
          className="px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
          disabled={startDisabled}
          title={startTitle}
        >
          Start
        </button>
      )}
      <button
        type="button"
        data-testid="stop-btn"
        onClick={onStop}
        className="px-2 py-1 rounded bg-gray-200 text-gray-900 disabled:opacity-50"
        disabled={stopDisabled}
        title={stopTitle}
      >
        Stop
      </button>
    </>
  )
})

StreamControlBar.displayName = 'StreamControlBar'
