// knip.config.ts
export default {
  // Entry points Knip will treat as “in use”
  entry: [
    "src/index.tsx",
    "src/**/*.tsx",
    "supabase/functions/send-team-invite/index.ts",
  ],

  // Only scan these directories for dead code…
  project: [
    "src/**/*",
    "supabase/functions/**/*",
  ],

  // …but never delete your invite handler or UI components
  exclude: [
    "supabase/functions/send-team-invite/**",
    "src/components/decisions/DecisionEdit.tsx",
    "src/lib/database.test.ts",
  ],

  // Keep this dependency
  ignoreDependencies: ["@dnd-kit/utilities"],
}