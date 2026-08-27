/**
 * The first-use entry copy, in a LEAF with no imports of its own.
 *
 * Two surfaces render this same sentence in two different syntactic positions:
 * `FirstUseComposer` passes it as a placeholder ATTRIBUTE, and `OlumiTabBody`
 * renders it as TEXT. A grep for one shape does not find the other, which is how
 * four sweeps missed the second — so they share one constant rather than two
 * copies that agree today.
 *
 * ⚠ AND IT LIVES HERE, NOT ON `FirstUseComposer`, FOR A MEASURED REASON.
 * Exporting it from the component made `OlumiTabBody` import the component, which
 * pulled `FirstUseComposer` and its transitive imports into the DOCK IMPORT
 * CLOSURE — and `tests/ci-guards/shell-conformance.spec.ts` checks that closure
 * for raw typography. It went from 0 violations to 54. The guard was right: a
 * shared string must not drag a component's dependency graph across an
 * architectural boundary. A leaf carries no graph.
 */
export const FIRST_USE_PLACEHOLDER =
  'Describe the decision or challenge you’re working through, any options you’re weighing, and what a good outcome looks like.'
