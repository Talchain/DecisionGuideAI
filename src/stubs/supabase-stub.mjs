// POC: supabase stub module – prevents real SDK from being bundled
//
// ⚠ THIS STUB MUST NOT IMPLEMENT ANY SIGN-IN METHOD.
//
// It implemented `signInWithPassword` and answered `{ data: null, error: null }`
// — a SILENT SUCCESS for a build with no Supabase client at all. That is the
// exact shape `src/contexts/AuthContext.tsx`'s header exists to forbid, and it
// was reachable: `scripts/supabase-stub-decision.mjs` aliases the SDK here on
// every guest build unless `VITE_STUB_SUPABASE=0`, which `netlify.toml` sets
// ONLY under `[context.staging.environment]` — production inherits
// `[build.environment]` alone and therefore keeps the stub. Magic link and
// Google fail HONESTLY on such a build precisely because the methods are
// ABSENT, so `AuthContext`'s `typeof … !== 'function'` guard fires and yields a
// 501 the surface can render. The password route's possession of the method
// converted that honest failure into a silent success — and once LoginPage
// routes the owner into the app on success (#667 round 2), that success would
// have carried them in as a guest while claiming they had signed in.
//
// Absence IS the mechanism here. Do not add a sign-in method back.
export function createClient() {
  return {
    auth: {
      async signOut() { return { error: null }; },
      async getSession() { return { data: { session: null } }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe: () => {} } } }; },
    },
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        single() { return Promise.resolve({ data: null, error: null }); },
        insert() { return Promise.resolve({ data: null, error: null }); },
        update() { return Promise.resolve({ data: null, error: null }); },
        delete() { return Promise.resolve({ data: null, error: null }); },
      };
    },
  };
}
