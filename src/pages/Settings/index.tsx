import { useState } from "react";
import { Settings, Bell, Sliders, Shield, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const ALARM_THRESHOLDS = [
  { machine: "CNC-001", parameter: "Temperature", warning: 75, critical: 85, unit: "°C", duration: 10 },
  { machine: "CNC-001", parameter: "Vibration", warning: 5, critical: 7, unit: "mm/s", duration: 5 },
  { machine: "Press-003", parameter: "Temperature", warning: 75, critical: 90, unit: "°C", duration: 10 },
  { machine: "CNC-004", parameter: "Vibration", warning: 5, critical: 7, unit: "mm/s", duration: 5 },
];

type Tab = "alarms" | "general" | "notifications" | "security";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("alarms");

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-white">Settings</h1>
        <p className="text-xs text-muted-foreground">Platform configuration and alarm thresholds</p>
      </div>

      <div className="flex gap-1 bg-industrial-surface rounded-lg p-1 w-fit">
        {([
          { key: "alarms", icon: Bell, label: "Alarm Thresholds" },
          { key: "general", icon: Sliders, label: "General" },
          { key: "notifications", icon: Bell, label: "Notifications" },
          { key: "security", icon: Shield, label: "Security" },
        ] as { key: Tab; icon: typeof Bell; label: string }[]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors",
              tab === key ? "bg-brand-primary/20 text-brand-primary" : "text-muted-foreground hover:text-white"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "alarms" && (
        <div className="space-y-4">
          <div className="industrial-card p-4 border border-brand-primary/20 bg-brand-primary/5">
            <p className="text-xs text-muted-foreground">
              Configure alarm thresholds per machine and parameter. Changes take effect within 30 seconds on edge devices via MQTT command.
            </p>
          </div>

          {ALARM_THRESHOLDS.map((t, i) => (
            <div key={i} className="industrial-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">{t.machine} — {t.parameter}</h3>
                  <p className="text-[11px] text-muted-foreground">Trigger duration: {t.duration} seconds</p>
                </div>
                <button className="text-xs text-brand-primary border border-brand-primary/30 px-2.5 py-1.5 rounded hover:bg-brand-primary/10 transition-colors">
                  Save Changes
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] text-status-idle uppercase tracking-wider font-semibold block mb-1.5">⚠ Warning Threshold</label>
                  <div className="flex items-center gap-2 bg-industrial-surface border border-status-idle/30 rounded-md px-3 py-2">
                    <span className="text-xs text-muted-foreground">&gt;</span>
                    <input
                      type="number"
                      defaultValue={t.warning}
                      className="flex-1 bg-transparent text-sm font-mono font-bold text-status-idle outline-none w-16"
                    />
                    <span className="text-xs text-muted-foreground">{t.unit}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-status-down uppercase tracking-wider font-semibold block mb-1.5">🔴 Critical Threshold</label>
                  <div className="flex items-center gap-2 bg-industrial-surface border border-status-down/30 rounded-md px-3 py-2">
                    <span className="text-xs text-muted-foreground">&gt;</span>
                    <input
                      type="number"
                      defaultValue={t.critical}
                      className="flex-1 bg-transparent text-sm font-mono font-bold text-status-down outline-none w-16"
                    />
                    <span className="text-xs text-muted-foreground">{t.unit}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block mb-1.5">Duration (seconds)</label>
                  <div className="flex items-center gap-2 bg-industrial-surface border border-industrial-border rounded-md px-3 py-2">
                    <input
                      type="number"
                      defaultValue={t.duration}
                      className="flex-1 bg-transparent text-sm font-mono font-bold text-white outline-none w-16"
                    />
                    <span className="text-xs text-muted-foreground">sec</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block mb-2">Actions on Alarm</label>
                <div className="flex flex-wrap gap-3">
                  {["Dashboard Alarm", "Email", "SMS", "WhatsApp", "MQTT Command"].map((action) => (
                    <label key={action} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" defaultChecked={action === "Dashboard Alarm" || action === "Email"} className="w-3.5 h-3.5 accent-brand-primary" />
                      <span className="text-xs text-white">{action}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "general" && (
        <div className="industrial-card p-6 text-center">
          <Sliders className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">General settings panel</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Plant configuration, shift schedules, and system preferences</p>
        </div>
      )}

      {tab === "notifications" && (
        <div className="industrial-card p-6 text-center">
          <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Notification settings</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Email, SMS, WhatsApp, and push notification configuration</p>
        </div>
      )}

      {tab === "security" && (
        <div className="industrial-card p-6 text-center">
          <Shield className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Security settings</p>
          <p className="text-xs text-muted-foreground/60 mt-1">JWT token management, session policies, and audit logs</p>
        </div>
      )}
    </div>
  );
}
