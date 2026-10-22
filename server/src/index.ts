import "dotenv/config";
import express from "express";
import cors from "cors";

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

import { connectDB } from "./config/db.js";
import { authenticate, loadPlantScope } from "./middleware/auth.js";
import companiesRouter from "./routes/companies.js";
import plantsRouter from "./routes/plants.js";
import linesRouter from "./routes/lines.js";
import machinesRouter from "./routes/machines.js";
import alarmsRouter from "./routes/alarms.js";
import energyRouter from "./routes/energy.js";
import usersRouter from "./routes/users.js";
import authRouter from "./routes/auth.js";
import metricsRouter from "./routes/metrics.js";
import trendsRouter from "./routes/trends.js";
import shiftsRouter from "./routes/shifts.js";
import shiftReportsRouter from "./routes/shiftReports.js";
import attendanceRouter from "./routes/attendance.js";
import holidaysRouter from "./routes/holidays.js";
import salaryRouter from "./routes/salary.js";
import productionRouter from "./routes/production.js";
import downtimeReasonsRouter from "./routes/downtimeReasons.js";
import { startMetricSimulator } from "./realtime/simulator.js";
import { startStatusEngine } from "./services/statusEngine.js";
import { startHistoryBackfill } from "./services/backfillHistory.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Login must be reachable without a token, so it is mounted ahead of the guard.
// Everything else under /api requires a valid token and carries its plant scope.
app.use("/api/auth", authRouter);
app.use("/api", authenticate, loadPlantScope);
app.use("/api/companies", companiesRouter);
app.use("/api/plants", plantsRouter);
app.use("/api/lines", linesRouter);
app.use("/api/machines", machinesRouter);
app.use("/api/alarms", alarmsRouter);
app.use("/api/energy", energyRouter);
app.use("/api/users", usersRouter);
app.use("/api/metrics", trendsRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/production", productionRouter);
app.use("/api/downtime-reasons", downtimeReasonsRouter);
app.use("/api/shifts", shiftsRouter);
app.use("/api/shift-reports", shiftReportsRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/holidays", holidaysRouter);
app.use("/api/salary", salaryRouter);

await connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.HISTORY_BACKFILL !== "off") {
    startHistoryBackfill(Number(process.env.HISTORY_BACKFILL_HOURS) || 24);
  }
  if (process.env.METRICS_SIMULATOR !== "off") {
    const interval = Number(process.env.METRICS_INTERVAL_MS) || 5000;
    startMetricSimulator(interval);
  } else {
    console.log("[metrics] IoT simulator disabled (set METRICS_SIMULATOR=on to enable). Data changes only via DB/manual writes.");
  }
  if (process.env.STATUS_ENGINE !== "off") {
    startStatusEngine(Number(process.env.STATUS_INTERVAL_MS) || 30000);
    console.log("[status-engine] idle/down auto-detection started");
  }
});

server.on("error", (err) => {
  console.error("Server error:", err);
});
