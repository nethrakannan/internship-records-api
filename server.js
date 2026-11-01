
const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("internships.db");

const PORT = process.env.PORT || 3000;

// ========================================
// SECURITY: CORS
// ========================================

const allowedOrigin = "https://nethrakannan.github.io";

app.use((req, res, next) => {
    res.setHeader("Vary", "Origin");

    if (req.headers.origin === allowedOrigin) {
        res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    }

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

// ========================================
// SECURITY: HTTP HEADERS
// ========================================

app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-XSS-Protection", "0");

    next();
});

// ========================================
// SECURITY: BASIC RATE LIMITING
// ========================================

const requestCounts = new Map();

app.use((req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowTime = 15 * 60 * 1000;
    const maxRequests = 100;

    let userRequests = requestCounts.get(ip);

    if (!userRequests || now - userRequests.start > windowTime) {
        userRequests = {
            start: now,
            count: 0
        };
    }

    userRequests.count++;

    requestCounts.set(ip, userRequests);

    if (userRequests.count > maxRequests) {
        return res.status(429).json({
            success: false,
            error: "Too many requests. Please try again later."
        });
    }

    next();
});

// ========================================
// JSON MIDDLEWARE
// ========================================

app.use(express.json({ limit: "10kb" }));

// ========================================
// DATABASE
// ========================================

db.exec(`
CREATE TABLE IF NOT EXISTS internships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    location TEXT NOT NULL,
    stipend INTEGER DEFAULT 0,
    duration TEXT NOT NULL
);
`);

// Application table
db.exec(`
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    internship_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (internship_id) REFERENCES internships(id)
);
`);

// ========================================
// SAMPLE INTERNSHIP DATA
// ========================================

const count = db.prepare(
    "SELECT COUNT(*) AS total FROM internships"
).get();

if (count.total === 0) {
    const insert = db.prepare(`
        INSERT INTO internships
        (company, role, location, stipend, duration)
        VALUES (?, ?, ?, ?, ?)
    `);

    insert.run(
        "ABC Technologies",
        "Web Developer",
        "Remote",
        5000,
        "1 month"
    );

    insert.run(
        "XYZ Solutions",
        "Frontend Developer",
        "Remote",
        8000,
        "2 months"
    );

    insert.run(
        "Tech India",
        "Data Analyst",
        "Chennai",
        6000,
        "3 months"
    );
}

// ========================================
// VALIDATE INTERNSHIP INPUT
// ========================================

function validateInternship(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return "Invalid request data";
    }

    for (const field of ["company", "role", "location", "duration"]) {
        if (
            typeof data[field] !== "string" ||
            !data[field].trim()
        ) {
            return field + " is required";
        }
    }

    if (
        data.stipend !== undefined &&
        (
            !Number.isInteger(data.stipend) ||
            data.stipend < 0
        )
    ) {
        return "Stipend must be a non-negative integer";
    }

    return null;
}

// ========================================
// GET: LIST INTERNSHIPS
// ========================================

app.get("/api/internships", (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    if (
        !Number.isInteger(page) ||
        !Number.isInteger(limit) ||
        page < 1 ||
        limit < 1 ||
        limit > 100
    ) {
        return res.status(400).json({
            success: false,
            error: "Invalid page or limit"
        });
    }

    const records = db.prepare(`
        SELECT * FROM internships
        LIMIT ? OFFSET ?
    `).all(limit, (page - 1) * limit);

    const total = db.prepare(
        "SELECT COUNT(*) AS total FROM internships"
    ).get().total;

    res.json({
        success: true,
        data: records,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
});

// ========================================
// GET: VIEW ONE INTERNSHIP
// ========================================

app.get("/api/internships/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
            success: false,
            error: "Invalid internship ID"
        });
    }

    const record = db.prepare(
        "SELECT * FROM internships WHERE id = ?"
    ).get(id);

    if (!record) {
        return res.status(404).json({
            success: false,
            error: "Internship not found"
        });
    }

    res.json({
        success: true,
        data: record
    });
});

