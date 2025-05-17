'use client'

import { getTRPCClient, trpc } from "./trpc-client"
import { getQueryClient } from "./react-query-client"
import { FC, ReactNode, useState } from "react"

export const TRPCProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [queryClient] = useState(() => getQueryClient());
  const [trpcClient] = useState(() => getTRPCClient());

  return (
    <trpc.Provider queryClient={queryClient} client={trpcClient}>
      {children}
    </trpc.Provider>
  )
}