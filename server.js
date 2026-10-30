
const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("internships.db");

app.use(express.json());

// Create database table
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

// Add sample data
const count = db.prepare("SELECT COUNT(*) AS total FROM internships").get();

if (count.total === 0) {
    const insert = db.prepare(`
        INSERT INTO internships
        (company, role, location, stipend, duration)
        VALUES (?, ?, ?, ?, ?)
    `);

    insert.run("ABC Technologies", "Web Developer", "Remote", 5000, "1 month");
    insert.run("XYZ Solutions", "Frontend Developer", "Remote", 8000, "2 months");
    insert.run("Tech India", "Data Analyst", "Chennai", 6000, "3 months");
}

// Validate input
function validate(data) {
    for (const field of ["company", "role", "location", "duration"]) {
        if (typeof data[field] !== "string" || !data[field].trim()) {
            return field + " is required";
        }
    }

    if (
        data.stipend !== undefined &&
        (!Number.isInteger(data.stipend) || data.stipend < 0)
    ) {
        return "Stipend must be a non-negative integer";
    }

    return null;
}

// GET: List internships with pagination
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

// GET: View one internship
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

    res.json({ success: true, data: record });
});

// POST: Create internship
app.post("/api/internships", (req, res) => {
    const error = validate(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            error
        });
    }

    const { company, role, location, stipend = 0, duration } = req.body;

    const result = db.prepare(`
        INSERT INTO internships
        (company, role, location, stipend, duration)
        VALUES (?, ?, ?, ?, ?)
    `).run(company.trim(), role.trim(), location.trim(), stipend, duration.trim());

    const record = db.prepare(
        "SELECT * FROM internships WHERE id = ?"
    ).get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: record });
});

// PUT: Update internship
app.put("/api/internships/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
            success: false,
            error: "Invalid internship ID"
        });
    }

    const error = validate(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            error
        });
    }

    const { company, role, location, stipend = 0, duration } = req.body;

    const result = db.prepare(`
        UPDATE internships
        SET company = ?, role = ?, location = ?,
            stipend = ?, duration = ?
        WHERE id = ?
    `).run(company.trim(), role.trim(), location.trim(), stipend, duration.trim(), id);

    if (result.changes === 0) {
        return res.status(404).json({
            success: false,
            error: "Internship not found"
        });
    }

    const record = db.prepare(
        "SELECT * FROM internships WHERE id = ?"
    ).get(id);

    res.json({ success: true, data: record });
});

// DELETE: Remove internship
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

// Handle unknown routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Route not found"
    });
});

// Start server
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
