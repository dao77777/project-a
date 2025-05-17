import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "./trpc-server";
import { appRouter } from "../../(backend)/router";
import { logger } from "../winston";
import { getContextList } from "./contextList";

/**
 * nextjs handler
 */

const handler = (req: Request) => {
  return fetchRequestHandler({
    endpoint: process.env.NEXT_PUBLIC_TRPC_ENDPOINT_PATH!,
    req,
    router: appRouter,
    createContext,
    onError({ error, ctx }) {
      logger.error({
        ...getContextList().get(ctx?.requestId!),
        message: error.message,
        code: error.code,
        name: error.name,
        cause: error.cause,
        stack: error.stack,
      });
    },
  });
}

export const handlers = {
  GET: handler,
  POST: handler
}
