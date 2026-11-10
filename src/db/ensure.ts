import { pool } from "./index";

/**
 * Idempotent safety net: creates the FloodFund tables if they do not exist yet
 * (for example on a freshly provisioned database where `drizzle-kit push` has
 * not been run). The definitions mirror `schema.ts`, which stays the source of truth.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS ff_sessions (
  id text PRIMARY KEY,
  mode text NOT NULL DEFAULT 'live',
  scenario_id text,
  budget_pkr integer NOT NULL,
  initial_budget_pkr integer NOT NULL,
  last_forecast jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_active_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ff_sessions_budget_nonneg CHECK (budget_pkr >= 0)
);
CREATE TABLE IF NOT EXISTS ff_allocations (
  id serial PRIMARY KEY,
  session_id text NOT NULL,
  policy_id text NOT NULL,
  event_id text NOT NULL,
  amount_pkr integer NOT NULL,
  forecast_total_mm double precision NOT NULL,
  mode text NOT NULL,
  scenario_id text,
  window_start timestamp with time zone NOT NULL,
  window_end timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ff_allocations_session_policy_event_key UNIQUE (session_id, policy_id, event_id),
  CONSTRAINT ff_allocations_session_id_ff_sessions_id_fk FOREIGN KEY (session_id) REFERENCES ff_sessions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ff_evaluations (
  id serial PRIMARY KEY,
  session_id text NOT NULL,
  mode text NOT NULL,
  scenario_id text,
  trigger text NOT NULL,
  status text NOT NULL,
  reason text NOT NULL,
  event_id text,
  data_status text NOT NULL,
  forecast_total_mm double precision,
  threshold_mm double precision NOT NULL,
  model_run_at timestamp with time zone,
  window_start timestamp with time zone,
  window_end timestamp with time zone,
  allocation_id integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ff_evaluations_session_id_ff_sessions_id_fk FOREIGN KEY (session_id) REFERENCES ff_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ff_evaluations_session_idx ON ff_evaluations (session_id, id);
CREATE TABLE IF NOT EXISTS ff_audit (
  id serial PRIMARY KEY,
  session_id text NOT NULL,
  type text NOT NULL,
  message text NOT NULL,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ff_audit_session_id_ff_sessions_id_fk FOREIGN KEY (session_id) REFERENCES ff_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ff_audit_session_idx ON ff_audit (session_id, id);
CREATE TABLE IF NOT EXISTS ff_scheduler_state (
  id integer PRIMARY KEY,
  last_run_at timestamp with time zone,
  last_success_at timestamp with time zone,
  last_error text,
  last_error_at timestamp with time zone,
  sessions_checked integer NOT NULL DEFAULT 0
);
`;

const g = globalThis as typeof globalThis & { __ffSchemaReady?: Promise<void> };

export function ensureSchema(): Promise<void> {
  if (!g.__ffSchemaReady) {
    g.__ffSchemaReady = (async () => {
      const client = await pool.connect();
      try {
        // Serialise concurrent first-time setup across processes.
        await client.query("SELECT pg_advisory_lock(727001)");
        try {
          await client.query(DDL);
        } finally {
          await client.query("SELECT pg_advisory_unlock(727001)");
        }
      } finally {
        client.release();
      }
    })().catch((err) => {
      g.__ffSchemaReady = undefined;
      throw err;
    });
  }
  return g.__ffSchemaReady;
}
