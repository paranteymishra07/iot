export type MetricStatus = "running" | "idle" | "down" | "maintenance";

export interface MetricSensorData {
  temperature: number;
  vibration: number;
  load: number;
  speed: number;
  power: number;
  pressure?: number;
}

export interface MetricOEE {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

export interface MachineMetric {
  id: string;
  machineId: string;
  machineName: string;
  plant: string;
  line: string;
  status: MetricStatus;
  plannedTimeMin: number;
  downtimeMin: number;
  operatingTimeMin: number;
  idealCycleTimeSec: number;
  totalUnits: number;
  goodUnits: number;
  rejects: number;
  sensor: MetricSensorData;
  oee: MetricOEE;
  updatedAt: string;
}
