export type MachineStatus = "running" | "idle" | "down" | "maintenance";

export interface SensorData {
  temperature: number; // °C
  vibration: number; // mm/s
  load: number; // %
  speed: number; // RPM
  power: number; // kW
  pressure?: number; // bar
}

export interface OEEData {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

export interface ProductionData {
  target: number;
  actual: number;
  good: number;
  rejects: number;
  cycleTime: number; // seconds
  rate: number; // units/hour
}

export interface Machine {
  id: string;
  name: string;
  type: string;
  line: string;
  plant: string;
  status: MachineStatus;
  oee: OEEData;
  sensors: SensorData;
  production: ProductionData;
  lastUpdate: Date;
  operatingHours: number;
  healthScore: number;
  energyConsumption: number; // kWh today
  ipAddress: string;
  firmware: string;
  mqttTopics: string[];
}

export interface TimeSeriesPoint {
  time: string;
  value: number;
}
