/**
 * ESLint rule: no-raw-chance-read (#2747 r2, the chance authority gate)
 *
 * Every chance a surface shows must come through ONE gate (`src/canvas/runView/runView.ts`:
 * `chanceFigureOf` / `chanceOf` / `chanceCellOf` / `goalChanceRange` / `mainDriverOf`), which gives a figure only when
 * CEE's canonical cell licenses it for the current Run. Codex found surfaces that read the raw number instead (the Model
 * tab's 46%, the matrix's driver line, a risk "exposure" that was a win share), and a name census with FILE-wide
 * exemptions could not see them. This rule reads every member access, keyed read and destructure of a chance or
 * probability FIELD in display code, so each read must either go through the gate or say, on its own line, why it may
 * read the raw number:
 *
 *   // eslint-disable-next-line chance-gate/no-raw-chance-read -- chance-gate: <category>: <reason>
 *
 * Never file-wide. The census backstop (`src/canvas/runView/__tests__/chanceAuthorityGate.census.spec.ts`) fails on a
 * file-wide or unexplained disable, on an unknown category, and on any read the rule reports.
 *
 * THE FIELDS, from @talchain/schemas 0.83.0 (`dist/**.d.ts`) and the report/licence names DGAI maps them to:
 *   goal chance        probability_of_goal, probability_of_joint_goal, goal_probability, goalProbability, jointGoalProbability
 *   per-limit chances  probability, prob_satisfied, constraint_probabilities, conditional_probabilities,
 *                      conditional_probability, marginal_probability, joint_probability
 *   win share          win_probability, win_probabilities, winProbability
 *   licensed figures   pct, pct_by_option, pctByOption, pct_if_side, pctIfSide, goal_chances, goalChances
 *   range bounds       low_pct, high_pct, lowPct, highPct
 *   driver figures     driver_by_option, driverByOption
 * NOT chances, deliberately left out: `exists_probability` (a link's existence belief, a model input the user sets),
 * `p_low` / `p_high` (an event risk's occurrence bounds, a model input),
 * `switch_probability` / `marginal_switch_probability` (a robustness frequency), `evpi_percentage_points` (value of
 * information), `p10`/`p50`/`p90` (outcome quantiles) and `lower`/`upper` (generic interval bounds).
 */

export const CHANCE_FIELDS = Object.freeze([
  'probability_of_goal', 'probability_of_joint_goal', 'goal_probability', 'goalProbability', 'jointGoalProbability',
  'probability', 'prob_satisfied', 'constraint_probabilities', 'conditional_probabilities', 'conditional_probability',
  'marginal_probability', 'joint_probability',
  'win_probability', 'win_probabilities', 'winProbability',
  'pct', 'pct_by_option', 'pctByOption', 'pct_if_side', 'pctIfSide', 'goal_chances', 'goalChances',
  'low_pct', 'high_pct', 'lowPct', 'highPct',
  'driver_by_option', 'driverByOption',
])

/** The closed set of reasons a line may give. Each is a role that never puts an ungated chance on screen. */
export const CHANCE_GATE_CATEGORIES = Object.freeze({
  gate: 'inside the authority gate itself (runView.ts gate functions)',
  gated: 'a figure the gate already produced (RunView.chanceOf / chanceFigureOf / goalChanceRange / mainDriverOf), carried on',
  reader: 'a licence/range/report reader that parses wire fields into the gate\'s inputs; displays nothing',
  mapper: 'a wire → report/view mapper; displays nothing',
  'win-share': 'a win share, said as a share of runs where the option comes out on top, never as a chance',
  presence: 'a presence or absence check; no number leaves the line',
  write: 'builds or copies a record (snapshot, export, request); never displayed as a chance',
  'model-input': 'a model input the user or Olumi set (a branch probability), not an analysis result',
  debug: 'the developer debug panel and its export',
  'not-chance': 'a different quantity that shares a field name (Olumi\'s confidence in a factor); never a chance',
})

const FIELDS = new Set(CHANCE_FIELDS)

function fieldOfMember(node) {
  if (!node.computed && node.property.type === 'Identifier' && FIELDS.has(node.property.name)) return node.property.name
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string' && FIELDS.has(node.property.value)) {
    return node.property.value
  }
  return null
}

function isWriteTarget(node) {
  const parent = node.parent
  return parent && parent.type === 'AssignmentExpression' && parent.left === node
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'A chance or probability field is read only through the chance authority gate (runView.ts)',
      recommended: true,
    },
    messages: {
      rawChance:
        'Raw chance field "{{field}}" read outside the chance authority gate. Read it through RunView ' +
        '(chanceFigureOf / chanceOf / chanceCellOf / goalChanceRange / mainDriverOf), or remove the figure. A line ' +
        'that must read it says why: "// eslint-disable-next-line chance-gate/no-raw-chance-read -- chance-gate: ' +
        '<category>: <reason>" (#2747).',
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        const field = fieldOfMember(node)
        if (field !== null && !isWriteTarget(node)) context.report({ node: node.property, messageId: 'rawChance', data: { field } })
      },
      'ObjectPattern > Property'(node) {
        const key = node.key
        const field = key.type === 'Identifier' ? key.name : key.type === 'Literal' ? key.value : null
        if (typeof field === 'string' && FIELDS.has(field)) context.report({ node: key, messageId: 'rawChance', data: { field } })
      },
    }
  },
}
