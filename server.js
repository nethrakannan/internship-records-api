
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- BASIC CONFIGURATION --------------------

app.use(
  cors({
    origin: [
      "https://nethrakannan.github.io",
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(express.json({ limit: "10kb" }));

// Basic security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Basic request logging
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
  );
  next();
});

// -------------------- DATABASE --------------------

const db = new Database("internships.db");

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS internships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    location TEXT NOT NULL,
    stipend INTEGER NOT NULL DEFAULT 0,
    duration TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    internshipId INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    reason TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (internshipId) REFERENCES internships(id)
  );
`);

// Seed internships only when the table is empty
const internshipCount = db
  .prepare("SELECT COUNT(*) AS count FROM internships")
  .get().count;

if (internshipCount === 0) {
  const insertInternship = db.prepare(`
    INSERT INTO internships (company, role, location, stipend, duration)
    VALUES (?, ?, ?, ?, ?)
  `);

  const seedInternships = [
    ["ABC Technologies", "Web Developer", "Remote", 5000, "1 month"],
    ["XYZ Solutions", "Frontend Developer", "Remote", 8000, "2 months"],
    ["Tech India", "Data Analyst", "Chennai", 6000, "3 months"]
  ];

  const insertMany = db.transaction((internships) => {
    for (const internship of internships) {
      insertInternship.run(...internship);
    }
  });

  insertMany(seedInternships);
}

// -------------------- HEALTH CHECK --------------------

app.get("/api/health", (req, res) => {
  try {
    db.prepare("SELECT 1").get();

    res.status(200).json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Health check failed:", error.message);

    res.status(500).json({
      success: false,
      status: "unhealthy"
    });
  }
});

// -------------------- INTERNSHIP ROUTES --------------------

// Get all internships with pagination
app.get("/api/internships", (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100
    );

    const offset = (page - 1) * limit;

    const internships = db
      .prepare(
        `SELECT * FROM internships
         ORDER BY id ASC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset);

    const total = db
      .prepare("SELECT COUNT(*) AS count FROM internships")
      .get().count;

    res.json({
      success: true,
      data: internships,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Failed to get internships:", error.message);

    res.status(500).json({
      success: false,
      error: "Failed to retrieve internships"
    });
  }
});

// Get one internship
app.get("/api/internships/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid internship ID"
      });
    }

    const internship = db
      .prepare("SELECT * FROM internships WHERE id = ?")
      .get(id);

    if (!internship) {
      return res.status(404).json({
        success: false,
        error: "Internship not found"
      });
    }

    res.json({
      success: true,
      data: internship
    });
  } catch (error) {
    console.error("Failed to get internship:", error.message);

    res.status(500).json({
      success: false,
      error: "Failed to retrieve internship"
    });
  }
});

// Create an internship
app.post("/api/internships", (req, res) => {
  try {
    const { company, role, location, stipend, duration } = req.body;

    if (
      !company ||
      !role ||
      !location ||
      stipend === undefined ||
      !duration
    ) {
      return res.status(400).json({
        success: false,
        error: "All internship fields are required"
      });
    }

    const stipendValue = Number(stipend);

    if (!Number.isFinite(stipendValue) || stipendValue < 0) {
      return res.status(400).json({
        success: false,
        error: "Stipend must be a valid non-negative number"
      });
    }

    const result = db
      .prepare(
        `INSERT INTO internships (company, role, location, stipend, duration)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        String(company).trim(),
        String(role).trim(),
        String(location).trim(),
        stipendValue,
        String(duration).trim()
      );

    const createdInternship = db
      .prepare("SELECT * FROM internships WHERE id = ?")
      .get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: "Internship created successfully",
      data: createdInternship
    });
  } catch (error) {
    console.error("Failed to create internship:", error.message);

    res.status(500).json({
      success: false,
      error: "Failed to create internship"
    });
  }
});

// Update an internship
app.put("/api/internships/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const { company, role, location, stipend, duration } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid internship ID"
      });
    }

    if (
      !company ||
      !role ||
      !location ||
      stipend === undefined ||
      !duration
    ) {
      return res.status(400).json({
        success: false,
        error: "All internship fields are required"
      });
    }

    const stipendValue = Number(stipend);

    if (!Number.isFinite(stipendValue) || stipendValue < 0) {
      return res.status(400).json({
        success: false,
        error: "Stipend must be a valid non-negative number"
      });
    }

    const result = db
      .prepare(
        `UPDATE internships
         SET company = ?, role = ?, location = ?, stipend = ?, duration = ?
         WHERE id = ?`
      )
      .run(
        String(company).trim(),
        String(role).trim(),
        String(location).trim(),
        stipendValue,
        String(duration).trim(),
        id
      );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: "Internship not found"
      });
    }

    const updatedInternship = db
      .prepare("SELECT * FROM internships WHERE id = ?")
      .get(id);

    res.json({
      success: true,
      message: "Internship updated successfully",
      data: updatedInternship
    });
  } catch (error) {
    console.error("Failed to update internship:", error.message);

    res.status(500).json({
      success: false,
      error: "Failed to update internship"
    });
  }
});

// Delete an internship
app.delete("/api/internships/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid internship ID"
      });
    }

    const result = db
      .prepare("DELETE FROM internships WHERE id = ?")
      .run(id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: "Internship not found"
      });
    }

    res.json({
      success: true,
      message: "Internship deleted successfully"
    });
  } catch (error) {
    console.error("Failed to delete internship:", error.message);

    res.status(500).json({
      success: false,
      error: "Failed to delete internship"
    });
  }
});

// -------------------- APPLICATION ROUTE --------------------

app.post("/api/applications", (req, res) => {
  try {
    const { internshipId, name, email, phone, reason } = req.body;

    if (
      internshipId === undefined ||
      !name ||
      !email ||
      !phone ||
      !reason
    ) {
      return res.status(400).json({
        success: false,
        error: "All application fields are required"
      });
    }

    const id = Number(internshipId);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid internship ID"
      });
    }

    const emailValue = String(email).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid email address"
      });
    }

    const internship = db
      .prepare("SELECT id FROM internships WHERE id = ?")
      .get(id);

    if (!internship) {
      return res.status(404).json({
        success: false,
        error: "The selected internship was not found"
      });
    }

    const result = db
      .prepare(
        `INSERT INTO applications
         (internshipId, name, email, phone, reason)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        id,
        String(name).trim(),
        emailValue,
        String(phone).trim(),
        String(reason).trim()
      );

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      applicationId: result.lastInsertRowid
    });
  } catch (error) {
    console.error("Failed to submit application:", error.message);

    res.status(500).json({
      success: false,
      error: "Failed to submit application"
    });
  }
});

// -------------------- 404 AND ERROR HANDLING --------------------

// Keep this AFTER all API routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found"
  });
});

// Handle unexpected errors
app.use((error, req, res, next) => {
  console.error("Unexpected server error:", error.message);

  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

// -------------------- START SERVER --------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Internship API is running on port ${PORT}`);
});
