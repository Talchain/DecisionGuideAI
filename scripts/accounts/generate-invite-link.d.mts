// scripts/accounts/generate-invite-link.d.mts
// Types for the operator invite-link tool, so its spec is typechecked rather than
// silently `any`. The implementation is plain .mjs so an operator can run it with
// bare `node` and no build step.

export declare const ENV_FILE_VAR: 'OLUMI_INVITE_ENV_FILE'
export declare const DEFAULT_KEY_VAR: 'SUPABASE_SERVICE_ROLE_KEY'
export declare const DEFAULT_ORIGIN: string
/** Must equal ACCEPT_INVITE_PATH in src/components/auth/AcceptInvitePage.tsx. */
export declare const ACCEPT_INVITE_PATH: '/accept-invite'
export declare const LINK_TYPES: readonly ['invite', 'recovery']
export declare const DRY_RUN_TOKEN: string

export type LinkType = 'invite' | 'recovery'

export interface InviteArgs {
  email: string
  type: LinkType
  origin: string
  keyVar: string
  dryRun: boolean
}

export declare function parseArgs(argv: string[]): InviteArgs
export declare function parseEnvFile(text: string): Record<string, string>
export declare function keyClass(key: string | undefined | null): 'missing' | 'sb_secret' | 'sb_publishable' | 'jwt' | 'unrecognised'
export declare function buildAcceptInviteUrl(origin: string, tokenHash: string, type: LinkType): string
export declare function scrub(message: unknown, key?: string): string
export declare function loadConfig(
  env: Record<string, string | undefined>,
  keyVar: string,
  readFile?: (p: string) => string,
  stat?: (p: string) => { isFile(): boolean },
): { supabaseUrl: string; projectRef: string; key: string; keyClass: string }

export interface InviteIo {
  stdout?: (s: string) => void
  stderr?: (s: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadSupabase?: () => Promise<(...args: any[]) => any>
  readFile?: (p: string) => string
  stat?: (p: string) => { isFile(): boolean }
}

export declare function main(argv: string[], env: Record<string, string | undefined>, io?: InviteIo): Promise<number>
