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
import { useCanvasStore } from '../../canvas/store'
import { classifyFreshnessForDisplay } from '../../canvas/store/analysisFreshness'
import { deriveCoachingCurrency } from './coachingCurrency'
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
const CONTAINER_BASE: Record<'default' | 'bias_signal', string> = {
  default: 'rounded-xl border bg-panel p-4 space-y-2',
  bias_signal: 'bg-panel border rounded-lg px-4 py-3 space-y-2',
}

/**
 * The uncategorised default, per variant. These reproduce the pre-PR3
 * appearance EXACTLY, so a card the producer never classified looks precisely
 * as it always did — the honest-absence rule made visual.
 */
const CONTAINER_UNCATEGORISED: Record<'default' | 'bias_signal', string> = {
  default: 'border-info/30',
  bias_signal: 'border-info',
}

/**
 * EMPHASIS, WITHIN the shared colour channel — and this exists because a real
 * browser proved the colour channel alone is not enough.
 *
 * `guidanceCategoryTone` maps FOUR producer categories onto TWO colours
 * (must_fix/should_fix → danger, could_fix/technique → info). Rendered, that
 * made "Must fix" and "Should fix" visually IDENTICAL — same border, same
 * badge, same icon — so the single most important distinction the producer
 * makes was legible only by reading the badge text. jsdom could never have
 * shown this: it computes no layout and resolves no colour, and every
 * structural test passed while the hierarchy did not exist.
 *
 * The fix deliberately does NOT mint a new colour: colour stays derived from
 * the shared authority, so this card, the node marker and the inspector still
 * agree. What varies is WEIGHT — a filled badge for must_fix, then three
 * border tints. Weight is driven by the producer's own `category`, so nothing
 * here is invented; it is the same fact, rendered with the emphasis it
 * already carries.
 *
 * ⚠ THE LABEL INK IS ALWAYS `text-text-body`, AND THAT IS THE DESIGN SYSTEM'S
 * RULE, NOT A PREFERENCE. `Conversation.module.css` states it at the existing
 * guidance badges: "Category badge colour variants — DS v5 §3.2: outlined
 * pills, text-text-body". Colour rides the BORDER; the ink stays body-coloured.
 *
 * A first version of this ladder put the category colour in the INK
 * (`text-danger` / `text-info` / muted grey) and it failed three ways at once,
 * all of them measured from computed styles in a real browser:
 *   - `should_fix` ink resolved to 2.80:1 against the card — BELOW WCAG AA
 *     (4.5:1) at this 11px size, and `must_fix` white-on-fill to 2.83:1. No
 *     token in the danger family reaches 4.5:1 with white ink (the best,
 *     --danger-active, is 4.24:1), so ink-colouring cannot be made compliant
 *     within the palette at all.
 *   - the ladder INVERTED: `technique`, the least urgent tier, carried the
 *     highest-contrast label on the card.
 *   - it silently diverged from the four badge surfaces already shipped.
 * Keeping the ink at body colour dissolves all three: every label is
 * high-contrast, no label can out-shout another, and the tiers separate on
 * fill and border exactly as the rest of the product already does.
 */
const CATEGORY_BADGE_CLASS: Record<
  NonNullable<V5CoachingBlockType['category']>,
  string
> = {
  must_fix: 'bg-danger-light border-danger text-text-body font-medium',
  should_fix: 'bg-transparent border-danger/50 text-text-body',
  could_fix: 'bg-transparent border-info/50 text-text-body',
  technique: 'bg-transparent border-panel-border text-text-body',
}

/** Card border weight per category — the same emphasis ladder, one step quieter. */
const CATEGORY_BORDER_CLASS: Record<
  NonNullable<V5CoachingBlockType['category']>,
  string
