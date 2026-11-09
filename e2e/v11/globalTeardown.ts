import { EXPECTED, passedSteps } from './lib'

/** The completeness guard: every expected step ran and passed. In teardown, so `--grep` cannot exclude it. */
export default function globalTeardown() {
  const done = new Set(passedSteps()), missing = EXPECTED.filter((s) => !done.has(s))
  console.log(`V11 journey: ${EXPECTED.length - missing.length} of ${EXPECTED.length} steps passed${process.env.V11J_STORES ? '' : ' (J1, Reveal and hiring store audits not covered: V11J_STORES unset)'}`)
  if (missing.length > 0) throw new Error(`V11 journey incomplete: ${missing.join(', ')} did not pass`)
}
