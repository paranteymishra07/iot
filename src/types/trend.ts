export interface TrendHourRow {
  time: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  units: number;
  temperature: number;
  power: number;
}

export interface TrendResponse {
  scope: "all" | "machine";
  hours: number;
  machineId: string | null;
  series: TrendHourRow[];
  hasData: boolean;
}
