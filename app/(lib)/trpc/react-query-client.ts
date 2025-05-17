import { QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/react-query";
import SuperJSON from "superjson";

let queryClient = undefined;

export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 30,
        retry: (failureCount, error) => {
          // limit the number of retries to 3
          if (failureCount >= 3) return false;

          // only retry on network errors
          if (
            error instanceof TRPCClientError && 
            (error.data?.code === "UNAVAILABLE" || error.data?.code === "TEMPORARY_UNAVAILABLE")
          ) return true

          // other errors do not retry
          return false;
        },
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize
      }
    }
  })
}

export const getQueryClient = () => {
  if (typeof window === "undefined") return createQueryClient();
  queryClient ??= createQueryClient();
  return queryClient;
}