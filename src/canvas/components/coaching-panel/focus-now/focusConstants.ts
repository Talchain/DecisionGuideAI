/**
 * Focus Now — UI-authored copy + the static decision-hygiene rows.
 *
 * Everything here is UI-AUTHORED and therefore copy-hygiene-tested: sentence
 * case, British English, no all-caps, no em dashes, free of the forbidden
 * glossary terms. Server-supplied strings (e.g. `coaching_summary`) are NOT in
 * this file — they are rendered verbatim and never scanned or rewritten (F.6).
 *
 * The six static rows are GENERIC modelling nudges. They are unconditional (their
 * presence never depends on the user's model) and they never claim Olumi detected
 * a specific problem — so none of them carries a `noticed` line. Anything that
 * would interpret the user's model (missing evidence, weak options, best next
 * question, …) is server-owned and is NOT here.
 */
import type { FocusRow } from './focusTypes'

/** Rows shown before the "show all / fewer" reveal. Display chunking, not selection. */
export const FOCUS_DEFAULT_VISIBLE = 6

/**
 * Single, easily-changed visible title. The static-only release uses a
 * NON-situational title: six fixed generic rows cannot honestly claim situational
 * priority. "Focus now" is reserved for a later version with server-sourced,
 * prioritised coaching rows. Change this one constant to retitle.
 */
export const FOCUS_TITLE = 'Strengthen your model'

export const FOCUS_COPY = {
  /** Region accessible name + visible header (both = FOCUS_TITLE). */
  panelAria: FOCUS_TITLE,
  header: FOCUS_TITLE,
  /** Shown when there are no rows (absence of data, never a computed judgement). */
  emptyState: 'Nothing to focus on right now.',
  /** Bold lead-in before a row's nudge. */
  tryThisLabel: 'Try this',
  /** Icon-only, display-only affordance label. */
  askOlumi: 'Ask Olumi',
  /** Generic accessible name for a row whose primary line is empty (operability, not a title). */
  itemFallback: 'Focus item',
  /** Reveal-toggle copy. */
  showAll: (n: number) => `Show all ${n}`,
  showFewer: 'Show fewer',
  /**
   * Panel-level freshness banner copy.
   *
   * The freshness VERDICT is single-sourced (classifyFreshnessForDisplay — the
   * certified PRs 195/197 source). The COPY below is a LOCAL LITERAL, not the
   * shared FRESHNESS_COPY constant (src/components/results/AnalysisFreshnessNotice
   * .tsx), because that canonical string ('Model changed since this analysis.
   * Re-run to update.') bundles its own CTA — which would double-render against
   * this panel's separate Re-run button — and uses different wording.
   * INERT-ONLY DEBT + LIVE-MOUNT BLOCKER: before any live mount, reconcile this to
   * the single freshness-copy source (consume FRESHNESS_COPY, or have that source
   * own this wording) so freshness surfaces cannot drift.
   */
  staleText: 'These results may be out of date because the model has changed since the last analysis.',
  rerunLabel: 'Re-run analysis',
  cannotConfirmText: 'We cannot confirm these results are up to date.',
} as const

/**
 * The six sanctioned static hygiene rows. Order is fixed and structural — it
 * never depends on the user's model (that would make it server-owned).
 */
export const STATIC_HYGIENE_ROWS: readonly FocusRow[] = [
  {
    id: 'static:define-success',
    ownership: 'static_hygiene',
    source: 'static_hygiene',
    primary: 'Define what success looks like',
    whyItMatters: 'A clear goal gives everything else something to aim at.',
    tryThis: 'Write a one-line goal you would be happy to be judged on.',
    iconKey: 'target',
    action: { kind: 'prefill', label: 'Define success', prefillText: 'Help me define what success looks like for this decision.' },
  },
  {
    id: 'static:set-time-horizon',
    ownership: 'static_hygiene',
    source: 'static_hygiene',
    primary: 'Set a time horizon',
    whyItMatters: 'Knowing when the outcome lands shapes what counts as a good choice.',
    tryThis: 'Note the date or window by which this needs to pay off.',
    iconKey: 'clock',
    action: { kind: 'prefill', label: 'Set a horizon', prefillText: 'Help me set a sensible time horizon for this decision.' },
  },
  {
    id: 'static:add-outcome',
    ownership: 'static_hygiene',
    source: 'static_hygiene',
    primary: 'Add an outcome you care about',
    whyItMatters: 'Naming the result you want keeps the options honest.',
    tryThis: 'Add one outcome that would tell you this went well.',
    iconKey: 'flag',
    action: { kind: 'prefill', label: 'Add an outcome', prefillText: 'Help me add an outcome I care about for this decision.' },
  },
  {
    id: 'static:add-risk',
    ownership: 'static_hygiene',
    source: 'static_hygiene',
    primary: 'Add a risk worth watching',
    whyItMatters: 'Spelling out what could go wrong is easier before you commit.',
    tryThis: 'Add one thing that could set this back.',
    iconKey: 'shield-alert',
    action: { kind: 'prefill', label: 'Add a risk', prefillText: 'Help me think through a risk worth adding to this decision.' },
  },
  {
    id: 'static:add-constraint',
    ownership: 'static_hygiene',
    source: 'static_hygiene',
    primary: 'Add a constraint you are working within',
    whyItMatters: 'Limits on budget, time or people change which options are real.',
    tryThis: 'Add one limit the decision has to live within.',
    iconKey: 'scale',
    action: { kind: 'prefill', label: 'Add a constraint', prefillText: 'Help me capture a constraint that shapes this decision.' },
  },
  {
    id: 'static:capture-insight',
    ownership: 'static_hygiene',
    source: 'static_hygiene',
    primary: 'Capture an insight while it is fresh',
    whyItMatters: 'A note now saves re-deriving the same thought later.',
    tryThis: 'Jot down one thing you have learned so far.',
    iconKey: 'lightbulb',
    action: { kind: 'prefill', label: 'Capture insight', prefillText: 'Help me capture an insight I have had about this decision.' },
  },
]
