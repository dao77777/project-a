import jwt from 'jsonwebtoken';
import { db } from '@/app/(lib)/drizzle';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { magicLinks, oauthIdentities, registerTasks, sessions, users } from '@/app/(db)/schema';
import { TRPCError } from '@trpc/server';
import { usersMagicLinks, usersRegisterTasksMagicLinks } from '@/app/(db)/helpers';
import _ from "lodash";
import { nodemailerTransporter } from '../../(lib)/nodemailer';
import axios from 'axios';
import { v4 } from 'uuid';
import { loggerInfo } from '@/app/(lib)/winston';
import { getContext } from '@/app/(lib)/trpc/contextList';
import 'source-map-support/register';


const ACCESS_TOKEN_EXPIRES_IN = 15 * 60 * 1000; // 15 分钟
const REFRESH_TOKEN_EXPIRES_IN = 30 * 24 * 60 * 60 * 1000; // 30 天
const MAGIC_LINK_EXPIRES_IN = 10 * 60 * 1000; // 10 分钟
const REGISTER_TASK_EXPIRES_IN = 10 * 60 * 1000; // 10 分钟

/**
 * share
 */

export const setAuthCookies = (response: NextResponse, accessToken: string, refreshToken: string) => {
  response.cookies.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ACCESS_TOKEN_EXPIRES_IN / 1000,
    path: '/',
  });
  response.cookies.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_EXPIRES_IN / 1000,
    path: '/',
  });
  return response;
}

export const signAccessToken = async (userId: string) => {
  const sessionId = v4();

  const accessToken = jwt.sign({ sessionId: v4() }, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRES_IN / 1000 });

  const refreshToken = jwt.sign({ sessionId: v4() }, process.env.JWT_SECRET!, { expiresIn: REFRESH_TOKEN_EXPIRES_IN / 1000 });

  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRES_IN);

  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN);

  await db
    .insert(sessions)
    .values({
      id: sessionId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      userAgent: getContext().userAgent,
      ipAddress: getContext().ipAddress,
      userId: userId,
    });

  return {
    accessToken,
    refreshToken,
  }
}

/**
 * api
 */

// email magicLink register: emailMagicLinkRegister -> click magicLink redirect to register/email page -> emailMagicLinkConfirm -> nicknameUpdate -> avatarUpdate
// oauth register: oauthRegister -> redirect to oauth provider page -> redirect back to register/oauth page -> oauthConfirm

// TODO
export const passwordRegister = async () => {
}

export const oauthRegisterStart = async (providerName: string) => {
  loggerInfo("Entering oauthRegisterStart");

  // Generate a temp user and temp oauthIdentity and registerTask waited for oauth confirm
  loggerInfo("Generating temp user and temp oauthIdentity and registerTask");

  const userId = v4();

  const registerTask = await db.transaction(async (tx) => {
    await tx
      .insert(oauthIdentities)
      .values({
        userId
      })
    const [registerTask] = await tx
      .insert(registerTasks)
      .values({
        userId,
        type: "oauth",
        info: providerName,
        status: "pending",
        expiresAt: new Date(Date.now() + REGISTER_TASK_EXPIRES_IN),
      })
      .returning();

    await tx
      .insert(users)
      .values({ id: userId })

    return registerTask;
  });

  // Compute oauth url by the providerName
  loggerInfo("Compute oauth url by the providerName");

  const oauthRedirectUrl = `http://${process.env.NEXT_PUBLIC_HOSTNAME}:${process.env.NEXT_PUBLIC_PORT}/${process.env.NEXT_PUBLIC_OAUTH_REGISTER_PAGE_PATH}`;

  const providerName2Url = {
    github: `https://github.com/login/oauth/authorize?client_id=${process.env.OAUTH_GITHUB_ID}&redirect_uri=${oauthRedirectUrl}&state=${registerTask.id}&scope=user:email`,
  }

  const url = providerName2Url[providerName as keyof typeof providerName2Url];

  loggerInfo("Exit oauthRegisterStart");

  return url;
}

// TODO
export const phoneCodeRegisterStart = async () => {
}

// TODO
export const phoneMagicLinkRegisterStart = async () => {
}

// TODO
export const emailCodeRegisterStart = async () => {
}

