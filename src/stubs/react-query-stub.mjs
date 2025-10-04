// POC: react-query stub to avoid adding the real dependency in PoC.
export function QueryClient() { return {}; }
export function QueryClientProvider(props) { return props?.children ?? null; }
export function useQuery(_key, _fn, _opts) {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    refetch: async () => ({ data: undefined }),
  };
}
