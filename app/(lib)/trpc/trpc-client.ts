import { createTRPCReact, httpBatchStreamLink, httpLink, isNonJsonSerializable, loggerLink, splitLink } from "@trpc/react-query";
import SuperJSON from "superjson";
import { AppRouter } from "../../(backend)/router";
import * as uuid from "uuid";

let trpcClient = undefined;

export const trpc = createTRPCReact<AppRouter>()

export const createTRPCClient = () => {
  const url = `http://${process.env.NEXT_PUBLIC_HOSTNAME}:${process.env.NEXT_PUBLIC_PORT}/${process.env.NEXT_PUBLIC_TRPC_ENDPOINT_PATH}`;
  return trpc.createClient({
    links: [
      loggerLink({
        enabled: (op) => process.env.NODE_ENV === "development" || (op.direction === 'down' && op.result instanceof Error)
      }),
      splitLink({
        condition: (op) => isNonJsonSerializable(op.input),
        true: httpLink({
          transformer: SuperJSON,
          url,
          headers: () => {
            const headers = new Headers();
            headers.set("x-request-id", uuid.v4());
            return headers;
          }
        }),
        false: httpBatchStreamLink({
          transformer: SuperJSON,
          url,
          headers: () => {
            const headers = new Headers();
            headers.set("x-request-id", uuid.v4());
            return headers;
          }
        })
      }),
    ],
  });
}

export const getTRPCClient = () => {
  trpcClient ??= createTRPCClient();
  return trpcClient;
}
