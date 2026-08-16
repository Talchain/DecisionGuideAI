/**
 * Mount host for the version-history PANEL.
 * British English: visualisation, colour, initialise.
 *
 * ── WHAT CHANGED, AND WHY (R4, Paul, 16 Aug 2026) ────────────────────────────
 * This host used to render BOTH a floating trigger pill and the panel, holding
 * the open state in local `useState`. Paul's R4 ruling retires the floating
 * pill: version history gets ONE home, in a real header row, not a control
 * hovering over the canvas (ledger L-08).
 *
 * So the host is now the panel and nothing else. The open state moved to
 * `versionsPanelStore` because the triggers are no longer this component's
 * children — they live in the top header bar and (for the cockpit lane) in the
 * analysis panel header. Mounting this host is still ONE line in the canvas
 * route and still touches no shared canvas store.
 *
 * It renders nothing at all while closed, so the cost of mounting it is a
 * subscription.
 */

import { WhatChangedPanel } from './WhatChangedPanel'
import { useVersionsPanelStore } from './versionsPanelStore'

export function VersionsPanelHost() {
  const isOpen = useVersionsPanelStore((state) => state.isOpen)
  const close = useVersionsPanelStore((state) => state.close)

  return <WhatChangedPanel isOpen={isOpen} onClose={close} />
}
