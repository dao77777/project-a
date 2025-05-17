"use client";

import Image from "next/image";
import { trpc } from "./(lib)/trpc/trpc-client";
import Link from "next/link";

export default function Home() {
  const { data, isFetched, isLoading, refetch } = trpc.auth.oauthRegisterStart.useQuery({
    providerName: "github",
  }, {
    enabled: false
  });

  const {
    isLoading: isErrorLoading,
    refetch: error
  } = trpc.test.error.useQuery(undefined, { enabled: false })

  const {
    isLoading: isTRPCErrorLoading,
    refetch: trcError
  } = trpc.test.trpcError.useQuery(undefined, { enabled: false })

  const {
    isLoading: isLogInfoLoading,
    refetch: logInfo
  } = trpc.test.logInfo.useQuery(undefined, { enabled: false })

  const {
    isLoading: isLogDebugLoading,
    refetch: logDebug
  } = trpc.test.logDebug.useQuery(undefined, { enabled: false })

  return (
    <div className="p-2 flex flex-col items-start gap-2">
      <div>
        URL: {data ? (
          <a className="text-sky-800 underline underline-offset-1 hover:text-sky-600 transition-all" href={data}>
            {data}
          </a>
        ) : "No Data Yet"}
      </div>
      <button
        className="shadow-sm hover:bg-gray-800 rounded-sm p-2 bg-black text-white cursor-pointer transition-all active:scale-95"
        onClick={() => refetch()}
      >{isLoading ? "Loading..." : "Github Register"}</button>
      <button
        className="shadow-sm rounded-sm p-2 bg-black text-white hover:bg-gray-900 active:scale-95 cursor-pointer transition-all"
        onClick={() => error()}
      >{isErrorLoading ? "Loading..." : "Request Error"}</button>
      <button
        className="shadow-sm rounded-sm p-2 bg-black text-white hover:bg-gray-900 active:scale-95 cursor-pointer transition-all"
        onClick={() => trcError()}
      >{isTRPCErrorLoading ? "Loading..." : "Request TRPCError"}</button>
      <button
        className="shadow-sm rounded-sm p-2 bg-black text-white hover:bg-gray-900 active:scale-95 cursor-pointer transition-all"
        onClick={() => logInfo()}
      >{isLogInfoLoading ? "Loading..." : "Request LogInfo"}</button>
      <button
        className="shadow-sm rounded-sm p-2 bg-black text-white hover:bg-gray-900 active:scale-95 cursor-pointer transition-all"
        onClick={() => logDebug()}
      >{isLogDebugLoading ? "Loading..." : "Request LogDebug"}</button>
    </div>
  );
}
