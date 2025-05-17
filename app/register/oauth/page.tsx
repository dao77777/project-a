"use client";

import { trpc } from "@/app/(lib)/trpc/trpc-client";
import { useSearchParams } from "next/navigation";
import { FC, useMemo } from "react";

// 获取页面参数, 也就是是?后面的参数

const OAuth: FC = () => {
  const searchParams = useSearchParams();

  const code = searchParams.get("code");

  const state = searchParams.get("state");

  const { data, isLoading, refetch } = trpc.auth.oauthRegisterComplete.useQuery({
    registerTaskId: state!,
    code: code!,
  }, {
    enabled: false,
  });

  return (
    <div className="p-2 flex flex-col items-start gap-2">
      <h1>OAuth</h1>
      <p>OAuth page</p>
      <p>code: {code}</p>
      <p>state: {state}</p>
      <p>accessToken: {data ? data.accessToken : "No Data Yet"}</p>
      <p>refreshToken: {data ? data.refreshToken : "No Data Yet"}</p>
      <button
        className="shadow-sm rounded-sm p-2 bg-black text-white cursor-pointer hover:bg-gray-900 active:scale-95 transition-all"
        onClick={() => refetch()}
      >{isLoading ? "Loading..." : "Register Complete"}</button>
    </div>
  )
}

export default OAuth;