/**
 * Router
 */

import { t } from "../(lib)/trpc/trpc-server";
import { authRouter } from "./auth/router";
import { testRouter } from "./test/router";

export const appRouter = t.router({
  auth: authRouter,
  test: testRouter
})

export type AppRouter = typeof appRouter;