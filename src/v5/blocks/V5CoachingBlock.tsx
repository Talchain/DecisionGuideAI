/**
 * V5CoachingBlock — renders a 0.13.x-typed CEE coaching block
 * (Track C slice 1, approved D-5; provisional_doctrine_v0).
 *
 * ── PR3 (living reasoning workspace): THE CARD LEARNS TO SAY WHAT MATTERS ──
 *
 * THE DEFECT. Every coaching card looked the same: lightbulb, title, prose,
 * optional pill. `coaching_kind` / `source` / `freshness` rode as inert
 * `data-*` attributes with no per-kind treatment, and the producer's
 * IMPORTANCE and EVIDENCE signals never arrived at all — the chat card was
 * the one consumer of the coaching block that dropped them, while the
 * guidance strip, the inspector, the node marker and the Strengthen panel all
 * already ranked and grounded the very same wire object. A reader could not
 * tell a must-fix finding from a passing technique note, could not tell a
 * cited decision-science claim from assistant prose, and was never told when
 * a card pre-dated their latest edit.
 *
 * THE FOUR CHANNELS THIS CARD NOW CARRIES, and the rule each obeys:
 *
 *   1. IMPORTANCE — the producer's `category` (must_fix / should_fix /
 *      could_fix / technique). It sets a badge AND the card's whole tone, so
 *      urgency is legible before the title is read. ABSENT = no badge and the
 *      existing neutral treatment. The UI never invents a tier: there is no
 *      "normal", no "unknown", no default.
 *   2. EVIDENCE — `signal` (the producer's own "what triggered this" line,
 *      verbatim) and `dsk_claim_provenance` (the cited claim's TITLE and
 *      evidence strength). Together these are what let a reader separate an
 *      evidence-backed finding from a suggestion.
 *   3. UNCERTAINTY — `freshness`, which until now was an inert attribute.
 *      A stale / pending / failed card says so in plain English instead of
 *      presenting itself as current.
 *   4. ACTION — unchanged: `action_label` + `action_prompt` through
 *      ActionChip's existing `_sendChip` seam.
 *
 * ORDERING IS NOT THIS COMPONENT'S JOB, and deliberately so. The producer's
 * `priority_rank` is an ASCENDING ordinal (lower = first, unbounded, NEVER
 * inverted against 100) and `composePhase3BridgedBlocks` already sorts the
 * feed by it. This card therefore mints NO ordering of its own — a second
 * ordering authority in the client is exactly the drift the contract's
 * `priority_rank` note warns about.
 *
 * DERIVE, DON'T MIRROR. The tone and icon come from `guidanceCategoryTone` /
 * `guidanceCategoryIcon`, which the guidance store documents as the single
 * source of truth every surface colouring a guidance element MUST derive
 * from; the badge copy comes from `STRENGTHEN_COPY.severityLabel`. So this
 * card, the on-canvas node marker, the inspector card and the Strengthen row
 * cannot drift apart — one vocabulary, one colour language, four surfaces.
 * A private copy of any of them here would be the hand-maintained mirror
 * defect, and the spec pins the copy against the shared constant so a
 * divergence REDs.
 *
 * ONE ICON AUTHORITY, NOT TWO. `coaching_kind` is NOT given a competing icon
 * vocabulary: category owns the icon, so the marker on the canvas matches the
 * card it opens. `coaching_kind` and `source` are stated as SENTENCES inside
 * the disclosure instead — and only when we recognise them, because they are
 * open pass-through discriminators and a raw `assumption_check` token is
 * machine text, never copy.
 *
 * PROGRESSIVE DISCLOSURE. Everything a first-time reader needs is on the face
 * of the card: badge, title, body, trigger line, grounding, action. The
 * depth — which claim, how strong the evidence, what kind of move this is,
 * where it came from — sits in a `<details>` that is CLOSED by default. A
 * power user opens it; nobody else pays for it.
 *
 * A BLANK IS A DEFECT, NOT A STANDARD. Where a signal is unavailable the card
 * says what is unknown in plain English rather than rendering nothing: an
 * ungrounded card states that it is not linked to a cited claim. What the
 * card must never do is manufacture a value — the honest degradations here
 * are sentences, not silence, and never guesses.
 *
 * Truth-rendering contract (unchanged, and extended to the new fields):
 *   - Every visible producer string is verbatim: title, body,
 *     target_refs[].label, action_label, `signal`, and the DSK claim title.
 *     The UI's own words are confined to STATIC channel labels ("Why this
 *     came up", "Grounded in decision science") which name a channel and
 *     make no claim about the science — the V5ExerciseBlock precedent.
 *   - `signal_code` is an id, not a sentence: it rides as `data-signal-code`
 *     and is never rendered as copy.
 *   - The action pill is ACTIONABLE when, and only when, the producer
 *     authored the turn text (ROADMAP 2.225; schemas 0.31.0
 *     `CoachingBlockSchema.action_prompt`):
 *       · `action_label` + `action_prompt` → a real <button> (ActionChip)
 *         that dispatches `action_prompt` VERBATIM through the existing
 *         `_sendChip` seam.
 *       · `action_label` alone → the display-only outlined pill, unchanged.
 *     The second arm is deliberate and is the contract's stated failure
 *     semantics: the UI must NOT fall back to dispatching `action_label` (a
 *     button CAPTION, bounded at 40 chars) or `action_intent` (a machine
 *     enum) as turn text. "That fallback IS the defect."
 *   - target_refs pills are click-to-focus (seamlessness R1): clickable only
 *     while the target exists on the canvas (fail-closed in TargetRefPill),
 *     label copy verbatim either way.
 *
 * Variants (review-folds C10+R1 — the separate BiasSignalCoachingCard
 * duplicated this whole structure and silently DROPPED action_label):
 *   - 'default': full card (the existing idiom), tone-tinted border.
 *   - 'bias_signal': the DS coaching-card recipe, testid prefix
 *     `bias-signal-card` (the #356 specs key on it).
 *     ONLY the container class and testid prefix differ; every channel above
 *     is identical on both forks, which is the whole point of the fold.
 */
