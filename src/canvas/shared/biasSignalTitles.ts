/**
 * biasSignalTitles — the ONE canonical map from CEE bias codes to the
 * humanised titles the UI shows (#356 fast-follow: extracted so the
 * conversation bridge and the pre-analysis panel can never drift — one
 * bias renders one name on every surface, by construction).
 *
 * Importers:
 *   - src/canvas/conversation/draftBiasSignalBlocks.ts (v5_coaching
 *     bias-signal card titles; fail-closed allowlist lookup)
 *   - src/canvas/components/pre-analysis/PreAnalysisPanel.tsx
 *     (BIAS_TYPE_ICON titles — icons stay panel-local; titles derive
 *     from here)
 *
 * Keys are canonical lowercase; lookups must lowercase first (both wire
 * conventions arrive: lowercase `type` and uppercase `code`). Unknown
 * codes are the caller's fail-closed concern — this map never invents a
 * title. Parity + drift traps: biasSignalTitles.parity.spec.ts.
 */
export const BIAS_SIGNAL_TITLES: Record<string, string> = {
  framing: 'Narrow framing',
  framing_bias: 'Narrow framing',
  narrow_framing: 'Narrow framing',
  anchoring: 'Anchoring',
  anchoring_bias: 'Anchoring',
  confidence: 'Overconfidence',
  overconfidence: 'Overconfidence',
  optimism_bias: 'Optimism bias',
  blind_spots: 'Blind spots',
  status_quo_bias: 'Status quo bias',
  confirmation: 'Confirmation bias',
  confirmation_bias: 'Confirmation bias',
  authority_bias: 'Authority bias',
  availability_bias: 'Availability bias',
  sunk_cost: 'Sunk cost',
}