> = {
  must_fix: 'border-danger/60',
  should_fix: 'border-danger/30',
  could_fix: 'border-info/40',
  technique: 'border-panel-border',
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
 * The depth-layer sentence for CANNOT-CONFIRM. It is the card's existing
 * honest-absence idiom — the same voice as "This suggestion is not linked to a
 * cited decision-science claim" — applied to the one other thing the card can
 * fail to know. It states what is unknown; it never guesses, and it never
 * implies the advice is wrong.
 */
const CURRENCY_UNKNOWN_DETAIL =
  'We can’t confirm whether your model has changed since this was written.'

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

  /*
    THE UNCERTAINTY CHANNEL, MADE REACHABLE.

    `freshness` is the PRODUCER's verdict, stamped at emission — so on a card
    the user is reading it is always `fresh` (wire-measured 13/13, 2026-08-12)
    and the `stale` sentence below could never fire. Currency is a DIFFERENT
    question — "is this still about the model you have?" — and only the client
    can answer it, because only the client is still here after the user edits.

    Read at RENDER time, on a store subscription, exactly as `TargetRefPill`
    (already inside this card) resolves its targets: "Resolution is render-time,
    not ingest-time … a pill never points at a guess." At ingest the two hashes
    are always equal, which is precisely why an ingest-time verdict is worthless.

    ⚠ BOTH SIDES ARE CEE-PRODUCED. `currentGraphHash` comes from
    `analysis_ready.current_graph_hash`; the block's from
    `graph_hash_at_generation`. The UI's own `generateGraphHash` is a different
    algorithm and MUST NOT be substituted here — see `coachingCurrency.ts`.

    ⚠ AND BOTH ARE STAMPED SERVER-SIDE, so neither moves on a local edit. In the
    window between an analysis-affecting edit and the next `analysis_ready` they
    still agree, and the comparison alone would resolve `current` — silent —
    while every neighbouring surface has already downgraded. The client's
    first-hand knowledge of that edit is the dirty overlay, read through the
    SAME authority those surfaces read (`classifyFreshnessForDisplay`, called
    identically at `V7FreshnessStrip.tsx`, `AnalysisFreshnessNotice.tsx` and
    `useAnalysisTrust.ts`) — borrowed, never re-derived, because two authorities
    answering "is the analysis stale?" under one name is trap 21. The borrow is
    gated on the overlay inside `deriveCoachingCurrency`; the reasoning for the
    gate is in that module's header.
  */
  const freshnessState = useCanvasStore((s) => s.analysisFreshness)
  const freshnessDirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const importHold = useCanvasStore((s) => s.importPendingServerRegistration)
  const currency = deriveCoachingCurrency(
    block.graph_hash_at_generation,
    freshnessState?.currentGraphHash,
    {
      dirty: freshnessDirty,
      displaySemantic: classifyFreshnessForDisplay(freshnessState, freshnessDirty, importHold),
    },
  )

  /*
    The producer's verdict WINS when it has said anything at all.

    `freshness` answers "did this card generate correctly?" (pending / failed)
    and currency answers "is it still about your model?" — two questions, and
    trap 21 is what happens when two questions share one channel. So the
    derived verdict FILLS THE PRODUCER'S SILENCE and never overwrites its
    speech. When both point at staleness they resolve to the same sentence, so
    the notice renders once and cannot contradict itself.
  */
  const freshnessNotice =
    (block.freshness ? FRESHNESS_NOTICE[block.freshness] : undefined) ??
    (currency === 'changed' ? FRESHNESS_NOTICE.stale : undefined)
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
      data-currency={currency}
      data-tone={tone}
      {...(block.category ? { 'data-category': block.category } : {})}
      {...(block.signal_code ? { 'data-signal-code': block.signal_code } : {})}
      {...(typeof block.priority === 'number' ? { 'data-priority': String(block.priority) } : {})}
      className={[
        CONTAINER_BASE[variant],
        block.category
          ? CATEGORY_BORDER_CLASS[block.category]
          : CONTAINER_UNCATEGORISED[variant],
      ].join(' ')}
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
              'inline-flex items-center rounded-full px-2 py-0.5 border',
              CATEGORY_BADGE_CLASS[block.category],
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
          className={`${typography.panelMeta} text-text-light`}
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
          className={`${typography.panelMeta} text-text-light`}
          data-testid={`${testIdPrefix}-freshness`}
        >
          {freshnessNotice}
        </p>
      )}

      {/*
        GROUNDING, COMPACT ON THE FACE. The strength is what a reader needs at
        a glance; the CLAIM TITLE — the part that makes the attribution
        checkable against the bundle — is one row down in the disclosure. A
        browser pass showed the full title inline pushed this card to eight
        stacked rows and orphaned the separator mid-wrap, which is the exact
        opposite of "low cognitive load by default". This compact form is also
        the idiom `InspectorGuidanceSection` already ships, so the two
        surfaces read as one.

        Every visible string is the CANONICAL BUNDLE's, carried verbatim from
        `data/dsk/v1.json` by CEE: here `evidence_strength`, and `claim_title`
        in the disclosure. Nothing is authored in the UI except the static
        label, which names the channel and makes no claim about the science.

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
          className={`${typography.panelMeta} flex items-center gap-x-1.5 text-text-light`}
        >
          <BookOpenCheck size={12} className="flex-none text-info" aria-hidden="true" />
          <span>
            Grounded in decision science · {claim.evidence_strength} evidence
          </span>
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
          className={`${typography.panelMeta} cursor-pointer text-text-light hover:text-text-body list-none`}
        >
          <span aria-hidden="true" className="inline-block mr-1 group-open:rotate-90 transition-transform">
            ▸
          </span>
          Why this, and how sure
        </summary>
        <div className={`${typography.panelMeta} mt-1.5 space-y-1 text-text-light`}>
          <p data-testid={`${testIdPrefix}-grounding-detail`}>
            {claim
              ? `This instantiates a cited decision-science claim: “${claim.claim_title}”, which the bundle rates ${claim.evidence_strength} evidence.`
              : 'This suggestion is not linked to a cited decision-science claim.'}
          </p>
          {/*
            CANNOT-CONFIRM lives HERE, not on the face, and the placement is the
            argument: the card makes no currency claim on its face, so there is
            nothing false to correct — but silence would let "we cannot tell"
            read exactly like "still current". The depth layer is where this
            card already states what it does not know ("not linked to a cited
            decision-science claim"), and the summary above it literally asks
            "how sure". A CHANGED model is different: that contradicts what the
            reader would otherwise assume, so it goes on the face, unprompted.
          */}
          {currency === 'cannot_confirm' && (
            <p data-testid={`${testIdPrefix}-currency-detail`}>{CURRENCY_UNKNOWN_DETAIL}</p>
          )}
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
