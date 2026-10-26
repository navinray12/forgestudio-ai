-- Fresh installations can reach the environment-label migration without a
-- DatabaseEnvironment enum. Establish the enum before extending its labels.
-- Existing environments retain their type and stored values unchanged.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'DatabaseEnvironment'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "DatabaseEnvironment" AS ENUM (
      'DEVELOPMENT', 'PREVIEW', 'STAGING', 'PRODUCTION'
    );
  END IF;
END
$$;
