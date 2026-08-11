# PR4 — optional real authentication + two-person collaboration witness

Evidence for the lane. Everything here was **measured**, on the dates shown; nothing is
inherited from a document. Where a claim is derived rather than observed, the derivation is
written out so it can be refuted.

Measured **11 Aug 2026**, against UI staging tip `b62f7e5282cd96798f5062f9045f835afdc9e1b5`
(`https://staging--olumi.netlify.app/version.json` reported that exact commit, so the deployed
build and the branch point are the same tree) and CEE staging `assistants 1.12.0`.

---

## 1. Auth capability on staging Supabase — DERIVED, not assumed

Source: `GET /auth/v1/settings` (public, anon-key, read-only) plus one exercised call per method
with clearly-labelled throwaway accounts at the reserved `example.test` TLD.

| Method | Result today | Evidence |
|---|---|---|
| **email + password sign-up** | **WORKS** — HTTP 200, session returned immediately | `disable_signup: false`, `mailer_autoconfirm: true`; `email_confirmed_at` stamped at creation |
| **email + password sign-in** | **WORKS** — HTTP 200, `access_token` (HS256) | `POST /auth/v1/token?grant_type=password` |
| **magic link, existing user** | **FAILS** — HTTP 500 `unexpected_failure`, *"Error sending magic link email"* | SMTP not configured on the project |
| **magic link, unknown user** | HTTP 422 `otp_disabled` | expected: the app passes `shouldCreateUser: false` |
| **Google OAuth** | **FAILS** — HTTP 400 *"Unsupported provider: provider is not enabled"* | `external.google: false` |
| **anonymous sign-in** | disabled — HTTP 422 `anonymous_provider_disabled` | `external.anonymous_users: false` |

The anon key used is the one **in the deployed bundle** (public by construction). It is never
printed here; SHA-256 prefix `22443e6c08d8c378`, which is byte-identical to the value in
`netlify.toml` — so repo config and deployed reality agree on this one, unusually.

**The load-bearing consequence:** the only method that completes today is the one the product
does not offer, and both methods the product does offer are blocked on configuration only Paul
can change. That is why this lane ships an *honest* front door rather than a working one.

## 2. Deployed-bundle posture — crawled, with a contrast control

88 chunks / 5.87 MB crawled from `/assets/index-COspGXQe.js`:

- `GoTrueClient` present in 1 chunk → the **real** Supabase SDK is in the staging bundle
  (`VITE_STUB_SUPABASE=0` is genuinely in effect).
- `signInWithOtp` present in 1 chunk.
- the stub's marker comment present in **0** chunks.

The zero is supported rather than assumed: `GoTrueClient` is the **contrast control** in the same
sweep, and it read non-zero. An absence claim from a sweep that found nothing at all would be a
claim about the instrument.

## 3. The two-person witness — BLOCKED, with the cause derived at the bytes

`scripts/witness/pr4-two-person-collab-witness.mjs`

- `--dry-run` → **PASS 7/7**, and those seven are discriminating pairs: three well-formed payloads
  pass, four corrupted twins fail on a named problem (leaked siblings' answers, leaked model value,
  missing attribution, rewritten words, missing target). State-class **replayed**: it proves the
  assertions bite, and nothing about the product.
- live against staging → **BLOCKED at leg 4**, verdict in `witness-live-verdict.json`.
  State-class **fresh, two-identity**.

Legs 1–3 passed on the real wire: capability derived, a real Supabase identity obtained, and the
control refusal observed **before** the acceptance path. Leg 4 (owner mints the round) is blocked.

### Why leg 4 is blocked — and why it is *this* cause and not another

CEE answers every owner call `401 verification_unavailable`. `verification_unavailable` is
reachable in `src/utils/supabase-user-jwt.ts` from exactly two guards, both of which fire
**before any signature check**: no `SUPABASE_JWT_SECRET` for an HS256 token, or no JWKS URL for an
asymmetric one. The token Supabase issues here is **HS256** (`alg` read from the token header;
the project's JWKS publishes only an ES256 key, which is a *standby* key, not the signing key).

Three probes against the same endpoint, one of which was expected to differ:

| Bearer sent | Response code |
|---|---|
| garbage, not JWT-shaped | `invalid_token` |
| well-formed JWT, **one character flipped in the signature** | `verification_unavailable` |
| valid, signature-intact HS256 token | `verification_unavailable` |

The first row is the positive control: the route **can** emit a different reason, so
`verification_unavailable` is discriminating and not a constant. The second row is the decisive
one: a configured-but-wrong secret would fail signature verification and answer `invalid_token`.
It answers `verification_unavailable` instead, which is only reachable at the
`!secret || secret.length === 0` guard.

**Therefore `SUPABASE_JWT_SECRET` is unset or empty on the CEE staging service.** This is a
derivation from deployed behaviour, not a reading of any config file — CEE's `/v1/status` exposes
no auth configuration, so it cannot be confirmed from the service's own report.

## 4. RED-first and mutants

**RED-first, at pristine `b62f7e52`,** before any source change:
`AuthContext.optionalAuth.spec.tsx` collected **12 by name** and **8 failed**; the three new
`LoginPage` cases failed against the unchanged page. The four that already passed are the
byte-identical-guest pins, and they are supposed to pass — they exist to fail if the *optional*
half ever breaks.

**Eight mutants**, in a tree whose isolation was proven **by writing a sentinel and checking the
source did not change** (not by reading paths — an APFS hard link has defeated that here before),
against **committed** state, each with an applied-check asserting exactly one file changed in
`src/`, restored `HEAD`-relative, with a leading and a trailing control that agree.

| Mutant | Result |
|---|---|
| `isServerFault` threshold `500` → `600` | 2 RED |
| `signInUnavailable` drops its `status: 501` (the cross-module seam) | 1 RED |
| `asFault` stops stamping thrown errors | 1 RED |
| `asFault` **overwrites** an existing status | 1 RED *(see below)* |
| guest `signOut` branch removed | 1 RED |
| `OptionalAuthProvider` never adopts a real session | 1 RED |
| guest `loading` flipped to `true` | 1 RED |
| rate-limit status `429` → `431` | 1 RED *(see below)* |

⚠ **Two of those eight SURVIVED on the first pass, and both were real holes, not equivalents.**
They are recorded because the fix is the interesting part:

- **`asFault` overwrite.** The suite had a 422-keeps-its-status case, but it *resolved* an error,
  and `asFault` only runs in the `catch`. So the guard against promoting a 422 to a server fault
  was tested by a case that never reached it — a test passing on the wrong object. Closed by a
  **thrown** 422 twin. Had it shipped, a refactor could have deleted the guard and reintroduced an
  enumeration leak through the very code written to remove a lie.
- **rate-limit `429`.** Every rate-limit fixture also matched the message fallback, so the status
  branch carried no test weight at all. Closed by a 429 whose wording mentions no rate.

Both were found only because a mutant survived; neither was visible in a green suite.

## 5. What is NOT claimed

- **No UI journey witness.** Everything here is wire-level and jsdom. Neither collaboration page
  has been rendered in a real browser by this lane, and jsdom cannot prove visibility or layout.
- **The fixtures are not captures.** No round has ever been minted on staging, so there is no real
  traffic to record. They are built from the wire contract in `src/collab/collabService.ts` and
  say so in their own header. When leg 4 unblocks, replace them with real captures.
- **The ES256 path is untested.** No ES256 token can be minted while the project signs HS256, so
  whether CEE has `SUPABASE_URL`/`SUPABASE_JWKS_URL` set is **unknown**, not "absent".
