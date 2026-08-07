/**
 * ESLint rule: no-raw-influence-fallback (Lane 2, Codex R3-B1 class)
 *
 * The driver "influence" a surface displays or ranks by MUST come from the
 * shared display policy (src/components/results/driverDisplayModel.ts —
 * stamped onto DriverItem.displayInfluence). Reading the RAW metrics
 * (`influenceScore` / `normalisedInfluence`) as a decision basis silently
 * mixes incomparable bases under partial producer coverage: the tornado,
 * the Triage nudge, the strengthen LEHI gate and the model-tab factor map
 * all had this bug.
 *
 * This rule is the FAST-GATE layer (changed-files lint on pre-push): it
 * flags the raw metric used as a DECISION value —
 *   - left operand of a `??` fallback chain (the canonical sanctioned chain
 *     `displayInfluence ?? influenceScore ?? normalisedInfluence` keeps raw
 *     members as RIGHT operands only, so it does not fire; a wrong-ordered
 *     chain does),
 *   - either side of a comparison / arithmetic BinaryExpression (gates,
 *     thresholds, sort comparators).
 * Plain property *creation* (adapters mapping wire fields) and presence
 * probes (`typeof x.influenceScore`, `Number.isFinite(...)`) do not fire.
 *
 * The whole-tree enforcing net is the vitest tripwire
 * (src/components/results/__tests__/no-raw-influence-read.spec.ts), which
 * also catches bare reads this AST rule deliberately leaves to it.
 *
 * Deliberate exception: the V17 dominance GATE (UI-SEM-040) uses absolute /
 * ratio thresholds over the raw metrics — exempted via inline
 * eslint-disable with the UI-SEM-040 rationale at the site.
 */

const RAW_PROPS = new Set(['influenceScore', 'normalisedInfluence'])

function unwrapChain(node) {
  return node && node.type === 'ChainExpression' ? node.expression : node
}

function isRawMember(node) {
  const n = unwrapChain(node)
  return (
    n &&
    n.type === 'MemberExpression' &&
    !n.computed &&
    n.property.type === 'Identifier' &&
    RAW_PROPS.has(n.property.name)
  )
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Raw influence metrics must not be a decision basis — read displayInfluence (driverDisplayModel policy) instead',
      recommended: true,
    },
    messages: {
      rawDecision:
        'Raw "{{prop}}" used as a decision value ({{context}}). Read displayInfluence ' +
        '(stamped by selectDriverDisplayModel) — raw metrics mix incomparable bases ' +
        'under partial producer coverage (Codex R3-B1). For a true adapter/gate, add ' +
        'an inline disable with the rationale (see UI-SEM-040 in buildAnalysisHeroViewModel).',
    },
    schema: [],
  },
  create(context) {
    function report(node, ctx) {
      const n = unwrapChain(node)
      context.report({
        node: n,
        messageId: 'rawDecision',
        data: { prop: n.property.name, context: ctx },
      })
    }
    return {
      "LogicalExpression[operator='??']"(node) {
        if (isRawMember(node.left)) report(node.left, 'first basis of a ?? fallback chain')
      },
      BinaryExpression(node) {
        if (isRawMember(node.left)) report(node.left, 'comparison/arithmetic')
        if (isRawMember(node.right)) report(node.right, 'comparison/arithmetic')
      },
    }
  },
}
