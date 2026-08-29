#!/usr/bin/env node
/**
 * BUILD-TIME FAIL-CLOSED CHECK — a DEPLOY may not be built without a V5 endpoint.
 *
 * `src/v5/v5Adapter.ts::resolveEndpoint` throws when `VITE_V5_ENDPOINT` is absent
 * or blank, because both former fallbacks pointed at the retired
 * `/bff/orchestrate/*` family (closed at the Netlify edge, server routes deleted
 * at CEE). That runtime throw is the SECOND line of defence. This is the first:
 * catch the misconfiguration when the bundle is built, not when a user sends a turn.
 *
 * ⚠ WHY THIS IS SCOPED TO DEPLOY CONTEXTS, AND WHY THAT IS NOT A LOOPHOLE.
 * Vite CONSTANT-FOLDS `import.meta.env.VITE_V5_ENDPOINT` at transform time, so the
 * endpoint is chosen when the bundle is BUILT, from dashboard state nobody can see.
 * A deploy is therefore the moment the choice becomes real, and a deploy is what
 * this blocks. The repo's own CI build job deliberately does NOT set the variable
 * (it builds to check compilation and bundle policy, not to serve traffic), and
 * failing it there would be a false red that teaches people to route around this
 * check — the broken-alarm defect.
 *
 * The PROPERTY ITSELF is not left to this check: it is enforced unconditionally,
 * in every context, by `assert-no-legacy-orchestration.mjs`, which asserts the
 * retired endpoint is absent from the built bundle however it got there. This
 * script only converts "the deploy will be misconfigured" from a runtime surprise
 * into a build failure.
 *
 * ⚠ Correct for ABSENT, not merely for falsy — the predicate class this whole
 * excision removed was an exact-match comparison under which an unset variable
 * and an explicitly-false one behaved identically.
 */
const RAW = process.env.VITE_V5_ENDPOINT
const configured = typeof RAW === 'string' && RAW.trim().length > 0

// Netlify sets NETLIFY=true for every build it runs; CONTEXT names the deploy kind.
const isDeploy = process.env.NETLIFY === 'true' || Boolean(process.env.DEPLOY_PRIME_URL)

if (configured) {
  // Reject BEFORE reporting success — a PASS line printed above a rejection is
  // the kind of output a reader skims and mis-reads as green.
  if (/\/orchestrate\/v1\//.test(RAW)) {
    console.error(
      '::error::VITE_V5_ENDPOINT points at the RETIRED /orchestrate/v1/ family, which is\n' +
      'closed at the Netlify edge and deleted server-side at CEE. Configuring it explicitly\n' +
      'is not a way back in.',
    )
    process.exit(1)
  }
  // Never print the value: it is a URL, but printing config encourages printing secrets.
  console.log('assert-v5-endpoint-configured: PASS (VITE_V5_ENDPOINT is set)')
  process.exit(0)
}

if (isDeploy) {
  console.error(
    '::error::VITE_V5_ENDPOINT is not set, and this is a DEPLOY build.\n' +
    'The V5 orchestration endpoint has no fallback by design: the legacy\n' +
    '/bff/orchestrate/* family is closed at the Netlify edge and CEE has deleted\n' +
    'the server routes, so defaulting to it would ship a guaranteed outage.\n' +
    'Set VITE_V5_ENDPOINT in the site environment and redeploy.',
  )
  process.exit(1)
}

console.warn(
  'assert-v5-endpoint-configured: VITE_V5_ENDPOINT is not set. This is a NON-DEPLOY\n' +
  'build, so it is not fatal — but the resulting bundle CANNOT send a turn: the\n' +
  'adapter fails closed at dispatch rather than falling back to a retired endpoint.',
)
