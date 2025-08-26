/**
 * Feature flags and configuration helpers
 */

export const isSandboxEnabled = (): boolean =>
  import.meta.env.VITE_FEATURE_SCENARIO_SANDBOX === 'true';

export const isVotingEnabled = (): boolean =>
  import.meta.env.VITE_FEATURE_COLLAB_VOTING === 'true';
