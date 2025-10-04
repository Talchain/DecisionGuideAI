// POC: minimal types for the react-query stub in PoC mode
declare module '@tanstack/react-query' {
  export function QueryClient(): unknown;
  export function QueryClientProvider(props: { children?: any }): any;
  export function useQuery(key?: any, fn?: any, opts?: any): {
    data?: any;
    error?: any;
    isLoading: boolean;
    refetch: () => Promise<any>;
  };
}
