import { QueryClient } from '@tanstack/react-query';

// Query defaults stay centralized so route-level hooks can adopt TanStack
// incrementally without each feature inventing a different retry policy.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
