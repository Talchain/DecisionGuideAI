/**
 * V7WhatIWasGivenSection — ROADMAP 2.973.
 *
 * Four calm answers to the question a strategist actually asks:
 *
 *   1. What you gave me      — their brief, as they wrote it.
 *   2. What I used           — figures from the brief that reached the model.
 *   3. What I estimated      — figures the product supplied that they did not.
 *   4. Not modelled yet      — what has not made it in, and how to add it.
 *
 * ── WHY IT READS THE WAY IT DOES ───────────────────────────────────────────
 * The 2026-08-08 context-integrity trace measured that the brief is persisted
 * byte-verbatim and read by nothing, while most of what a strategist quantifies
 * never reaches the model. That is a real gap — but a screen full of loss
 * counts is a DIAGNOSTIC ARTEFACT, not a product. The register here is a good
 * analyst showing their working, not a system apologising:
 *
 *   · "Not modelled yet" — an invitation to add something, never a confession.
 *     Nothing on screen says "dropped", "lost", or "discarded".
 *   · NO PIPELINE VOCABULARY. No extraction types, no provenance labels, no
 *     stage names, no error codes. A user should never have to know our
 *     architecture to read their own decision.
 *   · The internal manifest stays precise and technical; only the RENDERING is
 *     human. The two are deliberately kept apart.
 *   · Actionable where honest: an unmodelled figure gets an "Add this" that
 *     starts the conversation to include it. Where no real action exists —
 *     everything in "what I estimated" — none is offered.
 *
 * ── THE HONESTY RULE THIS COMPONENT ENFORCES ───────────────────────────────
 * `manifest === null` means CEE told us NOTHING. It renders as an explicit
 * "I can't show this yet" — never an empty list, and never silence. Both of
 * those read as "everything made it in", which on a brief we demonstrably lose
 * content from is a worse lie than the silence it replaces.
 *
 * ── MOUNT ──────────────────────────────────────────────────────────────────
 * Hosted in the UNCONDITIONAL `v7-top-group`. `ResultsBody` forks on
 * `analysisHeroPanel` and this estate has twice shipped a feature dark by
 * binding it to the arm the deployed flags switch off (CLAUDE.md trap 3b).
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { typography } from '../../../styles/typography'
import { useContextIntegrityStore } from '../../../canvas/stores/contextIntegrityStore'
import type { NotModelledItem } from '../../../adapters/cee/notModelled'
import { ClampToggle } from './ClampToggle'

/** Rows shown per group before "show all". Keeps the open state scannable. */
const VISIBLE_ROWS = 6

/**
 * ── ONE LIST RHYTHM, ONE ROW BOX ───────────────────────────────────────────
 * The container rhythm was written three times in this file and the row box
 * twice verbatim (plus once in part). A reader takes this panel to be one
 * surface, so the day one of the copies is adjusted and the others are not,
 * the drift is visible to them — the hand-maintained mirror at user-facing
 * scale (CLAUDE.md trap 12).
 */
const LIST_CLASS = 'mt-1 space-y-0.5'
const ROW_BOX = 'rounded px-2 py-1 odd:bg-panel-hover/40'
/** A plain text row. */
const TEXT_ROW_CLASS = `${typography.panelBody} ${ROW_BOX} text-text-body`
/** A row that also carries an action on the right. */
const ACTION_ROW_CLASS = `flex items-baseline justify-between gap-2 ${ROW_BOX}`

const COPY = {
  heading: 'What you gave me, and what I did with it',
  givenHeading: 'What you gave me',
  usedHeading: 'What I used',
  estimatedHeading: 'What I estimated',
  // ⚠ THE PREVIOUS WORDING WAS FALSE ON OUR OWN FIXTURE, and it is worth
  // stating why. It read "You didn't give me a figure for these" — but B1's
  // brief says "our NRR is 112%", and the panel showed 112% under "not
  // modelled yet" while listing Net Revenue Retention here, led by that
  // sentence. CEE answers "does this factor's number trace to the brief?";
  // the copy asserted "did you give me a figure for this?" — a DIFFERENT
  // question about the user's input (trap 21: two questions under one
  // number). The derivation was right; the sentence was wrong. It now claims
  // only what the derivation actually establishes: these numbers are ours.
  estimatedLead:
    "The numbers behind these are mine, not yours. If you have better ones, tell me and I'll use them.",
  notYetHeading: 'Not modelled yet',
  notYetLead: 'These are in your brief but not in the model. Add any that matter.',
  consideredLead: 'I also considered these and left them out:',
  caveatLead: 'This covers figures you mentioned. It does not yet track:',
  unknown:
    "I can't show this yet for this decision — so please don't read the absence as everything having made it in.",
  noBrief: "I don't have your original wording saved for this decision.",
  addAction: 'Add this',
} as const

/**
 * Plain-English names for the classes CEE reports as untracked. An unrecognised
 * code is rendered VERBATIM rather than hidden — the producer owns this
 * vocabulary, and silently dropping a class we have no copy for would defeat
 * the point of the field.
 */
