/**
 * ⭐ D3 cut 6, HOLD-AT-1.0 — the UI's MIRROR of CEE `heldLinkOf`'s predicate (Science d5 #87 6008807178; DL 0df0e1: a pure
 * predicate over exactly the fields CEE reads, no numbers computed, no second notion of "user-stated"). A link the USER
 * stated whose own stated range excludes zero is held at existence 1.0 on every Run's input, so the canvas must not show
 * Olumi's stored doubt for it. Read on the RAW wire edge at ingestion (`existenceHeld`); the displays read that flag.
 *
 * Fields read (and only these): strength.mean, provenance.source, provenance.magnitude, provenance.source_quote,
 * provenance.clamped_from, provenance.definitional, provenance.natural_effect.{amount, strength_mean, stated_range.{low, high}}.
 *
 * ⛔ A MIRROR, NOT AN AUTHORITY: `__tests__/fixtures/held-link-parity.json` is byte-identical to CEE's copy and both repos
 * pin its sha256 ("held-link parity fixture digest"). Register row (cut 7): move this into @talchain/schemas.
 */
type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const TOL = 1e-9
const near = (a: number, b: number): boolean => Math.abs(a - b) <= TOL * Math.max(1, Math.abs(b))

/** CEE `carriesStatedSize`: the link still carries the user's β, or a verified stored clamp of it. */
function carriesStatedSize(e: Rec, beta: number): boolean {
  const mean = isRec(e.strength) ? e.strength.mean : undefined
  if (!finite(mean)) return false
  if (near(mean, beta)) return true
  const clampedFrom = isRec(e.provenance) ? e.provenance.clamped_from : undefined
  return finite(clampedFrom) && near(clampedFrom, beta) && near(Math.abs(mean), 1) && Math.sign(mean) === Math.sign(beta)
}

/** CEE `isUserStatedLink`: the user sized it (`linkSizing` 'user'), or their brief stated it WITH its quote. */
function isUserStatedLink(p: Rec): boolean {
  if (p.source === 'user_specified' || p.magnitude === 'user_stated') return true
  return p.source === 'brief_extraction' && typeof p.source_quote === 'string' && p.source_quote.trim() !== ''
}

/** The ONE ingestion reader, every hop (like `strengthPlaceholderPatch`): `{ existenceHeld: true }` iff CEE holds the link. */
export function existenceHeldPatch(wireEdge: unknown): { existenceHeld?: true } {
  return isHeldUserLink(wireEdge) ? { existenceHeld: true } : {}
}

/** Whether CEE holds this wire edge at existence 1.0 on the Run's input (CEE `heldLinkOf(e) !== null`). */
export function isHeldUserLink(wireEdge: unknown): boolean {
  if (!isRec(wireEdge) || !isRec(wireEdge.provenance)) return false
  const p = wireEdge.provenance
  if (!isUserStatedLink(p)) return false
  // CEE: the user's own definitional link holds with no range (Science d5, 6 Oct).
  if (p.definitional === true) return true
  const ne = p.natural_effect
  if (!isRec(ne) || !isRec(ne.stated_range)) return false
  const { low, high } = ne.stated_range
  if (!finite(low) || !finite(high) || !finite(ne.amount) || ne.amount === 0 || !finite(ne.strength_mean)) return false
  if (!carriesStatedSize(wireEdge, ne.strength_mean)) return false
  if (!((low > 0 && high > 0) || (low < 0 && high < 0))) return false
  // CEE holds only when its spread is finite and positive — the SAME arithmetic (Codex r2 #2643: an underflowing β or an
  // overflowing range is refused there, so it is here); the value itself is never used.
  const spread = Math.abs((high - low) * (ne.strength_mean / ne.amount)) / 3.29
  return Number.isFinite(spread) && spread > 0
}
