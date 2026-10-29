-- Supabase publishes every table in the public schema through its REST
-- API (PostgREST) to the "anon" and "authenticated" roles, which anyone
-- holding the project's public key can use. Only the backend reads and
-- writes this database, so no table is exposed that way.
--
-- Row Level Security with no policies denies those roles every row; the
-- backend connects as the table owner, which RLS does not restrict.
-- Standard PostgreSQL — harmless on any other host (e.g. AWS RDS).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- On Supabase, also take away the API roles' table privileges, now and for
-- tables created by later migrations. Skipped where those roles don't exist.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END $$;
