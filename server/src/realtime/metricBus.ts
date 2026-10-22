import { EventEmitter } from "events";

export const metricBus = new EventEmitter();

export const METRIC_EVENT = "metric-update";

export function broadcastMetric(metric: Record<string, unknown>) {
  metricBus.emit(METRIC_EVENT, metric);
}
