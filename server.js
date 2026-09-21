const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database("foodbridge.db");

db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('donor', 'volunteer')),
    phone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    donor_id INTEGER NOT NULL,
    food_name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    expiry_time TEXT NOT NULL,
    pickup_address TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Available',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pickup_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    donation_id INTEGER NOT NULL,
    volunteer_id INTEGER NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'Pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
    FOREIGN KEY (volunteer_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "foodbridge-development-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Please login first."
    });
  }

  next();
}

function validateText(value, fieldName) {
  if (!value || String(value).trim() === "") {
    return `${fieldName} is required.`;
  }

  return null;
}

app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.json({
      loggedIn: false
    });
  }

  res.json({
    loggedIn: true,
    user: req.session.user
  });
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const missingName = validateText(name, "Name");
    const missingEmail = validateText(email, "Email");
    const missingPassword = validateText(password, "Password");

    if (missingName || missingEmail || missingPassword) {
      return res.status(400).json({
        success: false,
        message: missingName || missingEmail || missingPassword
      });
    }

    if (!["donor", "volunteer"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account role."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(password, 10);

    const statement = db.prepare(`
      INSERT INTO users (name, email, password, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = statement.run(
      name.trim(),
      normalizedEmail,
      hashedPassword,
      role,
      phone ? phone.trim() : ""
    );

    res.json({
      success: true,
      message: "Registration successful.",
      userId: result.lastInsertRowid
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        success: false,
        message: "This email is already registered."
      });
    }

    res.status(500).json({
      success: false,
      message: "Registration failed."
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    };

    res.json({
      success: true,
      message: "Login successful.",
      user: req.session.user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login failed."
    });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      success: true,
      message: "Logged out successfully."
    });
  });
});

app.post("/api/donations", requireLogin, (req, res) => {
  try {
    if (req.session.user.role !== "donor") {
      return res.status(403).json({
        success: false,
        message: "Only donors can register food donations."
      });
    }

    const {
      foodName,
      category,
      quantity,
      unit,
      expiryTime,
      pickupAddress,
      description
    } = req.body;

    if (
      !foodName ||
      !category ||
      !quantity ||
      !unit ||
      !expiryTime ||
      !pickupAddress
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields."
      });
    }

    if (Number(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than zero."
      });
    }

    const result = db
      .prepare(`
        INSERT INTO donations
        (donor_id, food_name, category, quantity, unit, expiry_time, pickup_address, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        req.session.user.id,
        foodName.trim(),
        category,
        Number(quantity),
        unit,
        expiryTime,
        pickupAddress.trim(),
        description ? description.trim() : ""
      );

    res.json({
      success: true,
      message: "Food donation registered successfully.",
      donationId: result.lastInsertRowid
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not save donation."
    });
  }
});

app.get("/api/donations", requireLogin, (req, res) => {
  try {
    const donations = db
      .prepare(`
        SELECT
          donations.*,
          users.name AS donor_name,
          users.phone AS donor_phone
        FROM donations
        JOIN users ON users.id = donations.donor_id
        WHERE donations.status = 'Available'
        ORDER BY donations.created_at DESC
      `)
      .all();

    res.json({
      success: true,
      donations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not load donations."
    });
  }
});

app.get("/api/my-donations", requireLogin, (req, res) => {
  try {
    const donations = db
      .prepare(`
        SELECT *
        FROM donations
        WHERE donor_id = ?
        ORDER BY created_at DESC
      `)
      .all(req.session.user.id);

    res.json({
      success: true,
      donations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not load donation history."
    });
  }
});

app.post("/api/pickups", requireLogin, (req, res) => {
  try {
    if (req.session.user.role !== "volunteer") {
      return res.status(403).json({
        success: false,
        message: "Only volunteers can request pickups."
      });
    }

    const { donationId, message } = req.body;

    const donation = db
      .prepare(`
        SELECT *
        FROM donations
        WHERE id = ? AND status = 'Available'
      `)
      .get(donationId);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: "This donation is no longer available."
      });
    }

    const existingRequest = db
      .prepare(`
        SELECT id
        FROM pickup_requests
        WHERE donation_id = ? AND volunteer_id = ?
      `)
      .get(donationId, req.session.user.id);

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: "You already requested this pickup."
      });
    }

    db.prepare(`
      INSERT INTO pickup_requests
      (donation_id, volunteer_id, message)
      VALUES (?, ?, ?)
    `).run(
      donationId,
      req.session.user.id,
      message ? message.trim() : ""
    );

    db.prepare(`
      UPDATE donations
      SET status = 'Pickup Requested'
      WHERE id = ?
    `).run(donationId);

    res.json({
      success: true,
      message: "Pickup request sent successfully."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not create pickup request."
    });
  }
});

