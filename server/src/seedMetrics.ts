import { connectDB } from "./config/db.js";
import { MachineMetric } from "./models/MachineMetric.js";

const SEED_METRICS = [
  {
    machineId: "cnc-001",
    machineName: "CNC-001",
    plant: "Mumbai Plant",
    line: "Production Line A",
    status: "running",
    plannedTimeMin: 480,
    downtimeMin: 18,
    idealCycleTimeSec: 12.4,
    totalUnits: 1245,
    goodUnits: 1234,
    sensor: { temperature: 64.2, vibration: 2.4, load: 72, speed: 1840, power: 4.8 },
  },
  {
    machineId: "cnc-002",
    machineName: "CNC-002",
    plant: "Mumbai Plant",
    line: "Production Line A",
    status: "idle",
    plannedTimeMin: 480,
    downtimeMin: 90,
    idealCycleTimeSec: 16.8,
    totalUnits: 920,
    goodUnits: 919,
    sensor: { temperature: 48.1, vibration: 0.8, load: 15, speed: 0, power: 1.2 },
  },
  {
    machineId: "press-003",
    machineName: "Press-003",
    plant: "Mumbai Plant",
    line: "Production Line B",
    status: "running",
    plannedTimeMin: 480,
    downtimeMin: 32,
    idealCycleTimeSec: 10.2,
    totalUnits: 1850,
    goodUnits: 1843,
    sensor: { temperature: 71.5, vibration: 3.8, load: 85, speed: 1200, power: 8.4, pressure: 142 },
  },
  {
    machineId: "cnc-004",
    machineName: "CNC-004",
    plant: "Mumbai Plant",
    line: "Production Line B",
    status: "down",
    plannedTimeMin: 480,
    downtimeMin: 480,
    idealCycleTimeSec: 13.0,
    totalUnits: 420,
    goodUnits: 415,
    sensor: { temperature: 31.2, vibration: 8.7, load: 0, speed: 0, power: 0 },
  },
  {
    machineId: "assembly-001",
    machineName: "Assembly-001",
    plant: "Mumbai Plant",
    line: "Assembly Line",
    status: "running",
    plannedTimeMin: 480,
    downtimeMin: 47,
    idealCycleTimeSec: 22.5,
    totalUnits: 712,
    goodUnits: 712,
    sensor: { temperature: 55.0, vibration: 1.2, load: 62, speed: 800, power: 3.2 },
  },
  {
    machineId: "weld-001",
    machineName: "Weld-001",
    plant: "Mumbai Plant",
    line: "Production Line A",
    status: "maintenance",
    plannedTimeMin: 480,
    downtimeMin: 300,
    idealCycleTimeSec: 28.0,
    totalUnits: 180,
    goodUnits: 178,
    sensor: { temperature: 42.8, vibration: 0.4, load: 0, speed: 0, power: 0.5 },
  },
];

async function seedMetrics() {
  await connectDB();
  console.log("Clearing MachineMetric collection...");
  await MachineMetric.deleteMany({});
  console.log("Seeding MachineMetric data...");
  await MachineMetric.insertMany(SEED_METRICS);
  console.log("MachineMetric seed complete!");
  process.exit(0);
}

seedMetrics().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