const NOT_TRACKED_COPY: Readonly<Record<string, string>> = {
  competing_or_dissenting_proposals: "other people's suggestions",
  corrections_and_second_thoughts: 'changes of mind',
  named_evidence_sources_and_their_pedigree: 'where your evidence came from',
  qualitative_constraints_and_rules: 'rules you wrote in words rather than numbers',
  stated_confidence_and_self_flagged_weakness: 'how sure you said you were',
  statements_the_drafting_model_did_not_report_discarding: 'anything else I left out silently',
}

/**
 * ⚠ A CROSS-REPO HAND-MAINTAINED MIRROR, and it fails SAFE. `NOT_TRACKED_COPY`
 * is keyed on a vocabulary CEE owns, so the day CEE adds a class this map does
 * not know it, and the previous `?? c` fallback rendered the raw snake_case
 * code — defeating the tone guard the moment the producer moved. An unknown
 * code now collapses into one honest catch-all instead of leaking an
 * identifier onto the screen, and the caveat stays truthful either way.
 */
function notTrackedCopy(codes: readonly string[]): string {
  const known: string[] = []
  let unknown = 0
  for (const c of codes) {
    const copy = NOT_TRACKED_COPY[c]
    if (copy === undefined) unknown += 1
    else if (!known.includes(copy)) known.push(copy)
  }
  if (unknown > 0) known.push('and some other things I set aside')
  return known.join('; ')
}

/**
 * One item of a plain text list.
 *
 * `key` and `attrs` exist so every row is addressed by IDENTITY — a node id, a
 * char offset — never by a value another row could also produce (trap 19).
 */
interface TextRow {
  readonly key: string
  readonly label: string
  readonly attrs?: Readonly<Record<string, string>>
}

/**
 * The unclamped text list — "what I estimated" and "I also considered these".
 * The two were byte-identical apart from their key, their testid and one
 * `data-` attribute, so they are one component parameterised by exactly those.
 *
 * `<ul>`/`<li>` rather than `<div>`: each block is a list of discrete facts and
 * that is what lets assistive tech announce how many there are. The
 * "considered" block already did this, so unifying the other list DOWN to a
 * `<div>` would have been the regression. Tailwind's preflight strips list
 * markers and padding, so the rendered pixels are unchanged.
 */
function TextRowList({ rows, testId }: { rows: readonly TextRow[]; testId: string }) {
  return (
    <ul className={LIST_CLASS} data-testid={testId}>
      {rows.map((row) => (
        <li key={row.key} data-testid={`${testId}-row`} {...row.attrs} className={TEXT_ROW_CLASS}>
          {row.label}
        </li>
      ))}
    </ul>
  )
}

