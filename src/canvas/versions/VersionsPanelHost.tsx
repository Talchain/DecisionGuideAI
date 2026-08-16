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
import {
  VERSIONS_TRIGGER_TOP_PX,
  versionsTriggerRightOffsetCss,
} from './versionsTriggerPosition'

export function VersionsPanelHost() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          data-testid="versions-panel-trigger"
          // The inset is INLINE, not a Tailwind class, for two reasons: it is
          // a `calc()` over the dock's own custom property (see
          // versionsTriggerPosition.ts for why it must be), and an inline
          // value is readable in jsdom, so the no-overlap guarantee can be
          // asserted against what this component actually renders rather than
          // against a class name that a build step still has to honour.
          style={{
            right: versionsTriggerRightOffsetCss(),
            top: VERSIONS_TRIGGER_TOP_PX,
          }}
          className={`${typography.panelBody} absolute z-[1500] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-panel border border-panel-border text-text-body shadow-panel hover:bg-panel-hover`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          Versions
        </button>
      )}
      <WhatChangedPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
