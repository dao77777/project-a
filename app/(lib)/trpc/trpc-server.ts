import { initTRPC, TRPCError } from "@trpc/server";
import SuperJSON from "superjson";
import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { logger, loggerInfo } from "../winston";
import { asyncLocalStorage } from "./asyncLocalStorage";
import { getContextList } from "./contextList";
import { db } from "../drizzle";
import { rateLimits } from "@/app/(db)/schema";
import { sql } from "drizzle-orm";
/**
 * Context
 */

export const createContext = async ({ info, req, resHeaders }: FetchCreateContextFnOptions) => {
  const requestId = req.headers.get("x-request-id") || "unknown";

  const userAgent = req.headers.get("user-agent") || "unknown";

  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("remote-addr") || "unknown";

  getContextList().addPending({ requestId, userAgent, ipAddress });

  return {
    requestId
  }
};

export type Context = Awaited<ReturnType<typeof createContext>>;

/**
 * Meta
 */

export type Meta = {
  rateLimit: { windowMs: number, maxRequests: number }
}

/**
 * TRPC init
 */

export const t = initTRPC.context<Context>().meta<Meta>().create({
  transformer: SuperJSON
});

/**
 * Procedure
 */

const contextMiddleware = t.middleware(({ type, path, ctx, next, input }) =>
  asyncLocalStorage.run({ requestId: ctx.requestId }, async () => {
    // Do something before
    getContextList().add(ctx.requestId, { type, path, input, step: 1 });

    loggerInfo("Request entered");

    // Next
    const res = await next();

    // Do something after
    loggerInfo("Request exited");

    // getContextList().remove(ctx.requestId);

    return res;
  }));

const rateLimitMiddleware = t.middleware(async ({ ctx, meta, type, path, next }) => {
  // Verify if rate limit is defined in the endpoint
  if (meta?.rateLimit === undefined) return next();

  // Verify if rate limit is exceeded
  const { windowMs, maxRequests } = meta.rateLimit;

  const [[{ count }]] = await Promise.all([
    db
      .select({
        count: sql<number>`COUNT(${rateLimits.id})`
      })
      .from(rateLimits)
      .where(sql`
        ${rateLimits.type} = ${type} AND
        ${rateLimits.path} = ${path} AND
        ${rateLimits.createdAt} > NOW() - INTERVAL '${windowMs} milliseconds'`),
    db
      .delete(rateLimits)
      .where(sql`${rateLimits.createdAt} < NOW() - INTERVAL '${windowMs} milliseconds'`)
  ]);


  if (count >= maxRequests) throw new TRPCError({ message: "Rate limit exceeded", code: "TOO_MANY_REQUESTS" });

  // Increment rate limit
  const [res] = await Promise.all([
    next(),
    db
      .insert(rateLimits)
      .values({
        type,
        path
      })
  ]);

  return res;
})


export const procedure = t.procedure.use(contextMiddleware).use(rateLimitMiddleware);

