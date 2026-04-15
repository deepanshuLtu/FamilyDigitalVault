const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const {
  countUsers,
  createUser,
  findUserByEmail,
  findUserByUsername,
  matchPassword,
} = require("../data/users");
const { protect } = require("../middleware/auth");

// Helper: generate JWT
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ── POST /api/auth/signup ────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const exists = await findUserByEmail(email);
    if (exists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const existingUsername = await findUserByUsername(username);
    if (existingUsername) {
      return res.status(409).json({ message: "Username already taken" });
    }

    const isFirstUser = (await countUsers()) === 0;
    const normalizedRole = isFirstUser ? "admin" : (role || "member");
    const safeRole = normalizedRole === "admin" ? "admin" : "member";
    const familyId = safeRole === "admin" ? randomUUID() : null;

    const user = await createUser({
      name,
      username,
      email,
      password,
      role: safeRole,
      familyId,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      familyId: user.familyId,
      requests: user.requests,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error(err);
    if (err.code === "EMAIL_EXISTS") {
      return res.status(409).json({ message: "Email already registered" });
    }
    if (err.code === "USERNAME_EXISTS") {
      return res.status(409).json({ message: "Username already taken" });
    }
    res.status(500).json({ message: "Server error during signup" });
  }
});

// ── POST /api/auth/login ─────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await findUserByEmail(email);
    if (!user || !(await matchPassword(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      familyId: user.familyId,
      requests: user.requests,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error during login" });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────
// Returns logged-in user info (useful for frontend session restore)
router.get("/me", protect, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
