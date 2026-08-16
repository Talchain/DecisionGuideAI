/**
 * stalenessVoice — ONE staleness communication per turn view (L-42).
 *
 * ## The defect
 *
 * Screenshot S03: the applied-edit card's note, a "Should fix" guidance card and
 * the composer placeholder ALL told the user to re-run, at once, about the same
 * fact. A fourth surface — the freshness pill above the bubble — says it again.
 * Four voices, one fact, none of them wrong and all of them together reading as
 * nagging.
 *
 * ## The hierarchy (Paul's ruling for this item: the CARD wins)
 *
 *   CARD        the applied-edit receipt's freshness note. It is the only one
 *               attached to the change that CAUSED the staleness, so it is the
 *               one that tells the user something they cannot infer.
 *   PILL        the freshness pill above the bubble.
 *   PLACEHOLDER the composer's stage-aware prompt.
 *
 * A surface speaks only when nothing ABOVE it is speaking.
 *
 * ## Why a mount registry and not a shared predicate
 *
 * The four surfaces derive from the same trust semantic but not from the same
 * condition — the card additionally requires an applied receipt IN THIS TURN,
 * which the composer has no way to see without reaching into the transcript.
 * A predicate re-derived in each place would be a hand-maintained mirror of a
 * mount condition (this estate's dominant defect class), and it would be wrong
 * the moment a surface changed when it renders.
 *
 * So the surfaces REGISTER while they are mounted, and the registry is derived
 * from what is genuinely on screen. It fails SAFE in the only direction that
 * matters: if nothing registers, every surface behaves exactly as it does today
 * and the user is over-told rather than under-told.
 *
 * The registry is a plain module-level store read through `useSyncExternalStore`
 * — no new dependency, no provider, and usable from `useStageAwarePlaceholder`,
 * which is called from surfaces outside the conversation subtree.
 */
import { useSyncExternalStore } from 'react'

/** The speaking surfaces, highest authority first. */
export const STALENESS_VOICES = ['card', 'pill', 'placeholder'] as const
export type StalenessVoice = (typeof STALENESS_VOICES)[number]

/**
 * Rank, DERIVED from the ordered tuple above so the order is stated once. A
 * lower number outranks a higher one.
 */
export function stalenessVoiceRank(voice: StalenessVoice): number {
  return STALENESS_VOICES.indexOf(voice)
}

/** Live claim counts, one bucket per voice. Reference-counted: two pills may claim at once. */
const claims: Record<StalenessVoice, number> = { card: 0, pill: 0, placeholder: 0 }

const listeners = new Set<() => void>()

/**
 * The snapshot. A STRING (or null) rather than an object, because
 * `useSyncExternalStore` compares snapshots by identity and a fresh object per
 * read would re-render every subscriber on every store read — the classic
 * getSnapshot-caching defect. The highest-ranked voice currently claimed.
 */
function currentTopVoice(): StalenessVoice | null {
  for (const voice of STALENESS_VOICES) {
    if (claims[voice] > 0) return voice
  }
  return null
}

let snapshot: StalenessVoice | null = null

function emit(): void {
  const next = currentTopVoice()
  if (next === snapshot) return
  snapshot = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): StalenessVoice | null {
  return snapshot
}

/**
 * Claim the staleness voice for `voice` until the returned function is called.
 *
 * Imperative rather than a hook so a component can claim from its own effect
 * with its own condition, and so a test can drive the registry directly.
 */
export function claimStalenessVoice(voice: StalenessVoice): () => void {
  claims[voice] += 1
  emit()
  let released = false
  return () => {
    if (released) return
    released = true
    claims[voice] = Math.max(0, claims[voice] - 1)
    emit()
  }
}

/**
 * May `voice` speak? True when nothing STRICTLY ABOVE it is currently claimed.
 *
 * A surface asking about its OWN voice is unaffected by its own claim, so a
 * component may claim first and ask afterwards without silencing itself.
 */
export function mayStalenessVoiceSpeak(voice: StalenessVoice): boolean {
  const top = getSnapshot()
  if (top === null) return true
  return stalenessVoiceRank(top) >= stalenessVoiceRank(voice)
}

/** Reactive form of {@link mayStalenessVoiceSpeak}. */
export function useMayStalenessVoiceSpeak(voice: StalenessVoice): boolean {
  const top = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  if (top === null) return true
  return stalenessVoiceRank(top) >= stalenessVoiceRank(voice)
}

/**
 * Test seam ONLY. Clears every claim.
 *
 * Exported because the registry is module-level state and a spec that leaked a
 * claim into the next spec would silence a surface for reasons nothing in that
 * spec could explain — a failure mode far more expensive than the export.
 */
export function __resetStalenessVoicesForTest(): void {
  for (const voice of STALENESS_VOICES) claims[voice] = 0
  emit()
}
