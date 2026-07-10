// appliedEditPulse — seamlessness R2: when the AI's graph edits land on the
// canvas (accepted patch, auto-applied patch, or V5 server-applied patch),
// the canvas acknowledges it immediately with the SAME 2s highlight ring the
// "Reveal changes" button uses — no click required.
//
// Contract:
// - Coalescing: multiple patches can apply in one turn (the auto-apply loop
//   iterates blocks). setHighlightedNodes REPLACES the set, so naive
//   per-patch pulses clobber each other and earlier clear-timers wipe later
//   highlights. Calls within the coalesce window merge into ONE pulse over
//   the union of targets, with a single clear timer.
// - Fail-closed: ids are filtered against the canvas store at flush time;
//   ids not on the canvas (e.g. removals) never pulse. An all-stale flush
//   writes nothing (never clobbers an existing highlight with emptiness).
// - Pulse only: no selection, no inspector, no viewport pan — the AI must
//   not hijack what the user is doing. The ring itself is static (BaseNode
//   ring-4 / StyledEdge stroke), so it is inherently reduced-motion-safe.

export const PULSE_COALESCE_MS = 100
export const PULSE_DURATION_MS = 2000

export interface PulseTargets {
  nodeIds?: string[]
  edgeIds?: string[]
}

export function pulseAppliedTargets(_targets: PulseTargets): void {
  // RED-checkpoint stub: behaviour lands in the GREEN commit.
}

/** Test-only: cancel pending timers and clear the coalesce buffers. */
export function __resetAppliedEditPulseForTests(): void {}
