# PLoT bearer — exposure, boundary, and rotation runbook

**Status:** the code fix is in this PR. **The rotation is NOT done and is Paul's action.**
**Credential identified only as `sha256:e10e8e9d`** (first 8 hex of the SHA-256 of the
64-character literal). Its value appears nowhere in this repo, this file, the commit
history of this branch, or any CI log — and must not be pasted into any of them.

---

## 0. The one thing an ops reader usually gets wrong

> **Renaming the variable off the `VITE_` prefix is NOT the fix.**

`VITE_` is not a scope. It is a *publication instruction* to Vite. But the prefix is
not what published the secret — **the browser reading it** is. Any value the client
bundle resolves is public by construction, whatever it is called, because Vite
replaces the read with the literal at build time and ships it to every visitor.

Concretely, the exposure was invisible to name-based checks. The emitted asset was:

```js
function c(){const c="<64-char secret>";return{Authorization:`Bearer ${c}`}}
```

The variable name is **compiled away**. Measured on a reproduction build:

| probe | result |
|---|---|
| the secret's VALUE present in the bundle | **1 chunk** |
| the string `VITE_PLOT_BEARER` present in the bundle | **0 times** |

So `grep VITE_PLOT_BEARER dist/` returns a confident all-clear whether or not the
secret is baked in. **Do not accept a grep for the variable name as evidence.**

The actual fix is that **the browser must not read the credential at all** — the call
moves behind a server-side boundary. That is what this PR does.

---

## 1. Where the credential is read and injected

### Before this PR

| step | location |
|---|---|
| **read** | `src/lib/plotAuthHeaders.ts:55` — `import.meta.env?.VITE_PLOT_BEARER` |
| **injected (1)** | `src/lib/plotFetch.ts` — merged `Authorization: Bearer …` into ~22 browser→PLoT seams |
| **injected (2)** | `src/adapters/cee/client.ts:674` — `isPlotDirectBase(baseURL) ? plotAuthHeaders() : {}`, reaching `draftModel` → `/draft-graph` |
| **build var** | `VITE_PLOT_BEARER`, resolved by the **Netlify UI site** at build time |

### After this PR

- `src/lib/plotAuthHeaders.ts` — **deleted**.
- `src/lib/plotFetch.ts` — a bare pass-through; attaches nothing.
- `src/adapters/cee/client.ts` — the merge is deleted.
- **The browser holds no PLoT credential on any path.** Verified by rebuilding with
  `VITE_PLOT_BEARER` still set and scanning the emitted output: **0 files contain the
  value; no `plotAuthHeaders` chunk is emitted.**
- Injection moves to `netlify/edge-functions/plot-proxy.ts:138`, serving
  `/bff/engine/*` and `/engine/*`, reading **`PLOT_AUTH_TOKEN`** server-side.
- `src/lib/plotSameOrigin.ts` normalises the two absolute-base escape hatches
  (`VITE_CEE_DRAFT_BASE`, `VITE_PLOT_ENGINE_URL`) back onto `/bff/engine`, so those
  variables may stay set without routing around the boundary.

---

## 2. What Paul must set, and where

| # | Where | Variable | Action |
|---|---|---|---|
| 1 | **Netlify** → UI site → Site configuration → Environment variables | `PLOT_AUTH_TOKEN` | **CREATE.** Not `VITE_`-prefixed. Value = PLoT's current bearer. Scope it to every context the site deploys (at minimum the `staging` branch context; also Production if/when this reaches `main`). |
| 2 | **Netlify** → same screen | `VITE_PLOT_BEARER` | **DELETE**, in *every* context where it is set. After this PR nothing reads it, so deletion is cleanup — but it is the cleanup that stops a future read silently re-publishing it. |
| 3 | **Render** → `plot-lite-service` (staging) | `PLOT_AUTH_TOKEN` | **ROTATE** — see §4. This is the only step that actually kills the exposed value. |
| 4 | **Render** → CEE (`olumi-assistants-service`) | whichever var holds PLoT's bearer | **UPDATE to the new value in the same window** — the repo records this credential as *shared with CEE*, so rotating PLoT alone will break CEE→PLoT calls. **Verify this before rotating** (see §5, unknown 1). |

**Naming convention check (derived):** every sibling edge function reads a
non-`VITE_` name — `ISL_API_KEY` (isl-proxy), `ASSIST_API_KEY` (cee-proxy,
orchestrator-proxy, collab-proxy). `PLOT_AUTH_TOKEN` follows that convention.

---

## 3. Deploy order that never opens a broken window

The order matters because PLoT **already** rejects unauthenticated requests. Measured
unauthenticated, 2026-08-13:

```
GET  /v1/limits                 → 401
POST /v1/cee/draft-graph        → 401  {"code":"UNAUTHORIZED","message":"Missing bearer token"}
GET  /v1/templates              → 200   (open — a contrast control, proving the 401s
GET  /health                    → 200    are auth decisions and not a dead service)
```

So if this PR deploys while `PLOT_AUTH_TOKEN` is unset, the edge function forwards
unauthenticated and those routes 401. **Set the variable first.**

1. **Set `PLOT_AUTH_TOKEN` in Netlify to the CURRENT (still-exposed) value.**
   Harmless: nothing reads it yet. Do *not* rotate at this point.
