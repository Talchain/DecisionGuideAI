// FIXTURE — var(--token, #hex) fallback. production-hex EXCLUDES fallback hex
// (scoping decision #1: token-first), so this must NOT be flagged.
export const withFallback = 'var(--info, #AB12CD)'
