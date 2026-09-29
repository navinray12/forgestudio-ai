import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("FATAL: DATABASE_URL is not defined in .env");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });

async function sync() {
  const client = await pool.connect();
  console.log("=== ForgeStudio Database Safe Sync ===");
  console.log("Connected to PostgreSQL successfully.");

  try {
    await client.query("BEGIN;");

    // 1. users.authEpoch
    console.log("1. Checking users table...");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'authEpoch'
        ) THEN
          ALTER TABLE "users" ADD COLUMN "authEpoch" INTEGER NOT NULL DEFAULT 1;
        END IF;
      END $$;
    `);

    // 2. sessions columns
    console.log("2. Checking sessions table...");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'assurance') THEN
          ALTER TABLE "sessions" ADD COLUMN "assurance" TEXT NOT NULL DEFAULT 'none';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'audience') THEN
          ALTER TABLE "sessions" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'TENANT';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'authEpoch') THEN
          ALTER TABLE "sessions" ADD COLUMN "authEpoch" INTEGER NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'authMethod') THEN
          ALTER TABLE "sessions" ADD COLUMN "authMethod" TEXT NOT NULL DEFAULT 'legacy';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'authTime') THEN
          ALTER TABLE "sessions" ADD COLUMN "authTime" TIMESTAMP(3);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'mfaVerifiedAt') THEN
          ALTER TABLE "sessions" ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);
        END IF;
      END $$;
    `);

    // 3. auth_challenges
    console.log("3. Checking auth_challenges table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "auth_challenges" (
        "id" UUID NOT NULL PRIMARY KEY,
        "userId" UUID,
        "kind" TEXT NOT NULL,
        "secretHash" TEXT NOT NULL,
        "authEpoch" INTEGER NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "email" TEXT,
        "otpHash" TEXT,
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "lastSentAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "providerKey" TEXT,
        "initiatingSessionId" UUID,
        CONSTRAINT "auth_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "auth_challenges_secretHash_key" ON "auth_challenges"("secretHash");
      CREATE INDEX IF NOT EXISTS "auth_challenges_userId_createdAt_idx" ON "auth_challenges"("userId", "createdAt");
      CREATE INDEX IF NOT EXISTS "auth_challenges_expiresAt_idx" ON "auth_challenges"("expiresAt");
    `);

    // 4. identity_rate_buckets
    console.log("4. Checking identity_rate_buckets table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "identity_rate_buckets" (
        "key" TEXT NOT NULL,
        "windowStart" TIMESTAMP(3) NOT NULL,
        "attempts" INTEGER NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "identity_rate_buckets_pkey" PRIMARY KEY ("key","windowStart")
      );
      CREATE INDEX IF NOT EXISTS "identity_rate_buckets_expiresAt_idx" ON "identity_rate_buckets"("expiresAt");
    `);

    // 5. oidc_identities
    console.log("5. Checking oidc_identities table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "oidc_identities" (
        "id" UUID NOT NULL PRIMARY KEY,
        "userId" UUID NOT NULL,
        "issuer" TEXT NOT NULL,
        "subject" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "oidc_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "oidc_identities_issuer_subject_key" ON "oidc_identities"("issuer", "subject");
      CREATE UNIQUE INDEX IF NOT EXISTS "oidc_identities_userId_issuer_key" ON "oidc_identities"("userId", "issuer");
    `);

    // 6. workspaces & websites compatibility fields
    console.log("6. Checking workspaces & websites lifecycle fields...");
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'lifecycleStatus') THEN
            ALTER TABLE "workspaces" ADD COLUMN "lifecycleStatus" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'version') THEN
            ALTER TABLE "workspaces" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'archivedAt') THEN
            ALTER TABLE "workspaces" ADD COLUMN "archivedAt" TIMESTAMPTZ;
          END IF;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'websites') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'websites' AND column_name = 'documentVersion') THEN
            ALTER TABLE "websites" ADD COLUMN "documentVersion" INTEGER NOT NULL DEFAULT 1;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'websites' AND column_name = 'performanceSettings') THEN
            ALTER TABLE "websites" ADD COLUMN "performanceSettings" JSONB NOT NULL DEFAULT '{}';
          END IF;
        END IF;
      END $$;
    `);

    await client.query("COMMIT;");
    console.log("Schema changes applied successfully!\n");

    // Verification
    console.log("=== Verification Checks ===");
    const resSessions = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' AND column_name IN ('authEpoch', 'authMethod', 'audience')
    `);
    console.log("Sessions columns verified:", resSessions.rows.map(r => r.column_name).join(", "));

    const resBuckets = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('identity_rate_buckets', 'auth_challenges', 'oidc_identities')
    `);
    console.log("Identity tables verified:", resBuckets.rows.map(r => r.table_name).join(", "));

    console.log("\n[SUCCESS] All missing database columns and tables exist. Data preserved.");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Sync failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

sync();
