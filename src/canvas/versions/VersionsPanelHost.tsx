/**
 * Mount host for the versions surface: the trigger and the panel together.
 * British English: visualisation, colour, initialise.
 *
 * WHY A HOST. It owns its own open/closed state, so mounting the whole feature
 * costs the canvas route exactly one line and touches no shared store. That
 * keeps the integration surface with other lanes to a single JSX element, and
 * makes the feature trivially removable if it is not wanted.
 */

import { useState } from 'react'
import { GitCompare } from 'lucide-react'
import { typography } from '../../styles/typography'
import { WhatChangedPanel } from './WhatChangedPanel'

export function VersionsPanelHost() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          data-testid="versions-panel-trigger"
          className={`${typography.panelBody} absolute top-3 right-3 z-[1500] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-panel border border-panel-border text-text-body shadow-panel hover:bg-panel-hover`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          Versions
        </button>
      )}
      <WhatChangedPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
