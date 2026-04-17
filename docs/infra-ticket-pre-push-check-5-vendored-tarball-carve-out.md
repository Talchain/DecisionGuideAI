# Infra ticket: pre-push Check 5 vendored-tarball carve-out

**Type:** infra / pre-push workflow
**Priority:** P2 — not blocking but intermittently blocks pushes
**Owner:** unassigned

## Problem

The pre-push hook ([`scripts/pre-push-validate.sh`](../scripts/pre-push-validate.sh))
Check 5 fails any `file:` reference in `package.json`:

```
▸ Check 5 — Dependency audit (file: references)
    file: dependency references found in package.json:
      87:    "@talchain/schemas": "file:./vendor/talchain-schemas-0.5.1.tgz",
  ✗ All dependencies must use published registry versions (no file: links)
```

But `@talchain/schemas` is intentionally consumed via a vendored tarball
in [`vendor/`](../vendor/), which is the **sanctioned workflow** per
[`vendor/README.md`](../vendor/README.md) until `olumi-schemas` is
published to a private npm registry. Every push to `staging` currently
has to bypass the hook with `--no-verify` for this reason alone.

The original intent of Check 5 (documented immediately below the rule in
the script) is to block `file:packages/*` fork-directory links — a
different class of reference from a pinned, checksummed `file:./vendor/*.tgz`
tarball.

## Options

### A. Narrow carve-out for `file:./vendor/*.tgz` (recommended short-term)

Update Check 5 to distinguish vendored tarballs from fork-directory links:

```bash
# Allow file:./vendor/*.tgz (checksummed vendored tarballs).
# Still fail file:packages/* or file:../* (fork links / outside tree).
FILE_REFS=$(grep -nE '"file:(?!./vendor/[^"]+\.tgz")' package.json || true)
```

Keep the fork-directory check (`packages/olumi-schemas/` existence) as
an additional guard so the old failure mode stays blocked.

Effort: ~10 min. Risk: low — narrower is stricter than the current
documented intent of the check.

### B. Publish `@talchain/schemas` to private npm registry (long-term)

Removes the need for the vendored tarball entirely. Bump `package.json`
to `"@talchain/schemas": "^0.5.1"` and delete `vendor/`.

Effort: depends on the private-registry plan. Removal criterion already
documented in `vendor/README.md`.

## Action

Option (A) is a small defensive script change that unblocks pushes today.
Option (B) is the long-term fix and deletes Option (A)'s carve-out when
it lands.

Recommended: do (A) now as a standalone infra PR, keep (B) on the V5
schema-distribution roadmap.

## Context

- Ticket raised as follow-up to Brief 4 pre-analysis hotfix self-review
  push (`76e90da9` on `staging`, 2026-04-17), which bypassed Check 5
  with `--no-verify` because the two pre-push failures (this one + a
  stale test string in `SeverityStyledCritiques.test.tsx`, fixed in the
  same push) were both pre-existing and unrelated to the hotfix.
- The stale-test failure is resolved; only this Check 5 disagreement
  remains.
