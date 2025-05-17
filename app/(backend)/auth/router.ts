import { z } from "zod";
import { procedure, t } from "../../(lib)/trpc/trpc-server";
import { oauthRegisterComplete, oauthRegisterStart } from ".";

export const authRouter = t.router({
  oauthRegisterStart: procedure
    .input(z.object({ providerName: z.string() }))
    .query(async ({ input }) => {
      return await oauthRegisterStart(input.providerName);
    }),
  oauthRegisterComplete: procedure
    .input(z.object({ registerTaskId: z.string(), code: z.string() }))
    .query(async ({ input }) => {
      return await oauthRegisterComplete(input.registerTaskId, input.code);
    })
})