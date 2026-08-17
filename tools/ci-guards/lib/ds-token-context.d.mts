// tools/ci-guards/lib/ds-token-context.d.mts
// Types for the DS-guard token-context helpers, so TypeScript consumers (their
// spec, and the guard itself if it is ever ported) are checked rather than
// silently `any`. Same convention as flag-deployment-drift.d.mts.
//
// The implementation is plain .mjs deliberately: `node
// tools/ci-guards/check-ds-compliance.mjs` must run with no build step and no
// loader. This file gives it types without that cost.

/**
 * True for a `#hex` token whose own characters cannot settle colour-vs-reference:
 * the 3-character all-digit shape (`#000`–`#999`), which collides with PR/issue
 * references. `#fee` (has a hex letter) and any 6-digit token are unambiguous.
 */
export declare function isAmbiguousNumericHex(token: string): boolean

/**
 * True when the `#` at `index` in `codeLine` sits where a VALUE belongs (start of
 * line, or immediately after `:` `;` `,` `(` `=` `[` `{` or an opening quote)
 * rather than mid-prose. Used only for the ambiguous shape above.
 */
export declare function isColourValuePosition(codeLine: string, index: number): boolean

/**
 * Blank every comment in `text`, returning EXACTLY ONE ENTRY PER SOURCE LINE with
 * comment characters replaced by spaces (never removed), so column offsets still
 * align with the original source.
 *
 * Carries block-comment and string/template state ACROSS lines — that is the whole
 * point: block-comment continuation lines start with prose, so a per-line prefix
 * test cannot see them.
 */
export declare function stripComments(text: string): string[]