export const emailMagicLinkRegisterStart = async (email: string) => {
  loggerInfo("Entering emailMagicLinkRegisterStart");

  // Check if email already exists
  loggerInfo("Check if email already exists");

  const [user] = await db
    .select()
    .from(users)
    .where(sql`${users.email} = ${email}`)

  if (user) throw new TRPCError({ message: "Email already exists", code: "BAD_REQUEST" });

  // Generate a temp user, a magicLink, a registerTask
  loggerInfo("Generate a temp user, a magicLink, a registerTask");

  const token = v4();

  const userId = v4();

  const [[registerTask]] = await Promise.all([
    db
      .insert(registerTasks)
      .values({
        userId,
        type: "email",
        info: email,
        status: "pending",
        expiresAt: new Date(Date.now() + REGISTER_TASK_EXPIRES_IN),
      })
      .returning(),
    db
      .insert(users)
      .values({
        id: userId
      }),
    db
      .insert(magicLinks)
      .values({
        isPhoneOrEmail: "email",
        phoneOrEmail: email,
        usedFor: "confirm",
        token,
        expiresAt: new Date(Date.now() + MAGIC_LINK_EXPIRES_IN)
      })
  ] as const);

  // Send email with magic link, contain email register token in email register path
  loggerInfo("Send email with magic link");

  const registerUrl = `http://${process.env.NEXT_PUBLIC_HOSTNAME}:${process.env.NEXT_PUBLIC_PORT}/${process.env.NEXT_PUBLIC_EMAIL_REGISTER_PAGE_PATH!}?token=${token}`;

  await nodemailerTransporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: '账户注册',
    html: `<p>点击以下链接验证邮箱注册：</p><p><a href="${registerUrl}?">${registerUrl}</a></p><p>此链接将在10分钟后过期。</p>`,
  });

  loggerInfo("Exit emailMagicLinkRegisterStart");

  return registerTask.id;
}

export const oauthRegisterComplete = async (registerTaskId: string, code: string) => {
  loggerInfo("Entering oauthRegisterComplete");

  const providerName2request = {
    github: {
      codeVerify: async () => {
        return await axios.post(
          'https://github.com/login/oauth/access_token',
          {
            client_id: process.env.OAUTH_GITHUB_ID,
            client_secret: process.env.OAUTH_GITHUB_SECRET,
            code: code,
            redirect_uri: `http://${process.env.NEXT_PUBLIC_HOSTNAME}:${process.env.NEXT_PUBLIC_PORT}/${process.env.NEXT_PUBLIC_OAUTH_REGISTER_PAGE_PATH}`,
          },
          {
            headers: {
              Accept: 'application/json'
            },
          }
        )
      },
      getUserInfo: async (accessToken: string) => {
        return await axios.get(
          'https://api.github.com/user',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json'
            },
          }
        )
      }
    }

  }

  // Verify registerTask
  loggerInfo("Verify registerTask");

  const [registerTask] = await db
    .select()
    .from(registerTasks)
    .where(sql`${registerTasks.id} = ${registerTaskId} AND ${registerTasks.type} = 'oauth'`)

  if (!registerTask) throw new TRPCError({ message: "Invalid register", code: "BAD_REQUEST" });

  if (registerTask.status !== "pending") throw new TRPCError({ message: "RegisterTask has already complete", code: "BAD_REQUEST" });

  if (registerTask.expiresAt! < new Date()) {
    await db
      .update(registerTasks)
      .set({
        status: "error",
        res: "TIMEOUT",
        out: `${registerTask.info} registerTask timeout`
      });
    throw new TRPCError({ message: "registerTask expires", code: "BAD_REQUEST" });
  }

  // Verify code
  loggerInfo("Verify code");

  const codeVerifyRes = await providerName2request[registerTask.info as keyof typeof providerName2request].codeVerify();

  if (codeVerifyRes.data.error) throw new TRPCError({ message: `OAuth Error: ${codeVerifyRes.data.error}`, code: "BAD_GATEWAY" });

  if (!codeVerifyRes.data.access_token) throw new TRPCError({ message: "Invalid code", code: "BAD_REQUEST" });

  const providerAccessToken = codeVerifyRes.data.access_token;

  // get user info
  let getUserInfoRes = null;

  getUserInfoRes = await providerName2request[registerTask.info as keyof typeof providerName2request].getUserInfo(providerAccessToken);

  const userInfo = getUserInfoRes!.data;

  // Verify providerId exists
  loggerInfo("Verify providerId exists");

  const [oauthIdentity] = await db
    .select()
    .from(oauthIdentities)
    .where(sql`${oauthIdentities.providerName} = ${registerTask.info} AND ${oauthIdentities.providerId} = ${userInfo.id}`)

  if (oauthIdentity) throw new TRPCError({ message: "OAuth Identity already exists", code: "BAD_REQUEST" });

  // Complete registerTask
  loggerInfo("Complete registerTask");

  await db.transaction(async tx => await Promise.all([
    tx
      .update(users)
      .set({
        nickname: userInfo.name || userInfo.login,
        avatar: userInfo.avatar_url,
      })
      .where(sql`${users.id} = ${registerTask.userId}`),
    tx
      .update(registerTasks)
      .set({
        status: "success",
        res: "SUCCESS",
        out: `${registerTask.info} ${userInfo.id} registerTask success`
      })
      .where(sql`${registerTasks.id} = ${registerTaskId}`),
    tx
      .update(oauthIdentities)
      .set({
        providerId: userInfo.id,
        providerName: registerTask.info,
        confirmedAt: new Date()
      })
      .where(sql`${oauthIdentities.userId} = ${registerTask.userId}`)
  ]));

  // Jwt token sign
  loggerInfo("Jwt token sign");

  const tokens = await signAccessToken(registerTask.userId);

  loggerInfo("Exit oauthRegisterComplete");

  return tokens;
}

