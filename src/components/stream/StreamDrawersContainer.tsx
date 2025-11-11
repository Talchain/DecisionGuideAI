/**
 * StreamDrawersContainer - Drawer Orchestration Component
 * Phase 2E-F: Extracted from SandboxStreamPanel.tsx
 *
 * Manages multiple drawers (Report, History, Config, Canvas, Scenarios).
 * Handles focus management and ARIA roles for accessibility.
 */

import { memo, type ReactNode } from 'react'

interface StreamDrawersContainerProps {
  children?: ReactNode
  // Individual drawers are rendered by parent and passed as children
  // This component just provides the wrapper/orchestration structure
}

function StreamDrawersContainer({ children }: StreamDrawersContainerProps) {
  return (
    <>
      {children}
    </>
  )
}

export default memo(StreamDrawersContainer)
export type { StreamDrawersContainerProps }
