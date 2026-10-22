# REPRODUCIBILITY.md — ByteMatrix IEEE Paper

## Prerequisites

| Requirement | Version |
|------------|---------|
| Node.js | ≥ 18.0 |
| npm | ≥ 9.0 |
| MongoDB | ≥ 6.0 |
| Python | ≥ 3.9 (for paper generation only) |

## 1. Setup

```sh
# 1. Clone / extract the repository
cd iot-main

# 2. Install frontend dependencies
npm install

# 3. Install server dependencies
cd server
npm install
cd ..
```

## 2. Database Setup

```sh
# Start MongoDB (local)
mongod --auth --port 27017

# Create admin user (if not exists)
mongosh --eval "db.createUser({user:'admin',pwd:'querty',roles:['root']})"

# Seed master data
cd server
npm run seed

# Seed machine metrics
npm run seed:metrics
```

## 3. Start the Server

```sh
cd server
npm run dev
```

The server starts on **http://localhost:4000**.

Environment flags (set in `server/.env` or shell):

| Variable | Default | Effect |
|----------|---------|--------|
| `METRICS_SIMULATOR` | `on` | `off` disables IoT simulator |
| `METRICS_INTERVAL_MS` | `5000` | Simulator tick interval (ms) |
| `STATUS_ENGINE` | `on` | `off` disables status auto-detection |
| `STATUS_INTERVAL_MS` | `30000` | Status engine poll interval (ms) |
| `HISTORY_BACKFILL` | `on` | `off` disables startup backfill |
| `HISTORY_BACKFILL_HOURS` | `24` | Hours of history to backfill |

## 4. Start the Frontend

```sh
# In the project root
npm run dev
```

Open **http://localhost:5173**.

Default login credentials from seed:

| Email | Password | Role |
|-------|----------|------|
| `superadmin@bytematrix.com` | `super123` | super_admin |
| `rajesh@abcmfg.com` | `password` | plant_manager |
| `ravi@abcmfg.com` | `admin123` | oem_admin |

## 5. Reproduce OEE Verification (Table II)

The test cases in Table II can be verified by inspecting `server/src/models/MachineMetric.ts` → `computeOEE` and applying equations (4)–(7) manually, or by calling the API:

```sh
# After server start, fetch live metrics:
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/metrics
```

## 6. Reproduce Payroll Verification (Table III)

```sh
cd server
node --loader ts-node/esm salary-calc-check.mjs
node --loader ts-node/esm attendance-calc-check.mjs
```

These scripts run the salary and attendance engines against predefined test inputs and print computed vs. expected values.

## 7. Reproduce the Word Document

```sh
pip install python-docx
python "C:\Users\aryan\.gemini\antigravity-ide\brain\3e65a365-4284-47c7-961e-4fbe78365652\scratch\generate_paper.py"
```

Output: `ByteMatrix_IEEE_Research_Paper.docx`

## 8. Random Seeds

The history backfill uses a deterministic FNV-1a hash (no configurable seed). Results are fully determined by `machineId` strings and UTC hour timestamps. No random state needs to be fixed.

The IoT simulator uses `Math.random()` which is not seeded — simulator-generated trends will differ across runs, but backfill-generated historical data will be identical.
