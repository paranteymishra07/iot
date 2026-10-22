export interface OEETrend {
  date: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

export interface DowntimeReason {
  reason: string;
  duration: number; // minutes
  percentage: number;
}

export interface ShiftData {
  shift: string;
  target: number;
  produced: number;
  good: number;
  rejected: number;
  achievement: number;
  oee: number;
}
