-- ==============================================================================
-- AVEN MASTER ERP — LEAST-PRIVILEGE RUNTIME DATABASE ROLE TEMPLATE (005)
-- DO NOT AUTO-EXECUTE. Review and run as Neon db_owner only after testing
-- in an isolated branch, then update Vercel DATABASE_URL to use aven_erp_app.
-- ==============================================================================

-- Replace <STRONG_RANDOM_PASSWORD> with a 32+ char generated secret before running.
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aven_erp_app') THEN
--     CREATE ROLE aven_erp_app WITH LOGIN PASSWORD '<STRONG_RANDOM_PASSWORD>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
--   END IF;
-- END
-- $$;

-- Grant only runtime DML & sequence privileges (NO DDL, NO DROP, NO TRUNCATE)
-- GRANT CONNECT ON DATABASE neondb TO aven_erp_app;
-- GRANT USAGE ON SCHEMA public TO aven_erp_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aven_erp_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aven_erp_app;

-- Keep audit_logs append-only for the runtime role
-- REVOKE UPDATE, DELETE ON TABLE audit_logs FROM aven_erp_app;
