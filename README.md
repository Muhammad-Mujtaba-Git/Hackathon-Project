# FloodFund Karachi

Rainfall-triggered **simulated** preparedness funding for a municipal disaster team.

1. Fetch a real AI rainfall forecast (ECMWF AIFS via Open-Meteo) for Karachi.
2. Show NASA GPM IMERG satellite rainfall as map context.
3. Show one clear 24-hour forecast.
4. Check a pre-agreed funding rule (fresh data and ≥ 80 mm in the next 24 hours).
5. Record a **SIMULATED** PKR 500,000 allocation when the rule is met, exactly once per event.
6. Keep an audit trail that explains every decision.
7. Offer an optional model-comparison panel for judges.

> The 80 mm threshold is an example, not a validated flood warning. Heavy rainfall does not guarantee
> flooding. All funding is simulated: no bank, wallet, insurer or payment gateway is connected.

---

## Important: stack differences from the original brief

The brief asked for FastAPI + SQLite + a Vite/React Router frontend. This project was built on a hosting
platform that runs **Next.js (App Router) + PostgreSQL** only, so the running application is:

| Brief | Delivered | Notes |
| --- | --- | --- |
| FastAPI + Uvicorn backend | **Next.js route handlers (TypeScript)** under `src/app/api/v1` | Same `/api/v1` endpoints and camelCase contract. There is **no FastAPI app** and therefore no Swagger `/docs` page; the endpoint list is below and the contract is `src/lib/floodfund/types.ts`. |
| SQLAlchemy + SQLite | **Drizzle ORM + PostgreSQL** | Same data model, uniqueness constraint and atomic transaction. |
| Vite + React Router | **Next.js pages** `/` and `/dashboard` | React, TypeScript, Tailwind, Framer Motion, Lucide, Recharts, React Leaflet are used as requested. No Vite proxy is needed: UI and API share one origin. |
| `backend/app/config.py` + `backend/.env` | `src/lib/config.ts` + `.env` for the web service; `backend/app/config.py` + `backend/.env` for the Python training pipeline | Two config centres, one per runtime. |
| Pytest for everything | **Vitest** for the API/funding engine, **Pytest** for the training pipeline | |
| scikit-learn models, joblib | **As requested** (Python, `backend/ml`) | The web service runs the trained models from a JSON export of the same fitted scikit-learn models; a test proves both give identical predictions. |

The Python training pipeline (`backend/`) is exactly the stack the brief asked for and can be reused
unchanged if the API is later ported to FastAPI.

---

## What is live and what is simulated

| Thing | Status | Source |
| --- | --- | --- |
| 24 h rainfall forecast | **Live, real** | ECMWF AIFS Single 0.25° via Open-Meteo |
| Forecast freshness | **Verified** | Open-Meteo model metadata + Single Runs API (`run=`) |
| Satellite rainfall layer | **Live, real** | NASA GIBS, GPM IMERG daily precipitation rate |
| Base map | Live | OpenStreetMap tiles via Leaflet |
| Model benchmark | **Real measured results** | Archived AIFS runs vs NASA POWER IMERG |
| Funding, budget, allocations | **Simulated** | Rows in this app's database |
| Demo scenarios (calm, severe-storm, exact-threshold, stale-data) | **Synthetic, labelled DEMO** | Deterministic values in `src/lib/floodfund/scenarios.ts` |
| Landing-page globe | Decorative illustration | Not satellite data (and labelled as such) |

Nothing falls back to synthetic data. If a provider fails, the UI shows *unavailable* with `null` values.

## Data sources (all free, **no API keys**)

- **Open-Meteo / ECMWF AIFS** - live: `https://api.open-meteo.com/v1/ecmwf`; pinned and archived runs:
  `https://single-runs-api.open-meteo.com/v1/forecast` (`models=ecmwf_aifs025_single`, `run=YYYY-MM-DDTHH:MM`);
  run metadata: `https://api.open-meteo.com/data/ecmwf_aifs025_single/static/meta.json`.
- **NASA POWER** - `https://power.larc.nasa.gov/api/temporal/daily/point` with `parameters=IMERG_PRECTOT`,
  `community=SB`, `time-standard=UTC`. `-999` means missing and is never turned into zero.
- **NASA GIBS** - WMTS tiles for layer `IMERG_Precipitation_Rate` (`GoogleMapsCompatible_Level6`, native zoom ≤ 6).
  The observation date comes from the GIBS "Domains" metadata and is confirmed by loading a real tile.
- **OpenStreetMap** - standard tiles with attribution. For heavy traffic, switch to your own tile provider.

Please respect each provider's attribution and usage limits (Open-Meteo's free tier is for non-commercial use).

## Configuration

