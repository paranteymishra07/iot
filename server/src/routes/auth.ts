import { Router } from "express";
import { User } from "../models/User.js";
import { signToken } from "../middleware/auth.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await User.findOne({ email, password }).select("-password");
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.status !== "active") {
      return res.status(403).json({ error: "This account is inactive" });
    }
    user.lastLogin = "Just now";
    await user.save();
    // The token rides alongside the user so older clients that only read the
    // user fields keep working.
    res.json({ ...user.toJSON(), token: signToken(String(user._id)) });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
