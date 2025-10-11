#!/usr/bin/env node
// tools/pack-lint/bin/lint.mjs
// Accept only: engine_pack_YYYYMMDD_sha7.zip OR engine_pack_YYYY-MM-DD_sha7.zip

export const namePattern = /^engine_pack_(\d{8}|\d{4}-\d{2}-\d{2})_[a-f0-9]{7}\.zip$/

export function validateName(name){
  return namePattern.test(String(name||''))
}

// CLI: node lint.mjs <filename>
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2] || ''
  const ok = validateName(arg)
  if (ok) {
    console.log(`GATES: PASS — pack-lint (${arg})`)
    process.exit(0)
  } else {
    console.log(`GATES: FAIL — pack naming invalid: ${arg}`)
    process.exit(1)
  }
}
