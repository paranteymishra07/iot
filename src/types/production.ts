export type LogStatus = "running" | "idle" | "down" | "maintenance";

export interface DowntimeReason {
  id: string;
  label: string;
  category: string;
  active: boolean;
}

export interface ProductionLog {
  id: string;
  machineId: string;
  machineName: string;
  operatorId: string;
  operatorName: string;
  plant: string;
  line: string;
  date: string;
  status: LogStatus;
  dailyTarget: number;
  totalUnits: number;
  goodUnits: number;
  rejects: number;
  cycleTimeSec: number;
  cycleTimeThreshold: number;
  plannedTimeMin: number;
  downtimeMin: number;
  downtimeReasonId: string;
  downtimeReasonLabel: string;
  lastProducedAt: string;
  updatedAt: string;
}

export interface MachineDayEfficiency {
  efficiency: number;
  availability: number;
  performance: number;
  quality: number;
}

export interface OperatorDashboardMachine extends ProductionLog, MachineDayEfficiency {}

export interface OperatorDashboard {
  date: string;
  target: number;
  machines: OperatorDashboardMachine[];
}

export interface DayEfficiencySummary extends MachineDayEfficiency {
  date: string;
  totalUnits: number;
  goodUnits: number;
  rejects: number;
  dailyTarget: number;
  downtimeMin: number;
}
