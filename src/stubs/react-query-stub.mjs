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
export function useMutation(_opts) {
  return {
    mutate: () => {},
    mutateAsync: async () => {},
    data: undefined,
    error: null,
    isError: false,
    isIdle: true,
    isPending: false,
    isSuccess: false,
    reset: () => {},
    status: 'idle',
  };
}
