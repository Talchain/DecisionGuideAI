/**
 * Focus Now — typed row-ownership model.
 *
 * The Focus Now panel is grounded in an explicit OWNERSHIP model so the UI is
 * honest about what it may author versus what must come from the server.
 *
 * `FocusRow` is INTERNAL UI DISPLAY STATE ONLY. It is NOT a CEE/server contract,
 * boundary type, or wire schema, and must not be treated as one — it does not
 * mirror any wire contract. The canonical wire shapes are owned upstream; this
 * model only describes what the panel renders, and it deliberately does NOT import
 * from `@talchain/schemas` (the structured coaching wire — "Lane A" — is not open
 * yet). A server-provided coaching signal is mapped INTO this display shape (see
 * buildFocusRows), never the reverse.
 *
 * Invariant F.6 — render, do not compute. These types describe data the UI is
 * GIVEN (static UI-owned hygiene rows) or PASSED THROUGH (server copy, verbatim).
 * The renderer never ranks, prioritises, selects, interprets the model, or
 * derives staleness; those belong to CEE.
 */

/**
 * Who owns a row.
 *
 * - `static_hygiene` — UI-authored generic decision-hygiene prompt. Allowed ONLY
 *   when unconditional and generic; it must NOT claim Olumi detected anything in
 *   the user's model (so a static row never carries `noticed`).
 * - `server_sourced` — presence/wording depends on the user's model/analysis/
 *   evidence; rendered ONLY when the source field exists, copy passed through
 *   verbatim. Today the only live server source is `coaching_summary` (mapped to
 *   the panel summary line, not a row).
 * - `gated` — science-heavy content (influence/sensitivity/drivers/EVPI/fragility/
 *   flip/confidence/"what would change"). The mapper NEVER emits one; the type
 *   member exists so a test can pass one in and assert it is dropped.
 */
export type FocusOwnership = 'static_hygiene' | 'server_sourced' | 'gated'

/**
 * Provenance tag for traceability/tests/dev only. Never rendered as prose.
 * Open string so future server sources are tolerated.
 */
export type FocusSource = 'static_hygiene' | 'coaching_summary' | 'coaching_signal' | (string & {})

/**
 * Action descriptor. NOTHING here executes inside the presentational component —
 * it is handed to an injected handler (the container `useFocusNow` auto-sends the
 * text to Olumi + reveals the chat). The `prefill`/`prefillText` names are
 * historical (the action used to prefill the composer); the behaviour is now
 * send. `ask_olumi` is the sparkle affordance, wired to the same handler.
 */
export type FocusActionKind = 'prefill' | 'ask_olumi'

export interface FocusAction {
  kind: FocusActionKind
  /** For kind='prefill': the prompt text sent to Olumi. UI-authored or verbatim. */
  prefillText?: string
  /** Visible control label. UI-authored, banned-term-safe. */
  label: string
}

export interface FocusRow {
  /** Stable, namespaced id ('static:add-risk' / 'signal:<id>'). Used as React key + dedup. */
  id: string
  ownership: FocusOwnership
  source: FocusSource
  /** Collapsed primary line (the title). Always present and non-empty for a renderable row. */
  primary: string
  /**
   * "What Olumi noticed" — ONLY set for server_sourced rows (verbatim server
   * copy). NEVER set for static_hygiene (that line would falsely claim detection).
   */
  noticed?: string
  /** "Why it matters" — generic content-free string (static) or verbatim (server). */
  whyItMatters?: string
  /** "Try this" nudge shown in the expanded body. */
  tryThis?: string
  /** Optional neutral topical icon key (static rows). Maps to a Lucide icon in the card. */
  iconKey?: string
  /** Optional entity cue (server rows that reference a real entity). Unknown kind → neutral dot. */
  targetKind?: string
  /** The single safe action wired to the row. Display/prefill-only. */
  action?: FocusAction
}

/** Panel-level freshness banner state (output of the freshness adapter). */
export type FocusBannerState =
  | { kind: 'none' }
  /** CEE 'stale' or a local edit downgraded a retained 'fresh' → offer a re-run. */
  | { kind: 'stale'; canRerun: true }
  /** Overlay 'unknown' — neutral "cannot confirm", NEVER shown as stale, no rerun. */
  | { kind: 'cannot_confirm' }

/** Props for the presentational FocusNowPanel — prop-driven, store-free. */
export interface FocusNowProps {
  /**
   * Verbatim orientation line from `coaching_summary`, or null.
   * NOT claim-certified (CEE prose). In the unmounted component this is exercised
   * only for tolerance/layout/XSS-safety; the live container defaults it to null
   * until it is hidden or Gate-Zero-certified upstream.
   */
  summary: string | null
  rows: FocusRow[]
  banner: FocusBannerState
  /**
   * Row-action handler (historical name). The injected container (useFocusNow)
   * AUTO-SENDS the text to Olumi + reveals the chat. Injected so the presentational
   * tree owns no store.
   */
  onPrefill?: (text: string) => void
  /**
   * Whether the row action controls (the CTA + Ask Olumi icon) can produce a
   * visible effect. The action reveals the Olumi chat tab, which only exists when
   * aiPanelV2 is enabled (OutputsDock redirects 'olumi'→'results' otherwise). When
   * false the panel renders NO action controls so rows stay informational rather
   * than becoming dead buttons. Default true (standalone / Storybook).
   */
  actionsEnabled?: boolean
  /** Trigger a re-run of analysis. Injected. */
  onRerun?: () => void
  /** Disable the re-run affordance while a run is in flight. */
  rerunDisabled?: boolean
  /**
   * Whether to render the panel's own freshness/stale banner. Default true
   * (standalone use). Set false when mounted inside a surface that already owns
   * freshness (e.g. ResultsBody renders AnalysisFreshnessNotice) so the trust
   * surface shows a SINGLE stale notice, not a duplicate.
   */
  showFreshnessBanner?: boolean
  className?: string
}