// ========================================
// POST: CREATE INTERNSHIP
// ========================================

app.post("/api/internships", (req, res) => {
    const error = validateInternship(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            error
        });
    }

    const {
        company,
        role,
        location,
        stipend = 0,
        duration
    } = req.body;

    const result = db.prepare(`
        INSERT INTO internships
        (company, role, location, stipend, duration)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        company.trim(),
        role.trim(),
        location.trim(),
        stipend,
        duration.trim()
    );

    const record = db.prepare(
        "SELECT * FROM internships WHERE id = ?"
    ).get(result.lastInsertRowid);

    res.status(201).json({
        success: true,
        data: record
    });
});

// ========================================
// PUT: UPDATE INTERNSHIP
// ========================================

app.put("/api/internships/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
            success: false,
            error: "Invalid internship ID"
        });
    }

    const error = validateInternship(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            error
        });
    }

    const {
        company,
        role,
        location,
        stipend = 0,
        duration
    } = req.body;

    const result = db.prepare(`
        UPDATE internships
        SET company = ?,
            role = ?,
            location = ?,
            stipend = ?,
            duration = ?
        WHERE id = ?
    `).run(
        company.trim(),
        role.trim(),
        location.trim(),
        stipend,
        duration.trim(),
        id
    );

    if (result.changes === 0) {
        return res.status(404).json({
            success: false,
            error: "Internship not found"
        });
    }

    const record = db.prepare(
        "SELECT * FROM internships WHERE id = ?"
    ).get(id);

    res.json({
        success: true,
        data: record
    });
});

// ========================================
// DELETE: REMOVE INTERNSHIP
// ========================================

app.delete("/api/internships/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
            success: false,
            error: "Invalid internship ID"
        });
    }

    const result = db.prepare(
        "DELETE FROM internships WHERE id = ?"
    ).run(id);

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
});

// ========================================
// POST: SUBMIT INTERNSHIP APPLICATION
// ========================================

app.post("/api/applications", (req, res) => {
    const {
        internshipId,
        name,
        email,
        phone,
        reason
    } = req.body || {};

    if (
        !Number.isInteger(internshipId) ||
        internshipId < 1
    ) {
        return res.status(400).json({
            success: false,
            error: "Valid internship ID is required"
        });
    }

    if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 100
    ) {
        return res.status(400).json({
            success: false,
            error: "Name must contain 2 to 100 characters"
        });
    }

    if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        return res.status(400).json({
            success: false,
            error: "Enter a valid email address"
        });
    }

    if (
        typeof phone !== "string" ||
        !/^[0-9]{10,15}$/.test(phone)
    ) {
        return res.status(400).json({
            success: false,
            error: "Phone must contain 10 to 15 digits"
        });
    }

    if (
        typeof reason !== "string" ||
        reason.trim().length < 10 ||
        reason.trim().length > 1000
    ) {
        return res.status(400).json({
            success: false,
            error: "Reason must contain 10 to 1000 characters"
        });
    }

    const internship = db.prepare(
        "SELECT id FROM internships WHERE id = ?"
    ).get(internshipId);

    if (!internship) {
        return res.status(404).json({
            success: false,
            error: "Internship not found"
        });
    }

    const result = db.prepare(`
        INSERT INTO applications
        (internship_id, name, email, phone, reason)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        internshipId,
        name.trim(),
        email.trim().toLowerCase(),
        phone,
        reason.trim()
    );

    res.status(201).json({
        success: true,
        message: "Application submitted successfully",
        applicationId: result.lastInsertRowid
    });
});

// ========================================
// HANDLE UNKNOWN ROUTES
// ========================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Route not found"
    });
});

// ========================================
// ERROR HANDLING
// ========================================

app.use((err, req, res, next) => {
    if (err.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            error: "Request body is too large"
        });
    }

    if (err instanceof SyntaxError && err.status === 400) {
        return res.status(400).json({
            success: false,
            error: "Invalid JSON data"
        });
    }

    console.error(err.message);

    res.status(500).json({
        success: false,
        error: "Internal server error"
    });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
