// FIXTURE — POSITIVE CONTROL. A raw hex in a normal .tsx path (NOT debug/poc/theme,
// NOT a var() fallback) — production-hex SHOULD count this. It pairs with the excluded
// samples so the exclusion test also proves the scanner still DETECTS, guarding against
// a path-scoping regression that silently excludes the whole fixture root.
export const realColour = '#AB12CD'