app.get("/api/pickups", requireLogin, (req, res) => {
  try {
    let pickups;

    if (req.session.user.role === "donor") {
      pickups = db
        .prepare(`
          SELECT
            pickup_requests.*,
            donations.food_name,
            donations.quantity,
            donations.unit,
            users.name AS volunteer_name,
            users.phone AS volunteer_phone
          FROM pickup_requests
          JOIN donations ON donations.id = pickup_requests.donation_id
          JOIN users ON users.id = pickup_requests.volunteer_id
          WHERE donations.donor_id = ?
          ORDER BY pickup_requests.created_at DESC
        `)
        .all(req.session.user.id);
    } else {
      pickups = db
        .prepare(`
          SELECT
            pickup_requests.*,
            donations.food_name,
            donations.quantity,
            donations.unit,
            donations.pickup_address,
            users.name AS donor_name,
            users.phone AS donor_phone
          FROM pickup_requests
          JOIN donations ON donations.id = pickup_requests.donation_id
          JOIN users ON users.id = donations.donor_id
          WHERE pickup_requests.volunteer_id = ?
          ORDER BY pickup_requests.created_at DESC
        `)
        .all(req.session.user.id);
    }

    res.json({
      success: true,
      pickups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not load pickup requests."
    });
  }
});

app.patch("/api/pickups/:id", requireLogin, (req, res) => {
  try {
    if (req.session.user.role !== "donor") {
      return res.status(403).json({
        success: false,
        message: "Only donors can update pickup requests."
      });
    }

    const { status } = req.body;

    if (!["Accepted", "Rejected", "Completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pickup status."
      });
    }

    const pickup = db
      .prepare(`
        SELECT pickup_requests.*, donations.donor_id, donations.id AS donation_id
        FROM pickup_requests
        JOIN donations ON donations.id = pickup_requests.donation_id
        WHERE pickup_requests.id = ?
      `)
      .get(req.params.id);

    if (!pickup || pickup.donor_id !== req.session.user.id) {
      return res.status(404).json({
        success: false,
        message: "Pickup request not found."
      });
    }

    db.prepare(`
      UPDATE pickup_requests
      SET status = ?
      WHERE id = ?
    `).run(status, req.params.id);

    if (status === "Accepted") {
      db.prepare(`
        UPDATE donations
        SET status = 'Accepted'
        WHERE id = ?
      `).run(pickup.donation_id);
    }

    if (status === "Completed") {
      db.prepare(`
        UPDATE donations
        SET status = 'Completed'
        WHERE id = ?
      `).run(pickup.donation_id);
    }

    if (status === "Rejected") {
      db.prepare(`
        UPDATE donations
        SET status = 'Available'
        WHERE id = ?
      `).run(pickup.donation_id);
    }

    res.json({
      success: true,
      message: `Pickup marked as ${status}.`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not update pickup."
    });
  }
});

app.get("/api/dashboard", requireLogin, (req, res) => {
  try {
    const totalDonations = db
      .prepare("SELECT COUNT(*) AS count FROM donations")
      .get().count;

    const foodRescued = db
      .prepare(`
        SELECT COALESCE(SUM(quantity), 0) AS total
        FROM donations
        WHERE status IN ('Accepted', 'Completed', 'Pickup Requested')
      `)
      .get().total;

    const pendingPickups = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM pickup_requests
        WHERE status = 'Pending'
      `)
      .get().count;

    const activeVolunteers = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM users
        WHERE role = 'volunteer'
      `)
      .get().count;

    const availableDonations = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM donations
        WHERE status = 'Available'
      `)
      .get().count;

    res.json({
      success: true,
      dashboard: {
        totalDonations,
        foodRescued,
        pendingPickups,
        activeVolunteers,
        availableDonations
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not load dashboard."
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`FoodBridge is running at http://localhost:${PORT}`);
});