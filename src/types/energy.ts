export interface EnergyData {
  id: string;
  machineId: string;
  machineName: string;
  plant: string;
  line: string;
  todayKwh: number;
  costInr: number;
  peakDemand: number;
  kwhPerUnit: number;
}

export interface EnergyTrend {
  time: string;
  power: number;
  cost: number;
}
