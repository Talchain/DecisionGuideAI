/**
 * Types for the shared type-scale resolver. The runtime lives in the sibling
 * `type-scale.mjs`, which is plain `.mjs` so that BOTH the `.mjs` census script
 * (plain node, no build step) and a vitest `.ts` spec can import it.
 *
 * This sidecar is the established estate pattern — `scripts/build-id.d.mts` is
 * consumed the same way from `vite.config.ts`. Without it, a `.ts` importer
 * raises TS7016 under `strict` and lands a NEW diagnostic in the typecheck
 * ratchet, so it is required, not polish.
 */
export declare const TW_SIZE_PX: Readonly<Record<string, number>>
export declare const TW_WEIGHT: Readonly<Record<string, number>>
export declare const TW_LEADING: Readonly<Record<string, number>>
export declare const COUNTER_SCALED_PX: RegExp

export type SizeOutcome = 'resolved' | 'absent' | 'unparseable'

export declare const SIZE_OUTCOME: {
  readonly RESOLVED: 'resolved'
  readonly ABSENT: 'absent'
  readonly UNPARSEABLE: 'unparseable'
}

export interface TraitError {
  axis: 'size' | 'weight' | 'lineHeight'
  className: string
  context: string | null
  message: string
}

export interface TypeTraits {
  size: number | null
  weight: number | null
  lineHeight: number | null
  sizeOutcome: SizeOutcome
  /** No error branch exists for `font-*`, so this is never `unparseable`. */
  weightOutcome: 'resolved' | 'absent'
  lineHeightOutcome: SizeOutcome
  errors: TraitError[]
}

export declare function classesToTraits(classString: string, context?: string): TypeTraits
export declare function resolveSizePx(
  classString: string,
  context?: string,
): { px: number | null; outcome: SizeOutcome; errors: TraitError[] }
export declare function errorMessages(traits: TypeTraits): string[]