import { type ReactElement } from 'react'
import { BookOpenCheck } from 'lucide-react'
import { typography } from '../../styles/typography'
import { TargetRefPill } from '../../canvas/conversation/components/TargetRefPill'
import { ActionChip } from './ActionChip'
import {
  guidanceCategoryIcon,
  guidanceCategoryTone,
} from '../../canvas/stores/guidanceStore'
import { STRENGTHEN_COPY } from '../../components/results/strengthen/strengthenCopy'
import type { V5CoachingBlock as V5CoachingBlockType } from '../../canvas/conversation/types'

export interface V5CoachingBlockProps {
  block: V5CoachingBlockType
  variant?: 'default' | 'bias_signal'
}

type Tone = 'danger' | 'info'

/**
 * Container recipe per variant × tone. The tone tint is the IMPORTANCE
 * channel made visible; `info` reproduces the pre-PR3 appearance exactly, so
 * an uncategorised card looks precisely as it always did.
 */
const CONTAINER_CLASS: Record<'default' | 'bias_signal', Record<Tone, string>> = {
  default: {
    info: 'rounded-xl border border-info/30 bg-panel p-4 space-y-2',
    danger: 'rounded-xl border border-danger/40 bg-panel p-4 space-y-2',
  },
  bias_signal: {
    info: 'bg-panel border border-info rounded-lg px-4 py-3 space-y-2',
    danger: 'bg-panel border border-danger rounded-lg px-4 py-3 space-y-2',
  },
}

const CATEGORY_BADGE_CLASS: Record<Tone, string> = {
  danger: 'border-danger/40 text-danger',
  info: 'border-info/40 text-info',
}

/**
 * Plain-English sentences for the freshness verdict. `fresh` is deliberately
 * absent from this map: a current card says nothing, because a "this is
 * current" badge on every card is noise that teaches the reader to ignore the
 * one time it matters.
 */
const FRESHNESS_NOTICE: Partial<Record<string, string>> = {
  stale: 'Your model has changed since this was written — it may no longer apply.',
  pending: 'This is still being written.',
  failed: 'This could not be generated.',
}

