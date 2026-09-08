/**
 * Analysis (New) — what this run already SAID about one node, indexed by node id.
 *
 * ⭐⭐ WHY THIS MODULE EXISTS, AND WHY IT IS A MODULE RATHER THAN A LOOKUP INSIDE
 * THE STRIP. Two surfaces now answer "what does this analysis say about node X":
 * the strip's per-node detail, and — the moment anything else wants it — a
 * canvas hover, an inspector, a coaching card. Two independent derivations of
 * one answer is the defect this estate pays for most often (CLAUDE.md trap 12),
 * and the two would disagree the first time either join changed. The join is
 * made ONCE, here, and handed to the renderer.
 *
 * ⚠⚠ NOTHING IN HERE IS AUTHORED. Every string this module carries is a
 * producer or engine field passed through verbatim — a recommendation's own
 * `title` and `tryThis`, a driver's own `label`, a catalogue method's own
 * `title`/`description`/`prompt`. The module SELECTS and JOINS; it never
 * composes a sentence, never summarises, and never supplies a fallback for a
 * field the engine did not send. A node with nothing said about it produces an
 * insight with an empty `findings` array and a null `driverLabel`, and the
 * renderer's job is then to say what is ABSENT rather than to reassure.
 *
 * ⚠ THE JOIN IS `targetId`, AND IT IS AN IDENTITY JOIN ON PURPOSE. A
 * recommendation reaches a node because the ENGINE named that node, never
 * because a label looked similar or a value matched. `targetId` is also
 * legitimately an EDGE id on the flip/relationship recommendations; an edge id
 * simply matches no node and the recommendation appears against nothing, which
 * is the correct outcome — a relationship is not a node and the strip draws no
 * mark for one.
 *
 * ⚠ WHAT THE DRIVER FLAG DOES AND DOES NOT CLAIM. `drivers` is the GLANCE's
 * driver list, which is CAPPED — the run's remaining drivers are disclosed by
 * the glance's own overflow line, not here. So membership licenses exactly one
 * statement, "this node is among what the glance named as mattering most", and
 * NON-membership licenses nothing at all. That asymmetry is why `driverLabel`
 * is `string | null` and why there is no `isNotADriver`: a surface that could
 * read "not a driver" off this index would be making a claim the cap forbids.
 */

import type { Recommendation } from '../strengthen/strengthenTypes'
import type { MethodEntry } from '../decision-overview/actionsCatalogue'
import type { GlanceDriver } from './analysisNewTypes'
import { methodForRecommendation } from './recommendationMethod'

/**
 * How many findings one node's detail renders before it states a remainder.
 *
 * ⚠ A CAP IS A PRESENTATION CHOICE AND MUST DISCLOSE ITSELF. The remainder is
 * carried as a number so the renderer can say how many it is not showing —
 * silent truncation inside a panel whose whole job is orientation would hide
 * exactly the finding a reader was hunting for.
 */
export const NODE_INSIGHT_FINDING_CAP = 2

/** One engine finding that names this node, carried verbatim. */
export interface NodeInsightFinding {
  /** Stable identity. Tests bind to this, never to a title string. */
  recommendationId: string
  /** `Recommendation.title`, verbatim. */
  title: string
  /**
   * `Recommendation.tryThis`, verbatim — the one practical instruction, or
   * `null` when the recommendation has none. Carried through unchanged: the
   * strip's detail is a CONSUMER of this decision, never a second one.
   */
  tryThis: string | null
  /**
   * `whyNow` falling back to `signal` — BOTH are engine fields, and this is the
   * same precedence `StrengthenTheReasoning` uses when it seeds the Ask-Olumi
   * drawer. It is a choice between two producer sentences, never a composition.
   */
  context: string
  /**
   * The science-grounded technique this finding warrants, or `null`.
   *
   * `null` is the common case by design (`recommendationMethod.ts`): a chip is
   * a claim that decision science prescribes this move here. Callers render
   * nothing for `null` — never a placeholder, never a default technique.
   */
  method: MethodEntry | null
}

/** Everything this run says about ONE node. */
export interface NodeInsight {
  /**
   * ⭐ THE OTHER SECTIONS OF THE PANEL THAT NAME THIS NODE, by their headline.
   *
   * ⚠⚠ THIS EXISTS BECAUSE THE STRIP'S EMPTY-STATE LIED, AND IT WAS WITNESSED
   * ON DEPLOYED `d82e81f0`, NOT REASONED ABOUT. Selecting **Platform Capability
   * Fit** produced *"Nothing else on this panel refers to this node"* while the
   * SAME PANEL, at the same moment, said all four of:
   *
   *   · "Platform Capability Fit is the hinge"                    (key insights)
   *   · "If \"Platform Capability Fit → …\" changes significantly,
   *      \"Status Quo / Defer Decision\" could become the better choice"
   *   · "If \"EU Data Residency Compliance → Platform Capability Fit\" …"
   *   · "Olumi estimated how strongly Platform Capability Fit affects …"
   *
   * The copy claims something about THE WHOLE PANEL; the index knew about TWO
   * of its sections. One name, two questions — and the narrower one was
   * answering for the wider. Note the direction of the harm: the panel's single
   * most important finding was *"this node is the hinge"*, and the card denied
   * that anything mentioned it at all.
   *
   * ⚠ HEADLINES ONLY, VERBATIM. This is a POINTER to a section that is already
   * on screen saying its own thing — not a second rendering of that finding,
   * and nothing here composes a sentence.
   */
  mentions: NodeMention[]
  /**
   * The driver's own label when the glance named this node among what matters
   * most, else `null`. See the header: `null` means "the glance did not name
   * it", which is NOT "it does not matter".
   */
  driverLabel: string | null
  /** Engine order, capped at `NODE_INSIGHT_FINDING_CAP`. */
  findings: NodeInsightFinding[]
  /** How many findings the cap is withholding. Rendered, never silent. */
  withheldFindings: number
}

