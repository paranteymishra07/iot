export type AlarmSeverity = "critical" | "warning" | "info";
export type AlarmStatus = "active" | "acknowledged" | "resolved";

export interface Alarm {
  id: string;
  machineId: string;
  machineName: string;
  plant: string;
  line: string;
  severity: AlarmSeverity;
  status: AlarmStatus;
  title: string;
  message: string;
  value: string;
  threshold: string;
  timestamp: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

export interface AlarmThreshold {
  id: string;
  machineId: string;
  parameter: string;
  warningValue: number;
  criticalValue: number;
  unit: string;
  duration: number;
  actions: {
    dashboard: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    mqttCommand: boolean;
  };
}