/**
 * Code-keyed display copy for the two pass-through discriminators. Both are
 * OPEN vocabularies the producer owns, so an unrecognised value maps to
 * `undefined` and the disclosure simply omits that line — it must never print
 * the raw snake_case token, which is machine text and reads as a leak.
 */
const KIND_SENTENCE: Partial<Record<string, string>> = {
  orientation: 'Getting oriented',
  widening: 'Widening the options',
  bias_signal: 'A possible bias in the reasoning',
  strengthen: 'Strengthening the model',
  assumption_check: 'An assumption worth checking',
  calibration_prompt: 'Calibrating an estimate',
}

const SOURCE_SENTENCE: Partial<Record<string, string>> = {
  draft_graph: 'Raised while drafting your model',
  decision_review: 'Raised by the decision review',
  deterministic_signal: 'Raised by an automatic check',
}

export function V5CoachingBlock({ block, variant = 'default' }: V5CoachingBlockProps): ReactElement {
  const testIdPrefix = variant === 'bias_signal' ? 'bias-signal-card' : 'v5-coaching'

  // The IMPORTANCE channel, derived from the shared authority so this card,
  // the node marker and the inspector cannot disagree.
  const tone: Tone = guidanceCategoryTone(block.category)
  const { Icon, tintClass } = guidanceCategoryIcon(block.category)

  const freshnessNotice = block.freshness ? FRESHNESS_NOTICE[block.freshness] : undefined
  const kindSentence = KIND_SENTENCE[block.coaching_kind]
  const sourceSentence = SOURCE_SENTENCE[block.source]
  const claim = block.dsk_claim_provenance

  return (
    <div
      data-testid={testIdPrefix}
      data-block-id={block.block_id}
      data-coaching-kind={block.coaching_kind}
      data-coaching-source={block.source}
      data-freshness={block.freshness}
      data-tone={tone}
      {...(block.category ? { 'data-category': block.category } : {})}
      {...(block.signal_code ? { 'data-signal-code': block.signal_code } : {})}
      {...(typeof block.priority === 'number' ? { 'data-priority': String(block.priority) } : {})}
      className={CONTAINER_CLASS[variant][tone]}
    >
      {/*
        IMPORTANCE, first and smallest. The badge is the producer's four-value
        class in the SHARED vocabulary; absent category renders nothing at all
        rather than a fabricated tier.
      */}
      {block.category && (
        <div className="flex">
          <span
            data-testid={`${testIdPrefix}-category`}
            data-category={block.category}
            className={[
              'inline-flex items-center rounded-full px-2 py-0.5',
              'bg-transparent border',
              CATEGORY_BADGE_CLASS[tone],
              typography.panelMeta,
            ].join(' ')}
          >
            {STRENGTHEN_COPY.severityLabel[block.category]}
          </span>
        </div>
      )}

      <div className="flex items-start gap-2">
        <Icon size={16} className={`flex-none mt-0.5 ${tintClass}`} aria-hidden="true" />
        <h3 className={typography.panelHeader} data-testid={`${testIdPrefix}-title`}>
          {block.title}
        </h3>
      </div>

      <p className={typography.panelBody} data-testid={`${testIdPrefix}-body`}>
        {block.body}
      </p>

      {/*
        EVIDENCE, in one quiet line. `signal` is the producer's own statement
        of what triggered this item — the single most useful sentence for
        telling a measured finding from a passing note. "Why this came up" is
        a static channel label; the claim itself is entirely the producer's.
      */}
      {block.signal && (
        <p
          className={`${typography.panelMeta} text-text-muted`}
          data-testid={`${testIdPrefix}-signal`}
        >
          <span className="font-medium">Why this came up: </span>
          {block.signal}
        </p>
      )}

      {/*
        UNCERTAINTY. Until now `freshness` was an inert attribute, so a card
        written before the user's last edit presented itself as current.
      */}
      {freshnessNotice && (
        <p
          className={`${typography.panelMeta} text-text-muted`}
          data-testid={`${testIdPrefix}-freshness`}
        >
          {freshnessNotice}
        </p>
      )}

      {/*
        GROUNDING. Every visible string is the CANONICAL BUNDLE's, carried
        verbatim from `data/dsk/v1.json` by CEE: the claim's own `claim_title`
        and its own `evidence_strength`. Nothing here is authored in the UI
        except the static label, which names the channel and makes no claim
        about the science.

        ⚠ CEE #830's lesson: a sibling badge once rendered the MODEL'S OWN
        PROSE under a label asserting the bundle's authority. So this must
        never interpolate assistant text, never map an id to a friendly name
        of its own, and never render a partial triple — the adapter admits all
        three members or none.
      */}
      {claim && (
        <p
          data-testid={`${testIdPrefix}-dsk-provenance`}
          data-dsk-claim-id={claim.claim_id}
          data-dsk-evidence-strength={claim.evidence_strength}
          {...(claim.protocol_id ? { 'data-dsk-protocol-id': claim.protocol_id } : {})}
          className={`${typography.panelMeta} flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-text-muted`}
        >
          <BookOpenCheck size={12} className="flex-none text-info" aria-hidden="true" />
          <span>Grounded in decision science:</span>
          <span className="text-text-body">{claim.claim_title}</span>
          <span aria-hidden="true">·</span>
          <span>{claim.evidence_strength} evidence</span>
        </p>
      )}

      {block.target_refs.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Referenced elements"
          data-testid={`${testIdPrefix}-refs`}
        >
          {block.target_refs.map((ref) => (
            <TargetRefPill
              key={ref.id}
              role="listitem"
              id={ref.id}
              label={ref.label}
              kind={ref.kind}
              className={[
                'inline-flex items-center rounded-full px-2.5 py-0.5',
                'bg-transparent border border-panel-border text-text-body',
                typography.panelMeta,
              ].join(' ')}
            />
          ))}
        </div>
      )}

      {block.action_label && (
        <div className="flex">
          {block.action_prompt ? (
            <ActionChip
              label={block.action_label}
              message={block.action_prompt}
              testId={`${testIdPrefix}-action`}
              intent={block.action_intent}
            />
          ) : (
            <span
              data-testid={`${testIdPrefix}-action`}
              {...(block.action_intent ? { 'data-action-intent': block.action_intent } : {})}
              className={[
                'inline-flex items-center rounded-full px-2.5 py-0.5',
                'bg-transparent border border-info/30 text-text-body',
                typography.panelMeta,
              ].join(' ')}
            >
              {block.action_label}
            </span>
          )}
        </div>
      )}

      {/*
        THE DEPTH LAYER — closed by default, so it costs a first-time reader
        nothing. A native <details> gives keyboard reach, the disclosure
        semantics and the open/close state for free.

        It always has something to say: when the card is not grounded, that
        ABSENCE is stated in plain English. A blank is a defect, not a
        standard — but the sentence states only what we know, and never
        guesses at a claim the producer did not cite.
      */}
      <details data-testid={`${testIdPrefix}-details`} className="group">
        <summary
          data-testid={`${testIdPrefix}-details-toggle`}
          className={`${typography.panelMeta} cursor-pointer text-text-muted hover:text-text-body list-none`}
        >
          <span aria-hidden="true" className="inline-block mr-1 group-open:rotate-90 transition-transform">
            ▸
          </span>
          Why this, and how sure
        </summary>
        <div className={`${typography.panelMeta} mt-1.5 space-y-1 text-text-muted`}>
          <p data-testid={`${testIdPrefix}-grounding-detail`}>
            {claim
              ? `This instantiates a cited decision-science claim: “${claim.claim_title}”, which the bundle rates ${claim.evidence_strength} evidence.`
              : 'This suggestion is not linked to a cited decision-science claim.'}
          </p>
          {kindSentence && (
            <p data-testid={`${testIdPrefix}-kind-detail`}>{kindSentence}</p>
          )}
          {sourceSentence && (
            <p data-testid={`${testIdPrefix}-source-detail`}>{sourceSentence}</p>
          )}
        </div>
      </details>
    </div>
  )
}

export default V5CoachingBlock
