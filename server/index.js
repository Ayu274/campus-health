const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Database Connection ───────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to PostgreSQL database!");
  }
});

// ─── Auth Middleware ───────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access denied. No token." });
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token." });
  }
};

// ─── TEST ROUTE ────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    message: "🏥 Campus Health API is running!",
    version: "1.0.0",
    endpoints: [
      "POST /api/auth/login",
      "GET  /api/students",
      "POST /api/students",
      "GET  /api/appointments",
      "POST /api/appointments",
      "GET  /api/doctors",
      "GET  /api/prescriptions",
      "GET  /api/inventory",
      "GET  /api/analytics/summary",
    ],
  });
});

// ══════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found." });
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ error: "Invalid password." });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.json({
      message: "Login successful!",
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role)
    return res.status(400).json({ error: "All fields are required." });
  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role",
      [email, hashedPassword, role]
    );
    res.status(201).json({ message: "User registered!", user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Email already exists." });
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// STUDENT ROUTES
// ══════════════════════════════════════════════════════════════════

// GET /api/students
app.get("/api/students", authenticateToken, async (req, res) => {
  const { search, dept, year } = req.query;
  try {
    let query = "SELECT * FROM students WHERE is_active = true";
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (full_name ILIKE $${params.length} OR id ILIKE $${params.length})`;
    }
    if (dept) {
      params.push(dept);
      query += ` AND department = $${params.length}`;
    }
    if (year) {
      params.push(year);
      query += ` AND year = $${params.length}`;
    }
    query += " ORDER BY full_name ASC";
    const result = await pool.query(query, params);
    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/:id
app.get("/api/students/:id", authenticateToken, async (req, res) => {
  try {
    const student = await pool.query("SELECT * FROM students WHERE id = $1", [req.params.id]);
    if (student.rows.length === 0)
      return res.status(404).json({ error: "Student not found." });
    const allergies = await pool.query(
      "SELECT * FROM student_allergies WHERE student_id = $1",
      [req.params.id]
    );
    res.json({ ...student.rows[0], allergies: allergies.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/students
app.post("/api/students", authenticateToken, async (req, res) => {
  const { id, full_name, department, year, dob, gender, blood_group, phone, address } = req.body;
  if (!id || !full_name || !department)
    return res.status(400).json({ error: "ID, name and department are required." });
  try {
    const result = await pool.query(
      `INSERT INTO students (id, full_name, department, year, dob, gender, blood_group, phone, address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, full_name, department, year, dob, gender, blood_group, phone, address]
    );
    res.status(201).json({ message: "Student registered!", student: result.rows[0] });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Student ID already exists." });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/students/:id
app.put("/api/students/:id", authenticateToken, async (req, res) => {
  const { full_name, department, year, blood_group, phone, address } = req.body;
  try {
    const result = await pool.query(
      `UPDATE students SET full_name=$1, department=$2, year=$3,
       blood_group=$4, phone=$5, address=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [full_name, department, year, blood_group, phone, address, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Student not found." });
    res.json({ message: "Student updated!", student: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/students/:id (soft delete)
app.delete("/api/students/:id", authenticateToken, async (req, res) => {
  try {
    await pool.query("UPDATE students SET is_active=false WHERE id=$1", [req.params.id]);
    res.json({ message: "Student removed." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// APPOINTMENT ROUTES
// ══════════════════════════════════════════════════════════════════

// GET /api/appointments
app.get("/api/appointments", authenticateToken, async (req, res) => {
  const { date, status, doctor_id, student_id } = req.query;
  try {
    let query = `
      SELECT a.*, s.full_name AS patient_name, s.department,
             st.full_name AS doctor_name, st.specialization
      FROM appointments a
      JOIN students s  ON a.student_id = s.id
      JOIN staff    st ON a.doctor_id  = st.id
      WHERE 1=1
    `;
    const params = [];
    if (date)      { params.push(date);      query += ` AND a.appointment_date = $${params.length}`; }
    if (status)    { params.push(status);    query += ` AND a.status = $${params.length}`; }
    if (doctor_id) { params.push(doctor_id); query += ` AND a.doctor_id = $${params.length}`; }
    if (student_id){ params.push(student_id);query += ` AND a.student_id = $${params.length}`; }
    query += " ORDER BY a.appointment_date DESC, a.appointment_time ASC";
    const result = await pool.query(query, params);
    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appointments
app.post("/api/appointments", authenticateToken, async (req, res) => {
  const { student_id, doctor_id, appointment_date, appointment_time, reason } = req.body;
  if (!student_id || !doctor_id || !appointment_date || !appointment_time)
    return res.status(400).json({ error: "All fields are required." });
  try {
    const result = await pool.query(
      `INSERT INTO appointments (student_id, doctor_id, appointment_date, appointment_time, reason, booked_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [student_id, doctor_id, appointment_date, appointment_time, reason, req.user.id]
    );
    res.status(201).json({ message: "Appointment booked!", appointment: result.rows[0] });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "This slot is already booked." });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/appointments/:id/status
app.patch("/api/appointments/:id/status", authenticateToken, async (req, res) => {
  const { status, notes } = req.body;
  const validStatuses = ["pending","confirmed","waiting","in_progress","completed","cancelled","no_show"];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: "Invalid status." });
  try {
    const result = await pool.query(
      "UPDATE appointments SET status=$1, notes=$2, updated_at=NOW() WHERE id=$3 RETURNING *",
      [status, notes, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Appointment not found." });
    res.json({ message: "Status updated!", appointment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/appointments/:id
app.delete("/api/appointments/:id", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM appointments WHERE id=$1", [req.params.id]);
    res.json({ message: "Appointment cancelled." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// DOCTOR / STAFF ROUTES
// ══════════════════════════════════════════════════════════════════

// GET /api/doctors
app.get("/api/doctors", authenticateToken, async (req, res) => {
  const { status, department } = req.query;
  try {
    let query = "SELECT * FROM staff WHERE 1=1";
    const params = [];
    if (status)     { params.push(status);     query += ` AND status = $${params.length}`; }
    if (department) { params.push(department); query += ` AND specialization ILIKE $${params.length}`; }
    query += " ORDER BY full_name ASC";
    const result = await pool.query(query, params);
    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/doctors
app.post("/api/doctors", authenticateToken, async (req, res) => {
  const { full_name, staff_type, specialization, qualification, license_no, phone, email } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO staff (full_name, staff_type, specialization, qualification, license_no, phone, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [full_name, staff_type, specialization, qualification, license_no, phone, email]
    );
    res.status(201).json({ message: "Staff added!", staff: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/doctors/:id/status
app.patch("/api/doctors/:id/status", authenticateToken, async (req, res) => {
  const { status } = req.body;
  try {
    const result = await pool.query(
      "UPDATE staff SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [status, req.params.id]
    );
    res.json({ message: "Status updated!", staff: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// MEDICAL RECORDS ROUTES
// ══════════════════════════════════════════════════════════════════

// GET /api/records/student/:studentId
app.get("/api/records/student/:studentId", authenticateToken, async (req, res) => {
  try {
    const student = await pool.query("SELECT * FROM students WHERE id=$1", [req.params.studentId]);
    if (student.rows.length === 0)
      return res.status(404).json({ error: "Student not found." });
    const records = await pool.query(
      `SELECT r.*, s.full_name AS doctor_name
       FROM medical_records r
       JOIN staff s ON r.doctor_id = s.id
       WHERE r.student_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.studentId]
    );
    res.json({ student: student.rows[0], records: records.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/records
app.post("/api/records", authenticateToken, async (req, res) => {
  const { student_id, appointment_id, doctor_id, record_type, content } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO medical_records (student_id, appointment_id, doctor_id, record_type, content)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [student_id, appointment_id, doctor_id, record_type, content]
    );
    res.status(201).json({ message: "Record created!", record: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PRESCRIPTION ROUTES
// ══════════════════════════════════════════════════════════════════

// GET /api/prescriptions
app.get("/api/prescriptions", authenticateToken, async (req, res) => {
  const { student_id, dispensed } = req.query;
  try {
    let query = `
      SELECT p.*, s.full_name AS patient_name, st.full_name AS doctor_name,
             json_agg(pi.*) AS items
      FROM prescriptions p
      JOIN students s  ON p.student_id = s.id
      JOIN staff    st ON p.doctor_id  = st.id
      JOIN prescription_items pi ON pi.prescription_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (student_id) { params.push(student_id); query += ` AND p.student_id = $${params.length}`; }
    if (dispensed !== undefined) { params.push(dispensed === "true"); query += ` AND p.dispensed = $${params.length}`; }
    query += " GROUP BY p.id, s.full_name, st.full_name ORDER BY p.created_at DESC";
    const result = await pool.query(query, params);
    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/prescriptions
app.post("/api/prescriptions", authenticateToken, async (req, res) => {
  const { student_id, doctor_id, appointment_id, items, notes } = req.body;
  if (!items || items.length === 0)
    return res.status(400).json({ error: "At least one drug item is required." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pRes = await client.query(
      `INSERT INTO prescriptions (student_id, doctor_id, appointment_id, notes)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [student_id, doctor_id, appointment_id, notes]
    );
    const prescriptionId = pRes.rows[0].id;
    for (const item of items) {
      await client.query(
        `INSERT INTO prescription_items (prescription_id, drug_name, dose, frequency, route, instructions)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [prescriptionId, item.drug_name, item.dose, item.frequency, item.route || "oral", item.instructions]
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ message: "Prescription created!", prescription_id: prescriptionId });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/prescriptions/:id/dispense
app.patch("/api/prescriptions/:id/dispense", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE prescriptions SET dispensed=true, dispensed_by=$1, dispensed_at=NOW()
       WHERE id=$2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Prescription not found." });
    res.json({ message: "Prescription dispensed!", prescription: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// INVENTORY ROUTES
// ══════════════════════════════════════════════════════════════════

// GET /api/inventory
app.get("/api/inventory", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM drugs ORDER BY drug_name ASC");
    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/alerts
app.get("/api/inventory/alerts", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM v_low_stock_drugs");
    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory
app.post("/api/inventory", authenticateToken, async (req, res) => {
  const { drug_name, generic_name, category, unit, stock_qty, reorder_level, expiry_date, batch_no, supplier } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO drugs (drug_name, generic_name, category, unit, stock_qty, reorder_level, expiry_date, batch_no, supplier)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [drug_name, generic_name, category, unit, stock_qty, reorder_level, expiry_date, batch_no, supplier]
    );
    res.status(201).json({ message: "Drug added to inventory!", drug: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/inventory/:id (restock)
app.patch("/api/inventory/:id", authenticateToken, async (req, res) => {
  const { action, quantity } = req.body;
  try {
    const op = action === "add" ? "+" : "-";
    const result = await pool.query(
      `UPDATE drugs SET stock_qty = stock_qty ${op} $1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [quantity, req.params.id]
    );
    res.json({ message: "Stock updated!", drug: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// ANALYTICS ROUTES
// ══════════════════════════════════════════════════════════════════

// GET /api/analytics/summary
app.get("/api/analytics/summary", authenticateToken, async (req, res) => {
  try {
    const [appts, students, prescriptions, doctors] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM appointments WHERE appointment_date = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM students WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM prescriptions WHERE DATE(created_at) = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM staff WHERE status = 'available'"),
    ]);
    res.json({
      today_appointments: parseInt(appts.rows[0].count),
      total_students:     parseInt(students.rows[0].count),
      prescriptions_today:parseInt(prescriptions.rows[0].count),
      active_doctors:     parseInt(doctors.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/diagnoses
app.get("/api/analytics/diagnoses", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT content AS diagnosis, COUNT(*) AS cases
      FROM medical_records
      WHERE record_type = 'diagnosis'
      GROUP BY content
      ORDER BY cases DESC
      LIMIT 10
    `);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start Server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Campus Health Server running on http://localhost:${PORT}`);
  console.log(`📋 Test it: http://localhost:${PORT}/`);
});