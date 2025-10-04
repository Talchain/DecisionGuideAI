// POC: supabase stub module – prevents real SDK from being bundled
export function createClient() {
  return {
    auth: {
      async signInWithPassword() { return { data: null, error: null }; },
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
