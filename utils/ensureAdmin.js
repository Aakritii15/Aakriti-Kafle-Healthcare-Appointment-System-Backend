const bcrypt = require("bcrypt");
const User = require("../models/User");

/**
 * Ensures a single admin user exists (created from .env).
 * Admin cannot be registered from UI.
 */
async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    console.log("[ADMIN] ADMIN_EMAIL / ADMIN_PASSWORD not set. Skipping admin seed.");
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    let changed = false;

    // Ensure role is admin
    if (existing.role !== "admin") {
      existing.role = "admin";
      changed = true;
    }

    // Ensure password matches .env (reset if different)
    const passwordMatches = await bcrypt.compare(password, existing.password);
    if (!passwordMatches) {
      existing.password = await bcrypt.hash(password, 10);
      changed = true;
      console.log(`[ADMIN] Reset admin password from .env for: ${email}`);
    }

    if (changed) {
      existing.updatedAt = new Date();
      await existing.save();
      console.log(`[ADMIN] Admin ensured/updated: ${email}`);
    } else {
      console.log(`[ADMIN] Admin already exists and password matches: ${email}`);
    }
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await User.create({
    username: "System Admin",
    email,
    password: hashed,
    role: "admin",
    isActive: true,
  });

  console.log(`[ADMIN] Seeded admin user: ${email}`);
}

module.exports = ensureAdmin;

