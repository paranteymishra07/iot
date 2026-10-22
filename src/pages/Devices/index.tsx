import { useState } from "react";
import { MQTT_TOPICS } from "@/constants/mockData";
import { useFilteredMachines } from "@/hooks/useFilteredData";
import { Cpu, Plus, Wifi, WifiOff, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DevicesPage() {
  const machines = useFilteredMachines();
  const [activeTab, setActiveTab] = useState<"devices" | "mqtt">("devices");

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Device Management</h1>
          <p className="text-xs text-muted-foreground">Connected edge devices & MQTT topic visualization</p>
        </div>
        <button className="flex items-center gap-1.5 text-xs font-medium bg-brand-primary hover:bg-brand-primary/90 text-white px-3 py-2 rounded-md transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Device
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-industrial-surface rounded-lg p-1 w-fit">
        {[
          { key: "devices", label: "Devices" },
          { key: "mqtt", label: "MQTT Topics" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as "devices" | "mqtt")}
            className={cn(
              "px-4 py-2 text-xs font-medium rounded-md transition-colors",
              activeTab === key ? "bg-brand-primary/20 text-brand-primary" : "text-muted-foreground hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "devices" && (
        <div className="industrial-card">
          <div className="px-4 py-3 border-b border-industrial-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Registered Devices</h3>
            <span className="text-xs text-muted-foreground">{machines.length} devices</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-industrial-border">
                {["Device ID", "Machine", "IP Address", "Firmware", "MQTT Client", "Last Heartbeat", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {machines.map((m, i) => {
                const isOnline = m.status !== "down";
                return (
                  <tr key={m.id} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-brand-primary">DEV-{String(i + 1).padStart(3, "0")}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">{m.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.ipAddress}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.firmware}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">mqtt-{m.id}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {isOnline ? `${Math.floor(Math.random() * 10) + 1}s ago` : "4m ago"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("flex items-center gap-1.5 text-xs font-medium", isOnline ? "text-status-running" : "text-status-down")}>
                        {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-muted-foreground hover:text-white transition-colors">
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "mqtt" && (
        <div className="space-y-3">
          <div className="industrial-card p-4 border border-brand-primary/20 bg-brand-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-brand-primary" />
              <span className="text-sm font-semibold text-white">MQTT Architecture</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              MQTT terminates at the backend layer. The frontend receives events via WebSocket:
              <span className="font-mono text-brand-primary"> machine:update · machine:alarm · machine:oee · machine:sensor</span>
            </p>
          </div>

          <div className="industrial-card">
            <div className="px-4 py-3 border-b border-industrial-border">
              <h3 className="text-sm font-semibold text-white">Active MQTT Topics</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-industrial-border">
                  {["Topic", "Machine", "Type", "Last Message", "Last Update"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MQTT_TOPICS.map((t) => (
                  <tr key={t.topic} className="border-b border-industrial-border/40 hover:bg-industrial-hover transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-brand-accent">{t.topic}</td>
                    <td className="px-4 py-3 text-xs font-medium text-white">{t.machineId.toUpperCase()}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium",
                        t.type === "alarm" ? "text-status-down border-status-down/30 bg-status-down/10" :
                        t.type === "status" ? "text-status-running border-status-running/30 bg-status-running/10" :
                        "text-brand-primary border-brand-primary/30 bg-brand-primary/10"
                      )}>
                        {t.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.lastMessage}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">Just now</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
