import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp({ withTimezone: true }).default(sql`now()`).$onUpdate(() => new Date()),
};

export const enumIsPhoneOrEmail = pgEnum('enum_is_phone_or_email', ["phone", "email"]);

export const enumUsedFor = pgEnum('enum_used_for', ["confirm", "login", "reset_password"]);

export const enumStatus = pgEnum('enum_status', ["pending", "success", "error"]);

export const enumRegisterTaskResult = pgEnum('enum_result', ["SUCCESS", "TIMEOUT", "TIMEOUT_AUTO_CLOSE", "INTERNAL_ERROR"]);

export const enumRegisterTaskType = pgEnum('enum_register_task_type', ["email", "phone", "oauth"]);

/**
 * username, email, phone, oauthIdentities 至少有一个
 * 有username时, password不能为空
 */
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    username: text().unique(),
    userNameConfirmedAt: timestamp({ withTimezone: true }),
    email: text().unique(),
    emailConfirmedAt: timestamp({ withTimezone: true }),
    phone: text().unique(),
    phoneConfirmedAt: timestamp({ withTimezone: true }),
    password: text(),
    nickname: text(),
    avatar: text(),
    ...timestamps,
    confirmedAt: timestamp({ withTimezone: true }),
    oauthIdentities: jsonb().$type<{ providerId: string, providerName: string, confirmedAt: Date }[]>().default(sql`'[]'::jsonb`).notNull()
  }
);

export const oauthIdentities = pgTable(
  "oauth_identities",
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    providerName: text(),
    providerId: text(),
    confirmedAt: timestamp({ withTimezone: true }),
    userId: uuid().notNull().references(() => users.id),
    ...timestamps
  },
  t => [
    uniqueIndex('oauth_identities_provider_name_provider_id_key').on(t.providerName, t.providerName),
    uniqueIndex('oauth_identities_user_id_provider_name_key').on(t.userId, t.providerName),
    index('identity_providers_user_id_idx').on(t.userId),
  ]
);

export const registerTasks = pgTable(
  "register_tasks",
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    status: enumStatus().notNull(),
    type: enumRegisterTaskType().notNull(),
    info: text(),
    res: enumRegisterTaskResult(),
    out: text(),
    userId: uuid().notNull().unique().references(() => users.id),
    ...timestamps
  }
)

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    name: text().notNull(),
    key: text().notNull().unique(),
    userId: uuid().notNull().references(() => users.id),
    ...timestamps,
    lastUsedAt: timestamp({ withTimezone: true })
  },
  t => [
    index('api_keys_user_id_idx').on(t.userId),
  ]
)

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    accessToken: text().notNull().unique(),
    refreshToken: text().notNull().unique(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }).notNull(),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }).notNull(),
    userAgent: text(),
    ipAddress: text(),
    userId: uuid().notNull().references(() => users.id),
    ...timestamps,
    lastAccessedAt: timestamp({ withTimezone: true }),
    lastRefreshedAt: timestamp({ withTimezone: true })
  },
  t => [
    index('sessions_access_token_refresh_token_idx').on(t.accessToken, t.refreshToken),
    index('sessions_user_id_idx').on(t.userId),
  ]
);

export const codes = pgTable(
  "codes",
  {
    id: uuid().primaryKey().default(sql`gen_random_uuid()`),
    isPhoneOrEmail: enumIsPhoneOrEmail().notNull(),
    phoneOrEmail: text().notNull(),
    usedFor: enumUsedFor().notNull(),
    code: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps
  },
  t => [
    index("codes_phone_or_email_code").on(t.phoneOrEmail, t.code),
  ]
);

export const magicLinks = pgTable(
  "magic_links",
  {
    id: uuid().primaryKey().defaultRandom(),
    isPhoneOrEmail: enumIsPhoneOrEmail().notNull(),
    phoneOrEmail: text().notNull(),
    usedFor: enumUsedFor().notNull(),
    token: text().unique().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps
  }
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    id: uuid().primaryKey().defaultRandom(),
    type: text().notNull(),
    path: text().notNull(),
    ...timestamps
  },
  t => [
    index("rate_limits_type_path_idx").on(t.type, t.path),
    index("rate_limits_created_at_idx").on(t.createdAt),
  ]
)