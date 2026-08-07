/**
 * Types for `channelTriple.mjs`. Follows the `src/generated/validators.js` +
 * `validators.d.ts` pattern already used in this repo for a JS module that a
 * plain node script and TypeScript both have to consume.
 */

/** A colour declared as `rgb(var(--x-rgb))`, capturing the channel property. */
export declare const CHANNEL_TRIPLE_FORM: RegExp

/** `'39 122 157'` -> `'#277A9D'`; null if not three in-range channels. */
export declare function tripleToHex(triple: string): string | null

/** Resolve `rgb(var(--x-rgb))` to a hex via `lookup`; null if not that form. */
export declare function resolveChannelTriple(
  value: string,
  lookup: (name: string) => string | null | undefined,
  depth?: number,
): string | null

/** A `--token`'s raw declared value in a brand.css source string. */
export declare function declaredValue(css: string, token: string): string | null

/**
 * The literal hex a `--token` resolves to across all three declaration forms
 * brand.css uses (literal hex, `var()` alias, channel triple). Null when it
 * does not resolve to a literal colour.
 */
export declare function resolveTokenHex(css: string, token: string, depth?: number): string | null
