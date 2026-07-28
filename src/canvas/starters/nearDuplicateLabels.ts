/**
 * nearDuplicateLabels — the label-collision detector for shipped starter graphs.
 *
 * WHY THIS EXISTS. ROADMAP 1.320 established, with a clean 6/6 correlate, that
 * graph edits fail at roughly a 50% base rate on graphs carrying a
 * near-duplicate label sibling (its exemplar: `Three-Year TCO
 * {Multiplier/Pressure/Horizon}`), and land on graphs carrying none. The
 * confirmed mechanism is `ENTITY_KIND_MISMATCH` at CEE's routing validator —
 * the entity is FOUND by label and then rejected by kind. So the hazard is
 * created upstream, by the LABELS themselves: once two entities in one graph
 * are confusable by label, a label-first resolver can resolve to the wrong one.
 *
 * That row left near-duplicate labels "assessed-only" — nothing enforced it.
 * The starter fixtures are the one place the product SHIPS graph content it
 * chose, on the first screen a new user ever sees, so this is where the rule
 * can actually be enforced rather than merely observed.
 *
 * WHY A DERIVED CHECK AND NOT A LIST (CLAUDE.md trap 12). A hand-maintained
 * list of "known bad label pairs" would drift silently the first time a
 * starter is recaptured. This derives every pair from the fixture itself, so a
 * recapture that reintroduces a collision fails loud instead of reading green.
 *
 * THE RULE, and why each clause is here rather than a tuned similarity cutoff:
 *   (a) EQUAL    — same normalised token set. Unambiguously confusable.
 *   (b) SUBSET   — one label's tokens are a strict subset of the other's
 *                  (`Data Team Capacity` ⊂ `Data Team Capacity Strain`). A
 *                  label-first resolver matching the shorter string hits the
 *                  longer entity, or vice versa.
 *   (c) JACCARD  — token overlap ≥ 0.6, which is exactly what 1.320's
 *                  `Three-Year TCO {Multiplier,Pressure}` exemplar scores
 *                  (3 shared / 5 union). Calibrated to the recorded defect,
 *                  not to whatever the current fixtures happen to contain.
 *
 * Deliberately NOT flagged: character-level edit distance. `Engineering
 * Attrition Risk` vs `Engineering Team Attrition Loss` scores 0.74 on
 * Levenshtein but only 0.4 on token overlap, and reads as a genuine
 * factor/risk pairing rather than a resolver hazard. Flagging it would mean
 * tuning the threshold to the fixtures rather than to the mechanism.
 */

/** Tokens carrying no distinguishing meaning for a label-first resolver. */
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'for', 'on', 'with'])

export interface LabelledNode {
  id: string
  kind: string
  label: string
}

export type CollisionRule = 'EQUAL' | 'SUBSET' | 'JACCARD'

export interface LabelCollision {
  rule: CollisionRule
  /** Token-overlap score; 1 for EQUAL/SUBSET, the Jaccard index otherwise. */
  score: number
  a: LabelledNode
  b: LabelledNode
}

/** Lowercase, strip punctuation, drop stopwords, return the distinguishing token set. */
export function labelTokens(label: string): Set<string> {
  const cleaned = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  if (!cleaned) return new Set()
  return new Set(cleaned.split(/\s+/).filter((t) => t && !STOPWORDS.has(t)))
}

function isStrictSubset(a: Set<string>, b: Set<string>): boolean {
  if (a.size >= b.size) return false
  for (const t of a) if (!b.has(t)) return false
  return true
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0
  for (const t of a) if (b.has(t)) shared++
  const union = a.size + b.size - shared
  return union === 0 ? 0 : shared / union
}

/**
 * Every label collision in one graph, as defined by the rule above.
 *
 * Nodes with an empty token set (a label that is pure punctuation) are skipped
 * rather than reported as colliding with each other — an empty-vs-empty match
 * is a normalisation artefact, not a resolver hazard.
 */
export function findNearDuplicateLabels(nodes: readonly LabelledNode[]): LabelCollision[] {
  const entries = nodes
    .map((n) => ({ node: n, tokens: labelTokens(n.label ?? '') }))
    .filter((e) => e.tokens.size > 0)

  const collisions: LabelCollision[] = []
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]
      if (a.tokens.size === b.tokens.size && isStrictSubset(a.tokens, b.tokens) === false) {
        // Same size: equality is the only subset relation possible.
        const equal = [...a.tokens].every((t) => b.tokens.has(t))
        if (equal) {
          collisions.push({ rule: 'EQUAL', score: 1, a: a.node, b: b.node })
          continue
        }
      }
      if (isStrictSubset(a.tokens, b.tokens) || isStrictSubset(b.tokens, a.tokens)) {
        collisions.push({ rule: 'SUBSET', score: 1, a: a.node, b: b.node })
        continue
      }
      const score = jaccard(a.tokens, b.tokens)
      if (score >= 0.6) {
        collisions.push({ rule: 'JACCARD', score, a: a.node, b: b.node })
      }
    }
  }
  return collisions
}

/** Human-readable one-liner per collision, for assertion messages. */
export function formatCollision(c: LabelCollision): string {
  return `${c.rule}(${c.score.toFixed(2)}): ${c.a.kind} "${c.a.label}" <-> ${c.b.kind} "${c.b.label}"`
}