/** One other place on this panel that names the node. */
export interface NodeMention {
  /** The finding's own id — the join a test binds to, never its text. */
  id: string
  /** Which section is speaking. Used to label the pointer. */
  section: 'keyInsights' | 'sensitivity'
  /** The finding's headline, verbatim. */
  headline: string
}

export type NodeInsightIndex = ReadonlyMap<string, NodeInsight>

export interface BuildNodeInsightsInput {
  /** `vm.strengthen.interventions` — the engine's own list, in engine order. */
  interventions: ReadonlyArray<Recommendation>
  /** `vm.atAGlance.drivers` — the glance's CAPPED driver list. */
  drivers: ReadonlyArray<GlanceDriver>
  /**
   * ⭐ THE REST OF THE PANEL. Every other section whose rows carry a
   * `targetId`, so the strip's *"nothing else refers to this node"* is a claim
   * about the panel rather than about two of its sections.
   *
   * Optional so an existing caller keeps compiling; a caller that omits it gets
   * the OLD, NARROWER answer, which is why the mount passes both and a test
   * pins that it does.
   *
   * ⚠ SCOPE STATED RATHER THAN LEFT IMPLICIT: "How the options compare" is NOT
   * here. Its section carries `rows: ComparisonOption[]`, a different shape
   * with no `AnalysisNewFinding` join, so including it would need its own
   * derivation rather than this one. It names OPTIONS, and the witnessed defect
   * was about a FACTOR — but this is a real remaining narrowness in the empty
   * state's claim, and it is recorded here rather than quietly excluded.
   */
  mentionSections?: ReadonlyArray<{
    section: NodeMention['section']
    findings: ReadonlyArray<{ id: string; headline: string; targetId?: string }>
  }>
}

/**
 * Index the run's findings and drivers by the node they name.
 *
 * Pure: no store reads, no canvas reads, no side effects. A node with nothing
 * said about it is simply ABSENT from the map — the renderer distinguishes
 * "absent" from "present with an empty finding list" by treating both as the
 * same honest absence, so there is no need to materialise empty entries.
 */
export function buildNodeInsights({
  interventions,
  drivers,
  mentionSections = [],
}: BuildNodeInsightsInput): NodeInsightIndex {
  const index = new Map<string, NodeInsight>()

  const entry = (nodeId: string): NodeInsight => {
    const existing = index.get(nodeId)
    if (existing) return existing
    const fresh: NodeInsight = { driverLabel: null, findings: [], withheldFindings: 0, mentions: [] }
    index.set(nodeId, fresh)
    return fresh
  }

  for (const driver of drivers) {
    // A driver with no target names no node this strip can draw. It is still
    // shown by the glance; it is simply not joinable here.
    if (!driver.targetId) continue
    const row = entry(driver.targetId)
    // First wins: the glance's list is already ranked, so a second row naming
    // the same node cannot be more authoritative than the first.
    if (row.driverLabel === null) row.driverLabel = driver.label
  }

  for (const rec of interventions) {
    if (!rec.targetId) continue
    const row = entry(rec.targetId)
    if (row.findings.length >= NODE_INSIGHT_FINDING_CAP) {
      row.withheldFindings += 1
      continue
    }
    row.findings.push({
      recommendationId: rec.id,
      title: rec.title,
      tryThis: rec.tryThis,
      context: rec.whyNow || rec.signal,
      method: methodForRecommendation(rec.id, rec.signalCode, rec.biasCode),
    })
  }

  /*
   * ⚠ NO CAP HERE, DELIBERATELY, AND IT IS A DIFFERENT DECISION FROM THE ONE
   * ABOVE. `findings` is capped because each one RENDERS a whole card; a
   * mention is one headline pointing at a card already on screen. Capping these
   * would reintroduce the same defect one notch quieter — the card would say
   * "and 2 more" where it used to say "nothing".
   */
  for (const { section, findings } of mentionSections) {
    for (const finding of findings) {
      if (!finding.targetId) continue
      const row = entry(finding.targetId)
      // A section may name a node twice; the reader needs to be told once.
      if (row.mentions.some(m => m.id === finding.id)) continue
      row.mentions.push({ id: finding.id, section, headline: finding.headline })
    }
  }

  return index
}
