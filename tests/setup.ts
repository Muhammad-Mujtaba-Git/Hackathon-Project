import "dotenv/config";

// Tests never start the scheduler, never retry and never log provider calls.
process.env.APP_ENV = "test";
process.env.LIVE_SCHEDULER_ENABLED = "false";
process.env.HTTP_MAX_RETRIES = "0";
process.env.HTTP_TIMEOUT_MS = "2000";
