// knip.config.ts
import type { KnipConfig } from "knip";

const config: KnipConfig = {
  // These are your app’s true entry points
  entry: [
    "src/index.tsx",
    "src/**/*.tsx",
    "supabase/functions/send-team-invite/index.ts",
  ],

  // Never delete these crucial files or folders
  ignore: [
    "supabase/functions/send-team-invite/**",
    "src/components/decisions/DecisionEdit.tsx",
    "src/lib/database.test.ts",
  ],

  // Keep this dependency around
  ignoreDependencies: ["@dnd-kit/utilities"],
};

export default config;