import { procedure, t } from "@/app/(lib)/trpc/trpc-server";
import { logger, loggerDebug, loggerInfo } from "@/app/(lib)/winston";
import { TRPCError } from "@trpc/server";

export const testRouter = t.router({
  logInfo: procedure
    .meta({ rateLimit: { windowMs: 1000, maxRequests: 1 } })
    .query(() => {
      loggerInfo("This is an info log");
      return "ok";
    }),
  logDebug: procedure
    .query(() => {
      loggerDebug("This is a debug log");
      return "ok";
    }
    ),
  error: procedure
    .query(() => {
      throw new Error("This is an error");
    }),
  trpcError: procedure
    .query(() => {
      throw new TRPCError({ message: "This is an tRPCError", code: "UNAUTHORIZED" });
    }),
})


