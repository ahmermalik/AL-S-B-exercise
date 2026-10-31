CREATE TABLE IF NOT EXISTS close_imports (
  id TEXT PRIMARY KEY, hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
  summary TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS close_cases (
  id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES close_imports(id),
  property_id TEXT NOT NULL, kind TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS close_cases_import_property ON close_cases(import_id, property_id);
CREATE TABLE IF NOT EXISTS close_runs (
  id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES close_imports(id), status TEXT NOT NULL,
  created_at TEXT NOT NULL, lease_owner TEXT, lease_until INTEGER, data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS close_runs_status_lease ON close_runs(status, lease_until);
CREATE TABLE IF NOT EXISTS close_run_cases (
  run_id TEXT NOT NULL REFERENCES close_runs(id), case_id TEXT NOT NULL REFERENCES close_cases(id),
  status TEXT NOT NULL, error TEXT, PRIMARY KEY(run_id, case_id)
);
CREATE TABLE IF NOT EXISTS close_packages (
  id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES close_imports(id), property_id TEXT NOT NULL,
  version INTEGER NOT NULL, fingerprint TEXT NOT NULL, data TEXT NOT NULL,
  UNIQUE(import_id, property_id, version)
);
CREATE TABLE IF NOT EXISTS close_agent_activity (
  id TEXT PRIMARY KEY, case_id TEXT, run_id TEXT, created_at TEXT NOT NULL, data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS close_agent_activity_case ON close_agent_activity(case_id, created_at);
CREATE TABLE IF NOT EXISTS close_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS close_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
