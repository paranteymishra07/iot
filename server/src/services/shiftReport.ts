import { IShift, Shift, durationMin, crossesMidnight } from "../models/Shift.js";
import { MetricHistory } from "../models/MetricHistory.js";
import { Machine } from "../models/Machine.js";
import { Line } from "../models/Line.js";
import { Plant } from "../models/Plant.js";
import { eachDate } from "../models/ShiftAssignment.js";

export interface ShiftWindow {
  date: string;
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  durationMin: number;
  start: Date;
  end: Date;
}

export interface MachineShiftRow {
  machineId: string;
  machineName: string;
  units: number;
  goodUnits: number;
  rejects: number;
  rejectRate: number;
  target: number;
  achievement: number;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  energyKwh: number;
  temperature: number;
}

export interface ShiftReportRow extends ShiftWindow {
  windowLabel: string;
  machines: number;
  plannedMachines: number;
  units: number;
  goodUnits: number;
  rejects: number;
  rejectRate: number;
  target: number;
  achievement: number;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  downtimeMin: number;
  energyKwh: number;
  temperature: number;
  machineRows: MachineShiftRow[];
}

export interface ShiftReport {
  plant: { id: string; name: string };
  from: string;
  to: string;
  hourAligned: boolean;
  shifts: Array<{
    id: string;
    code: string;
    name: string;
    startTime: string;
    endTime: string;
    crossesMidnight: boolean;
    durationMin: number;
  }>;
  rows: ShiftReportRow[];
  totals: {
    units: number;
    goodUnits: number;
    rejects: number;
    target: number;
    achievement: number;
    oee: number;
    availability: number;
    performance: number;
    quality: number;
    downtimeMin: number;
    energyKwh: number;
    shifts: number;
  };
}

const round1 = (v: number) => Number(v.toFixed(1));
const round2 = (v: number) => Number(v.toFixed(2));