**Web service:** `src/lib/config.ts` is the single place that reads settings; everything else imports `config`.
Values come from `.env` in the project root (see `.env.example`) or the hosting platform's environment.

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_ENV` | `development` | Environment label |
| `DATABASE_URL` | - | PostgreSQL connection string (required) |
| `CORS_ORIGINS` | empty | Extra origins allowed to call `/api/v1` (same-origin always works) |
| `FORECAST_CACHE_SECONDS` | `300` | Short cache for the provider payload |
| `MODEL_MAX_RUN_AGE_HOURS` | `18` | Older runs are *stale* and cannot trigger funding |
| `LIVE_SCHEDULER_ENABLED` | `true` | Automatic live checks |
| `LIVE_REFRESH_MINUTES` | `15` | Scheduler interval |

**Training pipeline:** `backend/app/config.py` (pydantic-settings) loads `backend/.env` through an absolute
path, so it works from any working directory. See `backend/.env.example`.

**Credentials:** none exist and none are needed. There is no OpenAI, Gemini or NASA key. `.env` files are
git-ignored, but note that a `.env` file is **not hidden** from people or agents who have access to the
workspace. `DATABASE_URL` is the only sensitive value; set it privately in your environment or hosting
platform and never paste it into chat. Any `NEXT_PUBLIC_*` variable is visible to the browser (none are used).

## Run it

```bash
npm install
cp .env.example .env            # set DATABASE_URL
npx drizzle-kit push            # create tables (the app also creates them on first use)
npm run dev                     # http://localhost:3000
```

- Landing page: `http://localhost:3000/`
- Control room: `http://localhost:3000/dashboard`
- Storm demo: `http://localhost:3000/dashboard?scenario=severe-storm`
- Health: `http://localhost:3000/api/v1/health`

Production: `npm run build && npm run start`. To serve on a network or remote preview use
`npx next dev -H 0.0.0.0`. The browser only calls relative `/api/v1/...` paths, never `localhost`.

### API (prefix `/api/v1`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Database, scheduler and model status |
| GET | `/areas` | Karachi |
| GET | `/areas/karachi/forecast` | Live forecast, read-only |
| GET | `/areas/karachi/satellite` | GIBS layer metadata |
| POST | `/demo/sessions` | `{ sessionId, dashboard }`, live mode, full simulated budget |
| GET | `/demo/sessions/{id}/dashboard` | Read-only snapshot |
| POST | `/demo/sessions/{id}/evaluate-live` | Fetch + evaluate; blocked if stale/unverified |
| POST | `/demo/sessions/{id}/scenarios` | Body `{ "scenarioId": "severe-storm" }` |
| POST | `/demo/sessions/{id}/reset` | Resets only that session |
| GET | `/demo/sessions/{id}/audit` | Audit records |
| GET | `/models` | AIFS, Random Forest, neural network |
| GET | `/models/benchmark` | Saved real benchmark or `unavailable` |
| GET | `/models/comparison?areaId=karachi&date=YYYY-MM-DD` | Same fixed UTC day for all three; never allocates |

GET requests never write. A session ID isolates demo state; it is **not authentication**.

## Forecast time handling

- Open-Meteo hourly precipitation is the total of the **preceding** hour. The dashboard window is the next
  24 complete hours: at 10:25 UTC it is 11:00 → 11:00, i.e. the values stamped 12:00 … 11:00.
- All 24 values must exist and be finite and non-negative, in mm; otherwise the forecast is `invalid`
  with a `null` total. The hourly values add up to the returned total.
- `modelRunAt` (from provider metadata, then requested explicitly), `providerAvailableAt` and `retrievedAt`
  are kept separate. `generationtime_ms` is never used as a model time.
- If the run cannot be pinned, the forecast is shown as `unverified` and cannot trigger funding.
- AIFS output on Open-Meteo is 6-hourly; hourly values are Open-Meteo's interpolation (disclosed in the UI).

## The simulated funding rule

```
IF   forecast is valid and fresh  AND  rainfall >= 80 mm (next 24 h)
AND  policy is active  AND  simulated budget is sufficient
AND  the event has no allocation yet
THEN record ONE simulated PKR 500,000 allocation
ELSE no allocation, with the reason recorded
```

- Integer PKR amounts. Initial simulated budget PKR 2,000,000.
- The session row is locked, the allocation insert is protected by a database uniqueness constraint on
  **session + policy + event**, and the budget is deducted in the **same transaction**. Tests fire 8
  concurrent requests and confirm one allocation and one deduction.
- Event ID (a hackathon demonstration mechanism, not a storm identifier): demo = one per scenario;
  live = `LIVE-KARACHI-<UTC date of window start>`, reused while a previous allocation's window still overlaps.
- **Automatic checks:** an in-process timer re-fetches the forecast every `LIVE_REFRESH_MINUTES` and
  evaluates recently active live sessions. It requires the server process to stay running and is **not**
  a multi-worker production scheduler. It sends no alerts.
- Reset restores the budget and clears allocations for that session only; the audit trail is append-only.

## Models

| Model | Trained by | What it is |
| --- | --- | --- |
| ECMWF AIFS (raw) | **ECMWF** | Global AI weather model. The live dashboard forecast. |
| Team Random Forest | **Our team** | scikit-learn `RandomForestRegressor`; adjusts AIFS output towards NASA IMERG. |
| Team neural network | **Our team** | scikit-learn `StandardScaler → MLPRegressor`, same features. |

