import { sql } from "drizzle-orm";
import { codes, magicLinks, registerTasks, users } from "./schema";
import { db } from "../(lib)/drizzle";

const usersCodesJoinCondition = sql`
  ${codes.isPhoneOrEmail} = "email" AND ${users.email} = ${codes.phoneOrEmail} 
  OR
  ${codes.isPhoneOrEmail} = "phone" AND ${users.phone} = ${codes.phoneOrEmail}
`;

const usersRegisterTasksJoinCondition = sql`${users.id} = ${registerTasks.userId}`;

const usersMagicLinksJoinCondition = sql`
  ${magicLinks.isPhoneOrEmail} = "email" AND ${users.email} = ${magicLinks.phoneOrEmail}
  OR
  ${magicLinks.isPhoneOrEmail} = "phone" AND ${users.phone} = ${magicLinks.phoneOrEmail}
`;

export const usersCodes = db
  .select()
  .from(users)
  .leftJoin(codes, usersCodesJoinCondition)
  .as("usersCodesJoin");



export const usersMagicLinks = db
  .select()
  .from(users)
  .leftJoin(magicLinks, usersMagicLinksJoinCondition)
  .as("userMagicLinks");

export const usersRegisterTasksMagicLinks = db
  .select()
  .from(users)
  .leftJoin(registerTasks, usersRegisterTasksJoinCondition)
  .leftJoin(magicLinks, usersMagicLinksJoinCondition)
  .as("usersRegisterTasksMagicLinks");
