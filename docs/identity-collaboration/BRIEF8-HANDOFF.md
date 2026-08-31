# Identity and Collaboration acceptance

This is the bounded acceptance slice for [Brief 8's implementation plan](https://github.com/Talchain/olumi-programme-docs/issues/26#issuecomment-5478823666). It changes no production authentication, ownership, guest persistence, or Collaboration policy. It does not establish that the product journey passes until it has run against an identified deployment with controlled accounts.

## Run with controlled accounts

Use two existing, authorised **synthetic staging accounts**, A and B, with known passwords. A owns the new test model; B is the otherwise-equivalent isolation control. Both accounts must be approved for test data and the chosen deployment. Do not use real customer work.

Supply these variables through a private environment, outside the repository and shared transcript:

- `RUN_IDENTITY_ACCEPTANCE=1`
- `IDENTITY_UI_URL`: approved deployed UI URL, preferably immutable
- `IDENTITY_EXPECTED_UI_COMMIT`: full 40-character deployed UI commit
- `IDENTITY_EXPECTED_CEE_COMMIT`: full 40-character CEE source commit, independently resolved from the reported deployment
- `IDENTITY_SUPABASE_URL` and `IDENTITY_SUPABASE_ANON_KEY`: that deployment's public project configuration
- `IDENTITY_A_EMAIL` and `IDENTITY_A_PASSWORD`
- `IDENTITY_B_EMAIL` and `IDENTITY_B_PASSWORD`

With Node 20 and repository dependencies installed:

```sh
pnpm exec playwright test --config=playwright.identity.config.ts
```

This is an explicit, serial, no-retry suite. Its separate filename/configuration keeps it out of default browser and unit-test collection. Missing configuration must fail, not turn an unexecuted journey into a green skipped suite. Do not use the historical Core global setup: that setup creates accounts through public signup.

The run creates synthetic test data and exercises the real UI/services. It must never provision or reset accounts, manufacture owner tokens, impersonate users with a service-role client, or install mocked product responses. Retain fixture IDs for controlled cleanup; the harness must not delete unknown/pre-existing work. It must not record passwords, JWTs, participant invite credentials, raw network bodies, traces, video, or authenticated screenshots in shared evidence.

## Acceptance boundaries

| Link | Required evidence |
| --- | --- |
| Sign in | Real password sign-in; trusted server identity, not the guest sentinel |
| Create and return | Actual UI creates a model owned by A; the same model ID and graph survive reload and a separate browser context |
| Private ownership | A reads the specific row; an otherwise-equivalent B request cannot read that row |
| Round ownership | A opens a round on that model; B's valid, non-empty equivalent request is refused |
| Participant authority | An invitee contributes through the participant path; that capability cannot perform an owner operation |
| Attribution | Owner sees the contribution on the same round/model and attributed to the participant who supplied it |
| Guest | A fresh guest can model/reason and return, without acquiring private ownership or depending on sign-in |

Record the first failing transition. Later steps are **NOT REACHED**, not passed. Source inspection, isolated mocks, a healthy service, and a successful admin read are not mounted ownership or isolation proof. Do not treat an invalid empty request rejected by validation as an authorisation control. Bind accepted and refused requests to the same model, target, valid request shape, and deployment.

The current harness covers the owner/Collaboration sequence and guest entry only. Fresh-guest reasoning/reload and mounted auth-failure recovery are explicitly unimplemented; its overall mission verdict remains INCOMPLETE even if all implemented checks pass. The safe JSON result is written under `test-results/identity/` and distinguishes failure from steps not reached.

UI `version.json` and CEE through the same-origin `/bff/cee/health` are checked against expected commits before and after the sequence, including on failure. CEE currently reports a short SHA: independently resolve that prefix to a full current source commit before setting the variable. These are bracketing health observations, not per-response identity telemetry; no claim of stable prompt configuration or absence of an intervening deployment follows from them.

## Integration boundaries retained

- **Guest claim:** `lane/pending-guest-claim` owns `LoginPage`, the scenario pointer/store, `pendingGuestClaim`, and `scenarioTrail`. This slice does not change or duplicate them. The server's existing `claim_guest_scenario` authority is the intended integration; possession of a guest UUID alone must never be described as private user ownership. Its caller must use trusted authenticated identity, retain the existing scenario ID across sign-in, and preserve guest work on failure. Proof of that lane's implementation remains separate.
- **Participant identity:** the banked `feat/collab-workspace-person-identity` branches own persistent person identity. This slice exercises the existing round-scoped participant capability and server attribution. It introduces no person registry, facilitator escalation, organisation model, or team-consensus rewrite.
- **Merged auth:** UI #989's final merged revision supersedes the earlier review against `7266f5c`. This slice does not reopen that obsolete finding or rewrite the provider.
- **Primary:** remains the sole merge/deploy authority. Guest-first Monday testing is not blocked by this work.

## Access-policy disposition needed

On 31 August 2026, the live Supabase settings reported `disable_signup: false` and `mailer_autoconfirm: true`, while the UI described an invite-only pilot. This is an observed policy discrepancy, not permission to create public accounts or change server configuration. Primary/Paul must decide its disposition. The intended PoC shape in Brief 8 is request access → manual approval/provisioning → sign in; no access-request implementation or approval guarantee is supplied by this acceptance slice.

At handoff, report signed-in journey, ownership, user isolation, Collaboration, guest non-regression, access-policy finding, dependencies/collisions, and the next implementation slice separately. A harness PR or green offline checks do not close the product mission.