2. **Merge and deploy this PR.** The edge function now injects server-side; the
   browser sends nothing. Product behaviour is unchanged.
3. **Verify** (§6). Do not proceed until the product works on the new path.
4. **Delete `VITE_PLOT_BEARER`** from Netlify (all contexts) and redeploy.
5. **Rotate** (§4) — now, and only now, is the old value replaceable without a window
   in which the product is broken.

Steps 1–3 leave the old value live but the product working. Step 5 is what makes the
old value worthless. **Neither step alone is sufficient**: the code fix stops *future*
publication; only rotation addresses the value already published.

---

## 4. Rotation — invalidating the old value

Rotation is a PLoT/Render action. The shape depends on one thing I could not derive
from this repo:

**If PLoT accepts a LIST of valid bearers (zero-window):**
1. Add the new token to PLoT's accepted set; keep the old one accepted.
2. Update `PLOT_AUTH_TOKEN` in Netlify, and CEE's copy in Render, to the new value.
3. Confirm traffic is authenticating on the new value.
4. **Remove the old token from PLoT's accepted set.** ← the actual invalidation.

**If PLoT accepts exactly ONE bearer (brief window, staging only):**
1. Prepare the new value in Netlify and CEE but do not save yet.
2. Change PLoT's `PLOT_AUTH_TOKEN` in Render; save Netlify and CEE immediately after.
3. Expect 401s for the seconds between the first and last save. Acceptable on
   staging; **not** acceptable on production without the dual-accept path above.

**Check the old value is dead — Paul runs this, not us.** Against `/v1/limits`, which
is measured auth-gated, with the OLD bearer:

```
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer <OLD VALUE>" \
  https://plot-lite-service-staging.onrender.com/v1/limits
```

- `401` → the old value is dead. Rotation succeeded.
- `200` → **the old value is still live and the exposure is still open.**

Positive control for that check (proves the endpoint still authenticates at all, so a
`401` means "rejected" and not "service broken"): the same request with the **new**
bearer must return `200`.

> This lane deliberately did **not** run either request. Authenticating with a
> discovered credential is out of bounds, and a request that succeeds would prove the
> exposure by exploiting it.

---

## 5. Unknowns, stated rather than guessed

1. **Is this credential genuinely shared with CEE?** The claim comes from
   `scripts/ci/bundle-env-allowlist.json` — a repo note, not a derivation from CEE's
   deployed environment. **Confirm against CEE's Render env before rotating**, or
   rotation will break CEE→PLoT with no warning.
2. **Does PLoT support multiple concurrent bearers?** Not derivable from this repo.
   Decides which branch of §4 applies.
3. **Which Netlify contexts define `VITE_PLOT_BEARER`?** Netlify env lives in the
   dashboard, not in `netlify.toml` — the YAML is a partial, drifting subset and must
   not be read as the deployed posture. Check the dashboard's context column.

---

## 6. Verifying the boundary after deploy

```
# 1. The browser no longer ships a credential: no such chunk should exist.
curl -sI https://staging--olumi.netlify.app/assets/plotAuthHeaders-Bazgbw-s.js

# 2. The proxy reports whether it is provisioned, without revealing anything.
curl -sI https://staging--olumi.netlify.app/bff/engine/v1/limits | grep -i x-plot-proxy-credential
#    X-Plot-Proxy-Credential: injected   → PLOT_AUTH_TOKEN is set
#    X-Plot-Proxy-Credential: absent     → NOT set; auth-gated routes will 401

# 3. The seam works end to end (200, not 401).
curl -s -o /dev/null -w '%{http_code}\n' https://staging--olumi.netlify.app/bff/engine/v1/limits

# 4. Contrast control — an open route, proving a 401 above would be an auth
#    decision rather than a dead proxy.
curl -s -o /dev/null -w '%{http_code}\n' https://staging--olumi.netlify.app/bff/engine/v1/templates
```

Then drive the product: **Draft My Model** is the route most worth watching, because
its base was the one genuinely cross-origin call and it now traverses the proxy. Its
historical latency is ~56s and the old absolute base existed to bypass a ~28s proxy
timeout — if drafting starts timing out, that is the cause, and the fix is server-side
(a streaming or background function), **never a credential back in the client**.

---

## 7. What stops this recurring

`scripts/ci/assert-no-bundle-credentials.mjs` scans the **emitted bundle** for
credential-shaped *values* and fails the build. It is wired into the **Staging Gate**
build job — the only check `staging` branch protection requires — not merely into
`ci.yml`, which is advisory.

It does not look at variable names, so it cannot be satisfied by renaming anything.
Public-by-design values are separated by reading the artefact, never by widening the
pattern: a JWT is decoded and its `role` claim read (`anon` passes, `service_role`
fails loud — same shape, opposite verdicts), and a content digest is identified by the
key it is assigned to.

The prior guard (`assert-bundle-env-allowlist.mjs`) is kept: it notices a new
*variable* arriving, while the sentinel notices a *secret* arriving without a name.
Its blind spot is instructive — it printed a warning about this exact credential on
every run and then exited `0`. **A loud log that returns zero is not a gate.**
