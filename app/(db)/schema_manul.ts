import '@/envConfig';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getSchemaNames } from './utils';

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle({ client, casing: 'snake_case' });

/**
 * Functions
 */

const createTimestampUpdateTriggerFunction = sql`
CREATE OR REPLACE FUNCTION timestamp_update_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at = NOW();
    NEW.updated_at = NOW();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at = NOW();
    -- keep created_date unchanged
    NEW.created_at = OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

const createUsersConfirmedAtSyncFunction = sql`
CREATE OR REPLACE FUNCTION users_confirmed_at_sync_function() RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    IF NEW.email_confirmed_at IS NOT NULL THEN
      NEW.confirmed_at = NEW.email_confirmed_at;
    ELSEIF NEW.phone_confirmed_at IS NOT NULL THEN
      NEW.confirmed_at = NEW.phone_confirmed_at;
    ELSEIF NEW.username IS NOT NULL THEN
      NEW.confirmed_at = NOW();
    END IF;
  ELSEIF TG_TABLE_NAME = 'oauth_identities' THEN
    UPDATE users
    SET confirmed_at = NEW.confirmed_at
    WHERE users.id = NEW.user_id AND users.confirmed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

const createUsersOAuthIdentitiesSyncFunction = sql`
CREATE OR REPLACE FUNCTION users_oauth_identities_sync_function() RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_user_id := NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  END IF;
  WITH update_info AS (
    SELECT 
      u.id,
      COALESCE(
        JSONB_AGG(JSONB_BUILD_OBJECT('providerName', o.provider_name, 'providerId', o.provider_id, 'confirmedAt', o.confirmed_at, 'id', o.id)) 
        FILTER (WHERE o.id IS NOT NULL),
        '[]'::JSONB
      ) oauth_identities
    FROM users u LEFT JOIN oauth_identities o ON u.id = o.user_id
    WHERE u.id = v_user_id
    GROUP BY u.id
  )
  UPDATE users
  SET oauth_identities = update_info.oauth_identities
  FROM update_info
  WHERE users.id = update_info.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

/**
 * Triggers
 */

const createUsersOAuthIdentitiesSync = sql`
DROP TRIGGER IF EXISTS oauth_identities_users_oauth_identities_sync ON oauth_identities;
CREATE TRIGGER oauth_identities_users_oauth_identities_sync
AFTER INSERT OR UPDATE OR DELETE ON oauth_identities FOR EACH ROW
EXECUTE FUNCTION users_oauth_identities_sync_function();
`;

const createUsersConfirmedAtSync = sql`
DROP TRIGGER IF EXISTS users_users_confirmed_at_sync ON users;
CREATE TRIGGER users_users_confirmed_at_sync
BEFORE INSERT OR UPDATE ON users FOR EACH ROW
WHEN (NEW.confirmed_at IS NULL)
EXECUTE FUNCTION users_confirmed_at_sync_function();

DROP TRIGGER IF EXISTS oauth_identities_confirmed_at_sync ON oauth_identities;
CREATE TRIGGER oauth_identities_confirmed_at_sync
BEFORE INSERT OR UPDATE ON oauth_identities FOR EACH ROW
WHEN (NEW.confirmed_at IS NOT NULL)
EXECUTE FUNCTION users_confirmed_at_sync_function();
`;

const createTimestampUpdateTrigger = getSchemaNames("./schema.ts").map(t => `
DROP TRIGGER IF EXISTS ${t}_timestamp_update_trigger ON ${t};
CREATE TRIGGER ${t}_timestamp_update_trigger
BEFORE INSERT OR UPDATE ON ${t} FOR EACH ROW
EXECUTE FUNCTION timestamp_update_trigger_function();
`);

/**
 * Foreign Keys
 */

const setDeferrableForeignKey = sql`
-- register_tasks
ALTER TABLE register_tasks
DROP CONSTRAINT register_tasks_user_id_users_id_fk;
ALTER TABLE register_tasks
ADD CONSTRAINT register_tasks_user_id_users_id_fk
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE ON UPDATE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- oauth_identities
ALTER TABLE oauth_identities
DROP CONSTRAINT oauth_identities_user_id_users_id_fk;
ALTER TABLE oauth_identities
ADD CONSTRAINT oauth_identities_user_id_users_id_fk
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE ON UPDATE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- api_keys
ALTER TABLE api_keys
DROP CONSTRAINT api_keys_user_id_users_id_fk;
ALTER TABLE api_keys
ADD CONSTRAINT api_keys_user_id_users_id_fk
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE ON UPDATE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- sessions
ALTER TABLE sessions
DROP CONSTRAINT sessions_user_id_users_id_fk;
ALTER TABLE sessions
ADD CONSTRAINT sessions_user_id_users_id_fk 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE ON UPDATE CASCADE
DEFERRABLE INITIALLY DEFERRED;
`;

const main = async () => {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(createTimestampUpdateTriggerFunction);

      await tx.execute(createUsersConfirmedAtSyncFunction);

      await tx.execute(createUsersOAuthIdentitiesSyncFunction);

      await Promise.all(
        createTimestampUpdateTrigger.map(sql => tx.execute(sql))
      );
      await tx.execute(createUsersConfirmedAtSync);

      await tx.execute(createUsersOAuthIdentitiesSync);

      await tx.execute(setDeferrableForeignKey);
    })
  } catch (error) {
    console.error('Error schema manul set:', error);

    process.exit(1);
  }

  console.log('Schema manul set done.');

  process.exit(0);
};

main();