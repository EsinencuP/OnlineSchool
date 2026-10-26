\set ON_ERROR_STOP on
\getenv migrate_password APP_MIGRATE_PASSWORD
\getenv runtime_password APP_RUNTIME_PASSWORD
\getenv database_name POSTGRES_DB

-- Created by the bootstrap administrator before ordinary, non-superuser migrations.
CREATE ROLE online_school_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE app_migrate LOGIN PASSWORD :'migrate_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE app_runtime LOGIN PASSWORD :'runtime_password' INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT online_school_runtime TO app_runtime;
ALTER DATABASE :"database_name" OWNER TO app_migrate;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA public TO app_migrate;
GRANT USAGE ON SCHEMA public TO online_school_runtime;
-- Table/function privileges remain the explicit allow-list in versioned migrations.
-- No membership of app_migrate, no broad table grants, and no runtime audit UPDATE/DELETE.