function atTime(date: string, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

export function buildWindows(shifts: IShift[], from: string, to: string): ShiftWindow[] {
  const windows: ShiftWindow[] = [];
  for (const date of eachDate(from, to)) {
    for (const s of shifts) {
      const start = atTime(date, s.startTime);
      const end = atTime(date, s.endTime);
      if (end <= start) end.setDate(end.getDate() + 1);
      windows.push({
        date,
        shiftId: String((s as unknown as { _id: { toHexString(): string } })._id),
        shiftCode: s.code,
        shiftName: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        crossesMidnight: crossesMidnight(s.startTime, s.endTime),
        durationMin: durationMin(s.startTime, s.endTime, s.breakMin),
        start,
        end,
      });
    }
  }
  return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function isHourAligned(shifts: IShift[]): boolean {
  return shifts.every((s) => s.startTime.endsWith(":00") && s.endTime.endsWith(":00"));
}

export async function buildShiftReport(plantId: string, from: string, to: string): Promise<ShiftReport> {
  const plant = await Plant.findById(plantId).select("name").lean();
  if (!plant) throw new Error("Plant not found");

  const shiftDocs = await Shift.find({ plantId }).sort({ order: 1, code: 1 });
  if (shiftDocs.length === 0) throw new Error("No shifts configured for this plant");

  const windows = buildWindows(shiftDocs, from, to);

  const lines = await Line.find({ plantId }).select("_id").lean();
  const lineIds = lines.map((l) => String((l as any)._id));
  const machines = (await Machine.find({ lineId: { $in: lineIds } }).select("name threshold cycleTime").lean()) as any[];
  const machineNames = machines.map((m) => String(m.name));
  const cycleTimes = new Map<string, number>(
    machines.map((m) => {
      const cycleSec = Number(m.threshold) || Number(m.cycleTime) || 0;
      return [String(m.name).toLowerCase(), cycleSec];
    })
  );

  const rangeStart = windows[0]?.start ?? new Date();
  const rangeEnd = windows[windows.length - 1]?.end ?? new Date();

  const match: Record<string, unknown> = {
    hour: { $gte: new Date(rangeStart.getTime() - 60 * 60 * 1000), $lte: rangeEnd },
  };
  if (machineNames.length > 0) {
    match.$or = [{ machineId: { $in: machineNames.map((n) => n.toLowerCase()) } }, { machineName: { $in: machineNames } }];
  } else {
    match.plant = plant.name;
  }

  const history = await MetricHistory.find(match).lean();

  const rows: ShiftReportRow[] = windows.map((w) => {
    const buckets = history.filter((h) => {
      const t = new Date((h as any).hour).getTime();
      return t >= w.start.getTime() && t < w.end.getTime();
    });

    const byMachine = new Map<string, any[]>();
    for (const b of buckets) {
      const key = String((b as any).machineId);
      byMachine.set(key, [...(byMachine.get(key) || []), b]);
    }

    const machineRows: MachineShiftRow[] = Array.from(byMachine.entries())
      .map(([machineId, list]) => {
        const units = list.reduce((a, h: any) => a + (h.deltaUnits || 0), 0);
        const rejects = Math.round(list.reduce((a, h: any) => a + (h.deltaUnits || 0) * (1 - (h.quality || 0) / 100), 0));
        const goodUnits = Math.max(0, units - rejects);
        const mean = (pick: (h: any) => number) => list.reduce((a, h: any) => a + (pick(h) || 0), 0) / list.length;
        const cycleSec = cycleTimes.get(machineId.toLowerCase()) || 0;
        const target = cycleSec > 0 ? Math.round((w.durationMin * 60) / cycleSec) : 0;

        return {
          machineId,
          machineName: String((list[0] as any).machineName || machineId),
          units: Math.round(units),
          goodUnits,
          rejects,
          rejectRate: units > 0 ? round2((rejects / units) * 100) : 0,
          target,
          achievement: target > 0 ? round1((units / target) * 100) : 0,
          oee: round1(mean((h) => h.oee)),
          availability: round1(mean((h) => h.availability)),
          performance: round1(mean((h) => h.performance)),
          quality: round1(mean((h) => h.quality)),
          energyKwh: round1(list.reduce((a, h: any) => a + (h.power || 0), 0)),
          temperature: round1(mean((h) => h.temperature)),
        };
      })
      .sort((a, b) => b.units - a.units);

    const all = buckets as any[];
    const mean = (pick: (h: any) => number) => (all.length > 0 ? all.reduce((a, h) => a + (pick(h) || 0), 0) / all.length : 0);
    const units = machineRows.reduce((a, m) => a + m.units, 0);
    const rejects = machineRows.reduce((a, m) => a + m.rejects, 0);
    const target = machineRows.reduce((a, m) => a + m.target, 0);
    const availability = round1(mean((h) => h.availability));

    return {
      ...w,
      windowLabel: `${w.startTime} – ${w.endTime}${w.crossesMidnight ? " (+1d)" : ""}`,
      machines: machineRows.length,
      plannedMachines: machineNames.length,
      units,
      goodUnits: Math.max(0, units - rejects),
      rejects,
      rejectRate: units > 0 ? round2((rejects / units) * 100) : 0,
      target,
      achievement: target > 0 ? round1((units / target) * 100) : 0,
      oee: round1(mean((h) => h.oee)),
      availability,
      performance: round1(mean((h) => h.performance)),
      quality: round1(mean((h) => h.quality)),
      downtimeMin: Math.round(((100 - availability) / 100) * w.durationMin),
      energyKwh: round1(machineRows.reduce((a, m) => a + m.energyKwh, 0)),
      temperature: round1(mean((h) => h.temperature)),
      machineRows,
    };
  });

  const withData = rows.filter((r) => r.machineRows.length > 0);
  const sum = (pick: (r: ShiftReportRow) => number) => withData.reduce((a, r) => a + pick(r), 0);
  const avg = (pick: (r: ShiftReportRow) => number) => (withData.length > 0 ? sum(pick) / withData.length : 0);
  const totalUnits = sum((r) => r.units);
  const totalTarget = sum((r) => r.target);

  return {
    plant: { id: plantId, name: plant.name },
    from,
    to,
    hourAligned: isHourAligned(shiftDocs),
    shifts: shiftDocs.map((s) => ({
      id: String((s as unknown as { _id: { toHexString(): string } })._id),
      code: s.code,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      crossesMidnight: crossesMidnight(s.startTime, s.endTime),
      durationMin: durationMin(s.startTime, s.endTime, s.breakMin),
    })),
    rows,
    totals: {
      units: totalUnits,
      goodUnits: sum((r) => r.goodUnits),
      rejects: sum((r) => r.rejects),
      target: totalTarget,
      achievement: totalTarget > 0 ? round1((totalUnits / totalTarget) * 100) : 0,
      oee: round1(avg((r) => r.oee)),
      availability: round1(avg((r) => r.availability)),
      performance: round1(avg((r) => r.performance)),
      quality: round1(avg((r) => r.quality)),
      downtimeMin: sum((r) => r.downtimeMin),
      energyKwh: round1(sum((r) => r.energyKwh)),
      shifts: withData.length,
    },
  };
}
