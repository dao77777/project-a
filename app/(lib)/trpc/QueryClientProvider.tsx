'use client'

import { getQueryClient } from "./react-query-client";
import { QueryClientProvider as Provider } from "@tanstack/react-query";
import { FC, ReactNode, useState } from "react";

export const QueryClientProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <Provider client={queryClient}>
      {children}
    </Provider>
  )
}