function Rows({
  items,
  testId,
  onAdd,
}: {
  items: readonly NotModelledItem[]
  testId: string
  onAdd?: (item: NotModelledItem) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? items : items.slice(0, VISIBLE_ROWS)
  // ⚠ `ClampToggle`'s contract is that `hiddenCount` is what the clamp HIDES
  // and does NOT change when the list expands — that is what keeps the control
  // mounted as "Show fewer". `items.length - visible.length` falls to zero on
  // expand and would unmount the affordance, which is precisely the one-way
  // behaviour this replaced.
  const hiddenCount = items.length - VISIBLE_ROWS

  return (
    <div className={LIST_CLASS}>
      <ul className="space-y-0.5" data-testid={testId}>
        {visible.map((item) => (
          // Keyed and addressed by IDENTITY (offset + literal): a brief can state
          // the same figure twice and they are two different facts.
          <li
            key={`${item.charOffset}:${item.literal}`}
            data-testid={`${testId}-row`}
            data-char-offset={item.charOffset}
            data-matched-node-id={item.matchedNodeId ?? undefined}
            className={ACTION_ROW_CLASS}
          >
            <span className={`${typography.panelBody} text-text-body`}>{item.literal}</span>
            {onAdd && (
              <button
                type="button"
                onClick={() => onAdd(item)}
                data-testid={`${testId}-add`}
                className={`${typography.panelMeta} flex-none rounded px-1.5 py-0.5 text-text-light underline hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              >
                {COPY.addAction}
              </button>
            )}
          </li>
        ))}
      </ul>
      {/* The panel's ONE clamp affordance (`./ClampToggle`), in the directory
          that component's own header names. The copy this replaced rendered in
          a different colour from every other clamp in the results panel and
          offered no way back. */}
      <ClampToggle
        testId={`${testId}-show-all`}
        hiddenCount={hiddenCount}
        expanded={showAll}
        onToggle={() => setShowAll((s) => !s)}
      />
    </div>
  )
}

export interface V7WhatIWasGivenSectionProps {
  /** Starts the conversation to add an unmodelled figure. When absent, no
   *  action is offered — we never render a button that does nothing. */
  onSendMessage?: (text: string) => void
}

export function V7WhatIWasGivenSection({ onSendMessage }: V7WhatIWasGivenSectionProps = {}) {
  const [open, setOpen] = useState(false)
  const briefText = useContextIntegrityStore((s) => s.briefText)
  const manifest = useContextIntegrityStore((s) => s.manifest)

  if (briefText === null && manifest === null) return null

  const tally = manifest?.status === 'derived' ? manifest.quantities : null
  const items = tally?.items ?? []
  const used = items.filter((i) => i.verdict === 'in_model')
  // A figure quoted only in commentary is not in the model. To a reader that is
  // one fact, not two, so the surface folds it in here while the manifest keeps
  // the distinction.
  const notYet = items.filter((i) => i.verdict === 'absent' || i.verdict === 'prose_only')
  const estimated = manifest?.inferredFactors.items ?? []
  const considered =
    manifest?.declaredExclusions.status === 'reported' ? manifest.declaredExclusions.items : []

  // Counts come from the manifest's own tallies, NOT from `items.length`:
  // `items` is capped (`truncated`) while `total` is not, so counting rendered
  // rows against an uncapped total silently under-reports on a long brief.
  const notYetCount = tally === null ? 0 : tally.absent + tally.proseOnly
  const subtitle =
    tally === null
      ? "I can't show this yet"
      : `${notYetCount} of ${tally.total} figures you mentioned aren't in the model yet`

  const addMessage = (item: NotModelledItem) =>
    onSendMessage?.(`Please add "${item.literal}" from my brief to the model.`)

  return (
    <section
      data-testid="what-i-was-given-section"
      className="rounded-lg border border-panel-border bg-panel px-3 py-1.5"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="what-i-was-given-body"
        onClick={() => setOpen((o) => !o)}
        data-testid="what-i-was-given-toggle"
        className="flex w-full items-center gap-2 rounded py-1.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <span className="min-w-0 flex-1">
          <span className={`${typography.panelHeader} block text-text-header`}>{COPY.heading}</span>
          <span
            className={`${typography.panelMeta} block text-text-light`}
            data-testid="what-i-was-given-summary"
          >
            {subtitle}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 flex-none text-text-light transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div id="what-i-was-given-body" className="mt-1 space-y-3 pb-2">
          {/* ── 1. What you gave me ── */}
          <div>
            <h4 className={`${typography.panelHeader} text-text-header`}>{COPY.givenHeading}</h4>
            {briefText === null ? (
              <p className={`${typography.panelBody} text-text-light`}>{COPY.noBrief}</p>
            ) : (
              <blockquote
                data-testid="what-i-was-given-brief"
                className={`${typography.panelBody} mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap rounded border border-panel-border bg-panel-hover/40 px-2 py-1.5 text-text-body`}
              >
                {briefText}
              </blockquote>
            )}
          </div>

          {tally === null ? (
            <p
              data-testid="what-i-was-given-unknown"
              className={`${typography.panelBody} text-text-light`}
            >
              {COPY.unknown}
            </p>
          ) : (
            <>
              {/* ── 2. What I used ── */}
              {used.length > 0 && (
                <div>
                  <h4 className={`${typography.panelHeader} text-text-header`}>
                    {COPY.usedHeading}
                  </h4>
                  <Rows items={used} testId="what-i-was-given-used" />
                </div>
              )}

              {/* ── 4. Not modelled yet — an invitation, not a verdict ── */}
              {notYet.length > 0 && (
                <div>
                  <h4 className={`${typography.panelHeader} text-text-header`}>
                    {COPY.notYetHeading}
                  </h4>
                  <p className={`${typography.panelMeta} text-text-light`}>{COPY.notYetLead}</p>
                  <Rows
                    items={notYet}
                    testId="what-i-was-given-notyet"
                    onAdd={onSendMessage ? addMessage : undefined}
                  />
                </div>
              )}
            </>
          )}

          {/* ── 3. What I estimated — the trust-critical one ── */}
          {estimated.length > 0 && (
            <div>
              <h4 className={`${typography.panelHeader} text-text-header`}>
                {COPY.estimatedHeading}
              </h4>
              <p className={`${typography.panelMeta} text-text-light`}>{COPY.estimatedLead}</p>
              <TextRowList
                testId="what-i-was-given-estimated"
                rows={estimated.map((f) => ({
                  key: f.nodeId,
                  label: f.label,
                  attrs: { 'data-node-id': f.nodeId },
                }))}
              />
            </div>
          )}

          {/* The model's own words for what it set aside, carried verbatim. */}
          {considered.length > 0 && (
            <div>
              <p className={`${typography.panelMeta} text-text-light`}>{COPY.consideredLead}</p>
              <TextRowList
                testId="what-i-was-given-considered"
                rows={considered.map((text) => ({ key: text, label: text }))}
              />
            </div>
          )}

          {/* The caveat travels with the findings, always: without it the lists
              above read as exhaustive, and they are not. */}
          {manifest !== null && manifest.notTracked.length > 0 && (
            <p
              data-testid="what-i-was-given-caveat"
              className={`${typography.panelMeta} text-text-light`}
            >
              {COPY.caveatLead}{' '}
              {notTrackedCopy(manifest.notTracked)}.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
