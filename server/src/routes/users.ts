import { Router } from "express";
import { User } from "../models/User.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }
    const user = await User.create({ ...rest, password });
    const { password: _, ...userObj } = user.toObject();
    res.status(201).json(userObj);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create user" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { password, ...updates } = req.body;
    if (password) {
      await User.findByIdAndUpdate(req.params.id, { ...updates, password });
    } else {
      await User.findByIdAndUpdate(req.params.id, updates);
    }
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update user" });
  }
});

router.put("/:id/assignment", async (req, res) => {
  try {
    const { assignedMachineIds, assignedLine, dailyTarget } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          assignedMachineIds: Array.isArray(assignedMachineIds) ? assignedMachineIds : undefined,
          assignedLine: assignedLine ?? undefined,
          dailyTarget: typeof dailyTarget === "number" ? dailyTarget : undefined,
        },
      },
      { new: true }
    ).select("-password");
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update assignment" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
