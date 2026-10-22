import { Shift, DEFAULT_SHIFT_TEMPLATES } from "../models/Shift.js";
import { Plant } from "../models/Plant.js";

// Every plant starts with the standard A/B/C pattern so the roster grid and
// shift reports are usable immediately; the admin can then edit per plant.
export async function ensureShiftDefaults(plantId: string): Promise<number> {
  const count = await Shift.countDocuments({ plantId });
  if (count > 0) return 0;
  const plant = await Plant.findById(plantId).select("name").lean();
  if (!plant) return 0;

  const result = await Shift.insertMany(
    DEFAULT_SHIFT_TEMPLATES.map((t, i) => ({ ...t, plantId, order: i + 1, active: true }))
  );
  return result.length;
}
