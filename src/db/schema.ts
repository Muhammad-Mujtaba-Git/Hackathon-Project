import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Isolated demo sessions. A session ID is an isolation key, NOT authentication. */
export const sessions = pgTable(
  "ff_sessions",
  {
    id: text("id").primaryKey(),
    mode: text("mode").notNull().default("live"),
    scenarioId: text("scenario_id"),
    budgetPkr: integer("budget_pkr").notNull(),
    initialBudgetPkr: integer("initial_budget_pkr").notNull(),
    lastForecast: jsonb("last_forecast"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    lastActiveAt: ts("last_active_at").notNull().defaultNow(),
  },
  (t) => [check("ff_sessions_budget_nonneg", sql`${t.budgetPkr} >= 0`)],
);

/** SIMULATED allocations. One per session + policy + event, enforced by the database. */
export const allocations = pgTable(
  "ff_allocations",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    policyId: text("policy_id").notNull(),
    eventId: text("event_id").notNull(),
    amountPkr: integer("amount_pkr").notNull(),
    forecastTotalMm: doublePrecision("forecast_total_mm").notNull(),
    mode: text("mode").notNull(),
    scenarioId: text("scenario_id"),
    windowStart: ts("window_start").notNull(),
    windowEnd: ts("window_end").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [unique("ff_allocations_session_policy_event_key").on(t.sessionId, t.policyId, t.eventId)],
);

export const evaluations = pgTable(
  "ff_evaluations",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    scenarioId: text("scenario_id"),
    trigger: text("trigger").notNull(),
    status: text("status").notNull(),
    reason: text("reason").notNull(),
    eventId: text("event_id"),
    dataStatus: text("data_status").notNull(),
    forecastTotalMm: doublePrecision("forecast_total_mm"),
    thresholdMm: doublePrecision("threshold_mm").notNull(),
    modelRunAt: ts("model_run_at"),
    windowStart: ts("window_start"),
    windowEnd: ts("window_end"),
    allocationId: integer("allocation_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("ff_evaluations_session_idx").on(t.sessionId, t.id)],
);

/** Append-only audit trail. Survives session reset (the reset itself is recorded). */
export const auditRecords = pgTable(
  "ff_audit",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    details: jsonb("details"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("ff_audit_session_idx").on(t.sessionId, t.id)],
);

/** Single-row status of the in-process live scheduler. */
export const schedulerState = pgTable("ff_scheduler_state", {
  id: integer("id").primaryKey(),
  lastRunAt: ts("last_run_at"),
  lastSuccessAt: ts("last_success_at"),
  lastError: text("last_error"),
  lastErrorAt: ts("last_error_at"),
  sessionsChecked: integer("sessions_checked").notNull().default(0),
});
