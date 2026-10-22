import { connectDB } from "./config/db.js";
import { Company } from "./models/Company.js";
import { Plant } from "./models/Plant.js";
import { Line } from "./models/Line.js";
import { Machine } from "./models/Machine.js";
import { Alarm } from "./models/Alarm.js";
import { EnergyData } from "./models/EnergyData.js";
import { User } from "./models/User.js";

async function seed() {
  await connectDB();

  console.log("Clearing existing data...");
  await Promise.all([
    Company.deleteMany({}),
    Plant.deleteMany({}),
    Line.deleteMany({}),
    Machine.deleteMany({}),
    Alarm.deleteMany({}),
    EnergyData.deleteMany({}),
    User.deleteMany({}),
  ]);

  console.log("Seeding companies...");
  const companies = await Company.insertMany([
    {
      name: "ABC Manufacturing",
      code: "ABC",
      address: "123 Industrial Area, Andheri East",
      contactPerson: "Ravi Mehta",
      contactEmail: "ravi@abcmfg.com",
      contactPhone: "+91 98765 43210",
      status: "active",
    },
    {
      name: "XYZ Industries",
      code: "XYZ",
      address: "456 MIDC, Hinjewadi",
      contactPerson: "Sunita Rao",
      contactEmail: "sunita@xyzind.com",
      contactPhone: "+91 98765 11111",
      status: "active",
    },
    {
      name: "Global Precision Parts",
      code: "GPP",
      address: "789 Nashik Road, Nashik",
      contactPerson: "Vikram Deshmukh",
      contactEmail: "vikram@gpp.co.in",
      contactPhone: "+91 98765 22222",
      status: "inactive",
    },
  ]);

  const abcId = companies[0]._id;
  const xyzId = companies[1]._id;

  console.log("Seeding plants...");
  const plants = await Plant.insertMany([
    { companyId: abcId, name: "Mumbai Plant", code: "MUM", address: "123 Industrial Area, Andheri East", city: "Mumbai", state: "Maharashtra", status: "active" },
    { companyId: abcId, name: "Pune Plant", code: "PUN", address: "456 MIDC, Hinjewadi", city: "Pune", state: "Maharashtra", status: "active" },
    { companyId: xyzId, name: "Nagpur Facility", code: "NGP", address: "789 MIHAN, Nagpur", city: "Nagpur", state: "Maharashtra", status: "active" },
    { companyId: xyzId, name: "Indore Unit", code: "IND", address: "321 Pithampur Industrial Area", city: "Indore", state: "Madhya Pradesh", status: "inactive" },
  ]);

  const mumbaiId = plants[0]._id;
  const puneId = plants[1]._id;
  const nagpurId = plants[2]._id;

  console.log("Seeding lines...");
  const lines = await Line.insertMany([
    { plantId: mumbaiId, name: "Production Line A", code: "PLA", description: "Primary CNC machining line", status: "active" },
    { plantId: mumbaiId, name: "Production Line B", code: "PLB", description: "Hydraulic press operations", status: "active" },
    { plantId: mumbaiId, name: "Assembly Line", code: "AL1", description: "Final assembly and quality check", status: "active" },
    { plantId: puneId, name: "CNC Line 1", code: "CNC1", description: "High-precision CNC turning", status: "active" },
    { plantId: puneId, name: "Press Line", code: "PRL", description: "Sheet metal pressing", status: "active" },
    { plantId: puneId, name: "Welding Line", code: "WDL", description: "Robotic welding station", status: "inactive" },
    { plantId: nagpurId, name: "Assembly Line 1", code: "A1", description: "Main assembly line", status: "active" },
  ]);

  const lineA = lines[0]._id;
  const lineB = lines[1]._id;
  const lineAssembly = lines[2]._id;
  const lineCnc1 = lines[3]._id;
  const linePress = lines[4]._id;

  console.log("Seeding machines...");
  const machines = await Machine.insertMany([
    { lineId: lineA, name: "CNC-001", type: "CNC Machine", manufacturer: "DMG Mori", model: "NLX 2500", serialNumber: "DMG-2023-001", ipAddress: "192.168.1.101", status: "active", installDate: "2023-02-15" },
    { lineId: lineA, name: "CNC-002", type: "CNC Machine", manufacturer: "DMG Mori", model: "NLX 2500", serialNumber: "DMG-2023-002", ipAddress: "192.168.1.102", status: "active", installDate: "2023-03-10" },
    { lineId: lineB, name: "Press-003", type: "Hydraulic Press", manufacturer: "Schuler", model: "HPF-200", serialNumber: "SCH-2023-003", ipAddress: "192.168.1.103", status: "active", installDate: "2023-02-20" },
    { lineId: lineB, name: "CNC-004", type: "CNC Machine", manufacturer: "Okuma", model: "LB3000 EX II", serialNumber: "OKU-2023-004", ipAddress: "192.168.1.104", status: "inactive", installDate: "2023-04-05" },
    { lineId: lineAssembly, name: "Assembly-001", type: "Assembly Station", manufacturer: "Custom Built", model: "ASB-500", serialNumber: "CST-2023-005", ipAddress: "192.168.1.105", status: "active", installDate: "2023-05-01" },
    { lineId: lineA, name: "Weld-001", type: "Welding Robot", manufacturer: "Fanuc", model: "Arc Mate 100iD", serialNumber: "FAN-2023-006", ipAddress: "192.168.1.106", status: "inactive", installDate: "2023-06-15" },
    { lineId: lineCnc1, name: "CNC-005", type: "CNC Machine", manufacturer: "Haas", model: "ST-30Y", serialNumber: "HAS-2023-007", ipAddress: "192.168.2.101", status: "active", installDate: "2023-05-10" },
    { lineId: linePress, name: "Press-002", type: "Hydraulic Press", manufacturer: "Schuler", model: "HPF-100", serialNumber: "SCH-2023-008", ipAddress: "192.168.2.102", status: "active", installDate: "2023-06-01" },
  ]);

  const mapByName = Object.fromEntries(machines.map((m) => [m.name, m._id.toString()]));

  console.log("Seeding alarms...");
  await Alarm.insertMany([
    { machineId: mapByName["CNC-004"], machineName: "CNC-004", plant: "Mumbai Plant", line: "Production Line B", severity: "critical", status: "active", title: "Excessive Vibration Detected", message: "Vibration level exceeds critical threshold. Machine stopped.", value: "8.7 mm/s", threshold: "> 7.0 mm/s", timestamp: new Date(Date.now() - 18 * 60000) },
    { machineId: mapByName["Press-003"], machineName: "Press-003", plant: "Mumbai Plant", line: "Production Line B", severity: "warning", status: "active", title: "Temperature Approaching Threshold", message: "Operating temperature is nearing warning limit.", value: "71.5 °C", threshold: "> 75 °C warning", timestamp: new Date(Date.now() - 32 * 60000) },
    { machineId: mapByName["CNC-001"], machineName: "CNC-001", plant: "Mumbai Plant", line: "Production Line A", severity: "info", status: "acknowledged", title: "Scheduled Maintenance Due", message: "CNC-001 is due for scheduled lubrication in 3 days.", value: "4820 hrs", threshold: "Service at 5000 hrs", timestamp: new Date(Date.now() - 2 * 3600000), acknowledgedBy: "Rajesh Kumar", acknowledgedAt: new Date(Date.now() - 1 * 3600000) },
    { machineId: mapByName["Weld-001"], machineName: "Weld-001", plant: "Mumbai Plant", line: "Production Line A", severity: "warning", status: "active", title: "Maintenance Mode Active", message: "Machine placed in maintenance mode by operator.", value: "Manual stop", threshold: "N/A", timestamp: new Date(Date.now() - 4 * 3600000) },
    { machineId: mapByName["CNC-002"], machineName: "CNC-002", plant: "Mumbai Plant", line: "Production Line A", severity: "info", status: "resolved", title: "Production Target Behind Schedule", message: "Production rate dropped below 70% of target during morning shift.", value: "68%", threshold: "< 75% target", timestamp: new Date(Date.now() - 8 * 3600000), resolvedAt: new Date(Date.now() - 6 * 3600000) },
  ]);

  console.log("Seeding energy data...");
  await EnergyData.insertMany([
    { machineId: mapByName["CNC-001"], machineName: "CNC-001", plant: "Mumbai Plant", line: "Production Line A", todayKwh: 824, costInr: 6592, peakDemand: 5.2, kwhPerUnit: 0.66 },
    { machineId: mapByName["CNC-002"], machineName: "CNC-002", plant: "Mumbai Plant", line: "Production Line A", todayKwh: 712, costInr: 5696, peakDemand: 4.8, kwhPerUnit: 0.77 },
    { machineId: mapByName["Press-003"], machineName: "Press-003", plant: "Mumbai Plant", line: "Production Line B", todayKwh: 648, costInr: 5184, peakDemand: 9.1, kwhPerUnit: 0.35 },
    { machineId: mapByName["Assembly-001"], machineName: "Assembly-001", plant: "Mumbai Plant", line: "Assembly Line", todayKwh: 421, costInr: 3368, peakDemand: 3.4, kwhPerUnit: 0.59 },
    { machineId: mapByName["CNC-004"], machineName: "CNC-004", plant: "Mumbai Plant", line: "Production Line B", todayKwh: 58, costInr: 464, peakDemand: 0.1, kwhPerUnit: 0 },
    { machineId: mapByName["Weld-001"], machineName: "Weld-001", plant: "Mumbai Plant", line: "Production Line A", todayKwh: 89, costInr: 712, peakDemand: 0.5, kwhPerUnit: 0 },
  ]);

  console.log("Seeding users...");
  await User.insertMany([
    { name: "Rajesh Kumar", email: "rajesh@abcmfg.com", password: "password", role: "plant_manager", company: "ABC Manufacturing", plant: "Mumbai Plant", status: "active", lastLogin: "2 hours ago" },
    { name: "Priya Sharma", email: "priya@abcmfg.com", password: "password", role: "production_manager", company: "ABC Manufacturing", plant: "Mumbai Plant", status: "active", lastLogin: "1 day ago" },
    { name: "Anil Verma", email: "anil@abcmfg.com", password: "password", role: "maintenance_manager", company: "ABC Manufacturing", plant: "Pune Plant", status: "active", lastLogin: "3 hours ago" },
    { name: "Suresh Patel", email: "suresh@abcmfg.com", password: "password", role: "operator", company: "ABC Manufacturing", plant: "Mumbai Plant", status: "active", lastLogin: "30 min ago" },
    { name: "Kavita Nair", email: "kavita@abcmfg.com", password: "password", role: "viewer", company: "ABC Manufacturing", plant: "Pune Plant", status: "inactive", lastLogin: "5 days ago" },
    { name: "System Administrator", email: "superadmin@bytematrix.com", password: "super123", role: "super_admin", company: "All Companies", plant: "All Plants", status: "active", lastLogin: "Never" },
    { name: "Ravi Mehta", email: "ravi@abcmfg.com", password: "admin123", role: "oem_admin", company: "ABC Manufacturing", plant: "All Plants", status: "active", lastLogin: "1 hour ago" },
  ]);

  console.log("Seed complete! All data inserted into bytematrix database.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
