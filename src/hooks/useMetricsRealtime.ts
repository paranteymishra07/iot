import { useEffect, useRef } from "react";
import { useMetricsStore } from "@/stores/metricsStore";
import { api, API_BASE } from "@/lib/api";
import type { MachineMetric } from "@/types/metrics";

interface SSEPayload {
  type?: string;
  metric?: MachineMetric;
}

export function useMetricsRealtime() {
  const setMetrics = useMetricsStore((s) => s.setMetrics);
  const upsertMetric = useMetricsStore((s) => s.upsertMetric);
  const setConnected = useMetricsStore((s) => s.setConnected);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        const res = await api.get<MachineMetric[]>("/metrics");
        if (!disposed) setMetrics(res.data);
      } catch (err) {
        console.error("Failed to load metrics", err);
      }
    })();

    const source = new EventSource(`${API_BASE}/metrics/stream`);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.onmessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as SSEPayload;
        if (payload.type === "metric" && payload.metric) {
          upsertMetric(payload.metric);
        }
      } catch (err) {
        console.error("Invalid SSE message", err);
      }
    };

    return () => {
      disposed = true;
      source.close();
      sourceRef.current = null;
      setConnected(false);
    };
  }, [setMetrics, upsertMetric, setConnected]);

  return useMetricsStore((s) => s.metrics);
}