Our two models take AIFS as **input**. They are post-processors, not independent weather models.
Features: AIFS 24 h total, max hourly, wet hours, max 6-hour block, latitude, longitude, day-of-year sin/cos.
Target: NASA POWER IMERG rainfall for the same UTC day.

### Download data, train, evaluate

```bash
cd backend
pip install -r requirements.txt
python -m ml.collect_data --days 200 --max-locations 6   # the run used for the saved artifacts
python -m ml.build_dataset
python -m ml.train
python -m ml.evaluate
python -m ml.predict --date 2026-09-01 --location karachi
python -m pytest -q
```

`--days 120 --max-locations 4` also works. Downloads are cached in `backend/storage/raw/` and resumable.
The collector measures the real overlap: the Open-Meteo archive of AIFS single runs starts on
**2 April 2026**, and NASA POWER IMERG lags by several weeks, so it does **not** cover NASA's full history.

Artifacts (`backend/artifacts/`): `random_forest.joblib`, `neural_network.joblib`, `model_metadata.json`,
`dataset_summary.json`, `validation_metrics.json`, `test_metrics.json`, `benchmark.json`, plus
`random_forest.export.json`, `neural_network.export.json` and `parity_sample.json` for the web runtime.
Only these local, trusted files are loaded; there is no upload path. The API starts without them and
reports the models as `not-trained`. Models are never retrained at startup.

### Real results (run of 10 Nov 2026)

Dataset: **990 location-days**, 165 dates (2026-04-03 → 2026-09-14), 6 locations (Karachi, Hyderabad, Badin,
Sukkur, Lahore, Islamabad). Chronological split by date: train 582 rows (04-03 → 07-08), validation 192
(07-09 → 08-09), test 216 (08-10 → 09-14). Only **one** reference location-day reached 80 mm in the whole dataset.

| Test set (216 rows, 36 dates) | MAE mm | RMSE mm | Ref ≥ 80 | Pred ≥ 80 | Precision | Recall | False triggers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ECMWF AIFS (raw) | **2.88** | 11.14 | 1 | 0 | null | 0.0 | 0 |
| Team Random Forest | 3.07 | **10.29** | 1 | 0 | null | 0.0 | 0 |
| Team neural network | 4.65 | 13.73 | 1 | 0 | null | 0.0 | 0 |

Validation MAE: AIFS 3.06, Random Forest 3.30, neural network 3.81 mm.

**Honest reading:** raw AIFS had the lowest MAE on both validation and test. The Random Forest is not
distinguishable from AIFS (test MAE difference +0.19 mm, 95% interval −0.11 to +0.51) and has a slightly
lower RMSE. The neural network is worse than AIFS on this sample (+1.77 mm, interval +0.67 to +3.02). No model
predicted the single ≥ 80 mm day. With one event, threshold skill cannot be judged, and one season cannot
establish a reliable ranking. The validation-based recommendation is therefore **raw AIFS, flagged not reliable**.
Threshold precision/recall are agreement with a satellite estimate, not flood prediction accuracy.

### Why the benchmark window differs from the dashboard

NASA POWER rainfall is daily on **fixed UTC calendar days**, so the benchmark compares a UTC day (00:00–24:00)
using the AIFS run from 12:00 UTC the day before (12–36 h lead, decision cut-off 22:00 UTC). The dashboard
uses the **rolling next 24 hours** from the latest run. Our models were not trained or tested on the rolling
window, so AIFS remains the live forecast. Historical availability of archived runs before the cut-off is
**assumed** (≤ 10 h after initialisation), which makes this a retrospective benchmark, not a verified
operational backtest. IMERG values may be revised by NASA.

## Tests

```bash
npx vitest run                    # 30 tests: windows, freshness, scenarios, funding engine, HTTP contract, model parity
cd backend && python -m pytest -q # 12 tests: alignment, missing data, splits, metrics, artifacts
```

External providers are mocked. Funding tests use the PostgreSQL database in `DATABASE_URL` with isolated sessions.

## Deploying with persistent storage

- Use a managed PostgreSQL database and set `DATABASE_URL` in the platform's secret settings.
- Run `npx drizzle-kit push` once (or let the app create its tables on first request).
- Run **one** long-lived Node process (`npm run start`) so the in-process scheduler works. On serverless or
  multi-instance hosting, set `LIVE_SCHEDULER_ENABLED=false` and call `POST .../evaluate-live` from a single
  external cron instead; database idempotency keeps repeated calls safe.
- Commit `backend/artifacts/` with the app so the benchmark and model runtime are available.

## Limitations

- Not a flood model. AIFS is ~28 km and 6-hourly; nothing here is street-level.
- The threshold, event ID and budget are demonstration values. Sessions have no authentication.
- One monsoon season of data; one ≥ 80 mm reference day; neighbouring locations share storms and are not independent.
- Satellite imagery is a delayed estimate of past rain and never drives the rule.
- This demonstration issues no public alerts and must not be used for real decisions.