// TODO
export const codeConfirm = async () => {
}

export const emailMagicLinkRegisterComplete = async (registerTaskId: string, token: string) => {
  loggerInfo("Enter emailMagicLinkRegisterComplete");

  // Verify exists
  loggerInfo("Verify exists");

  const [urmItem] = await db
    .select()
    .from(usersRegisterTasksMagicLinks)
    .where(sql`${usersMagicLinks.magic_links.token} = ${token} AND ${registerTasks.id} = ${registerTaskId}`);

  if (!urmItem) throw new TRPCError({ message: "Invalid register", code: "BAD_REQUEST" });

  // Verify magicLink
  loggerInfo("Verify magicLink");

  if (urmItem.magic_links.expiresAt! > new Date()) throw new TRPCError({ message: "MagicLink expires", code: "UNAUTHORIZED" });

  if (urmItem.magic_links.usedFor !== "confirm") throw new TRPCError({ message: `Need magicLink used for confirm, but find the magicLink used for ${urmItem.magic_links.usedFor}`, code: "UNAUTHORIZED" })

  // Verify registerTask
  loggerInfo("Verify registerTask");

  if (urmItem.register_tasks.type !== "email") throw new TRPCError({ message: `Need registerTask type be email, but find type ${urmItem.register_tasks.type}`, code: "BAD_REQUEST" });

  if (urmItem.register_tasks.status != "pending") throw new TRPCError({ message: `RegisterTask has already complete`, code: "BAD_REQUEST" });

  if (urmItem.register_tasks.expiresAt! > new Date()) {
    await db
      .update(registerTasks)
      .set({
        status: "error",
        res: "TIMEOUT",
        out: `${urmItem.register_tasks.info} registerTask timeout`
      })
    throw new TRPCError({ message: "registerTask expires", code: "BAD_REQUEST" });
  }

  // Email magicLink registerTask complete
  loggerInfo("Email magicLink registerTask complete");
  
  await Promise.all([
    db
      .update(users)
      .set({
        email: urmItem.register_tasks.info,
        emailConfirmedAt: new Date()
      })
      .where(sql`${users.id} = ${urmItem.users.id}`),
    db
      .update(registerTasks)
      .set({
        status: "success",
        res: "SUCCESS",
        out: `${urmItem.register_tasks.info} registerTask success`
      }),
    db
      .delete(magicLinks)
      .where(sql`${magicLinks.id} = ${urmItem.magic_links.id}`)
  ])

  // Jwt token sign
  loggerInfo("Jwt token sign");

  const tokens = await signAccessToken(urmItem.users.id);

  loggerInfo("Exit emailMagicLinkRegisterComplete");

  return tokens;
}
