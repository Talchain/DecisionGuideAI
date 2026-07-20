/**
 * Vendored @talchain/schemas version — single source of truth for the UI's
 * contract pin, surfaced in the debug bundle's `schema_versions` block.
 *
 * Why a hand-maintained constant instead of importing the package's own
 * package.json: the vendored tarball's `exports` map exposes only `.`,
 * `./boundary` and `./orchestrator` (no `./package.json` subpath), so a
 * runtime/bundler import of the version is not portable. The constant is
 * guarded by `src/lib/__tests__/talchainSchemasVersion.spec.ts`, which
 * fails whenever this value drifts from the `file:./vendor/
 * talchain-schemas-<version>.tgz` pin in package.json — update both
 * together when bumping the vendored contract.
 */
export const TALCHAIN_SCHEMAS_VENDORED_VERSION = '0.19.0' as const
